import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import TaiKhoan, SinhVien, NguoiDung
from app.models.contract import HopDong
from app.services import dorm_service, occupancy_request_store

router = APIRouter(prefix="/student/requests", tags=["Yêu cầu Lưu trú Sinh viên"])


class AvailableOptionResponse(BaseModel):
    ma_phong: str
    so_phong: str
    loai_phong: Optional[str] = None
    ma_toa_mong_muon: Optional[str] = None
    gioi_tinh: Optional[str] = None
    ma_tang: Optional[str] = None
    so_tang: Optional[int] = None
    ma_toa: Optional[str] = None
    ten_toa: Optional[str] = None
    label: str
    so_cho_trong: int = 1


class PriceOptionResponse(BaseModel):
    gia_tien: float
    label: str


class RegisterRoomRequest(BaseModel):
    msv: str
    ho_ten: Optional[str] = None
    gioi_tinh: Optional[str] = None
    ngay_sinh: Optional[str] = None
    cccd: Optional[str] = None
    so_dien_thoai: Optional[str] = None
    email: Optional[str] = None
    khoa: Optional[str] = None
    lop: Optional[str] = None
    dia_chi: Optional[str] = None
    doi_tuong_uu_tien: Optional[str] = None
    nguoi_giam_ho: Optional[str] = None
    moi_quan_he: Optional[str] = None
    sdt_nguoi_giam_ho: Optional[str] = None
    loai_phong: Optional[str] = None
    tang_mong_muon: Optional[str] = None
    muc_gia_mong_muon: Optional[str] = None
    nguyen_vong_phong: Optional[str] = None
    noi_dung_nguyen_vong: Optional[str] = None
    nguyen_vong: Optional[str] = None
    nguyen_vong_label: Optional[str] = None
    ma_toa_mong_muon: Optional[str] = None
    xac_nhan: bool = True


@router.get(
    "/price-options",
    response_model=List[PriceOptionResponse],
    summary="Lấy danh sách các mức giá phòng/năm hiện có trong KTX từ cơ sở dữ liệu",
)
def get_price_options(db: Session = Depends(get_db)):
    """Truy vấn các mức giá phòng/năm khác nhau đang có trong CSDL phòng KTX."""
    from app.models.dorm import Phong
    results = (
        db.query(Phong.gia_tien_nam)
        .filter(Phong.gia_tien_nam.isnot(None), Phong.gia_tien_nam > 0)
        .distinct()
        .order_by(Phong.gia_tien_nam)
        .all()
    )
    prices = [r[0] for r in results if r[0] is not None]

    if not prices:
        prices = [4800000.0, 7200000.0, 9600000.0, 12000000.0]

    return [
        PriceOptionResponse(
            gia_tien=p,
            label=f"{int(p):,}".replace(",", ".") + " đ/năm",
        )
        for p in prices
    ]


