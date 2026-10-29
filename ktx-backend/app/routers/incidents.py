import datetime
import json
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.database import get_db
from app.core.deps import RoleChecker, get_current_user, get_current_student
from app.core.security import get_password_hash
from app.models.incident import PhanAnh, ViPham
from app.models.user import NguoiDung, SinhVien, TaiKhoan, VaiTro
from app.services.incident_ai import analyze_incident_with_ai, generate_daily_incident_summary
from sqlalchemy.orm import Session, joinedload

router = APIRouter(prefix="/incidents", tags=["Phản ánh và Báo hỏng KTX"])


@router.get(
    "/violations",
    dependencies=[Depends(RoleChecker(["QuanLy", "Admin"]))],
    summary="[Quản lý] Lấy danh sách biên bản vi phạm",
)
def list_violations(
    current_user: TaiKhoan = Depends(RoleChecker(["QuanLy", "Admin"])),
    db: Session = Depends(get_db)
):
    records = db.query(ViPham).order_by(ViPham.ngay_vi_pham.desc()).all()
    results = []
    for item in records:
        phong_str = ""
        sdt_str = ""
        if item.sinh_vien:
            if item.sinh_vien.nguoi_dung and item.sinh_vien.nguoi_dung.so_dien_thoai:
                sdt_str = item.sinh_vien.nguoi_dung.so_dien_thoai
            if item.sinh_vien.hop_dongs:
                active_hd = next((h for h in item.sinh_vien.hop_dongs if h.trang_thai == "ACTIVE"), None)
                if active_hd and active_hd.giuong and active_hd.giuong.phong:
                    p = active_hd.giuong.phong
                    toa_code = p.ma_toa.replace("TOA_", "").replace("toa_", "") if p.ma_toa else ""
                    toa_str = f" - Tòa {toa_code}" if toa_code else ""
                    phong_str = f"P{p.so_phong}{toa_str}"

        # Đếm số lần vi phạm lũy kế của sinh viên này
        so_lan_luy_ke = db.query(ViPham).filter(ViPham.msv == item.msv).count()

        # Parse danh sách file bằng chứng đính kèm
        bang_chung_list = []
        if item.bang_chung:
            try:
                bang_chung_list = json.loads(item.bang_chung)
                if not isinstance(bang_chung_list, list):
                    bang_chung_list = [str(bang_chung_list)]
            except Exception:
                bang_chung_list = [f.strip() for f in item.bang_chung.split(",") if f.strip()]

        status_val = getattr(item, "trang_thai", None) or "CHO_XU_LY"
        sub_status_val = getattr(item, "sub_status", None) or ("DA_XU_LY_DUT_DIEM" if status_val == "DA_XU_LY" else "CHO_GIAI_TRINH")

        results.append({
            "id": item.ma_vi_pham,
            "ma_bb": item.ma_vi_pham,
            "msv": item.msv,
            "ho_ten": item.sinh_vien.nguoi_dung.ho_ten if item.sinh_vien and item.sinh_vien.nguoi_dung else item.msv,
            "phong": phong_str,
            "phong_ngan": phong_str,
            "sdt": sdt_str,
            "hanh_vi": item.mo_ta,
            "mo_ta": item.mo_ta,
            "nhom_vi_pham": getattr(item, "nhom_vi_pham", None) or "Vi phạm nội quy KTX",
            "thoi_diem": getattr(item, "thoi_diem", None) or (item.ngay_vi_pham.strftime("%d/%m/%Y") if item.ngay_vi_pham else ""),
            "dia_diem": getattr(item, "dia_diem", None) or (f"Phòng {phong_str}" if phong_str else "Ký túc xá"),
            "so_lan_luy_ke": f"{so_lan_luy_ke} lần",
            "bang_chung": bang_chung_list,
            "hinh_thuc_xu_ly": item.hinh_thuc_xu_ly,
            "quyet_dinh": getattr(item, "quyet_dinh", None) or item.hinh_thuc_xu_ly,
            "ghi_chu": getattr(item, "ghi_chu", None) or "",
            "nguoi_lap": getattr(item, "nguoi_lap", None) or "Ban quản lý KTX",
            "ngay_lap": item.ngay_vi_pham.strftime("%d/%m/%Y") if item.ngay_vi_pham else "",
            "trang_thai": status_val,
            "sub_status": sub_status_val,
            "giai_trinh": getattr(item, "giai_trinh", None) or "",
            "giai_trinh_at": getattr(item, "giai_trinh_at", None) or "",
        })
    return results


