import datetime
from typing import Dict, List, Optional

# In-memory store lưu trữ danh sách các đơn đăng ký chỗ ở để liên kết trực tiếp
# giữa sinh viên và quản lý KTX
REGISTRATION_REQUESTS: List[Dict] = [
    {
        "id": "DK-001",
        "msv": "B21DCCN001",
        "ho_ten": "Nguyễn Văn A",
        "gioi_tinh": "Nam",
        "ngay_sinh": "2003-05-15",
        "cccd": "001203004567",
        "so_dien_thoai": "0987654321",
        "email": "nguyenvana@ictu.edu.vn",
        "khoa": "Công nghệ thông tin",
        "lop": "D21CQCN01-B",
        "dia_chi": "Số 123 Đường Cầu Giấy, Hà Nội",
        "doi_tuong_uu_tien": "Không thuộc diện ưu tiên",
        "nguoi_giam_ho": "Nguyễn Văn B",
        "moi_quan_he": "Bố",
        "sdt_nguoi_giam_ho": "0912345678",
        "nguyen_vong": "Xin hãy xếp cho em 1 phòng nào đó ở tòa A với ạ 🥹",
        "nguyen_vong_phong": "P36",
        "nguyen_vong_label": "P36 - Tầng 3 - Tòa A2",
        "ngay_gui": "2026-09-26T15:00:00",
        "trang_thai": "CHO_DUYET",
        "goi_y": {
            "ma_toa": "A",
            "ma_phong": "A203",
            "ma_giuong": "G04",
        },
    }
]


def add_request(req_data: dict) -> dict:
    """Thêm một đơn đăng ký mới vào hệ thống quản lý."""
    new_req = {
        "id": req_data.get("id") or req_data.get("ma_yeu_cau") or f"DK-{len(REGISTRATION_REQUESTS) + 1:03d}",
        "msv": req_data.get("msv", ""),
        "ho_ten": req_data.get("ho_ten", "Sinh viên"),
        "gioi_tinh": req_data.get("gioi_tinh", "Nam"),
        "ngay_sinh": req_data.get("ngay_sinh", ""),
        "cccd": req_data.get("cccd", ""),
        "so_dien_thoai": req_data.get("so_dien_thoai", ""),
        "email": req_data.get("email", ""),
        "khoa": req_data.get("khoa", ""),
        "lop": req_data.get("lop", ""),
        "dia_chi": req_data.get("dia_chi", ""),
        "doi_tuong_uu_tien": req_data.get("doi_tuong_uu_tien", "Không thuộc diện ưu tiên"),
        "nguoi_giam_ho": req_data.get("nguoi_giam_ho", ""),
        "moi_quan_he": req_data.get("moi_quan_he", ""),
        "sdt_nguoi_giam_ho": req_data.get("sdt_nguoi_giam_ho", ""),
        "nguyen_vong": req_data.get("noi_dung_nguyen_vong") or req_data.get("nguyen_vong") or req_data.get("nguyen_vong_label") or "Xin đăng ký phòng KTX",
        "nguyen_vong_phong": req_data.get("nguyen_vong_phong", ""),
        "nguyen_vong_label": req_data.get("nguyen_vong_label", ""),
        "ngay_gui": datetime.datetime.now().isoformat(),
        "trang_thai": "CHO_DUYET",
        "goi_y": {
            "ma_toa": "A",
            "ma_phong": "A203",
            "ma_giuong": "G04",
        },
    }

    # Đưa lên đầu danh sách để quản lý thấy ngay đơn mới nhất
    REGISTRATION_REQUESTS.insert(0, new_req)
    return new_req


def get_all_requests() -> List[Dict]:
    """Lấy danh sách tất cả các đơn đăng ký."""
    return REGISTRATION_REQUESTS


def get_request_by_id(req_id: str) -> Optional[Dict]:
    """Tìm đơn theo ID hoặc MSV."""
    clean_id = req_id.strip().lower()
    for req in REGISTRATION_REQUESTS:
        if req["id"].lower() == clean_id or req["msv"].lower() == clean_id:
            return req
    return None


def update_request_status(req_id: str, new_status: str, extra_data: Optional[dict] = None) -> Optional[Dict]:
    """Cập nhật trạng thái đơn (DA_DUYET hoặc TU_CHOI)."""
    req = get_request_by_id(req_id)
    if req:
        req["trang_thai"] = new_status
        if extra_data:
            req.update(extra_data)
        return req
    return None


