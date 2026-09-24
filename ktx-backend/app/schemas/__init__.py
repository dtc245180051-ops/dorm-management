from app.schemas.auth import (
    NguoiDungResponse,
    Token,
    TokenData,
    UserRegister,
    UserResponse,
)
from app.schemas.dorm import (
    GiuongCreate,
    GiuongResponse,
    GiuongUpdateStatus,
    PhongCreate,
    PhongResponse,
    PhongUpdate,
    RoomAvailableResponse,
    TangCreate,
    TangResponse,
    ToaNhaCreate,
    ToaNhaResponse,
)
from app.schemas.student import (
    SinhVienCreate,
    SinhVienResponse,
    SinhVienUpdate,
    ThongTinPhongHienTai,
)

__all__ = [
    # Auth
    "Token",
    "TokenData",
    "UserRegister",
    "NguoiDungResponse",
    "UserResponse",
    # Dorm
    "ToaNhaCreate",
    "ToaNhaResponse",
    "TangCreate",
    "TangResponse",
    "PhongCreate",
    "PhongUpdate",
    "PhongResponse",
    "GiuongCreate",
    "GiuongUpdateStatus",
    "GiuongResponse",
    "RoomAvailableResponse",
    # Student
    "SinhVienCreate",
    "SinhVienUpdate",
    "SinhVienResponse",
    "ThongTinPhongHienTai",
]
