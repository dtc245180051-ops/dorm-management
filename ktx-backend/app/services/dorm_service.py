import uuid
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.contract import HopDong
from app.models.dorm import Giuong, Phong, Tang, ToaNha
from app.schemas.dorm import (
    GiuongCreate,
    GiuongUpdateStatus,
    PhongCreate,
    PhongUpdate,
    RoomAvailableResponse,
    TangCreate,
    ToaNhaCreate,
)


# ==============================================================================
# QUẢN LÝ TÒA NHÀ (TOA NHA)
# ==============================================================================
def create_building(db: Session, building_in: ToaNhaCreate) -> ToaNha:
    """Tạo tòa nhà mới."""
    # Kiểm tra tên tòa nhà đã tồn tại chưa
    existing = db.query(ToaNha).filter(ToaNha.ten_toa == building_in.ten_toa).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tên tòa nhà '{building_in.ten_toa}' đã tồn tại.",
        )

    # Sinh mã tòa nếu chưa có
    ma_toa = building_in.ma_toa
    if not ma_toa:
        cleaned_name = "".join(c for c in building_in.ten_toa if c.isalnum() or c == "_").upper()
        ma_toa = f"TOA_{cleaned_name}"[:10]

    # Đảm bảo mã tòa là duy nhất
    if db.query(ToaNha).filter(ToaNha.ma_toa == ma_toa).first():
        ma_toa = f"T_{uuid.uuid4().hex[:8].upper()}"

    building = ToaNha(ma_toa=ma_toa, ten_toa=building_in.ten_toa)
    db.add(building)
    db.commit()
    db.refresh(building)
    return building


def get_buildings(db: Session) -> List[ToaNha]:
    """Lấy danh sách tất cả các tòa nhà kèm danh sách tầng và phòng."""
    return (
        db.query(ToaNha)
        .options(
            joinedload(ToaNha.tangs).joinedload(Tang.phongs).joinedload(Phong.giuongs)
        )
        .all()
    )


def get_building_by_id(db: Session, ma_toa: str) -> ToaNha:
    """Lấy thông tin chi tiết một tòa nhà theo mã."""
    building = (
        db.query(ToaNha)
        .options(
            joinedload(ToaNha.tangs).joinedload(Tang.phongs).joinedload(Phong.giuongs)
        )
        .filter(ToaNha.ma_toa == ma_toa)
        .first()
    )
    if not building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tòa nhà với mã '{ma_toa}'.",
        )
    return building


def delete_building(db: Session, ma_toa: str) -> None:
    """Xóa tòa nhà nếu không có hợp đồng hoạt động trong các phòng."""
    building = get_building_by_id(db, ma_toa)

    # Kiểm tra xem có hợp đồng ACTIVE trong tòa nhà không
    for tang in building.tangs:
        for phong in tang.phongs:
            active_contract = (
                db.query(HopDong)
                .join(Giuong)
                .filter(Giuong.ma_phong == phong.ma_phong, HopDong.trang_thai == "ACTIVE")
                .first()
            )
            if active_contract:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Không thể xóa tòa nhà '{ma_toa}' vì có hợp đồng đang hoạt động trong phòng {phong.so_phong}.",
                )

    db.delete(building)
    db.commit()


# ==============================================================================
# QUẢN LÝ TẦNG (TANG)
# ==============================================================================
def create_floor(db: Session, floor_in: TangCreate) -> Tang:
    """Tạo tầng mới thuộc một tòa nhà."""
    # Kiểm tra tòa nhà có tồn tại không
    building = db.query(ToaNha).filter(ToaNha.ma_toa == floor_in.ma_toa).first()
    if not building:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tòa nhà có mã '{floor_in.ma_toa}'.",
        )

    # Kiểm tra tầng đã tồn tại trong tòa này chưa
    existing = (
        db.query(Tang)
        .filter(Tang.ma_toa == floor_in.ma_toa, Tang.so_tang == floor_in.so_tang)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tầng {floor_in.so_tang} đã tồn tại trong tòa nhà '{floor_in.ma_toa}'.",
        )

    ma_tang = floor_in.ma_tang or f"{floor_in.ma_toa[:8]}_T{floor_in.so_tang}"[:15]
    floor = Tang(ma_tang=ma_tang, so_tang=floor_in.so_tang, ma_toa=floor_in.ma_toa)
    db.add(floor)
    db.commit()
    db.refresh(floor)
    return floor


