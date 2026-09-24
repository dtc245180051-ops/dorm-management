from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Enum as SQLEnum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.contract import HopDong, YeuCauChuyenTraPhong
    from app.models.incident import PhanAnh, ViPham


class VaiTro(str, enum.Enum):
    QUAN_LY = "QuanLy"
    SINH_VIEN = "SinhVien"
    KE_TOAN = "KeToan"


class TaiKhoan(Base):
    __tablename__ = "tai_khoan"

    ma_tai_khoan: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    ten_dang_nhap: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )
    mat_khau: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    vai_tro: Mapped[VaiTro] = mapped_column(
        SQLEnum(VaiTro, name="vai_tro_enum"),
        nullable=False,
    )

    # Quan hệ 1-1 với NguoiDung
    nguoi_dung: Mapped[Optional["NguoiDung"]] = relationship(
        "NguoiDung",
        back_populates="tai_khoan",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<TaiKhoan(ma_tai_khoan='{self.ma_tai_khoan}', ten_dang_nhap='{self.ten_dang_nhap}', vai_tro='{self.vai_tro}')>"


class NguoiDung(Base):
    __tablename__ = "nguoi_dung"

    ma_nguoi_dung: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    ma_tai_khoan: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("tai_khoan.ma_tai_khoan", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    ho_ten: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    email: Mapped[Optional[str]] = mapped_column(
        String(100),
        unique=True,
        nullable=True,
    )
    so_dien_thoai: Mapped[Optional[str]] = mapped_column(
        String(15),
        nullable=True,
    )

    # Quan hệ đối xứng với TaiKhoan (1-1)
    tai_khoan: Mapped["TaiKhoan"] = relationship(
        "TaiKhoan",
        back_populates="nguoi_dung",
    )

    # Quan hệ 1-1 mở rộng phân quyền vai trò
    sinh_vien: Mapped[Optional["SinhVien"]] = relationship(
        "SinhVien",
        back_populates="nguoi_dung",
        uselist=False,
        cascade="all, delete-orphan",
    )
    quan_ly: Mapped[Optional["QuanLy"]] = relationship(
        "QuanLy",
        back_populates="nguoi_dung",
        uselist=False,
        cascade="all, delete-orphan",
    )
    ke_toan: Mapped[Optional["KeToan"]] = relationship(
        "KeToan",
        back_populates="nguoi_dung",
        uselist=False,
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<NguoiDung(ma_nguoi_dung='{self.ma_nguoi_dung}', ho_ten='{self.ho_ten}', email='{self.email}')>"


class SinhVien(Base):
    __tablename__ = "sinh_vien"

    msv: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
        index=True,
    )
    ma_nguoi_dung: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("nguoi_dung.ma_nguoi_dung", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    lop: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    gioi_tinh: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
    )

    # Quan hệ 1-1 với NguoiDung
    nguoi_dung: Mapped["NguoiDung"] = relationship(
        "NguoiDung",
        back_populates="sinh_vien",
    )

    # Quan hệ 1-N với Hợp đồng, Yêu cầu chuyển/trả phòng, Phản ánh, Vi phạm
    hop_dongs: Mapped[List["HopDong"]] = relationship(
        "HopDong",
        back_populates="sinh_vien",
        cascade="all, delete-orphan",
    )
    yeu_cau_chuyen_tra_phongs: Mapped[List["YeuCauChuyenTraPhong"]] = relationship(
        "YeuCauChuyenTraPhong",
        back_populates="sinh_vien",
        cascade="all, delete-orphan",
    )
    phan_anhs: Mapped[List["PhanAnh"]] = relationship(
        "PhanAnh",
        back_populates="sinh_vien",
        cascade="all, delete-orphan",
    )
    vi_phams: Mapped[List["ViPham"]] = relationship(
        "ViPham",
        back_populates="sinh_vien",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<SinhVien(msv='{self.msv}', lop='{self.lop}', gioi_tinh='{self.gioi_tinh}')>"


class QuanLy(Base):
    __tablename__ = "quan_ly"

    ma_quan_ly: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
    )
    ma_nguoi_dung: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("nguoi_dung.ma_nguoi_dung", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # Quan hệ 1-1 với NguoiDung
    nguoi_dung: Mapped["NguoiDung"] = relationship(
        "NguoiDung",
        back_populates="quan_ly",
    )

    def __repr__(self) -> str:
        return f"<QuanLy(ma_quan_ly='{self.ma_quan_ly}', ma_nguoi_dung='{self.ma_nguoi_dung}')>"


class KeToan(Base):
    __tablename__ = "ke_toan"

    ma_ke_toan: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
    )
    ma_nguoi_dung: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("nguoi_dung.ma_nguoi_dung", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # Quan hệ 1-1 với NguoiDung
    nguoi_dung: Mapped["NguoiDung"] = relationship(
        "NguoiDung",
        back_populates="ke_toan",
    )

    def __repr__(self) -> str:
        return f"<KeToan(ma_ke_toan='{self.ma_ke_toan}', ma_nguoi_dung='{self.ma_nguoi_dung}')>"
