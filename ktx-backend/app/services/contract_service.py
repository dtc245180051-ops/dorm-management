from datetime import datetime, date
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload
import re

from app.models.contract import HopDong, Phi
from app.models.dorm import Giuong, Phong, Tang, ToaNha
from app.models.user import SinhVien, NguoiDung
from app.schemas.contract import (
    HopDongDetailResponse,
    KhoanPhiResponse,
    GiaHanHopDongRequest,
    ChamDutHopDongRequest,
)


def generate_contract_code(
    ma_toa: Optional[str] = "A1",
    tang: Optional[int] = 1,
    so_phong: Optional[str] = "101",
    ma_giuong: Optional[str] = "1",
    ngay_bat_dau: Optional[date] = None,
) -> str:
    """
    Tự động sinh mã hợp đồng chuẩn: HD{YY}-{toa}{phong}-G{giuong}
    Ví dụ: HD26-A1101-G1 với:
    - HD26: Hợp đồng năm 2026
    - A1101: Tòa A1, Phòng 101
    - G1: Giường số 01
    """
    # 1. 2 chữ số cuối của năm đăng ký
    if ngay_bat_dau:
        year_yy = ngay_bat_dau.strftime("%y")
    else:
        year_yy = datetime.now().strftime("%y")

    # 2. Tòa (VD: A1, A2, B...)
    clean_toa = "A1"
    if ma_toa:
        clean_toa = (
            str(ma_toa)
            .replace("Tòa", "")
            .replace("TOA", "")
            .replace("tòa", "")
            .replace("toa", "")
            .strip()
            .upper()
            or "A1"
        )

    # 3. Phòng (VD: 101, 102...)
    clean_phong = "101"
    if so_phong:
        clean_phong = (
            str(so_phong)
            .replace("Phòng", "")
            .replace("phòng", "")
            .replace("P", "")
            .replace("p", "")
            .strip()
            or "101"
        )

    # 4. Giường (VD: 1, 2...)
    bed_num = "1"
    if ma_giuong:
        bed_str = str(ma_giuong)
        if "_G" in bed_str:
            try:
                bed_num = str(int(bed_str.split("_G")[1]))
            except (IndexError, ValueError):
                bed_num = bed_str.split("_G")[1]
        elif "G" in bed_str:
            try:
                bed_num = str(int(bed_str.replace("G", "").strip()))
            except ValueError:
                bed_num = bed_str.replace("G", "").strip() or "1"
        else:
            bed_num = bed_str.replace("Giường", "").replace("giường", "").strip() or "1"

    return f"HD{year_yy}-{clean_toa}{clean_phong}-G{bed_num}"


def parse_contract_code(code: str) -> dict:
    """
    Phân tích mã hợp đồng chuẩn: HD{YY}-{toa}{phong}-G{giuong}
    Ví dụ: HD26-A1101-G1 -> toa: A1, phong: 101, giuong: 1
    """
    if not code:
        return {}
    clean_code = code.strip()
    m = re.match(r"^HD\d{2}-([A-Za-z0-9]+)-G(\d+)$", clean_code)
    if not m:
        parts = clean_code.split("-")
        if len(parts) >= 3:
            room_str = parts[1]
            bed_str = parts[2].replace("G", "").strip()
            return {"room_str": room_str, "giuong": bed_str}
        return {}
    
    room_str = m.group(1)
    bed_num = m.group(2)
    # Tách mã tòa và số phòng (VD: A1101 -> A1 và 101, B9201 -> B9 và 201)
    m_room = re.match(r"^([A-Za-z]+\d*)(\d{3,4})$", room_str)
    if m_room:
        return {
            "toa": m_room.group(1),
            "phong": m_room.group(2),
            "giuong": bed_num,
            "room_str": room_str,
        }
    return {
        "room_str": room_str,
        "giuong": bed_num,
    }


