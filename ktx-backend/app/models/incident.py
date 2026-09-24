from __future__ import annotations

import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import SinhVien


class PhanAnh(Base):
    __tablename__ = "phan_anh"

    ma_phan_anh: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
    )
    msv: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("sinh_vien.msv", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    noi_dung: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    trang_thai: Mapped[str] = mapped_column(
        String(20),
        default="TIEP_NHAN",
        nullable=False,
        index=True,
    )
    ngay_gui: Mapped[datetime.date] = mapped_column(
        Date,
        nullable=False,
    )
    # Hỗ trợ tính năng AI phân loại và tóm tắt sự cố
    phan_loai: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    tom_tat: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # Quan hệ N-1 với SinhVien
    sinh_vien: Mapped["SinhVien"] = relationship(
        "SinhVien",
        back_populates="phan_anhs",
    )

    def __repr__(self) -> str:
        return f"<PhanAnh(ma_phan_anh='{self.ma_phan_anh}', msv='{self.msv}', trang_thai='{self.trang_thai}', phan_loai='{self.phan_loai}')>"


class ViPham(Base):
    __tablename__ = "vi_pham"

    ma_vi_pham: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
    )
    msv: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("sinh_vien.msv", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mo_ta: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    ngay_vi_pham: Mapped[datetime.date] = mapped_column(
        Date,
        nullable=False,
    )
    hinh_thuc_xu_ly: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    # Quan hệ N-1 với SinhVien
    sinh_vien: Mapped["SinhVien"] = relationship(
        "SinhVien",
        back_populates="vi_phams",
    )

    def __repr__(self) -> str:
        return f"<ViPham(ma_vi_pham='{self.ma_vi_pham}', msv='{self.msv}', ngay_vi_pham={self.ngay_vi_pham})>"


class NoiQuy(Base):
    __tablename__ = "noi_quy"

    ma_noi_quy: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
    )
    noi_dung: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<NoiQuy(ma_noi_quy='{self.ma_noi_quy}')>"
