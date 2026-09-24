from typing import List, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import TaiKhoan
from app.schemas.auth import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> TaiKhoan:
    """
    Xác thực JWT token và trả về tài khoản người dùng hiện tại từ cơ sở dữ liệu.
    Ném lỗi 401 nếu token không hợp lệ, hết hạn hoặc không tìm thấy người dùng.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực thông tin đăng nhập",
        headers={"WWW-Authenticate": "Bearer"},
    )
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


class RoleChecker:
    """
    Dependency kiểm tra quyền truy cập dựa trên danh sách các vai trò cho phép (RBAC).
    Ném lỗi 403 nếu vai trò của người dùng hiện tại không nằm trong danh sách.
    """

    def __init__(self, allowed_roles: List[str]) -> None:
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: TaiKhoan = Depends(get_current_user)) -> TaiKhoan:
        role_value = (
            current_user.vai_tro.value
            if hasattr(current_user.vai_tro, "value")
            else str(current_user.vai_tro)
        )
        if role_value not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Tài khoản có vai trò '{role_value}' không có quyền truy cập",
            )
        return current_user


# Pre-configured role dependencies
require_quan_ly = RoleChecker(["QuanLy"])
require_ke_toan = RoleChecker(["KeToan"])
require_sinh_vien = RoleChecker(["SinhVien"])
require_staff = RoleChecker(["QuanLy", "KeToan"])
