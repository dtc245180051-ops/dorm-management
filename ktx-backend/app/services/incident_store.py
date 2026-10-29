"""(Deprecated / Compatibility Layer) Incident Store.

Toàn bộ dữ liệu phản ánh đã được chuyển đổi hoàn toàn sang MySQL (bảng phan_anh).
Tất cả thao tác đọc/ghi file JSON (data_store_incidents.json) ĐÃ BỊ XÓA BỎ
để đảm bảo tính nhất quán (ACID) của hệ thống.
"""

from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session, joinedload
from app.core.database import SessionLocal
from app.models.incident import PhanAnh
from app.models.user import SinhVien


def _serialize(item: PhanAnh) -> Dict[str, Any]:
    ho_ten = (
        item.sinh_vien.nguoi_dung.ho_ten
        if (item.sinh_vien and item.sinh_vien.nguoi_dung)
        else item.msv
    )
    status_map = {
        "CHO_XU_LY": "Chờ xử lý",
        "DANG_XU_LY": "Đang xử lý",
        "DA_XU_LY": "Đã xử lý",
        "HOAN_THANH": "Đã xử lý",
        "TU_CHOI": "Từ chối",
    }
    return {
        "id": item.ma_phan_anh,
        "ma_phan_anh": item.ma_phan_anh,
        "msv": item.msv,
        "ho_ten": ho_ten,
        "phong": item.phong or "",
        "loai_phan_anh": item.phan_loai or "Cơ sở vật chất",
        "phan_loai": item.phan_loai or "Cơ sở vật chất",
        "tieu_de": item.tieu_de or item.tom_tat or (item.noi_dung[:40] if item.noi_dung else "Sự cố"),
        "mo_ta": item.mo_ta or item.noi_dung or "",
        "hinh_anh": item.hinh_anh,
        "muc_do_uu_tien": item.muc_do_uu_tien or "Thường",
        "trang_thai": item.trang_thai or "CHO_XU_LY",
        "trang_thai_label": status_map.get(item.trang_thai, "Chờ xử lý"),
        "ngay_gui": item.ngay_gui.isoformat() if item.ngay_gui else None,
        "ngay_tao": item.ngay_tao.isoformat() if item.ngay_tao else (item.ngay_gui.isoformat() if item.ngay_gui else None),
        "ghi_chu_xu_ly": item.ghi_chu_xu_ly or "",
        "is_ai_processed": getattr(item, "is_ai_processed", False),
        "ai_error_reason": getattr(item, "ai_error_reason", None),
    }


def get_all_incidents() -> List[Dict[str, Any]]:
    """Lấy danh sách toàn bộ phản ánh trực tiếp từ MySQL."""
    db: Session = SessionLocal()
    try:
        records = (
            db.query(PhanAnh)
            .options(joinedload(PhanAnh.sinh_vien).joinedload(SinhVien.nguoi_dung))
            .order_by(PhanAnh.ngay_tao.desc(), PhanAnh.ngay_gui.desc())
            .all()
        )
        return [_serialize(r) for r in records]
    finally:
        db.close()


def get_incident_by_id(incident_id: str) -> Optional[Dict[str, Any]]:
    """Tìm phản ánh theo mã từ MySQL."""
    db: Session = SessionLocal()
    try:
        clean_id = (incident_id or "").strip()
        rec = (
            db.query(PhanAnh)
            .options(joinedload(PhanAnh.sinh_vien).joinedload(SinhVien.nguoi_dung))
            .filter(PhanAnh.ma_phan_anh.ilike(clean_id))
            .first()
        )
        return _serialize(rec) if rec else None
    finally:
        db.close()


def get_incidents_by_student(msv: str) -> List[Dict[str, Any]]:
    """Lấy danh sách phản ánh của sinh viên từ MySQL."""
    db: Session = SessionLocal()
    try:
        clean_msv = (msv or "").strip()
        records = (
            db.query(PhanAnh)
            .options(joinedload(PhanAnh.sinh_vien).joinedload(SinhVien.nguoi_dung))
            .filter(PhanAnh.msv.ilike(f"%{clean_msv}%"))
            .order_by(PhanAnh.ngay_tao.desc(), PhanAnh.ngay_gui.desc())
            .all()
        )
        return [_serialize(r) for r in records]
    finally:
        db.close()
