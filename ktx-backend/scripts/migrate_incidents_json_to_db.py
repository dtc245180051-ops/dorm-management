"""Migration Script: Chuyển toàn bộ dữ liệu phản ánh từ file JSON (data_store_incidents.json)
sang bảng phan_anh trong CSDL MySQL.

Tính năng:
- Đảm bảo tính toàn vẹn dữ liệu và Foreign Key (tạo sinh viên nếu chưa có).
- Hỗ trợ upsert: Chèn mới nếu chưa tồn tại, cập nhật nếu đã có (tránh trùng lặp theo ID/ma_phan_anh).
- Idempotent: Có thể chạy nhiều lần an toàn mà không làm mất hoặc nhân bản dữ liệu.
- Quản lý Transaction: Rollback nếu có lỗi, commit khi hoàn tất.
"""

import datetime
import json
import os
import sys
from typing import Optional, Tuple

if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Thêm thư mục gốc ktx-backend vào sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.incident import PhanAnh
from app.models.user import NguoiDung, SinhVien, TaiKhoan, VaiTro


def parse_date(val: Optional[str]) -> datetime.date:
    """Chuyển đổi chuỗi ngày tháng sang datetime.date."""
    if not val:
        return datetime.date.today()
    val_str = str(val).strip()
    # Nếu là ISO datetime dạng 2026-10-27T09:47:06.056633 hoặc 2026-10-27
    if "T" in val_str:
        val_str = val_str.split("T")[0]
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.datetime.strptime(val_str, fmt).date()
        except ValueError:
            continue
    return datetime.date.today()


def parse_datetime(val: Optional[str]) -> datetime.datetime:
    """Chuyển đổi chuỗi ngày giờ sang datetime.datetime."""
    if not val:
        return datetime.datetime.now()
    val_str = str(val).strip()
    if "." in val_str:
        # Cắt bớt microsecond nếu dài hơn 6 chữ số
        parts = val_str.split(".")
        val_str = f"{parts[0]}.{parts[1][:6]}"
    for fmt in (
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%d/%m/%Y %H:%M",
    ):
        try:
            return datetime.datetime.strptime(val_str, fmt)
        except ValueError:
            continue
    return datetime.datetime.now()


def ensure_student_exists(db: Session, msv: str, info: dict) -> str:
    """Đảm bảo sinh viên và tài khoản tồn tại trong MySQL để thỏa mãn khóa ngoại."""
    clean_msv = (msv or "").strip()
    if not clean_msv:
        # Lấy sinh viên đầu tiên trong DB làm fallback nếu không có MSV
        first_sv = db.query(SinhVien).first()
        return first_sv.msv if first_sv else "DTC245180037"

    # Tìm sinh viên không phân biệt hoa thường
    student = db.query(SinhVien).filter(SinhVien.msv.ilike(clean_msv)).first()
    if student:
        return student.msv

    # Nếu chưa tồn tại, tự động tạo tài khoản và người dùng tương ứng
    normalized_msv = clean_msv.upper()
    ho_ten = info.get("ho_ten") or f"Sinh viên {normalized_msv}"
    email = f"{normalized_msv.lower()}@ictu.edu.vn"

    user = db.query(NguoiDung).filter(NguoiDung.email == email).first()
    if not user:
        tai_khoan = TaiKhoan(
            ten_dang_nhap=normalized_msv.lower(),
            mat_khau=get_password_hash("123456"),
            vai_tro=VaiTro.SINH_VIEN,
        )
        db.add(tai_khoan)
        db.flush()

        user = NguoiDung(
            ma_tai_khoan=tai_khoan.ma_tai_khoan,
            ho_ten=ho_ten,
            email=email,
            so_dien_thoai="",
        )
        db.add(user)
        db.flush()

    student = SinhVien(
        msv=normalized_msv,
        ma_nguoi_dung=user.ma_nguoi_dung,
        lop="Chưa phân lớp",
        gioi_tinh="Nam",
        khoa="Công nghệ Thông tin",
        dia_chi="",
        cccd="",
        ngay_sinh="2000-01-01",
        doi_tuong_uu_tien="Không",
    )
    db.add(student)
    db.flush()
    print(f"  [+] Đã tự động tạo hồ sơ sinh viên cho MSV: {normalized_msv}")
    return student.msv


