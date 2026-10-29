import datetime
import logging
import re
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import RoleChecker, get_current_user
from app.core.security import get_password_hash
from app.models.user import SinhVien, TaiKhoan, NguoiDung, VaiTro
from app.models.dorm import ToaNha, Tang, Phong, Giuong
from app.models.contract import HopDong
from app.models.room_request import RoomRequest
from app.services import dorm_service, occupancy_request_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/occupancy", tags=["Quản lý Xử lý Lưu trú (Admin)"])


class ApproveRequestPayload(BaseModel):
    ma_toa: Optional[str] = None
    phong_id: str
    giuong_id: str
    msv: Optional[str] = None
    ho_ten: Optional[str] = None


class RejectRequestPayload(BaseModel):
    ly_do_tu_choi: str


@router.get(
    "/requests",
    summary="Lấy danh sách tất cả các đơn đăng ký chỗ ở (Quản lý)",
    dependencies=[Depends(RoleChecker(["QuanLy", "KeToan"]))],
)
def get_all_requests(
    trang_thai: Optional[str] = Query(None, description="Lọc theo trạng thái đơn (PENDING, APPROVED, REJECTED,...)"),
    msv: Optional[str] = Query(None, description="Lọc theo mã sinh viên"),
    loai_don: Optional[str] = Query(None, description="Lọc theo loại đơn (DANG_KY, CHUYEN_PHONG, TRA_PHONG)"),
    start_date: Optional[str] = Query(None, description="Lọc từ ngày (dd/mm/YYYY hoặc YYYY-mm-dd)"),
    end_date: Optional[str] = Query(None, description="Lọc đến ngày (dd/mm/YYYY hoặc YYYY-mm-dd)"),
    db: Session = Depends(get_db),
):
    """
    Truy vấn danh sách đơn đăng ký, chuyển phòng và trả phòng trực tiếp từ MySQL bằng SQLAlchemy ORM,
    hỗ trợ lọc theo trạng thái, mã sinh viên, loại đơn và ngày gửi.
    """
    from app.services.debt_service import DebtService

    query = db.query(RoomRequest)

    if trang_thai:
        clean_status = trang_thai.strip().upper()
        if clean_status in ("CHO_DUYET", "PENDING"):
            query = query.filter(RoomRequest.trang_thai.in_(["PENDING", "CHO_DUYET"]))
        elif clean_status in ("DA_DUYET", "APPROVED"):
            query = query.filter(RoomRequest.trang_thai.in_(["APPROVED", "DA_DUYET"]))
        elif clean_status in ("TU_CHOI", "REJECTED"):
            query = query.filter(RoomRequest.trang_thai.in_(["TU_CHOI", "REJECTED"]))
        else:
            query = query.filter(RoomRequest.trang_thai == clean_status)

    if msv:
        clean_msv = msv.strip().upper()
        query = query.filter(or_(RoomRequest.student_id == clean_msv, RoomRequest.ma_yeu_cau == clean_msv))

    if loai_don:
        query = query.filter(RoomRequest.loai_don == loai_don.strip().upper())

    if start_date:
        try:
            s_dt = datetime.datetime.strptime(start_date.strip(), "%Y-%m-%d")
        except ValueError:
            s_dt = datetime.datetime.strptime(start_date.strip(), "%d/%m/%Y")
        query = query.filter(RoomRequest.created_at >= s_dt)

    if end_date:
        try:
            e_dt = datetime.datetime.strptime(end_date.strip(), "%Y-%m-%d")
        except ValueError:
            e_dt = datetime.datetime.strptime(end_date.strip(), "%d/%m/%Y")
        query = query.filter(RoomRequest.created_at <= e_dt + datetime.timedelta(days=1))

    all_req_models = query.order_by(RoomRequest.id.desc()).all()
    all_reqs = [r.to_dict() for r in all_req_models]

    for req in all_reqs:
        req_msv = (req.get("msv") or "").strip().upper()
        if req_msv:
            try:
                req["cong_no"] = DebtService.get_student_cong_no_label(db, req_msv)
            except Exception:
                pass
    return all_reqs


