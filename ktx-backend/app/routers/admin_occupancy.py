import datetime
import logging
import re
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import RoleChecker, get_current_user
from app.core.security import get_password_hash
from app.models.user import SinhVien, TaiKhoan, NguoiDung, VaiTro
from app.models.dorm import ToaNha, Tang, Phong, Giuong
from app.models.contract import HopDong
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
def get_all_requests():
    """
    Trả về danh sách tất cả các đơn đăng ký đang chờ xử lý và lịch sử xử lý.
    """
    return occupancy_request_store.get_all_requests()


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
    # 1. Kiểm tra đơn trong occupancy_request_store trước
    stored = occupancy_request_store.get_request_by_id(clean_id)
    if stored:
        # Tự động cập nhật hoặc sửa gợi ý nếu gợi ý chưa khớp giới tính
        student_gender = stored.get("gioi_tinh", "Nam")
        available_rooms = dorm_service.get_available_beds(db, gender=student_gender)
        if available_rooms:
            # Phân tích nguyện vọng tự do về tầng cao / thấp
            raw_wish = (
                (stored.get("tang_mong_muon") or "") + " " +
                (stored.get("nguyen_vong") or "") + " " +
                (stored.get("noi_dung_nguyen_vong") or "") + " " +
                (stored.get("nguyen_vong_label") or "")
            ).lower()
            wants_high = any(k in raw_wish for k in ["tầng cao", "trên cao", "lầu cao", "ở cao", "tầng 4", "tầng 5", "tầng trên"])
            wants_low = any(k in raw_wish for k in ["tầng thấp", "ở dưới", "tầng 1", "tầng trệt", "tầng dưới"])

            sorted_rooms = list(available_rooms)
            if wants_high:
                # Sắp xếp tầng cao nhất lên đầu
                sorted_rooms.sort(key=lambda r: (r.so_tang or 1), reverse=True)
            elif wants_low:
                # Sắp xếp tầng thấp nhất lên đầu
                sorted_rooms.sort(key=lambda r: (r.so_tang or 1))

            # Ưu tiên phòng khớp loại phòng mong muốn
            pref_type = stored.get("loai_phong")
            matched_r = next(
                (r for r in sorted_rooms if pref_type and r.loai_phong and r.loai_phong.strip().lower() == pref_type.strip().lower()),
                sorted_rooms[0]
            )
            first_empty_bed = "G01"
            if matched_r.danh_sach_giuong_trong:
                first_empty_bed = matched_r.danh_sach_giuong_trong[0].ma_giuong

            stored["goi_y"] = {
                "ma_toa": matched_r.ma_toa,
                "ma_phong": matched_r.ma_phong,
                "ma_giuong": first_empty_bed,
            }
        return stored

    # 2. Tìm kiếm sinh viên từ CSDL theo MSV
    student = db.query(SinhVien).filter(SinhVien.msv == clean_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Kh?ng t?m th?y ??n ho?c h? s? sinh vi?n")

    student_gender = student.gioi_tinh
    available_rooms = dorm_service.get_available_beds(db, gender=student_gender)
    if not available_rooms:
        available_rooms = dorm_service.get_available_beds(db)

    suggested_building = None
    suggested_room = None
    suggested_bed = None

    if available_rooms:
        r = available_rooms[0]
        suggested_building = r.ma_toa
        suggested_room = r.ma_phong
        if r.danh_sach_giuong_trong:
            suggested_bed = r.danh_sach_giuong_trong[0].ma_giuong

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
        "gioi_tinh": student.gioi_tinh,
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
    registration = occupancy_request_store.get_request_by_id(clean_id)
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
            lop=registration.get("lop") or "DTC-KTX",
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

    existing_contract = (
        db.query(HopDong)
        .filter(HopDong.msv == student.msv, HopDong.trang_thai == "ACTIVE")
        .first()
    )
    if existing_contract:
        raise HTTPException(status_code=409, detail="Sinh viên đã có hợp đồng lưu trú đang hiệu lực")

    # 1. Tìm thông tin đơn từ store
    req_item = occupancy_request_store.get_request_by_id(clean_id)
    target_msv = payload.msv or (req_item.get("msv") if req_item else None) or clean_id
    target_msv = target_msv.strip()

    # Nếu clean_id là mã đơn (bắt đầu bằng DK- hoặc #) và req_item chưa có, quét danh sách tất cả các đơn
    if (target_msv.startswith("DK-") or target_msv.startswith("#DK")) and not req_item:
        for r in occupancy_request_store.get_all_requests():
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

    # Tầng: xác định từ số phòng (ví dụ P101 -> tầng 1, P205 -> tầng 2, P501 -> tầng 5)
    raw_phong = payload.phong_id.strip()
    digits = re.findall(r"\d", raw_phong)
    floor_num = int(digits[0]) if digits else 1
    tang_code = f"TANG_{floor_num}_{toa.ma_toa}"[:20]
    tang = db.query(Tang).filter(Tang.ma_tang == tang_code).first()
    if not tang:
        tang = Tang(
            ma_tang=tang_code,
            so_tang=floor_num,
            ma_toa=toa.ma_toa,
        )
        db.add(tang)
        db.flush()

    # Phòng
    phong_code = raw_phong[:20]
    phong = db.query(Phong).filter(Phong.ma_phong == phong_code).first()
    if not phong:
        so_p = "".join(digits) if digits else raw_phong.replace("Phòng ", "").replace("P", "")
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

    # 4. Cập nhật trong store để quản lý thấy ngay trên giao diện
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
):
    clean_id = request_id.strip()
    updated = occupancy_request_store.update_request_status(
        clean_id,
        "DA_DUYET",
        {"xep_phong": payload.model_dump()},
    )
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
):
    clean_id = request_id.strip()
    updated = occupancy_request_store.update_request_status(
        clean_id,
        "TU_CHOI",
        {"ly_do_tu_choi": payload.ly_do_tu_choi},
    )
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
):
    clean_id = request_id.strip()
    updated = occupancy_request_store.update_request_status(
        clean_id,
        "DA_DUYET",
    )
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
):
    clean_id = request_id.strip()
    updated = occupancy_request_store.update_request_status(
        clean_id,
        "TU_CHOI",
        {"ly_do_tu_choi": payload.ly_do_tu_choi},
    )
    return {
        "status": "success",
        "message": "Từ chối yêu cầu trả phòng thành công",
        "data": updated,
    }

