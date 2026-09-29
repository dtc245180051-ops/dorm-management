from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_ke_toan
from app.models.user import TaiKhoan
from app.schemas.reconciliation import (
    ManualMatchRequest,
    ManualMatchResponse,
    ReconciliationListResponse,
    StatementUploadResponse,
    StudentInvoiceItem,
    StudentSearchItem,
    TransactionDetailResponse,
)
from app.services.reconciliation_service import ReconciliationService

router = APIRouter(tags=["Đối soát giao dịch (Kế toán)"])


@router.get(
    "/reconciliation",
    response_model=ReconciliationListResponse,
    summary="[Kế toán] Lấy danh sách giao dịch đối soát kèm thống kê",
)
def get_reconciliation_list(
    dateFrom: Optional[str] = Query(None, description="Từ ngày giao dịch (YYYY-MM-DD)"),
    dateTo: Optional[str] = Query(None, description="Đến ngày giao dịch (YYYY-MM-DD)"),
    bank: Optional[str] = Query(None, description="Tên ngân hàng hoặc mã ngân hàng"),
    status: Optional[str] = Query(None, description="Trạng thái: AUTO_MATCHED, MANUAL_REQUIRED, MATCHED_MANUALLY, ERROR"),
    keyword: Optional[str] = Query(None, description="Từ khóa: Mã GD, nội dung chuyển khoản, mã hóa đơn"),
    page: int = Query(1, ge=1, description="Trang hiện tại"),
    pageSize: int = Query(10, ge=1, le=100, description="Số bản ghi trên mỗi trang"),
    hasUploaded: Optional[bool] = Query(None, description="Trạng thái đã upload file hay chưa"),
    current_user: TaiKhoan = Depends(require_ke_toan),
    db: Session = Depends(get_db),
):
    """
    Dành riêng cho Kế toán.
    Lấy danh sách các giao dịch ngân hàng theo các điều kiện lọc và tính toán thống kê động từ dữ liệu thật.
    """
    return ReconciliationService.get_reconciliation_list(
        db=db,
        date_from=dateFrom,
        date_to=dateTo,
        bank=bank,
        status_filter=status,
        keyword=keyword,
        page=page,
        page_size=pageSize,
        has_uploaded=hasUploaded,
    )


@router.post(
    "/reconciliation/upload-statement",
    response_model=StatementUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="[Kế toán] Tải lên file sao kê ngân hàng (Excel/CSV) và tự động đối soát",
)
async def upload_statement(
    file: UploadFile = File(...),
    bank: Optional[str] = Form(None),
    period: Optional[str] = Form(None),
    current_user: TaiKhoan = Depends(require_ke_toan),
    db: Session = Depends(get_db),
):
    """
    Dành riêng cho Kế toán.
    Tải lên file sao kê ngân hàng (CSV hoặc Excel .xlsx/.xls):
    - Trích xuất metadata (Tên file, Ngân hàng, Kỳ sao kê).
    - Parse từng dòng giao dịch.
    - Chạy đối soát tự động với hóa đơn sinh viên trong hệ thống.
    - Cập nhật số liệu thống kê.
    """
    contents = await file.read()
    return ReconciliationService.process_statement_upload(
        db=db,
        file_bytes=contents,
        filename=file.filename or "sao_ke.csv",
        bank_name=bank,
        period=period,
        accountant_username=current_user.ten_dang_nhap,
    )


@router.get(
    "/reconciliation/students/search",
    response_model=List[StudentSearchItem],
    summary="[Kế toán] Tìm kiếm sinh viên để gạch nợ thủ công",
)
@router.get(
    "/students/search",
    response_model=List[StudentSearchItem],
    summary="[Kế toán] Tìm kiếm sinh viên",
    include_in_schema=False,
)
def search_students(
    keyword: Optional[str] = Query(None, description="Tên hoặc mã sinh viên"),
    limit: int = Query(20, ge=1, le=100, description="Số lượng kết quả tối đa"),
    current_user: TaiKhoan = Depends(require_ke_toan),
    db: Session = Depends(get_db),
):
    """
    Dành riêng cho Kế toán.
    Tìm kiếm thông tin sinh viên theo mã hoặc tên phục vụ gán hóa đơn thủ công.
    """
    return ReconciliationService.search_students(
        db=db,
        keyword=keyword,
        limit=limit,
    )


@router.get(
    "/reconciliation/students/{student_id}/invoices",
    response_model=List[StudentInvoiceItem],
    summary="[Kế toán] Lấy danh sách hóa đơn còn nợ của sinh viên",
)
@router.get(
    "/students/{student_id}/invoices",
    response_model=List[StudentInvoiceItem],
    summary="[Kế toán] Lấy danh sách hóa đơn của sinh viên",
    include_in_schema=False,
)
def get_student_invoices(
    student_id: str,
    current_user: TaiKhoan = Depends(require_ke_toan),
    db: Session = Depends(get_db),
):
    """
    Dành riêng cho Kế toán.
    Lấy danh sách hóa đơn chưa thanh toán của sinh viên để thực hiện đối soát.
    """
    return ReconciliationService.get_invoices_by_student(
        db=db,
        student_id=student_id,
    )


@router.get(
    "/reconciliation/{id}",
    response_model=TransactionDetailResponse,
    summary="[Kế toán] Xem chi tiết một giao dịch ngân hàng",
)
def get_transaction_detail(
    id: str,
    current_user: TaiKhoan = Depends(require_ke_toan),
    db: Session = Depends(get_db),
):
    """
    Dành riêng cho Kế toán.
    Xem chi tiết thông tin giao dịch, trạng thái đối soát và hóa đơn liên quan.
    """
    return ReconciliationService.get_transaction_detail(
        db=db,
        transaction_id=id,
    )


@router.post(
    "/reconciliation/{id}/manual-match",
    response_model=ManualMatchResponse,
    status_code=status.HTTP_200_OK,
    summary="[Kế toán] Thực hiện gán giao dịch thủ công",
)
def manual_match_transaction(
    id: str,
    payload: ManualMatchRequest,
    current_user: TaiKhoan = Depends(require_ke_toan),
    db: Session = Depends(get_db),
):
    """
    Dành riêng cho Kế toán.
    Thực hiện gán thủ công một giao dịch chưa khớp vào hóa đơn của sinh viên.
    Kiểm tra nghiêm ngặt:
    - Giao dịch tồn tại và chưa được đối soát
    - Sinh viên và Hóa đơn tồn tại
    - Hóa đơn thuộc đúng sinh viên
    - Hóa đơn chưa thanh toán
    - Số tiền giao dịch khớp số tiền hóa đơn
    """
    return ReconciliationService.manual_match(
        db=db,
        transaction_id=id,
        student_id=payload.studentId,
        invoice_id=payload.invoiceId,
        accountant_username=current_user.ten_dang_nhap,
    )