@router.get(
    "/requests/{request_id}",
    summary="Lấy chi tiết yêu cầu đăng ký phòng của sinh viên (Quản lý)",
    dependencies=[Depends(RoleChecker(["QuanLy", "KeToan"]))],
)
def get_request_detail(
    request_id: str,
    db: Session = Depends(get_db),
):
    """
    Trả về chi tiết đơn đăng ký của sinh viên kèm gợi ý xếp chỗ của hệ thống/AI.
    """
    clean_id = request_id.strip()
    # 1. Kiểm tra đơn trong MySQL thông qua occupancy_request_store
    stored = occupancy_request_store.get_request_by_id(clean_id, db=db)
    if stored:
        # Tra cứu công nợ thực tế của sinh viên từ database
        msv = (stored.get("msv") or "").strip().upper()
        if msv:
            try:
                from app.services.debt_service import DebtService
                stored["cong_no"] = DebtService.get_student_cong_no_label(db, msv)
            except Exception:
                pass

        # Đồng bộ vị trí phòng hiện tại thực tế cho đơn chuyển/trả phòng
        is_transfer_or_checkout = stored.get("loai_don") in ("CHUYEN_PHONG", "TRA_PHONG") or stored.get("loai_yeu_cau") in ("Chuyển phòng", "Trả phòng")
        if is_transfer_or_checkout and msv:
            cur_location = None
            cur_short = None

            # 1. Tra cứu hợp đồng ACTIVE
            active_c = db.query(HopDong).filter(HopDong.msv == msv, HopDong.trang_thai == "ACTIVE").first()
            if active_c and active_c.giuong and active_c.giuong.phong:
                p = active_c.giuong.phong
                t = p.tang.toa_nha if p.tang else None
                b_name = t.ten_toa if t else (f"Tòa {p.tang.ma_toa}" if p.tang and p.tang.ma_toa else "KTX")
                g_code = active_c.giuong.ma_giuong.split("_")[-1] if active_c.giuong.ma_giuong else ""
                cur_location = f"Phòng P{p.so_phong} - {b_name} - Giường {g_code}"
                cur_short = f"P{p.so_phong} ({b_name})"
            else:
                # 2. Hoặc kiểm tra đơn chuyển phòng gần nhất đã duyệt
                prev_transfer = (
                    db.query(RoomRequest)
                    .filter(
                        RoomRequest.student_id == msv,
                        RoomRequest.loai_don == "CHUYEN_PHONG",
                        RoomRequest.trang_thai.in_(["DA_DUYET", "APPROVED"]),
                        RoomRequest.id != stored.get("id"),
                        RoomRequest.ma_yeu_cau != stored.get("ma_yeu_cau"),
                    )
                    .order_by(RoomRequest.id.desc())
                    .first()
                )
                if prev_transfer and prev_transfer.extra_data and prev_transfer.extra_data.get("xep_phong"):
                    xp = prev_transfer.extra_data["xep_phong"]
                    raw_toa = str(xp.get("ma_toa", "")).replace("TOA_", "").replace("Tòa ", "").strip()
                    raw_phong = str(xp.get("phong_id", "") or xp.get("so_phong", ""))
                    match_num = re.search(r"\d+", raw_phong)
                    p_clean = match_num.group(0) if match_num else raw_phong
                    raw_giuong = str(xp.get("giuong_id", "")).split("_")[-1].replace("Giường ", "").strip()
                    cur_location = f"Phòng P{p_clean} - Tòa {raw_toa} - Giường {raw_giuong}"
                    cur_short = f"P{p_clean} (Tòa {raw_toa})"

            if cur_location:
                stored["vi_tri_hien_tai"] = cur_location
                stored["phong_hien_tai"] = cur_short

        # Tự động cập nhật hoặc sửa gợi ý nếu gợi ý chưa khớp giới tính
        raw_gender = stored.get("gioi_tinh") or stored.get("gender") or "Nam"
        s_lower = str(raw_gender).strip().lower()
        student_gender = "Nữ" if any(w in s_lower for w in ["nữ", "nu", "female", "f"]) else "Nam"
        stored["gioi_tinh"] = student_gender

        available_rooms = dorm_service.get_available_beds(db, gender=student_gender)
        if not available_rooms:
            stored["goi_y"] = None
            stored["suggestion"] = None
            not_found_msg = f"Không tìm thấy phòng phù hợp: Ký túc xá hiện không có phòng dành cho giới tính {student_gender} hoặc các phòng đã hết chỗ."
            stored["message"] = not_found_msg
            stored["suggestion_error"] = not_found_msg
        else:
            # Phân tích nguyện vọng tự do về tầng cao / thấp & phòng / tòa mong muốn
            raw_wish = (
                (stored.get("tang_mong_muon") or "") + " " +
                (stored.get("nguyen_vong") or "") + " " +
                (stored.get("noi_dung_nguyen_vong") or "") + " " +
                (stored.get("nguyen_vong_label") or "") + " " +
                (stored.get("phong_dich") or "") + " " +
                (stored.get("phong_mong_muon") or "") + " " +
                (stored.get("mo_ta") or "") + " " +
                (stored.get("ly_do") or "")
            ).lower()
            wants_high = any(k in raw_wish for k in ["tầng cao", "trên cao", "lầu cao", "ở cao", "tầng 4", "tầng 5", "tầng trên"])
            wants_low = any(k in raw_wish for k in ["tầng thấp", "ở dưới", "tầng 1", "tầng trệt", "tầng dưới"])

            # Trích xuất số phòng và tòa nếu có nguyện vọng chuyển phòng cụ thể
            target_room_match = re.search(r"(?:phòng|p)\s*(\d+)", raw_wish)
            target_room_digits = target_room_match.group(1) if target_room_match else None
            target_toa_match = re.search(r"tòa\s*([a-z0-9]+)", raw_wish)
            target_toa_code = target_toa_match.group(1).upper() if target_toa_match else None

            def score_room(r):
                score = 0
                r_digits = re.search(r"\d+", r.so_phong or r.ma_phong or "")
                r_num = r_digits.group(0) if r_digits else ""
                r_toa = (r.ten_toa or r.ma_toa or "").upper()
                
                # Khớp đúng số phòng
                if target_room_digits and target_room_digits == r_num:
                    score += 50
                # Khớp đúng tòa nhà
                if target_toa_code and target_toa_code in r_toa:
                    score += 50
                
                # Tầng cao / thấp
                floor = r.so_tang or 1
                if wants_high:
                    score += floor * 2
                elif wants_low:
                    score += (6 - floor) * 2
                return score

            sorted_rooms = list(available_rooms)
            sorted_rooms.sort(key=score_room, reverse=True)

            # Lọc theo đúng loại phòng mong muốn (Room Type Constraint)
            pref_type = (stored.get("loai_phong") or "").strip()
            type_matched_rooms = [
                r for r in sorted_rooms
                if pref_type and r.loai_phong and r.loai_phong.strip().lower() == pref_type.lower()
            ]

            if pref_type and not type_matched_rooms:
                alt_type = sorted_rooms[0].loai_phong or "Phòng tiêu chuẩn"
                mismatch_msg = f"⚠️ KTX hiện đã hết (hoặc chưa có) {pref_type} dành cho {student_gender}. Đang hiển thị các phòng {alt_type.lower()} còn trống để Quản lý cân nhắc thỏa thuận với sinh viên."
                stored["goi_y"] = None
                stored["suggestion"] = None
                stored["is_room_type_mismatch"] = True
                stored["requested_room_type"] = pref_type
                stored["available_alternative_type"] = alt_type
                stored["message"] = mismatch_msg
                stored["suggestion_error"] = mismatch_msg
            else:
                matched_r = type_matched_rooms[0] if type_matched_rooms else sorted_rooms[0]
                first_empty_bed = "G01"
                if matched_r.danh_sach_giuong_trong:
                    first_empty_bed = matched_r.danh_sach_giuong_trong[0].ma_giuong

                stored["goi_y"] = {
                    "ma_toa": matched_r.ma_toa,
                    "ma_phong": matched_r.ma_phong,
                    "ma_giuong": first_empty_bed,
                }
                stored["suggestion"] = stored["goi_y"]
                stored["is_room_type_mismatch"] = False
                stored["message"] = None
                stored["suggestion_error"] = None
                stored["ai_reason"] = (
                    f"Đề xuất xếp vào phòng {matched_r.so_phong or matched_r.ma_phong} ({matched_r.ten_toa or matched_r.ma_toa}) "
                    f"vì phù hợp với nguyện vọng của sinh viên và đúng giới tính {student_gender}."
                )
        return stored

    # 2. Tìm kiếm sinh viên từ CSDL theo MSV
    student = db.query(SinhVien).filter(SinhVien.msv == clean_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hoặc hồ sơ sinh viên")

    raw_sg = str(student.gioi_tinh or "").strip().lower()
    student_gender = "Nữ" if any(w in raw_sg for w in ["nữ", "nu", "female", "f"]) else "Nam"
    available_rooms = dorm_service.get_available_beds(db, gender=student_gender)

    suggested_building = None
    suggested_room = None
    suggested_bed = None
    goi_y_data = None
    not_found_msg = None

    if available_rooms:
        r = available_rooms[0]
        suggested_building = r.ma_toa
        suggested_room = r.ma_phong
        if r.danh_sach_giuong_trong:
            suggested_bed = r.danh_sach_giuong_trong[0].ma_giuong
        goi_y_data = {
            "ma_toa": suggested_building,
            "ma_phong": suggested_room,
            "ma_giuong": suggested_bed,
        }
    else:
        not_found_msg = f"Không tìm thấy phòng phù hợp: Ký túc xá hiện không có phòng dành cho giới tính {student_gender} hoặc các phòng đã hết chỗ."

    email_display = (
        student.nguoi_dung.email
        if student and student.nguoi_dung and student.nguoi_dung.email
        else ""
    )
    ho_ten_display = (
        student.nguoi_dung.ho_ten
        if student and student.nguoi_dung and student.nguoi_dung.ho_ten
        else ""
    )
    phone_display = (
        student.nguoi_dung.so_dien_thoai
        if student and student.nguoi_dung and student.nguoi_dung.so_dien_thoai
        else ""
    )

    return {
        "id": clean_id,
        "msv": student.msv,
        "ho_ten": ho_ten_display,
        "gioi_tinh": student_gender,
        "ngay_sinh": student.ngay_sinh or "",
        "cccd": student.cccd or "",
        "so_dien_thoai": phone_display,
        "email": email_display,
        "khoa": student.khoa or "",
        "lop": student.lop or "",
        "dia_chi": student.dia_chi or "",
        "doi_tuong_uu_tien": student.doi_tuong_uu_tien or "",
        "nguoi_giam_ho": student.nguoi_giam_ho or "",
        "moi_quan_he": student.moi_quan_he or "",
        "sdt_nguoi_giam_ho": student.sdt_nguoi_giam_ho or "",
        "nguyen_vong": "",
        "trang_thai": "NOT_REGISTERED",
        "goi_y": goi_y_data,
        "suggestion": goi_y_data,
        "message": not_found_msg,
        "suggestion_error": not_found_msg,
    }


@router.get(
    "/available-beds",
    summary="Lấy danh sách các tòa, phòng và giường còn trống để phân phòng (Quản lý)",
)
def get_available_beds_hierarchical(db: Session = Depends(get_db)):
    """
    Trả về cây phân cấp Tòa -> Phòng -> Giường còn trống phục vụ 3 dropdown liên hoàn.
    """
    buildings = db.query(ToaNha).all()
    results = []

    for b in buildings:
        # Chuẩn hóa giới tính tòa
        raw_bg = (b.gioi_tinh or "Nam & Nữ").strip()
        if raw_bg.lower() in ["nu", "nữ"]:
            normalized_gender = "Nữ"
        elif raw_bg.lower() == "nam":
            normalized_gender = "Nam"
        else:
            normalized_gender = "Nam & Nữ"

        b_data = {
            "ma_toa": b.ma_toa,
            "ten_toa": b.ten_toa,
            "gioi_tinh": normalized_gender,
            "rooms": [],
        }
        for floor in b.tangs:
            for room in floor.phongs:
                empty_beds = [bed for bed in room.giuongs if bed.trang_thai == "TRONG"]
                occupied_count = len([bed for bed in room.giuongs if bed.trang_thai != "TRONG"])
                if empty_beds:
                    b_data["rooms"].append({
                        "ma_phong": room.ma_phong,
                        "so_phong": room.so_phong,
                        "loai_phong": room.loai_phong,
                        "so_tang": floor.so_tang,
                        "ma_tang": floor.ma_tang,
                        "suc_chua": room.suc_chua,
                        "gioi_tinh": normalized_gender,
                        "thanh_vien_hien_tai": occupied_count,
                        "gia_tien_nam": room.gia_tien_nam,
                        "label": f"Phòng {room.so_phong} ({len(empty_beds)} chỗ trống)",
                        "beds": [
                            {
                                "ma_giuong": bed.ma_giuong,
                                "label": f"Giường {bed.ma_giuong.split('_')[-1] if '_' in bed.ma_giuong else bed.ma_giuong}",
                            }
                            for bed in empty_beds
                        ],
                    })
        if b_data["rooms"]:
            results.append(b_data)

    # Đảm bảo có dữ liệu mẫu chuẩn nếu DB chưa có
    return results


@router.put(
    "/requests/{request_id}/approve",
    summary="Phê duyệt đơn đăng ký & tự động tạo hợp đồng xếp phòng",
    dependencies=[Depends(RoleChecker(["QuanLy", "KeToan"]))],
)
@router.post(
    "/requests/{request_id}/approve",
    summary="Phê duyệt đơn đăng ký & tự động tạo hợp đồng xếp phòng (alias)",
    dependencies=[Depends(RoleChecker(["QuanLy", "KeToan"]))],
)
def approve_request(
    request_id: str,
    payload: ApproveRequestPayload,
    db: Session = Depends(get_db),
):
    """
    Phê duyệt đơn đăng ký:
    - Tìm và đảm bảo sinh viên tồn tại trong CSDL.
    - Tìm và đảm bảo Tòa nhà, Tầng, Phòng, Giường tồn tại trong CSDL để thỏa mãn FK.
    - Tự động sinh mã hợp đồng chuẩn <= 20 ký tự: HD{YY}-{toa}{phong}-G{giuong}.
    - Cập nhật trạng thái giường sang DA_CO_NGUOI.
    - Tạo hoặc cập nhật bản ghi HopDong trạng thái ACTIVE và commit vào MySQL.
    """
    clean_id = request_id.strip()
    registration = occupancy_request_store.get_request_by_id(clean_id, db=db)
    if not registration:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn đăng ký")
    if registration.get("trang_thai") not in ("PENDING", "CHO_DUYET"):
        raise HTTPException(status_code=409, detail="Đơn này đã được xử lý")

    clean_msv = registration.get("msv", "").strip().upper()
    student = db.query(SinhVien).filter(
        SinhVien.msv == clean_msv
    ).first()
    
    # Nếu chưa có hồ sơ sinh viên, tự động đồng bộ từ tài khoản / người dùng hoặc tạo mới từ đơn đăng ký
    if not student:
        email = (registration.get("email") or "").strip()
        user = None
        if email:
            user = db.query(NguoiDung).filter(NguoiDung.email == email).first()
        if not user and clean_msv:
            user = db.query(NguoiDung).filter(
                (NguoiDung.email.ilike(f"{clean_msv}@%")) |
                (NguoiDung.ho_ten == registration.get("ho_ten", ""))
            ).first()

        if not user:
            from app.models.user import VaiTro
            from app.core.security import get_password_hash
            new_tk = TaiKhoan(
                ten_dang_nhap=clean_msv.lower(),
                mat_khau=get_password_hash(uuid.uuid4().hex),
                vai_tro=VaiTro.SINH_VIEN,
            )
            db.add(new_tk)
            db.flush()
            user = NguoiDung(
                ma_tai_khoan=new_tk.ma_tai_khoan,
                ho_ten=registration.get("ho_ten") or "Sinh viên",
                email=email or f"{clean_msv.lower()}@ictu.edu.vn",
                so_dien_thoai=registration.get("so_dien_thoai") or "",
            )
            db.add(user)
            db.flush()

        student = SinhVien(
            msv=clean_msv,
            ma_nguoi_dung=user.ma_nguoi_dung,
            lop=registration.get("lop") or "",
            gioi_tinh=registration.get("gioi_tinh") or "Nam",
            khoa=registration.get("khoa") or "",
            dia_chi=registration.get("dia_chi") or "",
            cccd=registration.get("cccd") or "",
            ngay_sinh=registration.get("ngay_sinh") or "",
            doi_tuong_uu_tien=registration.get("doi_tuong_uu_tien") or "Không thuộc diện ưu tiên",
            nguoi_giam_ho=registration.get("nguoi_giam_ho") or "",
            moi_quan_he=registration.get("moi_quan_he") or "",
            sdt_nguoi_giam_ho=registration.get("sdt_nguoi_giam_ho") or "",
        )
        db.add(student)
        db.flush()
    else:
        # Cập nhật các trường còn thiếu từ đơn đăng ký cho sinh viên đã có tài khoản
        if registration.get("cccd") and not student.cccd:
            student.cccd = registration.get("cccd")
        if registration.get("ngay_sinh") and not student.ngay_sinh:
            student.ngay_sinh = registration.get("ngay_sinh")
        if registration.get("dia_chi") and not student.dia_chi:
            student.dia_chi = registration.get("dia_chi")
        if registration.get("doi_tuong_uu_tien") and (not student.doi_tuong_uu_tien or student.doi_tuong_uu_tien == "Không thuộc diện ưu tiên"):
            student.doi_tuong_uu_tien = registration.get("doi_tuong_uu_tien")
        if registration.get("nguoi_giam_ho") and not student.nguoi_giam_ho:
            student.nguoi_giam_ho = registration.get("nguoi_giam_ho")
        if registration.get("sdt_nguoi_giam_ho") and not student.sdt_nguoi_giam_ho:
            student.sdt_nguoi_giam_ho = registration.get("sdt_nguoi_giam_ho")
        if registration.get("moi_quan_he") and not student.moi_quan_he:
            student.moi_quan_he = registration.get("moi_quan_he")
        if student.nguoi_dung and registration.get("so_dien_thoai") and not student.nguoi_dung.so_dien_thoai:
            student.nguoi_dung.so_dien_thoai = registration.get("so_dien_thoai")
        if not student.que_quan and student.dia_chi:
            parts = [p.strip() for p in student.dia_chi.split(",") if p.strip()]
            if parts:
                student.que_quan = parts[-1]

    existing_contract = (
        db.query(HopDong)
        .filter(HopDong.msv == student.msv, HopDong.trang_thai == "ACTIVE")
        .first()
    )
    if existing_contract:
        raise HTTPException(status_code=409, detail="Sinh viên đã có hợp đồng lưu trú đang hiệu lực")

    # 1. Tìm thông tin đơn từ MySQL
    req_item = occupancy_request_store.get_request_by_id(clean_id, db=db)
    target_msv = payload.msv or (req_item.get("msv") if req_item else None) or clean_id
    target_msv = target_msv.strip()

    # Nếu clean_id là mã đơn (bắt đầu bằng DK- hoặc #) và req_item chưa có, quét danh sách tất cả các đơn
    if (target_msv.startswith("DK-") or target_msv.startswith("#DK")) and not req_item:
        for r in occupancy_request_store.get_all_requests(db=db):
            if r.get("id") == clean_id or r.get("ma_yeu_cau") == clean_id:
                req_item = r
                if r.get("msv"):
                    target_msv = r.get("msv").strip()
                break

    # 2. Đảm bảo cấu trúc Tòa nhà -> Tầng -> Phòng -> Giường tồn tại để thỏa mãn Foreign Key hop_dong.ma_giuong
    raw_toa = (payload.ma_toa or (req_item.get("goi_y", {}).get("ma_toa") if req_item else None) or "A4").strip().upper()
    m_toa = re.search(r"([A-Za-z]+\d*)", raw_toa)
    toa_code = m_toa.group(1).upper() if m_toa else raw_toa

    toa = db.query(ToaNha).filter((ToaNha.ma_toa == toa_code) | (ToaNha.ten_toa.ilike(f"%{toa_code}%"))).first()
    if not toa:
        toa = ToaNha(
            ma_toa=toa_code[:20],
            ten_toa=f"Tòa {toa_code}"[:50],
            so_tang=5,
        )
        db.add(toa)
        db.flush()

    # Kiểm tra ràng buộc cứng về giới tính giữa sinh viên và tòa nhà
    student_gender_raw = (
        (req_item.get("gioi_tinh") if req_item else None)
        or (req_item.get("gender") if req_item else None)
        or "Nam"
    )
    s_lower = str(student_gender_raw).strip().lower()
    s_gender = "Nữ" if any(w in s_lower for w in ["nữ", "nu", "female", "f"]) else "Nam"

    bld_gender_raw = str(toa.gioi_tinh or "").strip().lower()
    if bld_gender_raw:
        if s_gender == "Nữ" and "nữ" not in bld_gender_raw and "nu" not in bld_gender_raw and "nam &" not in bld_gender_raw and "cả" not in bld_gender_raw:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể phê duyệt: Sinh viên là Nữ nhưng {toa.ten_toa or toa.ma_toa} là tòa dành cho Nam.",
            )
        if s_gender == "Nam" and "nam" not in bld_gender_raw and "cả" not in bld_gender_raw and ("nữ" in bld_gender_raw or "nu" in bld_gender_raw):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể phê duyệt: Sinh viên là Nam nhưng {toa.ten_toa or toa.ma_toa} là tòa dành cho Nữ.",
            )

    # Tầng: xác định từ số phòng (ví dụ P101 -> tầng 1, P205 -> tầng 2, P501 -> tầng 5)
    raw_phong = payload.phong_id.strip()
    digits = re.findall(r"\d", raw_phong)
    floor_num = int(digits[0]) if digits else 1
    tang_code = f"{toa.ma_toa}_T{floor_num}"[:20]
    tang = (
        db.query(Tang).filter(Tang.ma_tang == tang_code).first()
        or db.query(Tang).filter((Tang.ma_toa == toa.ma_toa) & (Tang.so_tang == floor_num)).first()
    )
    if not tang:
        tang = Tang(
            ma_tang=tang_code,
            so_tang=floor_num,
            ma_toa=toa.ma_toa,
        )
        db.add(tang)
        db.flush()

    # Phòng
    so_p = "".join(digits) if digits else raw_phong.replace("Phòng ", "").replace("P", "").strip()
    phong = (
        db.query(Phong).filter(Phong.ma_phong == raw_phong).first()
        or db.query(Phong).filter((Phong.ma_tang == tang.ma_tang) & (Phong.so_phong == so_p)).first()
        or db.query(Phong).filter(Phong.ma_phong.endswith(f"P{so_p}")).first()
    )
    if not phong:
        phong_code = raw_phong[:20]
        phong = Phong(
            ma_phong=phong_code,
            so_phong=so_p[:20],
            suc_chua=4,
            loai_phong="TIÊU CHUẨN",
            gia_tien_nam=6600000.0,
            ma_tang=tang.ma_tang,
        )
        db.add(phong)
        db.flush()

    # Giường
    raw_giuong = payload.giuong_id.strip()
    giuong_code = raw_giuong[:20]
    bed = (
        db.query(Giuong).filter(Giuong.ma_giuong == giuong_code).first()
        or db.query(Giuong).filter(Giuong.ma_giuong.endswith(giuong_code)).first()
        or db.query(Giuong).filter(
            Giuong.ma_phong == phong.ma_phong,
            Giuong.trang_thai == "TRONG",
        ).first()
    )
    if not bed:
        bed = Giuong(
            ma_giuong=giuong_code,
            trang_thai="DA_CO_NGUOI",
            ma_phong=phong.ma_phong,
        )
        db.add(bed)
        db.flush()
    else:
        bed.trang_thai = "DA_CO_NGUOI"
        if bed.ma_phong != phong.ma_phong:
            bed.ma_phong = phong.ma_phong

    # 3. Định dạng năm và mã hợp đồng chuẩn (không quá 20 ký tự theo MySQL schema)
    yy = datetime.date.today().strftime("%y")
    clean_p = phong.so_phong.replace("Phòng ", "").replace("P", "")
    clean_g = bed.ma_giuong.split("_")[-1] if "_" in bed.ma_giuong else bed.ma_giuong
    clean_g = re.sub(r"^(?:giường\s*|g)", "", clean_g, flags=re.IGNORECASE)
    contract_code = f"HD{yy}-{toa.ma_toa}{clean_p}-G{clean_g}"[:20]

    # Kiểm tra nếu sinh viên đã có hợp đồng ACTIVE
    existing_contract = db.query(HopDong).filter(
        HopDong.msv == student.msv,
        HopDong.trang_thai == "ACTIVE"
    ).first()

    if existing_contract:
        existing_contract.ma_giuong = bed.ma_giuong
        existing_contract.ngay_bat_dau = datetime.date.today()
        existing_contract.ngay_ket_thuc = datetime.date.today() + datetime.timedelta(days=365)
        contract_code = existing_contract.ma_hop_dong
    else:
        if db.query(HopDong).filter(HopDong.ma_hop_dong == contract_code).first():
            contract_code = f"HD{yy}-{student.msv[:6]}-{clean_g}"[:20]
            if db.query(HopDong).filter(HopDong.ma_hop_dong == contract_code).first():
                contract_code = f"HD{yy}-{int(datetime.datetime.now().timestamp()) % 1000000}"[:20]

        new_contract = HopDong(
            ma_hop_dong=contract_code,
            msv=student.msv,
            ma_giuong=bed.ma_giuong,
            ngay_bat_dau=datetime.date.today(),
            ngay_ket_thuc=datetime.date.today() + datetime.timedelta(days=365),
            trang_thai="ACTIVE",
        )
        db.add(new_contract)

    # 4. Cập nhật trạng thái đơn trong MySQL
    occupancy_request_store.update_request_status(
        clean_id,
        "APPROVED",
        {
            "ma_hop_dong": contract_code,
            "ma_toa": toa.ma_toa,
            "toa_nha": toa.ten_toa or f"Tòa {toa.ma_toa}",
            "ma_phong": phong.ma_phong,
            "so_phong": phong.so_phong,
            "loai_phong": phong.loai_phong,
            "ma_giuong": bed.ma_giuong,
            "so_giuong": bed.ma_giuong,
        },
        db=db,
    )

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error approving request and committing contract: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi cơ sở dữ liệu khi tạo hợp đồng: {str(e)}",
        )

    return {
        "status": "success",
        "message": f"Phê duyệt và xếp phòng thành công cho đơn {request_id}",
        "data": {
            "ma_hop_dong": contract_code,
            "msv": student.msv,
            "ma_toa": toa.ma_toa,
            "toa_nha": toa.ten_toa or f"Tòa {toa.ma_toa}",
            "ma_phong": phong.ma_phong,
            "so_phong": phong.so_phong,
            "loai_phong": phong.loai_phong,
            "ma_giuong": bed.ma_giuong,
            "so_giuong": bed.ma_giuong,
            "trang_thai": "APPROVED",
        },
    }


