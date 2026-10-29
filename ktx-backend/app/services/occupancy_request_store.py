import datetime
import re
import uuid
from typing import Any, Dict, List, Optional
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.dorm import Phong
from app.models.room_request import RoomRequest
from app.models.user import NguoiDung, SinhVien


def _get_session(db: Optional[Session] = None):
    """Context manager nội bộ để quản lý session DB an toàn."""
    class SessionContext:
        def __init__(self, external_db: Optional[Session]):
            self.external_db = external_db
            self.session = None

        def __enter__(self) -> Session:
            if self.external_db is not None:
                return self.external_db
            self.session = SessionLocal()
            return self.session

        def __exit__(self, exc_type, exc_val, exc_tb):
            if self.session is not None:
                self.session.close()

    return SessionContext(db)


def _find_room_id(db: Session, text: Optional[str]) -> Optional[str]:
    """Tìm mã phòng tương ứng trong CSDL."""
    if not text:
        return None
    clean = str(text).strip()
    p = db.query(Phong).filter(Phong.ma_phong == clean).first()
    if p:
        return p.ma_phong

    digits = re.findall(r"\d+", clean)
    if digits:
        p = db.query(Phong).filter(Phong.so_phong == digits[0]).first()
        if p:
            return p.ma_phong
    return None


def _generate_next_yc_code(session: Session) -> str:
    """Tự động sinh mã yêu cầu kế tiếp dạng YC-XXXX không bao giờ trùng lặp."""
    existing_codes = (
        session.query(RoomRequest.ma_yeu_cau)
        .filter(RoomRequest.ma_yeu_cau.like("YC-%"))
        .all()
    )
    max_num = 230
    for (code,) in existing_codes:
        if code and code.startswith("YC-"):
            clean_digits = re.findall(r"\d+", code[3:])
            if clean_digits:
                try:
                    num_val = int(clean_digits[0])
                    if num_val > max_num:
                        max_num = num_val
                except ValueError:
                    pass

    next_num = max_num + 1
    candidate = f"YC-{next_num:04d}"
    while session.query(RoomRequest).filter(RoomRequest.ma_yeu_cau == candidate).first():
        next_num += 1
        candidate = f"YC-{next_num:04d}"
    return candidate


def add_request(req_data: dict, db: Optional[Session] = None) -> dict:
    """Thêm một đơn đăng ký mới vào hệ thống quản lý MySQL."""
    with _get_session(db) as session:
        now = datetime.datetime.now()
        date_str = now.strftime("%d/%m/%Y")
        time_str = now.strftime("%H:%M")

        clean_msv = (req_data.get("msv") or "").strip().upper()
        student = session.query(SinhVien).filter(SinhVien.msv == clean_msv).first() if clean_msv else None
        user_id = student.ma_nguoi_dung if student else None

        req_code = req_data.get("id") or req_data.get("ma_yeu_cau")
        if not req_code:
            count = session.query(RoomRequest).count()
            req_code = f"DK-{uuid.uuid4().hex[:6].upper()}"

        full_data = dict(req_data)
        full_data["id"] = req_code
        full_data["ma_yeu_cau"] = req_code
        full_data["msv"] = clean_msv
        full_data["ngay_dang_ky"] = full_data.get("ngay_dang_ky") or date_str
        full_data["ngay_gui"] = full_data.get("ngay_gui") or f"{date_str} {time_str}"
        full_data["ngay_gui_time"] = full_data.get("ngay_gui_time") or f"{date_str} {time_str}"
        full_data["trang_thai"] = "PENDING"
        full_data["trang_thai_label"] = "Đang xét duyệt"

        reason = (
            full_data.get("noi_dung_nguyen_vong")
            or full_data.get("nguyen_vong")
            or full_data.get("nguyen_vong_label")
            or "Xin đăng ký phòng KTX"
        )
        target_room_id = _find_room_id(session, full_data.get("nguyen_vong_phong") or full_data.get("ma_phong"))

        new_req = RoomRequest(
            ma_yeu_cau=req_code,
            user_id=user_id,
            student_id=clean_msv if student else None,
            loai_don="DANG_KY",
            phong_hien_tai_id=None,
            phong_mong_muon_id=target_room_id,
            ly_do=reason,
            trang_thai="PENDING",
            extra_data=full_data,
            created_at=now,
            updated_at=now,
        )
        session.add(new_req)
        session.commit()
        session.refresh(new_req)
        return new_req.to_dict()


