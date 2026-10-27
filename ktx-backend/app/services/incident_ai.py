"""
Service tích hợp AI (Gemini / Heuristic) để tự động phân tích và tiếp nhận phản ánh KTX.
Trích xuất:
- tieu_de: Tóm tắt cực ngắn (< 10 từ)
- phan_loai: 1 trong các nhóm ("Điện nước", "Cơ sở vật chất", "An ninh trật tự", "Vệ sinh", "Khác")
- muc_do_uu_tien: "Thường" hoặc "Khẩn cấp"
- Tóm tắt sự cố trong ngày cho Admin.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv
import httpx

logger = logging.getLogger(__name__)

# Tự động nạp file .env từ ktx-backend hoặc ktx-frontend nếu có
load_dotenv()
_frontend_env = os.path.join(os.path.dirname(__file__), "..", "..", "..", "ktx-frontend", ".env")
if os.path.exists(_frontend_env):
    load_dotenv(_frontend_env)

# Đọc API key từ biến môi trường (hỗ trợ cả GEMINI_API_KEY và VITE_GEMINI_API_KEY)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("VITE_GEMINI_API_KEY", "")

VALID_CATEGORIES = [
    "Điện nước",
    "Cơ sở vật chất",
    "An ninh trật tự",
    "Vệ sinh",
    "Khác",
]

EMERGENCY_KEYWORDS = [
    "chập", "cháy", "nổ", "tóe lửa", "tia lửa", "khói", "khét", "bốc khói",
    "giật điện", "hở điện", "rò điện", "ngập", "tràn nước", "vỡ ống",
    "bục ống", "bể ống", "phun nước", "đánh nhau", "cướp", "trộm",
    "đột nhập", "đe dọa", "nguy hiểm", "khẩn cấp", "sập trần"
]

CATEGORY_KEYWORDS = {
    "Điện nước": [
        "điện", "nước", "bóng đèn", "đèn", "ổ cắm", "công tắc", "vòi", "vòi sen",
        "bồn cầu", "lavabo", "rò rỉ", "chập", "mất nước", "mất điện", "bình nóng lạnh",
        "bình nước nóng", "quạt trần", "quạt", "máy bơm", "thoát nước", "cống",
        "áp lực nước", "ngập", "tắc cống", "tắc bồn", "rò rỉ nước", "cháy bóng"
    ],
    "Cơ sở vật chất": [
        "giường", "bàn", "ghế", "cửa", "khóa", "tủ", "cửa sổ", "kính", "tường",
        "trần nhà", "sơn", "bong tróc", "rèm", "tay nắm", "bản lề", "gạch",
        "nền nhà", "thang", "lan can", "tủ quần áo", "bàn học", "giường tầng"
    ],
    "An ninh trật tự": [
        "trộm", "mất cắp", "cãi vã", "đánh nhau", "ồn ào", "gây rối", "người lạ",
        "đột nhập", "an ninh", "mất đồ", "mất xe", "nhậu nhẹt", "hút thuốc",
        "bắt nạt", "mất ví", "mất điện thoại"
    ],
    "Vệ sinh": [
        "rác", "bẩn", "mùi hôi", "hôi thối", "gián", "chuột", "côn trùng",
        "mốc", "ẩm mốc", "nghẹt rác", "vệ sinh", "quét dọn", "nước thải",
        "bụi bặm", "ô nhiễm", "ruồi muỗi"
    ],
}


def _extract_json_from_text(raw_text: str) -> Dict[str, Any]:
    """Làm sạch markdown code block (```json) và parse chuỗi JSON từ phản hồi LLM."""
    clean_text = raw_text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean_text, re.IGNORECASE)
    if match:
        clean_text = match.group(1).strip()
    else:
        start_idx = clean_text.find("{")
        end_idx = clean_text.rfind("}")
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            clean_text = clean_text[start_idx : end_idx + 1].strip()

    return json.loads(clean_text)


def _heuristic_analyze(
    mo_ta: str,
    phong: Optional[str] = "",
    error_reason: Optional[str] = None,
) -> Dict[str, Any]:
    """Phân tích thông minh bằng luật tự nhiên khi API ngoài gián đoạn."""
    clean_text = (mo_ta or "").strip()
    lower_text = clean_text.lower()

    # 1. Xác định mức độ ưu tiên
    is_urgent = any(kw in lower_text for kw in EMERGENCY_KEYWORDS)
    muc_do_uu_tien = "Khẩn cấp" if is_urgent else "Thường"

    # 2. Xác định phân loại
    best_cat = "Cơ sở vật chất"
    max_matches = 0
    for cat, kws in CATEGORY_KEYWORDS.items():
        matches = sum(1 for kw in kws if kw in lower_text)
        if matches > max_matches:
            max_matches = matches
            best_cat = cat

    if max_matches == 0:
        best_cat = "Khác"

    # 3. Trích xuất tiêu đề ngắn gọn (< 10 từ)
    first_sentence = re.split(r"[.\n!?]", clean_text)[0].strip() if clean_text else ""
    if not first_sentence:
        first_sentence = clean_text or f"Sự cố {best_cat.lower()}"

    remove_patterns = [
        r"^(dạ\s+)?(thưa\s+)?(thầy\s+cô|ban\s+quản\s+lý|bql|anh\s+chị)\s*[,:]?\s*",
        r"^(em\s+muốn\s+phản\s+ánh|em\s+muốn\s+báo|em\s+báo\s+hỏng|em\s+xin\s+báo|em\s+báo)\s*[,:]?\s*",
        r"^(phòng\s+em\s+bị|phòng\s+em\s+hiện\s+tại|phòng\s+em)\s*",
        r"^(hiện\s+tại|hôm\s+nay)\s*[,:]?\s*",
    ]
    trimmed_sentence = first_sentence
    for pat in remove_patterns:
        trimmed_sentence = re.sub(pat, "", trimmed_sentence, flags=re.IGNORECASE).strip()

    words = trimmed_sentence.split()
    if len(words) > 8:
        title = " ".join(words[:8])
    else:
        title = " ".join(words)

    if title:
        title = title[0].upper() + title[1:]
    else:
        title = f"Sự cố {best_cat.lower()}"

    return {
        "tieu_de": title,
        "phan_loai": best_cat,
        "muc_do_uu_tien": muc_do_uu_tien,
        "is_ai_processed": False,
        "ai_error_reason": error_reason,
    }


def analyze_incident_with_ai(mo_ta: str, phong: Optional[str] = "") -> Dict[str, Any]:
    """
    Phân tích mô tả sự cố sinh viên gửi bằng AI (Gemini Flash) hoặc Fallback Heuristic:
    - tieu_de: Tóm tắt cực ngắn (< 10 từ)
    - phan_loai: "Điện nước" | "Cơ sở vật chất" | "An ninh trật tự" | "Vệ sinh" | "Khác"
    - muc_do_uu_tien: "Thường" | "Khẩn cấp"
    - is_ai_processed: bool (True nếu AI xử lý thành công, False nếu dùng fallback do lỗi)
    - ai_error_reason: Optional[str] (Ghi nhận tóm tắt lỗi nếu AI thất bại)
    """
    clean_mo_ta = (mo_ta or "").strip()
    if not clean_mo_ta:
        return _heuristic_analyze(
            clean_mo_ta,
            phong,
            error_reason="Mô tả sự cố rỗng, không thể gửi tới mô hình AI.",
        )

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VITE_GEMINI_API_KEY") or GEMINI_API_KEY
    if not api_key:
        error_msg = "Chưa cấu hình GEMINI_API_KEY trong tệp môi trường."
        logger.warning(f"analyze_incident_with_ai fallback: {error_msg}")
        return _heuristic_analyze(clean_mo_ta, phong, error_reason=error_msg)

    prompt = (
        f"Bạn là chuyên gia tiếp nhận sự cố ký túc xá. Đọc kỹ mô tả sự cố sau của sinh viên:\n"
        f"Phòng: {phong or 'Không xác định'}\n"
        f"Mô tả: {clean_mo_ta}\n\n"
        f"Hãy trích xuất thông tin JSON chuẩn:\n"
        f"{{\n"
        f'  "tieu_de": "Tóm tắt cực ngắn gọn dưới 10 từ (VD: Bóng đèn hành lang bị cháy, Rò rỉ nước nhà vệ sinh)",\n'
        f'  "phan_loai": "Chỉ chọn 1 trong: [\'Điện nước\', \'Cơ sở vật chất\', \'An ninh trật tự\', \'Vệ sinh\', \'Khác\']",\n'
        f'  "muc_do_uu_tien": "Chỉ chọn \'Khẩn cấp\' (nếu có chập điện, cháy nổ, ngập nước, bục ống nước, đánh nhau, nguy hiểm) hoặc \'Thường\'"\n'
        f"}}\n"
        f"Chỉ trả về chuỗi JSON thuần, không giải thích gì thêm."
    )

    headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}
    model_candidates = ["gemini-3.5-flash-lite", "gemini-2.5-flash", "gemini-1.5-flash"]
    last_error_reason: Optional[str] = None
    res = None

    for model_name in model_candidates:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        try:
            res = httpx.post(
                url,
                headers=headers,
                json={"contents": [{"parts": [{"text": prompt}]}]},
                timeout=7.0,
            )
            if res.status_code == 200:
                break
            else:
                last_error_reason = f"Google API Error [{res.status_code}] ({model_name}): {res.text[:120]}"
                logger.error(
                    f"Gemini API returned error status {res.status_code} for model {model_name}. Response: {res.text}"
                )
        except httpx.TimeoutException as te:
            last_error_reason = f"Timeout khi gọi Gemini API ({model_name}): {str(te)}"
            logger.error(f"TimeoutException calling Gemini API ({model_name})", exc_info=True)
        except httpx.RequestError as re_err:
            last_error_reason = f"Lỗi mạng khi kết nối Gemini API ({model_name}): {str(re_err)}"
            logger.error(f"RequestError calling Gemini API ({model_name})", exc_info=True)
        except Exception as e:
            last_error_reason = f"Ngoại lệ khi gọi Gemini API ({model_name}): {str(e)}"
            logger.error(f"Exception calling Gemini API ({model_name})", exc_info=True)

    if res is not None and res.status_code == 200:
        raw_text = ""
        try:
            response_json = res.json()
            candidates = response_json.get("candidates", [])
            if not candidates:
                raise ValueError("API trả về 200 nhưng không có candidates")

            content = candidates[0].get("content", {})
            parts = content.get("parts", [])
            if not parts or "text" not in parts[0]:
                raise ValueError("Không tìm thấy nội dung text trong parts của AI")

            raw_text = parts[0]["text"]
            data = _extract_json_from_text(raw_text)

            tieu_de = str(data.get("tieu_de", "")).strip()
            t_words = tieu_de.split()
            if len(t_words) > 9:
                tieu_de = " ".join(t_words[:9])

            phan_loai = str(data.get("phan_loai", "Cơ sở vật chất")).strip()
            if phan_loai not in VALID_CATEGORIES:
                matched = next((c for c in VALID_CATEGORIES if c.lower() in phan_loai.lower()), "Khác")
                phan_loai = matched

            muc_do = str(data.get("muc_do_uu_tien", "Thường")).strip()
            if muc_do not in ["Thường", "Khẩn cấp"]:
                muc_do = "Khẩn cấp" if "khẩn" in muc_do.lower() else "Thường"

            if tieu_de:
                return {
                    "tieu_de": tieu_de,
                    "phan_loai": phan_loai,
                    "muc_do_uu_tien": muc_do,
                    "is_ai_processed": True,
                    "ai_error_reason": None,
                }
            else:
                last_error_reason = "AI trả về JSON nhưng trường 'tieu_de' bị rỗng"
                logger.error("Parsed AI JSON but tieu_de is empty")
        except json.JSONDecodeError as jde:
            last_error_reason = f"Lỗi cú pháp JSON (JSONDecodeError): {str(jde)}"
            logger.error(f"JSONDecodeError parsing AI response: {raw_text}", exc_info=True)
        except Exception as parse_err:
            last_error_reason = f"Lỗi bóc tách kết quả AI: {str(parse_err)}"
            logger.error("Exception parsing AI candidate text", exc_info=True)

    final_error = last_error_reason or "Không nhận được phản hồi hợp lệ từ mô hình AI"
    logger.warning(
        f"AI Incident classification failed, switching to fallback heuristic. Reason: {final_error}"
    )
    return _heuristic_analyze(clean_mo_ta, phong, error_reason=final_error)


def _fallback_rule_based_summary(incidents_today: List[Dict[str, Any]]) -> str:
    """
    Phương án dự phòng (Rule-based Fallback) khi mô hình AI gặp lỗi, mất mạng hoặc hết hạn mức.
    Tự động cập nhật giảm bớt đầu việc khi có sự cố đã được xử lý.
    """
    if not incidents_today or len(incidents_today) == 0:
        return "Chưa ghi nhận phản ánh cần ưu tiên xử lý trong hôm nay."

    total_count = len(incidents_today)
    resolved_incidents = [
        inc for inc in incidents_today
        if str(inc.get("trang_thai") or "").upper() in ("DA_XU_LY", "HOAN_THANH", "DA_GIAI_QUYET")
    ]
    pending_incidents = [
        inc for inc in incidents_today
        if str(inc.get("trang_thai") or "").upper() not in ("DA_XU_LY", "HOAN_THANH", "DA_GIAI_QUYET", "TU_CHOI")
    ]

    resolved_count = len(resolved_incidents)
    pending_count = len(pending_incidents)

    # Nếu tất cả đã được giải quyết
    if total_count > 0 and pending_count == 0:
        return f"Toàn bộ {total_count} sự cố phát sinh hôm nay đã được xử lý dứt điểm, hiện không còn đầu việc tồn đọng."

    # Đếm theo danh mục các việc CÒN LẠI
    cat_counts: Dict[str, int] = {}
    rooms: List[str] = []
    urgent_incidents: List[str] = []

    for inc in pending_incidents:
        cat = inc.get("loai_phan_anh") or inc.get("phan_loai") or "Cơ sở vật chất"
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

        p = inc.get("phong")
        if p and p not in rooms:
            rooms.append(p)

        priority = inc.get("muc_do_uu_tien")
        if priority == "Khẩn cấp" or any(kw in (inc.get("mo_ta", "")).lower() for kw in EMERGENCY_KEYWORDS[:8]):
            room_label = f"Phòng {p}" if p else "Khu KTX"
            tieu_de = inc.get("tieu_de") or inc.get("mo_ta", "")[:30]
            urgent_incidents.append(f"{room_label} ({tieu_de})")

    sorted_cats = sorted(cat_counts.items(), key=lambda x: x[1], reverse=True)
    top_cat_names = [c[0] for c in sorted_cats[:2]]
    cat_str = " / ".join(top_cat_names) if top_cat_names else "Cơ sở vật chất"

    room_str = ", ".join(rooms[:3]) if rooms else "các phòng lưu trú"

    status_str = f"Hôm nay có {total_count} sự cố (đã xử lý {resolved_count})." if resolved_count > 0 else f"Hôm nay ghi nhận {total_count} sự cố."
    summary_parts = [
        f"{status_str} Hiện còn {pending_count} việc cần giải quyết về {cat_str} tại {room_str}."
    ]

    if urgent_incidents:
        summary_parts.append(f"Cần ưu tiên xử lý: {'; '.join(urgent_incidents[:2])}.")

    return " ".join(summary_parts)


def generate_daily_incident_summary(incidents_today: List[Dict[str, Any]]) -> str:
    """
    Tạo tóm tắt thông minh bằng mô hình AI Gemini Flash về toàn bộ sự cố phát sinh trong ngày:
    - Tự động nhận diện các sự cố đã giải quyết để giảm bớt đầu việc tồn đọng.
    - Nếu xử lý hết: Báo cáo đã hoàn tất toàn bộ sự cố trong ngày.
    - Fallback về _fallback_rule_based_summary khi gặp bất kỳ sự cố mạng hoặc lỗi API.
    """
    if not incidents_today or len(incidents_today) == 0:
        return "Chưa ghi nhận phản ánh cần ưu tiên xử lý trong hôm nay."

    total_count = len(incidents_today)
    resolved_incidents = [
        inc for inc in incidents_today
        if str(inc.get("trang_thai") or "").upper() in ("DA_XU_LY", "HOAN_THANH", "DA_GIAI_QUYET")
    ]
    pending_incidents = [
        inc for inc in incidents_today
        if str(inc.get("trang_thai") or "").upper() not in ("DA_XU_LY", "HOAN_THANH", "DA_GIAI_QUYET", "TU_CHOI")
    ]

    resolved_count = len(resolved_incidents)
    pending_count = len(pending_incidents)

    # Nếu tất cả đã được giải quyết
    if total_count > 0 and pending_count == 0:
        return f"Toàn bộ {total_count} sự cố phát sinh hôm nay đã được xử lý dứt điểm, hiện không còn đầu việc tồn đọng."

    # Lấy API key từ biến môi trường (hỗ trợ cả GEMINI_API_KEY và VITE_GEMINI_API_KEY)
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("VITE_GEMINI_API_KEY") or GEMINI_API_KEY
    if not api_key:
        logger.warning("GEMINI_API_KEY chưa được cấu hình, chuyển sang fallback rule-based.")
        return _fallback_rule_based_summary(incidents_today)

    try:
        # 1. Nối danh sách các phản ánh CÒN LẠI CẦN LÀM thành chuỗi văn bản cho AI
        pending_lines = []
        for idx, inc in enumerate(pending_incidents, 1):
            phong = inc.get("phong") or "Chưa rõ phòng"
            loai = inc.get("phan_loai") or inc.get("loai_phan_anh") or "Chung"
            tieu_de = inc.get("tieu_de") or "Không có tiêu đề"
            mo_ta = inc.get("mo_ta") or inc.get("noi_dung") or ""
            pending_lines.append(
                f"{idx}. Phòng: {phong} | Vấn đề: {loai} - {tieu_de} | Chi tiết: {mo_ta}"
            )

        pending_context = "\n".join(pending_lines)

        # 2. Xây dựng Prompt tóm tắt tiến độ công việc trong ngày
        prompt = (
            "Bạn là trợ lý AI quản lý Ký túc xá. Dưới đây là thống kê tiến độ sự cố hôm nay:\n"
            f"- Tổng số sự cố phát sinh: {total_count}\n"
            f"- Đã xử lý hoàn tất: {resolved_count}\n"
            f"- Còn lại đang chờ giải quyết: {pending_count}\n\n"
            f"Danh sách các sự cố CÒN LẠI cần làm:\n{pending_context}\n\n"
            "Nhiệm vụ: Viết DUY NHẤT 1 đến 2 câu tóm tắt cực kỳ ngắn gọn, trực diện:\n"
            f"- Nêu rõ: Hôm nay có {total_count} sự cố" + (f" (đã xử lý {resolved_count})" if resolved_count > 0 else "") + f", hiện còn {pending_count} việc cần giải quyết về vấn đề gì tại phòng nào.\n"
            "- Nếu có sự cố khẩn cấp (như chập cháy, ngập nước, an ninh), chỉ đích danh phòng và lỗi cần ưu tiên xử lý.\n"
            "- Tuyệt đối không dài dòng, không chào hỏi, không thêm văn phong hành chính chung chung. Trả về đúng 1-2 câu văn bản thuần."
        )

        # 3. Gửi request đến Gemini API với header xác thực và hỗ trợ các phiên bản model mới
        headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}
        model_candidates = ["gemini-3.5-flash-lite", "gemini-2.5-flash", "gemini-1.5-flash"]
        res = None

        for model_name in model_candidates:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            try:
                res = httpx.post(
                    url,
                    headers=headers,
                    json={"contents": [{"parts": [{"text": prompt}]}]},
                    timeout=15.0,
                )
                if res.status_code == 200:
                    payload = res.json()
                    candidates = payload.get("candidates", [])
                    if candidates:
                        content = candidates[0].get("content", {})
                        parts = content.get("parts", [])
                        if parts and "text" in parts[0]:
                            summary_text = parts[0]["text"].strip()
                            if summary_text:
                                return summary_text
            except Exception as req_err:
                logger.warning(f"Thử model {model_name} thất bại: {req_err}")
                continue

        if res is not None:
            logger.error(f"Gemini API returned status {res.status_code}: {res.text}")
            print(f"Gemini API returned status {res.status_code}, chuyển sang fallback rule-based.")
    except Exception as e:
        logger.error(f"Lỗi khi gọi Gemini API để tóm tắt sự cố: {e}")
        print(f"Lỗi khi gọi Gemini API để tóm tắt sự cố: {e}, chuyển sang fallback rule-based.")

    # 4. Fallback khi có lỗi
    return _fallback_rule_based_summary(incidents_today)