@router.put(
    "/requests/{request_id}/reject",
    summary="Từ chối đơn đăng ký chỗ ở kèm lý do",
    dependencies=[Depends(RoleChecker(["QuanLy"]))],
)
def reject_request(
    request_id: str,
    payload: RejectRequestPayload,
    db: Session = Depends(get_db),
):
    """
    Từ chối đơn đăng ký chỗ ở với lý do từ quản lý.
    """
    clean_id = request_id.strip()
    occupancy_request_store.update_request_status(
        clean_id,
        "TU_CHOI",
        {"ly_do_tu_choi": payload.ly_do_tu_choi},
        db=db,
    )

    return {
        "status": "success",
        "message": f"Đã từ chối đơn đăng ký {request_id}",
        "data": {
            "request_id": request_id,
            "ly_do_tu_choi": payload.ly_do_tu_choi,
            "trang_thai": "TU_CHOI",
        },
    }


@router.put(
    "/requests/transfer/{request_id}/approve",
    summary="Phê duyệt yêu cầu chuyển phòng & xếp chỗ",
)
def approve_transfer_request(
    request_id: str,
    payload: ApproveRequestPayload,
    db: Session = Depends(get_db),
):
    clean_id = request_id.strip()
    req_item = occupancy_request_store.get_request_by_id(clean_id, db=db)
    if not req_item:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu chuyển phòng")

    clean_msv = (payload.msv or req_item.get("msv") or "").strip().upper()

    # 1. Tìm hoặc đảm bảo Tòa nhà, Tầng, Phòng, Giường mới tồn tại
    raw_toa = (payload.ma_toa or "A1").strip().upper()
    m_toa = re.search(r"([A-Za-z]+\d*)", raw_toa)
    toa_code = m_toa.group(1).upper() if m_toa else raw_toa

    toa = db.query(ToaNha).filter((ToaNha.ma_toa == toa_code) | (ToaNha.ten_toa.ilike(f"%{toa_code}%"))).first()
    if not toa:
        toa = ToaNha(ma_toa=toa_code[:20], ten_toa=f"Tòa {toa_code}"[:50], so_tang=5)
        db.add(toa)
        db.flush()

    raw_phong = payload.phong_id.strip()
    digits = re.findall(r"\d+", raw_phong)
    so_p = digits[0] if digits else raw_phong.replace("Phòng ", "").replace("P", "").strip()
    floor_num = int(so_p[0]) if (so_p and so_p[0].isdigit()) else 1

    tang_code = f"{toa.ma_toa}_T{floor_num}"[:20]
    tang = (
        db.query(Tang).filter(Tang.ma_tang == tang_code).first()
        or db.query(Tang).filter((Tang.ma_toa == toa.ma_toa) & (Tang.so_tang == floor_num)).first()
    )
    if not tang:
        tang = Tang(ma_tang=tang_code, so_tang=floor_num, ma_toa=toa.ma_toa)
        db.add(tang)
        db.flush()

    phong = (
        db.query(Phong).filter(Phong.ma_phong == raw_phong).first()
        or db.query(Phong).filter((Phong.ma_tang == tang.ma_tang) & (Phong.so_phong == so_p)).first()
        or db.query(Phong).filter(Phong.ma_phong.endswith(f"P{so_p}")).first()
    )
    if not phong:
        phong = Phong(
            ma_phong=raw_phong[:20],
            so_phong=so_p[:20],
            suc_chua=4,
            loai_phong="TIÊU CHUẨN",
            gia_tien_nam=6600000.0,
            ma_tang=tang.ma_tang,
        )
        db.add(phong)
        db.flush()

    raw_giuong = payload.giuong_id.strip()
    giuong_code = raw_giuong[:20]
    bed = (
        db.query(Giuong).filter(Giuong.ma_giuong == giuong_code).first()
        or db.query(Giuong).filter(Giuong.ma_giuong.endswith(giuong_code)).first()
        or db.query(Giuong).filter(
            Giuong.ma_phong == phong.ma_phong,
            Giuong.trang_thai == "TRONG",
        ).first()
    )
    if not bed:
        bed = Giuong(
            ma_giuong=giuong_code,
            trang_thai="DA_CO_NGUOI",
            ma_phong=phong.ma_phong,
        )
        db.add(bed)
        db.flush()
    else:
        bed.trang_thai = "DA_CO_NGUOI"
        if bed.ma_phong != phong.ma_phong:
            bed.ma_phong = phong.ma_phong

    # 2. Giải phóng giường cũ của sinh viên nếu có và cập nhật hợp đồng
    active_contract = (
        db.query(HopDong)
        .filter(HopDong.msv == clean_msv, HopDong.trang_thai == "ACTIVE")
        .first()
    )
    if active_contract:
        if active_contract.ma_giuong and active_contract.ma_giuong != bed.ma_giuong:
            old_bed = db.query(Giuong).filter(Giuong.ma_giuong == active_contract.ma_giuong).first()
            if old_bed:
                old_bed.trang_thai = "TRONG"
        active_contract.ma_giuong = bed.ma_giuong
        active_contract.updated_at = datetime.datetime.now()
    else:
        yy = datetime.date.today().strftime("%y")
        clean_g = bed.ma_giuong.split("_")[-1] if "_" in bed.ma_giuong else bed.ma_giuong
        clean_g = re.sub(r"^(?:giường\s*|g)", "", clean_g, flags=re.IGNORECASE)
        contract_code = f"HD{yy}-{toa.ma_toa}{so_p}-G{clean_g}"[:20]
        if db.query(HopDong).filter(HopDong.ma_hop_dong == contract_code).first():
            contract_code = f"HD{yy}-{clean_msv[:6]}-{clean_g}"[:20]
        new_c = HopDong(
            ma_hop_dong=contract_code,
            msv=clean_msv,
            ma_giuong=bed.ma_giuong,
            ngay_bat_dau=datetime.date.today(),
            ngay_ket_thuc=datetime.date.today() + datetime.timedelta(days=365),
            trang_thai="ACTIVE",
            gia_thue=phong.gia_tien_nam / 12 if phong.gia_tien_nam else 550000.0,
            tien_coc=1000000.0,
        )
        db.add(new_c)

    # 3. Cập nhật RoomRequest sang DA_DUYET
    xep_phong_dict = payload.model_dump()
    actual_toa_code = phong.tang.toa_nha.ma_toa if (phong.tang and phong.tang.toa_nha) else toa.ma_toa
    xep_phong_dict["ma_toa"] = actual_toa_code
    xep_phong_dict["phong_id"] = phong.ma_phong
    xep_phong_dict["giuong_id"] = bed.ma_giuong

    updated = occupancy_request_store.update_request_status(
        clean_id,
        "DA_DUYET",
        {"xep_phong": xep_phong_dict},
        db=db,
    )
    db.commit()

    return {
        "status": "success",
        "message": "Phê duyệt yêu cầu chuyển phòng thành công",
        "data": updated,
    }