def get_registration_requests(db: Optional[Session] = None) -> List[Dict]:
    """Lấy danh sách các đơn đăng ký chỗ ở từ MySQL."""
    with _get_session(db) as session:
        requests = (
            session.query(RoomRequest)
            .filter(RoomRequest.loai_don == "DANG_KY")
            .order_by(RoomRequest.id.desc())
            .all()
        )
        return [r.to_dict() for r in requests]


def get_all_requests(db: Optional[Session] = None) -> List[Dict]:
    """Lấy danh sách tất cả các đơn đăng ký, chuyển phòng và trả phòng từ MySQL."""
    with _get_session(db) as session:
        requests = (
            session.query(RoomRequest)
            .order_by(RoomRequest.id.desc())
            .all()
        )
        return [r.to_dict() for r in requests]


def get_request_by_id(req_id: str, db: Optional[Session] = None) -> Optional[Dict]:
    """Tìm đơn theo ID, Mã yêu cầu hoặc MSV từ MySQL."""
    if not req_id:
        return None
    clean_id = req_id.strip().replace("#", "")

    with _get_session(db) as session:
        # 1. Tìm chính xác theo mã yêu cầu
        req = (
            session.query(RoomRequest)
            .filter(
                or_(
                    RoomRequest.ma_yeu_cau == clean_id,
                    RoomRequest.ma_yeu_cau == f"#{clean_id}",
                    RoomRequest.ma_yeu_cau == req_id.strip(),
                )
            )
            .first()
        )
        if req:
            return req.to_dict()

        # 2. Nếu là số tự tăng id
        if clean_id.isdigit():
            req = session.query(RoomRequest).filter(RoomRequest.id == int(clean_id)).first()
            if req:
                return req.to_dict()

        # 3. Tìm theo MSV
        req = (
            session.query(RoomRequest)
            .filter(RoomRequest.student_id == clean_id.upper())
            .order_by(RoomRequest.id.desc())
            .first()
        )
        if req:
            return req.to_dict()

        return None


def update_request_status(
    req_id: str,
    new_status: str,
    extra_data: Optional[dict] = None,
    db: Optional[Session] = None,
) -> Optional[Dict]:
    """Cập nhật trạng thái đơn trong MySQL."""
    clean_id = req_id.strip().replace("#", "")

    with _get_session(db) as session:
        req = (
            session.query(RoomRequest)
            .filter(
                or_(
                    RoomRequest.ma_yeu_cau == clean_id,
                    RoomRequest.ma_yeu_cau == f"#{clean_id}",
                    RoomRequest.ma_yeu_cau == req_id.strip(),
                    RoomRequest.student_id == clean_id.upper(),
                )
            )
            .order_by(RoomRequest.id.desc())
            .first()
        )
        if not req and clean_id.isdigit():
            req = session.query(RoomRequest).filter(RoomRequest.id == int(clean_id)).first()

        if req:
            req.trang_thai = new_status
            data = dict(req.extra_data or {})
            data["trang_thai"] = new_status
            data["trang_thai_label"] = "Đã duyệt" if new_status in ("DA_DUYET", "APPROVED") else "Từ chối"

            if extra_data:
                data.update(extra_data)
                if "ly_do_tu_choi" in extra_data:
                    req.ly_do_tu_choi = extra_data["ly_do_tu_choi"]
                if "xep_phong" in extra_data and isinstance(extra_data["xep_phong"], dict):
                    xp_phong = extra_data["xep_phong"].get("phong_id")
                    if xp_phong:
                        room_id = _find_room_id(session, xp_phong)
                        if room_id:
                            req.phong_mong_muon_id = room_id

            req.extra_data = data
            req.updated_at = datetime.datetime.now()
            session.commit()
            session.refresh(req)
            return req.to_dict()

        return None