# =========================================================================
# STORE QUẢN LÝ YÊU CẦU CHUYỂN PHÒNG & TRẢ PHÒNG (SINH VIÊN)
# =========================================================================
TRANSFER_CHECKOUT_REQUESTS: List[Dict] = [
    {
        "id": "YC-0231",
        "ma_yeu_cau": "#YC-0231",
        "loai_yeu_cau": "Chuyển phòng",
        "loai_yeu_cau_code": "CHUYEN_PHONG",
        "ngay_gui": "2025-11-25",
        "phong_hien_tai": "P12",
        "phong_mong_muon": "P36",
        "phong_lien_quan": "P12 → P36",
        "trang_thai": "DA_DUYET",
        "ly_do": "Phòng hiện tại quá tải",
        "ngay_mong_muon": "2025-12-01",
        "mo_ta": "Nguyện vọng chuyển sang phòng 6 người cùng bạn học",
        "msv": "B21DCCN001",
    },
    {
        "id": "YC-0232",
        "ma_yeu_cau": "#YC-0232",
        "loai_yeu_cau": "Trả phòng",
        "loai_yeu_cau_code": "TRA_PHONG",
        "ngay_gui": "2026-08-25",
        "phong_hien_tai": "P36",
        "phong_lien_quan": "P36",
        "trang_thai": "CHO_DUYET",
        "ly_do": "Đã tốt nghiệp",
        "ngay_mong_muon": "2026-09-01",
        "dia_chi_sau_tra": "Số 123 Cầu Giấy, Hà Nội",
        "mo_ta": "Em đã hoàn thành chương trình đại học và xin trả phòng đúng hạn.",
        "msv": "B21DCCN001",
    },
]


def add_transfer_request(req_data: dict) -> dict:
    """Thêm một yêu cầu chuyển phòng mới."""
    new_id = f"YC-{len(TRANSFER_CHECKOUT_REQUESTS) + 231:04d}"
    phong_hien_tai = req_data.get("phong_hien_tai", "P36")
    phong_mong_muon = req_data.get("phong_mong_muon", "P36 - Tòa A3")
    
    # Rút gọn nhãn phòng hiển thị dạng P12 → P36
    target_clean = phong_mong_muon.split(" - ")[0].strip() if " - " in phong_mong_muon else phong_mong_muon
    current_clean = phong_hien_tai.split(" - ")[0].strip() if " - " in phong_hien_tai else phong_hien_tai
    phong_lien_quan = f"{current_clean} → {target_clean}"

    new_item = {
        "id": new_id,
        "ma_yeu_cau": f"#{new_id}",
        "loai_yeu_cau": "Chuyển phòng",
        "loai_yeu_cau_code": "CHUYEN_PHONG",
        "ngay_gui": datetime.date.today().strftime("%Y-%m-%d"),
        "phong_hien_tai": phong_hien_tai,
        "phong_mong_muon": phong_mong_muon,
        "phong_lien_quan": phong_lien_quan,
        "trang_thai": "CHO_DUYET",
        "ly_do": req_data.get("ly_do", "Phòng hiện tại quá tải"),
        "ngay_mong_muon": req_data.get("ngay_mong_muon", ""),
        "mo_ta": req_data.get("mo_ta", ""),
        "msv": req_data.get("msv", "B21DCCN001"),
    }
    TRANSFER_CHECKOUT_REQUESTS.insert(0, new_item)
    return new_item


def add_checkout_request(req_data: dict) -> dict:
    """Thêm một yêu cầu trả phòng mới."""
    new_id = f"YC-{len(TRANSFER_CHECKOUT_REQUESTS) + 231:04d}"
    phong_hien_tai = req_data.get("phong_hien_tai", "P36")
    current_clean = phong_hien_tai.split(" – ")[0].split(" - ")[0].strip() if " – " in phong_hien_tai or " - " in phong_hien_tai else phong_hien_tai

    new_item = {
        "id": new_id,
        "ma_yeu_cau": f"#{new_id}",
        "loai_yeu_cau": "Trả phòng",
        "loai_yeu_cau_code": "TRA_PHONG",
        "ngay_gui": datetime.date.today().strftime("%Y-%m-%d"),
        "phong_hien_tai": phong_hien_tai,
        "phong_lien_quan": current_clean,
        "trang_thai": "CHO_DUYET",
        "ly_do": req_data.get("ly_do", "Đã tốt nghiệp"),
        "ngay_mong_muon": req_data.get("ngay_mong_muon", ""),
        "dia_chi_sau_tra": req_data.get("dia_chi_sau_tra", ""),
        "mo_ta": req_data.get("mo_ta", ""),
        "msv": req_data.get("msv", "B21DCCN001"),
    }
    TRANSFER_CHECKOUT_REQUESTS.insert(0, new_item)
    return new_item


def get_student_transfer_checkout_requests(msv: Optional[str] = None) -> List[Dict]:
    """Lấy danh sách các yêu cầu chuyển/trả phòng của sinh viên."""
    if not msv:
        return TRANSFER_CHECKOUT_REQUESTS
    return [
        req for req in TRANSFER_CHECKOUT_REQUESTS
        if req.get("msv", "").lower() == msv.strip().lower()
    ] or TRANSFER_CHECKOUT_REQUESTS

