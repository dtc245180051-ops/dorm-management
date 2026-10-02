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
import os
import re
from typing import Any, Dict, List, Optional
import httpx

# API key fallback
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AQ.Ab8RN6LYf5Hy7yVJL90GFzMECCHzbND4WcrJUEt5et-OMZHQjQ")

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


def _heuristic_analyze(mo_ta: str, phong: Optional[str] = "") -> Dict[str, str]:
    """Phân tích thông minh bằng luật tự nhiên khi API ngoài gián đoạn."""
    clean_text = mo_ta.strip()
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
    # Lấy câu đầu tiên
    first_sentence = re.split(r"[.\n!?]", clean_text)[0].strip()
    if not first_sentence:
        first_sentence = clean_text

    # Loại bỏ các từ thừa mở đầu
    remove_patterns = [
        r"^(dạ\s+)?(thưa\s+)?(thầy\s+cô|ban\s+quản\s+lý|bql|anh\s+chị)\s*[,:]?\s*",
        r"^(em\s+muốn\s+phản\s+ánh|em\s+muốn\s+báo|em\s+báo\s+hỏng|em\s+xin\s+báo|em\s+báo)\s*[,:]?\s*",
        r"^(phòng\s+em\s+bị|phòng\s+em\s+hiện\s+tại|phòng\s+em)\s*",
        r"^(hiện\s+tại|hôm\s+nay)\s*[,:]?\s*",
    ]
    trimmed_sentence = first_sentence
    for pat in remove_patterns:
        trimmed_sentence = re.sub(pat, "", trimmed_sentence, flags=re.IGNORECASE).strip()

    # Cắt tối đa 9 từ
    words = trimmed_sentence.split()
    if len(words) > 8:
        title = " ".join(words[:8])
    else:
        title = " ".join(words)

    # Viết hoa chữ cái đầu tiên
    if title:
        title = title[0].upper() + title[1:]
    else:
        title = f"Sự cố {best_cat.lower()}"

    return {
        "tieu_de": title,
        "phan_loai": best_cat,
        "muc_do_uu_tien": muc_do_uu_tien,
    }


def analyze_incident_with_ai(mo_ta: str, phong: Optional[str] = "") -> Dict[str, str]:
    """
    Phân tích mô tả sự cố sinh viên gửi bằng AI (Gemini Flash) hoặc Fallback Heuristic:
    - tieu_de: Tóm tắt cực ngắn (< 10 từ)
    - phan_loai: "Điện nước" | "Cơ sở vật chất" | "An ninh trật tự" | "Vệ sinh" | "Khác"
    - muc_do_uu_tien: "Thường" | "Khẩn cấp"
    """
    if not mo_ta or not mo_ta.strip():
        return {
            "tieu_de": "Phản ánh chưa có mô tả",
            "phan_loai": "Khác",
            "muc_do_uu_tien": "Thường",
        }

    # Thử gọi Gemini API nếu có key (timeout nhanh 2.5s để sinh viên không phải chờ)
    if GEMINI_API_KEY:
        try:
            prompt = (
                f"Bạn là chuyên gia tiếp nhận sự cố ký túc xá. Đọc kỹ mô tả sự cố sau của sinh viên:\n"
                f"Phòng: {phong or 'Không xác định'}\n"
                f"Mô tả: {mo_ta}\n\n"
                f"Hãy trích xuất thông tin JSON chuẩn:\n"
                f"{{\n"
                f'  "tieu_de": "Tóm tắt cực ngắn gọn dưới 10 từ (VD: Bóng đèn hành lang bị cháy, Rò rỉ nước nhà vệ sinh)",\n'
                f'  "phan_loai": "Chỉ chọn 1 trong: [\'Điện nước\', \'Cơ sở vật chất\', \'An ninh trật tự\', \'Vệ sinh\', \'Khác\']",\n'
                f'  "muc_do_uu_tien": "Chỉ chọn \'Khẩn cấp\' (nếu có chập điện, cháy nổ, ngập nước, bục ống nước, đánh nhau, nguy hiểm) hoặc \'Thường\'"\n'
                f"}}\n"
                f"Chỉ trả về chuỗi JSON thuần, không giải thích gì thêm."
            )

            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
            res = httpx.post(
                url,
                json={"contents": [{"parts": [{"text": prompt}]}]},
                timeout=2.5,
            )
            if res.status_code == 200:
                raw_text = res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                clean_json = raw_text
                if "```" in clean_json:
                    clean_json = re.sub(r"```(json)?", "", clean_json).strip()
                data = json.loads(clean_json)

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
                    }
        except Exception as e:
            # Fallback ngầm mượt mà
            pass

    # Fallback phân tích Heuristic chính xác
    return _heuristic_analyze(mo_ta, phong)


def generate_daily_incident_summary(incidents_today: List[Dict[str, Any]]) -> str:
    """
    Tạo tóm tắt thông minh của AI về toàn bộ sự cố phát sinh trong ngày:
    - Nếu không có: "Chưa ghi nhận phản ánh cần ưu tiên xử lý trong hôm nay."
    - Nếu có: "Hôm nay ghi nhận X sự cố, chủ yếu về [Điện nước/Cơ sở vật chất] tại các phòng... Cần ưu tiên xử lý: [Sự cố khẩn cấp nếu có]"
    """
    if not incidents_today or len(incidents_today) == 0:
        return "Chưa ghi nhận phản ánh cần ưu tiên xử lý trong hôm nay."

    count = len(incidents_today)

    # Đếm theo danh mục
    cat_counts: Dict[str, int] = {}
    rooms: List[str] = []
    urgent_incidents: List[str] = []

    for inc in incidents_today:
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

    # Sắp xếp danh mục nhiều nhất
    sorted_cats = sorted(cat_counts.items(), key=lambda x: x[1], reverse=True)
    top_cat_names = [c[0] for c in sorted_cats[:2]]
    cat_str = " / ".join(top_cat_names) if top_cat_names else "Cơ sở vật chất"

    room_str = ", ".join(rooms[:4]) if rooms else "các phòng lưu trú"
    if len(rooms) > 4:
        room_str += f" và {len(rooms) - 4} phòng khác"

    summary_parts = [
        f"Hôm nay ghi nhận {count} sự cố, chủ yếu về {cat_str} tại {room_str}."
    ]

    if urgent_incidents:
        urgent_str = "; ".join(urgent_incidents[:2])
        summary_parts.append(f"Cần ưu tiên xử lý: {urgent_str}.")
    else:
        summary_parts.append("Các sự cố ở mức độ thường, kỹ thuật đang được phân công xử lý theo lịch trình.")

    return " ".join(summary_parts)