def add_transfer_request(data: dict, db: Optional[Session] = None) -> dict:
    """Thêm yêu cầu chuyển phòng vào MySQL."""
    with _get_session(db) as session:
        req_id = data.get("id") or _generate_next_yc_code(session)
        clean_code = req_id.replace("#", "").strip()
        while session.query(RoomRequest).filter(RoomRequest.ma_yeu_cau == clean_code).first():
            clean_code = _generate_next_yc_code(session)

        now = datetime.datetime.now()
        today_str = now.strftime("%d/%m/%Y %H:%M")

        phong_hien_tai = data.get("phong_hien_tai", "")
        toa_hien_tai = data.get("toa_hien_tai", "")
        if not toa_hien_tai and " - " in data.get("vi_tri_hien_tai", ""):
            for vp in data.get("vi_tri_hien_tai", "").split(" - "):
                if "Tòa" in vp:
                    toa_hien_tai = vp.strip()
                    break

        phong_mong_muon = data.get("phong_mong_muon", "")
        from_label = (
            f"{phong_hien_tai} ({toa_hien_tai})"
            if toa_hien_tai and phong_hien_tai and f"({toa_hien_tai})" not in phong_hien_tai
            else phong_hien_tai
        )

        if " - " in phong_mong_muon:
            p_parts = phong_mong_muon.split(" - ")
            r_part = p_parts[0].strip()
            # Tìm phần chứa chữ "Tòa" (ví dụ: "Tòa A1") thay vì lấy "Tầng 2"
            toa_part = next((p.strip() for p in p_parts if "tòa" in p.lower()), None)
            if not toa_part and len(p_parts) > 1:
                toa_part = p_parts[-1].strip()
            if toa_part and "(" in toa_part:
                toa_part = toa_part.split("(")[0].strip()
            to_label = f"{r_part} ({toa_part})" if toa_part else r_part
        else:
            to_label = phong_mong_muon.strip()

        if data.get("phong_lien_quan") and "→" in data.get("phong_lien_quan"):
            phong_lien_quan = data.get("phong_lien_quan")
            if "(" not in phong_lien_quan and from_label and to_label:
                phong_lien_quan = f"{from_label} → {to_label}"
        else:
            phong_lien_quan = f"{from_label} → {to_label}" if from_label and to_label else (to_label or from_label)

        clean_msv = (data.get("msv") or "").strip().upper()
        student = session.query(SinhVien).filter(SinhVien.msv == clean_msv).first() if clean_msv else None
        user_id = student.ma_nguoi_dung if student else None

        new_dict = {
            "id": clean_code,
            "ma_yeu_cau": f"#{clean_code}",
            "loai_yeu_cau": "Chuyển phòng",
            "loai_don": "CHUYEN_PHONG",
            "msv": clean_msv,
            "ho_ten": data.get("ho_ten", ""),
            "gioi_tinh": data.get("gioi_tinh", ""),
            "khoa": data.get("khoa", ""),
            "lop": data.get("lop", ""),
            "vi_tri_hien_tai": data.get("vi_tri_hien_tai", phong_hien_tai),
            "cong_no": data.get("cong_no", "Chưa thanh toán (Chưa phát hành hóa đơn)"),
            "ngay_gui": data.get("ngay_gui") or today_str,
            "phong_lien_quan": phong_lien_quan,
            "phong_hien_tai": from_label,
            "phong_dich": to_label,
            "ly_do": data.get("ly_do", "Chuyển phòng"),
            "ngay_mong_muon": data.get("ngay_mong_muon", ""),
            "mo_ta": data.get("mo_ta_chi_tiet") or data.get("mo_ta", ""),
            "trang_thai": "CHO_DUYET",
            "trang_thai_label": "Chờ duyệt",
        }

        curr_room_id = _find_room_id(session, phong_hien_tai)
        target_room_id = _find_room_id(session, phong_mong_muon)

        new_req = RoomRequest(
            ma_yeu_cau=clean_code,
            student_id=clean_msv if student else None,
            user_id=user_id,
            loai_don="CHUYEN_PHONG",
            phong_hien_tai_id=curr_room_id,
            phong_mong_muon_id=target_room_id,
            ly_do=new_dict["ly_do"],
            trang_thai="CHO_DUYET",
            extra_data=new_dict,
            created_at=now,
            updated_at=now,
        )
        session.add(new_req)
        session.commit()
        session.refresh(new_req)
        return new_req.to_dict()


