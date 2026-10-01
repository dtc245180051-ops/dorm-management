from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_ke_toan
from app.models.user import TaiKhoan
from app.models.invoice import HoaDon
from app.schemas.financial import DashboardResponse, FinancialReportResponse
from app.services.financial_service import FinancialService

router = APIRouter(prefix="/finance", tags=["Tài chính & Báo cáo (Kế toán)"])


@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    summary="[Kế toán] Lấy số liệu Dashboard tài chính & đối soát",
)
def get_financial_dashboard(
    current_user: TaiKhoan = Depends(require_ke_toan),
    db: Session = Depends(get_db),
):
    """
    Trả về dữ liệu tổng quan cho Dashboard Kế toán:
    - 4 KPI cards: Doanh thu phát hành, Thực thu quỹ, Còn nợ tồn đọng, Tỷ lệ đối soát.
    - Xu hướng doanh thu theo tháng (Phòng vs Điện nước).
    - Phân bổ theo 2 loại phòng niêm yết (Tiêu chuẩn 350k, Dịch vụ 650k).
    - Tỷ lệ đối soát ngân hàng (Tự động, Thủ công, Sai cú pháp, Thiếu tiền).
    - Top giao dịch ngân hàng mới nhất.
    """
    return FinancialService.get_dashboard_data(db=db)


@router.get(
    "/report",
    response_model=FinancialReportResponse,
    summary="[Kế toán] Lấy báo cáo tài chính chi tiết theo kỳ & bộ lọc",
)
def get_financial_report(
    thang: Optional[str] = Query(None, description="Kỳ thanh toán, ví dụ 'Tháng 09/2026' hoặc 'ALL'"),
    loai_hoa_don: Optional[str] = Query(None, description="TIEN_PHONG hoặc DIEN_NUOC hoặc 'ALL'"),
    trang_thai: Optional[str] = Query(None, description="PAID, UNPAID, OVERDUE hoặc 'ALL'"),
    keyword: Optional[str] = Query(None, description="Tìm theo mã HĐ, mã SV, họ tên, phòng"),
    current_user: TaiKhoan = Depends(require_ke_toan),
    db: Session = Depends(get_db),
):
    """
    Báo cáo tài chính kế toán KTX chi tiết:
    - Bảng kê chứng từ, hóa đơn, số tiền phải thu, đã thu, còn nợ.
    - Tổng hợp doanh thu phòng tiêu chuẩn (350k), phòng dịch vụ (650k), điện nước.
    - Hỗ trợ xuất file Excel / CSV.
    """
    return FinancialService.get_financial_report(
        db=db,
        thang=thang,
        loai_hoa_don=loai_hoa_don,
        trang_thai=trang_thai,
        keyword=keyword,
    )


@router.get(
    "/periods",
    response_model=List[str],
    summary="[Kế toán] Lấy danh sách các kỳ thanh toán có trong hệ thống",
)
def get_financial_periods(
    current_user: TaiKhoan = Depends(require_ke_toan),
    db: Session = Depends(get_db),
):
    periods = db.query(HoaDon.ky_thanh_toan).distinct().all()
    cleaned = sorted(list(set(p[0] for p in periods if p[0])))
    return cleaned
