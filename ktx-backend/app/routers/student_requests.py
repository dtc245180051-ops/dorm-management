import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_user_optional
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
                mat_khau=get_password_hash(uuid.uuid4().hex),
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
            lop=req.lop or "",
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
    "/registration-history",
    summary="Lấy danh sách các đơn đăng ký của sinh viên (alias)",
)
@router.get(
    "/my-requests",
    summary="Lấy danh sách các đơn đăng ký của sinh viên",
)
def get_my_registration_requests(
    msv: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Trả về danh sách các đơn đăng ký chỗ ở của sinh viên."""
    from app.services import occupancy_request_store
    from app.services.student_helper import resolve_student_msv
    requests = occupancy_request_store.get_registration_requests()
    if msv:
        raw_msv = msv.strip()
        clean_msv = resolve_student_msv(raw_msv, db) or raw_msv.upper()
        return [
            r for r in requests
            if r.get("msv", "").strip().upper() in (clean_msv, raw_msv.upper())
        ]
    return requests


class TransferRoomRequest(BaseModel):
    msv: Optional[str] = None
    ho_ten: Optional[str] = None
    phong_hien_tai: Optional[str] = None
    ly_do: str
    ngay_mong_muon: str
    phong_mong_muon: str
    mo_ta_chi_tiet: Optional[str] = ""


class CheckoutRoomRequest(BaseModel):
    msv: Optional[str] = None
    ho_ten: Optional[str] = None
    phong_hien_tai: Optional[str] = None
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
    data = req.model_dump()
    clean_msv = (req.msv or "").strip().upper()
    if clean_msv:
        student = db.query(SinhVien).filter(SinhVien.msv == clean_msv).first()
        if student:
            if not data.get("ho_ten") and student.nguoi_dung:
                data["ho_ten"] = student.nguoi_dung.ho_ten
            data["gioi_tinh"] = student.gioi_tinh or data.get("gioi_tinh") or "Nam"
            data["khoa"] = student.khoa or data.get("khoa") or ""
            data["lop"] = student.lop or data.get("lop") or ""

            # Tra cứu vị trí phòng hiện tại từ hợp đồng ACTIVE
            active_c = db.query(HopDong).filter(HopDong.msv == clean_msv, HopDong.trang_thai == "ACTIVE").first()
            if active_c and active_c.giuong and active_c.giuong.phong:
                p = active_c.giuong.phong
                t = p.tang.toa_nha if p.tang else None
                b_name = t.ten_toa if t else (f"Tòa {p.tang.ma_toa}" if p.tang and p.tang.ma_toa else "KTX")
                g_code = active_c.giuong.ma_giuong.split("_")[-1] if active_c.giuong.ma_giuong else ""
                data["vi_tri_hien_tai"] = f"Phòng P{p.so_phong} - {b_name} - Giường {g_code}"
                data["phong_hien_tai"] = f"P{p.so_phong}"

            # Tra cứu công nợ thực tế của sinh viên
            try:
                from app.services.debt_service import DebtService
                debt_resp = DebtService.get_personal_debt(db, clean_msv)
                if debt_resp and debt_resp.totalDebt > 0:
                    data["cong_no"] = f"Còn nợ {debt_resp.totalDebt:,.0f} ₫".replace(",", ".")
                else:
                    data["cong_no"] = "Đã hoàn thành toàn bộ phí"
            except Exception:
                data["cong_no"] = "Đã hoàn thành toàn bộ phí"
    stored = occupancy_request_store.add_transfer_request(data)
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
    data = req.model_dump()
    clean_msv = (req.msv or "").strip().upper()
    if clean_msv:
        student = db.query(SinhVien).filter(SinhVien.msv == clean_msv).first()
        if student:
            if not data.get("ho_ten") and student.nguoi_dung:
                data["ho_ten"] = student.nguoi_dung.ho_ten
            data["gioi_tinh"] = student.gioi_tinh or data.get("gioi_tinh") or "Nam"
            data["khoa"] = student.khoa or data.get("khoa") or ""
            data["lop"] = student.lop or data.get("lop") or ""

            active_c = db.query(HopDong).filter(HopDong.msv == clean_msv, HopDong.trang_thai == "ACTIVE").first()
            if active_c and active_c.giuong and active_c.giuong.phong:
                p = active_c.giuong.phong
                t = p.tang.toa_nha if p.tang else None
                b_name = t.ten_toa if t else (f"Tòa {p.tang.ma_toa}" if p.tang and p.tang.ma_toa else "KTX")
                g_code = active_c.giuong.ma_giuong.split("_")[-1] if active_c.giuong.ma_giuong else ""
                data["vi_tri_hien_tai"] = f"Phòng P{p.so_phong} - {b_name} - Giường {g_code}"
                data["phong_hien_tai"] = f"P{p.so_phong}"

            # Tra cứu công nợ thực tế của sinh viên
            try:
                from app.services.debt_service import DebtService
                debt_resp = DebtService.get_personal_debt(db, clean_msv)
                if debt_resp and debt_resp.totalDebt > 0:
                    data["cong_no"] = f"Còn nợ {debt_resp.totalDebt:,.0f} ₫".replace(",", ".")
                else:
                    data["cong_no"] = "Đã hoàn thành toàn bộ phí"
            except Exception:
                data["cong_no"] = "Đã hoàn thành toàn bộ phí"
    stored = occupancy_request_store.add_checkout_request(data)
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
    msv: Optional[str] = Query(None, description="Mã sinh viên (tùy chọn)"),
    current_user: Optional[TaiKhoan] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Trả về thông tin phòng hiện tại của sinh viên đang đăng nhập dựa vào hợp đồng ACTIVE.
    Nếu chưa có hợp đồng, trả về null để frontend hiển thị 'Chưa có phòng'.
    """
    from app.models.contract import HopDong, Phi
    from app.models.invoice import HoaDon, TrangThaiHoaDon
    from app.models.dorm import Giuong, Phong, Tang, ToaNha
    from sqlalchemy.orm import joinedload

    # Lấy MSV từ query param hoặc tài khoản đang đăng nhập
    target_msv = (msv or "").strip().upper() if msv else None
    if not target_msv and current_user:
        if current_user.nguoi_dung and current_user.nguoi_dung.sinh_vien:
            target_msv = current_user.nguoi_dung.sinh_vien.msv
        elif current_user.ten_dang_nhap:
            target_msv = current_user.ten_dang_nhap.upper()

    if not target_msv:
        return {"data": None, "message": "Chưa xác định được sinh viên"}

    def _compute_student_billing(student_msv: str, contract_no: Optional[str] = None):
        inv_item = None
        if contract_no:
            inv_item = db.query(HoaDon).filter(HoaDon.ma_hop_dong == contract_no).first()
        if not inv_item and student_msv:
            inv_item = (
                db.query(HoaDon)
                .filter(HoaDon.msv == student_msv)
                .order_by(HoaDon.ngay_lap.desc())
                .first()
            )
        try:
            from app.services.debt_service import DebtService
            debt_resp = DebtService.get_personal_debt(db, student_msv)
            if debt_resp and debt_resp.fees:
                room_fee = next((f for f in debt_resp.fees if "phòng" in f.feeName.lower()), debt_resp.fees[0])
                amt_str = f"{int(room_fee.amount):,}".replace(",", ".") + " đ"
                st = "Chưa thanh toán" if debt_resp.totalDebt > 0 else "Đã thanh toán"
                return {
                    "amount": amt_str,
                    "period": "/năm",
                    "status": st,
                }
        except Exception:
            pass

        if inv_item:
            so_tien = int(inv_item.so_tien) if inv_item.so_tien else 4800000
            so_tien_fmt = f"{so_tien:,}".replace(",", ".") + " đ"
            trang_thai_phi = "Đã thanh toán" if inv_item.trang_thai == TrangThaiHoaDon.DA_THANH_TOAN.value else "Chưa thanh toán"
            return {
                "amount": so_tien_fmt,
                "period": "/năm",
                "status": trang_thai_phi,
            }
        return None

    # 0. Kiểm tra nếu sinh viên đã được duyệt trả phòng (checkout)
    checkout_req = next(
        (
            r for r in occupancy_request_store.get_transfer_checkout_requests()
            if r.get("msv", "").strip().upper() == target_msv
            and (r.get("trang_thai") in ("DA_DUYET", "APPROVED") or r.get("trang_thai_label") == "Đã duyệt")
            and r.get("loai_don") == "TRA_PHONG"
        ),
        None,
    )
    if checkout_req:
        return {"data": None, "message": "Sinh viên đã hoàn tất thủ tục trả phòng"}

    # 1. Kiểm tra nếu sinh viên đã được duyệt chuyển phòng trong occupancy_request_store
    transfer_req = next(
        (
            r for r in occupancy_request_store.get_transfer_checkout_requests()
            if r.get("msv", "").strip().upper() == target_msv
            and (r.get("trang_thai") in ("DA_DUYET", "APPROVED") or r.get("trang_thai_label") == "Đã duyệt")
            and r.get("loai_don") == "CHUYEN_PHONG"
        ),
        None,
    )
    if transfer_req and transfer_req.get("xep_phong"):
        import re
        xp = transfer_req["xep_phong"]
        raw_toa = str(xp.get("ma_toa", "A1"))
        toa_clean = raw_toa.replace("TOA_", "").replace("Tòa ", "").replace("Tòa", "").strip() or "A1"
        toa_label = f"Tòa {toa_clean}"
        raw_phong = str(xp.get("phong_id", "203"))
        match_num = re.search(r"\d+", raw_phong)
        phong_clean = match_num.group(0) if match_num else "203"
        raw_giuong = str(xp.get("giuong_id", "G01"))
        giuong_clean = raw_giuong.split("_")[-1].replace("Giường ", "").strip() or "G01"
        tang_val = phong_clean[0] if (phong_clean and phong_clean[0].isdigit()) else "2"
        date_gui = transfer_req.get("ngay_gui", "19/10/2026")
        if " " in date_gui:
            date_gui = date_gui.split(" ")[0]

        stu_record = db.query(SinhVien).filter(SinhVien.msv == target_msv).first()
        user_record = stu_record.nguoi_dung if stu_record else None
        stu_name = user_record.ho_ten if user_record else (transfer_req.get("ho_ten") or "Sinh viên")
        stu_phone = user_record.so_dien_thoai if user_record else (transfer_req.get("so_dien_thoai") or "")
        stu_lop = stu_record.lop if stu_record else (transfer_req.get("lop") or "")
        stu_khoa = stu_record.khoa if stu_record else (transfer_req.get("khoa") or "")

        target_phong = db.query(Phong).filter(
            (Phong.so_phong == phong_clean) | (Phong.ma_phong.ilike(f"%{phong_clean}%"))
        ).first()

        members_transfer = []
        if target_phong:
            room_beds = db.query(Giuong).filter(Giuong.ma_phong == target_phong.ma_phong).all()
            room_contracts = (
                db.query(HopDong)
                .options(joinedload(HopDong.sinh_vien).joinedload(SinhVien.nguoi_dung))
                .filter(HopDong.ma_giuong.in_([b.ma_giuong for b in room_beds]), HopDong.trang_thai == "ACTIVE")
                .all()
            )
            contract_by_bed = {c.ma_giuong: c for c in room_contracts}
            for b in room_beds:
                short_b = b.ma_giuong.split("_")[-1]
                if short_b == giuong_clean or b.ma_giuong == xp.get("giuong_id"):
                    members_transfer.append({
                        "msv": target_msv,
                        "ho_ten": stu_name,
                        "giuong": short_b,
                        "so_giuong": short_b,
                        "lop": stu_lop,
                        "khoa": stu_khoa,
                        "so_dien_thoai": stu_phone,
                        "vai_tro": "Bạn (Trưởng phòng)",
                        "ngay_vao": date_gui,
                        "trang_thai": "DANG_O",
                        "trang_thai_label": "Đang ở",
                        "is_current_user": True,
                    })
                elif b.ma_giuong in contract_by_bed and contract_by_bed[b.ma_giuong].sinh_vien:
                    bed_c = contract_by_bed[b.ma_giuong]
                    sv_user = bed_c.sinh_vien.nguoi_dung
                    members_transfer.append({
                        "msv": bed_c.msv,
                        "ho_ten": sv_user.ho_ten if sv_user else "Sinh viên",
                        "giuong": short_b,
                        "so_giuong": short_b,
                        "lop": bed_c.sinh_vien.lop or "",
                        "khoa": bed_c.sinh_vien.khoa or "",
                        "so_dien_thoai": sv_user.so_dien_thoai if sv_user else "",
                        "vai_tro": "Thành viên",
                        "ngay_vao": bed_c.ngay_bat_dau.strftime("%d/%m/%Y") if bed_c.ngay_bat_dau else date_gui,
                        "trang_thai": "DANG_O",
                        "trang_thai_label": "Đang ở",
                        "is_current_user": False,
                    })
                else:
                    members_transfer.append({
                        "msv": None,
                        "ho_ten": "Chưa có người ở",
                        "giuong": short_b,
                        "so_giuong": short_b,
                        "lop": None,
                        "khoa": None,
                        "so_dien_thoai": None,
                        "vai_tro": "Chỗ trống",
                        "ngay_vao": None,
                        "trang_thai": "TRONG",
                        "trang_thai_label": "Còn trống",
                        "is_empty": True,
                    })
        else:
            members_transfer.append({
                "msv": target_msv,
                "ho_ten": stu_name,
                "giuong": giuong_clean,
                "so_giuong": giuong_clean,
                "lop": stu_lop,
                "khoa": stu_khoa,
                "so_dien_thoai": stu_phone,
                "vai_tro": "Bạn (Trưởng phòng)",
                "ngay_vao": date_gui,
                "trang_thai": "DANG_O",
                "trang_thai_label": "Đang ở",
                "is_current_user": True,
            })

        return {
            "data": {
                "so_phong": phong_clean,
                "phong": f"P{phong_clean}",
                "toa": toa_label,
                "tang": tang_val,
                "loai_phong": (target_phong.loai_phong if target_phong and target_phong.loai_phong else "Phòng tiêu chuẩn"),
                "roomType": (target_phong.loai_phong if target_phong and target_phong.loai_phong else "Phòng tiêu chuẩn"),
                "thanh_vien": "3/4 người",
                "so_thanh_vien": 3,
                "suc_chua": "4 người",
                "ma_giuong": f"P{phong_clean}_{giuong_clean}",
                "giuong": giuong_clean,
                "so_giuong": giuong_clean,
                "ma_hop_dong": f"HD26-{toa_clean}{phong_clean}-{giuong_clean}",
                "ngay_nhan_phong": date_gui,
                "ngay_duyet": date_gui,
                "ngay_bat_dau": date_gui,
                "ngay_ket_thuc": "30/06/2027",
                "thoi_gian_luu_tru": f"{date_gui} – Nay",
                "billing": _compute_student_billing(target_msv),
                "danh_sach_thanh_vien": members_transfer,
            }
        }

    # Tìm hợp đồng ACTIVE cho MSV thực tế
    active_contract = (
        db.query(HopDong)
        .options(
            joinedload(HopDong.giuong)
            .joinedload(Giuong.phong)
            .joinedload(Phong.tang)
            .joinedload(Tang.toa_nha)
        )
        .filter(HopDong.msv == target_msv, HopDong.trang_thai == "ACTIVE")
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
    suc_chua = room.suc_chua or 4
    thanh_vien = f"{occupied_count}/{suc_chua} người"

    # Lấy thông tin thanh toán công nợ thực tế của sinh viên
    billing = _compute_student_billing(target_msv, active_contract.ma_hop_dong)

    toa_label = building.ten_toa if building else (f"Tòa {floor.ma_toa}" if floor and floor.ma_toa else "KTX")
    tang_val = str(floor.so_tang) if floor and floor.so_tang else "1"
    clean_so_phong = str(room.so_phong).replace("P", "").strip() if room.so_phong else ""
    bed_code = bed.ma_giuong.split("_")[-1] if bed.ma_giuong else ""

    # Lấy danh sách thành viên theo giường trong phòng từ DB
    room_beds = db.query(Giuong).filter(Giuong.ma_phong == room.ma_phong).all()
    room_contracts = (
        db.query(HopDong)
        .options(joinedload(HopDong.sinh_vien).joinedload(SinhVien.nguoi_dung))
        .filter(HopDong.ma_giuong.in_([b.ma_giuong for b in room_beds]), HopDong.trang_thai == "ACTIVE")
        .all()
    )
    contract_by_bed = {c.ma_giuong: c for c in room_contracts}
    members_list = []
    for b in room_beds:
        bed_c = contract_by_bed.get(b.ma_giuong)
        short_b = b.ma_giuong.split("_")[-1]
        if bed_c and bed_c.sinh_vien:
            sv_user = bed_c.sinh_vien.nguoi_dung
            is_me = (bed_c.msv or "").upper() == (target_msv or "").upper()
            members_list.append({
                "msv": bed_c.msv,
                "ho_ten": sv_user.ho_ten if sv_user else "Sinh viên",
                "giuong": short_b,
                "so_giuong": short_b,
                "lop": bed_c.sinh_vien.lop or "",
                "khoa": bed_c.sinh_vien.khoa or "",
                "so_dien_thoai": sv_user.so_dien_thoai if sv_user else "",
                "vai_tro": "Bạn (Trưởng phòng)" if is_me else "Thành viên",
                "ngay_vao": bed_c.ngay_bat_dau.strftime("%d/%m/%Y") if bed_c.ngay_bat_dau else "01/09/2026",
                "trang_thai": "DANG_O",
                "trang_thai_label": "Đang ở",
                "is_current_user": is_me,
            })
        else:
            members_list.append({
                "msv": None,
                "ho_ten": "Chưa có người ở",
                "giuong": short_b,
                "so_giuong": short_b,
                "lop": None,
                "khoa": None,
                "so_dien_thoai": None,
                "vai_tro": "Chỗ trống",
                "ngay_vao": None,
                "trang_thai": "TRONG",
                "trang_thai_label": "Còn trống",
                "is_empty": True,
            })

    loai_phong_val = room.loai_phong
    if not loai_phong_val:
        reg_item = occupancy_request_store.get_request_by_id(target_msv)
        if reg_item:
            loai_phong_val = reg_item.get("loai_phong")
    if not loai_phong_val:
        loai_phong_val = "Phòng dịch vụ" if (room.gia_tien_nam and room.gia_tien_nam > 5000000) else "Phòng tiêu chuẩn"

    return {
        "data": {
            "so_phong": clean_so_phong,
            "phong": clean_so_phong,
            "toa": toa_label,
            "tang": tang_val,
            "loai_phong": loai_phong_val,
            "roomType": loai_phong_val,
            "thanh_vien": thanh_vien,
            "so_thanh_vien": occupied_count,
            "suc_chua": f"{suc_chua} người",
            "ma_giuong": bed.ma_giuong,
            "giuong": bed_code,
            "so_giuong": bed_code,
            "ma_hop_dong": active_contract.ma_hop_dong,
            "ngay_nhan_phong": active_contract.ngay_bat_dau.strftime("%d/%m/%Y") if active_contract.ngay_bat_dau else "01/09/2026",
            "ngay_duyet": active_contract.ngay_bat_dau.strftime("%d/%m/%Y") if active_contract.ngay_bat_dau else "01/09/2026",
            "ngay_bat_dau": active_contract.ngay_bat_dau.strftime("%d/%m/%Y") if active_contract.ngay_bat_dau else "01/09/2026",
            "ngay_ket_thuc": (active_contract.ngay_ket_thuc or active_contract.ngay_bat_dau.replace(year=active_contract.ngay_bat_dau.year + 1)).strftime("%d/%m/%Y") if active_contract.ngay_bat_dau else "30/06/2027",
            "billing": billing,
            "danh_sach_thanh_vien": members_list,
        },
        "message": "OK",
    }


@router.get(
    "/transfer-checkout-history",
    summary="Lấy lịch sử các yêu cầu chuyển và trả phòng",
)
def get_transfer_checkout_history(db: Session = Depends(get_db)):
    """Lấy danh sách lịch sử yêu cầu chuyển và trả phòng."""
    from app.services import occupancy_request_store
    from app.models.user import SinhVien
    reqs = occupancy_request_store.get_transfer_checkout_requests()
    reg_reqs = occupancy_request_store.get_all_requests()
    enriched = []
    for r in reqs:
        item = dict(r)
        r_msv = (item.get("msv") or "").strip().upper()
        # 1. Đồng bộ thông tin từ REGISTRATION_REQUESTS
        reg = next((reg for reg in reg_reqs if (reg.get("msv") or "").strip().upper() == r_msv), None)
        if reg:
            for field in [
                "ngay_sinh", "cccd", "so_dien_thoai", "email", "dia_chi",
                "que_quan", "khoa", "lop", "nguoi_giam_ho", "moi_quan_he",
                "sdt_nguoi_giam_ho", "doi_tuong_uu_tien",
            ]:
                if not item.get(field) and reg.get(field):
                    item[field] = reg.get(field)
        # 2. Tìm thông tin trong DB SinhVien nếu vẫn còn thiếu
        if r_msv:
            sv = db.query(SinhVien).filter(SinhVien.msv == r_msv).first()
            if sv:
                u = sv.nguoi_dung
                if not item.get("ho_ten") and u and u.ho_ten:
                    item["ho_ten"] = u.ho_ten
                if not item.get("email") and u and u.email:
                    item["email"] = u.email
                if not item.get("so_dien_thoai") and u and u.so_dien_thoai:
                    item["so_dien_thoai"] = u.so_dien_thoai
                if not item.get("cccd") and sv.cccd:
                    item["cccd"] = sv.cccd
                if not item.get("ngay_sinh") and sv.ngay_sinh:
                    item["ngay_sinh"] = sv.ngay_sinh.strftime("%Y-%m-%d") if hasattr(sv.ngay_sinh, "strftime") else str(sv.ngay_sinh)
                if not item.get("dia_chi") and (sv.dia_chi or sv.que_quan):
                    item["dia_chi"] = sv.dia_chi or sv.que_quan
                if not item.get("nguoi_giam_ho") and sv.nguoi_giam_ho:
                    item["nguoi_giam_ho"] = sv.nguoi_giam_ho
                if not item.get("moi_quan_he") and sv.moi_quan_he:
                    item["moi_quan_he"] = sv.moi_quan_he
                if not item.get("sdt_nguoi_giam_ho") and sv.sdt_nguoi_giam_ho:
                    item["sdt_nguoi_giam_ho"] = sv.sdt_nguoi_giam_ho
        enriched.append(item)
    return enriched


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
    from sqlalchemy import or_
    from app.models.contract import HopDong
    from app.models.dorm import Giuong, Phong, Tang, ToaNha
    from app.services.student_helper import resolve_student_msv

    raw_msv = msv.strip()
    clean_msv = resolve_student_msv(raw_msv, db) or raw_msv.upper()
    from app.services import occupancy_request_store
    import re

    # 1. Kiểm tra yêu cầu chuyển phòng đã duyệt
    transfer_req = next(
        (
            r for r in occupancy_request_store.get_transfer_checkout_requests()
            if r.get("msv", "").strip().upper() in (clean_msv, raw_msv.upper())
            and (r.get("trang_thai") in ("DA_DUYET", "APPROVED") or r.get("trang_thai_label") == "Đã duyệt")
            and r.get("loai_don") == "CHUYEN_PHONG"
        ),
        None,
    )

    # 2. Kiểm tra yêu cầu trả phòng đã duyệt
    checkout_req = next(
        (
            r for r in occupancy_request_store.get_transfer_checkout_requests()
            if r.get("msv", "").strip().upper() in (clean_msv, raw_msv.upper())
            and (r.get("trang_thai") in ("DA_DUYET", "APPROVED") or r.get("trang_thai_label") == "Đã duyệt")
            and r.get("loai_don") == "TRA_PHONG"
        ),
        None,
    )

    contracts = (
        db.query(HopDong)
        .filter(or_(HopDong.msv == clean_msv, HopDong.msv == raw_msv.upper()))
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
        if checkout_req:
            final_status = "DA_TRA_PHONG"
            final_label = "Đã kết thúc"
        elif transfer_req:
            final_status = "DA_CHUYEN"
            final_label = "Đã chuyển phòng"
        else:
            final_status = "DANG_O" if status_val == "ACTIVE" else "KET_THUC"
            final_label = (
                "Đang ở" if status_val == "ACTIVE"
                else "Đã kết thúc" if status_val == "TERMINATED"
                else "Đã chuyển phòng"
            )

        # Sức chứa thực tế từ CSDL
        suc_chua_val = f"{phong.suc_chua} người" if phong and phong.suc_chua else "4 người"

        # Chuẩn hóa ngày nhận phòng và thời hạn hợp đồng 1 năm
        start_date_str = c.ngay_bat_dau.strftime("%d/%m/%Y") if c.ngay_bat_dau else "02/10/2026"
        if c.ngay_ket_thuc:
            end_date_str = c.ngay_ket_thuc.strftime("%d/%m/%Y")
        elif c.ngay_bat_dau:
            try:
                end_date_str = c.ngay_bat_dau.replace(year=c.ngay_bat_dau.year + 1).strftime("%d/%m/%Y")
            except Exception:
                end_date_str = "02/10/2027"
        else:
            end_date_str = "02/10/2027"

        # Rút gọn mã giường: A1_T3_P301_G02 -> G02
        full_bed = giuong.ma_giuong if giuong else ""
        short_bed = full_bed.split("_")[-1] if full_bed else ""

        results.append({
            "id": c.ma_hop_dong,
            "ma_hop_dong": c.ma_hop_dong,
            "msv": c.msv,
            "phong": f"P{phong.so_phong}" if phong else "",
            "so_phong": str(phong.so_phong) if phong else "",
            "ma_phong": phong.ma_phong if phong else "",
            "toa": toa.ten_toa or (f"Tòa {toa.ma_toa}" if toa.ma_toa else "") if toa else "",
            "tang": str(tang.so_tang) if tang else "",
            "giuong": short_bed,
            "so_giuong": short_bed,
            "ma_giuong": full_bed,
            "loai_phong": phong.loai_phong if phong else "Phòng tiêu chuẩn",
            "suc_chua": suc_chua_val,
            "ngay_nhan_phong": start_date_str,
            "ngay_bat_dau": start_date_str,
            "ngay_duyet": start_date_str,
            "ngay_ket_thuc": end_date_str,
            "thoi_han_hop_dong": f"{start_date_str} - {end_date_str}",
            "thoi_gian_o": "2026-2027",
            "nam_hoc": "2026-2027",
            "trang_thai": final_status,
            "trang_thai_label": final_label,
            "status": "TRANSFERRED" if final_status == "DA_CHUYEN" else ("ACTIVE" if final_status == "DANG_O" else "COMPLETED"),
        })

    # Nếu có yêu cầu chuyển phòng được duyệt, chèn hợp đồng phòng mới lên đầu
    if transfer_req and transfer_req.get("xep_phong") and not checkout_req:
        xp = transfer_req["xep_phong"]
        raw_toa = str(xp.get("ma_toa", "A1"))
        toa_clean = raw_toa.replace("TOA_", "").replace("Tòa ", "").replace("Tòa", "").strip() or "A1"
        toa_label = f"Tòa {toa_clean}"
        raw_phong = str(xp.get("phong_id", "203"))
        match_num = re.search(r"\d+", raw_phong)
        phong_clean = match_num.group(0) if match_num else "203"
        raw_giuong = str(xp.get("giuong_id", "G01"))
        giuong_clean = raw_giuong.split("_")[-1].replace("Giường ", "").strip() or "G01"
        tang_val = phong_clean[0] if (phong_clean and phong_clean[0].isdigit()) else "2"
        date_gui = transfer_req.get("ngay_gui", "19/10/2026")
        if " " in date_gui:
            date_gui = date_gui.split(" ")[0]

        results.insert(0, {
            "id": f"HD-{toa_clean}{phong_clean}-{giuong_clean}",
            "ma_hop_dong": f"HD26-{toa_clean}{phong_clean}-{giuong_clean}",
            "msv": clean_msv,
            "phong": f"P{phong_clean}",
            "so_phong": phong_clean,
            "ma_phong": f"P{phong_clean}_{toa_clean}",
            "toa": toa_label,
            "tang": tang_val,
            "giuong": giuong_clean,
            "so_giuong": giuong_clean,
            "ma_giuong": f"P{phong_clean}_{toa_clean}_{giuong_clean}",
            "loai_phong": "Phòng tiêu chuẩn",
            "suc_chua": "4 người",
            "ngay_nhan_phong": date_gui,
            "ngay_bat_dau": date_gui,
            "ngay_duyet": date_gui,
            "ngay_ket_thuc": "30/06/2027",
            "thoi_han_hop_dong": f"{date_gui} - 30/06/2027",
            "thoi_gian_o": "2026-2027",
            "nam_hoc": "2026-2027",
            "trang_thai": "DANG_O",
            "trang_thai_label": "Đang ở",
            "status": "ACTIVE",
        })

    return results

