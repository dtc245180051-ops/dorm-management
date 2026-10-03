from typing import List, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import TaiKhoan
from app.schemas.auth import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> TaiKhoan:
    """
    Xác thực JWT token và trả về tài khoản người dùng hiện tại từ cơ sở dữ liệu.
    Hỗ trợ trích xuất token từ Authorization Header (Bearer), x-access-token hoặc query parameter.
    Ném lỗi 401 nếu token không hợp lệ, hết hạn hoặc không tìm thấy người dùng.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1. Trích xuất token từ oauth2_scheme hoặc fallback qua header/query
    if not token:
        auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
        if auth_header:
            parts = auth_header.strip().split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                token = parts[1]
            elif len(parts) == 1:
                token = parts[0]
            elif auth_header.lower().startswith("bearer "):
                token = auth_header[7:].strip()

    if not token:
        token = request.headers.get("x-access-token") or request.query_params.get("token")

    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        username: Optional[str] = payload.get("sub")
        role: Optional[str] = payload.get("role")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username, role=role)
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(TaiKhoan).filter(TaiKhoan.ten_dang_nhap == token_data.username).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Người dùng không tồn tại trong hệ thống",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_user_optional(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Optional[TaiKhoan]:
    """
    Xác thực người dùng tùy chọn (không bắt buộc).
    Nếu không có token hoặc token không hợp lệ, trả về None thay vì ném lỗi 401.
    """
    try:
        return get_current_user(request=request, token=token, db=db)
    except Exception:
        return None


class RoleChecker:
    """
    Dependency kiểm tra quyền truy cập dựa trên danh sách các vai trò cho phép (RBAC).
    Hỗ trợ tương thích giữa Quản Lý và Admin.
    Ném lỗi 403 nếu vai trò của người dùng hiện tại không nằm trong danh sách.
    """

    def __init__(self, allowed_roles: List[str]) -> None:
        self.allowed_roles = [r.lower() for r in allowed_roles]
        if "quanly" in self.allowed_roles or "quan_ly" in self.allowed_roles:
            self.allowed_roles.extend(["admin", "quanly", "quan_ly"])

    def __call__(self, current_user: TaiKhoan = Depends(get_current_user)) -> TaiKhoan:
        role_value = (
            current_user.vai_tro.value
            if hasattr(current_user.vai_tro, "value")
            else str(current_user.vai_tro)
        )
        if role_value.lower() not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Tài khoản có vai trò '{role_value}' không có quyền truy cập",
            )
        return current_user


# Pre-configured role dependencies
require_quan_ly = RoleChecker(["QuanLy", "Admin"])
require_ke_toan = RoleChecker(["KeToan", "QuanLy", "Admin"])
require_sinh_vien = RoleChecker(["SinhVien"])
require_staff = RoleChecker(["QuanLy", "KeToan", "Admin"])

# Admin dependency (nhận diện quyền Admin/QuanLy)
get_current_admin = RoleChecker(["QuanLy", "Admin"])
