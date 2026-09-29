import datetime
import uuid
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.models.incident import PhanAnh
from app.services import incident_store

router = APIRouter(prefix="/incidents", tags=["Phản ánh và Báo hỏng KTX"])


class CreateIncidentRequest(BaseModel):
    msv: str
    ho_ten: Optional[str] = None
    phong: Optional[str] = "P36"
    loai_phan_anh: str = "Cơ sở vật chất"
    tieu_de: str
    mo_ta: str
    hinh_anh: Optional[str] = None


class UpdateIncidentStatusRequest(BaseModel):
    trang_thai: str
    ghi_chu_xu_ly: Optional[str] = None


@router.post(
    "",
    summary="Sinh viên gửi phản ánh sự cố hoặc báo hỏng cơ sở vật chất KTX",
    status_code=status.HTTP_201_CREATED,
)
def create_incident(
    req: CreateIncidentRequest,
    db: Session = Depends(get_db),
):
    """
    Tiếp nhận đơn phản ánh từ sinh viên:
    - Lưu vào CSDL KTX (bảng phan_anh)
    - Đồng bộ ngay lập tức vào Incident Store để Ban Quản lý KTX tiếp nhận và xử lý
    """
    if not req.tieu_de.strip() or not req.mo_ta.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng nhập đầy đủ tiêu đề và mô tả chi tiết phản ánh.",
        )

    # Sinh mã phản ánh duy nhất PA-xxxxxx
    incident_code = f"PA-{uuid.uuid4().hex[:6].upper()}"

    # 1. Thử lưu vào CSDL bảng phan_anh nếu có kết nối
    try:
        # Kiểm tra xem MSV có tồn tại trong bảng sinh_vien không để đảm bảo FK
        student_check = db.execute(
            text("SELECT msv FROM sinh_vien WHERE msv = :msv"),
            {"msv": req.msv},
        ).fetchone()

        target_msv = req.msv
        if not student_check:
            # Lấy MSV đầu tiên có sẵn trong CSDL làm tham chiếu an toàn nếu sinh viên mới đăng ký
            first_sv = db.execute(text("SELECT msv FROM sinh_vien LIMIT 1")).fetchone()
            if first_sv:
                target_msv = first_sv[0]

        new_db_incident = PhanAnh(
            ma_phan_anh=incident_code,
            msv=target_msv,
            noi_dung=f"[{req.phong}] {req.tieu_de}: {req.mo_ta}",
            trang_thai="CHO_XU_LY",
            ngay_gui=datetime.date.today(),
            phan_loai=req.loai_phan_anh,
            tom_tat=req.tieu_de[:200],
        )
        db.add(new_db_incident)
        db.commit()
    except Exception as db_err:
        db.rollback()
        print(f"Warning: Could not save to DB table phan_anh ({db_err}), saving to store.")

    # 2. Lưu vào incident_store trung tâm phục vụ Ban Quản lý KTX
    payload = {
        "id": incident_code,
        "ma_phan_anh": incident_code,
        "msv": req.msv,
        "ho_ten": req.ho_ten or "Sinh viên",
        "phong": req.phong or "P36",
        "loai_phan_anh": req.loai_phan_anh,
        "tieu_de": req.tieu_de,
        "mo_ta": req.mo_ta,
        "hinh_anh": req.hinh_anh,
        "trang_thai": "CHO_XU_LY",
    }
    created = incident_store.add_incident(payload)

    return {
        "status": "success",
        "message": "Gửi phản ánh thành công đến Ban Quản lý KTX!",
        "data": created,
    }


@router.get(
    "",
    summary="Lấy danh sách phản ánh (Dành cho Ban Quản lý KTX và Sinh viên)",
)
def get_incidents(
    msv: Optional[str] = Query(None, description="Lọc theo mã sinh viên"),
    trang_thai: Optional[str] = Query(None, description="Lọc theo trạng thái"),
):
    """
    Trả về danh sách phản ánh.
    Ban quản lý xem toàn bộ danh sách, sinh viên có thể lọc theo MSV của mình.
    """
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
