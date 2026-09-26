from datetime import datetime, date
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import or_, and_, func
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_password_hash
from app.models.contract import HopDong, Phi
from app.models.dorm import Giuong, Phong, Tang, ToaNha
from app.models.incident import PhanAnh, ViPham
from app.models.user import NguoiDung, SinhVien, TaiKhoan, VaiTro
from app.schemas.student import (
    SinhVienCreate,
    SinhVienResponse,
    SinhVienUpdate,
    ThongTinPhongHienTai,
    PhanAnhBrief,
    ViPhamBrief,
    StudentStatsResponse,
)


def _build_student_response(student: SinhVien, db: Session) -> SinhVienResponse:
    """Hàm phụ trợ xây dựng SinhVienResponse kèm thông tin phòng hiện tại, phản ánh và vi phạm."""
    current_room_info: Optional[ThongTinPhongHienTai] = None
    trang_thai_o = "CHUA_XEP"

    # Tìm hợp đồng ACTIVE gần nhất
    active_contract = (
        db.query(HopDong)
        .options(
            joinedload(HopDong.giuong)
            .joinedload(Giuong.phong)
            .joinedload(Phong.tang)
            .joinedload(Tang.toa_nha)
        )
        .filter(HopDong.msv == student.msv, HopDong.trang_thai == "ACTIVE")
        .first()
    )

    if active_contract and active_contract.giuong and active_contract.giuong.phong:
        bed = active_contract.giuong
        room = bed.phong
        floor = room.tang
        building = floor.toa_nha if floor else None

        bed_num = "1"
        if bed.ma_giuong and "_G" in bed.ma_giuong:
            try:
                bed_num = str(int(bed.ma_giuong.split("_G")[1]))
            except ValueError:
                bed_num = bed.ma_giuong.split("_G")[1]

        current_room_info = ThongTinPhongHienTai(
            ma_hop_dong=active_contract.ma_hop_dong,
            ma_giuong=bed.ma_giuong,
            ma_phong=room.ma_phong,
            so_phong=room.so_phong,
            ten_toa=building.ten_toa if building else None,
            so_tang=floor.so_tang if floor else None,
            ten_giuong=f"Giường {bed_num}",
            ngay_bat_dau=str(active_contract.ngay_bat_dau) if active_contract.ngay_bat_dau else None,
            ngay_ket_thuc=str(active_contract.ngay_ket_thuc) if active_contract.ngay_ket_thuc else None,
        )
        trang_thai_o = "DANG_O"
    else:
        # Kiểm tra hợp đồng đã chấm dứt (Đã trả phòng)
        terminated_contract = (
            db.query(HopDong)
            .options(
                joinedload(HopDong.giuong)
                .joinedload(Giuong.phong)
                .joinedload(Phong.tang)
                .joinedload(Tang.toa_nha)
            )
            .filter(HopDong.msv == student.msv, HopDong.trang_thai == "TERMINATED")
            .order_by(HopDong.ngay_ket_thuc.desc())
            .first()
        )
        if terminated_contract and terminated_contract.giuong and terminated_contract.giuong.phong:
            bed = terminated_contract.giuong
            room = bed.phong
            floor = room.tang
            building = floor.toa_nha if floor else None

            bed_num = "1"
            if bed.ma_giuong and "_G" in bed.ma_giuong:
                try:
                    bed_num = str(int(bed.ma_giuong.split("_G")[1]))
                except ValueError:
                    bed_num = bed.ma_giuong.split("_G")[1]

            current_room_info = ThongTinPhongHienTai(
                ma_hop_dong=terminated_contract.ma_hop_dong,
                ma_giuong=bed.ma_giuong,
                ma_phong=room.ma_phong,
                so_phong=room.so_phong,
                ten_toa=building.ten_toa if building else None,
                so_tang=floor.so_tang if floor else None,
                ten_giuong=f"Giường {bed_num}",
                ngay_bat_dau=str(terminated_contract.ngay_bat_dau) if terminated_contract.ngay_bat_dau else None,
                ngay_ket_thuc=str(terminated_contract.ngay_ket_thuc) if terminated_contract.ngay_ket_thuc else None,
            )
            trang_thai_o = "DA_TRA_PHONG"

    user_info = student.nguoi_dung

    # Lấy danh sách phản ánh của sinh viên
    phan_anh_records = (
        db.query(PhanAnh)
        .filter(PhanAnh.msv == student.msv)
        .order_by(PhanAnh.ngay_gui.desc())
        .all()
    )
    list_phan_anh = [
        PhanAnhBrief(
            ma_phan_anh=pa.ma_phan_anh,
            noi_dung=pa.noi_dung,
            trang_thai=pa.trang_thai,
            ngay_gui=str(pa.ngay_gui) if pa.ngay_gui else None,
        )
        for pa in phan_anh_records
    ]

    # Lấy danh sách vi phạm của sinh viên
    vi_pham_records = (
        db.query(ViPham)
        .filter(ViPham.msv == student.msv)
        .order_by(ViPham.ngay_vi_pham.desc())
        .all()
    )
    list_vi_pham = [
        ViPhamBrief(
            ma_vi_pham=vp.ma_vi_pham,
            mo_ta=vp.mo_ta,
            hinh_thuc_xu_ly=vp.hinh_thuc_xu_ly,
            ngay_vi_pham=str(vp.ngay_vi_pham) if vp.ngay_vi_pham else None,
        )
        for vp in vi_pham_records
    ]

    return SinhVienResponse(
        msv=student.msv,
        ho_ten=user_info.ho_ten if user_info else "",
        email=user_info.email if user_info else None,
        so_dien_thoai=user_info.so_dien_thoai if user_info else None,
        lop=student.lop or "CNTTK24",
        gioi_tinh=student.gioi_tinh or "Nam",
        khoa=student.khoa,
        que_quan=student.que_quan,
        ngay_sinh=student.ngay_sinh,
        cccd=student.cccd,
        dia_chi=student.dia_chi,
        nguoi_giam_ho=student.nguoi_giam_ho,
        moi_quan_he=student.moi_quan_he,
        sdt_nguoi_giam_ho=student.sdt_nguoi_giam_ho,
        anh_dai_dien=student.anh_dai_dien,
        anh_hop_dong=student.anh_hop_dong,
        trang_thai_o=trang_thai_o,
        thong_tin_phong_hien_tai=current_room_info,
        phan_anhs=list_phan_anh,
        vi_phams=list_vi_pham,
    )


