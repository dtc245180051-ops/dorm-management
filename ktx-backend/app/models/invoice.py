from __future__ import annotations

import datetime
import enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.contract import HopDong


class LoaiHoaDon(str, enum.Enum):
    TIEN_PHONG = "TIEN_PHONG"
    DIEN_NUOC = "DIEN_NUOC"


class TrangThaiHoaDon(str, enum.Enum):
    CHUA_THANH_TOAN = "CHUA_THANH_TOAN"
    DA_THANH_TOAN = "DA_THANH_TOAN"
    QUA_HAN = "QUA_HAN"
    DA_HUY = "DA_HUY"


class HoaDon(Base):
    __tablename__ = "hoa_don"

    ma_hoa_don: Mapped[str] = mapped_column(
        String(30),
        primary_key=True,
    )
    ma_hop_dong: Mapped[Optional[str]] = mapped_column(
        String(20),
        ForeignKey("hop_dong.ma_hop_dong", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    hop_dong: Mapped[Optional["HopDong"]] = relationship(
        "HopDong",
    )

    msv: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        index=True,
    )
    ho_ten: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    ma_phong: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        index=True,
    )
    so_phong: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    loai_hoa_don: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )  # TIEN_PHONG hoặc DIEN_NUOC
    ky_thanh_toan: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )  # Ví dụ: "Học kỳ I (2026 – 2027)" hoặc "Tháng 09/2026"
    so_tien: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    ngay_lap: Mapped[datetime.date] = mapped_column(
        Date,
        nullable=False,
        default=datetime.date.today,
    )
    han_thanh_toan: Mapped[datetime.date] = mapped_column(
        Date,
        nullable=False,
    )
    trang_thai: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=TrangThaiHoaDon.CHUA_THANH_TOAN.value,
        index=True,
    )
    ghi_chu: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    nguoi_tao: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    ngay_tao: Mapped[datetime.datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.datetime.now,
    )

    def __repr__(self) -> str:
        return f"<HoaDon(ma_hoa_don='{self.ma_hoa_don}', loai='{self.loai_hoa_don}', ky='{self.ky_thanh_toan}', so_tien={self.so_tien}, trang_thai='{self.trang_thai}')>"
