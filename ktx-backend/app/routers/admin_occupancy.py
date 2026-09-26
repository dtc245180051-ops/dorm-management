import datetime
import logging
import re
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

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
    email: Optional[str] = None
    so_dien_thoai: Optional[str] = None
    gioi_tinh: Optional[str] = None
    lop: Optional[str] = None
    khoa: Optional[str] = None
    que_quan: Optional[str] = None
    ngay_sinh: Optional[str] = None
    cccd: Optional[str] = None
    dia_chi: Optional[str] = None
    doi_tuong_uu_tien: Optional[str] = None
    nguoi_giam_ho: Optional[str] = None
    moi_quan_he: Optional[str] = None
    sdt_nguoi_giam_ho: Optional[str] = None


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
        return stored

    # 2. Tìm kiếm sinh viên từ CSDL theo MSV
    student = db.query(SinhVien).filter(SinhVien.msv == clean_id).first()
    if not student:
        student = db.query(SinhVien).first()

    # Gợi ý phòng/giường trống đầu tiên từ hệ thống
    suggested_building = "A"
    suggested_room = "A203"
    suggested_bed = "G04"

    available_rooms = dorm_service.get_available_beds(db)
    if available_rooms:
        r = available_rooms[0]
        suggested_building = r.ma_toa or "A"
        suggested_room = r.so_phong or f"{suggested_building}203"
        if r.giuongs:
            for b in r.giuongs:
                if b.trang_thai == "TRONG":
                    suggested_bed = b.ma_giuong
                    break

    email_display = (
        student.nguoi_dung.email
        if student and student.nguoi_dung and student.nguoi_dung.email
        else "b21dccn001@ictu.edu.vn"
    )
    ho_ten_display = (
        student.nguoi_dung.ho_ten
        if student and student.nguoi_dung and student.nguoi_dung.ho_ten
        else "Nguyễn Văn A"
    )
    phone_display = (
        student.nguoi_dung.so_dien_thoai
        if student and student.nguoi_dung and student.nguoi_dung.so_dien_thoai
        else "0987654321"
    )

    return {
        "id": clean_id,
        "msv": student.msv if student else "B21DCCN001",
        "ho_ten": ho_ten_display,
        "gioi_tinh": student.gioi_tinh if student else "Nam",
        "ngay_sinh": student.ngay_sinh if student else "2003-05-15",
        "cccd": student.cccd if student else "001203004567",
        "so_dien_thoai": phone_display,
        "email": email_display,
        "khoa": student.khoa if student else "Công nghệ thông tin",
        "lop": student.lop if student else "D21CQCN01-B",
        "dia_chi": student.dia_chi if student else "Số 123 Đường Cầu Giấy, Hà Nội",
        "doi_tuong_uu_tien": student.doi_tuong_uu_tien if student else "Không thuộc diện ưu tiên",
        "nguoi_giam_ho": student.nguoi_giam_ho if student else "Nguyễn Văn B",
        "moi_quan_he": student.moi_quan_he if student else "Bố",
        "sdt_nguoi_giam_ho": student.sdt_nguoi_giam_ho if student else "0912345678",
        "nguyen_vong": "Xin hãy xếp cho em 1 phòng nào đó ở tòa A với ạ 🥹",
        "trang_thai": "CHO_DUYET",
        "goi_y": {
            "ma_toa": suggested_building,
            "ma_phong": suggested_room,
            "ma_giuong": suggested_bed,
        },
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
        b_data = {
            "ma_toa": b.ma_toa,
            "ten_toa": b.ten_toa,
            "rooms": [],
        }
        for floor in b.tangs:
            for room in floor.phongs:
                empty_beds = [bed for bed in room.giuongs if bed.trang_thai == "TRONG"]
                if empty_beds:
                    b_data["rooms"].append({
                        "ma_phong": room.ma_phong,
                        "so_phong": room.so_phong,
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

    # Đảm bảo có dữ liệu mẫu nếu DB chưa có
    if not results:
        results = [
            {
                "ma_toa": "A",
                "ten_toa": "Tòa A",
                "rooms": [
                    {
                        "ma_phong": "A203",
                        "so_phong": "A203",
                        "label": "Phòng A203",
                        "beds": [
                            {"ma_giuong": "G01", "label": "Giường G01"},
                            {"ma_giuong": "G02", "label": "Giường G02"},
                            {"ma_giuong": "G04", "label": "Giường G04"},
                        ],
                    },
                    {
                        "ma_phong": "A204",
                        "so_phong": "A204",
                        "label": "Phòng A204",
                        "beds": [
                            {"ma_giuong": "G01", "label": "Giường G01"},
                            {"ma_giuong": "G03", "label": "Giường G03"},
                        ],
                    },
                ],
            },
            {
                "ma_toa": "B",
                "ten_toa": "Tòa B",
                "rooms": [
                    {
                        "ma_phong": "B101",
                        "so_phong": "B101",
                        "label": "Phòng B101",
                        "beds": [
                            {"ma_giuong": "G01", "label": "Giường G01"},
                            {"ma_giuong": "G02", "label": "Giường G02"},
                        ],
                    },
                ],
            },
        ]

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
    - Tự động tạo / cập nhật hồ sơ sinh viên trong CSDL.
    - Cập nhật trạng thái giường sang DA_O (đã có người ở).
    - Tạo hợp đồng lưu trú HopDong trạng thái ACTIVE theo chuẩn HD{YY}-{toa}{phong}-G{giuong}.
    - Cập nhật trạng thái đơn thành DA_DUYET.
    """
    clean_id = request_id.strip()

    # 1. Tìm đơn trong store nếu có
    stored_req = occupancy_request_store.get_request_by_id(clean_id)

    # 2. Thu thập thông tin sinh viên từ payload hoặc stored_req
    raw_msv = (
        payload.msv
        or (stored_req.get("msv") if stored_req else None)
        or clean_id
    )
    clean_msv = raw_msv.strip().upper()

    ho_ten = (
        payload.ho_ten
        or (stored_req.get("ho_ten") if stored_req else None)
        or "Sinh viên"
    ).strip()

    email = (
        payload.email
        or (stored_req.get("email") if stored_req else None)
    )
    if email:
        email = email.strip()

    so_dien_thoai = (
        payload.so_dien_thoai
        or (stored_req.get("so_dien_thoai") if stored_req else None)
    )
    if so_dien_thoai:
        so_dien_thoai = so_dien_thoai.strip()

    gioi_tinh = (
        payload.gioi_tinh
        or (stored_req.get("gioi_tinh") if stored_req else None)
        or "Nam"
    )

    lop = (
        payload.lop
        or (stored_req.get("lop") if stored_req else None)
        or "CNTTK24"
    )

    khoa = (
        payload.khoa
        or (stored_req.get("khoa") if stored_req else None)
        or "Công nghệ thông tin"
    )

    ngay_sinh = (
        payload.ngay_sinh
        or (stored_req.get("ngay_sinh") if stored_req else None)
    )

    cccd = (
        payload.cccd
        or (stored_req.get("cccd") if stored_req else None)
    )

    dia_chi = (
        payload.dia_chi
        or (stored_req.get("dia_chi") if stored_req else None)
    )

    que_quan = (
        payload.que_quan
        or (stored_req.get("que_quan") if stored_req else None)
        or (dia_chi.split(",")[-1].strip() if dia_chi else None)
    )

    doi_tuong_uu_tien = (
        payload.doi_tuong_uu_tien
        or (stored_req.get("doi_tuong_uu_tien") if stored_req else None)
        or "Không thuộc diện ưu tiên"
    )

    nguoi_giam_ho = (
        payload.nguoi_giam_ho
        or (stored_req.get("nguoi_giam_ho") if stored_req else None)
    )

    moi_quan_he = (
        payload.moi_quan_he
        or (stored_req.get("moi_quan_he") if stored_req else None)
    )

    sdt_nguoi_giam_ho = (
        payload.sdt_nguoi_giam_ho
        or (stored_req.get("sdt_nguoi_giam_ho") if stored_req else None)
    )

    # 3. Tạo mới hoặc cập nhật hồ sơ sinh viên
    student = db.query(SinhVien).filter(SinhVien.msv == clean_msv).first()

    if student:
        # Cập nhật thông tin sinh viên hiện có
        if student.nguoi_dung:
            if ho_ten:
                student.nguoi_dung.ho_ten = ho_ten
            if so_dien_thoai:
                student.nguoi_dung.so_dien_thoai = so_dien_thoai
            if email:
                other_email_user = db.query(NguoiDung).filter(
                    NguoiDung.email == email,
                    NguoiDung.ma_nguoi_dung != student.ma_nguoi_dung
                ).first()
                if not other_email_user:
                    student.nguoi_dung.email = email
        if lop:
            student.lop = lop
        if gioi_tinh:
            student.gioi_tinh = gioi_tinh
        if khoa:
            student.khoa = khoa
        if que_quan:
            student.que_quan = que_quan
        if ngay_sinh:
            student.ngay_sinh = ngay_sinh
        if cccd:
            student.cccd = cccd
        if dia_chi:
            student.dia_chi = dia_chi
        if doi_tuong_uu_tien:
            student.doi_tuong_uu_tien = doi_tuong_uu_tien
        if nguoi_giam_ho:
            student.nguoi_giam_ho = nguoi_giam_ho
        if moi_quan_he:
            student.moi_quan_he = moi_quan_he
        if sdt_nguoi_giam_ho:
            student.sdt_nguoi_giam_ho = sdt_nguoi_giam_ho
        db.flush()
    else:
        # Tạo mới tài khoản, người dùng, sinh viên
        clean_username = clean_msv.lower()
        account = db.query(TaiKhoan).filter(TaiKhoan.ten_dang_nhap == clean_username).first()
        if not account:
            account = TaiKhoan(
                ma_tai_khoan=str(uuid.uuid4()),
                ten_dang_nhap=clean_username,
                mat_khau=get_password_hash(clean_msv),
                vai_tro=VaiTro.SINH_VIEN,
            )
            db.add(account)
            db.flush()

        user_email = email if email else f"{clean_username}@ictu.edu.vn"
        if db.query(NguoiDung).filter(NguoiDung.email == user_email).first():
            user_email = f"{clean_username}_{uuid.uuid4().hex[:4]}@ictu.edu.vn"

        user = NguoiDung(
            ma_nguoi_dung=str(uuid.uuid4()),
            ma_tai_khoan=account.ma_tai_khoan,
            ho_ten=ho_ten,
            email=user_email,
            so_dien_thoai=so_dien_thoai,
        )
        db.add(user)
        db.flush()

        student = SinhVien(
            msv=clean_msv,
            ma_nguoi_dung=user.ma_nguoi_dung,
            lop=lop,
            gioi_tinh=gioi_tinh,
            khoa=khoa,
            que_quan=que_quan,
            ngay_sinh=ngay_sinh,
            cccd=cccd,
            dia_chi=dia_chi,
            doi_tuong_uu_tien=doi_tuong_uu_tien,
            nguoi_giam_ho=nguoi_giam_ho,
            moi_quan_he=moi_quan_he,
            sdt_nguoi_giam_ho=sdt_nguoi_giam_ho,
        )
        db.add(student)
        db.flush()

    # 4. Tìm giường và cập nhật trạng thái giường sang DA_O
    bed = db.query(Giuong).filter(Giuong.ma_giuong == payload.giuong_id).first()
    if not bed:
        bed = db.query(Giuong).filter(
            (Giuong.ma_phong == payload.phong_id) &
            (Giuong.ma_giuong.ilike(f"%{payload.giuong_id}%"))
        ).first()

    if bed:
        bed.trang_thai = "DA_O"
        actual_bed_id = bed.ma_giuong
    else:
        actual_bed_id = payload.giuong_id

    # 5. Chấm dứt các hợp đồng ACTIVE trước đó của sinh viên này để chuyển sang giường mới
    old_active_contracts = db.query(HopDong).filter(
        HopDong.msv == clean_msv,
        HopDong.trang_thai == "ACTIVE"
    ).all()
    for oc in old_active_contracts:
        oc.trang_thai = "TERMINATED"
        oc.ngay_ket_thuc = datetime.date.today()
        if oc.giuong and oc.giuong.ma_giuong != actual_bed_id:
            oc.giuong.trang_thai = "TRONG"

    # Chấm dứt hợp đồng ACTIVE cũ trên chính chiếc giường này nếu có người khác đang ở
    bed_old_contracts = db.query(HopDong).filter(
        HopDong.ma_giuong == actual_bed_id,
        HopDong.trang_thai == "ACTIVE"
    ).all()
    for bc in bed_old_contracts:
        if bc.msv != clean_msv:
            bc.trang_thai = "TERMINATED"
            bc.ngay_ket_thuc = datetime.date.today()

    # 6. Tạo mã hợp đồng HD{YY}-{toa}{phong}-G{giuong}
    yy = datetime.date.today().strftime("%y")
    toa = payload.ma_toa or (bed.phong.tang.ma_toa if bed and bed.phong and bed.phong.tang else "A")
    room_num = (
        bed.phong.so_phong
        if bed and bed.phong and bed.phong.so_phong
        else (payload.phong_id or "101").split("_")[-1].replace("Phòng", "").replace("P", "").strip()
    )
    giuong_part = actual_bed_id.split("_")[-1] if "_" in actual_bed_id else actual_bed_id
    giuong_num = giuong_part.replace("Giường ", "").replace("G", "")
    contract_code = f"HD{yy}-{toa}{room_num}-G{giuong_num}"

    # 7. Tạo hoặc cập nhật HopDong
    existing_contract = db.query(HopDong).filter(HopDong.ma_hop_dong == contract_code).first()
    if not existing_contract:
        new_contract = HopDong(
            ma_hop_dong=contract_code,
            msv=clean_msv,
            ma_giuong=actual_bed_id,
            ngay_bat_dau=datetime.date.today(),
            ngay_ket_thuc=datetime.date.today() + datetime.timedelta(days=365),
            trang_thai="ACTIVE",
        )
        db.add(new_contract)
    else:
        existing_contract.msv = clean_msv
        existing_contract.ma_giuong = actual_bed_id
        existing_contract.ngay_bat_dau = datetime.date.today()
        existing_contract.ngay_ket_thuc = datetime.date.today() + datetime.timedelta(days=365)
        existing_contract.trang_thai = "ACTIVE"

    # 8. Cập nhật trong store
    occupancy_request_store.update_request_status(
        clean_id,
        "DA_DUYET",
        {
            "ma_hop_dong": contract_code,
            "ma_toa": toa,
            "ma_phong": payload.phong_id,
            "ma_giuong": actual_bed_id,
            "msv": clean_msv,
        },
    )

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Error approving registration {request_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi lưu dữ liệu phê duyệt và cập nhật hồ sơ sinh viên: {str(e)}",
        )

    return {
        "status": "success",
        "message": f"Phê duyệt và xếp phòng thành công cho đơn {request_id}",
        "data": {
            "ma_hop_dong": contract_code,
            "msv": clean_msv,
            "ho_ten": ho_ten,
            "ma_toa": toa,
            "ma_phong": payload.phong_id,
            "ma_giuong": actual_bed_id,
            "trang_thai": "DA_DUYET",
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
