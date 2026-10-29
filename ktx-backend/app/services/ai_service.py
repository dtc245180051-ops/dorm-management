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
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

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
    return "ALL"


def _is_gender_compatible(student_gender: str, room_gender: str) -> bool:
    s_norm = _normalize_gender(student_gender)
    r_norm = _normalize_gender(room_gender)
    if r_norm == "ALL" or s_norm == "ALL":
        return True
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
    """Gọi Google Gemini API lần lượt qua các model candidates với cơ chế tối ưu kết nối"""
    try:
        api_key = settings.get_gemini_api_key(required=True)
    except ValueError as e:
        logger.warning(f"Không có GEMINI_API_KEY hợp lệ: {e}")
        return None

    headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}
    model_candidates = ["gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-3.5-flash"]

    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 450,
        },
    }

    for model_name in model_candidates:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
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
                    content = candidates[0].get("content", {})
                    parts = content.get("parts", [])
                    if parts and "text" in parts[0]:
                        return parts[0]["text"]
            else:
                logger.warning(f"Gemini API ({model_name}) HTTP {res.status_code}: {res.text[:120]}")
        except Exception as e:
            logger.warning(f"Lỗi khi gọi Gemini ({model_name}): {e}")
    return None


# ==============================================================================
# 1. LOGIC XẾP PHÒNG BẰNG AI (RECOMMEND ROOM)
# ==============================================================================

def _heuristic_room_matching(student_info: dict, eligible_rooms: list) -> dict:
    """Thuật toán xếp phòng dự phòng ngoại tuyến khi không có kết nối AI"""
    if not eligible_rooms:
        return {
            "best_room_id": "",
            "toa": "",
            "giuong": "",
            "match_score": 0,
            "ai_reason": "Hiện không còn phòng trống phù hợp với giới tính của sinh viên.",
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

        target_type = student_info.get("loai_phong") or ("Phòng dịch vụ" if "dịch vụ" in raw_wish else "Phòng tiêu chuẩn")
        if str(room.get("loai_phong") or "").lower() == str(target_type).lower():
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
    return {
        "best_room_id": best_room.get("ma_phong") or best_room.get("so_phong") or "",
        "toa": best_room.get("toa") or "",
        "giuong": best.get("bed") or "G01",
        "match_score": best.get("score") or 85,
        "ai_reason": best.get("reason"),
    }


def recommend_room_with_ai(student_info: dict, candidate_rooms: list) -> dict:
    """Gợi ý xếp phòng KTX sử dụng Gemini AI với template room_allocation.txt"""
    student_gender = student_info.get("gioi_tinh") or student_info.get("gender") or ""

    eligible_rooms = []
    for r in candidate_rooms:
        if not _is_gender_compatible(student_gender, r.get("gioi_tinh") or ""):
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
            "ai_reason": f"Hiện không còn phòng trống phù hợp với giới tính {student_gender} của sinh viên.",
        }

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
                return {
                    "best_room_id": str(extracted.get("best_room_id") or ""),
                    "toa": str(extracted.get("toa") or ""),
                    "giuong": str(extracted.get("giuong") or ""),
                    "match_score": int(extracted.get("match_score") or 90),
                    "ai_reason": str(extracted.get("ai_reason") or "Phòng phù hợp với nguyện vọng của sinh viên"),
                }
    except Exception as e:
        logger.warning(f"Lỗi khi xếp phòng qua Gemini AI: {e}")

    return _heuristic_room_matching(student_info, eligible_rooms)


# ==============================================================================
# 2. LOGIC CHATBOT TƯ VẤN NỘI QUY KTX (REGULATION CHATBOT)
# ==============================================================================