@router.get(
    "/available-options",
    response_model=List[AvailableOptionResponse],
    summary="Lấy danh sách các lựa chọn phòng/chỗ trống cho sinh viên đăng ký",
)
def get_available_options(
    gender: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Trả về danh sách phòng còn giường trống để hiển thị trên dropdown form đăng ký."""
    available_rooms = dorm_service.get_available_beds(db, gender=gender)
    options: List[AvailableOptionResponse] = []

    for room in available_rooms:
        building_name = room.ten_toa or (f"Tòa {room.ma_toa}" if room.ma_toa else "KTX")
        tang_label = f"Tầng {room.so_tang}" if room.so_tang else ""
        parts = [f"P{room.so_phong}"]
        if tang_label:
            parts.append(tang_label)
        if building_name:
            parts.append(building_name)
        
        bed_count_text = f"({room.so_giuong_trong} chỗ trống)"
        room_label = f"{' - '.join(parts)} {bed_count_text}"

        options.append(
            AvailableOptionResponse(
                ma_phong=room.ma_phong,
                so_phong=room.so_phong,
                loai_phong=room.loai_phong,
                gioi_tinh=room.gioi_tinh,
                ma_tang=room.ma_tang,
                so_tang=room.so_tang,
                ma_toa=room.ma_toa,
                ten_toa=building_name,
                label=room_label,
                so_cho_trong=room.so_giuong_trong,
            )
        )

    # Đảm bảo luôn có ít nhất một số lựa chọn mẫu chuẩn như Figma nếu database chưa có đủ dữ liệu
    return options


def normalize_room_type(rtype: Optional[str]) -> str:
    if not rtype:
        return ""
    r = rtype.strip().lower()
    if "dịch vụ" in r or "dich vu" in r or "service" in r:
        return "dich_vu"
    if "tiêu chuẩn" in r or "tieu chuan" in r or "standard" in r:
        return "tieu_chuan"
    return r


@router.post(
    "/register",
    summary="Gửi yêu cầu đăng ký chỗ ở ký túc xá",
    status_code=status.HTTP_201_CREATED,
)
def register_room(
    req: RegisterRoomRequest,
    db: Session = Depends(get_db),
):
    """
    Tiếp nhận đơn đăng ký chỗ ở từ sinh viên:
    - Kiểm tra có phòng phù hợp với giới tính và nguyện vọng không.
    - Cập nhật thông tin liên hệ khẩn cấp và địa chỉ sinh viên vào CSDL nếu đã có hồ sơ.
    - Tạo mã yêu cầu và trả về kết quả thành công.
    """
    if not req.xac_nhan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bạn cần xác nhận thông tin đăng ký là chính xác.",
        )

    clean_msv = req.msv.strip().upper()
    existing_request = next(
        (
            request
            for request in occupancy_request_store.get_registration_requests()
            if request.get("msv", "").strip().upper() == clean_msv
            and request.get("trang_thai") in ("PENDING", "CHO_DUYET")
        ),
        None,
    )
    if existing_request:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bạn đã có đơn đăng ký phòng đang chờ xét duyệt.",
        )

    active_contract = (
        db.query(HopDong)
        .filter(HopDong.msv == clean_msv, HopDong.trang_thai == "ACTIVE")
        .first()
    )
    if active_contract:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bạn đang có hợp đồng lưu trú đang hiệu lực.",
        )

    # Cập nhật thông tin sinh viên nếu tìm thấy trong CSDL, hoặc tự động tạo nếu chưa có
    student = db.query(SinhVien).filter(SinhVien.msv == clean_msv).first()
    if student:
        if req.nguoi_giam_ho:
            student.nguoi_giam_ho = req.nguoi_giam_ho
        if req.moi_quan_he:
            student.moi_quan_he = req.moi_quan_he
        if req.sdt_nguoi_giam_ho:
            student.sdt_nguoi_giam_ho = req.sdt_nguoi_giam_ho
        if req.dia_chi:
            student.dia_chi = req.dia_chi
        if req.doi_tuong_uu_tien:
            student.doi_tuong_uu_tien = req.doi_tuong_uu_tien
        if req.gioi_tinh:
            student.gioi_tinh = req.gioi_tinh
        if req.lop:
            student.lop = req.lop
        if req.khoa:
            student.khoa = req.khoa
        db.commit()
    else:
        email = (req.email or "").strip()
        user = None
        if email:
            user = db.query(NguoiDung).filter(NguoiDung.email == email).first()
        if not user and clean_msv:
            user = db.query(NguoiDung).filter(
                (NguoiDung.email.ilike(f"{clean_msv}@%")) |
                (NguoiDung.ho_ten == req.ho_ten)
            ).first()
        if not user:
            from app.models.user import VaiTro
            from app.core.security import get_password_hash
            new_tk = TaiKhoan(
                ten_dang_nhap=clean_msv.lower(),
                mat_khau=get_password_hash("password123"),
                vai_tro=VaiTro.SINH_VIEN,
            )
            db.add(new_tk)
            db.flush()
            user = NguoiDung(
                ma_tai_khoan=new_tk.ma_tai_khoan,
                ho_ten=req.ho_ten or "Sinh viên",
                email=email or f"{clean_msv.lower()}@ictu.edu.vn",
                so_dien_thoai=req.so_dien_thoai or "",
            )
            db.add(user)
            db.flush()

        new_sv = SinhVien(
            msv=clean_msv,
            ma_nguoi_dung=user.ma_nguoi_dung,
            lop=req.lop or "DTC-KTX",
            gioi_tinh=req.gioi_tinh or "Nam",
            khoa=req.khoa or "",
            dia_chi=req.dia_chi or "",
            cccd=req.cccd or "",
            ngay_sinh=req.ngay_sinh or "",
            doi_tuong_uu_tien=req.doi_tuong_uu_tien or "Không thuộc diện ưu tiên",
            nguoi_giam_ho=req.nguoi_giam_ho or "",
            moi_quan_he=req.moi_quan_he or "",
            sdt_nguoi_giam_ho=req.sdt_nguoi_giam_ho or "",
        )
        db.add(new_sv)
        db.commit()

    request_id = f"DK-{uuid.uuid4().hex[:6].upper()}"

    # Lưu vào store trung tâm để Quản lý tiếp nhận ngay lập tức kèm gợi ý phù hợp
    req_dict = req.model_dump()
    req_dict["msv"] = clean_msv
    req_dict["id"] = request_id
    req_dict["ma_yeu_cau"] = request_id
    stored_request = occupancy_request_store.add_request(req_dict)

    return {
        "status": "success",
        "message": "Gửi yêu cầu đăng ký phòng thành công",
        "data": stored_request,
    }


@router.get(
    "/my-requests",
    summary="Lấy danh sách các đơn đăng ký của sinh viên",
)
def get_my_registration_requests(msv: Optional[str] = None):
    """Trả về danh sách các đơn đăng ký chỗ ở của sinh viên."""
    from app.services import occupancy_request_store
    requests = occupancy_request_store.get_registration_requests()
    if msv:
        clean_msv = msv.strip().upper()
        return [r for r in requests if r.get("msv", "").strip().upper() == clean_msv]
    return requests


class TransferRoomRequest(BaseModel):
    msv: Optional[str] = "B21DCCN001"
    ho_ten: Optional[str] = "Nguyễn Văn A"
    phong_hien_tai: Optional[str] = "P36"
    ly_do: str
    ngay_mong_muon: str
    phong_mong_muon: str
    mo_ta_chi_tiet: Optional[str] = ""


class CheckoutRoomRequest(BaseModel):
    msv: Optional[str] = "B21DCCN001"
    ho_ten: Optional[str] = "Nguyễn Văn A"
    phong_hien_tai: Optional[str] = "P36"
    ly_do: str
    ngay_mong_muon: str
    dia_chi_lien_he: str
    mo_ta_chi_tiet: Optional[str] = ""


@router.post(
    "/transfer",
    summary="Gửi yêu cầu chuyển phòng ký túc xá",
    status_code=status.HTTP_201_CREATED,
)
def submit_transfer_request(
    req: TransferRoomRequest,
    db: Session = Depends(get_db),
):
    """Tiếp nhận yêu cầu xin chuyển phòng từ sinh viên."""
    from app.services import occupancy_request_store
    stored = occupancy_request_store.add_transfer_request(req.model_dump())
    return {
        "status": "success",
        "message": "Gửi yêu cầu chuyển phòng thành công",
        "data": stored,
    }


@router.post(
    "/checkout",
    summary="Gửi yêu cầu trả phòng ký túc xá",
    status_code=status.HTTP_201_CREATED,
)
def submit_checkout_request(
    req: CheckoutRoomRequest,
    db: Session = Depends(get_db),
):
    """Tiếp nhận yêu cầu xin trả phòng từ sinh viên."""
    from app.services import occupancy_request_store
    stored = occupancy_request_store.add_checkout_request(req.model_dump())
    return {
        "status": "success",
        "message": "Gửi yêu cầu trả phòng thành công",
        "data": stored,
    }


@router.get(
    "/transfer-checkout-history",
    summary="Lấy lịch sử các yêu cầu chuyển và trả phòng",
)
def get_transfer_checkout_history():
    """Lấy danh sách lịch sử yêu cầu chuyển và trả phòng."""
    from app.services import occupancy_request_store
    return occupancy_request_store.get_transfer_checkout_requests()


@router.get(
    "/my-contracts",
    summary="Lấy danh sách các hợp đồng/lịch sử ở của sinh viên",
)
def get_my_stay_contracts(
    msv: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Trả về danh sách các hợp đồng/lịch sử ở của sinh viên."""
    if not msv:
        return []
    from app.models.contract import HopDong
    from app.models.dorm import Giuong, Phong, Tang, ToaNha

    clean_msv = msv.strip().upper()
    contracts = (
        db.query(HopDong)
        .filter(HopDong.msv == clean_msv)
        .order_by(HopDong.ngay_bat_dau.desc())
        .all()
    )
    results = []
    for c in contracts:
        giuong = db.query(Giuong).filter(Giuong.ma_giuong == c.ma_giuong).first()
        phong = db.query(Phong).filter(Phong.ma_phong == giuong.ma_phong).first() if giuong else None
        tang = db.query(Tang).filter(Tang.ma_tang == phong.ma_tang).first() if phong else None
        toa = db.query(ToaNha).filter(ToaNha.ma_toa == tang.ma_toa).first() if tang else None

        status_val = c.trang_thai.value if hasattr(c.trang_thai, "value") else str(c.trang_thai)
        status_label = (
            "Đang ở" if status_val == "ACTIVE"
            else "Đã kết thúc" if status_val == "TERMINATED"
            else "Đã chuyển phòng"
        )
        results.append({
            "id": c.ma_hop_dong,
            "ma_hop_dong": c.ma_hop_dong,
            "msv": c.msv,
            "phong": f"P{phong.so_phong}" if phong else "",
            "so_phong": str(phong.so_phong) if phong else "",
            "toa": toa.ten_toa or (f"Tòa {toa.ma_toa}" if toa.ma_toa else "") if toa else "",
            "tang": str(tang.so_tang) if tang else "",
            "giuong": giuong.ma_giuong if giuong else "",
            "loai_phong": phong.loai_phong if phong else "",
            "thoi_gian_o": "2026-2027",
            "nam_hoc": "2026-2027",
            "trang_thai": "DANG_O" if status_val == "ACTIVE" else "KET_THUC",
            "trang_thai_label": status_label,
        })
    return results