class CreateViolationRequest(BaseModel):
    msv: str
    mo_ta: str
    ho_ten: Optional[str] = None
    phong: Optional[str] = None
    thoi_gian: Optional[str] = None
    thoi_diem: Optional[str] = None
    dia_diem: Optional[str] = None
    nhom_hanh_vi: Optional[str] = None
    nhom_vi_pham: Optional[str] = None
    dinh_kem: Optional[List[str]] = None
    bang_chung: Optional[List[str]] = None
    hinh_thuc_xu_ly: Optional[str] = "Đang xem xét"
    trang_thai: Optional[str] = "CHO_XU_LY"
    nguoi_lap: Optional[str] = "Ban quản lý KTX"


@router.post(
    "/violations",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RoleChecker(["QuanLy", "Admin"]))],
    summary="[Quản lý] Lập biên bản vi phạm",
)
def create_violation(
    req: CreateViolationRequest,
    current_user: TaiKhoan = Depends(RoleChecker(["QuanLy", "Admin"])),
    db: Session = Depends(get_db)
):
    student = db.query(SinhVien).filter(SinhVien.msv == req.msv).first()
    if not student:
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên trong cơ sở dữ liệu")

    attachments = req.dinh_kem or req.bang_chung or []
    bang_chung_str = json.dumps(attachments, ensure_ascii=False) if attachments else None

    item = ViPham(
        ma_vi_pham=f"VP-{uuid.uuid4().hex[:12].upper()}",
        msv=req.msv,
        mo_ta=req.mo_ta,
        ngay_vi_pham=datetime.date.today(),
        hinh_thuc_xu_ly=req.hinh_thuc_xu_ly or "Đang xem xét",
        trang_thai=req.trang_thai or "CHO_XU_LY",
        dia_diem=req.dia_diem,
        thoi_diem=req.thoi_diem or req.thoi_gian or datetime.date.today().strftime("%d/%m/%Y"),
        nhom_vi_pham=req.nhom_vi_pham or req.nhom_hanh_vi or "Vi phạm nội quy KTX",
        bang_chung=bang_chung_str,
        nguoi_lap=req.nguoi_lap or "Ban quản lý KTX",
        sub_status="CHO_GIAI_TRINH",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "id": item.ma_vi_pham,
        "ma_bb": item.ma_vi_pham,
        "msv": item.msv,
        "hanh_vi": item.mo_ta,
        "trang_thai": item.trang_thai,
    }


class UpdateViolationStatusRequest(BaseModel):
    trang_thai: Optional[str] = None
    sub_status: Optional[str] = None
    hinh_thuc_xu_ly: Optional[str] = None
    quyet_dinh: Optional[str] = None
    ghi_chu: Optional[str] = None
    giai_trinh: Optional[str] = None
    giai_trinh_at: Optional[str] = None


@router.put(
    "/violations/{ma_vi_pham}",
    dependencies=[Depends(RoleChecker(["QuanLy", "Admin"]))],
    summary="[Quản lý] Cập nhật biên bản vi phạm",
)
def update_violation(
    ma_vi_pham: str,
    req: UpdateViolationStatusRequest,
    current_user: TaiKhoan = Depends(RoleChecker(["QuanLy", "Admin"])),
    db: Session = Depends(get_db)
):
    item = db.query(ViPham).filter(ViPham.ma_vi_pham == ma_vi_pham).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy biên bản vi phạm")
    if req.trang_thai:
        item.trang_thai = req.trang_thai
    if req.sub_status:
        item.sub_status = req.sub_status
    if req.hinh_thuc_xu_ly or req.quyet_dinh:
        item.hinh_thuc_xu_ly = req.hinh_thuc_xu_ly or req.quyet_dinh
        item.quyet_dinh = req.quyet_dinh or req.hinh_thuc_xu_ly
    if req.ghi_chu is not None:
        item.ghi_chu = req.ghi_chu
    if req.giai_trinh is not None:
        item.giai_trinh = req.giai_trinh
    if req.giai_trinh_at is not None:
        item.giai_trinh_at = req.giai_trinh_at
    db.commit()
    db.refresh(item)
    return {
        "id": item.ma_vi_pham,
        "ma_bb": item.ma_vi_pham,
        "trang_thai": item.trang_thai,
        "sub_status": item.sub_status,
        "hinh_thuc_xu_ly": item.hinh_thuc_xu_ly,
        "quyet_dinh": item.quyet_dinh,
        "ghi_chu": item.ghi_chu,
        "giai_trinh": item.giai_trinh,
        "giai_trinh_at": item.giai_trinh_at,
    }


