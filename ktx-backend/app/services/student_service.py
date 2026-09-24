from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_password_hash
from app.models.contract import HopDong
from app.models.dorm import Giuong, Phong, Tang, ToaNha
from app.models.user import NguoiDung, SinhVien, TaiKhoan, VaiTro
from app.schemas.student import (
    SinhVienCreate,
    SinhVienResponse,
    SinhVienUpdate,
    ThongTinPhongHienTai,
)


def _build_student_response(student: SinhVien, db: Session) -> SinhVienResponse:
    """Hàm phụ trợ xây dựng SinhVienResponse kèm thông tin phòng hiện tại nếu có hợp đồng ACTIVE."""
    current_room_info: Optional[ThongTinPhongHienTai] = None

    # Tìm hợp đồng ACTIVE gần nhất
    active_contract = (
        db.query(HopDong)
        .options(
            joinedload(HopDong.giuong)
            .joinedload(Giuong.phong)
            .joinedload(Phong.tang)
            .joinedload(Tang.toa_nha)
        )
        .filter(HopDong.msv == student.msv, HopDong.trang_thai == "ACTIVE")
        .first()
    )

    if active_contract and active_contract.giuong and active_contract.giuong.phong:
        bed = active_contract.giuong
        room = bed.phong
        floor = room.tang
        building = floor.toa_nha if floor else None

        current_room_info = ThongTinPhongHienTai(
            ma_hop_dong=active_contract.ma_hop_dong,
            ma_giuong=bed.ma_giuong,
            ma_phong=room.ma_phong,
            so_phong=room.so_phong,
            ten_toa=building.ten_toa if building else None,
            so_tang=floor.so_tang if floor else None,
            ngay_bat_dau=str(active_contract.ngay_bat_dau) if active_contract.ngay_bat_dau else None,
            ngay_ket_thuc=str(active_contract.ngay_ket_thuc) if active_contract.ngay_ket_thuc else None,
        )

    user_info = student.nguoi_dung
    return SinhVienResponse(
        msv=student.msv,
        ho_ten=user_info.ho_ten if user_info else "",
        email=user_info.email if user_info else None,
        so_dien_thoai=user_info.so_dien_thoai if user_info else None,
        lop=student.lop,
        gioi_tinh=student.gioi_tinh,
        thong_tin_phong_hien_tai=current_room_info,
    )


def create_student(db: Session, student_in: SinhVienCreate) -> SinhVienResponse:
    """
    Tạo mới sinh viên, liên kết đồng thời tài khoản (TaiKhoan với vai trò SinhVien) và người dùng (NguoiDung).
    Ràng buộc: msv là duy nhất.
    """
    # 1. Kiểm tra MSV đã tồn tại chưa
    if db.query(SinhVien).filter(SinhVien.msv == student_in.msv).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Mã số sinh viên '{student_in.msv}' đã tồn tại trong hệ thống.",
        )

    # 2. Kiểm tra tên đăng nhập (dùng chính MSV)
    if db.query(TaiKhoan).filter(TaiKhoan.ten_dang_nhap == student_in.msv).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tên đăng nhập '{student_in.msv}' đã được sử dụng.",
        )

    # 3. Kiểm tra email nếu có
    if student_in.email:
        if db.query(NguoiDung).filter(NguoiDung.email == student_in.email).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{student_in.email}' đã được đăng ký trong hệ thống.",
            )

    # 4. Mật khẩu khởi tạo: Lấy theo dữ liệu gửi lên hoặc mặc định là MSV
    raw_password = student_in.mat_khau_khoi_tao or student_in.msv
    hashed_password = get_password_hash(raw_password)

    # 5. Tạo TaiKhoan
    account = TaiKhoan(
        ten_dang_nhap=student_in.msv,
        mat_khau=hashed_password,
        vai_tro=VaiTro.SINH_VIEN,
    )
    db.add(account)
    db.flush()

    # 6. Tạo NguoiDung
    user = NguoiDung(
        ma_tai_khoan=account.ma_tai_khoan,
        ho_ten=student_in.ho_ten,
        email=student_in.email,
        so_dien_thoai=student_in.so_dien_thoai,
    )
    db.add(user)
    db.flush()

    # 7. Tạo SinhVien
    student = SinhVien(
        msv=student_in.msv,
        ma_nguoi_dung=user.ma_nguoi_dung,
        lop=student_in.lop,
        gioi_tinh=student_in.gioi_tinh,
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    return _build_student_response(student, db)


def get_students(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    search_keyword: Optional[str] = None,
) -> List[SinhVienResponse]:
    """Lấy danh sách sinh viên có tìm kiếm theo MSV, họ tên, lớp và hỗ trợ phân trang."""
    query = (
        db.query(SinhVien)
        .join(NguoiDung, SinhVien.ma_nguoi_dung == NguoiDung.ma_nguoi_dung)
        .options(joinedload(SinhVien.nguoi_dung))
    )

    if search_keyword:
        kw = f"%{search_keyword.strip()}%"
        query = query.filter(
            or_(
                SinhVien.msv.ilike(kw),
                SinhVien.lop.ilike(kw),
                NguoiDung.ho_ten.ilike(kw),
                NguoiDung.email.ilike(kw),
            )
        )

    students = query.offset(skip).limit(limit).all()
    return [_build_student_response(sv, db) for sv in students]


def get_student_by_msv(db: Session, msv: str) -> SinhVienResponse:
    """Lấy chi tiết một sinh viên theo MSV."""
    student = (
        db.query(SinhVien)
        .options(joinedload(SinhVien.nguoi_dung))
        .filter(SinhVien.msv == msv)
        .first()
    )
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy sinh viên có MSV '{msv}'.",
        )
    return _build_student_response(student, db)


