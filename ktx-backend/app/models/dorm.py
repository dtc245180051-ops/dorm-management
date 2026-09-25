from __future__ import annotations

from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.contract import HopDong


class ToaNha(Base):
    __tablename__ = "toa_nha"

    ma_toa: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
    )
    ten_toa: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )

    # Quan hệ 1-N với Tang
    tangs: Mapped[List["Tang"]] = relationship(
        "Tang",
        back_populates="toa_nha",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<ToaNha(ma_toa='{self.ma_toa}', ten_toa='{self.ten_toa}')>"


class Tang(Base):
    __tablename__ = "tang"

    ma_tang: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
    )
    so_tang: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    ma_toa: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("toa_nha.ma_toa", ondelete="CASCADE"),
        nullable=False,
    )

    # Quan hệ N-1 với ToaNha
    toa_nha: Mapped["ToaNha"] = relationship(
        "ToaNha",
        back_populates="tangs",
    )

    # Quan hệ 1-N với Phong
    phongs: Mapped[List["Phong"]] = relationship(
        "Phong",
        back_populates="tang",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Tang(ma_tang='{self.ma_tang}', so_tang={self.so_tang}, ma_toa='{self.ma_toa}')>"


class Phong(Base):
    __tablename__ = "phong"

    ma_phong: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
    )
    so_phong: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    suc_chua: Mapped[int] = mapped_column(
        Integer,
        default=4,
        nullable=False,
    )
    loai_phong: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    hinh_anh: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    ma_tang: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("tang.ma_tang", ondelete="CASCADE"),
        nullable=False,
    )

    # Quan hệ N-1 với Tang
    tang: Mapped["Tang"] = relationship(
        "Tang",
        back_populates="phongs",
    )

    # Quan hệ 1-N với Giuong
    giuongs: Mapped[List["Giuong"]] = relationship(
        "Giuong",
        back_populates="phong",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Phong(ma_phong='{self.ma_phong}', so_phong='{self.so_phong}', suc_chua={self.suc_chua})>"


class Giuong(Base):
    __tablename__ = "giuong"

    ma_giuong: Mapped[str] = mapped_column(
        String(20),
        primary_key=True,
    )
    trang_thai: Mapped[str] = mapped_column(
        String(20),
        default="TRONG",
        nullable=False,
        index=True,
    )
    ma_phong: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("phong.ma_phong", ondelete="CASCADE"),
        nullable=False,
    )

    # Quan hệ N-1 với Phong
    phong: Mapped["Phong"] = relationship(
        "Phong",
        back_populates="giuongs",
    )

    # Quan hệ 1-N với HopDong
    hop_dongs: Mapped[List["HopDong"]] = relationship(
        "HopDong",
        back_populates="giuong",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<Giuong(ma_giuong='{self.ma_giuong}', trang_thai='{self.trang_thai}', ma_phong='{self.ma_phong}')>"
