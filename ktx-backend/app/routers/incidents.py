import datetime
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.models.incident import PhanAnh, ViPham
from app.models.user import SinhVien
from app.services import incident_store
from app.services.incident_ai import analyze_incident_with_ai, generate_daily_incident_summary

router = APIRouter(prefix="/incidents", tags=["Phản ánh và Báo hỏng KTX"])


@router.get("/violations")
def list_violations(db: Session = Depends(get_db)):
    records = db.query(ViPham).order_by(ViPham.ngay_vi_pham.desc()).all()
    return [
        {
            "id": item.ma_vi_pham,
            "ma_bb": item.ma_vi_pham,
            "msv": item.msv,
            "ho_ten": item.sinh_vien.nguoi_dung.ho_ten if item.sinh_vien and item.sinh_vien.nguoi_dung else item.msv,
            "phong": "",
            "hanh_vi": item.mo_ta,
            "hinh_thuc_xu_ly": item.hinh_thuc_xu_ly,
            "ngay_lap": item.ngay_vi_pham.isoformat(),
            "trang_thai": "DA_XU_LY" if item.hinh_thuc_xu_ly else "CHO_XU_LY",
        }
        for item in records
    ]


class CreateViolationRequest(BaseModel):
    msv: str
    mo_ta: str
    hinh_thuc_xu_ly: str = "Đang xem xét"


@router.post("/violations", status_code=status.HTTP_201_CREATED)
def create_violation(req: CreateViolationRequest, db: Session = Depends(get_db)):
    if not db.query(SinhVien).filter(SinhVien.msv == req.msv).first():
        raise HTTPException(status_code=404, detail="Không tìm thấy sinh viên trong cơ sở dữ liệu")
    item = ViPham(
        ma_vi_pham=f"VP-{uuid.uuid4().hex[:12].upper()}",
        msv=req.msv,
        mo_ta=req.mo_ta,
        ngay_vi_pham=datetime.date.today(),
        hinh_thuc_xu_ly=req.hinh_thuc_xu_ly,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.ma_vi_pham, "ma_bb": item.ma_vi_pham, "msv": item.msv, "hanh_vi": item.mo_ta}


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


@router.post(
    "",
    summary="Sinh viên gửi phản ánh sự cố - Tích hợp AI tự động phân loại, tạo tiêu đề và xác định ưu tiên",
    status_code=status.HTTP_201_CREATED,
)
def create_incident(
    req: CreateIncidentRequest,
    db: Session = Depends(get_db),
):
    """
    Tiếp nhận phản ánh từ sinh viên:
    - AI tự động trích xuất: tieu_de (< 10 từ), phan_loai (1 trong 5 nhóm), muc_do_uu_tien ('Thường' / 'Khẩn cấp')
    - Lưu đầy đủ các trường vào CSDL MySQL (bảng phan_anh)
    - Đồng bộ ngay lập tức vào Incident Store phục vụ Ban Quản lý KTX
    """
    clean_mo_ta = req.mo_ta.strip() if req.mo_ta else ""
    if not clean_mo_ta:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng nhập mô tả chi tiết sự cố bạn gặp phải.",
        )

    # 1. AI tự động phân tích mô tả của sinh viên
    ai_result = analyze_incident_with_ai(clean_mo_ta, req.phong)

    # Ưu tiên dữ liệu AI phân tích
    tieu_de = req.tieu_de.strip() if (req.tieu_de and req.tieu_de.strip()) else ai_result["tieu_de"]
    phan_loai = req.loai_phan_anh.strip() if (req.loai_phan_anh and req.loai_phan_anh.strip()) else ai_result["phan_loai"]
    muc_do_uu_tien = ai_result["muc_do_uu_tien"]

    # Sinh mã phản ánh duy nhất PA-xxxxxx
    incident_code = f"PA-{uuid.uuid4().hex[:6].upper()}"

    # 2. Lưu vào CSDL bảng phan_anh
    target_msv = req.msv or "dtc245180051"
    try:
        student_check = db.execute(
            text("SELECT msv FROM sinh_vien WHERE msv = :msv"),
            {"msv": target_msv},
        ).fetchone()

        if not student_check:
            first_sv = db.execute(text("SELECT msv FROM sinh_vien LIMIT 1")).fetchone()
            if first_sv:
                target_msv = first_sv[0]

        new_db_incident = PhanAnh(
            ma_phan_anh=incident_code,
            msv=target_msv,
            noi_dung=clean_mo_ta,
            trang_thai="CHO_XU_LY",
            ngay_gui=datetime.date.today(),
            phan_loai=phan_loai,
            tom_tat=tieu_de[:200],
            tieu_de=tieu_de,
            muc_do_uu_tien=muc_do_uu_tien,
            phong=req.phong or "",
            mo_ta=clean_mo_ta,
            ngay_tao=datetime.datetime.now(),
        )
        db.add(new_db_incident)
        db.commit()
    except Exception as db_err:
        db.rollback()
        print(f"Warning: Could not save to DB table phan_anh ({db_err}), saving to store.")

    # 3. Lưu vào incident_store trung tâm phục vụ Ban Quản lý KTX
    payload = {
        "id": incident_code,
        "ma_phan_anh": incident_code,
        "msv": target_msv,
        "ho_ten": req.ho_ten or "Sinh viên",
        "phong": req.phong or "",
        "loai_phan_anh": phan_loai,
        "phan_loai": phan_loai,
        "tieu_de": tieu_de,
        "mo_ta": clean_mo_ta,
        "hinh_anh": req.hinh_anh,
        "muc_do_uu_tien": muc_do_uu_tien,
        "trang_thai": "CHO_XU_LY",
        "ngay_gui": datetime.datetime.now().isoformat(),
        "ngay_tao": datetime.datetime.now().isoformat(),
    }
    created = incident_store.add_incident(payload)

    return {
        "status": "success",
        "message": "Gửi phản ánh thành công! AI đã tiếp nhận và phân tích sự cố.",
        "data": created,
    }


