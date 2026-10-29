from __future__ import annotations

import datetime
from typing import TYPE_CHECKING, Any, Dict, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.dorm import Phong
    from app.models.user import NguoiDung, SinhVien


class RoomRequest(Base):
    __tablename__ = "room_requests"

    # 1. Khóa chính tự tăng
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    # Mã yêu cầu nghiệp vụ (ví dụ: DK-1F2AAF, YC-0236)
    ma_yeu_cau: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )

    # 2. Khóa ngoại liên kết người dùng / sinh viên
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("nguoi_dung.ma_nguoi_dung", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    student_id: Mapped[Optional[str]] = mapped_column(
        String(20),
        ForeignKey("sinh_vien.msv", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # 3. Loại đơn: DANG_KY, CHUYEN_PHONG, TRA_PHONG
    loai_don: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    # 4. Phòng hiện tại & Phòng mong muốn (Foreign Key tới phong.ma_phong)
    phong_hien_tai_id: Mapped[Optional[str]] = mapped_column(
        String(20),
        ForeignKey("phong.ma_phong", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    phong_mong_muon_id: Mapped[Optional[str]] = mapped_column(
        String(20),
        ForeignKey("phong.ma_phong", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # 5. Lý do gửi đơn
    ly_do: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # 6. Trạng thái xử lý ("PENDING", "APPROVED", "REJECTED" hoặc "CHO_DUYET", "DA_DUYET", "TU_CHOI")
    trang_thai: Mapped[str] = mapped_column(
        String(30),
        default="PENDING",
        nullable=False,
        index=True,
    )

    # Lý do từ chối (nếu có)
    ly_do_tu_choi: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # Dữ liệu bổ sung (JSON: thông tin sinh viên, nguyện vọng, địa chỉ trả phòng, cấu hình xếp phòng,...)
    extra_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True,
    )

    # 7. Thời gian tạo và cập nhật
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime,
        default=datetime.datetime.now,
        nullable=False,
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime,
        default=datetime.datetime.now,
        onupdate=datetime.datetime.now,
        nullable=False,
    )

    # Synonyms để hỗ trợ cả tên tiếng Việt lẫn tiếng Anh chuẩn
    request_type = synonym("loai_don")
    current_room_id = synonym("phong_hien_tai_id")
    target_room_id = synonym("phong_mong_muon_id")
    reason = synonym("ly_do")
    status = synonym("trang_thai")

    # Quan hệ ORM
    user: Mapped[Optional["NguoiDung"]] = relationship(
        "NguoiDung",
        foreign_keys=[user_id],
        back_populates="room_requests",
    )
    student: Mapped[Optional["SinhVien"]] = relationship(
        "SinhVien",
        foreign_keys=[student_id],
        back_populates="room_requests",
    )
    phong_hien_tai: Mapped[Optional["Phong"]] = relationship(
        "Phong",
        foreign_keys=[phong_hien_tai_id],
    )
    phong_mong_muon: Mapped[Optional["Phong"]] = relationship(
        "Phong",
        foreign_keys=[phong_mong_muon_id],
    )

    def to_dict(self) -> Dict[str, Any]:
        """Chuyển đổi thực thể ORM sang định dạng dictionary đồng bộ với Frontend."""
        data = dict(self.extra_data or {})

        # Gán hoặc ghi đè các trường cốt lõi
        data["db_id"] = self.id
        data["id"] = self.ma_yeu_cau or f"YC-{self.id:04d}"
        data["ma_yeu_cau"] = self.ma_yeu_cau or f"YC-{self.id:04d}"
        data["user_id"] = self.user_id
        data["student_id"] = self.student_id
        data["msv"] = self.student_id or data.get("msv", "")
        data["loai_don"] = self.loai_don
        data["request_type"] = self.loai_don

        if self.loai_don in ("DANG_KY", "Đăng ký"):
            data["loai_yeu_cau"] = "Đăng ký"
        elif self.loai_don in ("CHUYEN_PHONG", "Chuyển phòng"):
            data["loai_yeu_cau"] = "Chuyển phòng"
        elif self.loai_don in ("TRA_PHONG", "Trả phòng"):
            data["loai_yeu_cau"] = "Trả phòng"
        else:
            data["loai_yeu_cau"] = self.loai_don

        if self.phong_hien_tai_id:
            data["phong_hien_tai_id"] = self.phong_hien_tai_id
            if not data.get("phong_hien_tai"):
                data["phong_hien_tai"] = self.phong_hien_tai_id

        if self.phong_mong_muon_id:
            data["phong_mong_muon_id"] = self.phong_mong_muon_id
            if not data.get("phong_mong_muon"):
                data["phong_mong_muon"] = self.phong_mong_muon_id

        if self.ly_do is not None:
            data["ly_do"] = self.ly_do
            data["reason"] = self.ly_do

        # Chuẩn hóa trạng thái
        st = self.trang_thai
        data["trang_thai"] = st
        data["status"] = st
        if st in ("APPROVED", "DA_DUYET"):
            data["trang_thai_label"] = "Đã duyệt"
        elif st in ("REJECTED", "TU_CHOI"):
            data["trang_thai_label"] = "Từ chối"
        else:
            data["trang_thai_label"] = "Đang xét duyệt" if self.loai_don == "DANG_KY" else "Chờ duyệt"

        if self.ly_do_tu_choi:
            data["ly_do_tu_choi"] = self.ly_do_tu_choi

        if self.created_at:
            date_str = self.created_at.strftime("%d/%m/%Y")
            time_str = self.created_at.strftime("%H:%M")
            data["created_at"] = self.created_at.isoformat()
            data.setdefault("ngay_dang_ky", date_str)
            data.setdefault("ngay_gui", f"{date_str} {time_str}")
            data.setdefault("ngay_gui_time", f"{date_str} {time_str}")

        if self.updated_at:
            data["updated_at"] = self.updated_at.isoformat()

        return data

    def __repr__(self) -> str:
        return (
            f"<RoomRequest(id={self.id}, ma_yeu_cau='{self.ma_yeu_cau}', "
            f"student_id='{self.student_id}', loai_don='{self.loai_don}', "
            f"trang_thai='{self.trang_thai}')>"
        )
