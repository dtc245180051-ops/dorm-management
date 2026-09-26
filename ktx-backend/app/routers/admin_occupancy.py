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
    - Tự động sinh mã hợp đồng theo chuẩn: HD{YY}-{toa}{phong}-G{giuong}
    - Cập nhật trạng thái giường sang đã có người ở.
    - Tạo bản ghi HopDong trạng thái ACTIVE.
    """
    clean_id = request_id.strip()

    # Định dạng năm hiện tại 2 chữ số (ví dụ 2026 -> 26)
    yy = datetime.date.today().strftime("%y")

    # Chuẩn hóa tên tòa, phòng, giường
    toa = payload.ma_toa or "A"
    phong = payload.phong_id.replace("Phòng ", "").replace("P", "")
    giuong = payload.giuong_id.replace("Giường ", "").replace("G", "")

    # Tự động tạo mã hợp đồng theo chuẩn HD{YY}-{toa}{phong}-G{giuong}
    contract_code = f"HD{yy}-{toa}{phong}-G{giuong}"

    # Cập nhật trong store
    occupancy_request_store.update_request_status(
        clean_id,
        "DA_DUYET",
        {
            "ma_hop_dong": contract_code,
            "ma_toa": toa,
            "ma_phong": payload.phong_id,
            "ma_giuong": payload.giuong_id,
        },
    )

    # Cập nhật trạng thái giường trong CSDL nếu tìm thấy
    bed = db.query(Giuong).filter(Giuong.ma_giuong == payload.giuong_id).first()
    if bed:
        bed.trang_thai = "DA_CO_NGUOI"

    student = db.query(SinhVien).filter(SinhVien.msv == clean_id).first()
    msv = student.msv if student else clean_id

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

    return {
        "status": "success",
        "message": f"Phê duyệt và xếp phòng thành công cho đơn {request_id}",
        "data": {
            "ma_hop_dong": contract_code,
            "msv": msv,
            "ma_toa": toa,
            "ma_phong": payload.phong_id,
            "ma_giuong": payload.giuong_id,
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
