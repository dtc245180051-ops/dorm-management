from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_ke_toan
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
    don_gia_thang: float = Query(
        600000.0,
        ge=0,
        description="Đơn giá tiền phòng (VND/tháng)",
    ),
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
    current_user: TaiKhoan = Depends(require_ke_toan),
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
    current_user: TaiKhoan = Depends(require_ke_toan),
    db: Session = Depends(get_db),
):
    """
    Dành riêng cho Kế toán.
    Tạo và phát hành hóa đơn tiền phòng định kỳ cho sinh viên.
    Kiểm tra ngăn chặn tạo trùng lặp hóa đơn cho cùng đối tượng trong cùng kỳ.
    """
    return InvoiceService.publish_room_invoices(
        db=db,
        request=payload,
        creator_username=current_user.ten_dang_nhap,
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
    current_user: TaiKhoan = Depends(require_ke_toan),
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
    current_user: TaiKhoan = Depends(require_ke_toan),
    db: Session = Depends(get_db),
):
    """
    Dành riêng cho Kế toán.
    Tạo và phát hành hóa đơn điện nước cho các phòng ký túc xá theo tháng.
    Kiểm tra ngăn chặn tạo trùng lặp hóa đơn cho cùng phòng trong cùng tháng.
    """
    return InvoiceService.publish_utility_invoices(
        db=db,
        request=payload,
        creator_username=current_user.ten_dang_nhap,
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
    current_user: TaiKhoan = Depends(require_ke_toan),
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
    current_user: TaiKhoan = Depends(require_ke_toan),
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
