---
name: auth-rbac-setup
description: Implement JWT authentication, password hashing, and role-based access control (RBAC) for FastAPI backend adhering to project models and standards.
---

# Authentication & Role-Based Access Control (RBAC) Skill

## 1. Objective
Tự động triển khai hoàn chỉnh module Xác thực (Authentication) và Phân quyền (RBAC) cho hệ thống Ký túc xá bằng FastAPI, SQLAlchemy, JWT và OAuth2PasswordBearer. Hỗ trợ 3 nhóm vai trò: `QuanLy`, `KeToan`, `SinhVien`.

## 2. Structural & Architectural Invariants (Bắt buộc tuân thủ)
- **Vị trí Database**: File kết nối CSDL và session provider `get_db` bắt buộc nằm tại `app/core/database.py`. Nếu đang nằm ở `app/database.py`, di chuyển ngay vào `app/core/database.py`.
- **Mô hình thực thể (Models)**: Bám sát các class trong `app/models/user.py`:
  - `TaiKhoan` (ma_tai_khoan, ten_dang_nhap, mat_khau, vai_tro)
  - `NguoiDung` (ma_nguoi_dung, ma_tai_khoan, ho_ten, email, so_dien_thoai)
- **Cơ chế bảo mật**:
  - Mã hóa mật khẩu: Thuật toán `bcrypt` thông qua `passlib.context.CryptContext`.
  - Token chuẩn: JSON Web Token (JWT) theo chuẩn OAuth2 Bearer.
  - Payload của token bắt buộc chứa: `sub` (ten_dang_nhap) và `role` (vai_tro).

## 3. Execution Process for AI Agent

### Bước 1: Kiểm tra & cập nhật dependencies
Đảm bảo các thư viện sau đã có trong `requirements.txt`:
- `pydantic-settings`
- `python-jose[cryptography]`
- `passlib[bcrypt]`
- `python-multipart`

### Bước 2: Chuẩn hóa cấu hình (`app/core/config.py` & `.env`)
- Bổ sung vào `.env`:
  - `SECRET_KEY=dormitory_super_secret_jwt_key_2026`
  - `ALGORITHM=HS256`
  - `ACCESS_TOKEN_EXPIRE_MINUTES=1440`
- Khai báo các biến trên vào class `Settings` trong `app/core/config.py` bằng `pydantic_settings.BaseSettings`.

### Bước 3: Module mã hóa và JWT (`app/core/security.py`)
- Viết hàm `verify_password(plain_password: str, hashed_password: str) -> bool`
- Viết hàm `get_password_hash(password: str) -> str`
- Viết hàm `create_access_token(data: dict, expires_delta: timedelta | None = None) -> str`

### Bước 4: Định nghĩa Schemas Pydantic (`app/schemas/auth.py`)
- `Token`: access_token (str), token_type (str = "bearer"), role (str), username (str)
- `TokenData`: username (Optional[str]), role (Optional[str])
- `UserRegister`: username (str), password (str), role (str), full_name (str), email (Optional[str]), phone (Optional[str])

### Bước 5: Dependency phân quyền RBAC (`app/core/deps.py`)
- Khởi tạo `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")`.
- `get_current_user(token, db) -> TaiKhoan`: Giải mã JWT, truy vấn DB lấy bản ghi `TaiKhoan`. Bắn HTTPException 401 nếu token sai hoặc hết hạn.
- Class callable `RoleChecker(allowed_roles: list[str])`: Nhận danh sách vai trò cho phép, so khớp với `current_user.vai_tro`. Bắn HTTPException 403 ("Forbidden") nếu vai trò không khớp.

### Bước 6: Xây dựng Routers (`app/routers/auth.py`)
- `POST /api/v1/auth/register`: Tiếp nhận dữ liệu, băm mật khẩu, tạo đồng thời bản ghi `TaiKhoan` và `NguoiDung`.
- `POST /api/v1/auth/login`: Nhận `OAuth2PasswordRequestForm`, kiểm tra mật khẩu, trả về access token kèm vai trò.
- `GET /api/v1/auth/me`: Trả về thông tin tài khoản hiện tại từ dependency `get_current_user`.

### Bước 7: Cấu hình App & CORS (`app/main.py`)
- Kích hoạt `CORSMiddleware` cho phép nguồn gốc Frontend `http://localhost:5173`.
- Đăng ký `auth.router` với prefix `/api/v1`.

## 4. Outputs
- Tự động di chuyển `database.py` vào `app/core/database.py` (nếu chưa có).
- Cập nhật/tạo mới:
  - `app/core/config.py`
  - `app/core/security.py`
  - `app/core/deps.py`
  - `app/schemas/auth.py`
  - `app/schemas/__init__.py`
  - `app/routers/auth.py`
  - `app/main.py`
- Sẵn sàng kiểm thử API đăng nhập và phân quyền trên Swagger UI (`/docs`).