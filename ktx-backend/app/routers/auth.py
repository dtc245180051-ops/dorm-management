from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_
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
    Tương thích với form đăng ký: hỗ trợ tự động xử lý email, số điện thoại, tên đăng nhập và vai trò mặc định.
    """
    # 0. Tiền xử lý dữ liệu: phân tách email / phone / username
    email = user_in.email
    phone = user_in.phone

    if user_in.email_or_phone:
        raw_val = user_in.email_or_phone.strip()
        if "@" in raw_val:
            if not email:
                email = raw_val
        else:
            if not phone:
                phone = raw_val

    # Tự động gán username nếu người dùng không truyền trực tiếp
    username = user_in.username
    if not username:
        if email:
            username = email.split("@")[0][:50]
        elif phone:
            username = phone[:50]
        elif user_in.email_or_phone:
            username = user_in.email_or_phone.strip()[:50]
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cần cung cấp Email, Số điện thoại hoặc Tên đăng nhập",
            )

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
        .filter(TaiKhoan.ten_dang_nhap == username)
        .first()
    )
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập đã được sử dụng",
        )

    # 3. Kiểm tra email đã tồn tại chưa nếu có cung cấp
    if email:
        if user_in.role == "SinhVien":
            import re
            if not re.match(r"^[^@\s]+@ictu\.edu\.vn$", email.strip(), re.IGNORECASE):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email sinh viên phải có định dạng @ictu.edu.vn",
                )

        existing_email = (
            db.query(NguoiDung)
            .filter(NguoiDung.email == email)
            .first()
        )
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email đã được sử dụng trong hệ thống",
            )

    # 4. Kiểm tra số điện thoại đã tồn tại chưa nếu có cung cấp
    if phone:
        existing_phone = (
            db.query(NguoiDung)
            .filter(NguoiDung.so_dien_thoai == phone)
            .first()
        )
        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số điện thoại đã được sử dụng trong hệ thống",
            )

    # 5. Băm mật khẩu bằng bcrypt
    hashed_password = get_password_hash(user_in.password)

    # 6. Khởi tạo thực thể TaiKhoan
    new_account = TaiKhoan(
        ten_dang_nhap=username,
        mat_khau=hashed_password,
        vai_tro=valid_roles[user_in.role],
    )
    db.add(new_account)
    db.flush()  # Sinh ma_tai_khoan trước khi tạo NguoiDung

    # 7. Khởi tạo thực thể NguoiDung liên kết 1-1
    new_user = NguoiDung(
        ma_tai_khoan=new_account.ma_tai_khoan,
        ho_ten=user_in.full_name,
        email=email,
        so_dien_thoai=phone,
    )
    db.add(new_user)
    db.flush()

    # 8. Tự động liên kết vào bảng sinh_vien nếu là vai trò SinhVien
    if new_account.vai_tro == VaiTro.SINH_VIEN and username.upper().startswith("DTC"):
        from app.models.user import SinhVien
        msv_val = username.upper()
        existing_sv = db.query(SinhVien).filter(SinhVien.msv == msv_val).first()
        if not existing_sv:
            sv = SinhVien(
                msv=msv_val,
                ma_nguoi_dung=new_user.ma_nguoi_dung,
                lop="DTC-KTX",
                gioi_tinh=user_in.gender or "Nữ",
            )
            db.add(sv)

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
    Hỗ trợ đăng nhập linh hoạt bằng: Tên đăng nhập, Email hoặc Số điện thoại.
    Trả về Access Token chứa username (sub) và vai trò (role).
    """
    raw_username = form_data.username.strip()
    prefix_username = raw_username.split("@")[0] if "@" in raw_username else raw_username

    account = (
        db.query(TaiKhoan)
        .outerjoin(NguoiDung, TaiKhoan.ma_tai_khoan == NguoiDung.ma_tai_khoan)
        .filter(
            or_(
                TaiKhoan.ten_dang_nhap == raw_username,
                TaiKhoan.ten_dang_nhap.ilike(raw_username),
                TaiKhoan.ten_dang_nhap == prefix_username,
                TaiKhoan.ten_dang_nhap.ilike(prefix_username),
                NguoiDung.email == raw_username,
                NguoiDung.email.ilike(raw_username),
                NguoiDung.so_dien_thoai == raw_username,
            )
        )
        .first()
    )
    if not account or not verify_password(form_data.password, account.mat_khau):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập, email hoặc mật khẩu không chính xác",
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
