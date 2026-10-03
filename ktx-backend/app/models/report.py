from __future__ import annotations

import datetime
from typing import Optional
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, Date
from app.core.database import Base


class BaoCaoDinhKy(Base):
    __tablename__ = "bao_cao_dinh_ky"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ma_bao_cao = Column(String(50), unique=True, nullable=False, index=True)
    tieu_de = Column(String(255), nullable=False)
    loai_bao_cao = Column(String(30), nullable=False, default="THANG")  # THANG, QUY, NAM, DOT_XUAT
    ky_bao_cao = Column(String(50), nullable=False, index=True)
    nguoi_lap = Column(String(100), nullable=False)
    nguoi_duyet = Column(String(100), nullable=True)
    ngay_lap = Column(Date, nullable=False, default=datetime.date.today)
    
    # Số liệu tổng hợp
    tong_thu_du_kien = Column(Float, nullable=False, default=0.0)
    thuc_thu = Column(Float, nullable=False, default=0.0)
    ty_le_thu = Column(Float, nullable=False, default=0.0)
    tong_cong_no = Column(Float, nullable=False, default=0.0)
    so_sv_con_no = Column(Integer, nullable=False, default=0)
    no_qua_han = Column(Float, nullable=False, default=0.0)
    
    # Nhận xét & đề xuất
    nhan_xet = Column(Text, nullable=True)
    kien_nghi = Column(Text, nullable=True)
    du_lieu_json = Column(Text, nullable=True)  # JSON serialize summary & top items
    
    ngay_tao = Column(DateTime, nullable=False, default=datetime.datetime.now)

    def __repr__(self) -> str:
        return f"<BaoCaoDinhKy(ma='{self.ma_bao_cao}', ky='{self.ky_bao_cao}', nguoi_lap='{self.nguoi_lap}')>"
