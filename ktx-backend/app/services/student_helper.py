from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.user import TaiKhoan, NguoiDung, SinhVien


def resolve_student_msv(code: Optional[str], db: Session) -> Optional[str]:
    """
    Chuẩn hóa và tra cứu mã sinh viên (MSV) chuẩn trong CSDL từ bất kỳ định danh nào:
    - Mã sinh viên (VD: DTC234111098, DTC245180051)
    - Tên đăng nhập (VD: mina, hehehe, jollibee, dtc245180051)
    - Email sinh viên trường (VD: mina@ictu.edu.vn)
    """
    if not code:
        return None
    clean = str(code).strip()
    if not clean:
        return None

    # 1. Khớp trực tiếp trên bảng SinhVien theo cột msv (không phân biệt hoa/thường)
    sv = db.query(SinhVien).filter(SinhVien.msv.ilike(clean)).first()
    if sv and sv.msv:
        return sv.msv

    # 2. Khớp qua tên đăng nhập của Tài khoản (TaiKhoan.ten_dang_nhap -> NguoiDung -> SinhVien)
    sv = (
        db.query(SinhVien)
        .join(NguoiDung, SinhVien.ma_nguoi_dung == NguoiDung.ma_nguoi_dung)
        .join(TaiKhoan, NguoiDung.ma_tai_khoan == TaiKhoan.ma_tai_khoan)
        .filter(TaiKhoan.ten_dang_nhap.ilike(clean))
        .first()
    )
    if sv and sv.msv:
        return sv.msv

    # 3. Khớp qua email của Người dùng (NguoiDung.email)
    prefix = clean.split("@")[0].strip() if "@" in clean else clean
    sv = (
        db.query(SinhVien)
        .join(NguoiDung, SinhVien.ma_nguoi_dung == NguoiDung.ma_nguoi_dung)
        .filter(or_(
            NguoiDung.email.ilike(clean),
            NguoiDung.email.ilike(f"{prefix}@%")
        ))
        .first()
    )
    if sv and sv.msv:
        return sv.msv

    return clean.upper()