def create_student(db: Session, student_in: SinhVienCreate) -> SinhVienResponse:
    """
    Tạo mới sinh viên, liên kết đồng thời tài khoản (TaiKhoan với vai trò SinhVien) và người dùng (NguoiDung).
    Nếu có chọn phòng và giường lưu trú, tự động tạo hợp đồng và đánh dấu giường đã có người ở.
    """
    clean_msv = student_in.msv.strip().upper()

    # 1. Kiểm tra MSV đã tồn tại chưa
    if db.query(SinhVien).filter(SinhVien.msv == clean_msv).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Mã số sinh viên '{clean_msv}' đã tồn tại trong hệ thống.",
        )

    # 2. Kiểm tra tên đăng nhập (dùng chính MSV)
    if db.query(TaiKhoan).filter(TaiKhoan.ten_dang_nhap == clean_msv).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tên đăng nhập '{clean_msv}' đã được sử dụng.",
        )

    # 3. Kiểm tra email nếu có
    if student_in.email:
        clean_email = student_in.email.strip()
        if db.query(NguoiDung).filter(NguoiDung.email == clean_email).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{clean_email}' đã được đăng ký trong hệ thống.",
            )
    else:
        clean_email = f"{clean_msv.lower()}@ictu.edu.vn"

    # 4. Mật khẩu khởi tạo: Lấy theo dữ liệu gửi lên hoặc mặc định là MSV
    raw_password = student_in.mat_khau_khoi_tao or clean_msv
    hashed_password = get_password_hash(raw_password)

    # 5. Tạo TaiKhoan
    account = TaiKhoan(
        ten_dang_nhap=clean_msv,
        mat_khau=hashed_password,
        vai_tro=VaiTro.SINH_VIEN,
    )
    db.add(account)
    db.flush()

    # 6. Tạo NguoiDung
    user = NguoiDung(
        ma_tai_khoan=account.ma_tai_khoan,
        ho_ten=student_in.ho_ten.strip(),
        email=clean_email,
        so_dien_thoai=student_in.so_dien_thoai.strip() if student_in.so_dien_thoai else None,
    )
    db.add(user)
    db.flush()

    # 7. Tạo SinhVien
    student = SinhVien(
        msv=clean_msv,
        ma_nguoi_dung=user.ma_nguoi_dung,
        lop=student_in.lop or "CNTTK24",
        gioi_tinh=student_in.gioi_tinh or "Nam",
        khoa=student_in.khoa,
        que_quan=student_in.que_quan,
        ngay_sinh=student_in.ngay_sinh,
        cccd=student_in.cccd,
        dia_chi=student_in.dia_chi,
        nguoi_giam_ho=student_in.nguoi_giam_ho,
        moi_quan_he=student_in.moi_quan_he,
        sdt_nguoi_giam_ho=student_in.sdt_nguoi_giam_ho,
        anh_dai_dien=student_in.anh_dai_dien,
        anh_hop_dong=student_in.anh_hop_dong,
    )
    db.add(student)
    db.flush()

    # 8. Nếu có thông tin chỉ định giường và phòng lưu trú
    if student_in.ma_giuong:
        target_bed = db.query(Giuong).filter(Giuong.ma_giuong == student_in.ma_giuong).first()
        if target_bed:
            target_bed.trang_thai = "DA_O"

            # Parse ngày
            d_start = date.today()
            if student_in.ngay_bat_dau:
                try:
                    if "/" in student_in.ngay_bat_dau:
                        d_start = datetime.strptime(student_in.ngay_bat_dau, "%d/%m/%Y").date()
                    else:
                        d_start = datetime.strptime(student_in.ngay_bat_dau, "%Y-%m-%d").date()
                except ValueError:
                    d_start = date.today()

            d_end = date(d_start.year + 1, 6, 30)
            if student_in.ngay_ket_thuc:
                try:
                    if "/" in student_in.ngay_ket_thuc:
                        d_end = datetime.strptime(student_in.ngay_ket_thuc, "%d/%m/%Y").date()
                    else:
                        d_end = datetime.strptime(student_in.ngay_ket_thuc, "%Y-%m-%d").date()
                except ValueError:
                    d_end = date(d_start.year + 1, 6, 30)

            # Mã hợp đồng
            contract_code = student_in.ma_hop_dong
            if not contract_code:
                year_yy = d_start.strftime("%y")
                clean_bed = student_in.ma_giuong.replace("_", "-")
                contract_code = f"HD{year_yy}-{clean_msv}-{clean_bed}"

            new_contract = HopDong(
                ma_hop_dong=contract_code,
                msv=clean_msv,
                ma_giuong=target_bed.ma_giuong,
                ngay_bat_dau=d_start,
                ngay_ket_thuc=d_end,
                trang_thai="ACTIVE",
            )
            db.add(new_contract)

            # Nếu có khoản tiền thuê cả kỳ
            if student_in.tong_tien_thue and student_in.tong_tien_thue > 0:
                phi = Phi(
                    ma_phi=f"PHI_{contract_code}",
                    ma_hop_dong=contract_code,
                    loai_phi="TIEN_PHONG",
                    so_tien=float(student_in.tong_tien_thue),
                    han_nop=d_start,
                )
                db.add(phi)

    db.commit()
    db.refresh(student)

    return _build_student_response(student, db)


