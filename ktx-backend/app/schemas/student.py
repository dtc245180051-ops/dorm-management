from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ThongTinPhongHienTai(BaseModel):
    ma_hop_dong: str
    ma_giuong: str
    ma_phong: str
    so_phong: str
    ten_toa: Optional[str] = None
    so_tang: Optional[int] = None
    ngay_bat_dau: Optional[str] = None
    ngay_ket_thuc: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SinhVienCreate(BaseModel):
    msv: str = Field(..., min_length=2, max_length=20, description="Mã số sinh viên (duy nhất)")
    ho_ten: str = Field(..., min_length=2, max_length=100, description="Họ và tên sinh viên")
    email: Optional[str] = Field(default=None, max_length=100, description="Email sinh viên")
    so_dien_thoai: Optional[str] = Field(default=None, max_length=15, description="Số điện thoại")
    lop: str = Field(..., min_length=1, max_length=50, description="Lớp sinh hoạt (ví dụ: CNTT K15)")
    gioi_tinh: str = Field(..., max_length=10, description="Giới tính (Nam, Nu)")
    mat_khau_khoi_tao: Optional[str] = Field(
        default=None,
        min_length=6,
        description="Mật khẩu khởi tạo (mặc định lấy theo MSV nếu để trống)",
    )


class SinhVienUpdate(BaseModel):
    ho_ten: Optional[str] = Field(default=None, max_length=100)
    so_dien_thoai: Optional[str] = Field(default=None, max_length=15)
    lop: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=100)
    gioi_tinh: Optional[str] = Field(default=None, max_length=10)


class SinhVienResponse(BaseModel):
    msv: str
    ho_ten: str
    email: Optional[str] = None
    so_dien_thoai: Optional[str] = None
    lop: str
    gioi_tinh: str
    thong_tin_phong_hien_tai: Optional[ThongTinPhongHienTai] = None

    model_config = ConfigDict(from_attributes=True)
