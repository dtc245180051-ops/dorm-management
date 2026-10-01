from typing import List, Optional
from pydantic import BaseModel


class KhoanPhiResponse(BaseModel):
    ten_khoan: str
    trang_thai: str  # "DA_DONG" / "CON_NO"
    so_tien_no: Optional[float] = None
    ghi_chu: Optional[str] = None


class HopDongDetailResponse(BaseModel):
    ma_hop_dong: str
    ho_ten: str
    msv: str
    gioi_tinh: str
    ngay_sinh: Optional[str] = None
    cccd: Optional[str] = None
    so_dien_thoai: Optional[str] = None
    email: Optional[str] = None
    khoa: Optional[str] = None
    lop: Optional[str] = None
    lien_he_khan_cap: Optional[str] = None
    dia_chi: Optional[str] = None
    phong_giuong: str
    ngay_bat_dau: str
    ngay_ket_thuc: str
    trang_thai: str
    tinh_trang_phi: List[KhoanPhiResponse] = []


class GiaHanHopDongRequest(BaseModel):
    ngay_ket_thuc_moi: str
    ghi_chu: Optional[str] = None


class ChamDutHopDongRequest(BaseModel):
    ly_do: Optional[str] = None
    ma_giuong: Optional[str] = None
    ma_phong: Optional[str] = None
