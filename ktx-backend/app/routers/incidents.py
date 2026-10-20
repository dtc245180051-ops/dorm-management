import datetime
import json
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


@router.post("/violations", status_code=status.HTTP_201_CREATED)
def create_violation(req: CreateViolationRequest, db: Session = Depends(get_db)):
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


@router.put("/violations/{ma_vi_pham}")
def update_violation(ma_vi_pham: str, req: UpdateViolationStatusRequest, db: Session = Depends(get_db)):
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
    original_msv = (req.msv or "dtc245180137").strip()
    target_msv = original_msv
    try:
        student_check = db.execute(
            text("SELECT msv FROM sinh_vien WHERE UPPER(msv) = UPPER(:msv)"),
            {"msv": target_msv},
        ).fetchone()

        if student_check:
            db_msv = student_check[0]
        else:
            first_sv = db.execute(text("SELECT msv FROM sinh_vien LIMIT 1")).fetchone()
            db_msv = first_sv[0] if first_sv else target_msv

        new_db_incident = PhanAnh(
            ma_phan_anh=incident_code,
            msv=db_msv,
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

    # 3. Lưu vào incident_store trung tâm phục vụ Ban Quản lý KTX và Sinh viên
    payload = {
        "id": incident_code,
        "ma_phan_anh": incident_code,
        "msv": original_msv,
        "ho_ten": req.ho_ten or "Sinh viên",
        "phong": req.phong or "",
        "loai_phan_anh": phan_loai,
        "phan_loai": phan_loai,
        "tieu_de": tieu_de,
        "mo_ta": clean_mo_ta,
        "hinh_anh": req.hinh_anh,
        "muc_do_uu_tien": muc_do_uu_tien,
        "trang_thai": "CHO_XU_LY",
        "trang_thai_label": "Chờ xử lý",
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
    if msv:
        items = incident_store.get_incidents_by_student(msv)
        # Đồng bộ thêm từ MySQL nếu có
        try:
            db_records = db.query(PhanAnh).filter(PhanAnh.msv.ilike(f"%{msv.strip()}%")).all()
            existing_ids = {it.get("id") or it.get("ma_phan_anh") for it in items}
            for rec in db_records:
                rec_id = rec.ma_phan_anh
                if rec_id not in existing_ids:
                    mapped = {
                        "id": rec_id,
                        "ma_phan_anh": rec_id,
                        "msv": rec.msv,
                        "ho_ten": rec.sinh_vien.nguoi_dung.ho_ten if (rec.sinh_vien and rec.sinh_vien.nguoi_dung) else rec.msv,
                        "phong": rec.phong or "",
                        "loai_phan_anh": rec.phan_loai or "Cơ sở vật chất",
                        "phan_loai": rec.phan_loai or "Cơ sở vật chất",
                        "tieu_de": rec.tieu_de or rec.tom_tat or (rec.noi_dung[:40] if rec.noi_dung else "Sự cố"),
                        "mo_ta": rec.mo_ta or rec.noi_dung or "",
                        "muc_do_uu_tien": rec.muc_do_uu_tien or "Thường",
                        "trang_thai": rec.trang_thai or "CHO_XU_LY",
                        "trang_thai_label": "Đang xử lý" if rec.trang_thai == "DANG_XU_LY" else ("Đã xử lý" if rec.trang_thai in ("DA_XU_LY", "HOAN_THANH") else "Chờ xử lý"),
                        "ngay_gui": rec.ngay_gui.isoformat() if rec.ngay_gui else None,
                        "ghi_chu_xu_ly": rec.ghi_chu_xu_ly or "",
                    }
                    items.append(mapped)
                    incident_store.add_incident(mapped)
        except Exception as e:
            print(f"Warning querying DB for student incidents: {e}")
    else:
        items = incident_store.get_all_incidents()
        # Đồng bộ từ MySQL nếu in-memory store đang trống
        if len(items) == 0:
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
                        "ghi_chu_xu_ly": rec.ghi_chu_xu_ly or "",
                    })
                items = incident_store.get_all_incidents()
            except Exception as e:
                print(f"Warning syncing incidents from DB: {e}")

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

    # Cập nhật trong CSDL nếu có
    db_pa = None
    try:
        db_pa = db.query(PhanAnh).filter(PhanAnh.ma_phan_anh == incident_id).first()
        if db_pa:
            db_pa.trang_thai = req.trang_thai
            if req.ghi_chu_xu_ly is not None:
                db_pa.ghi_chu_xu_ly = req.ghi_chu_xu_ly
            db.commit()
            db.refresh(db_pa)
    except Exception as e:
        db.rollback()
        print(f"Warning: Failed to update DB phan_anh: {e}")

    if not updated and db_pa:
        mapped = {
            "id": db_pa.ma_phan_anh,
            "ma_phan_anh": db_pa.ma_phan_anh,
            "msv": db_pa.msv,
            "ho_ten": db_pa.sinh_vien.nguoi_dung.ho_ten if (db_pa.sinh_vien and db_pa.sinh_vien.nguoi_dung) else db_pa.msv,
            "phong": db_pa.phong or "",
            "loai_phan_anh": db_pa.phan_loai or "Cơ sở vật chất",
            "phan_loai": db_pa.phan_loai or "Cơ sở vật chất",
            "tieu_de": db_pa.tieu_de or db_pa.tom_tat or (db_pa.noi_dung[:40] if db_pa.noi_dung else "Sự cố"),
            "mo_ta": db_pa.mo_ta or db_pa.noi_dung or "",
            "muc_do_uu_tien": db_pa.muc_do_uu_tien or "Thường",
            "trang_thai": db_pa.trang_thai,
            "trang_thai_label": "Đang xử lý" if db_pa.trang_thai == "DANG_XU_LY" else ("Đã xử lý" if db_pa.trang_thai in ("DA_XU_LY", "HOAN_THANH") else "Chờ xử lý"),
            "ngay_gui": db_pa.ngay_gui.isoformat() if db_pa.ngay_gui else None,
            "ghi_chu_xu_ly": db_pa.ghi_chu_xu_ly or "",
        }
        incident_store.add_incident(mapped)
        updated = mapped

    if not updated and not db_pa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy phản ánh để cập nhật.",
        )

    return {
        "status": "success",
        "message": "Cập nhật trạng thái phản ánh thành công!",
        "data": updated,
    }