def _heuristic_chatbot_reply(question: str) -> str:
    """Trả lời nội quy thông minh dựa theo từ khóa khi offline hoặc chưa cấu hình API key"""
    q_raw = str(question or "").lower().strip()
    q_norm = (
        q_raw.replace("đ", "d")
        .replace("á", "a").replace("à", "a").replace("ả", "a").replace("ã", "a").replace("ạ", "a")
        .replace("é", "e").replace("è", "e").replace("ẻ", "e").replace("ẽ", "e").replace("ẹ", "e")
        .replace("í", "i").replace("ì", "i").replace("ỉ", "i").replace("ĩ", "i").replace("ị", "i")
        .replace("ó", "o").replace("ò", "o").replace("ỏ", "o").replace("õ", "o").replace("ọ", "o")
        .replace("ú", "u").replace("ù", "u").replace("ủ", "u").replace("ũ", "u").replace("ụ", "u")
    )

    if any(k in q_norm for k in ["the thao", "da bong", "cau long", "tap the duc", "san bong"]):
        return "⚽ **Quy định chơi thể thao:**\nBạn có thể chơi thể thao tại các khu vực được quy định (sân thể thao KTX).\nLưu ý: Không chơi thể thao trong phòng ở, hành lang, ban công, lối đi hay vườn cây để đảm bảo an toàn và tránh gây ồn ào."
    if any(k in q_norm for k in ["de xe", "gui xe", "nha xe", "bai xe", "xe may", "xe dap"]):
        return "🛵 **Quy định để xe & gửi xe:**\n- Bạn để xe đúng nơi quy định tại nhà xe / khu vực trông giữ xe của KTX.\n- Tuyệt đối không để xe trong phòng ở, trên hành lang, chân cầu thang hoặc xung quanh các tòa nhà."
    if any(k in q_norm for k in ["nuoi cho", "nuoi meo", "thu cung", "dong vat"]):
        return "🐾 **Quy định nuôi thú cưng:**\nKý túc xá không cho phép nuôi chó, mèo hay bất kỳ động vật, thú cưng nào trong phòng để giữ gìn vệ sinh và không gian chung."
    if any(k in q_norm for k in ["nau an", "bep", "bep tu", "bep ga", "gas", "dun nau"]):
        return "🍳 **Quy định nấu ăn:**\nKý túc xá nghiêm cấm nấu ăn trong phòng ở dưới mọi hình thức nhằm đảm bảo an toàn phòng cháy chữa cháy."
    if any(k in q_norm for k in ["gio", "mo cong", "dong cong", "gioi nghiem", "ve muon", "ra som"]):
        return "⏰ **Giờ mở và đóng cổng KTX:**\n- **Mùa hè:** Mở cổng lúc `05:00` | Đóng cổng lúc `23:00`\n- **Mùa đông:** Mở cổng lúc `05:30` | Đóng cổng lúc `22:30`\nBạn nhớ có mặt tại phòng trước giờ đóng cổng. Nếu cần ra sớm hoặc về muộn, hãy báo cáo trực ban KTX nhé."
    if any(k in q_norm for k in ["tiep khach", "ban be", "nguoi than", "gio tu hoc", "qua dem", "vao phong"]):
        return "👥 **Quy định tiếp khách & bạn bè đến thăm:**\n- Bạn bè hoặc người thân đến thăm cần báo cáo với trực ban KTX.\n- Không tiếp khách trong giờ tự học và giờ nghỉ (Sáng: 07:30–11:00, Chiều: 13:30–17:00).\n- Tuyệt đối không tự ý cho người lạ ở lại phòng qua đêm."
    if any(k in q_norm for k in ["ve sinh", "rac", "don phong", "truc nhat", "tac cong"]):
        return "🧹 **Quy định vệ sinh phòng ở:**\n- Giữ gìn phòng sạch sẽ, phân công lịch trực nhật phòng và đổ rác đúng nơi quy định.\n- Không đổ hóa chất vào bồn cầu; luôn đậy nắp thoát sàn để tránh tóc, rác gây tắc cống."

    return (
        "Chào bạn, tôi là Trợ lý AI Ký túc xá. Bạn có thể hỏi tôi về các quy định nội quy như: "
        "giờ đóng mở cổng, quy định nấu ăn, tiếp khách, gửi xe, vệ sinh phòng ở, hoặc nuôi thú cưng nhé!"
    )


def chat_regulation_with_ai(user_message: str, conversation_history: list = None) -> dict:
    """Trả lời câu hỏi về nội quy KTX dựa trên Ground Truth và template regulation_chatbot.txt"""
    clean_msg = str(user_message or "").strip()
    if not clean_msg:
        return {"reply": "Xin chào! Bạn muốn tìm hiểu về quy định nào của Ký túc xá?", "source": "heuristic"}

    try:
        regulations_doc = load_prompt_template("regulations_document.txt")
        template = load_prompt_template("regulation_v3_grounded.txt")
        prompt = template.format(
            regulations_ground_truth=regulations_doc,
            user_message=clean_msg,
        )

        reply = _call_gemini_models(prompt, timeout=15.0)
        if reply and len(reply.strip()) > 5:
            # Chuẩn hóa gạch đầu dòng: Chuyển các dấu sao (*) đầu dòng thành gạch ngang (-) chuẩn theo Prompt V3
            formatted_reply = re.sub(r'(?m)^(\s*)\*(\s+)', r'\1- ', reply)
            return {"reply": formatted_reply.strip(), "source": "gemini"}
    except Exception as e:
        logger.warning(f"Lỗi khi gọi Gemini Chatbot: {e}")

    # Fallback ngoại tuyến thông minh
    fallback_reply = _heuristic_chatbot_reply(clean_msg)
    return {"reply": fallback_reply, "source": "heuristic"}
