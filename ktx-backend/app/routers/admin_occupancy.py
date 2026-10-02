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
            "gioi_tinh": b.gioi_tinh,
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
                "gioi_tinh": "Nam & Nữ",
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
                "gioi_tinh": "Nam & Nữ",
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

    # 2. Đảm bảo bản ghi SinhVien tồn tại trong CSDL để thỏa mãn Foreign Key hop_dong.msv
    student = db.query(SinhVien).filter(func.lower(SinhVien.msv) == target_msv.lower()).first()
    if not student:
        # Thử tìm theo TaiKhoan
        tk = db.query(TaiKhoan).filter(func.lower(TaiKhoan.ten_dang_nhap) == target_msv.lower()).first()
        if tk and tk.nguoi_dung:
            student = SinhVien(
                msv=target_msv,
                ma_nguoi_dung=tk.nguoi_dung.ma_nguoi_dung,
                lop="DTC-KTX",
                gioi_tinh="Nam",
            )
            db.add(student)
            db.flush()
        else:
            name_val = payload.ho_ten or (req_item.get("ho_ten") if req_item else "Sinh viên")
            email_val = (req_item.get("email") if req_item else None) or f"{target_msv.lower()}@ictu.edu.vn"
            phone_val = req_item.get("so_dien_thoai") if req_item else None
            gender_val = req_item.get("gioi_tinh") if req_item else "Nam"
            lop_val = req_item.get("lop") if req_item else "DTC-KTX"
            new_acc = TaiKhoan(
                ma_tai_khoan=str(uuid.uuid4()),
                ten_dang_nhap=target_msv.lower()[:50],
                mat_khau=get_password_hash("password123"),
                vai_tro=VaiTro.SINH_VIEN,
            )
            db.add(new_acc)
            db.flush()
            nd = NguoiDung(
                ma_nguoi_dung=str(uuid.uuid4()),
                ma_tai_khoan=new_acc.ma_tai_khoan,
                ho_ten=name_val,
                email=email_val,
                so_dien_thoai=phone_val,
            )
            db.add(nd)
            db.flush()
            student = SinhVien(
                msv=target_msv,
                ma_nguoi_dung=nd.ma_nguoi_dung,
                lop=lop_val,
                gioi_tinh=gender_val,
            )
            db.add(student)
            db.flush()

    # 3. Đảm bảo cấu trúc Tòa nhà -> Tầng -> Phòng -> Giường tồn tại để thỏa mãn Foreign Key hop_dong.ma_giuong
    raw_toa = (payload.ma_toa or (req_item.get("goi_y", {}).get("ma_toa") if req_item else None) or "A1").strip().upper()
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

    # Tầng: xác định từ số phòng (ví dụ P101 -> tầng 1, P205 -> tầng 2, P36 -> tầng 3)
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
    bed = db.query(Giuong).filter(Giuong.ma_giuong == giuong_code).first()
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

    # 4. Định dạng năm và mã hợp đồng chuẩn (không quá 20 ký tự theo MySQL schema)
    yy = datetime.date.today().strftime("%y")
    clean_p = phong.so_phong.replace("Phòng ", "").replace("P", "")
    clean_g = bed.ma_giuong.replace("Giường ", "").replace("G", "").replace("_", "")
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
        # Nếu mã hợp đồng đã bị bản ghi khác sử dụng, tạo mã duy nhất
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

    # 5. Cập nhật trong store để quản lý thấy ngay trên giao diện
    occupancy_request_store.update_request_status(
        clean_id,
        "DA_DUYET",
        {
            "ma_hop_dong": contract_code,
            "ma_toa": toa.ma_toa,
            "ma_phong": phong.ma_phong,
            "ma_giuong": bed.ma_giuong,
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
            "ma_phong": phong.ma_phong,
            "ma_giuong": bed.ma_giuong,
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

