from __future__ import annotations

import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class HoaDonResponse(BaseModel):
    ma_hoa_don: str
    ma_hop_dong: Optional[str] = None
    msv: Optional[str] = None
    ho_ten: Optional[str] = None
    ma_phong: Optional[str] = None
    so_phong: Optional[str] = None
    loai_hoa_don: str
    ky_thanh_toan: str
    so_tien: float
    ngay_lap: datetime.date
    han_thanh_toan: datetime.date
    trang_thai: str
    ghi_chu: Optional[str] = None
    nguoi_tao: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RoomBillingCandidate(BaseModel):
    msv: str
    ho_ten: str
    phong: str
    ma_phong: Optional[str] = None
    ma_hop_dong: Optional[str] = None
    thoi_han_hop_dong: str
    thoi_gian_o_thang: int
    don_gia_thang: float
    so_tien: float
    da_lap_hoa_don: bool = False


class RoomInvoicePublishRequest(BaseModel):
    ky_thanh_toan: str = Field(
        ...,
        description="Năm học hoặc kỳ thanh toán, ví dụ: 'Năm học 2026 – 2027'",
    )
    ap_dung: Optional[str] = Field(
        default="Tất cả sinh viên còn hạn hợp đồng",
        description="Phạm vi áp dụng (tất cả hoặc theo tòa A1-A11)",
    )
    thoi_gian_o_thang: int = Field(
        default=11,
        ge=1,
        le=12,
        description="Thời gian ở tính theo tháng (cố định 11 tháng)",
    )
    don_gia_thang: float = Field(
        default=600000.0,
        ge=0,
        description="Đơn giá tiền phòng VND/sinh viên/tháng",
    )
    han_thanh_toan: datetime.date = Field(
        ...,
        description="Hạn chót thanh toán hóa đơn",
    )
    danh_sach_msv: Optional[List[str]] = Field(
        default=None,
        description="Danh sách MSV cần lập; nếu None thì lập cho tất cả sinh viên hợp lệ",
    )
    ghi_chu: Optional[str] = None


class UtilityBillingCandidate(BaseModel):
    ma_phong: str
    so_phong: str
    toa_nha: str
    so_sinh_vien: int
    chi_so_dien_cu_moi: str
    so_dien_kwh: int
    chi_so_nuoc_cu_moi: str
    so_nuoc_m3: int
    tong_tien: float
    da_lap_hoa_don: bool = False


class UtilityInvoicePublishRequest(BaseModel):
    thang: str = Field(
        ...,
        description="Tháng áp dụng, ví dụ: 'Tháng 09/2026'",
    )
    han_thanh_toan: datetime.date = Field(
        ...,
        description="Hạn chót thanh toán",
    )
    don_gia_dien: float = Field(
        default=3000.0,
        ge=0,
        description="Đơn giá điện (VND/kWh)",
    )
    don_gia_nuoc: float = Field(
        default=15000.0,
        ge=0,
        description="Đơn giá nước (VND/m3)",
    )
    danh_sach_phong: Optional[List[str]] = Field(
        default=None,
        description="Danh sách mã phòng cần phát hành hóa đơn",
    )
    ghi_chu: Optional[str] = None


class PublishResultResponse(BaseModel):
    success: bool
    message: str
    tong_hoa_don: int
    tong_so_tien: float
    invoices: List[HoaDonResponse]
