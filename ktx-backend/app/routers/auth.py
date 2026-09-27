from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import RoleChecker, get_current_user
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import NguoiDung, TaiKhoan, VaiTro
from app.schemas.auth import Token, UserRegister, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký tài khoản người dùng mới",
)
def register(
    user_in: UserRegister,
    db: Session = Depends(get_db),
):
    """
    Tiếp nhận dữ liệu đăng ký, băm mật khẩu, đồng thời tạo bản ghi TaiKhoan và NguoiDung.
    """
    # 1. Kiểm tra tính hợp lệ của vai trò
    valid_roles = {vt.value: vt for vt in VaiTro}
    if user_in.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vai trò '{user_in.role}' không hợp lệ. Các vai trò hợp lệ: {', '.join(valid_roles.keys())}",
        )

    # 2. Kiểm tra tên đăng nhập đã tồn tại chưa
    existing_username = (
        db.query(TaiKhoan)
        .filter(TaiKhoan.ten_dang_nhap == user_in.username)
        .first()
    )
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập đã được sử dụng",
        )

    # 3. Kiểm tra email đã tồn tại chưa nếu có cung cấp
    if user_in.email:
        existing_email = (
            db.query(NguoiDung)
            .filter(NguoiDung.email == user_in.email)
            .first()
        )
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email đã được sử dụng trong hệ thống",
            )

    # 4. Băm mật khẩu bằng bcrypt
    hashed_password = get_password_hash(user_in.password)

    # 5. Khởi tạo thực thể TaiKhoan
    new_account = TaiKhoan(
        ten_dang_nhap=user_in.username,
        mat_khau=hashed_password,
        vai_tro=valid_roles[user_in.role],
    )
    db.add(new_account)
    db.flush()  # Sinh ma_tai_khoan trước khi tạo NguoiDung

    # 6. Khởi tạo thực thể NguoiDung liên kết 1-1
    new_user = NguoiDung(
        ma_tai_khoan=new_account.ma_tai_khoan,
        ho_ten=user_in.full_name,
        email=user_in.email,
        so_dien_thoai=user_in.phone,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_account)

    return new_account


@router.post(
    "/login",
    response_model=Token,
    summary="Đăng nhập hệ thống & cấp phát JWT Access Token",
)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Xác thực thông tin đăng nhập với OAuth2PasswordRequestForm.
    Trả về Access Token chứa username (sub) và vai trò (role).
    """
    account = (
        db.query(TaiKhoan)
        .filter(TaiKhoan.ten_dang_nhap == form_data.username)
        .first()
    )
    if not account or not verify_password(form_data.password, account.mat_khau):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác",
            headers={"WWW-Authenticate": "Bearer"},
        )

    role_value = (
        account.vai_tro.value
        if hasattr(account.vai_tro, "value")
        else str(account.vai_tro)
    )

    access_token = create_access_token(
        data={"sub": account.ten_dang_nhap, "role": role_value}
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=role_value,
        username=account.ten_dang_nhap,
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Lấy thông tin tài khoản và người dùng hiện tại",
)
def get_current_user_profile(
    current_user: TaiKhoan = Depends(get_current_user),
):
    """
    Trả về thông tin chi tiết của người dùng đang đăng nhập thông qua Bearer token.
    """
    return current_user


# Endpoint kiểm thử phân quyền RBAC
@router.get(
    "/test-roles/quan-ly",
    summary="[RBAC Test] Chỉ dành cho Quản Lý",
)
def test_quan_ly_role(
    current_user: TaiKhoan = Depends(RoleChecker(["QuanLy"])),
):
    return {
        "status": "success",
        "message": "Truy cập thành công - Dành riêng cho Quản Lý",
        "user": current_user.ten_dang_nhap,
        "role": current_user.vai_tro,
    }


@router.get(
    "/test-roles/ke-toan",
    summary="[RBAC Test] Chỉ dành cho Kế Toán",
)
def test_ke_toan_role(
    current_user: TaiKhoan = Depends(RoleChecker(["KeToan"])),
):
    return {
        "status": "success",
        "message": "Truy cập thành công - Dành riêng cho Kế Toán",
        "user": current_user.ten_dang_nhap,
        "role": current_user.vai_tro,
    }


@router.get(
    "/test-roles/sinh-vien",
    summary="[RBAC Test] Chỉ dành cho Sinh Viên",
)
def test_sinh_vien_role(
    current_user: TaiKhoan = Depends(RoleChecker(["SinhVien"])),
):
    return {
        "status": "success",
        "message": "Truy cập thành công - Dành riêng cho Sinh Viên",
        "user": current_user.ten_dang_nhap,
        "role": current_user.vai_tro,
    }
