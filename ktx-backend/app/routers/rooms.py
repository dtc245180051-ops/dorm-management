from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import RoleChecker, get_current_user
from app.models.user import TaiKhoan
from app.schemas.dorm import (
    GiuongResponse,
    GiuongUpdateStatus,
    PhongCreate,
    PhongResponse,
    PhongUpdate,
    RoomAvailableResponse,
    TangCreate,
    TangResponse,
    ToaNhaCreate,
    ToaNhaResponse,
)
from app.services import dorm_service

router = APIRouter(prefix="/rooms", tags=["Quản lý Cơ sở vật chất & Phòng"])


# ==============================================================================
# QUẢN LÝ TÒA NHÀ (BUILDINGS)
# ==============================================================================
@router.post(
    "/buildings",
    response_model=ToaNhaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo tòa nhà mới (Chỉ Quản Lý)",
    dependencies=[Depends(RoleChecker(["QuanLy"]))],
)
def create_building(
    building_in: ToaNhaCreate,
    db: Session = Depends(get_db),
):
    return dorm_service.create_building(db, building_in)


@router.get(
    "/buildings",
    response_model=List[ToaNhaResponse],
    summary="Lấy danh sách tất cả các tòa nhà kèm tầng & phòng",
    dependencies=[Depends(get_current_user)],
)
def get_buildings(
    db: Session = Depends(get_db),
):
    return dorm_service.get_buildings(db)


@router.get(
    "/buildings/{ma_toa}",
    response_model=ToaNhaResponse,
    summary="Lấy thông tin chi tiết một tòa nhà",
    dependencies=[Depends(get_current_user)],
)
def get_building_by_id(
    ma_toa: str,
    db: Session = Depends(get_db),
):
    return dorm_service.get_building_by_id(db, ma_toa)


@router.delete(
    "/buildings/{ma_toa}",
    status_code=status.HTTP_200_OK,
    summary="Xóa tòa nhà (Chỉ Quản Lý)",
    dependencies=[Depends(RoleChecker(["QuanLy"]))],
)
def delete_building(
    ma_toa: str,
    db: Session = Depends(get_db),
):
    dorm_service.delete_building(db, ma_toa)
    return {"status": "success", "message": f"Đã xóa tòa nhà '{ma_toa}'."}


# ==============================================================================
# QUẢN LÝ TẦNG (FLOORS)
# ==============================================================================
@router.post(
    "/floors",
    response_model=TangResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo tầng mới thuộc tòa nhà (Chỉ Quản Lý)",
    dependencies=[Depends(RoleChecker(["QuanLy"]))],
)
def create_floor(
    floor_in: TangCreate,
    db: Session = Depends(get_db),
):
    return dorm_service.create_floor(db, floor_in)


@router.get(
    "/floors",
    response_model=List[TangResponse],
    summary="Lấy danh sách các tầng",
    dependencies=[Depends(get_current_user)],
)
def get_floors(
    ma_toa: Optional[str] = Query(None, description="Lọc theo mã tòa nhà"),
    db: Session = Depends(get_db),
):
    return dorm_service.get_floors(db, ma_toa=ma_toa)


# ==============================================================================
# QUẢN LÝ PHÒNG & GIƯỜNG (ROOMS & BEDS)
# ==============================================================================
@router.post(
    "/",
    response_model=PhongResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tạo phòng mới và tự động sinh danh sách giường (Chỉ Quản Lý)",
    dependencies=[Depends(RoleChecker(["QuanLy"]))],
)
def create_room(
    room_in: PhongCreate,
    db: Session = Depends(get_db),
):
    """
    Tạo phòng mới:
    - Ràng buộc: Số phòng không được trùng trong cùng một tầng.
    - Tự động tạo 'suc_chua' giường có trạng thái 'TRONG'.
    """
    return dorm_service.create_room(db, room_in)


@router.get(
    "/available",
    response_model=List[RoomAvailableResponse],
    summary="Tra cứu phòng & giường còn trống (Phục vụ AI gợi ý xếp phòng)",
    dependencies=[Depends(get_current_user)],
)
def get_available_rooms(
    gender: Optional[str] = Query(None, description="Lọc theo giới tính/loại phòng: Nam, Nu"),
    building_id: Optional[str] = Query(None, description="Lọc theo mã tòa nhà"),
    db: Session = Depends(get_db),
):
    """
    Truy vấn danh sách phòng và giường còn trống ('TRONG').
    Phục vụ trực tiếp cho người dùng tra cứu và module AI xếp phòng.
    """
    return dorm_service.get_available_beds(db, gender=gender, building_id=building_id)


@router.get(
    "/{ma_phong}",
    response_model=PhongResponse,
    summary="Lấy thông tin chi tiết phòng và danh sách giường",
    dependencies=[Depends(get_current_user)],
)
def get_room_detail(
    ma_phong: str,
    db: Session = Depends(get_db),
):
    return dorm_service.get_room_by_id(db, ma_phong)


@router.put(
    "/{ma_phong}",
    response_model=PhongResponse,
    summary="Sửa thông tin phòng (Chỉ Quản Lý)",
    dependencies=[Depends(RoleChecker(["QuanLy"]))],
)
def update_room(
    ma_phong: str,
    room_in: PhongUpdate,
    db: Session = Depends(get_db),
):
    return dorm_service.update_room(db, ma_phong, room_in)


@router.delete(
    "/{ma_phong}",
    status_code=status.HTTP_200_OK,
    summary="Xóa phòng (Chỉ Quản Lý)",
    dependencies=[Depends(RoleChecker(["QuanLy"]))],
)
def delete_room(
    ma_phong: str,
    db: Session = Depends(get_db),
):
    """
    Xóa phòng:
    - Ràng buộc: Chặn xóa nếu phòng có hợp đồng ACTIVE.
    """
    dorm_service.delete_room(db, ma_phong)
    return {"status": "success", "message": f"Đã xóa thành công phòng '{ma_phong}'."}


@router.put(
    "/beds/{ma_giuong}/status",
    response_model=GiuongResponse,
    summary="Cập nhật trạng thái của giường (Chỉ Quản Lý)",
    dependencies=[Depends(RoleChecker(["QuanLy"]))],
)
def update_bed_status(
    ma_giuong: str,
    status_in: GiuongUpdateStatus,
    db: Session = Depends(get_db),
):
    return dorm_service.update_bed_status(db, ma_giuong, status_in)