class CreateIncidentRequest(BaseModel):
    msv: Optional[str] = None
    ho_ten: Optional[str] = None
    phong: Optional[str] = None
    mo_ta: str
    hinh_anh: Optional[str] = None
    # Các trường tùy chọn nếu client gửi (nếu không có sẽ do AI tự trích xuất)
    tieu_de: Optional[str] = None
    loai_phan_anh: Optional[str] = None


class UpdateIncidentStatusRequest(BaseModel):
    trang_thai: str
    ghi_chu_xu_ly: Optional[str] = None


def ensure_student_exists_for_incident(db: Session, msv: Optional[str], ho_ten: Optional[str] = None) -> str:
    """Đảm bảo sinh viên tồn tại trong MySQL để đảm bảo tính toàn vẹn quan hệ (Foreign Key)."""
    clean_msv = (msv or "").strip()
    if not clean_msv:
        first_sv = db.query(SinhVien).first()
        return first_sv.msv if first_sv else "DTC245180037"

    student = db.query(SinhVien).filter(SinhVien.msv.ilike(clean_msv)).first()
    if student:
        return student.msv

    # Tự động tạo tài khoản và sinh viên nếu chưa có để đảm bảo toàn vẹn dữ liệu
    normalized_msv = clean_msv.upper()
    full_name = ho_ten or f"Sinh viên {normalized_msv}"
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
            ho_ten=full_name,
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
    return student.msv


def serialize_incident(item: PhanAnh, ho_ten_fallback: Optional[str] = None) -> dict:
    """Serialize model PhanAnh sang dictionary tương thích với giao diện và API."""
    ho_ten = (
        ho_ten_fallback
        or (
            item.sinh_vien.nguoi_dung.ho_ten
            if (item.sinh_vien and item.sinh_vien.nguoi_dung)
            else item.msv
        )
    )
    status_map = {
        "CHO_XU_LY": "Chờ xử lý",
        "DANG_XU_LY": "Đang xử lý",
        "DA_XU_LY": "Đã xử lý",
        "HOAN_THANH": "Đã xử lý",
        "TU_CHOI": "Từ chối",
    }
    return {
        "id": item.ma_phan_anh,
        "ma_phan_anh": item.ma_phan_anh,
        "msv": item.msv,
        "ho_ten": ho_ten,
        "phong": item.phong or "",
        "loai_phan_anh": item.phan_loai or "Cơ sở vật chất",
        "phan_loai": item.phan_loai or "Cơ sở vật chất",
        "tieu_de": item.tieu_de or item.tom_tat or (item.noi_dung[:40] if item.noi_dung else "Sự cố"),
        "mo_ta": item.mo_ta or item.noi_dung or "",
        "hinh_anh": item.hinh_anh,
        "muc_do_uu_tien": item.muc_do_uu_tien or "Thường",
        "trang_thai": item.trang_thai or "CHO_XU_LY",
        "trang_thai_label": status_map.get(item.trang_thai, "Chờ xử lý"),
        "ngay_gui": item.ngay_gui.isoformat() if item.ngay_gui else None,
        "ngay_tao": item.ngay_tao.isoformat() if item.ngay_tao else (item.ngay_gui.isoformat() if item.ngay_gui else None),
        "ghi_chu_xu_ly": item.ghi_chu_xu_ly or "",
        "is_ai_processed": getattr(item, "is_ai_processed", False),
        "ai_error_reason": getattr(item, "ai_error_reason", None),
    }


