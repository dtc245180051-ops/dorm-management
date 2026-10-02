import datetime
from typing import Any, Dict, List, Optional

# In-memory store lưu trữ danh sách các phản ánh sự cố từ sinh viên
# Đảm bảo Ban quản lý KTX tiếp nhận và xử lý tức thì, đồng bộ với CSDL
INCIDENTS: List[Dict] = []


def add_incident(data: dict) -> dict:
    """Thêm một phản ánh mới từ sinh viên và đẩy lên đầu danh sách."""
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
        "ghi_chu_xu_ly": data.get("ghi_chu_xu_ly", ""),
    }

    # Đưa lên đầu danh sách
    INCIDENTS.insert(0, new_incident)
    return new_incident


def get_all_incidents() -> List[Dict]:
    """Lấy danh sách toàn bộ phản ánh cho Ban Quản lý KTX."""
    return INCIDENTS


def get_today_incidents() -> List[Dict]:
    """Lấy danh sách các phản ánh gửi trong ngày hôm nay."""
    today_str = datetime.date.today().isoformat()
    return [
        pa for pa in INCIDENTS
        if str(pa.get("ngay_gui") or pa.get("ngay_tao") or "").startswith(today_str)
    ]


def get_incidents_by_student(msv: str) -> List[Dict]:
    """Lấy phản ánh theo mã sinh viên."""
    clean_msv = msv.strip().lower()
    return [pa for pa in INCIDENTS if pa.get("msv", "").strip().lower() == clean_msv]


def get_incident_by_id(incident_id: str) -> Optional[Dict]:
    """Tìm phản ánh theo mã."""
    clean_id = incident_id.strip().lower()
    for pa in INCIDENTS:
        if pa["id"].lower() == clean_id or pa["ma_phan_anh"].lower() == clean_id:
            return pa
    return None


def update_incident_status(incident_id: str, new_status: str, ghi_chu: Optional[str] = None) -> Optional[Dict]:
    """Ban Quản lý cập nhật trạng thái xử lý phản ánh."""
    pa = get_incident_by_id(incident_id)
    if pa:
        pa["trang_thai"] = new_status
        if ghi_chu is not None:
            pa["ghi_chu_xu_ly"] = ghi_chu
        return pa
    return None