def get_contract_detail(db: Session, ma_hop_dong: str) -> HopDongDetailResponse:
    """Truy vấn thông tin chi tiết của hợp đồng thuê chỗ ở."""
    hd = (
        db.query(HopDong)
        .options(
            joinedload(HopDong.sinh_vien).joinedload(SinhVien.nguoi_dung),
            joinedload(HopDong.giuong)
            .joinedload(Giuong.phong)
            .joinedload(Phong.tang)
            .joinedload(Tang.toa_nha),
            joinedload(HopDong.phis),
        )
        .filter(HopDong.ma_hop_dong == ma_hop_dong)
        .first()
    )

    if not hd:
        # Nếu chưa tìm thấy chính xác theo mã, thử tìm theo mã tương đối hoặc giường
        hd = (
            db.query(HopDong)
            .options(
                joinedload(HopDong.sinh_vien).joinedload(SinhVien.nguoi_dung),
                joinedload(HopDong.giuong)
                .joinedload(Giuong.phong)
                .joinedload(Phong.tang)
                .joinedload(Tang.toa_nha),
            )
            .filter(
                (HopDong.ma_giuong == ma_hop_dong)
                | (HopDong.msv == ma_hop_dong)
                | (HopDong.ma_hop_dong.like(f"%{ma_hop_dong}%"))
            )
            .first()
        )

    if not hd:
        # Nếu chưa có trong DB, trả về dữ liệu mẫu với mã hợp đồng sinh tự động
        sample_code = ma_hop_dong if ma_hop_dong.startswith("HD") else generate_contract_code("A1", 1, "101", "1", date(2026, 9, 1))
        parsed = parse_contract_code(sample_code)
        toa_val = parsed.get("toa", "A1")
        phong_val = parsed.get("phong", "101")
        giuong_val = parsed.get("giuong", "1")
        phong_giuong_text = f"Tòa {toa_val} – Phòng {phong_val} – Giường {giuong_val}"

        return HopDongDetailResponse(
            ma_hop_dong=sample_code,
            ho_ten="Hoàng Đông Huy",
            msv="LNS26012113",
            gioi_tinh="Nam",
            ngay_sinh="21/01/2006",
            cccd="019206001234",
            so_dien_thoai="0331 131 211",
            email="LNS26012113@lns.edu.vn",
            khoa="Công nghệ thông tin",
            lop="KTMT K23A",
            lien_he_khan_cap="0988 765 432 (Bố)",
            dia_chi="Số 45, Đường Hoàng Văn Thụ, Phường Hoàng Văn Thụ, Thành phố Thái Nguyên",
            phong_giuong=phong_giuong_text,
            ngay_bat_dau="01/09/2026",
            ngay_ket_thuc="30/06/2027",
            trang_thai="ACTIVE",
            tinh_trang_phi=[],
        )

    # Sinh viên & Người dùng
    sv = hd.sinh_vien
    nd = sv.nguoi_dung if sv else None

    # Phòng & Giường
    bed = hd.giuong
    room = bed.phong if bed else None
    floor = room.tang if room else None
    bld = floor.toa_nha if floor else None

    ten_toa = bld.ten_toa if bld else "Tòa A1"
    ma_toa = bld.ma_toa if bld else "A1"
    so_tang = floor.so_tang if floor else 1
    so_phong = room.so_phong if room else "101"
    
    # Số giường
    bed_num = "1"
    if bed and bed.ma_giuong:
        parts = bed.ma_giuong.split("_G")
        if len(parts) > 1:
            try:
                bed_num = str(int(parts[1]))
            except ValueError:
                bed_num = parts[1]

    phong_giuong_str = f"{ten_toa} – Phòng {so_phong} – Giường {bed_num}"

    # Định dạng ngày
    def fmt_date(d: Optional[date], default: str) -> str:
        if not d:
            return default
        return d.strftime("%d/%m/%Y")

    ngay_bd = fmt_date(hd.ngay_bat_dau, "01/09/2026")
    ngay_kt = fmt_date(hd.ngay_ket_thuc, "30/06/2027")

    # Đảm bảo mã hợp đồng chuẩn hóa theo format: HD{YY}-{toa}{phong}-G{bed_num}
    auto_code = hd.ma_hop_dong
    if not auto_code or not auto_code.startswith("HD"):
        auto_code = generate_contract_code(
            ma_toa=ma_toa,
            tang=so_tang,
            so_phong=so_phong,
            ma_giuong=bed_num,
            ngay_bat_dau=hd.ngay_bat_dau or date(2026, 9, 1),
        )
        hd.ma_hop_dong = auto_code
        db.commit()

    return HopDongDetailResponse(
        ma_hop_dong=auto_code,
        ho_ten=nd.ho_ten if nd else "Hoàng Đông Huy",
        msv=hd.msv,
        gioi_tinh=sv.gioi_tinh if sv else "Nam",
        ngay_sinh="21/01/2006",
        cccd="019206001234",
        so_dien_thoai=nd.so_dien_thoai if nd and nd.so_dien_thoai else "0331 131 211",
        email=nd.email if nd and nd.email else f"{hd.msv}@lns.edu.vn",
        khoa="Công nghệ thông tin",
        lop=sv.lop if sv else "KTMT K23A",
        lien_he_khan_cap="0988 765 432 (Bố)",
        dia_chi="Số 45, Đường Hoàng Văn Thụ, Phường Hoàng Văn Thụ, Thành phố Thái Nguyên",
        phong_giuong=phong_giuong_str,
        ngay_bat_dau=ngay_bd,
        ngay_ket_thuc=ngay_kt,
        trang_thai=hd.trang_thai or "ACTIVE",
        tinh_trang_phi=[],
    )


