from __future__ import annotations

import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Date, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.dorm import Giuong
    from app.models.user import SinhVien


class HopDong(Base):
    __tablename__ = "hop_dong"

    ma_hop_dong: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
    )
    msv: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("sinh_vien.msv", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ma_giuong: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("giuong.ma_giuong", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ngay_bat_dau: Mapped[datetime.date] = mapped_column(
        Date,
        nullable=False,
    )
    ngay_ket_thuc: Mapped[Optional[datetime.date]] = mapped_column(
        Date,
        nullable=True,
    )
    trang_thai: Mapped[str] = mapped_column(
        String(20),
        default="ACTIVE",
        nullable=False,
        index=True,
    )

    # Quan hệ N-1 với SinhVien và Giuong
    sinh_vien: Mapped["SinhVien"] = relationship(
        "SinhVien",
        back_populates="hop_dongs",
    )
    giuong: Mapped["Giuong"] = relationship(
        "Giuong",
        back_populates="hop_dongs",
    )

    # Quan hệ 1-N với YeuCauChuyenTraPhong và Phi
    yeu_cau_chuyen_tra_phongs: Mapped[List["YeuCauChuyenTraPhong"]] = relationship(
        "YeuCauChuyenTraPhong",
        back_populates="hop_dong",
        cascade="all, delete-orphan",
    )
    phis: Mapped[List["Phi"]] = relationship(
        "Phi",
        back_populates="hop_dong",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<HopDong(ma_hop_dong='{self.ma_hop_dong}', msv='{self.msv}', ma_giuong='{self.ma_giuong}', trang_thai='{self.trang_thai}')>"


class YeuCauChuyenTraPhong(Base):
    __tablename__ = "yeu_cau_chuyen_tra_phong"

    ma_yeu_cau: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
    )
    msv: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("sinh_vien.msv", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ma_hop_dong: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("hop_dong.ma_hop_dong", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    loai_yeu_cau: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    trang_thai: Mapped[str] = mapped_column(
        String(20),
        default="CHO_DUYET",
        nullable=False,
        index=True,
    )

    # Quan hệ N-1 với SinhVien và HopDong
    sinh_vien: Mapped["SinhVien"] = relationship(
        "SinhVien",
        back_populates="yeu_cau_chuyen_tra_phongs",
    )
    hop_dong: Mapped["HopDong"] = relationship(
        "HopDong",
        back_populates="yeu_cau_chuyen_tra_phongs",
    )

    def __repr__(self) -> str:
        return f"<YeuCauChuyenTraPhong(ma_yeu_cau='{self.ma_yeu_cau}', msv='{self.msv}', loai='{self.loai_yeu_cau}', trang_thai='{self.trang_thai}')>"


class Phi(Base):
    __tablename__ = "phi"

    ma_phi: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
    )
    ma_hop_dong: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("hop_dong.ma_hop_dong", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    loai_phi: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    so_tien: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    han_nop: Mapped[datetime.date] = mapped_column(
        Date,
        nullable=False,
    )

    # Quan hệ N-1 với HopDong
    hop_dong: Mapped["HopDong"] = relationship(
        "HopDong",
        back_populates="phis",
    )

    # Quan hệ 1-N với ThanhToan
    thanh_toans: Mapped[List["ThanhToan"]] = relationship(
        "ThanhToan",
        back_populates="phi",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Phi(ma_phi='{self.ma_phi}', ma_hop_dong='{self.ma_hop_dong}', loai_phi='{self.loai_phi}', so_tien={self.so_tien})>"


class ThanhToan(Base):
    __tablename__ = "thanh_toan"

    ma_thanh_toan: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
    )
    ma_phi: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("phi.ma_phi", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    so_tien_da_dong: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    ngay_thanh_toan: Mapped[datetime.date] = mapped_column(
        Date,
        nullable=False,
    )

    # Quan hệ N-1 với Phi
    phi: Mapped["Phi"] = relationship(
        "Phi",
        back_populates="thanh_toans",
    )

    def __repr__(self) -> str:
        return f"<ThanhToan(ma_thanh_toan='{self.ma_thanh_toan}', ma_phi='{self.ma_phi}', so_tien_da_dong={self.so_tien_da_dong})>"