@router.get(
    "/daily-summary",
    summary="AI Tóm tắt sự cố trong ngày hôm nay cho Ban Quản lý KTX",
)
def get_daily_summary(db: Session = Depends(get_db)):
    """
    Tự động đọc toàn bộ các phản ánh được tạo trong ngày hôm nay và sinh tóm tắt thông minh.
    - Nếu có phản ánh mới: "Hôm nay ghi nhận X sự cố, chủ yếu về [Điện nước/Cơ sở vật chất] tại các phòng... Cần ưu tiên xử lý: [Sự cố khẩn cấp nếu có]"
    - Nếu chưa có phản ánh: "Chưa ghi nhận phản ánh cần ưu tiên xử lý trong hôm nay."
    """
    today_incidents = incident_store.get_today_incidents()
    seen_ids = {item.get("ma_phan_anh") for item in today_incidents}

    # Đọc thêm từ database MySQL để đồng bộ
    try:
        today_date = datetime.date.today()
        db_today = db.query(PhanAnh).filter(PhanAnh.ngay_gui == today_date).all()
        for item in db_today:
            if item.ma_phan_anh not in seen_ids:
                mapped = {
                    "id": item.ma_phan_anh,
                    "ma_phan_anh": item.ma_phan_anh,
                    "msv": item.msv,
                    "phong": item.phong or "",
                    "loai_phan_anh": item.phan_loai or "Cơ sở vật chất",
                    "phan_loai": item.phan_loai or "Cơ sở vật chất",
                    "tieu_de": item.tieu_de or item.tom_tat or "",
                    "mo_ta": item.mo_ta or item.noi_dung or "",
                    "muc_do_uu_tien": item.muc_do_uu_tien or "Thường",
                    "ngay_gui": item.ngay_gui.isoformat() if item.ngay_gui else today_date.isoformat(),
                    "trang_thai": item.trang_thai or "CHO_XU_LY",
                }
                today_incidents.append(mapped)
                seen_ids.add(item.ma_phan_anh)
    except Exception as e:
        print(f"Warning reading today DB incidents: {e}")

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
    db: Session = Depends(get_db),
):
    """
    Trả về danh sách phản ánh.
    Ban quản lý xem toàn bộ danh sách, sinh viên có thể lọc theo MSV của mình.
    """
    # Đồng bộ từ MySQL nếu in-memory store đang trống
    if len(incident_store.get_all_incidents()) == 0:
        try:
            db_records = db.query(PhanAnh).order_by(PhanAnh.ngay_gui.desc()).all()
            for rec in db_records:
                incident_store.add_incident({
                    "id": rec.ma_phan_anh,
                    "ma_phan_anh": rec.ma_phan_anh,
                    "msv": rec.msv,
                    "ho_ten": rec.sinh_vien.nguoi_dung.ho_ten if (rec.sinh_vien and rec.sinh_vien.nguoi_dung) else rec.msv,
                    "phong": rec.phong or "",
                    "loai_phan_anh": rec.phan_loai or "Cơ sở vật chất",
                    "phan_loai": rec.phan_loai or "Cơ sở vật chất",
                    "tieu_de": rec.tieu_de or rec.tom_tat or (rec.noi_dung[:40] if rec.noi_dung else "Sự cố"),
                    "mo_ta": rec.mo_ta or rec.noi_dung or "",
                    "muc_do_uu_tien": rec.muc_do_uu_tien or "Thường",
                    "trang_thai": rec.trang_thai or "CHO_XU_LY",
                    "ngay_gui": rec.ngay_gui.isoformat() if rec.ngay_gui else None,
                })
        except Exception as e:
            print(f"Warning syncing incidents from DB: {e}")

    if msv:
        items = incident_store.get_incidents_by_student(msv)
    else:
        items = incident_store.get_all_incidents()

    if trang_thai and trang_thai != "ALL":
        items = [item for item in items if item.get("trang_thai") == trang_thai]

    return {
        "status": "success",
        "total": len(items),
        "data": items,
    }


@router.get(
    "/{incident_id}",
    summary="Xem chi tiết một phản ánh",
)
def get_incident_detail(incident_id: str):
    item = incident_store.get_incident_by_id(incident_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy phản ánh yêu cầu.",
        )
    return {
        "status": "success",
        "data": item,
    }


@router.patch(
    "/{incident_id}/status",
    summary="Ban Quản lý KTX cập nhật trạng thái phản ánh",
)
def update_status(
    incident_id: str,
    req: UpdateIncidentStatusRequest,
    db: Session = Depends(get_db),
):
    """
    Ban Quản lý cập nhật tiến trình xử lý (DANG_XU_LY, DA_XU_LY, TU_CHOI).
    """
    updated = incident_store.update_incident_status(
        incident_id, req.trang_thai, req.ghi_chu_xu_ly
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy phản ánh để cập nhật.",
        )

    # Cập nhật trong CSDL nếu có
    try:
        db_pa = db.query(PhanAnh).filter(PhanAnh.ma_phan_anh == incident_id).first()
        if db_pa:
            db_pa.trang_thai = req.trang_thai
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"Warning: Failed to update DB phan_anh: {e}")

    return {
        "status": "success",
        "message": "Cập nhật trạng thái phản ánh thành công!",
        "data": updated,
    }
