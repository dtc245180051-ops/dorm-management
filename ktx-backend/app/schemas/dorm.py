from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ----------------- Giuong Schemas -----------------
class GiuongBase(BaseModel):
    ma_giuong: Optional[str] = Field(default=None, max_length=20, description="Mã giường")
    ma_phong: str = Field(..., max_length=20, description="Mã phòng")
    trang_thai: str = Field(default="TRONG", max_length=20, description="Trạng thái: TRONG, DA_THUE, BAO_TRI")


class GiuongCreate(GiuongBase):
    pass


class GiuongUpdateStatus(BaseModel):
    trang_thai: str = Field(..., max_length=20, description="Trạng thái mới: TRONG, DA_THUE, BAO_TRI")


class GiuongResponse(BaseModel):
    ma_giuong: str
    ma_phong: str
    trang_thai: str

    model_config = ConfigDict(from_attributes=True)


# ----------------- Phong Schemas -----------------
class PhongBase(BaseModel):
    so_phong: str = Field(..., max_length=20, description="Số phòng (ví dụ: 101, 102)")
    suc_chua: int = Field(default=4, ge=1, le=16, description="Sức chứa (số lượng giường)")
    loai_phong: str = Field(..., max_length=50, description="Loại phòng (ví dụ: Nam, Nu, TieuChuan)")
    ma_tang: str = Field(..., max_length=20, description="Mã tầng trực thuộc")


class PhongCreate(PhongBase):
    ma_phong: Optional[str] = Field(default=None, max_length=20, description="Mã phòng tùy chọn")


class PhongUpdate(BaseModel):
    so_phong: Optional[str] = Field(default=None, max_length=20)
    suc_chua: Optional[int] = Field(default=None, ge=1, le=16)
    loai_phong: Optional[str] = Field(default=None, max_length=50)
    ma_tang: Optional[str] = Field(default=None, max_length=20)


class PhongResponse(BaseModel):
    ma_phong: str
    so_phong: str
    suc_chua: int
    loai_phong: str
    ma_tang: str
    giuongs: List[GiuongResponse] = []
    so_giuong_trong: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class RoomAvailableResponse(BaseModel):
    ma_phong: str
    so_phong: str
    loai_phong: str
    suc_chua: int
    ma_tang: str
    so_tang: Optional[int] = None
    ma_toa: Optional[str] = None
    ten_toa: Optional[str] = None
    so_giuong_trong: int
    danh_sach_giuong_trong: List[GiuongResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ----------------- Tang Schemas -----------------
class TangBase(BaseModel):
    so_tang: int = Field(..., ge=1, description="Số thứ tự tầng (1, 2, 3...)")
    ma_toa: str = Field(..., max_length=20, description="Mã tòa nhà trực thuộc")


class TangCreate(TangBase):
    ma_tang: Optional[str] = Field(default=None, max_length=20, description="Mã tầng tùy chọn")


class TangResponse(BaseModel):
    ma_tang: str
    so_tang: int
    ma_toa: str
    phongs: List[PhongResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ----------------- ToaNha Schemas -----------------
class ToaNhaBase(BaseModel):
    ten_toa: str = Field(..., min_length=1, max_length=50, description="Tên tòa nhà (ví dụ: Tòa A, Tòa B)")


class ToaNhaCreate(ToaNhaBase):
    ma_toa: Optional[str] = Field(default=None, max_length=20, description="Mã tòa nhà tùy chọn")


class ToaNhaResponse(BaseModel):
    ma_toa: str
    ten_toa: str
    tangs: List[TangResponse] = []

    model_config = ConfigDict(from_attributes=True)
