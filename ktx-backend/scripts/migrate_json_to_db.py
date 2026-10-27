"""Script di chuyển (Data Migration) dữ liệu từ file JSON cục bộ sang cơ sở dữ liệu MySQL (bảng room_requests).

Đảm bảo an toàn tính toàn vẹn quan hệ (Foreign Keys), không làm mất dữ liệu đã test và cho phép chạy nhiều lần (idempotent).
"""

import datetime
import json
import os
import re
import sys
import uuid
from typing import Any, Optional

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
from app.models.dorm import Phong
from app.models.room_request import RoomRequest
from app.models.user import NguoiDung, SinhVien, TaiKhoan, VaiTro


def parse_datetime(val: str) -> datetime.datetime:
    """Chuyển đổi chuỗi ngày tháng định dạng dd/mm/YYYY HH:MM hoặc dd/mm/YYYY sang datetime."""
    if not val:
        return datetime.datetime.utcnow()
    val = str(val).strip()
    for fmt in ("%d/%m/%Y %H:%M", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(val, fmt)
        except ValueError:
            continue
    return datetime.datetime.utcnow()


def ensure_student_exists(db: Session, msv: str, info: dict) -> tuple[Optional[str], Optional[str]]:
    """Đảm bảo sinh viên và người dùng tồn tại để thỏa mãn khóa ngoại."""
    clean_msv = msv.strip().upper()
    if not clean_msv:
        return None, None

    student = db.query(SinhVien).filter(SinhVien.msv == clean_msv).first()
    if student:
        return student.msv, student.ma_nguoi_dung

    # Nếu chưa có sinh viên, tạo tài khoản và người dùng tương ứng
    ho_ten = info.get("ho_ten") or "Sinh viên KTX"
    email = info.get("email") or f"{clean_msv.lower()}@ictu.edu.vn"
    phone = info.get("so_dien_thoai") or ""

    user = db.query(NguoiDung).filter(NguoiDung.email == email).first()
    if not user:
        tai_khoan = TaiKhoan(
            ten_dang_nhap=clean_msv.lower(),
            mat_khau=get_password_hash("123456"),
            vai_tro=VaiTro.SINH_VIEN,
        )
        db.add(tai_khoan)
        db.flush()

        user = NguoiDung(
            ma_tai_khoan=tai_khoan.ma_tai_khoan,
            ho_ten=ho_ten,
            email=email,
            so_dien_thoai=phone,
        )
        db.add(user)
        db.flush()

    student = SinhVien(
        msv=clean_msv,
        ma_nguoi_dung=user.ma_nguoi_dung,
        lop=info.get("lop") or "Chưa phân lớp",
        gioi_tinh=info.get("gioi_tinh") or "Nam",
        khoa=info.get("khoa") or "",
        dia_chi=info.get("dia_chi") or "",
        cccd=info.get("cccd") or "",
        ngay_sinh=info.get("ngay_sinh") or "",
        doi_tuong_uu_tien=info.get("doi_tuong_uu_tien") or "Không thuộc diện ưu tiên",
        nguoi_giam_ho=info.get("nguoi_giam_ho") or "",
        moi_quan_he=info.get("moi_quan_he") or "",
        sdt_nguoi_giam_ho=info.get("sdt_nguoi_giam_ho") or "",
    )
    db.add(student)
    db.flush()
    return student.msv, user.ma_nguoi_dung


def find_matching_room(db: Session, text: str) -> Optional[str]:
    """Tìm mã phòng hợp lệ trong bảng Phong dựa trên chuỗi văn bản."""
    if not text:
        return None
    clean = str(text).strip()

    # Thử tìm trực tiếp theo ma_phong
    p = db.query(Phong).filter(Phong.ma_phong == clean).first()
    if p:
        return p.ma_phong

    # Thử tìm theo so_phong nếu text chỉ là số phòng (ví dụ "101", "P101", "B101")
    digits = re.findall(r"\d+", clean)
    if digits:
        p = db.query(Phong).filter(Phong.so_phong == digits[0]).first()
        if p:
            return p.ma_phong

    # Thử tìm chứa chuỗi
    p = db.query(Phong).filter(Phong.ma_phong.ilike(f"%{clean}%")).first()
    if p:
        return p.ma_phong

    return None


def migrate_data():
    json_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "app", "data_store_requests.json")
    if not os.path.exists(json_path):
        print(f"[-] Không tìm thấy tệp JSON tại: {json_path}")
        return

    print(f"[*] Đọc dữ liệu từ: {json_path}")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Đảm bảo bảng room_requests đã tồn tại
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    reg_requests = data.get("REGISTRATION_REQUESTS", [])
    tc_requests = data.get("TRANSFER_CHECKOUT_REQUESTS", [])

    total_inserted = 0
    total_skipped = 0

    print(f"[*] Bắt đầu xử lý {len(reg_requests)} đơn đăng ký...")
    for item in reg_requests:
        req_code = item.get("id") or item.get("ma_yeu_cau")
        if not req_code:
            continue

        # Kiểm tra trùng lặp mã đơn (idempotency)
        existing = db.query(RoomRequest).filter(RoomRequest.ma_yeu_cau == req_code).first()
        if existing:
            total_skipped += 1
            continue

        raw_msv = (item.get("msv") or "").strip().upper()
        student_id, user_id = ensure_student_exists(db, raw_msv, item) if raw_msv else (None, None)

        target_room_id = find_matching_room(db, item.get("ma_phong") or item.get("nguyen_vong_phong") or "")

        status = item.get("trang_thai", "PENDING")
        reason = item.get("nguyen_vong") or item.get("noi_dung_nguyen_vong") or item.get("nguyen_vong_label") or "Đăng ký ở KTX"
        created_at = parse_datetime(item.get("ngay_gui") or item.get("ngay_dang_ky"))

        new_req = RoomRequest(
            ma_yeu_cau=req_code,
            student_id=student_id,
            user_id=user_id,
            loai_don="DANG_KY",
            phong_hien_tai_id=None,
            phong_mong_muon_id=target_room_id,
            ly_do=reason,
            trang_thai=status,
            ly_do_tu_choi=item.get("ly_do_tu_choi"),
            extra_data=item,
            created_at=created_at,
            updated_at=created_at,
        )
        db.add(new_req)
        total_inserted += 1

    print(f"[*] Bắt đầu xử lý {len(tc_requests)} đơn chuyển/trả phòng...")
    for item in tc_requests:
        req_code = item.get("id") or item.get("ma_yeu_cau")
        if not req_code:
            continue

        # Chuẩn hóa mã yêu cầu (loại bỏ dấu # nếu có)
        clean_code = req_code.replace("#", "").strip()

        existing = db.query(RoomRequest).filter(
            (RoomRequest.ma_yeu_cau == clean_code) | (RoomRequest.ma_yeu_cau == req_code)
        ).first()
        if existing:
            total_skipped += 1
            continue

        raw_msv = (item.get("msv") or "").strip().upper()
        student_id, user_id = ensure_student_exists(db, raw_msv, item) if raw_msv else (None, None)

        loai_don = item.get("loai_don") or ("CHUYEN_PHONG" if "chuyển" in str(item.get("loai_yeu_cau", "")).lower() else "TRA_PHONG")
        status = item.get("trang_thai", "CHO_DUYET")
        reason = item.get("ly_do") or ""
        created_at = parse_datetime(item.get("ngay_gui"))

        # Tìm mã phòng liên quan
        phong_hien_tai_id = find_matching_room(db, item.get("phong_hien_tai") or item.get("vi_tri_hien_tai") or "")
        phong_mong_muon_id = None
        if loai_don == "CHUYEN_PHONG":
            target_str = item.get("phong_dich") or ""
            if not target_str and isinstance(item.get("xep_phong"), dict):
                target_str = item["xep_phong"].get("phong_id", "")
            phong_mong_muon_id = find_matching_room(db, target_str)

        new_req = RoomRequest(
            ma_yeu_cau=clean_code,
            student_id=student_id,
            user_id=user_id,
            loai_don=loai_don,
            phong_hien_tai_id=phong_hien_tai_id,
            phong_mong_muon_id=phong_mong_muon_id,
            ly_do=reason,
            trang_thai=status,
            ly_do_tu_choi=item.get("ly_do_tu_choi"),
            extra_data=item,
            created_at=created_at,
            updated_at=created_at,
        )
        db.add(new_req)
        total_inserted += 1

    db.commit()
    print(f"[+] Hoàn tất di chuyển dữ liệu thành công! Đã chèn {total_inserted} đơn, bỏ qua {total_skipped} đơn trùng lặp.")
    db.close()


if __name__ == "__main__":
    migrate_data()