@router.post(
    "",
    summary="Sinh viên gửi phản ánh sự cố - Tích hợp AI tự động phân loại (Chống IDOR)",
    status_code=status.HTTP_201_CREATED,
)
def create_incident(
    req: CreateIncidentRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Tiếp nhận phản ánh từ sinh viên:
    - Chống IDOR: Ràng buộc danh tính sinh viên từ Token đã xác thực
    - AI tự động trích xuất: tieu_de, phan_loai, muc_do_uu_tien
    - Quản lý Transaction trong MySQL để đảm bảo tính toàn vẹn (ACID):
      Mọi thay đổi được commit vào MySQL; nếu có ngoại lệ sẽ rollback toàn bộ và trả về HTTP 500.
    """
    clean_mo_ta = req.mo_ta.strip() if req.mo_ta else ""
    if not clean_mo_ta:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng nhập mô tả chi tiết sự cố bạn gặp phải.",
        )

    # 1. Xác thực và chống IDOR
    if current_user.vai_tro == VaiTro.SINH_VIEN:
        student = get_current_student(current_user=current_user, db=db)
        db_msv = student.msv
        sender_name = student.nguoi_dung.ho_ten if student.nguoi_dung else student.msv
    else:
        # Ban Quản trị / Quản lý có thể ghi nhận hộ sinh viên nếu cần
        db_msv = ensure_student_exists_for_incident(db, req.msv, req.ho_ten)
        sender_name = req.ho_ten or f"Quản trị viên ({current_user.ten_dang_nhap})"

    # 2. AI tự động phân tích mô tả của sinh viên
    ai_result = analyze_incident_with_ai(clean_mo_ta, req.phong)

    tieu_de = req.tieu_de.strip() if (req.tieu_de and req.tieu_de.strip()) else ai_result["tieu_de"]
    phan_loai = req.loai_phan_anh.strip() if (req.loai_phan_anh and req.loai_phan_anh.strip()) else ai_result["phan_loai"]
    muc_do_uu_tien = ai_result["muc_do_uu_tien"]
    is_ai_processed = bool(ai_result.get("is_ai_processed", False))
    ai_error_reason = ai_result.get("ai_error_reason")

    incident_code = f"PA-{uuid.uuid4().hex[:6].upper()}"

    # 3. Xử lý Transaction ACID vào CSDL MySQL
    try:
        now_dt = datetime.datetime.now()
        today_d = datetime.date.today()

        new_incident = PhanAnh(
            ma_phan_anh=incident_code,
            msv=db_msv,
            noi_dung=clean_mo_ta,
            trang_thai="CHO_XU_LY",
            ngay_gui=today_d,
            phan_loai=phan_loai,
            tom_tat=tieu_de[:200],
            tieu_de=tieu_de,
            muc_do_uu_tien=muc_do_uu_tien,
            phong=req.phong or "",
            mo_ta=clean_mo_ta,
            hinh_anh=req.hinh_anh,
            ghi_chu_xu_ly="",
            ngay_tao=now_dt,
            is_ai_processed=is_ai_processed,
            ai_error_reason=ai_error_reason,
        )
        db.add(new_incident)
        db.commit()
        db.refresh(new_incident)
    except Exception as db_err:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi cơ sở dữ liệu khi tạo phản ánh (Transaction rolled back): {str(db_err)}",
        )

    created_data = serialize_incident(new_incident, ho_ten_fallback=sender_name)

    if is_ai_processed:
        resp_msg = "Gửi phản ánh thành công! AI đã tiếp nhận và phân tích sự cố."
    else:
        resp_msg = f"Gửi phản ánh thành công! (Lưu ý: Mô hình AI gián đoạn, hệ thống dùng phân loại dự phòng. Lý do: {ai_error_reason or 'Fallback Heuristic'})"

    return {
        "status": "success",
        "message": resp_msg,
        "is_ai_processed": is_ai_processed,
        "ai_error_reason": ai_error_reason,
        "data": created_data,
    }


@router.get(
    "/daily-summary",
    dependencies=[Depends(RoleChecker(["QuanLy", "Admin"]))],
    summary="AI Tóm tắt sự cố trong ngày hôm nay cho Ban Quản lý KTX",
)
def get_daily_summary(
    current_user: TaiKhoan = Depends(RoleChecker(["QuanLy", "Admin"])),
    db: Session = Depends(get_db)
):
    """
    Tự động đọc toàn bộ các phản ánh được tạo trong ngày hôm nay trực tiếp từ MySQL và sinh tóm tắt thông minh.
    - Nếu có phản ánh mới: Tóm tắt số lượng, nhóm lỗi chính, sự cố khẩn cấp.
    - Nếu chưa có phản ánh: Thông báo chưa ghi nhận phản ánh cần ưu tiên.
    """
    today_date = datetime.date.today()
    records = (
        db.query(PhanAnh)
        .options(joinedload(PhanAnh.sinh_vien).joinedload(SinhVien.nguoi_dung))
        .filter(PhanAnh.ngay_gui == today_date)
        .order_by(PhanAnh.ngay_tao.desc(), PhanAnh.ma_phan_anh.desc())
        .all()
    )

    today_incidents = [serialize_incident(item) for item in records]
    summary_text = generate_daily_incident_summary(today_incidents)

    return {
        "status": "success",
        "count": len(today_incidents),
        "summary": summary_text,
        "data": {
            "count": len(today_incidents),
            "summary": summary_text,
            "incidents": today_incidents,
        },
    }


@router.get(
    "",
    summary="Lấy danh sách phản ánh (Dành cho Ban Quản lý KTX và Sinh viên)",
)
def get_incidents(
    msv: Optional[str] = Query(None, description="Lọc theo mã sinh viên"),
    trang_thai: Optional[str] = Query(None, description="Lọc theo trạng thái"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Trả về danh sách phản ánh truy vấn trực tiếp từ cơ sở dữ liệu MySQL.
    Chống IDOR: Nếu là sinh viên, chỉ được xem danh sách phản ánh của chính mình.
    """
    query = db.query(PhanAnh).options(
        joinedload(PhanAnh.sinh_vien).joinedload(SinhVien.nguoi_dung)
    )

    if current_user.vai_tro == VaiTro.SINH_VIEN:
        student = get_current_student(current_user=current_user, db=db)
        query = query.filter(PhanAnh.msv.ilike(student.msv))
    else:
        if msv and msv.strip():
            clean_msv = msv.strip()
            query = query.filter(PhanAnh.msv.ilike(f"%{clean_msv}%"))

    if trang_thai and trang_thai != "ALL":
        query = query.filter(PhanAnh.trang_thai == trang_thai)

    records = query.order_by(PhanAnh.ngay_tao.desc(), PhanAnh.ngay_gui.desc()).all()
    items = [serialize_incident(rec) for rec in records]

    return {
        "status": "success",
        "total": len(items),
        "data": items,
    }


@router.get(
    "/{incident_id}",
    summary="Xem chi tiết một phản ánh",
)
def get_incident_detail(incident_id: str, db: Session = Depends(get_db)):
    """Xem chi tiết một phản ánh từ MySQL."""
    clean_id = incident_id.strip()
    item = (
        db.query(PhanAnh)
        .options(joinedload(PhanAnh.sinh_vien).joinedload(SinhVien.nguoi_dung))
        .filter(PhanAnh.ma_phan_anh.ilike(clean_id))
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy phản ánh yêu cầu.",
        )
    return {
        "status": "success",
        "data": serialize_incident(item),
    }


@router.patch(
    "/{incident_id}/status",
    dependencies=[Depends(RoleChecker(["QuanLy", "Admin"]))],
    summary="Ban Quản lý KTX cập nhật trạng thái phản ánh",
)
def update_status(
    incident_id: str,
    req: UpdateIncidentStatusRequest,
    current_user: TaiKhoan = Depends(RoleChecker(["QuanLy", "Admin"])),
    db: Session = Depends(get_db),
):
    """
    Ban Quản lý cập nhật tiến trình xử lý (DANG_XU_LY, DA_XU_LY, TU_CHOI) trực tiếp vào MySQL với transaction.
    """
    clean_id = incident_id.strip()
    db_pa = (
        db.query(PhanAnh)
        .options(joinedload(PhanAnh.sinh_vien).joinedload(SinhVien.nguoi_dung))
        .filter(PhanAnh.ma_phan_anh.ilike(clean_id))
        .first()
    )
    if not db_pa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy phản ánh để cập nhật.",
        )

    try:
        db_pa.trang_thai = req.trang_thai
        if req.ghi_chu_xu_ly is not None:
            db_pa.ghi_chu_xu_ly = req.ghi_chu_xu_ly
        db.commit()
        db.refresh(db_pa)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi cơ sở dữ liệu khi cập nhật trạng thái phản ánh: {str(e)}",
        )

    return {
        "status": "success",
        "message": "Cập nhật trạng thái phản ánh thành công!",
        "data": serialize_incident(db_pa),
    }

