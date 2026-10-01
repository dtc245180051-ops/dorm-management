from __future__ import annotations

import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.invoice import HoaDon
    from app.models.user import SinhVien


class SoCongNo(Base):
    __tablename__ = "so_cong_no"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    ma_hoa_don: Mapped[str] = mapped_column(
        String(30),
        ForeignKey("hoa_don.ma_hoa_don", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    msv: Mapped[Optional[str]] = mapped_column(
        String(20),
        ForeignKey("sinh_vien.msv", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    so_phong: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    loai_cong_no: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    ky_thanh_toan: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    tong_tien: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    da_tra: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
    )
    con_thieu: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    han_thanh_toan: Mapped[Optional[datetime.date]] = mapped_column(
        Date,
        nullable=True,
    )
    trang_thai: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="CON_NO",
    )
    ghi_chu: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    ngay_cap_nhat: Mapped[datetime.datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.datetime.now,
        onupdate=datetime.datetime.now,
    )

    hoa_don: Mapped[Optional["HoaDon"]] = relationship("HoaDon")
    sinh_vien: Mapped[Optional["SinhVien"]] = relationship("SinhVien")

    def __repr__(self) -> str:
        return (
            f"<SoCongNo(id={self.id}, ma_hoa_don='{self.ma_hoa_don}', "
            f"msv='{self.msv}', con_thieu={self.con_thieu}, trang_thai='{self.trang_thai}')>"
        )