def migrate_incidents():
    json_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "app",
        "data_store_incidents.json",
    )

    if not os.path.exists(json_path):
        print(f"[-] Không tìm thấy tệp JSON tại: {json_path}")
        return

    print(f"[*] Bắt đầu đọc dữ liệu phản ánh từ: {json_path}")
    with open(json_path, "r", encoding="utf-8") as f:
        try:
            records = json.load(f)
        except Exception as e:
            print(f"[-] Lỗi cú pháp JSON: {e}")
            return

    if not isinstance(records, list):
        print("[-] Dữ liệu JSON không phải dạng danh sách (list).")
        return

    print(f"[*] Tìm thấy {len(records)} phản ánh trong tệp JSON.")

    db: Session = SessionLocal()
    inserted_count = 0
    updated_count = 0

    try:
        for idx, item in enumerate(records, 1):
            inc_id = (item.get("id") or item.get("ma_phan_anh") or "").strip()
            if not inc_id:
                print(f"  [-] Dòng {idx}: Bỏ qua vì thiếu mã phản ánh (id/ma_phan_anh).")
                continue

            raw_msv = item.get("msv", "")
            valid_msv = ensure_student_exists(db, raw_msv, item)

            phan_loai = item.get("phan_loai") or item.get("loai_phan_anh") or "Cơ sở vật chất"
            tieu_de = item.get("tieu_de") or "Sự cố phòng"
            mo_ta = item.get("mo_ta") or item.get("noi_dung") or ""
            muc_do_uu_tien = item.get("muc_do_uu_tien") or "Thường"
            phong = item.get("phong") or ""
            trang_thai = item.get("trang_thai") or "CHO_XU_LY"
            ghi_chu = item.get("ghi_chu_xu_ly") or ""
            hinh_anh = item.get("hinh_anh")
            is_ai = bool(item.get("is_ai_processed", False))
            ai_err = item.get("ai_error_reason")

            ngay_gui = parse_date(item.get("ngay_gui"))
            ngay_tao = parse_datetime(item.get("ngay_tao") or item.get("ngay_gui"))

            # Kiểm tra xem mã phản ánh đã có trong MySQL chưa
            existing = db.query(PhanAnh).filter(PhanAnh.ma_phan_anh == inc_id).first()

            if existing:
                # Upsert / đồng bộ các trường
                existing.msv = valid_msv
                existing.noi_dung = mo_ta or existing.noi_dung or tieu_de
                existing.trang_thai = trang_thai
                existing.ngay_gui = ngay_gui
                existing.phan_loai = phan_loai
                existing.tom_tat = tieu_de[:200]
                existing.tieu_de = tieu_de
                existing.muc_do_uu_tien = muc_do_uu_tien
                existing.phong = phong
                existing.mo_ta = mo_ta
                if hinh_anh is not None:
                    existing.hinh_anh = hinh_anh
                if ghi_chu:
                    existing.ghi_chu_xu_ly = ghi_chu
                if not existing.ngay_tao:
                    existing.ngay_tao = ngay_tao
                if is_ai:
                    existing.is_ai_processed = is_ai
                if ai_err:
                    existing.ai_error_reason = ai_err

                updated_count += 1
            else:
                # Chèn mới
                new_pa = PhanAnh(
                    ma_phan_anh=inc_id,
                    msv=valid_msv,
                    noi_dung=mo_ta or tieu_de,
                    trang_thai=trang_thai,
                    ngay_gui=ngay_gui,
                    phan_loai=phan_loai,
                    tom_tat=tieu_de[:200],
                    tieu_de=tieu_de,
                    muc_do_uu_tien=muc_do_uu_tien,
                    phong=phong,
                    mo_ta=mo_ta,
                    hinh_anh=hinh_anh,
                    ghi_chu_xu_ly=ghi_chu,
                    ngay_tao=ngay_tao,
                    is_ai_processed=is_ai,
                    ai_error_reason=ai_err,
                )
                db.add(new_pa)
                inserted_count += 1

        db.commit()
        print(f"[+] Hoàn tất Data Migration thành công!")
        print(f"    - Số phản ánh chèn mới (INSERT): {inserted_count}")
        print(f"    - Số phản ánh cập nhật/đồng bộ (UPSERT): {updated_count}")
        print(f"    - Tổng số phản ánh đã xử lý: {inserted_count + updated_count}")

    except Exception as e:
        db.rollback()
        print(f"[-] Gặp lỗi trong quá trình migration, đã rollback transaction: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate_incidents()