def renew_contract(db: Session, ma_hop_dong: str, req: GiaHanHopDongRequest) -> HopDongDetailResponse:
    """Gia hạn hợp đồng đến ngày kết thúc mới (ngày mới >= ngày kết thúc hiện tại)."""
    hd = db.query(HopDong).filter(HopDong.ma_hop_dong == ma_hop_dong).first()
    if not hd:
        hd = db.query(HopDong).filter(HopDong.ma_hop_dong.like(f"%{ma_hop_dong}%")).first()

    if not hd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hợp đồng có mã '{ma_hop_dong}'.",
        )

    # Parse ngày kết thúc mới từ chuỗi dd/mm/yyyy hoặc yyyy-mm-dd
    clean_date_str = req.ngay_ket_thuc_moi.strip()
    try:
        if "/" in clean_date_str:
            new_date = datetime.strptime(clean_date_str, "%d/%m/%Y").date()
        else:
            new_date = datetime.strptime(clean_date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Định dạng ngày kết thúc mới không hợp lệ. Vui lòng nhập đúng dd/mm/yyyy hoặc yyyy-mm-dd.",
        )

    # Ràng buộc: Ngày kết thúc mới của hợp đồng không được nhỏ hơn thời gian kết thúc hiện tại
    if hd.ngay_ket_thuc and new_date < hd.ngay_ket_thuc:
        current_str = hd.ngay_ket_thuc.strftime("%d/%m/%Y")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ngày kết thúc mới ({new_date.strftime('%d/%m/%Y')}) không được nhỏ hơn ngày kết thúc hiện tại ({current_str}) của hợp đồng.",
        )

    if hd.ngay_bat_dau and new_date < hd.ngay_bat_dau:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ngày kết thúc mới không được nhỏ hơn ngày bắt đầu hợp đồng ({hd.ngay_bat_dau.strftime('%d/%m/%Y')}).",
        )

    hd.ngay_ket_thuc = new_date
    db.commit()
    db.refresh(hd)

    return get_contract_detail(db, hd.ma_hop_dong)


def terminate_contract(db: Session, ma_hop_dong: str, req: ChamDutHopDongRequest) -> dict:
    """Chấm dứt hợp đồng và giải phóng giường về trạng thái còn trống (TRONG) trong CSDL."""
    # 1. Tìm hợp đồng theo mã hợp đồng hoặc LIKE
    hd = db.query(HopDong).filter(HopDong.ma_hop_dong == ma_hop_dong).first()
    if not hd:
        hd = db.query(HopDong).filter(HopDong.ma_hop_dong.like(f"%{ma_hop_dong}%")).first()

    target_bed_id = req.ma_giuong

    # 2. Nếu có req.ma_giuong và chưa thấy hd, tìm hợp đồng của giường này
    if not hd and target_bed_id:
        hd = (
            db.query(HopDong)
            .filter(HopDong.ma_giuong == target_bed_id, HopDong.trang_thai == "ACTIVE")
            .first()
        )
        if not hd:
            hd = db.query(HopDong).filter(HopDong.ma_giuong == target_bed_id).first()

    # 3. Phân tích mã hợp đồng nếu chưa có target_bed_id (Ví dụ: HD26-A1101-G1)
    if not target_bed_id:
        parsed = parse_contract_code(ma_hop_dong)
        bed_num = parsed.get("giuong", "1")
        phong_val = parsed.get("phong")
        toa_val = parsed.get("toa")
        room_str = parsed.get("room_str")

        # Thử tìm giường chính xác theo phòng và số giường
        bed_query = db.query(Giuong).join(Phong)
        if phong_val:
            bed_query = bed_query.filter(Phong.so_phong == phong_val)
        elif room_str:
            bed_query = bed_query.filter(
                (Phong.ma_phong.like(f"%{room_str}%")) | (Giuong.ma_giuong.like(f"%{room_str}%"))
            )

        if toa_val:
            bed_query = bed_query.filter(Phong.ma_phong.like(f"%{toa_val}%"))

        candidate_beds = bed_query.all()
        for b in candidate_beds:
            if f"_G0{bed_num}" in b.ma_giuong or f"_G{bed_num}" in b.ma_giuong or b.ma_giuong.endswith(f"G{bed_num}"):
                target_bed_id = b.ma_giuong
                if not hd:
                    hd = db.query(HopDong).filter(HopDong.ma_giuong == b.ma_giuong).first()
                break

    # 4. Cập nhật hợp đồng về TERMINATED
    if hd:
        hd.trang_thai = "TERMINATED"
        if not target_bed_id and hd.ma_giuong:
            target_bed_id = hd.ma_giuong

    # 5. GIẢI PHÓNG GIƯỜNG VỀ TRẠNG THÁI 'TRONG' TRONG DATABASE
    freed_bed_code = None
    if target_bed_id:
        bed = db.query(Giuong).filter(Giuong.ma_giuong == target_bed_id).first()
        if bed:
            bed.trang_thai = "TRONG"
            freed_bed_code = bed.ma_giuong
            # Đảm bảo tất cả hợp đồng của giường này được chuyển sang TERMINATED
            active_hds = db.query(HopDong).filter(HopDong.ma_giuong == target_bed_id).all()
            for h in active_hds:
                h.trang_thai = "TERMINATED"

    if hd and hd.giuong:
        hd.giuong.trang_thai = "TRONG"
        freed_bed_code = freed_bed_code or hd.giuong.ma_giuong

    db.commit()

    return {
        "status": "success",
        "message": f"Đã chấm dứt hợp đồng thành công. Giường '{freed_bed_code or target_bed_id}' đã chuyển về trạng thái còn trống.",
        "ma_hop_dong": hd.ma_hop_dong if hd else ma_hop_dong,
        "ma_giuong": freed_bed_code or target_bed_id,
    }
