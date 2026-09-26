from __future__ import annotations

import datetime
import enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.invoice import HoaDon
    from app.models.user import SinhVien


class TrangThaiDoiSoat(str, enum.Enum):
    MATCHED = "MATCHED"
    AUTO_MATCHED = "AUTO_MATCHED"
    INVALID_SYNTAX = "INVALID_SYNTAX"
    STUDENT_NOT_FOUND = "STUDENT_NOT_FOUND"
    MANUAL_REQUIRED = "MANUAL_REQUIRED"
    MATCHED_MANUALLY = "MATCHED_MANUALLY"
    ERROR = "ERROR"
    PARTIAL = "PARTIAL"  # Chuyển thiếu


class GiaoDichNganHang(Base):
    __tablename__ = "giao_dich_ngan_hang"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    ma_giao_dich_ngan_hang: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )
    ngay_giao_dich: Mapped[datetime.datetime] = mapped_column(
        DateTime,
        nullable=False,
        index=True,
    )
    so_tien: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    noi_dung_chuyen_khoan: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    ten_ngan_hang: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="TP Bank",
    )
    so_tai_khoan: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    trang_thai: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=TrangThaiDoiSoat.MANUAL_REQUIRED.value,
        index=True,
    )
    ma_hoa_don: Mapped[Optional[str]] = mapped_column(
        String(30),
        ForeignKey("hoa_don.ma_hoa_don", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    msv: Mapped[Optional[str]] = mapped_column(
        String(20),
        ForeignKey("sinh_vien.msv", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    ghi_chu_doi_soat: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    nguoi_xu_ly: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    ngay_tao: Mapped[datetime.datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.datetime.now,
    )
    ngay_cap_nhat: Mapped[datetime.datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.datetime.now,
        onupdate=datetime.datetime.now,
    )

    hoa_don: Mapped[Optional["HoaDon"]] = relationship(
        "HoaDon",
        foreign_keys=[ma_hoa_don],
    )
    sinh_vien: Mapped[Optional["SinhVien"]] = relationship(
        "SinhVien",
        foreign_keys=[msv],
    )

    def __repr__(self) -> str:
        return f"<GiaoDichNganHang(id={self.id}, code='{self.ma_giao_dich_ngan_hang}', amount={self.so_tien}, status='{self.trang_thai}')>"