def get_students(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    search_keyword: Optional[str] = None,
    filter_status: Optional[str] = "all",  # 'all', 'dang_o', 'chua_xep'
    ma_toa: Optional[str] = None,
    so_phong: Optional[str] = None,
) -> Tuple[List[SinhVienResponse], int]:
    """
    Lấy danh sách sinh viên có tìm kiếm theo MSV, họ tên, lớp, hỗ trợ phân trang và lọc theo trạng thái ở, tòa, phòng.
    """
    query = (
        db.query(SinhVien)
        .join(NguoiDung, SinhVien.ma_nguoi_dung == NguoiDung.ma_nguoi_dung)
        .options(joinedload(SinhVien.nguoi_dung))
    )

    if search_keyword:
        kw = f"%{search_keyword.strip()}%"
        query = query.filter(
            or_(
                SinhVien.msv.ilike(kw),
                SinhVien.lop.ilike(kw),
                SinhVien.khoa.ilike(kw),
                NguoiDung.ho_ten.ilike(kw),
                NguoiDung.email.ilike(kw),
                NguoiDung.so_dien_thoai.ilike(kw),
            )
        )

    # Subquery để tìm danh sách MSV đang có hợp đồng ACTIVE
    active_msvs_query = db.query(HopDong.msv).filter(HopDong.trang_thai == "ACTIVE")
    # Subquery để tìm danh sách MSV có hợp đồng TERMINATED nhưng không có ACTIVE
    terminated_msvs_query = (
        db.query(HopDong.msv)
        .filter(HopDong.trang_thai == "TERMINATED")
        .filter(~HopDong.msv.in_(active_msvs_query))
    )

    if filter_status == "dang_o":
        query = query.filter(SinhVien.msv.in_(active_msvs_query))
    elif filter_status == "da_tra_phong":
        query = query.filter(SinhVien.msv.in_(terminated_msvs_query))
    elif filter_status == "chua_xep":
        all_contract_msvs = db.query(HopDong.msv)
        query = query.filter(~SinhVien.msv.in_(all_contract_msvs))

    # Lọc theo tòa / phòng nếu được chỉ định
    if ma_toa or so_phong:
        room_filter_query = (
            db.query(HopDong.msv)
            .join(Giuong, HopDong.ma_giuong == Giuong.ma_giuong)
            .join(Phong, Giuong.ma_phong == Phong.ma_phong)
            .join(Tang, Phong.ma_tang == Tang.ma_tang)
            .filter(HopDong.trang_thai == "ACTIVE")
        )
        if ma_toa and ma_toa != "all":
            clean_toa = ma_toa.replace("Tòa ", "").replace("Tòa", "").strip()
            room_filter_query = room_filter_query.filter(
                or_(Tang.ma_toa == clean_toa, Tang.ma_toa == ma_toa)
            )
        if so_phong and so_phong != "all":
            clean_room = so_phong.replace("Phòng ", "").replace("Phòng", "").replace("P", "").strip()
            room_filter_query = room_filter_query.filter(
                or_(Phong.so_phong == clean_room, Phong.so_phong == so_phong)
            )
        query = query.filter(SinhVien.msv.in_(room_filter_query))

    total_count = query.count()
    students = query.offset(skip).limit(limit).all()

    return [_build_student_response(sv, db) for sv in students], total_count


