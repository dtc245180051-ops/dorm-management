from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ThongTinPhongHienTai(BaseModel):
    ma_hop_dong: Optional[str] = None
    ma_giuong: Optional[str] = None
    ma_phong: Optional[str] = None
    so_phong: Optional[str] = None
    ten_toa: Optional[str] = None
    so_tang: Optional[int] = None
    ten_giuong: Optional[str] = None
    ngay_bat_dau: Optional[str] = None
    ngay_ket_thuc: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PhanAnhBrief(BaseModel):
    ma_phan_anh: str
    noi_dung: str
    trang_thai: str
    ngay_gui: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ViPhamBrief(BaseModel):
    ma_vi_pham: str
    mo_ta: str
    hinh_thuc_xu_ly: str
    ngay_vi_pham: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SinhVienCreate(BaseModel):
    msv: str = Field(..., min_length=2, max_length=20, description="Mã số sinh viên (duy nhất)")
    ho_ten: str = Field(..., min_length=2, max_length=100, description="Họ và tên sinh viên")
    email: Optional[str] = Field(default=None, max_length=100, description="Email sinh viên")
    so_dien_thoai: Optional[str] = Field(default=None, max_length=20, description="Số điện thoại")
    lop: Optional[str] = Field(default="CNTTK24", max_length=50, description="Lớp chuyên ngành")
    gioi_tinh: str = Field(default="Nam", max_length=10, description="Giới tính (Nam, Nu, Nữ)")
    khoa: Optional[str] = Field(default=None, max_length=100, description="Khoa / Viện")
    que_quan: Optional[str] = Field(default=None, max_length=100, description="Quê quán")
    ngay_sinh: Optional[str] = Field(default=None, max_length=20, description="Ngày sinh (dd/mm/yyyy)")
    cccd: Optional[str] = Field(default=None, max_length=20, description="Số CCCD / Định danh")
    dia_chi: Optional[str] = Field(default=None, max_length=255, description="Địa chỉ thường trú")
    doi_tuong_uu_tien: Optional[str] = Field(default=None, max_length=100, description="Đối tượng ưu tiên")
    nguoi_giam_ho: Optional[str] = Field(default=None, max_length=100, description="Họ và tên người giám hộ")
    moi_quan_he: Optional[str] = Field(default=None, max_length=50, description="Mối quan hệ")
    sdt_nguoi_giam_ho: Optional[str] = Field(default=None, max_length=20, description="SĐT liên hệ khẩn cấp")
    anh_dai_dien: Optional[str] = Field(default=None, max_length=255, description="URL ảnh đại diện")
    mat_khau_khoi_tao: Optional[str] = Field(
        default=None,
        min_length=6,
        description="Mật khẩu khởi tạo (mặc định lấy theo MSV nếu để trống)",
    )
    # Thông tin xếp phòng và hợp đồng (tùy chọn)
    ma_toa: Optional[str] = None
    so_tang: Optional[int] = None
    ma_phong: Optional[str] = None
    ma_giuong: Optional[str] = None
    ma_hop_dong: Optional[str] = None
    thoi_han_luu_tru: Optional[str] = None
    ngay_bat_dau: Optional[str] = None
    ngay_ket_thuc: Optional[str] = None
    don_gia_dinh_ky: Optional[float] = None
    tong_tien_thue: Optional[float] = None
    anh_hop_dong: Optional[str] = None


class SinhVienUpdate(BaseModel):
    ho_ten: Optional[str] = Field(default=None, max_length=100)
    so_dien_thoai: Optional[str] = Field(default=None, max_length=20)
    lop: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=100)
    gioi_tinh: Optional[str] = Field(default=None, max_length=10)
    khoa: Optional[str] = Field(default=None, max_length=100)
    que_quan: Optional[str] = Field(default=None, max_length=100)
    ngay_sinh: Optional[str] = Field(default=None, max_length=20)
    cccd: Optional[str] = Field(default=None, max_length=20)
    dia_chi: Optional[str] = Field(default=None, max_length=255)
    doi_tuong_uu_tien: Optional[str] = Field(default=None, max_length=100)
    nguoi_giam_ho: Optional[str] = Field(default=None, max_length=100)
    moi_quan_he: Optional[str] = Field(default=None, max_length=50)
    sdt_nguoi_giam_ho: Optional[str] = Field(default=None, max_length=20)
    anh_dai_dien: Optional[str] = Field(default=None, max_length=255)
    anh_hop_dong: Optional[str] = Field(default=None, max_length=255)


class SinhVienResponse(BaseModel):
    msv: str
    ho_ten: str
    email: Optional[str] = None
    so_dien_thoai: Optional[str] = None
    lop: str
    gioi_tinh: str
    khoa: Optional[str] = None
    que_quan: Optional[str] = None
    ngay_sinh: Optional[str] = None
    cccd: Optional[str] = None
    dia_chi: Optional[str] = None
    doi_tuong_uu_tien: Optional[str] = None
    nguoi_giam_ho: Optional[str] = None
    moi_quan_he: Optional[str] = None
    sdt_nguoi_giam_ho: Optional[str] = None
    anh_dai_dien: Optional[str] = None
    anh_hop_dong: Optional[str] = None
    trang_thai_o: str = "CHUA_XEP"  # DANG_O hoặc CHUA_XEP
    thong_tin_phong_hien_tai: Optional[ThongTinPhongHienTai] = None
    phan_anhs: List[PhanAnhBrief] = []
    vi_phams: List[ViPhamBrief] = []

    model_config = ConfigDict(from_attributes=True)


class StudentStatsResponse(BaseModel):
    total: int
    dang_o: int
    da_tra_phong: int = 0
    chua_xep: int = 0
