import datetime
import json
import os
from typing import Dict, List, Optional

STORE_FILE = os.path.join(os.path.dirname(__file__), "..", "data_store_requests.json")

# In-memory store lưu trữ danh sách các đơn đăng ký chỗ ở để liên kết trực tiếp
# giữa sinh viên và quản lý KTX
REGISTRATION_REQUESTS: List[Dict] = []

def _save_store():
    try:
        with open(STORE_FILE, "w", encoding="utf-8") as f:
            json.dump({
                "REGISTRATION_REQUESTS": REGISTRATION_REQUESTS,
                "TRANSFER_CHECKOUT_REQUESTS": TRANSFER_CHECKOUT_REQUESTS,
            }, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("Lỗi lưu trữ file store:", e)

def _load_store():
    global REGISTRATION_REQUESTS, TRANSFER_CHECKOUT_REQUESTS
    if os.path.exists(STORE_FILE):
        try:
            with open(STORE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "REGISTRATION_REQUESTS" in data and isinstance(data["REGISTRATION_REQUESTS"], list):
                    # Cập nhật danh sách đơn đăng ký từ file mà không làm mất các đơn đã có
                    loaded_ids = {r.get("id") for r in data["REGISTRATION_REQUESTS"]}
                    merged = list(data["REGISTRATION_REQUESTS"])
                    for r in REGISTRATION_REQUESTS:
                        if r.get("id") not in loaded_ids:
                            merged.append(r)
                    REGISTRATION_REQUESTS.clear()
                    REGISTRATION_REQUESTS.extend(merged)
        except Exception as e:
            print("Lỗi tải file store:", e)


def add_request(req_data: dict) -> dict:
    """Thêm một đơn đăng ký mới vào hệ thống quản lý."""
    now = datetime.datetime.now()
    date_str = now.strftime("%d/%m/%Y")
    time_str = now.strftime("%H:%M")

    new_req = {
        "id": req_data.get("id") or req_data.get("ma_yeu_cau") or f"DK-{len(REGISTRATION_REQUESTS) + 1:03d}",
        "ma_yeu_cau": req_data.get("ma_yeu_cau") or req_data.get("id") or f"DK-{len(REGISTRATION_REQUESTS) + 1:03d}",
        "msv": req_data.get("msv", ""),
        "ho_ten": req_data.get("ho_ten", "Sinh viên"),
        "gioi_tinh": req_data.get("gioi_tinh", ""),
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
        "loai_phong": req_data.get("loai_phong", "") or "Phòng tiêu chuẩn",
        "tang_mong_muon": req_data.get("tang_mong_muon", ""),
        "muc_gia_mong_muon": req_data.get("muc_gia_mong_muon", ""),
        "nguyen_vong": req_data.get("noi_dung_nguyen_vong") or req_data.get("nguyen_vong") or req_data.get("nguyen_vong_label") or "Xin đăng ký phòng KTX",
        "nguyen_vong_phong": req_data.get("nguyen_vong_phong", ""),
        "nguyen_vong_label": req_data.get("nguyen_vong_label", ""),
        "ngay_dang_ky": date_str,
        "ngay_gui": f"{date_str} {time_str}",
        "ngay_gui_time": f"{date_str} {time_str}",
        "nam_hoc": req_data.get("nam_hoc") or "2026-2027",
        "trang_thai": "PENDING",
        "trang_thai_label": "Đang xét duyệt",
        "ma_toa_mong_muon": req_data.get("ma_toa_mong_muon", ""),
    }

    # Đưa lên đầu danh sách để quản lý thấy ngay đơn mới nhất
    REGISTRATION_REQUESTS.insert(0, new_req)
    _save_store()
    return new_req


def get_registration_requests() -> List[Dict]:
    """Lấy danh sách các đơn đăng ký chỗ ở."""
    _load_store()
    return REGISTRATION_REQUESTS


def get_all_requests() -> List[Dict]:
    """Lấy danh sách tất cả các đơn đăng ký, chuyển phòng và trả phòng."""
    _load_store()
    return TRANSFER_CHECKOUT_REQUESTS + REGISTRATION_REQUESTS


def get_request_by_id(req_id: str) -> Optional[Dict]:
    """Tìm đơn theo ID hoặc MSV."""
    _load_store()
    clean_id = req_id.strip().lower().replace("#", "")
    for req in TRANSFER_CHECKOUT_REQUESTS:
        rid = req.get("id", "").lower().replace("#", "")
        rmsv = req.get("msv", "").lower()
        rmyc = req.get("ma_yeu_cau", "").lower().replace("#", "")
        if rid == clean_id or rmsv == clean_id or rmyc == clean_id:
            return req

    for req in REGISTRATION_REQUESTS:
        rid = req.get("id", "").lower().replace("#", "")
        rmsv = req.get("msv", "").lower()
        rmyc = req.get("ma_yeu_cau", "").lower().replace("#", "")
        if rid == clean_id or rmsv == clean_id or rmyc == clean_id:
            return req
    return None


def update_request_status(req_id: str, new_status: str, extra_data: Optional[dict] = None) -> Optional[Dict]:
    """Cập nhật trạng thái đơn (DA_DUYET hoặc TU_CHOI)."""
    req = get_request_by_id(req_id)
    if req:
        req["trang_thai"] = new_status
        req["trang_thai_label"] = "Đã duyệt" if new_status in ("DA_DUYET", "APPROVED") else "Từ chối"
        if extra_data:
            req.update(extra_data)
        _save_store()
        return req
    return None


# Danh sách các yêu cầu chuyển phòng và trả phòng
TRANSFER_CHECKOUT_REQUESTS: List[Dict] = []


def add_transfer_request(data: dict) -> dict:
    req_num = len(TRANSFER_CHECKOUT_REQUESTS) + 231
    req_id = data.get("id") or f"YC-{req_num:04d}"
    today_str = datetime.datetime.now().strftime("%d/%m/%Y")
    
    phong_hien_tai = data.get("phong_hien_tai", "P36")
    phong_mong_muon = data.get("phong_mong_muon", "P36 - Tòa A3 - Tầng 3")
    target_short = phong_mong_muon.split(" - ")[0] if " - " in phong_mong_muon else phong_mong_muon
    
    new_req = {
        "id": req_id,
        "ma_yeu_cau": f"#{req_id}",
        "loai_yeu_cau": "Chuyển phòng",
        "loai_don": "CHUYEN_PHONG",
        "msv": data.get("msv", "DTC245180051"),
        "ho_ten": data.get("ho_ten", "Nguyễn Quốc Huy"),
        "gioi_tinh": data.get("gioi_tinh", "Nam"),
        "khoa": data.get("khoa", "Công nghệ thông tin"),
        "lop": data.get("lop", "DTC-K20"),
        "vi_tri_hien_tai": data.get("vi_tri_hien_tai", "Phòng A102 - Giường G01"),
        "cong_no": "Đã hoàn thành toàn bộ phí",
        "ngay_gui": data.get("ngay_gui") or today_str,
        "phong_lien_quan": f"{phong_hien_tai} → {target_short}" if target_short else phong_hien_tai,
        "phong_hien_tai": phong_hien_tai,
        "phong_dich": target_short,
        "ly_do": data.get("ly_do", "Phòng hiện tại quá tải"),
        "ngay_mong_muon": data.get("ngay_mong_muon", ""),
        "mo_ta": data.get("mo_ta_chi_tiet") or data.get("mo_ta", "Em muốn chuyển sang phòng A305 để cùng phòng với các bạn cùng nhóm đồ án môn học..."),
        "trang_thai": "CHO_DUYET",
        "trang_thai_label": "Chờ duyệt",
        "goi_y": {
            "ma_toa": "A",
            "ma_phong": "A203",
            "ma_giuong": "G04",
        },
    }
    TRANSFER_CHECKOUT_REQUESTS.insert(0, new_req)
    _save_store()
    return new_req


def add_checkout_request(data: dict) -> dict:
    req_num = len(TRANSFER_CHECKOUT_REQUESTS) + 231
    req_id = data.get("id") or f"YC-{req_num:04d}"
    today_str = datetime.datetime.now().strftime("%d/%m/%Y")
    
    phong_hien_tai = data.get("phong_hien_tai", "P36")
    
    new_req = {
        "id": req_id,
        "ma_yeu_cau": f"#{req_id}",
        "loai_yeu_cau": "Trả phòng",
        "loai_don": "TRA_PHONG",
        "msv": data.get("msv", "DTC245180051"),
        "ho_ten": data.get("ho_ten", "Nguyễn Quốc Huy"),
        "gioi_tinh": data.get("gioi_tinh", "Nam"),
        "khoa": data.get("khoa", "Công nghệ thông tin"),
        "lop": data.get("lop", "DTC-K20"),
        "vi_tri_hien_tai": data.get("vi_tri_hien_tai", "Phòng A102 - Giường G01"),
        "cong_no": "Đã hoàn thành toàn bộ phí",
        "ngay_gui": data.get("ngay_gui") or today_str,
        "phong_lien_quan": phong_hien_tai,
        "phong_hien_tai": phong_hien_tai,
        "ly_do": data.get("ly_do", "Đã tốt nghiệp"),
        "ngay_mong_muon": data.get("ngay_mong_muon", ""),
        "dia_chi_sau_tra": data.get("dia_chi_lien_he") or data.get("dia_chi_sau_tra", "Số 123 Đường Cầu Giấy, Quận Cầu Giấy, Hà Nội"),
        "dia_chi_chi_tiet": data.get("dia_chi_chi_tiet", {
            "tinh": "Hà Nội",
            "huyen": "Quận Cầu Giấy",
            "so_nha": "Số 123 Đường Cầu Giấy",
        }),
        "mo_ta": data.get("mo_ta_chi_tiet") or data.get("mo_ta", "Em muốn chuyển sang phòng A305 để cùng phòng với các bạn cùng nhóm đồ án môn học..."),
        "trang_thai": "CHO_DUYET",
        "trang_thai_label": "Chờ duyệt",
    }
    TRANSFER_CHECKOUT_REQUESTS.insert(0, new_req)
    _save_store()
    return new_req


def get_transfer_checkout_requests() -> List[Dict]:
    _load_store()
    return TRANSFER_CHECKOUT_REQUESTS


# Tự động nạp dữ liệu khi nạp module
_load_store()