def get_student_stats(db: Session) -> StudentStatsResponse:
    """Thống kê tổng số lượng sinh viên: Tất cả, Đang ở, Đã trả phòng."""
    total = db.query(SinhVien).count()
    active_msvs_count = (
        db.query(func.count(func.distinct(HopDong.msv)))
        .filter(HopDong.trang_thai == "ACTIVE")
        .scalar()
        or 0
    )
    active_msvs_subquery = db.query(HopDong.msv).filter(HopDong.trang_thai == "ACTIVE")
    da_tra_phong_count = (
        db.query(func.count(func.distinct(HopDong.msv)))
        .filter(HopDong.trang_thai == "TERMINATED")
        .filter(~HopDong.msv.in_(active_msvs_subquery))
        .scalar()
        or 0
    )
    chua_xep = max(0, total - active_msvs_count - da_tra_phong_count)
    return StudentStatsResponse(
        total=total,
        dang_o=active_msvs_count,
        da_tra_phong=da_tra_phong_count,
        chua_xep=chua_xep,
    )


def get_student_by_msv(db: Session, msv: str) -> SinhVienResponse:
    """Lấy chi tiết một sinh viên theo MSV."""
    clean_msv = msv.strip()
    student = (
        db.query(SinhVien)
        .options(joinedload(SinhVien.nguoi_dung))
        .filter(or_(SinhVien.msv == clean_msv, SinhVien.msv.like(f"%{clean_msv}%")))
        .first()
    )
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy sinh viên có MSV '{msv}'.",
        )
    return _build_student_response(student, db)


