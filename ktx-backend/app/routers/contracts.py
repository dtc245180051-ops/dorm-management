from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import RoleChecker, get_current_user
from app.schemas.contract import (
    HopDongDetailResponse,
    GiaHanHopDongRequest,
    ChamDutHopDongRequest,
)
from app.services import contract_service

router = APIRouter(prefix="/contracts", tags=["Quản lý Hợp đồng"])


@router.get(
    "/{ma_hop_dong}",
    response_model=HopDongDetailResponse,
    summary="Xem chi tiết hợp đồng thuê chỗ ở",
    dependencies=[Depends(get_current_user)],
)
def get_contract_detail(
    ma_hop_dong: str,
    db: Session = Depends(get_db),
):
    """Lấy chi tiết hợp đồng gồm thông tin sinh viên, phòng giường và tình trạng đóng phí."""
    return contract_service.get_contract_detail(db, ma_hop_dong)


@router.post(
    "/{ma_hop_dong}/renew",
    response_model=HopDongDetailResponse,
    summary="Gia hạn hợp đồng thuê phòng (Chỉ Quản Lý)",
    dependencies=[Depends(RoleChecker(["QuanLy"]))],
)
def renew_contract(
    ma_hop_dong: str,
    req: GiaHanHopDongRequest,
    db: Session = Depends(get_db),
):
    """Gia hạn thời gian hợp đồng thuê chỗ ở."""
    return contract_service.renew_contract(db, ma_hop_dong, req)


@router.post(
    "/{ma_hop_dong}/terminate",
    status_code=status.HTTP_200_OK,
    summary="Chấm dứt hợp đồng thuê phòng (Chỉ Quản Lý)",
    dependencies=[Depends(RoleChecker(["QuanLy"]))],
)
def terminate_contract(
    ma_hop_dong: str,
    req: ChamDutHopDongRequest,
    db: Session = Depends(get_db),
):
    """Chấm dứt hợp đồng và giải phóng giường."""
    return contract_service.terminate_contract(db, ma_hop_dong, req)
