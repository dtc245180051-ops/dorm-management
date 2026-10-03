from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import RoleChecker, get_current_user
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import NguoiDung, TaiKhoan, VaiTro
from app.schemas.auth import GoogleAuthRequest, Token, UserRegister, UserResponse

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
    # 0. Tiền xử lý dữ liệu: phân tách email / phone / username / msv
    email = (user_in.email or "").strip()
    phone = (user_in.phone or "").strip()

    if user_in.email_or_phone:
        raw_val = user_in.email_or_phone.strip()
        if "@" in raw_val:
            if not email:
                email = raw_val
        else:
            if not phone:
                phone = raw_val

    # Tự động gán username và mã sinh viên nếu không truyền trực tiếp
    raw_user = (user_in.ten_dang_nhap or user_in.username or "").strip()
    if not raw_user and email and "@" in email:
        raw_user = email.split("@")[0].strip()

    if not raw_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cần cung cấp Email hợp lệ (@ictu.edu.vn) để tự động tạo Tên đăng nhập và Mã sinh viên",
        )

    username = raw_user.lower()[:50]
    msv_val = (user_in.msv or raw_user).strip().upper()[:20]

    password_raw = user_in.mat_khau or user_in.password
    if not password_raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng nhập mật khẩu",
        )

    full_name_val = (user_in.ho_ten or user_in.full_name or "").strip()
    if not full_name_val:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng nhập họ và tên",
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
        .filter(func.lower(TaiKhoan.ten_dang_nhap) == username.lower())
        .first()
    )
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập (hoặc mã sinh viên) đã được sử dụng",
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
    hashed_password = get_password_hash(password_raw)

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
        ho_ten=full_name_val,
        email=email,
        so_dien_thoai=phone,
    )
    db.add(new_user)
    db.flush()

    # 8. Tự động liên kết vào bảng sinh_vien nếu là vai trò SinhVien
    if new_account.vai_tro == VaiTro.SINH_VIEN:
        from app.models.user import SinhVien
        existing_sv = db.query(SinhVien).filter(SinhVien.msv == msv_val).first()
        if not existing_sv:
            sv = SinhVien(
                msv=msv_val,
                ma_nguoi_dung=new_user.ma_nguoi_dung,
                lop="DTC-KTX",
                gioi_tinh=user_in.gender or "Nam",
            )
            db.add(sv)
        elif not existing_sv.ma_nguoi_dung:
            existing_sv.ma_nguoi_dung = new_user.ma_nguoi_dung

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
    Hỗ trợ đăng nhập linh hoạt bằng: Tên đăng nhập, Mã sinh viên, Email hoặc Số điện thoại.
    Trả về Access Token chứa username (sub) và vai trò (role).
    """
    from app.models.user import SinhVien
    raw_username = form_data.username.strip()
    prefix_username = raw_username.split("@")[0].strip() if "@" in raw_username else raw_username

    account = (
        db.query(TaiKhoan)
        .outerjoin(NguoiDung, TaiKhoan.ma_tai_khoan == NguoiDung.ma_tai_khoan)
        .outerjoin(SinhVien, NguoiDung.ma_nguoi_dung == SinhVien.ma_nguoi_dung)
        .filter(
            or_(
                TaiKhoan.ten_dang_nhap == raw_username,
                TaiKhoan.ten_dang_nhap.ilike(raw_username),
                TaiKhoan.ten_dang_nhap == prefix_username,
                TaiKhoan.ten_dang_nhap.ilike(prefix_username),
                NguoiDung.email == raw_username,
                NguoiDung.email.ilike(raw_username),
                NguoiDung.so_dien_thoai == raw_username,
                SinhVien.msv == raw_username,
                SinhVien.msv.ilike(raw_username),
                SinhVien.msv == prefix_username,
                SinhVien.msv.ilike(prefix_username),
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

    full_name_val = account.nguoi_dung.ho_ten if account.nguoi_dung else None

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=role_value,
        username=account.ten_dang_nhap,
        full_name=full_name_val,
    )


@router.post(
    "/google",
    response_model=Token,
    summary="Đăng nhập hoặc Đăng ký nhanh với Google (Chỉ chấp nhận @ictu.edu.vn)",
)
def google_auth(
    payload: GoogleAuthRequest,
    db: Session = Depends(get_db),
):
    """
    Xác thực Google cho sinh viên:
    - Bắt buộc email kết thúc bằng @ictu.edu.vn
    - Nếu tài khoản đã tồn tại: Cấp phát JWT token đăng nhập
    - Nếu tài khoản chưa tồn tại: Tự động đăng ký tài khoản sinh viên mới và đăng nhập
    """
    import re
    email = payload.email.strip().lower()

    # 1. Kiểm tra nghiêm ngặt định dạng email trường ICTU
    if not re.match(r"^[^@\s]+@ictu\.edu\.vn$", email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ chấp nhận tài khoản Google có định dạng email trường (@ictu.edu.vn)",
        )

    prefix = email.split("@")[0].strip()
    username = prefix.lower()[:50]
    msv_val = prefix.upper()[:20]

    # 2. Tìm tài khoản người dùng đã có trong hệ thống
    from app.models.user import SinhVien
    account = (
        db.query(TaiKhoan)
        .outerjoin(NguoiDung, TaiKhoan.ma_tai_khoan == NguoiDung.ma_tai_khoan)
        .outerjoin(SinhVien, NguoiDung.ma_nguoi_dung == SinhVien.ma_nguoi_dung)
        .filter(
            or_(
                NguoiDung.email == email,
                NguoiDung.email.ilike(email),
                TaiKhoan.ten_dang_nhap == username,
                TaiKhoan.ten_dang_nhap.ilike(username),
                SinhVien.msv == msv_val,
                SinhVien.msv.ilike(msv_val),
            )
        )
        .first()
    )

    # 3. Nếu chưa có tài khoản, tự động tạo mới
    if not account:
        default_pwd = get_password_hash(f"IctuGoogleAuth@{username}")
        full_name_val = (payload.full_name or "").strip() or username.upper()

        account = TaiKhoan(
            ten_dang_nhap=username,
            mat_khau=default_pwd,
            vai_tro=VaiTro.SINH_VIEN,
        )
        db.add(account)
        db.flush()

        new_user = NguoiDung(
            ma_tai_khoan=account.ma_tai_khoan,
            ho_ten=full_name_val,
            email=email,
        )
        db.add(new_user)
        db.flush()

        existing_sv = db.query(SinhVien).filter(SinhVien.msv == msv_val).first()
        if not existing_sv:
            sv = SinhVien(
                msv=msv_val,
                ma_nguoi_dung=new_user.ma_nguoi_dung,
                lop="DTC-KTX",
                gioi_tinh="Nam",
            )
            db.add(sv)
        elif not existing_sv.ma_nguoi_dung:
            existing_sv.ma_nguoi_dung = new_user.ma_nguoi_dung

        db.commit()
        db.refresh(account)

    role_value = (
        account.vai_tro.value
        if hasattr(account.vai_tro, "value")
        else str(account.vai_tro)
    )

    access_token = create_access_token(
        data={"sub": account.ten_dang_nhap, "role": role_value}
    )

    full_name_val = account.nguoi_dung.ho_ten if account.nguoi_dung else account.ten_dang_nhap

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=role_value,
        username=account.ten_dang_nhap,
        full_name=full_name_val,
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
