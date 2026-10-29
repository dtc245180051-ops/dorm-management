"""
Service AI tập trung tại Backend:
1. Gợi ý & Tự động xếp phòng KTX dựa trên nguyện vọng (AI Room Allocation).
2. Trợ lý ảo AI Chatbot tư vấn Nội quy & Quy định KTX (AI Regulation Chatbot).
Tự động nạp prompt từ thư mục app/prompts/ và hỗ trợ Smart Heuristic Fallback khi offline / hết quota.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional
import unicodedata
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _strip_accents(text: str) -> str:
    """Loại bỏ hoàn toàn dấu tiếng Việt để so khớp từ khóa chính xác tuyệt đối"""
    if not text:
        return ""
    text = text.replace("đ", "d").replace("Đ", "D")
    nfkd = unicodedata.normalize("NFD", text)
    return "".join(c for c in nfkd if unicodedata.category(c) != "Mn").lower().strip()


PROMPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "prompts")


def load_prompt_template(filename: str) -> str:
    """Đọc file prompt từ thư mục app/prompts/"""
    file_path = os.path.join(PROMPTS_DIR, filename)
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def _normalize_gender(gender: str = "") -> str:
    g = str(gender or "").strip().lower()
    if "nam" in g and ("nữ" in g or "nu" in g):
        return "ALL"
    if "cả" in g or "all" in g or "tat ca" in g:
        return "ALL"
    if "nữ" in g or "nu" in g or "female" in g or g == "f":
        return "FEMALE"
    if "nam" in g or "male" in g or g == "m":
        return "MALE"
    return "UNKNOWN"


def _is_gender_compatible(student_gender: str, room_gender: str) -> bool:
    s_norm = _normalize_gender(student_gender)
    r_norm = _normalize_gender(room_gender)
    if s_norm == "UNKNOWN" or r_norm == "UNKNOWN":
        return False
    # Phòng dùng chung "ALL" chấp nhận cả Nam và Nữ
    if r_norm == "ALL":
        return True
    # Ràng buộc cứng: Nam chỉ ở phòng MALE, Nữ chỉ ở phòng FEMALE
    return s_norm == r_norm


def _extract_json_from_text(raw_text: str) -> Optional[Dict[str, Any]]:
    """Trích xuất đối tượng JSON từ phản hồi văn bản của AI"""
    text = raw_text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if match:
        text = match.group(1).strip()
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        candidate = text[first_brace : last_brace + 1]
        try:
            data = json.loads(candidate)
            if isinstance(data, dict):
                return data
        except Exception:
            pass
    return None


_persistent_client = httpx.Client(
    timeout=10.0,
    limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
)


def _call_gemini_models(prompt: str, timeout: float = 8.0) -> Optional[str]:
    """Gọi Google Gemini API lần lượt qua các model candidates với cơ chế tối ưu kết nối và tự phục hồi"""
    global _persistent_client
    try:
        api_key = settings.get_gemini_api_key(required=True)
    except ValueError as e:
        print(f"❌ [Chatbot AI] Lỗi cấu hình API key: {e}")
        logger.warning(f"Không có GEMINI_API_KEY hợp lệ: {e}")
        return None

    # Ưu tiên gemini-3.1-flash-lite tốc độ cao, hạn mức quota lớn và không bị ngốn token bởi reasoning
    model_candidates = [
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash",
        "gemini-3-flash-preview",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
    ]

    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1200,
        },
    }

    for model_name in model_candidates:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        for attempt in range(2):
            try:
                res = _persistent_client.post(
                    url,
                    headers=headers,
                    json=body,
                    timeout=timeout,
                )
                if res.status_code == 200:
                    payload = res.json()
                    candidates = payload.get("candidates", [])
                    if candidates:
                        cand = candidates[0]
                        finish_reason = cand.get("finishReason")
                        content = cand.get("content", {})
                        parts = content.get("parts", [])
                        if parts and "text" in parts[0]:
                            text = parts[0]["text"]
                            # Nếu bị cắt ngang do chạm trần token khi câu chưa hoàn chỉnh, bỏ qua thử model tiếp theo
                            if finish_reason == "MAX_TOKENS" and (len(text) < 150 or not text.strip().endswith(('.', '!', '?', '"', '”', '\n'))):
                                logger.warning(f"Gemini {model_name} bị cắt cụt do MAX_TOKENS: {text[-60:]}")
                                continue
                            return text
                elif res.status_code == 503:
                    # Model bị quá tải tạm thời (Spikes in demand), thử model tiếp theo ngay
                    logger.warning(f"Gemini model {model_name} quá tải (HTTP 503), chuyển model tiếp theo")
                    break
                elif res.status_code == 429:
                    # Quota bị giới hạn, lập tức nhảy sang candidate tiếp theo
                    logger.warning(f"Gemini API ({model_name}) HTTP 429 Quota Exceeded, thử candidate khác...")
                    break
                elif res.status_code in (401, 403):
                    print("⚠️ [Chatbot AI] API key không hợp lệ (HTTP 401/403). Vui lòng cập nhật API key chuẩn vào file .env.")
                    logger.warning(f"Gemini API ({model_name}) HTTP {res.status_code}: {res.text[:120]}")
                    break
                else:
                    logger.warning(f"Gemini API ({model_name}) HTTP {res.status_code}: {res.text[:120]}")
                    break
            except Exception as e:
                logger.warning(f"Lỗi khi gọi Gemini ({model_name}, lần {attempt + 1}): {e}")
                # Nếu kết nối bị ngắt do mạng, tái tạo client mới để làm mới socket pool
                try:
                    _persistent_client.close()
                except Exception:
                    pass
                _persistent_client = httpx.Client(
                    timeout=10.0,
                    limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
                )
    return None




# ==============================================================================
# 1. LOGIC XẾP PHÒNG BẰNG AI (RECOMMEND ROOM)
# ==============================================================================

def _heuristic_room_matching(student_info: dict, eligible_rooms: list) -> dict:
    """Thuật toán xếp phòng dự phòng ngoại tuyến khi không có kết nối AI"""
    student_gender = student_info.get("gioi_tinh") or student_info.get("gender") or ""
    norm_g = _normalize_gender(student_gender)
    gender_label = "Nữ" if norm_g == "FEMALE" else ("Nam" if norm_g == "MALE" else (student_gender or "sinh viên"))
    not_found_msg = f"Không tìm thấy phòng phù hợp: Ký túc xá hiện không có phòng dành cho giới tính {gender_label} hoặc các phòng đã hết chỗ."

    if not eligible_rooms:
        return {
            "best_room_id": "",
            "toa": "",
            "giuong": "",
            "match_score": 0,
            "ai_reason": not_found_msg,
            "suggestion": None,
            "message": not_found_msg,
        }

    raw_wish = " ".join([
        str(student_info.get("nguyen_vong") or ""),
        str(student_info.get("noi_dung_nguyen_vong") or ""),
        str(student_info.get("nguyen_vong_label") or ""),
        str(student_info.get("chi_tiet_nguyen_vong") or ""),
        str(student_info.get("ma_toa_mong_muon") or ""),
        str(student_info.get("nguyen_vong_phong") or ""),
        str(student_info.get("tang_mong_muon") or ""),
    ]).lower()

    target_type = str(student_info.get("loai_phong") or "").strip()
    if not target_type and "dịch vụ" in raw_wish:
        target_type = "Phòng dịch vụ"

    # Ràng buộc cứng loại phòng: Nếu sinh viên chỉ định loại phòng, lọc chính xác loại phòng đó
    if target_type:
        type_matched = [r for r in eligible_rooms if str(r.get("loai_phong") or "").strip().lower() == target_type.lower()]
        if not type_matched:
            alt_type = eligible_rooms[0].get("loai_phong") or "Phòng tiêu chuẩn"
            mismatch_msg = f"⚠️ KTX hiện đã hết (hoặc chưa có) {target_type} dành cho {gender_label}. Đang hiển thị các phòng {alt_type.lower()} còn trống để Quản lý cân nhắc thỏa thuận với sinh viên."
            return {
                "best_room_id": "",
                "toa": eligible_rooms[0].get("toa") or "",
                "giuong": "",
                "match_score": 0,
                "is_room_type_mismatch": True,
                "requested_room_type": target_type,
                "available_alternative_type": alt_type,
                "ai_reason": mismatch_msg,
                "suggestion": None,
                "message": mismatch_msg,
            }
        eligible_rooms = type_matched

    wishes_toa_a1 = bool(re.search(r"tòa\s*a1\b|toa\s*a1\b|\ba1\b", raw_wish)) or "a1" in str(student_info.get("ma_toa_mong_muon") or "").lower()
    wishes_toa_a = not wishes_toa_a1 and (bool(re.search(r"tòa\s*a\b|toa\s*a\b|\ba\b", raw_wish)) or str(student_info.get("ma_toa_mong_muon") or "").lower().startswith("a"))
    wishes_toa_b = bool(re.search(r"tòa\s*b\b|toa\s*b\b|\bb\b", raw_wish)) or str(student_info.get("ma_toa_mong_muon") or "").lower().startswith("b")

    scored_rooms = []
    for room in eligible_rooms:
        score = 50
        reasons = []
        r_toa = str(room.get("toa") or "").lower()
        r_ma = str(room.get("ma_toa") or "").lower()

        if wishes_toa_a1:
            if "a1" in r_toa or "a1" in r_ma or "toa_a1" in r_ma:
                score += 40
                reasons.append(f"đúng nguyện vọng {room.get('toa')}")
            else:
                score -= 35
        elif wishes_toa_a:
            if "a" in r_toa or "a" in r_ma:
                score += 40
                reasons.append(f"đúng nguyện vọng {room.get('toa')}")
            else:
                score -= 35
        elif wishes_toa_b:
            if "b" in r_toa or "b" in r_ma:
                score += 40
                reasons.append(f"đúng nguyện vọng {room.get('toa')}")
            else:
                score -= 35

        if target_type and str(room.get("loai_phong") or "").lower() == str(target_type).lower():
            score += 20
            reasons.append(f"loại phòng {room.get('loai_phong')}")

        beds = room.get("danh_sach_giuong") or room.get("beds") or []
        avail_beds = [b for b in beds if not b.get("da_co_nguoi") and not b.get("is_occupied")]
        first_bed_code = avail_beds[0].get("ma_giuong") or avail_beds[0].get("label") if avail_beds else "G01"

        reason_text = " và ".join(reasons) if reasons else "phù hợp tiêu chuẩn còn chỗ trống"
        scored_rooms.append({
            "room": room,
            "score": max(min(score, 99), 40),
            "bed": first_bed_code,
            "reason": f"Gợi ý xếp vào {room.get('toa')} - Phòng {room.get('so_phong') or room.get('ma_phong')} vì {reason_text}.",
        })

    scored_rooms.sort(key=lambda x: x["score"], reverse=True)
    best = scored_rooms[0]
    best_room = best["room"]
    b_room_id = str(best_room.get("ma_phong") or best_room.get("so_phong") or "")
    b_toa = str(best_room.get("toa") or "")
    b_bed = str(best.get("bed") or "G01")
    return {
        "best_room_id": b_room_id,
        "toa": b_toa,
        "giuong": b_bed,
        "match_score": best.get("score") or 85,
        "is_room_type_mismatch": False,
        "ai_reason": best.get("reason"),
        "suggestion": {
            "ma_toa": b_toa,
            "ma_phong": b_room_id,
            "ma_giuong": b_bed,
        },
        "message": None,
    }


def recommend_room_with_ai(student_info: dict, candidate_rooms: list) -> dict:
    """Gợi ý xếp phòng KTX sử dụng Gemini AI với template room_allocation.txt"""
    student_gender = student_info.get("gioi_tinh") or student_info.get("gender") or ""
    norm_g = _normalize_gender(student_gender)
    gender_label = "Nữ" if norm_g == "FEMALE" else ("Nam" if norm_g == "MALE" else (student_gender or "sinh viên"))
    not_found_msg = f"Không tìm thấy phòng phù hợp: Ký túc xá hiện không có phòng dành cho giới tính {gender_label} hoặc các phòng đã hết chỗ."

    eligible_rooms = []
    for r in candidate_rooms:
        r_gender = r.get("gioi_tinh") or r.get("gender") or ""
        if not _is_gender_compatible(student_gender, r_gender):
            continue
        beds = r.get("danh_sach_giuong") or r.get("beds") or []
        has_space = any(not b.get("da_co_nguoi") and not b.get("is_occupied") for b in beds)
        if not has_space and r.get("suc_chua") is not None and r.get("thanh_vien_hien_tai") is not None:
            has_space = int(r.get("thanh_vien_hien_tai") or 0) < int(r.get("suc_chua") or 0)
        if not has_space and r.get("so_cho_trong") is not None:
            has_space = int(r.get("so_cho_trong") or 0) > 0
        if not has_space and not beds and r.get("suc_chua") is None and r.get("so_cho_trong") is None:
            has_space = True
        if has_space:
            eligible_rooms.append(r)

    if not eligible_rooms:
        return {
            "best_room_id": "",
            "toa": "",
            "giuong": "",
            "match_score": 0,
            "is_room_type_mismatch": False,
            "ai_reason": not_found_msg,
            "suggestion": None,
            "message": not_found_msg,
        }

    # Ràng buộc cứng loại phòng (Room Type Constraint)
    raw_wish = (
        str(student_info.get("nguyen_vong") or "") + " " +
        str(student_info.get("noi_dung_nguyen_vong") or "") + " " +
        str(student_info.get("nguyen_vong_label") or "") + " " +
        str(student_info.get("chi_tiet_nguyen_vong") or "")
    ).lower()
    target_type = str(student_info.get("loai_phong") or "").strip()
    if not target_type and "dịch vụ" in raw_wish:
        target_type = "Phòng dịch vụ"

    if target_type:
        type_matched = [r for r in eligible_rooms if str(r.get("loai_phong") or "").strip().lower() == target_type.lower()]
        if not type_matched:
            alt_type = eligible_rooms[0].get("loai_phong") or "Phòng tiêu chuẩn"
            mismatch_msg = f"⚠️ KTX hiện đã hết (hoặc chưa có) {target_type} dành cho {gender_label}. Đang hiển thị các phòng {alt_type.lower()} còn trống để Quản lý cân nhắc thỏa thuận với sinh viên."
            return {
                "best_room_id": "",
                "toa": eligible_rooms[0].get("toa") or "",
                "giuong": "",
                "match_score": 0,
                "is_room_type_mismatch": True,
                "requested_room_type": target_type,
                "available_alternative_type": alt_type,
                "ai_reason": mismatch_msg,
                "suggestion": None,
                "message": mismatch_msg,
            }
        eligible_rooms = type_matched

    try:
        simplified_rooms = []
        for r in eligible_rooms:
            beds = r.get("danh_sach_giuong") or r.get("beds") or []
            empty_beds = [b.get("ma_giuong") or b.get("label") for b in beds if not b.get("da_co_nguoi") and not b.get("is_occupied")]
            room_id = str(r.get("ma_phong") or r.get("so_phong") or r.get("id") or r.get("ten_phong") or "")
            room_name = str(r.get("so_phong") or r.get("ten_phong") or r.get("ma_phong") or r.get("id") or "")
            if not empty_beds:
                avail_count = int(r.get("so_cho_trong") or 1)
                empty_beds = [f"G0{i+1}" for i in range(max(1, min(avail_count, 8)))]
            simplified_rooms.append({
                "ma_phong": room_id,
                "so_phong": room_name,
                "toa": r.get("toa") or "",
                "so_tang": r.get("so_tang") or r.get("tang") or "",
                "loai_phong": r.get("loai_phong") or "",
                "suc_chua": r.get("suc_chua") or len(empty_beds),
                "thanh_vien_hien_tai": r.get("thanh_vien_hien_tai") or 0,
                "danh_sach_giuong_trong": empty_beds,
            })

        template = load_prompt_template("room_allocation.txt")
        prompt = template.format(
            ho_ten=student_info.get("ho_ten") or student_info.get("fullName") or "",
            gioi_tinh=student_gender,
            khoa=student_info.get("khoa") or student_info.get("department") or "",
            lop=student_info.get("lop") or student_info.get("className") or "",
            que_quan=student_info.get("que_quan") or student_info.get("dia_chi") or "",
            chi_tiet_nguyen_vong=(
                student_info.get("chi_tiet_nguyen_vong")
                or student_info.get("nguyen_vong")
                or student_info.get("noi_dung_nguyen_vong")
                or student_info.get("nguyen_vong_label")
                or "Không có mô tả thêm"
            ),
            ma_toa_mong_muon=student_info.get("ma_toa_mong_muon") or "Tự động phân tích từ nguyện vọng tự do",
            loai_phong=student_info.get("loai_phong") or "Phòng tiêu chuẩn",
            tang_mong_muon=student_info.get("tang_mong_muon") or "Không chỉ định",
            eligible_rooms_json=json.dumps(simplified_rooms, ensure_ascii=False, indent=2),
        )

        raw_text = _call_gemini_models(prompt, timeout=12.0)
        if raw_text:
            extracted = _extract_json_from_text(raw_text)
            if extracted and extracted.get("best_room_id"):
                b_room = str(extracted.get("best_room_id") or "")
                b_toa = str(extracted.get("toa") or "")
                b_giuong = str(extracted.get("giuong") or "")
                return {
                    "best_room_id": b_room,
                    "toa": b_toa,
                    "giuong": b_giuong,
                    "match_score": int(extracted.get("match_score") or 90),
                    "ai_reason": str(extracted.get("ai_reason") or "Phòng phù hợp với nguyện vọng của sinh viên"),
                    "suggestion": {
                        "ma_toa": b_toa,
                        "ma_phong": b_room,
                        "ma_giuong": b_giuong,
                    },
                    "message": None,
                }
    except Exception as e:
        logger.warning(f"Lỗi khi xếp phòng qua Gemini AI: {e}")

    return _heuristic_room_matching(student_info, eligible_rooms)


# ==============================================================================
# 2. LOGIC CHATBOT TƯ VẤN NỘI QUY KTX (REGULATION CHATBOT)
# ==============================================================================

def _matches_any(text: str, patterns: list[str]) -> bool:
    """Kiểm tra text có khớp bất kỳ pattern nào không (tránh substring false positive như 'hong' trong 'phong')"""
    for p in patterns:
        if r"\b" in p:
            if re.search(p, text):
                return True
        elif len(p) <= 4:
            if re.search(r"\b" + re.escape(p) + r"\b", text):
                return True
        else:
            if p in text:
                return True
    return False


def _heuristic_chatbot_reply(question: str) -> str:
    """Trả lời nội quy thông minh dựa theo tài liệu Ground Truth khi offline hoặc chưa cấu hình API key"""
    q_norm = _strip_accents(question)

    # 1. Chào hỏi
    if _matches_any(q_norm, ["chao", "xin chao", "hello", "hi bot", "alo", "ban la ai", "tro ly"]):
        return (
            "👋 **Chào bạn, tôi là Trợ lý AI Ký túc xá!**\n"
            "Tôi có thể hỗ trợ giải đáp mọi thắc mắc về Nội quy KTX như: *giờ đóng mở cổng, quy định nấu ăn, "
            "tiếp khách qua đêm, nuôi thú cưng, nộp tiền phòng/điện nước, báo hỏng thiết bị, gửi xe...*\n"
            "Bạn hãy đặt câu hỏi để tôi hỗ trợ nhé!"
        )

    # 2. Giờ giấc mở/đóng cổng
    if _matches_any(q_norm, ["mo cong", "dong cong", "gio dong", "gio mo", "may gio", "gioi nghiem", "ve muon", "ra som", "dong cua", "mo cua", "ra vao cong"]):
        return (
            "⏰ **Quy định giờ mở và đóng cổng KTX (Điều 3.1 & 3.2):**\n"
            "- **Mùa hè:** Mở cổng lúc `05:00` | Đóng cổng lúc `23:00`\n"
            "- **Mùa đông:** Mở cổng lúc `05:30` | Đóng cổng lúc `22:30`\n"
            "- Sinh viên phải có mặt tại phòng trước giờ đóng cổng hàng ngày. "
            "Trường hợp cần vào muộn hoặc ra sớm hơn quy định, bắt buộc phải báo cáo và được sự đồng ý của trực ban KTX."
        )

    # 3. Nấu ăn & PCCC
    if _matches_any(q_norm, ["nau an", "bep", "bep tu", "bep ga", "gas", "dun nau", "noi com", "nau nuong"]):
        return (
            "🍳 **Quy định về việc nấu ăn trong KTX (Điều 5.8):**\n"
            "Ký túc xá **NGHIÊM CẤM NẤU ĂN** trong phòng ở dưới mọi hình thức (kể cả bếp điện, bếp từ, bếp gas mini hay nồi cơm điện) "
            "nhằm phòng ngừa nguy cơ cháy nổ, chập điện và bảo đảm an toàn chung cho toàn bộ cư dân KTX."
        )

    # 4. Tiếp khách, bạn bè, người thân, ngủ qua đêm
    if _matches_any(q_norm, ["tiep khach", "ban be", "nguoi than", "vao phong", "qua dem", "o lai", "gio tu hoc", "gio nghi", "ngu lai"]):
        return (
            "👥 **Quy định tiếp khách & bạn bè (Điều 2.3 & 3.4 & 5.6):**\n"
            "- Khách đến liên hệ công tác, bạn bè, người thân đến thăm phải báo cáo và tuân theo hướng dẫn của trực ban KTX.\n"
            "- **Không được tiếp khách trong giờ tự học và giờ nghỉ:**\n"
            "  + Buổi sáng: từ `07:30` đến `11:00`\n"
            "  + Buổi chiều: từ `13:30` đến `17:00`\n"
            "- **Tuyệt đối không tự ý cho người lạ ở lại phòng qua đêm.** Hành vi tự ý đưa người ngoài vào ở sẽ bị xử lý kỷ luật nghiêm khắc."
        )

    # 5. Chuyển phòng, đổi phòng, trả phòng, rút hồ sơ (Ưu tiên trước mục báo hỏng/sửa chữa)
    if _matches_any(q_norm, ["chuyen phong", "doi phong", "tra phong", "rut ho so", "tra the", "roi ktx", "chuyen cho", "doi giuong"]):
        return (
            "📦 **Quy định chuyển phòng & Trả phòng (Điều 2.2, 3.14 & 5.6):**\n"
            "- Sinh viên **không được tự ý đổi phòng** hoặc hoán đổi giường cho nhau khi chưa có sự đồng ý của BQL KTX.\n"
            "- Nếu có nhu cầu chuyển phòng hoặc trả phòng, vui lòng tạo đơn tại mục **'Chuyển / Trả phòng'** trên hệ thống.\n"
            "- Trước khi rời KTX, sinh viên phải dọn dẹp vệ sinh sạch sẽ phòng ở và làm thủ tục bàn giao tài sản cho Ban Quản lý."
        )

    # 6. Báo hỏng thiết bị, điện nước, sửa chữa
    if _matches_any(q_norm, [
        "sua chua", "bi hong", "hu hong", "hong hoc", "bao hong",
        "bong den", "chay den", "bi chay", "chap dien", "ro ri nuoc",
        "vo nuoc", "sua quat", "sua den", "bao cao su co",
        r"\bsua\b", r"\bhong\b", r"\bquat\b"
    ]):
        return (
            "🔧 **Quy định sửa chữa & Báo cáo sự cố thiết bị:**\n"
            "- Sinh viên **không được tự ý sửa chữa**, cải tạo hệ thống điện nước hay di chuyển vật tư trang thiết bị (Điều 5.5).\n"
            "- Khi phát hiện bóng đèn hỏng, quạt hỏng, rò rỉ nước hay chập điện, vui lòng truy cập menu **'Báo cáo sự cố'** trên trang cá nhân để gửi yêu cầu; đội ngũ kỹ thuật sẽ đến khắc phục kịp thời."
        )

    # 7. Tiền phòng, tiền điện nước, thanh toán
    if _matches_any(q_norm, ["tien phong", "dien nuoc", "thanh toan", "nop tien", "dong tien", "hoa don", "le phi", "vietqr", "chuyen khoan", r"\bphi\b"]):
        return (
            "💳 **Quy định nộp lệ phí phòng & tiền điện nước (Điều 2.4):**\n"
            "- Sinh viên có trách nhiệm nộp tiền phòng, tiền điện, nước đầy đủ và đúng thời hạn theo thông báo của Ban Quản lý.\n"
            "- Bạn có thể kiểm tra hóa đơn và thanh toán trực tuyến nhanh chóng qua mã **VietQR** tại mục **'Hóa đơn & Thanh toán'** trên cổng thông tin KTX."
        )

    # 8. Nuôi thú cưng, động vật
    if _matches_any(q_norm, ["nuoi cho", "nuoi meo", "thu cung", "dong vat", r"\bmeo\b", r"\bcho\b", r"\bchuot\b", r"\bchim\b", r"\bpet\b"]):
        return (
            "🐾 **Quy định nuôi động vật, thú cưng (Điều 5.11):**\n"
            "Ký túc xá **NGHIÊM CẤM** việc nuôi, chăn, thả chó, mèo hay bất kỳ động vật, thú cưng nào trong phòng và khuôn viên KTX "
            "để đảm bảo vệ sinh môi trường, phòng chống dịch bệnh và tránh làm phiền người xung quanh."
        )

    # 9. Giữ gìn trật tự, tiếng ồn, hát hò
    if _matches_any(q_norm, ["on ao", "tieng on", "gay on", "karaoke", "loa keo", "nhac lon", "mat trat tu", "yen tinh", "22:00", "22h"]):
        return (
            "🔇 **Quy định trật tự, yên tĩnh (Điều 3.6):**\n"
            "- Thực hiện nếp sống văn minh: *'Đi nhẹ - Nói khẽ - Cười duyên'*, đặc biệt trong giờ tự học và giờ nghỉ.\n"
            "- Sau **22:00**, yêu cầu giữ yên tĩnh tuyệt đối cho các phòng xung quanh nghỉ ngơi và học tập; không mở nhạc to, hát hò hay tụ tập gây ồn ào."
        )

    # 10. Rượu bia, thuốc lá, chất cấm, cờ bạc
    if _matches_any(q_norm, ["ruou", "bia", "thuoc la", "chat cam", "ma tuy", "danh bac", "so de", "danh nhau", "gay go", "te nan"]):
        return (
            "🚫 **Các hành vi bị nghiêm cấm tuyệt đối (Điều 5):**\n"
            "- Nghiêm cấm uống rượu, bia, hút thuốc trong phòng ở và hành lang.\n"
            "- Nghiêm cấm đánh bạc, số đề, mại dâm, sử dụng chất gây nghiện, ma túy dưới mọi hình thức.\n"
            "- Nghiêm cấm tụ tập gây gổ, đánh nhau, kích động bè phái gây mất an ninh trật tự. Người vi phạm sẽ bị xử lý kỷ luật từ cảnh cáo đến buộc rời khỏi KTX và chuyển cơ quan chức năng."
        )

    # 11. Vệ sinh phòng ở, rác thải, xi phông cống
    if _matches_any(q_norm, ["ve sinh", "rac", "don phong", "don dep", "truc nhat", "tac cong", "xi phong", "bon cau", "thoat san"]):
        return (
            "🧹 **Quy định vệ sinh phòng ở (Điều 3.7 & 3.9):**\n"
            "- Phòng ở phải phân công lịch trực nhật đều đặn, giữ gìn phòng sạch sẽ gọn gàng và đổ rác đúng nơi quy định.\n"
            "- Tuyệt đối không đổ hóa chất, thức ăn thừa vào bồn cầu; luôn đậy nắp xi phông thoát sàn để tránh tóc và rác gây tắc nghẽn hệ thống cống."
        )

    # 12. Gửi xe & Để xe
    if _matches_any(q_norm, ["de xe", "gui xe", "nha xe", "bai xe", "xe may", "xe dap"]):
        return (
            "🛵 **Quy định gửi xe & Để xe (Điều 3.13):**\n"
            "- Để xe đúng nơi quy định tại nhà xe KTX.\n"
            "- Tuyệt đối không đưa xe vào phòng ở, không để xe trên hành lang, chân cầu thang hay lối đi xung quanh các tòa nhà."
        )

    # 13. Thể thao
    if _matches_any(q_norm, ["the thao", "da bong", "cau long", "tap the duc", "san bong", "bong chuyen", "gym"]):
        return (
            "⚽ **Quy định chơi thể thao (Điều 3.5):**\n"
            "- Bạn có thể chơi thể thao rèn luyện sức khỏe tại khu vực quy định (sân thể thao KTX).\n"
            "- Không chơi thể thao trong phòng ở, trên hành lang, ban công, lối đi hay vườn cây để đảm bảo an toàn tài sản và tránh gây ồn ào."
        )

    # 14. Ra vào KTX & Thẻ sinh viên
    if _matches_any(q_norm, ["the sinh vien", "the ktx", "xuat trinh the", "ra vao", "tam tru", "tam vang"]):
        return (
            "🪪 **Quy định ra vào & Giấy tờ (Điều 2.3 & 3.2):**\n"
            "- Người học khi ra vào KTX phải xuất trình thẻ sinh viên hoặc giấy tờ do BQL KTX cấp.\n"
            "- Phải thực hiện đầy đủ các thủ tục đăng ký tạm trú, tạm vắng theo quy định của pháp luật và hướng dẫn của BQL KTX."
        )

    # 15. Thờ cúng, bát hương, tâm linh
    if _matches_any(q_norm, ["bat huong", "tho cung", "ton giao", "tin nguong"]):
        return (
            "🕯️ **Quy định về thờ cúng & Tín ngưỡng (Điều 5.7):**\n"
            "Nghiêm cấm đặt bát hương, thờ cúng trong phòng KTX nhằm đảm bảo an toàn PCCC và môi trường tập thể. "
            "Nghiêm cấm tổ chức hoặc truyền bá các hoạt động tôn giáo, tín ngưỡng trái pháp luật."
        )

    # 16. Khen thưởng & Kỷ luật
    if _matches_any(q_norm, ["khen thuong", "ky luat", "khien trach", "canh cao", "buoc roi", r"\bduoi\b", "vi pham"]):
        return (
            "⚖️ **Khung khen thưởng & Xử lý kỷ luật (Điều 6 & 7):**\n"
            "- Sinh viên có thành tích xuất sắc và chấp hành tốt nội quy sẽ được tuyên dương khen thưởng và cộng điểm rèn luyện.\n"
            "- Các mức kỷ luật khi vi phạm: **Khiển trách** (hiệu lực 3 tháng), **Cảnh cáo** (hiệu lực 6 tháng), hoặc **Buộc rời khỏi KTX**.\n"
            "- Mọi hình thức kỷ luật đều được gửi văn bản về Khoa/Viện và gia đình sinh viên."
        )

    # 17. Mượn đồ dùng
    if _matches_any(q_norm, [r"\bmuon\b", "do dung", "ban la", "may say", "dung cu"]):
        return (
            "ℹ️ **Quy định mượn trang thiết bị KTX:**\n"
            "Hiện tại KTX không có dịch vụ cho mượn đồ dùng cá nhân (như bàn là, máy sấy, máy hút bụi). "
            "Nếu bạn cần mượn chìa khóa dự phòng hoặc các dụng cụ vệ sinh chung khi tổng vệ sinh, vui lòng liên hệ phòng trực ban KTX tại tầng 1."
        )

    # 18. Đăng ký ở KTX
    if _matches_any(q_norm, ["dang ky o", "dang ky ktx", "thu tuc vao o", "nop ho so", "nguyen vong"]):
        return (
            "📝 **Thủ tục đăng ký ở Ký túc xá (Điều 2.1):**\n"
            "- Sinh viên có nhu cầu ở KTX thực hiện đăng ký trực tuyến tại mục **'Đăng ký phòng'** trên website.\n"
            "- Sau khi hệ thống xét duyệt và xếp phòng thành công, sinh viên đến BQL KTX nhận phòng theo lịch hẹn."
        )

    return (
        "Chào bạn, tôi là Trợ lý AI Ký túc xá. Bạn có thể hỏi tôi về các quy định nội quy như:\n"
        "- Giờ mở/đóng cổng, ra vào ban đêm\n"
        "- Quy định nấu ăn, phòng cháy chữa cháy\n"
        "- Quy định tiếp khách, người lạ qua đêm\n"
        "- Quy định gửi xe, vệ sinh phòng ở, cấm nuôi thú cưng\n"
        "- Đóng tiền phòng & điện nước qua VietQR, báo hỏng thiết bị\n"
        "Nếu câu hỏi của bạn quá đặc thù, bạn vui lòng liên hệ trực tiếp Văn phòng BQL KTX tại Tầng 1 để được hướng dẫn trực tiếp nhé!"
    )


def chat_regulation_with_ai(user_message: str, conversation_history: list = None) -> dict:
    """Trả lời câu hỏi về nội quy KTX dựa trên Ground Truth và template regulation_chatbot.txt"""
    clean_msg = str(user_message or "").strip()
    if not clean_msg:
        return {"reply": "Xin chào! Bạn muốn tìm hiểu về quy định nào của Ký túc xá?", "source": "heuristic"}

    print(f"💬 [Chatbot AI] Nhận câu hỏi từ sinh viên: '{clean_msg}'")

    try:
        regulations_doc = load_prompt_template("regulations_document.txt")
        template = load_prompt_template("regulation_v3_grounded.txt")
        prompt = template.format(
            regulations_ground_truth=regulations_doc,
            user_message=clean_msg,
        )

        reply = _call_gemini_models(prompt, timeout=15.0)
        if reply and len(reply.strip()) > 5:
            print("✅ [Chatbot AI] Đã tạo phản hồi thành công từ Gemini AI API")
            # Chuẩn hóa gạch đầu dòng: Chuyển các dấu sao (*) đầu dòng thành gạch ngang (-) chuẩn theo Prompt V3
            formatted_reply = re.sub(r'(?m)^(\s*)\*(\s+)', r'\1- ', reply)
            return {"reply": formatted_reply.strip(), "source": "gemini"}
        else:
            print("⚠️ [Chatbot AI] Gemini API không trả về kết quả (hoặc key không hợp lệ/hết quota), chuyển sang Heuristic Grounded Fallback")
    except Exception as e:
        print(f"Lỗi Chatbot AI: {e}")
        logger.warning(f"Lỗi khi gọi Gemini Chatbot: {e}")

    # Fallback ngoại tuyến thông minh dựa trên văn bản Nội quy
    fallback_reply = _heuristic_chatbot_reply(clean_msg)
    return {"reply": fallback_reply, "source": "heuristic"}

