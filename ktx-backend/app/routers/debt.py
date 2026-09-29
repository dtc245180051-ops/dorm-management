from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_ke_toan
from app.models.user import TaiKhoan
from app.schemas.debt import (
    DebtSummaryResponse,
    PersonalDebtResponse,
    RemindDebtResponse,
)
from app.services.debt_service import DebtService

router = APIRouter(prefix="/debt", tags=["Sổ công nợ (Kế toán)"])


@router.get(
    "/summary",
    response_model=DebtSummaryResponse,
    summary="[Kế toán] Lấy tổng quan thống kê và danh sách chi tiết công nợ",
)
def get_debt_summary(
    keyword: Optional[str] = Query(None, description="Tìm theo mã SV, họ tên, phòng"),
    current_user: TaiKhoan = Depends(require_ke_toan),
    db: Session = Depends(get_db),
):
    """
    Dành riêng cho Kế toán.
    Lấy danh sách chi tiết công nợ của sinh viên:
    - Thống kê: Tổng nợ cần thu, Đã thu hoàn tất, Còn nợ tồn đọng.
    - Danh sách: Mã SV, Họ tên, Phòng, Tiền phòng nợ, Điện nước nợ, Tổng còn nợ, Hạn chót.
    - Tự động ghi nhận công nợ khi sinh viên chuyển thiếu tiền.
    """
    return DebtService.get_debt_summary(db=db, keyword=keyword)


@router.get(
    "/students/{student_id}",
    response_model=PersonalDebtResponse,
    summary="[Kế toán] Xem sổ công nợ cá nhân của sinh viên",
)
def get_student_personal_debt(
    student_id: str,
    current_user: TaiKhoan = Depends(require_ke_toan),
    db: Session = Depends(get_db),
):
    """
    Dành riêng cho Kế toán.
    Xem sổ công nợ cá nhân của sinh viên theo chuẩn màn hình Figma:
    - Thông tin sinh viên (Mã SV, Họ tên, Phòng, SĐT, Tổng dư nợ).
    - Danh mục các khoản thu (Khoản thu, Kỳ/Tháng, Số tiền, Đã nộp, Còn lại, Trạng thái: Chưa nộp, Đã hoàn tất, Chuyển thiếu).
    """
    return DebtService.get_personal_debt(db=db, student_id=student_id)


@router.post(
    "/students/{student_id}/remind",
    response_model=RemindDebtResponse,
    status_code=status.HTTP_200_OK,
    summary="[Kế toán] Gửi thông báo nhắc nợ tới sinh viên",
)
def remind_student_debt(
    student_id: str,
    current_user: TaiKhoan = Depends(require_ke_toan),
    db: Session = Depends(get_db),
):
    """
    Dành riêng cho Kế toán.
    Gửi thông báo nhắc nợ tới sinh viên.
    """
    return DebtService.remind_student(db=db, student_id=student_id)