def update_student(
    db: Session,
    msv: str,
    update_data: SinhVienUpdate,
) -> SinhVienResponse:
    """Cập nhật thông tin sinh viên và người dùng liên quan."""
    student = (
        db.query(SinhVien)
        .options(joinedload(SinhVien.nguoi_dung))
        .filter(SinhVien.msv == msv)
        .first()
    )
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy sinh viên có MSV '{msv}'.",
        )

    # Cập nhật thông tin NguoiDung
    user = student.nguoi_dung
    if user:
        if update_data.ho_ten is not None:
            user.ho_ten = update_data.ho_ten
        if update_data.so_dien_thoai is not None:
            user.so_dien_thoai = update_data.so_dien_thoai
        if update_data.email is not None:
            # Kiểm tra email trùng với người dùng khác
            existing_email = (
                db.query(NguoiDung)
                .filter(
                    NguoiDung.email == update_data.email,
                    NguoiDung.ma_nguoi_dung != user.ma_nguoi_dung,
                )
                .first()
            )
            if existing_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email '{update_data.email}' đã được sử dụng.",
                )
            user.email = update_data.email

    # Cập nhật thông tin SinhVien
    if update_data.lop is not None:
        student.lop = update_data.lop
    if update_data.gioi_tinh is not None:
        student.gioi_tinh = update_data.gioi_tinh

    db.commit()
    db.refresh(student)
    return _build_student_response(student, db)


def delete_student(db: Session, msv: str) -> None:
    """
    Xóa hồ sơ sinh viên.
    Ràng buộc: Không được xóa nếu đang có hợp đồng ACTIVE.
    Xóa TaiKhoan sẽ tự động cascade xóa NguoiDung và SinhVien.
    """
    student = (
        db.query(SinhVien)
        .options(joinedload(SinhVien.nguoi_dung))
        .filter(SinhVien.msv == msv)
        .first()
    )
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy sinh viên có MSV '{msv}'.",
        )

    active_contract = (
        db.query(HopDong)
        .filter(HopDong.msv == msv, HopDong.trang_thai == "ACTIVE")
        .first()
    )
    if active_contract:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể xóa sinh viên '{msv}' vì đang có hợp đồng lưu trú ACTIVE.",
        )

    user = student.nguoi_dung
    account = user.tai_khoan if user else None

    # Xóa từ TaiKhoan để cascade toàn bộ hoặc xóa trực tiếp student
    if account:
        db.delete(account)
    elif user:
        db.delete(user)
    else:
        db.delete(student)

    db.commit()
