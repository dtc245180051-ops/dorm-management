import datetime
from typing import Dict, List, Optional

# In-memory store lưu trữ danh sách các phản ánh sự cố từ sinh viên
# Đảm bảo Ban quản lý KTX tiếp nhận và xử lý tức thì, đồng bộ với CSDL
INCIDENTS: List[Dict] = [
    {
        "id": "PA-001",
        "ma_phan_anh": "PA-001",
        "msv": "DTC245180051",
        "ho_ten": "Nguyễn Văn A",
        "phong": "P36",
        "loai_phan_anh": "Cơ sở vật chất",
        "tieu_de": "Bóng đèn hành lang tầng 2 bị hỏng",
        "mo_ta": "Bóng đèn trước cửa phòng 204 bị chớp tắt liên tục và đã cháy tối qua, mong ban quản lý cử kỹ thuật thay thế sớm.",
        "hinh_anh": None,
        "ngay_gui": "2026-09-26T14:30:00",
        "trang_thai": "DANG_XU_LY",
        "ghi_chu_xu_ly": "Đã giao tổ kỹ thuật điện kiểm tra và chuẩn bị bóng thay thế.",
    },
    {
        "id": "PA-002",
        "ma_phan_anh": "PA-002",
        "msv": "DTC2151001",
        "ho_ten": "Trần Thị Mai",
        "phong": "P102",
        "loai_phan_anh": "Điện nước",
        "tieu_de": "Vòi nước bồn rửa mặt bị rỉ nước",
        "mo_ta": "Vòi rửa mặt trong nhà vệ sinh phòng 102 bị rỉ nước liên tục gây lãng phí nước và ẩm ướt sàn.",
        "hinh_anh": None,
        "ngay_gui": "2026-09-25T09:15:00",
        "trang_thai": "DA_XU_LY",
        "ghi_chu_xu_ly": "Đã thay gioăng cao su và van khóa mới sáng 26/09.",
    },
]


def add_incident(data: dict) -> dict:
    """Thêm một phản ánh mới từ sinh viên và đẩy lên đầu danh sách."""
    incident_id = data.get("id") or data.get("ma_phan_anh") or f"PA-{len(INCIDENTS) + 1:03d}"
    new_incident = {
        "id": incident_id,
        "ma_phan_anh": incident_id,
        "msv": data.get("msv", "DTC245180051"),
        "ho_ten": data.get("ho_ten", "Sinh viên"),
        "phong": data.get("phong", "P36"),
        "loai_phan_anh": data.get("loai_phan_anh", "Cơ sở vật chất"),
        "tieu_de": data.get("tieu_de", ""),
        "mo_ta": data.get("mo_ta", ""),
        "hinh_anh": data.get("hinh_anh"),
        "ngay_gui": datetime.datetime.now().isoformat(),
        "trang_thai": data.get("trang_thai", "CHO_XU_LY"),
        "ghi_chu_xu_ly": data.get("ghi_chu_xu_ly", ""),
    }

    INCIDENTS.insert(0, new_incident)
    return new_incident


def get_all_incidents() -> List[Dict]:
    """Lấy danh sách toàn bộ phản ánh cho Ban Quản lý KTX."""
    return INCIDENTS


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
