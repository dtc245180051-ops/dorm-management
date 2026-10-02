import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import TaiKhoan, SinhVien
from app.services import dorm_service

router = APIRouter(prefix="/student/requests", tags=["Yêu cầu Lưu trú Sinh viên"])


class AvailableOptionResponse(BaseModel):
    ma_phong: str
    so_phong: str
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
def get_available_options(db: Session = Depends(get_db)):
    """Trả về danh sách phòng còn giường trống để hiển thị trên dropdown form đăng ký."""
    available_rooms = dorm_service.get_available_beds(db)
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
                ma_tang=room.ma_tang,
                so_tang=room.so_tang,
                ma_toa=room.ma_toa,
                ten_toa=building_name,
                label=room_label,
                so_cho_trong=room.so_giuong_trong,
            )
        )

    # Đảm bảo luôn có ít nhất một số lựa chọn mẫu chuẩn như Figma nếu database chưa có đủ dữ liệu
    if not options:
        options = [
            AvailableOptionResponse(
                ma_phong="P36",
                so_phong="36",
                so_tang=3,
                ma_toa="A2",
                ten_toa="Tòa A2",
                label="P36 - Tầng 3 - Tòa A2",
                so_cho_trong=2,
            ),
            AvailableOptionResponse(
                ma_phong="P101",
                so_phong="101",
                so_tang=1,
                ma_toa="A1",
                ten_toa="Tòa A1",
                label="P101 - Tầng 1 - Tòa A1",
                so_cho_trong=3,
            ),
            AvailableOptionResponse(
                ma_phong="P205",
                so_phong="205",
                so_tang=2,
                ma_toa="A2",
                ten_toa="Tòa A2",
                label="P205 - Tầng 2 - Tòa A2",
                so_cho_trong=1,
            ),
        ]

    return options


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
    - Cập nhật thông tin liên hệ khẩn cấp và địa chỉ sinh viên vào CSDL nếu đã có hồ sơ.
    - Tạo mã yêu cầu và trả về kết quả thành công.
    """
    if not req.xac_nhan:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bạn cần xác nhận thông tin đăng ký là chính xác.",
        )

    # Cập nhật thông tin sinh viên nếu tìm thấy trong CSDL
    student = db.query(SinhVien).filter(SinhVien.msv == req.msv).first()
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
        db.commit()

    request_id = f"DK-{uuid.uuid4().hex[:6].upper()}"

    # Lưu vào store trung tâm để Quản lý tiếp nhận ngay lập tức
    from app.services import occupancy_request_store
    req_dict = req.model_dump()
    req_dict["id"] = request_id
    req_dict["ma_yeu_cau"] = request_id
    stored_request = occupancy_request_store.add_request(req_dict)

    return {
        "status": "success",
        "message": "Gửi yêu cầu đăng ký phòng thành công",
        "data": stored_request,
    }


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
    "/current-room",
    summary="Lấy thông tin phòng hiện tại của sinh viên đang đăng nhập",
)
def get_current_room(
    current_user: TaiKhoan = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Trả về thông tin phòng hiện tại của sinh viên đang đăng nhập dựa vào hợp đồng ACTIVE.
    Nếu chưa có hợp đồng, trả về null để frontend hiển thị 'Chưa có phòng'.
    """
    from app.models.contract import HopDong, Phi
    from app.models.dorm import Giuong, Phong, Tang, ToaNha
    from sqlalchemy.orm import joinedload

    # Lấy MSV từ tài khoản đang đăng nhập
    msv = None
    if current_user.nguoi_dung and current_user.nguoi_dung.sinh_vien:
        msv = current_user.nguoi_dung.sinh_vien.msv

    if not msv:
        return {"data": None, "message": "Sinh viên chưa được xếp phòng"}

    # Tìm hợp đồng ACTIVE
    active_contract = (
        db.query(HopDong)
        .options(
            joinedload(HopDong.giuong)
            .joinedload(Giuong.phong)
            .joinedload(Phong.tang)
            .joinedload(Tang.toa_nha)
        )
        .filter(HopDong.msv == msv, HopDong.trang_thai == "ACTIVE")
        .first()
    )

    if not active_contract or not active_contract.giuong or not active_contract.giuong.phong:
        return {"data": None, "message": "Sinh viên chưa được xếp phòng"}

    bed = active_contract.giuong
    room = bed.phong
    floor = room.tang
    building = floor.toa_nha if floor else None

    # Đếm số sinh viên đang ở trong phòng
    occupied_count = (
        db.query(HopDong)
        .join(Giuong, HopDong.ma_giuong == Giuong.ma_giuong)
        .filter(Giuong.ma_phong == room.ma_phong, HopDong.trang_thai == "ACTIVE")
        .count()
    )
    suc_chua = room.suc_chua or 8
    thanh_vien = f"{occupied_count}/{suc_chua} người"

    # Tìm khoản phí liên quan đến hợp đồng này
    phi = (
        db.query(Phi)
        .filter(Phi.ma_hop_dong == active_contract.ma_hop_dong, Phi.loai_phi == "TIEN_PHONG")
        .first()
    )
    billing = None
    if phi:
        so_tien = int(phi.so_tien) if phi.so_tien else 0
        so_tien_fmt = f"{so_tien:,}".replace(",", ".") + "đ"
        trang_thai_phi = "Đã thanh toán" if phi.trang_thai == "DA_THANH_TOAN" else "Chưa thanh toán"
        billing = {
            "amount": so_tien_fmt,
            "period": "/năm",
            "status": trang_thai_phi,
        }

    toa_label = building.ten_toa if building else (f"Tòa {floor.ma_toa}" if floor and floor.ma_toa else "")
    tang_val = str(floor.so_tang) if floor and floor.so_tang else ""

    return {
        "data": {
            "so_phong": f"P{room.so_phong}" if room.so_phong and not str(room.so_phong).startswith("P") else room.so_phong,
            "toa": toa_label,
            "tang": tang_val,
            "thanh_vien": thanh_vien,
            "so_thanh_vien": occupied_count,
            "suc_chua": suc_chua,
            "ma_giuong": bed.ma_giuong,
            "ma_hop_dong": active_contract.ma_hop_dong,
            "ngay_bat_dau": str(active_contract.ngay_bat_dau) if active_contract.ngay_bat_dau else None,
            "ngay_ket_thuc": str(active_contract.ngay_ket_thuc) if active_contract.ngay_ket_thuc else None,
            "billing": billing,
        },
        "message": "OK"
    }


@router.get(
    "/transfer-checkout-history",
    summary="Lấy lịch sử các yêu cầu chuyển và trả phòng",
)
def get_transfer_checkout_history():
    """Lấy danh sách lịch sử yêu cầu chuyển và trả phòng."""
    from app.services import occupancy_request_store
    return occupancy_request_store.get_transfer_checkout_requests()