@router.put(
    "/requests/transfer/{request_id}/reject",
    summary="Từ chối yêu cầu chuyển phòng",
)
def reject_transfer_request(
    request_id: str,
    payload: RejectRequestPayload,
    db: Session = Depends(get_db),
):
    clean_id = request_id.strip()
    updated = occupancy_request_store.update_request_status(
        clean_id,
        "TU_CHOI",
        {"ly_do_tu_choi": payload.ly_do_tu_choi},
        db=db,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu chuyển phòng")
    return {
        "status": "success",
        "message": "Từ chối yêu cầu chuyển phòng thành công",
        "data": updated,
    }


@router.put(
    "/requests/checkout/{request_id}/approve",
    summary="Phê duyệt yêu cầu trả phòng",
)
def approve_checkout_request(
    request_id: str,
    db: Session = Depends(get_db),
):
    clean_id = request_id.strip()
    req_item = occupancy_request_store.get_request_by_id(clean_id, db=db)
    if not req_item:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu trả phòng")

    clean_msv = (req_item.get("msv") or "").strip().upper()
    active_contract = (
        db.query(HopDong)
        .filter(HopDong.msv == clean_msv, HopDong.trang_thai == "ACTIVE")
        .first()
    )
    if active_contract:
        if active_contract.ma_giuong:
            old_bed = db.query(Giuong).filter(Giuong.ma_giuong == active_contract.ma_giuong).first()
            if old_bed:
                old_bed.trang_thai = "TRONG"
        active_contract.trang_thai = "TERMINATED"
        active_contract.updated_at = datetime.datetime.now()

    updated = occupancy_request_store.update_request_status(
        clean_id,
        "DA_DUYET",
        db=db,
    )
    db.commit()

    return {
        "status": "success",
        "message": "Phê duyệt yêu cầu trả phòng thành công",
        "data": updated,
    }


@router.put(
    "/requests/checkout/{request_id}/reject",
    summary="Từ chối yêu cầu trả phòng",
)
def reject_checkout_request(
    request_id: str,
    payload: RejectRequestPayload,
    db: Session = Depends(get_db),
):
    clean_id = request_id.strip()
    updated = occupancy_request_store.update_request_status(
        clean_id,
        "TU_CHOI",
        {"ly_do_tu_choi": payload.ly_do_tu_choi},
        db=db,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu trả phòng")
    return {
        "status": "success",
        "message": "Từ chối yêu cầu trả phòng thành công",
        "data": updated,
    }

