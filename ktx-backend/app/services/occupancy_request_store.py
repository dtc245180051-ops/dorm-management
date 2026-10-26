import datetime
import json
import os
from typing import Dict, List, Optional

STORE_FILE = os.path.join(os.path.dirname(__file__), "..", "data_store_requests.json")

# In-memory store lưu trữ danh sách các đơn đăng ký chỗ ở để liên kết trực tiếp
# giữa sinh viên và quản lý KTX
REGISTRATION_REQUESTS: List[Dict] = []
TRANSFER_CHECKOUT_REQUESTS: List[Dict] = []

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
                    loaded_ids = {r.get("id") for r in data["REGISTRATION_REQUESTS"]}
                    merged = list(data["REGISTRATION_REQUESTS"])
                    for r in REGISTRATION_REQUESTS:
                        if r.get("id") not in loaded_ids:
                            merged.append(r)
                    REGISTRATION_REQUESTS.clear()
                    REGISTRATION_REQUESTS.extend(merged)

                if "TRANSFER_CHECKOUT_REQUESTS" in data and isinstance(data["TRANSFER_CHECKOUT_REQUESTS"], list):
                    loaded_tc_ids = {r.get("id") for r in data["TRANSFER_CHECKOUT_REQUESTS"]}
                    merged_tc = list(data["TRANSFER_CHECKOUT_REQUESTS"])
                    for r in TRANSFER_CHECKOUT_REQUESTS:
                        if r.get("id") not in loaded_tc_ids:
                            merged_tc.append(r)
                    TRANSFER_CHECKOUT_REQUESTS.clear()
                    TRANSFER_CHECKOUT_REQUESTS.extend(merged_tc)
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
        "nguoi_giam_ho": req_data.get("nguoi_giam_ho") or req_data.get("ho_ten_nguoi_giam_ho") or req_data.get("ho_ten_phu_huynh") or "",
        "moi_quan_he": req_data.get("moi_quan_he", ""),
        "sdt_nguoi_giam_ho": req_data.get("sdt_nguoi_giam_ho") or req_data.get("sdt_phu_huynh") or "",
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


# Các hàm xử lý yêu cầu chuyển phòng và trả phòng


def add_transfer_request(data: dict) -> dict:
    req_num = len(TRANSFER_CHECKOUT_REQUESTS) + 231
    req_id = data.get("id") or f"YC-{req_num:04d}"
    today_str = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
    
    phong_hien_tai = data.get("phong_hien_tai", "")
    toa_hien_tai = data.get("toa_hien_tai", "")
    if not toa_hien_tai and " - " in data.get("vi_tri_hien_tai", ""):
        for vp in data.get("vi_tri_hien_tai", "").split(" - "):
            if "Tòa" in vp:
                toa_hien_tai = vp.strip()
                break

    phong_mong_muon = data.get("phong_mong_muon", "")
    from_label = f"{phong_hien_tai} ({toa_hien_tai})" if toa_hien_tai and phong_hien_tai and f"({toa_hien_tai})" not in phong_hien_tai else phong_hien_tai

    if " - " in phong_mong_muon:
        p_parts = phong_mong_muon.split(" - ")
        to_label = f"{p_parts[0].strip()} ({p_parts[1].strip()})"
        target_short = p_parts[0].strip()
    else:
        to_label = phong_mong_muon.strip()
        target_short = phong_mong_muon.strip()

    if data.get("phong_lien_quan") and "→" in data.get("phong_lien_quan"):
        phong_lien_quan = data.get("phong_lien_quan")
        if "(" not in phong_lien_quan and from_label and to_label:
            phong_lien_quan = f"{from_label} → {to_label}"
    else:
        phong_lien_quan = f"{from_label} → {to_label}" if from_label and to_label else (to_label or from_label)

    new_req = {
        "id": req_id,
        "ma_yeu_cau": f"#{req_id}",
        "loai_yeu_cau": "Chuyển phòng",
        "loai_don": "CHUYEN_PHONG",
        "msv": data.get("msv", ""),
        "ho_ten": data.get("ho_ten", ""),
        "gioi_tinh": data.get("gioi_tinh", ""),
        "khoa": data.get("khoa", ""),
        "lop": data.get("lop", ""),
        "vi_tri_hien_tai": data.get("vi_tri_hien_tai", phong_hien_tai),
        "cong_no": data.get("cong_no", "Chưa thanh toán (Chưa phát hành hóa đơn)"),
        "ngay_gui": data.get("ngay_gui") or today_str,
        "phong_lien_quan": phong_lien_quan,
        "phong_hien_tai": from_label,
        "phong_dich": to_label,
        "ly_do": data.get("ly_do", "Chuyển phòng"),
        "ngay_mong_muon": data.get("ngay_mong_muon", ""),
        "mo_ta": data.get("mo_ta_chi_tiet") or data.get("mo_ta", ""),
        "trang_thai": "CHO_DUYET",
        "trang_thai_label": "Chờ duyệt",
    }
    TRANSFER_CHECKOUT_REQUESTS.insert(0, new_req)
    _save_store()
    return new_req


def add_checkout_request(data: dict) -> dict:
    req_num = len(TRANSFER_CHECKOUT_REQUESTS) + 231
    req_id = data.get("id") or f"YC-{req_num:04d}"
    today_str = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
    
    phong_hien_tai = data.get("phong_hien_tai", "")
    
    dia_chi_sau_tra = data.get("dia_chi_sau_tra") or data.get("dia_chi_lien_he") or ""
    dia_chi_chi_tiet = data.get("dia_chi_chi_tiet") or {}
    if (not dia_chi_chi_tiet or not any(dia_chi_chi_tiet.values())) and dia_chi_sau_tra:
        parts = [s.strip() for s in dia_chi_sau_tra.split(",") if s.strip()]
        if len(parts) >= 3:
            dia_chi_chi_tiet = {
                "tinh": parts[-1],
                "huyen": parts[-2],
                "so_nha": ", ".join(parts[:-2]),
            }
        elif len(parts) == 2:
            dia_chi_chi_tiet = {
                "tinh": parts[1],
                "huyen": "",
                "so_nha": parts[0],
            }
        elif len(parts) == 1:
            dia_chi_chi_tiet = {
                "tinh": parts[0],
                "huyen": "",
                "so_nha": "",
            }

    new_req = {
        "id": req_id,
        "ma_yeu_cau": f"#{req_id}",
        "loai_yeu_cau": "Trả phòng",
        "loai_don": "TRA_PHONG",
        "msv": data.get("msv", ""),
        "ho_ten": data.get("ho_ten", ""),
        "gioi_tinh": data.get("gioi_tinh", ""),
        "khoa": data.get("khoa", ""),
        "lop": data.get("lop", ""),
        "vi_tri_hien_tai": data.get("vi_tri_hien_tai", phong_hien_tai),
        "cong_no": data.get("cong_no", "Chưa thanh toán (Chưa phát hành hóa đơn)"),
        "ngay_gui": data.get("ngay_gui") or today_str,
        "phong_lien_quan": phong_hien_tai,
        "phong_hien_tai": phong_hien_tai,
        "ly_do": data.get("ly_do", "Trả phòng"),
        "ngay_mong_muon": data.get("ngay_mong_muon", ""),
        "dia_chi_sau_tra": dia_chi_sau_tra,
        "dia_chi_chi_tiet": dia_chi_chi_tiet,
        "mo_ta": data.get("mo_ta_chi_tiet") or data.get("mo_ta", ""),
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


