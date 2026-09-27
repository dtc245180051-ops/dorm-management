from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None


class UserRegister(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=50, description="Tên đăng nhập")
    password: str = Field(..., min_length=6, description="Mật khẩu")
    role: str = Field(default="SinhVien", description="Vai trò: QuanLy, KeToan, SinhVien")
    full_name: str = Field(..., min_length=2, max_length=100, description="Họ và tên")
    email: Optional[str] = Field(default=None, max_length=100, description="Địa chỉ email")
    phone: Optional[str] = Field(default=None, max_length=15, description="Số điện thoại")
    email_or_phone: Optional[str] = Field(default=None, max_length=100, description="Email hoặc số điện thoại")
    gender: Optional[str] = Field(default=None, max_length=10, description="Giới tính (Nam, Nu)")


class NguoiDungResponse(BaseModel):
    ma_nguoi_dung: str
    ho_ten: str
    email: Optional[str] = None
    so_dien_thoai: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UserResponse(BaseModel):
    ma_tai_khoan: str
    ten_dang_nhap: str
    vai_tro: str
    nguoi_dung: Optional[NguoiDungResponse] = None

    model_config = ConfigDict(from_attributes=True)