def add_checkout_request(data: dict, db: Optional[Session] = None) -> dict:
    """Thêm yêu cầu trả phòng vào MySQL."""
    with _get_session(db) as session:
        req_id = data.get("id") or _generate_next_yc_code(session)
        clean_code = req_id.replace("#", "").strip()
        while session.query(RoomRequest).filter(RoomRequest.ma_yeu_cau == clean_code).first():
            clean_code = _generate_next_yc_code(session)

        now = datetime.datetime.now()
        today_str = now.strftime("%d/%m/%Y %H:%M")

        phong_hien_tai = data.get("phong_hien_tai", "")
        dia_chi_sau_tra = data.get("dia_chi_sau_tra") or data.get("dia_chi_lien_he") or ""
        dia_chi_chi_tiet = data.get("dia_chi_chi_tiet") or {}
        if (not dia_chi_chi_tiet or not any(dia_chi_chi_tiet.values())) and dia_chi_sau_tra:
            parts = [s.strip() for s in dia_chi_sau_tra.split(",") if s.strip()]
            if len(parts) >= 3:
                dia_chi_chi_tiet = {
                    "tinh": parts[-1],
                    "huyen": parts[-2],
                    "so_nha": ", ".join(parts[:-2]),
                }
            elif len(parts) == 2:
                dia_chi_chi_tiet = {
                    "tinh": parts[1],
                    "huyen": "",
                    "so_nha": parts[0],
                }
            elif len(parts) == 1:
                dia_chi_chi_tiet = {
                    "tinh": parts[0],
                    "huyen": "",
                    "so_nha": "",
                }

        clean_msv = (data.get("msv") or "").strip().upper()
        student = session.query(SinhVien).filter(SinhVien.msv == clean_msv).first() if clean_msv else None
        user_id = student.ma_nguoi_dung if student else None

        new_dict = {
            "id": clean_code,
            "ma_yeu_cau": f"#{clean_code}",
            "loai_yeu_cau": "Trả phòng",
            "loai_don": "TRA_PHONG",
            "msv": clean_msv,
            "ho_ten": data.get("ho_ten", ""),
            "gioi_tinh": data.get("gioi_tinh", ""),
            "khoa": data.get("khoa", ""),
            "lop": data.get("lop", ""),
            "vi_tri_hien_tai": data.get("vi_tri_hien_tai", phong_hien_tai),
            "cong_no": data.get("cong_no", "Chưa thanh toán (Chưa phát hành hóa đơn)"),
            "ngay_gui": data.get("ngay_gui") or today_str,
            "phong_lien_quan": phong_hien_tai,
            "phong_hien_tai": phong_hien_tai,
            "ly_do": data.get("ly_do", "Trả phòng"),
            "ngay_mong_muon": data.get("ngay_mong_muon", ""),
            "dia_chi_sau_tra": dia_chi_sau_tra,
            "dia_chi_chi_tiet": dia_chi_chi_tiet,
            "mo_ta": data.get("mo_ta_chi_tiet") or data.get("mo_ta", ""),
            "trang_thai": "CHO_DUYET",
            "trang_thai_label": "Chờ duyệt",
        }

        curr_room_id = _find_room_id(session, phong_hien_tai)

        new_req = RoomRequest(
            ma_yeu_cau=clean_code,
            student_id=clean_msv if student else None,
            user_id=user_id,
            loai_don="TRA_PHONG",
            phong_hien_tai_id=curr_room_id,
            phong_mong_muon_id=None,
            ly_do=new_dict["ly_do"],
            trang_thai="CHO_DUYET",
            extra_data=new_dict,
            created_at=now,
            updated_at=now,
        )
        session.add(new_req)
        session.commit()
        session.refresh(new_req)
        return new_req.to_dict()


def get_transfer_checkout_requests(db: Optional[Session] = None) -> List[Dict]:
    """Lấy danh sách các đơn chuyển phòng và trả phòng từ MySQL."""
    with _get_session(db) as session:
        requests = (
            session.query(RoomRequest)
            .filter(RoomRequest.loai_don.in_(["CHUYEN_PHONG", "TRA_PHONG"]))
            .order_by(RoomRequest.id.desc())
            .all()
        )
        return [r.to_dict() for r in requests]