def get_floors(db: Session, ma_toa: Optional[str] = None) -> List[Tang]:
    """Lấy danh sách tầng, có thể lọc theo tòa nhà."""
    query = db.query(Tang).options(joinedload(Tang.phongs).joinedload(Phong.giuongs))
    if ma_toa:
        query = query.filter(Tang.ma_toa == ma_toa)
    return query.all()


# ==============================================================================
# QUẢN LÝ PHÒNG (PHONG) & TỰ ĐỘNG TẠO GIƯỜNG (GIUONG)
# ==============================================================================
def create_room(db: Session, room_in: PhongCreate) -> Phong:
    """
    Tạo phòng mới và tự động sinh số lượng giường tương ứng với suc_chua (trạng thái 'TRONG').
    Ràng buộc: Không được trùng so_phong trong cùng một Tang.
    """
    # 1. Kiểm tra tầng có tồn tại không
    floor = db.query(Tang).filter(Tang.ma_tang == room_in.ma_tang).first()
    if not floor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy tầng có mã '{room_in.ma_tang}'.",
        )

    # 2. Kiểm tra trùng số phòng trong cùng tầng
    existing_room = (
        db.query(Phong)
        .filter(Phong.ma_tang == room_in.ma_tang, Phong.so_phong == room_in.so_phong)
        .first()
    )
    if existing_room:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Số phòng '{room_in.so_phong}' đã tồn tại trong tầng này.",
        )

    # 3. Tạo mã phòng duy nhất nếu chưa có (giữ độ dài <= 15 ký tự để đủ chỗ cho mã giường)
    ma_phong = room_in.ma_phong
    if not ma_phong:
        ma_phong = f"{room_in.ma_tang[:8]}_P{room_in.so_phong}"[:15]
        if db.query(Phong).filter(Phong.ma_phong == ma_phong).first():
            ma_phong = f"P_{uuid.uuid4().hex[:10].upper()}"[:15]

    # 4. Lưu thực thể Phong
    room = Phong(
        ma_phong=ma_phong,
        so_phong=room_in.so_phong,
        suc_chua=room_in.suc_chua,
        loai_phong=room_in.loai_phong,
        hinh_anh=room_in.hinh_anh,
        ma_tang=room_in.ma_tang,
    )
    db.add(room)
    db.flush()

    # 5. Tự động sinh danh sách Giuong (1 đến suc_chua) với trạng thái 'TRONG'
    for i in range(1, room_in.suc_chua + 1):
        suffix = f"_G{i:02d}"
        prefix_len = 20 - len(suffix)
        ma_giuong = f"{room.ma_phong[:prefix_len]}{suffix}"
        bed = Giuong(
            ma_giuong=ma_giuong,
            trang_thai="TRONG",
            ma_phong=room.ma_phong,
        )
        db.add(bed)

    db.commit()
    db.refresh(room)
    return room


def get_room_by_id(db: Session, ma_phong: str) -> Phong:
    """Lấy chi tiết phòng và danh sách giường."""
    room = (
        db.query(Phong)
        .options(joinedload(Phong.giuongs))
        .filter(Phong.ma_phong == ma_phong)
        .first()
    )
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy phòng với mã '{ma_phong}'.",
        )
    return room


def get_rooms(
    db: Session,
    ma_tang: Optional[str] = None,
    loai_phong: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Phong]:
    """Lấy danh sách các phòng kèm giường có phân trang."""
    query = db.query(Phong).options(joinedload(Phong.giuongs))
    if ma_tang:
        query = query.filter(Phong.ma_tang == ma_tang)
    if loai_phong:
        query = query.filter(Phong.loai_phong == loai_phong)
    return query.offset(skip).limit(limit).all()


