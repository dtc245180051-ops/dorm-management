from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import RoleChecker, get_current_user
from app.models.user import TaiKhoan
from app.schemas.student import (
    SinhVienCreate,
    SinhVienResponse,
    SinhVienUpdate,
    StudentStatsResponse,
)
from app.services import student_service

router = APIRouter(prefix="/students", tags=["Quản lý Sinh viên"])


@router.post(
    "/",
    response_model=SinhVienResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tiếp nhận hồ sơ sinh viên mới (Chỉ Quản Lý)",
    dependencies=[Depends(RoleChecker(["QuanLy"]))],
)
def create_student(
    student_in: SinhVienCreate,
    db: Session = Depends(get_db),
):
    """
    Tạo hồ sơ sinh viên mới:
    - Tạo TaiKhoan (vai trò SinhVien) với mật khẩu mặc định (hoặc tùy chọn).
    - Tạo NguoiDung.
    - Tạo SinhVien (ràng buộc MSV duy nhất).
    - Tùy chọn chỉ định phòng & giường, tự động tạo hợp đồng và đánh dấu giường đã có người ở.
    """
    return student_service.create_student(db, student_in)


@router.get(
    "/stats",
    response_model=StudentStatsResponse,
    summary="Thống kê số lượng sinh viên theo trạng thái ở",
    dependencies=[Depends(RoleChecker(["QuanLy", "KeToan"]))],
)
def get_student_stats(
    db: Session = Depends(get_db),
):
    """Lấy số lượng tổng, đang ở và chưa xếp phòng để hiển thị trên các thẻ tab."""
    return student_service.get_student_stats(db)


@router.get(
    "/",
    response_model=List[SinhVienResponse],
    summary="Danh sách sinh viên có phân trang, bộ lọc & tìm kiếm (Quản Lý & Kế Toán)",
    dependencies=[Depends(RoleChecker(["QuanLy", "KeToan"]))],
)
def get_students(
    response: Response,
    skip: int = Query(0, ge=0, description="Số lượng bản ghi bỏ qua"),
    limit: int = Query(50, ge=1, le=200, description="Số lượng bản ghi lấy tối đa"),
    search: Optional[str] = Query(None, description="Từ khóa tìm kiếm theo MSV, tên, lớp, email, sđt"),
    status: Optional[str] = Query("all", description="Trạng thái ở: all, dang_o, chua_xep"),
    ma_toa: Optional[str] = Query(None, description="Mã tòa lọc sinh viên đang ở"),
    so_phong: Optional[str] = Query(None, description="Số phòng lọc sinh viên đang ở"),
    db: Session = Depends(get_db),
):
    students, total_count = student_service.get_students(
        db,
        skip=skip,
        limit=limit,
        search_keyword=search,
        filter_status=status,
        ma_toa=ma_toa,
        so_phong=so_phong,
    )
    response.headers["X-Total-Count"] = str(total_count)
    return students


@router.get(
    "/{msv}",
    response_model=SinhVienResponse,
    summary="Lấy chi tiết hồ sơ một sinh viên",
)
def get_student_by_msv(
    msv: str,
    current_user: TaiKhoan = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lấy thông tin sinh viên:
    - Quản lý và Kế toán có thể xem bất kỳ sinh viên nào.
    - Sinh viên chỉ có thể xem hồ sơ của chính mình.
    """
    user_role = (
        current_user.vai_tro.value
        if hasattr(current_user.vai_tro, "value")
        else str(current_user.vai_tro)
    )

    if user_role == "SinhVien" and current_user.ten_dang_nhap != msv:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Bạn chỉ được phép xem thông tin hồ sơ của chính mình.",
        )

    return student_service.get_student_by_msv(db, msv)


@router.put(
    "/{msv}",
    response_model=SinhVienResponse,
    summary="Cập nhật thông tin sinh viên",
)
def update_student(
    msv: str,
    update_data: SinhVienUpdate,
    current_user: TaiKhoan = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cập nhật thông tin sinh viên:
    - Quản lý có thể cập nhật mọi thông tin.
    - Sinh viên chỉ có thể cập nhật thông tin cá nhân của chính mình.
    """
    user_role = (
        current_user.vai_tro.value
        if hasattr(current_user.vai_tro, "value")
        else str(current_user.vai_tro)
    )

    if user_role == "SinhVien" and current_user.ten_dang_nhap != msv:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Bạn chỉ được phép cập nhật thông tin hồ sơ của chính mình.",
        )

    return student_service.update_student(db, msv, update_data)


@router.delete(
    "/{msv}",
    status_code=status.HTTP_200_OK,
    summary="Xóa hồ sơ sinh viên (Chỉ Quản Lý)",
    dependencies=[Depends(RoleChecker(["QuanLy"]))],
)
def delete_student(
    msv: str,
    db: Session = Depends(get_db),
):
    """
    Xóa sinh viên:
    - Ràng buộc: Chặn xóa nếu sinh viên đang có hợp đồng ACTIVE.
    """
    student_service.delete_student(db, msv)
    return {"status": "success", "message": f"Đã xóa thành công hồ sơ sinh viên '{msv}'."}