def update_student(
    db: Session,
    msv: str,
    update_data: SinhVienUpdate,
) -> SinhVienResponse:
    """Cập nhật thông tin sinh viên và người dùng liên quan."""
    clean_msv = msv.strip()
    student = (
        db.query(SinhVien)
        .options(joinedload(SinhVien.nguoi_dung))
        .filter(or_(SinhVien.msv == clean_msv, SinhVien.msv.like(f"%{clean_msv}%")))
        .first()
    )
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy sinh viên có MSV '{msv}'.",
        )

    # Cập nhật thông tin NguoiDung
    user = student.nguoi_dung
    if user:
        if update_data.ho_ten is not None:
            user.ho_ten = update_data.ho_ten.strip()
        if update_data.so_dien_thoai is not None:
            user.so_dien_thoai = update_data.so_dien_thoai.strip()
        if update_data.email is not None:
            clean_email = update_data.email.strip()
            existing_email = (
                db.query(NguoiDung)
                .filter(
                    NguoiDung.email == clean_email,
                    NguoiDung.ma_nguoi_dung != user.ma_nguoi_dung,
                )
                .first()
            )
            if existing_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Email '{clean_email}' đã được sử dụng bởi người dùng khác.",
                )
            user.email = clean_email

    # Cập nhật thông tin SinhVien
    if update_data.lop is not None:
        student.lop = update_data.lop
    if update_data.gioi_tinh is not None:
        student.gioi_tinh = update_data.gioi_tinh
    if update_data.khoa is not None:
        student.khoa = update_data.khoa
    if update_data.que_quan is not None:
        student.que_quan = update_data.que_quan
    if update_data.ngay_sinh is not None:
        student.ngay_sinh = update_data.ngay_sinh
    if update_data.cccd is not None:
        student.cccd = update_data.cccd
    if update_data.dia_chi is not None:
        student.dia_chi = update_data.dia_chi
    if update_data.nguoi_giam_ho is not None:
        student.nguoi_giam_ho = update_data.nguoi_giam_ho
    if update_data.moi_quan_he is not None:
        student.moi_quan_he = update_data.moi_quan_he
    if update_data.sdt_nguoi_giam_ho is not None:
        student.sdt_nguoi_giam_ho = update_data.sdt_nguoi_giam_ho
    if update_data.anh_dai_dien is not None:
        student.anh_dai_dien = update_data.anh_dai_dien
    if update_data.anh_hop_dong is not None:
        student.anh_hop_dong = update_data.anh_hop_dong

    db.commit()
    db.refresh(student)
    return _build_student_response(student, db)


def delete_student(db: Session, msv: str) -> None:
    """Xóa hồ sơ sinh viên nếu không có hợp đồng ACTIVE."""
    clean_msv = msv.strip()
    student = (
        db.query(SinhVien)
        .options(joinedload(SinhVien.nguoi_dung))
        .filter(SinhVien.msv == clean_msv)
        .first()
    )
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy sinh viên có MSV '{msv}'.",
        )

    active_contract = (
        db.query(HopDong)
        .filter(HopDong.msv == clean_msv, HopDong.trang_thai == "ACTIVE")
        .first()
    )
    if active_contract:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể xóa sinh viên '{msv}' vì đang có hợp đồng lưu trú ACTIVE.",
        )

    user = student.nguoi_dung
    account = user.tai_khoan if user else None

    if account:
        db.delete(account)
    elif user:
        db.delete(user)
    else:
        db.delete(student)

    db.commit()
