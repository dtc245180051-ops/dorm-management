from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_user_optional, require_ke_toan
from app.models.user import TaiKhoan
from app.schemas.invoice import (
    HoaDonResponse,
    PublishResultResponse,
    RoomBillingCandidate,
    RoomInvoicePublishRequest,
    UtilityBillingCandidate,
    UtilityInvoicePublishRequest,
    UtilityMeterUploadResponse,
)
from app.services.invoice_service import InvoiceService

router = APIRouter(prefix="/invoices", tags=["Quản lý Hóa đơn (Kế toán)"])




@router.get(
    "/room/candidates",
    response_model=List[RoomBillingCandidate],
    summary="[Kế toán] Lấy danh sách đối tượng cần lập hóa đơn tiền phòng",
)
def get_room_candidates(
    ky_thanh_toan: str = Query(
        "Năm học 2026 – 2027",
        description="Năm học / kỳ học cần lập hóa đơn",
    ),
    don_gia_thang: Optional[float] = Query(None, ge=0, description="??n gi? ti?n ph?ng (VND/th?ng)"),
    thoi_gian_o_thang: int = Query(
        11,
        ge=1,
        le=12,
        description="Thời gian ở (tháng, mặc định cố định 11 tháng)",
    ),
    ap_dung: Optional[str] = Query(
        None,
        description="Phạm vi áp dụng (Tất cả hoặc sinh viên tòa A1 đến A11)",
    ),
    current_user: Optional[TaiKhoan] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Dành riêng cho Kế toán.
    Lấy danh sách sinh viên nội trú cần lập hóa đơn tiền phòng theo năm học/kỳ, đơn giá, thời gian ở và tòa nhà áp dụng.
    """
    return InvoiceService.get_room_billing_candidates(
        db=db,
        ky_thanh_toan=ky_thanh_toan,
        don_gia_thang=don_gia_thang,
        thoi_gian_o_thang=thoi_gian_o_thang,
        ap_dung=ap_dung,
    )


@router.post(
    "/room/publish",
    response_model=PublishResultResponse,
    status_code=status.HTTP_201_CREATED,
    summary="[Kế toán] Phát hành hóa đơn tiền phòng theo kỳ",
)
def publish_room_invoices(
    payload: RoomInvoicePublishRequest,
    current_user: Optional[TaiKhoan] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Dành riêng cho Kế toán.
    Tạo và phát hành hóa đơn tiền phòng định kỳ cho sinh viên.
    Kiểm tra ngăn chặn tạo trùng lặp hóa đơn cho cùng đối tượng trong cùng kỳ.
    """
    creator = current_user.ten_dang_nhap if current_user else "KeToan"
    return InvoiceService.publish_room_invoices(
        db=db,
        request=payload,
        creator_username=creator,
    )


@router.get(
    "/utility/candidates",
    response_model=List[UtilityBillingCandidate],
    summary="[Kế toán] Lấy danh sách phòng phục vụ lập hóa đơn tiền điện nước",
)
def get_utility_candidates(
    thang: str = Query(
        "Tháng 09/2026",
        description="Tháng cần lập hóa đơn điện nước",
    ),
    current_user: Optional[TaiKhoan] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Dành riêng cho Kế toán.
    Lấy danh sách các phòng và thông tin số điện nước phục vụ lập hóa đơn theo tháng.
    """
    return InvoiceService.get_utility_billing_candidates(
        db=db,
        thang=thang,
    )


@router.post(
    "/utility/publish",
    response_model=PublishResultResponse,
    status_code=status.HTTP_201_CREATED,
    summary="[Kế toán] Phát hành hóa đơn tiền điện nước theo tháng",
)
def publish_utility_invoices(
    payload: UtilityInvoicePublishRequest,
    current_user: Optional[TaiKhoan] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Dành riêng cho Kế toán.
    Tạo và phát hành hóa đơn điện nước cho các phòng ký túc xá theo tháng.
    Kiểm tra ngăn chặn tạo trùng lặp hóa đơn cho cùng phòng trong cùng tháng.
    """
    creator = current_user.ten_dang_nhap if current_user else "KeToan"
    return InvoiceService.publish_utility_invoices(
        db=db,
        request=payload,
        creator_username=creator,
    )


@router.post(
    "/utility/upload-readings",
    response_model=UtilityMeterUploadResponse,
    summary="[Kế toán] Upload file Excel/CSV chỉ số điện nước để tự động tính toán",
)
async def upload_utility_readings(
    file: UploadFile = File(...),
    thang: str = Form("Tháng 09/2026"),
    don_gia_dien: float = Form(3000.0),
    don_gia_nuoc: float = Form(15000.0),
    current_user: Optional[TaiKhoan] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Dành riêng cho Kế toán.
    Upload file Excel (.xlsx) hoặc CSV chỉ số điện nước, hệ thống tự động bóc tách và tính toán:
    - Tiêu thụ điện (kWh) = Chỉ số mới - Chỉ số cũ
    - Tiêu thụ nước (m3) = Chỉ số mới - Chỉ số cũ
    - Thành tiền từng phòng = (Điện * đơn giá) + (Nước * đơn giá)
    """
    contents = await file.read()
    return InvoiceService.upload_utility_readings(
        db=db,
        file_bytes=contents,
        filename=file.filename or "chi_so_dien_nuoc.xlsx",
        thang=thang,
        don_gia_dien=don_gia_dien,
        don_gia_nuoc=don_gia_nuoc,
    )


@router.get(
    "/utility/template",
    summary="[Kế toán] Tải file Excel mẫu nhập chỉ số điện nước",
)
def download_utility_template():
    """
    Dành riêng cho Kế toán.
    Tải file Excel mẫu gồm các cột: STT, Phòng, Chỉ số điện cũ, Chỉ số điện mới, Chỉ số nước cũ, Chỉ số nước mới.
    """
    data = InvoiceService.generate_utility_template()
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Mau_nhap_chi_so_dien_nuoc_KTX.xlsx"},
    )


@router.get(
    "",
    response_model=List[HoaDonResponse],
    summary="[Kế toán] Lấy danh sách tất cả hóa đơn đã phát hành",
)
def get_all_invoices(
    loai_hoa_don: Optional[str] = Query(None, description="Lọc theo loại: TIEN_PHONG hoặc DIEN_NUOC"),
    ky_thanh_toan: Optional[str] = Query(None, description="Lọc theo kỳ thanh toán / tháng"),
    trang_thai: Optional[str] = Query(None, description="Lọc theo trạng thái thanh toán"),
    msv: Optional[str] = Query(None, description="Lọc theo mã sinh viên"),
    ma_phong: Optional[str] = Query(None, description="Lọc theo mã phòng"),
    current_user: Optional[TaiKhoan] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Dành riêng cho Kế toán.
    Tra cứu danh sách hóa đơn theo các tiêu chí lọc.
    """
    return InvoiceService.get_invoices(
        db=db,
        loai_hoa_don=loai_hoa_don,
        ky_thanh_toan=ky_thanh_toan,
        trang_thai=trang_thai,
        msv=msv,
        ma_phong=ma_phong,
    )


@router.get(
    "/student/my-invoices",
    response_model=List[HoaDonResponse],
    summary="[Sinh viên] Lấy danh sách hóa đơn của sinh viên đang đăng nhập",
)
def get_student_my_invoices(
    msv: Optional[str] = Query(None, description="Mã sinh viên"),
    current_user: Optional[TaiKhoan] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    from app.models.contract import HopDong
    from app.models.dorm import Giuong
    from app.models.invoice import HoaDon
    from app.models.user import NguoiDung, SinhVien
    from app.services.student_helper import resolve_student_msv

    raw_code = (msv or (current_user.ten_dang_nhap if current_user else "") or "").strip()
    if not raw_code:
        return []

    # Chuẩn hóa mã sinh viên chính xác từ bất kỳ mã/tên đăng nhập/email nào
    student_msv = resolve_student_msv(raw_code, db) or raw_code.upper()

    active_hd = (
        db.query(HopDong)
        .filter(HopDong.msv == student_msv, HopDong.trang_thai == "ACTIVE")
        .first()
    )
    ma_phong = None
    if active_hd and active_hd.giuong:
        ma_phong = active_hd.giuong.ma_phong

    # Lấy các hóa đơn phát hành trực tiếp cho sinh viên này (cả MSV chuẩn hoặc username)
    msv_queries = [HoaDon.msv.ilike(student_msv)]
    if raw_code and raw_code.upper() != student_msv.upper():
        msv_queries.append(HoaDon.msv.ilike(raw_code))

    student_invoices = (
        db.query(HoaDon)
        .filter(or_(*msv_queries))
        .order_by(HoaDon.han_thanh_toan.desc(), HoaDon.ngay_tao.desc())
        .all()
    )

    invoices = list(student_invoices)

    # Trong trường hợp có hóa đơn chung cả phòng (msv is None):
    # Tuyệt đối không gán hóa đơn cho sinh viên mới đăng ký nếu hóa đơn thuộc kỳ cũ trước khi sinh viên dọn vào ở.
    # Chỉ chia sẻ cho sinh viên nếu:
    # 1. Sinh viên có hợp đồng ACTIVE tại phòng này
    # 2. Sinh viên đã ở trong phòng tại thời điểm phát hành hóa đơn (ngay_tao >= ngay_bat_dau)
    # 3. Kỳ thanh toán của hóa đơn không phải là kỳ trước thời điểm sinh viên bắt đầu ở
    if ma_phong and active_hd and active_hd.ngay_bat_dau:
        import datetime
        import re

        room_invoices = (
            db.query(HoaDon)
            .filter(
                HoaDon.ma_phong == ma_phong,
                HoaDon.loai_hoa_don == "DIEN_NUOC",
                HoaDon.msv.is_(None),
            )
            .order_by(HoaDon.han_thanh_toan.desc(), HoaDon.ngay_tao.desc())
            .all()
        )

        c_start = active_hd.ngay_bat_dau
        if isinstance(c_start, datetime.datetime):
            c_start = c_start.date()

        valid_room_invoices = []
        for inv in room_invoices:
            inv_date = inv.ngay_tao or inv.ngay_lap
            if inv_date:
                if isinstance(inv_date, datetime.datetime):
                    inv_date = inv_date.date()
                if inv_date <= c_start:
                    continue

            # Kiểm tra kỳ thanh toán ví dụ "Tháng 09/2026"
            if inv.ky_thanh_toan:
                match = re.search(r"(\d{1,2})[/-](\d{4})", inv.ky_thanh_toan)
                if match:
                    inv_month = int(match.group(1))
                    inv_year = int(match.group(2))
                    if (inv_year, inv_month) < (c_start.year, c_start.month):
                        continue

            valid_room_invoices.append(inv)

        if valid_room_invoices:
            occupants_count = max(
                1,
                db.query(HopDong)
                .join(Giuong, HopDong.ma_giuong == Giuong.ma_giuong)
                .filter(Giuong.ma_phong == ma_phong, HopDong.trang_thai == "ACTIVE")
                .count(),
            )

            for inv in valid_room_invoices:
                split_amount = round(float(inv.so_tien) / occupants_count)
                inv_dict = {
                    c.name: getattr(inv, c.name) for c in inv.__table__.columns
                }
                inv_dict["so_tien"] = split_amount
                inv_dict["msv"] = student_msv
                invoices.append(HoaDonResponse(**inv_dict))

    res_list: List[HoaDonResponse] = []
    for inv in invoices:
        if isinstance(inv, HoaDonResponse):
            res_list.append(inv)
        else:
            inv_dict = {c.name: getattr(inv, c.name) for c in inv.__table__.columns}
            if not inv_dict.get("ky_thanh_toan"):
                inv_dict["ky_thanh_toan"] = "Năm học 2026-2027" if inv_dict.get("loai_hoa_don") == "TIEN_PHONG" else "Tháng 10/2026"
            res_list.append(HoaDonResponse(**inv_dict))

    return res_list


@router.get(
    "/{ma_hoa_don}",
    response_model=HoaDonResponse,
    summary="[Kế toán] Xem thông tin chi tiết một hóa đơn",
)
def get_invoice_detail(
    ma_hoa_don: str,
    current_user: TaiKhoan = Depends(require_ke_toan),
    db: Session = Depends(get_db),
):
    """
    Dành riêng cho Kế toán.
    Xem chi tiết hóa đơn theo mã.
    """
    invoice = InvoiceService.get_invoice_by_id(db=db, ma_hoa_don=ma_hoa_don)
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hóa đơn với mã '{ma_hoa_don}'",
        )
    return invoice