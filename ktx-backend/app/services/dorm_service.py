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
    ToaNhaUpdate,
)


# ==============================================================================
# QUẢN LÝ TÒA NHÀ (TOA NHA)
# ==============================================================================
def create_building(db: Session, building_in: ToaNhaCreate) -> ToaNha:
    """Tạo tòa nhà mới, tự động chuẩn hóa tên tòa và mã tòa, hỗ trợ phân loại nam/nữ."""
    raw_name = building_in.ten_toa.strip()

    # Chuẩn hóa tên hiển thị: nếu chưa có chữ 'Tòa' thì tự động thêm
    if raw_name.lower().startswith("tòa ") or raw_name.lower().startswith("toa "):
        ten_toa = raw_name
        base_code = raw_name.split(" ", 1)[1].strip().upper()
    else:
        ten_toa = f"Tòa {raw_name}"
        base_code = raw_name.strip().upper()

    # Mã tòa: nếu người dùng không truyền thì lấy chính tên tòa vừa nhập (ví dụ: A7, B2)
    ma_toa = building_in.ma_toa.strip().upper() if building_in.ma_toa else base_code

    # Phân loại giới tính tòa: Nam, Nữ, Nam & Nữ
    gioi_tinh = building_in.gioi_tinh or "Nam & Nữ"

    # Số tầng của tòa nhà (mặc định 5 tầng nếu không nhập hoặc không hợp lệ)
    so_tang = getattr(building_in, 'so_tang', 5) or 5
    if so_tang <= 0:
        so_tang = 5

    # Kiểm tra mã tòa đã tồn tại chưa
    existing_code = db.query(ToaNha).filter(ToaNha.ma_toa == ma_toa).first()
    if existing_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Mã tòa nhà '{ma_toa}' đã tồn tại.",
        )

    # Kiểm tra tên tòa nhà đã tồn tại chưa
    existing = db.query(ToaNha).filter(ToaNha.ten_toa == ten_toa).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tên tòa nhà '{ten_toa}' đã tồn tại.",
        )

    building = ToaNha(ma_toa=ma_toa, ten_toa=ten_toa, gioi_tinh=gioi_tinh, so_tang=so_tang)
    db.add(building)
    db.flush()

    # Tự động tạo các tầng tương ứng cho tòa nhà mới
    for floor_num in range(1, so_tang + 1):
        ma_tang = f"{ma_toa}_T{floor_num}"
        db.add(Tang(ma_tang=ma_tang, so_tang=floor_num, ma_toa=ma_toa))

    db.commit()
    return get_building_by_id(db, ma_toa)


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


