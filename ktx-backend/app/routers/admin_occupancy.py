import datetime
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import RoleChecker, get_current_user
from app.models.user import SinhVien, TaiKhoan
from app.models.dorm import ToaNha, Tang, Phong, Giuong
from app.models.contract import HopDong
from app.services import dorm_service, occupancy_request_store

router = APIRouter(prefix="/admin/occupancy", tags=["Quản lý Xử lý Lưu trú (Admin)"])


class ApproveRequestPayload(BaseModel):
    ma_toa: Optional[str] = None
    phong_id: str
    giuong_id: str


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
            # Ưu tiên phòng khớp loại phòng mong muốn
            pref_type = stored.get("loai_phong")
            matched_r = next(
                (r for r in available_rooms if pref_type and r.loai_phong and r.loai_phong.strip().lower() == pref_type.strip().lower()),
                available_rooms[0]
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
    dependencies=[Depends(RoleChecker(["QuanLy"]))],
)
def approve_request(
    request_id: str,
    payload: ApproveRequestPayload,
    db: Session = Depends(get_db),
):
    """
    Phê duyệt đơn đăng ký:
    - Tự động sinh mã hợp đồng theo chuẩn: HD{YY}-{toa}{phong}-G{giuong}
    - Cập nhật trạng thái giường sang đã có người ở.
    - Tạo bản ghi HopDong trạng thái ACTIVE.
    """
    clean_id = request_id.strip()
    registration = occupancy_request_store.get_request_by_id(clean_id)
    if not registration:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn đăng ký")
    if registration.get("trang_thai") not in ("PENDING", "CHO_DUYET"):
        raise HTTPException(status_code=409, detail="Đơn này đã được xử lý")

    student = db.query(SinhVien).filter(
        SinhVien.msv == registration.get("msv", "").strip().upper()
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ sinh viên của đơn")

    existing_contract = (
        db.query(HopDong)
        .filter(HopDong.msv == student.msv, HopDong.trang_thai == "ACTIVE")
        .first()
    )
    if existing_contract:
        raise HTTPException(status_code=409, detail="Sinh viên đã có hợp đồng lưu trú đang hiệu lực")

    # Định dạng năm hiện tại 2 chữ số (ví dụ 2026 -> 26)
    yy = datetime.date.today().strftime("%y")

    # Chuẩn hóa tên tòa, phòng, giường
    if not payload.ma_toa:
        raise HTTPException(status_code=400, detail="Vui lòng chọn tòa nhà")
    toa = payload.ma_toa
    phong = payload.phong_id.replace("Phòng ", "").replace("P", "")
    giuong = payload.giuong_id.replace("Giường ", "").replace("G", "")

    # Tự động tạo mã hợp đồng theo chuẩn HD{YY}-{toa}{phong}-G{giuong}
    contract_code = f"HD{yy}-{toa}{phong}-G{giuong}"

    # Cập nhật trạng thái giường trong CSDL nếu tìm thấy
    bed = db.query(Giuong).filter(Giuong.ma_giuong == payload.giuong_id).first()
    if not bed or bed.ma_phong != payload.phong_id or bed.trang_thai != "TRONG":
        raise HTTPException(status_code=409, detail="Giường này không còn trống")
    room = db.query(Phong).filter(Phong.ma_phong == bed.ma_phong).first()
    floor = db.query(Tang).filter(Tang.ma_tang == room.ma_tang).first() if room else None
    if not room or not floor or floor.ma_toa != toa:
        raise HTTPException(status_code=400, detail="Phòng không thuộc tòa nhà đã chọn")
    bed.trang_thai = "DA_CO_NGUOI"

    msv = student.msv

    # Tạo hoặc cập nhật HopDong
    existing_contract = db.query(HopDong).filter(HopDong.ma_hop_dong == contract_code).first()
    if not existing_contract:
        new_contract = HopDong(
            ma_hop_dong=contract_code,
            msv=msv,
            ma_giuong=payload.giuong_id,
            ngay_bat_dau=datetime.date.today(),
            ngay_ket_thuc=datetime.date.today() + datetime.timedelta(days=365),
            trang_thai="ACTIVE",
        )
        db.add(new_contract)
    else:
        existing_contract.trang_thai = "ACTIVE"

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Không thể hoàn tất xếp phòng")

    occupancy_request_store.update_request_status(
        clean_id,
        "APPROVED",
        {
            "ma_hop_dong": contract_code,
            "ma_toa": toa,
            "toa_nha": floor.toa_nha.ten_toa if floor.toa_nha else toa,
            "ma_phong": payload.phong_id,
            "so_phong": room.so_phong,
            "loai_phong": room.loai_phong,
            "ma_giuong": payload.giuong_id,
            "so_giuong": payload.giuong_id,
        },
    )

    return {
        "status": "success",
        "message": f"Phê duyệt và xếp phòng thành công cho đơn {request_id}",
        "data": {
            "ma_hop_dong": contract_code,
            "msv": msv,
            "ma_toa": toa,
            "toa_nha": floor.toa_nha.ten_toa if floor.toa_nha else toa,
            "ma_phong": payload.phong_id,
            "so_phong": room.so_phong,
            "loai_phong": room.loai_phong,
            "ma_giuong": payload.giuong_id,
            "so_giuong": payload.giuong_id,
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