def update_room(db: Session, ma_phong: str, room_in: PhongUpdate) -> Phong:
    """Cập nhật thông tin phòng."""
    room = get_room_by_id(db, ma_phong)

    # Nếu cập nhật số phòng hoặc tầng, kiểm tra trùng lặp
    target_tang = room_in.ma_tang if room_in.ma_tang is not None else room.ma_tang
    target_so_phong = room_in.so_phong if room_in.so_phong is not None else room.so_phong

    if (target_tang != room.ma_tang) or (target_so_phong != room.so_phong):
        existing = (
            db.query(Phong)
            .filter(
                Phong.ma_tang == target_tang,
                Phong.so_phong == target_so_phong,
                Phong.ma_phong != ma_phong,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Số phòng '{target_so_phong}' đã tồn tại trong tầng đích.",
            )

    update_data = room_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(room, field, val)

    # Đồng bộ số lượng giường nếu sức chứa thay đổi
    if room_in.suc_chua is not None:
        target_capacity = room_in.suc_chua
        current_beds = list(room.giuongs or [])
        if len(current_beds) < target_capacity:
            for i in range(len(current_beds) + 1, target_capacity + 1):
                suffix = f"_G{i:02d}"
                prefix_len = 20 - len(suffix)
                ma_giuong = f"{room.ma_phong[:prefix_len]}{suffix}"
                if not any(g.ma_giuong == ma_giuong for g in current_beds):
                    bed = Giuong(
                        ma_giuong=ma_giuong,
                        trang_thai="TRONG",
                        ma_phong=room.ma_phong,
                    )
                    db.add(bed)

    db.commit()
    db.refresh(room)
    return room


def delete_room(db: Session, ma_phong: str) -> None:
    """
    Xóa phòng và các giường thuộc phòng.
    Ràng buộc: Không được phép xóa nếu đang có hợp đồng ACTIVE.
    """
    room = get_room_by_id(db, ma_phong)

    # Kiểm tra xem có giường nào đang gắn với hợp đồng ACTIVE không
    active_contract = (
        db.query(HopDong)
        .join(Giuong)
        .filter(Giuong.ma_phong == ma_phong, HopDong.trang_thai == "ACTIVE")
        .first()
    )
    if active_contract:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể xóa phòng '{room.so_phong}' vì đang có hợp đồng thuê hoạt động.",
        )

    db.delete(room)
    db.commit()


# ==============================================================================
# NGHIỆP VỤ TRA CỨU CHỖ TRỐNG (PHỤC VỤ AI GỢI Ý XẾP PHÒNG)
# ==============================================================================
def get_available_beds(
    db: Session,
    gender: Optional[str] = None,
    building_id: Optional[str] = None,
) -> List[RoomAvailableResponse]:
    """
    Truy vấn danh sách phòng và giường còn trống ('TRONG').
    Hỗ trợ lọc theo giới tính/loại phòng (gender) và mã tòa (building_id).
    """
    query = (
        db.query(Phong)
        .join(Tang, Phong.ma_tang == Tang.ma_tang)
        .join(ToaNha, Tang.ma_toa == ToaNha.ma_toa)
        .options(joinedload(Phong.giuongs), joinedload(Phong.tang).joinedload(Tang.toa_nha))
    )

    if gender:
        query = query.filter(Phong.loai_phong.ilike(f"%{gender}%"))
    if building_id:
        query = query.filter(Tang.ma_toa == building_id)

    rooms = query.all()
    results: List[RoomAvailableResponse] = []

    for room in rooms:
        empty_beds = [bed for bed in room.giuongs if bed.trang_thai == "TRONG"]
        if empty_beds:
            results.append(
                RoomAvailableResponse(
                    ma_phong=room.ma_phong,
                    so_phong=room.so_phong,
                    loai_phong=room.loai_phong,
                    suc_chua=room.suc_chua,
                    hinh_anh=room.hinh_anh,
                    ma_tang=room.ma_tang,
                    so_tang=room.tang.so_tang if room.tang else None,
                    ma_toa=room.tang.ma_toa if room.tang else None,
                    ten_toa=room.tang.toa_nha.ten_toa if (room.tang and room.tang.toa_nha) else None,
                    so_giuong_trong=len(empty_beds),
                    danh_sach_giuong_trong=empty_beds,
                )
            )

    return results


# ==============================================================================
# QUẢN LÝ TRẠNG THÁI GIƯỜNG (GIUONG)
# ==============================================================================
def update_bed_status(db: Session, ma_giuong: str, status_in: GiuongUpdateStatus) -> Giuong:
    """Cập nhật trạng thái giường (TRONG, DA_THUE, BAO_TRI)."""
    bed = db.query(Giuong).filter(Giuong.ma_giuong == ma_giuong).first()
    if not bed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy giường có mã '{ma_giuong}'.",
        )

    # Nếu đổi từ trạng thái khác sang TRONG hoặc BAO_TRI mà đang có hợp đồng ACTIVE thì cảnh báo/chặn
    if status_in.trang_thai in ["TRONG", "BAO_TRI"]:
        active_contract = (
            db.query(HopDong)
            .filter(HopDong.ma_giuong == ma_giuong, HopDong.trang_thai == "ACTIVE")
            .first()
        )
        if active_contract and status_in.trang_thai == "TRONG":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Giường '{ma_giuong}' đang có hợp đồng hoạt động (ACTIVE), không thể chuyển sang TRONG.",
            )

    bed.trang_thai = status_in.trang_thai
    db.commit()
    db.refresh(bed)
    return bed