def update_building(db: Session, ma_toa: str, building_in: ToaNhaUpdate) -> ToaNha:
    """Cập nhật thông tin tòa nhà (tên tòa, giới tính, số tầng)."""
    building = get_building_by_id(db, ma_toa)

    if building_in.ten_toa is not None:
        raw_name = building_in.ten_toa.strip()
        if raw_name.lower().startswith("tòa "):
            ten_toa = raw_name
        else:
            ten_toa = f"Tòa {raw_name}"

        # Kiểm tra trùng tên tòa
        existing = (
            db.query(ToaNha)
            .filter(ToaNha.ten_toa == ten_toa, ToaNha.ma_toa != ma_toa)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tên tòa nhà '{ten_toa}' đã được sử dụng.",
            )
        building.ten_toa = ten_toa

    if building_in.gioi_tinh is not None:
        building.gioi_tinh = building_in.gioi_tinh

    if building_in.so_tang is not None:
        if building_in.so_tang <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số tầng của tòa nhà phải lớn hơn 0.",
            )
        # Ràng buộc: Số tầng mới không được nhỏ hơn số tầng cao nhất đang có phòng trong tòa
        max_existing_floor = 0
        for tang in building.tangs:
            if tang.phongs and tang.so_tang > max_existing_floor:
                max_existing_floor = tang.so_tang
        if building_in.so_tang < max_existing_floor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể giảm số tầng xuống {building_in.so_tang} vì tòa nhà đang có phòng ở tầng {max_existing_floor}.",
            )
        building.so_tang = building_in.so_tang

    db.commit()
    return get_building_by_id(db, building.ma_toa)


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

    # Kiểm tra số tầng có vượt quá tổng số tầng của tòa nhà không
    max_floors = building.so_tang or 5
    if floor_in.so_tang > max_floors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tòa nhà '{building.ten_toa}' chỉ có tối đa {max_floors} tầng. Không thể thêm tầng {floor_in.so_tang}.",
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
        gia_tien_nam=room_in.gia_tien_nam,
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
    """Lấy chi tiết phòng và danh sách giường kèm thông tin sinh viên và tòa nhà."""
    from app.models.user import SinhVien
    room = (
        db.query(Phong)
        .options(
            joinedload(Phong.tang).joinedload(Tang.toa_nha),
            joinedload(Phong.giuongs)
            .joinedload(Giuong.hop_dongs)
            .joinedload(HopDong.sinh_vien)
            .joinedload(SinhVien.nguoi_dung),
        )
        .filter(Phong.ma_phong == ma_phong)
        .first()
    )
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy phòng với mã '{ma_phong}'.",
        )

    # Đếm số giường trống và đã ở
    so_trong = sum(1 for g in room.giuongs if g.trang_thai == "TRONG")
    room.so_giuong_trong = so_trong
    room.so_giuong_da_o = len(room.giuongs) - so_trong

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
        # Đếm số người ở hiện tại (giường không TRONG hoặc có hợp đồng ACTIVE)
        occupied_beds = [
            g for g in current_beds
            if g.trang_thai != "TRONG" or any(h.trang_thai == "ACTIVE" for h in (g.hop_dongs or []))
        ]
        if target_capacity < len(occupied_beds):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể giảm số giường về {target_capacity} vì phòng hiện đang có {len(occupied_beds)} người đang ở.",
            )

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
        elif len(current_beds) > target_capacity:
            # Thu hồi bớt các giường trống ở cuối danh sách
            beds_to_remove = len(current_beds) - target_capacity
            empty_beds = [
                g for g in reversed(current_beds)
                if g.trang_thai == "TRONG" and not any(h.trang_thai == "ACTIVE" for h in (g.hop_dongs or []))
            ]
            for bed in empty_beds[:beds_to_remove]:
                db.delete(bed)

    db.commit()
    db.refresh(room)
    return room


def delete_room(db: Session, ma_phong: str) -> None:
    """
    Xóa phòng và các giường thuộc phòng.
    Ràng buộc: Không được phép xóa nếu phòng vẫn có người ở hoặc đang có hợp đồng ACTIVE.
    """
    room = get_room_by_id(db, ma_phong)

    # 1. Kiểm tra xem có giường nào đang có người ở (trạng thái != 'TRONG')
    occupied_bed = (
        db.query(Giuong)
        .filter(Giuong.ma_phong == ma_phong, Giuong.trang_thai != "TRONG")
        .first()
    )
    # 2. Kiểm tra xem có hợp đồng nào đang ACTIVE trên các giường của phòng
    active_contract = (
        db.query(HopDong)
        .join(Giuong, HopDong.ma_giuong == Giuong.ma_giuong)
        .filter(Giuong.ma_phong == ma_phong, HopDong.trang_thai == "ACTIVE")
        .first()
    )
    if occupied_bed or active_contract:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể xóa phòng '{room.so_phong}' vì hiện tại phòng vẫn đang có người ở hoặc hợp đồng hiệu lực.",
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
                    gia_tien_nam=room.gia_tien_nam,
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
            active_contract.trang_thai = "TERMINATED"

    bed.trang_thai = status_in.trang_thai
    db.commit()
    db.refresh(bed)
    return bed
