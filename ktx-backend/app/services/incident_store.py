import datetime
import json
import os
from typing import Any, Dict, List, Optional

STORE_FILE = os.path.join(os.path.dirname(__file__), "..", "data_store_incidents.json")

# In-memory store lưu trữ danh sách các phản ánh sự cố từ sinh viên
# Kết hợp đồng bộ file JSON persistent để không bị mất dữ liệu khi restart server
INCIDENTS: List[Dict] = []


def _save_store():
    """Lưu danh sách phản ánh ra file JSON để đảm bảo dữ liệu không bị mất."""
    try:
        with open(STORE_FILE, "w", encoding="utf-8") as f:
            json.dump(INCIDENTS, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("Lỗi lưu trữ file data_store_incidents.json:", e)


def _load_store():
    """Tải danh sách phản ánh từ file JSON khi khởi động hoặc phục hồi."""
    global INCIDENTS
    if os.path.exists(STORE_FILE):
        try:
            with open(STORE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    INCIDENTS = data
        except Exception as e:
            print("Lỗi đọc file data_store_incidents.json:", e)


# Tự động nạp dữ liệu khi import module
_load_store()


def add_incident(data: dict) -> dict:
    """Thêm một phản ánh mới từ sinh viên, lưu persistent và đẩy lên đầu danh sách."""
    incident_id = data.get("id") or data.get("ma_phan_anh") or f"PA-{len(INCIDENTS) + 1:03d}"
    phan_loai = data.get("phan_loai") or data.get("loai_phan_anh") or "Cơ sở vật chất"
    now_iso = datetime.datetime.now().isoformat()

    new_incident = {
        "id": incident_id,
        "ma_phan_anh": incident_id,
        "msv": data.get("msv", ""),
        "ho_ten": data.get("ho_ten", "Sinh viên"),
        "phong": data.get("phong", ""),
        "loai_phan_anh": phan_loai,
        "phan_loai": phan_loai,
        "tieu_de": data.get("tieu_de", ""),
        "mo_ta": data.get("mo_ta", ""),
        "hinh_anh": data.get("hinh_anh"),
        "muc_do_uu_tien": data.get("muc_do_uu_tien", "Thường"),
        "ngay_gui": data.get("ngay_gui") or now_iso,
        "ngay_tao": data.get("ngay_tao") or now_iso,
        "trang_thai": data.get("trang_thai", "CHO_XU_LY"),
        "trang_thai_label": data.get("trang_thai_label", "Chờ xử lý"),
        "ghi_chu_xu_ly": data.get("ghi_chu_xu_ly", ""),
        "is_ai_processed": bool(data.get("is_ai_processed", False)),
        "ai_error_reason": data.get("ai_error_reason"),
    }

    # Đưa lên đầu danh sách
    INCIDENTS.insert(0, new_incident)
    _save_store()
    return new_incident


def get_all_incidents() -> List[Dict]:
    """Lấy danh sách toàn bộ phản ánh cho Ban Quản lý KTX."""
    _load_store()
    return INCIDENTS


def get_today_incidents() -> List[Dict]:
    """Lấy danh sách các phản ánh gửi trong ngày hôm nay."""
    _load_store()
    today_str = datetime.date.today().isoformat()
    return [
        pa for pa in INCIDENTS
        if str(pa.get("ngay_gui") or pa.get("ngay_tao") or "").startswith(today_str)
    ]


def get_incidents_by_student(msv: str) -> List[Dict]:
    """Lấy phản ánh theo mã sinh viên (hỗ trợ không phân biệt hoa thường)."""
    if not INCIDENTS:
        _load_store()
    clean_msv = (msv or "").strip().lower()
    return [pa for pa in INCIDENTS if pa.get("msv", "").strip().lower() == clean_msv]


def get_incident_by_id(incident_id: str) -> Optional[Dict]:
    """Tìm phản ánh theo mã."""
    if not INCIDENTS:
        _load_store()
    clean_id = incident_id.strip().lower()
    for pa in INCIDENTS:
        if pa["id"].lower() == clean_id or pa["ma_phan_anh"].lower() == clean_id:
            return pa
    return None


def update_incident_status(incident_id: str, new_status: str, ghi_chu: Optional[str] = None) -> Optional[Dict]:
    """Ban Quản lý cập nhật trạng thái xử lý phản ánh và lưu persistent."""
    pa = get_incident_by_id(incident_id)
    if pa:
        pa["trang_thai"] = new_status
        status_map = {
            "CHO_XU_LY": "Chờ xử lý",
            "DANG_XU_LY": "Đang xử lý",
            "DA_XU_LY": "Đã xử lý",
            "TU_CHOI": "Từ chối",
        }
        pa["trang_thai_label"] = status_map.get(new_status, new_status)
        if ghi_chu is not None:
            pa["ghi_chu_xu_ly"] = ghi_chu
        _save_store()
        return pa
    return None
