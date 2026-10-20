from __future__ import annotations
import calendar
import csv
import datetime
import io
import re
import unicodedata
import uuid
from typing import List, Optional
import calendar
from datetime import date
from sqlalchemy import text

from fastapi import HTTPException, status
try:
    from openpyxl import Workbook, load_workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False
from sqlalchemy.orm import Session

from app.models.contract import HopDong, Phi
from app.models.debt import SoCongNo
from app.models.dorm import Giuong, Phong, Tang, ToaNha
from app.models.invoice import HoaDon, LoaiHoaDon, TrangThaiHoaDon
from app.models.user import NguoiDung, SinhVien
from app.schemas.invoice import (
    HoaDonResponse,
    PublishResultResponse,
    RoomBillingCandidate,
    RoomInvoicePublishRequest,
    UtilityBillingCandidate,
    UtilityInvoicePublishRequest,
    UtilityMeterUploadResponse,
)


def strip_accents(text: str) -> str:
    """Loại bỏ dấu tiếng Việt và chuẩn hóa chữ thường để nhận diện tiêu đề/cột"""
    if not text:
        return ""
    norm = unicodedata.normalize("NFD", text)
    unaccented = "".join(c for c in norm if unicodedata.category(c) != "Mn")
    return unaccented.replace("đ", "d").replace("Đ", "D").lower().strip()


def parse_meter_number(val: any) -> int:
    """Phân tích số chỉ số điện/nước an toàn, tránh làm sai lệch số thập phân hoặc hàng nghìn"""
    if val is None:
        return 0
    if isinstance(val, (int, float)):
        return max(0, int(round(val)))
    s = str(val).strip()
    if not s:
        return 0
    try:
        return max(0, int(round(float(s))))
    except ValueError:
        pass
    cleaned = s.replace(" ", "")
    if "." in cleaned and "," in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        parts = cleaned.split(",")
        if len(parts) == 2 and len(parts[1]) != 3:
            cleaned = cleaned.replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "." in cleaned:
        parts = cleaned.split(".")
        if len(parts) == 2 and len(parts[1]) != 3:
            cleaned = cleaned
        else:
            cleaned = cleaned.replace(".", "")
    try:
        return max(0, int(round(float(cleaned))))
    except Exception:
        m = re.findall(r"\d+", cleaned)
        return int(m[0]) if m else 0


class InvoiceService:
    @staticmethod
    def get_room_billing_candidates(
        db: Session,
        ky_thanh_toan: str = "Tháng 09/2026",
        don_gia_thang: Optional[float] = None,
        thoi_gian_o_thang: int = 1,
        ap_dung: Optional[str] = None,
    ) -> List[RoomBillingCandidate]:
        """
        Lấy danh sách sinh viên nội trú cần lập hóa đơn tiền phòng theo tháng:

        - Phạm vi áp dụng: Tất cả phòng, Chỉ phòng tiêu chuẩn, Chỉ phòng dịch vụ (hoặc theo tòa).
        - Chỉ lấy từ các hợp đồng ACTIVE thực sự tồn tại trong CSDL.
        """
        # 1. Truy vấn các hợp đồng đang hiệu lực từ CSDL
        query = db.query(HopDong).filter(HopDong.trang_thai == "ACTIVE")
        active_contracts = query.all()

        # Lọc theo kỳ thanh toán nếu có
        if ky_thanh_toan:
            m_month = re.search(r"(\d{1,2})/(\d{4})", ky_thanh_toan)
            if m_month:
                month_num = int(m_month.group(1))
                year_num = int(m_month.group(2))
                _, last_day = calendar.monthrange(year_num, month_num)
                period_start = datetime.date(year_num, month_num, 1)
                period_end = datetime.date(year_num, month_num, last_day)
                active_contracts = [
                    hd for hd in active_contracts
                    if (hd.ngay_bat_dau or datetime.date(2000, 1, 1)) <= period_end
                    and (hd.ngay_ket_thuc or datetime.date(2099, 12, 31)) >= period_start
                ]
            else:
                years = [int(y) for y in re.findall(r"\b(20\d\d)\b", ky_thanh_toan)]
                if years:
                    start_year = min(years)
                    end_year = max(years)
                    period_start = datetime.date(start_year, 8, 1)
                    period_end = datetime.date(end_year, 7, 31) if end_year > start_year else datetime.date(start_year, 12, 31)
                    active_contracts = [
                        hd for hd in active_contracts
                        if (hd.ngay_bat_dau or datetime.date(2000, 1, 1)) <= period_end
                        and (hd.ngay_ket_thuc or datetime.date(2099, 12, 31)) >= period_start
                    ]

        candidates: List[RoomBillingCandidate] = []

        for hd in active_contracts:
            sv = hd.sinh_vien
            nd = sv.nguoi_dung if sv else None
            ho_ten = nd.ho_ten if nd else (sv.msv if sv else hd.msv)

            # Tìm thông tin phòng & loại phòng
            phong_str = "Chưa xếp phòng"
            ma_phong_val = None
            loai_phong_label = "Phòng tiêu chuẩn"
            unit_price = 0.0

            if hd.giuong and hd.giuong.phong:
                p = hd.giuong.phong
                ma_phong_val = p.ma_phong
                t = p.tang.toa_nha.ten_toa if p.tang and p.tang.toa_nha else ""
                so_phong_clean = p.so_phong if p.so_phong.upper().startswith("P") else f"P{p.so_phong}"
                phong_str = f"{so_phong_clean} - {t}".strip(" -")
                raw_loai = (p.loai_phong or "").lower()
                if "dịch vụ" in raw_loai or "dich vu" in raw_loai or "service" in raw_loai:
                    loai_phong_label = "Phòng dịch vụ"
                    gia_nam = float(p.gia_tien_nam) if (p.gia_tien_nam and float(p.gia_tien_nam) > 0) else 8200000.0
                    unit_price = round(gia_nam / 11)
                else:
                    loai_phong_label = "Phòng tiêu chuẩn"
                    gia_nam = float(p.gia_tien_nam) if (p.gia_tien_nam and float(p.gia_tien_nam) > 0) else 4800000.0
                    unit_price = round(gia_nam / 11)

            # Nếu đơn giá tháng được truyền vào khác mặc định thì áp dụng
            if don_gia_thang is not None and don_gia_thang > 0:
                unit_price = don_gia_thang

            # Lọc theo phạm vi áp dụng (Chỉ phòng tiêu chuẩn / Chỉ phòng dịch vụ / theo tòa)
            if ap_dung:
                ap_norm = ap_dung.lower()
                if "tiêu chuẩn" in ap_norm and "dịch vụ" not in ap_norm:
                    if loai_phong_label != "Phòng tiêu chuẩn":
                        continue
                elif "dịch vụ" in ap_norm and "tiêu chuẩn" not in ap_norm:
                    if loai_phong_label != "Phòng dịch vụ":
                        continue
                elif "tòa" in ap_norm or "toa" in ap_norm:
                    m = re.search(r"A\d+", ap_dung, re.IGNORECASE)
                    if m and m.group(0).upper() not in phong_str.upper():
                        continue

            # Kiểm tra xem hợp đồng này đã lập hóa đơn chưa cho kỳ này
            existing_inv = (
                db.query(HoaDon)
                .filter(
                    HoaDon.ma_hop_dong == hd.ma_hop_dong,
                    HoaDon.loai_hoa_don == LoaiHoaDon.TIEN_PHONG.value,
                    HoaDon.ky_thanh_toan == ky_thanh_toan,
                )
                .first()
            )

            # Định dạng thời hạn hợp đồng
            start_str = hd.ngay_bat_dau.strftime("%d/%m/%Y") if hd.ngay_bat_dau else ""
            end_str = hd.ngay_ket_thuc.strftime("%d/%m/%Y") if hd.ngay_ket_thuc else "Hiện tại"
            term_str = f"{start_str} - {end_str}".strip(" -")

            is_annual = "năm" in (ky_thanh_toan or "").lower() or "nam" in (ky_thanh_toan or "").lower() or thoi_gian_o_thang >= 10
            if is_annual:
                current_amount = gia_nam
            else:
                current_amount = unit_price * thoi_gian_o_thang

            candidates.append(
                RoomBillingCandidate(
                    msv=hd.msv,
                    ho_ten=ho_ten,
                    phong=phong_str,
                    loai_phong=loai_phong_label,
                    ma_phong=ma_phong_val,
                    ma_hop_dong=hd.ma_hop_dong,
                    thoi_han_hop_dong=term_str,
                    thoi_gian_o_thang=thoi_gian_o_thang,
                    don_gia_thang=unit_price,
                    so_tien=current_amount,
                    da_lap_hoa_don=existing_inv is not None,
                )
            )

        return candidates

    @staticmethod
    def publish_room_invoices(
        db: Session,
        request: RoomInvoicePublishRequest,
        creator_username: str,
    ) -> PublishResultResponse:
        """
        Phát hành đợt hóa đơn tiền phòng định kỳ theo kỳ học.
        Chỉ phát hành hóa đơn với các hợp đồng thực sự tồn tại trong CSDL.
        Kiểm tra chặt chẽ tính hợp lệ, toàn vẹn khóa ngoại (FK) và chống tạo trùng lặp hóa đơn.
        """
        if not request.ky_thanh_toan or not request.ky_thanh_toan.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kỳ thanh toán không được để trống",
            )

        if not request.han_thanh_toan:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hạn chót thanh toán không được để trống",
            )

        # 1. Truy vấn các hợp đồng ACTIVE thực tế trong CSDL
        query = db.query(HopDong).filter(HopDong.trang_thai == "ACTIVE")
        if request.danh_sach_msv:
            query = query.filter(HopDong.msv.in_(request.danh_sach_msv))
        valid_contracts = query.all()

        # Lọc theo kỳ thanh toán nếu không truyền danh sách MSV cụ thể
        if not request.danh_sach_msv:
            m_month = re.search(r"(\d{1,2})/(\d{4})", request.ky_thanh_toan)
            if m_month:
                month_num = int(m_month.group(1))
                year_num = int(m_month.group(2))
                _, last_day = calendar.monthrange(year_num, month_num)
                period_start = datetime.date(year_num, month_num, 1)
                period_end = datetime.date(year_num, month_num, last_day)
                valid_contracts = [
                    hd for hd in valid_contracts
                    if (hd.ngay_bat_dau or datetime.date(2000, 1, 1)) <= period_end
                    and (hd.ngay_ket_thuc or datetime.date(2099, 12, 31)) >= period_start
                ]
            else:
                years = [int(y) for y in re.findall(r"\b(20\d\d)\b", request.ky_thanh_toan)]
                if years:
                    start_year = min(years)
                    end_year = max(years)
                    period_start = datetime.date(start_year, 8, 1)
                    period_end = datetime.date(end_year, 7, 31) if end_year > start_year else datetime.date(start_year, 12, 31)
                    valid_contracts = [
                        hd for hd in valid_contracts
                        if (hd.ngay_bat_dau or datetime.date(2000, 1, 1)) <= period_end
                        and (hd.ngay_ket_thuc or datetime.date(2099, 12, 31)) >= period_start
                    ]

        # Lọc theo tòa nhà áp dụng nếu không truyền danh sách MSV cụ thể
        if not request.danh_sach_msv and request.ap_dung and "tòa" in request.ap_dung.lower():
            m = re.search(r"A\d+", request.ap_dung, re.IGNORECASE)
            if m:
                target_building = m.group(0).upper()
                valid_contracts = [
                    hd for hd in valid_contracts
                    if hd.giuong and hd.giuong.phong and hd.giuong.phong.tang and hd.giuong.phong.tang.toa_nha
                    and target_building in f"{hd.giuong.phong.tang.toa_nha.ma_toa} {hd.giuong.phong.tang.toa_nha.ten_toa}".upper()
                ]

        # Xác thực tính tồn tại của hợp đồng
        if request.danh_sach_msv:
            found_msvs = {c.msv for c in valid_contracts}
            missing_msvs = [msv for msv in request.danh_sach_msv if msv not in found_msvs]
            if missing_msvs:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Không tìm thấy hợp đồng hợp lệ hoặc hợp đồng không tồn tại trong hệ thống cho sinh viên: {', '.join(missing_msvs)}. Chỉ phát hành hóa đơn với hợp đồng tồn tại.",
                )

        if not valid_contracts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không tìm thấy hợp đồng hợp lệ nào tồn tại trong hệ thống để phát hành hóa đơn. Chỉ phát hành hóa đơn với hợp đồng tồn tại.",
            )

        created_invoices: List[HoaDon] = []
        already_issued_info: List[str] = []

        try:
            for hd in valid_contracts:
                sv = hd.sinh_vien
                nd = sv.nguoi_dung if sv else None
                ho_ten = nd.ho_ten if nd else (sv.msv if sv else hd.msv)

                phong_str = "Chưa xếp phòng"
                ma_phong_val = None
                loai_phong_label = "Phòng tiêu chuẩn"
                unit_price = 0.0

                if hd.giuong and hd.giuong.phong:
                    p = hd.giuong.phong
                    ma_phong_val = p.ma_phong
                    t = p.tang.toa_nha.ten_toa if p.tang and p.tang.toa_nha else ""
                    so_phong_clean = p.so_phong if p.so_phong.upper().startswith("P") else f"P{p.so_phong}"
                    phong_str = f"{so_phong_clean} - {t}".strip(" -")
                    raw_loai = (p.loai_phong or "").lower()
                    if "dịch vụ" in raw_loai or "dich vu" in raw_loai or "service" in raw_loai:
                        loai_phong_label = "Phòng dịch vụ"
                        gia_nam = float(p.gia_tien_nam) if (p.gia_tien_nam and float(p.gia_tien_nam) > 0) else 8200000.0
                        unit_price = round(gia_nam / 11)
                    else:
                        loai_phong_label = "Phòng tiêu chuẩn"
                        gia_nam = float(p.gia_tien_nam) if (p.gia_tien_nam and float(p.gia_tien_nam) > 0) else 4800000.0
                        unit_price = round(gia_nam / 11)

                # Áp dụng đơn giá tháng nếu có truyền vào khác mặc định
                if request.don_gia_thang is not None and request.don_gia_thang > 0:
                    unit_price = request.don_gia_thang

                # Lọc theo phạm vi áp dụng (Chỉ phòng tiêu chuẩn / Chỉ phòng dịch vụ) nếu không chỉ định danh sách msv
                if not request.danh_sach_msv and request.ap_dung:
                    ap_norm = request.ap_dung.lower()
                    if "tiêu chuẩn" in ap_norm and "dịch vụ" not in ap_norm and loai_phong_label != "Phòng tiêu chuẩn":
                        continue
                    if "dịch vụ" in ap_norm and "tiêu chuẩn" not in ap_norm and loai_phong_label != "Phòng dịch vụ":
                        continue

                # 2. Kiểm tra chống tạo trùng lặp theo hợp đồng và kỳ thanh toán
                existing = (
                    db.query(HoaDon)
                    .filter(
                        HoaDon.ma_hop_dong == hd.ma_hop_dong,
                        HoaDon.loai_hoa_don == LoaiHoaDon.TIEN_PHONG.value,
                        HoaDon.ky_thanh_toan == request.ky_thanh_toan,
                    )
                    .first()
                )

                if existing:
                    already_issued_info.append(f"{hd.msv} (HĐ: {hd.ma_hop_dong})")
                    continue

                is_annual = "năm" in (request.ky_thanh_toan or "").lower() or "nam" in (request.ky_thanh_toan or "").lower() or request.thoi_gian_o_thang >= 10
                if is_annual:
                    current_student_amount = gia_nam
                else:
                    current_student_amount = unit_price * request.thoi_gian_o_thang

                # Sinh mã hóa đơn duy nhất dạng HDTP-YYYYMMDD-UUID4[:6]
                today_str = datetime.date.today().strftime("%Y%m%d")
                unique_suffix = uuid.uuid4().hex[:6].upper()
                ma_hd = f"HDTP-{today_str}-{unique_suffix}"

                # 3. Tạo hóa đơn tiền phòng với ma_hop_dong thực tế từ bảng hop_dong (tuân thủ FK 100%)
                new_invoice = HoaDon(
                    ma_hoa_don=ma_hd,
                    ma_hop_dong=hd.ma_hop_dong,
                    msv=hd.msv,
                    ho_ten=ho_ten,
                    ma_phong=ma_phong_val,
                    so_phong=phong_str,
                    loai_hoa_don=LoaiHoaDon.TIEN_PHONG.value,
                    ky_thanh_toan=request.ky_thanh_toan,
                    so_tien=current_student_amount,
                    ngay_lap=datetime.date.today(),
                    han_thanh_toan=request.han_thanh_toan,
                    trang_thai=TrangThaiHoaDon.CHUA_THANH_TOAN.value,
                    ghi_chu=request.ghi_chu or f"Hóa đơn tiền phòng {request.ky_thanh_toan} ({loai_phong_label})",
                    nguoi_tao=creator_username,
                    ngay_tao=datetime.datetime.now(),
                )
                db.add(new_invoice)

                # 4. Tạo bản ghi vào bảng phi hiện có gắn với mã hợp đồng thực tế
                phi_rec = Phi(
                    ma_phi=f"P-{unique_suffix}"[:20],
                    ma_hop_dong=hd.ma_hop_dong,
                    loai_phi="TIEN_PHONG",
                    so_tien=current_student_amount,
                    han_nop=request.han_thanh_toan,
                )
                db.add(phi_rec)

                # 5. Tạo bản ghi vào bảng so_cong_no tương ứng
                so_cong_no_rec = SoCongNo(
                    ma_hoa_don=new_invoice.ma_hoa_don,
                    msv=hd.msv,
                    so_phong=phong_str,
                    loai_cong_no=new_invoice.loai_hoa_don,
                    ky_thanh_toan=new_invoice.ky_thanh_toan,
                    tong_tien=new_invoice.so_tien,
                    da_tra=0.0,
                    con_thieu=new_invoice.so_tien,
                    han_thanh_toan=new_invoice.han_thanh_toan,
                    trang_thai="CON_NO",
                    ghi_chu=new_invoice.ghi_chu or f"Công nợ tiền phòng {new_invoice.ky_thanh_toan}",
                    ngay_cap_nhat=datetime.datetime.now(),
                )
                db.add(so_cong_no_rec)

                created_invoices.append(new_invoice)

            if not created_invoices:
                if already_issued_info:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Tất cả hợp đồng được chọn đã được phát hành hóa đơn cho {request.ky_thanh_toan} trước đó ({', '.join(already_issued_info)}). Không thể phát hành trùng!",
                    )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Không tìm thấy hợp đồng nào phù hợp với phạm vi áp dụng đã chọn để phát hành hóa đơn.",
                    )

            db.commit()

            # Refresh các bản ghi để lấy dữ liệu hoàn chỉnh
            for inv in created_invoices:
                db.refresh(inv)
        except HTTPException:
            raise
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Lỗi khi phát hành hóa đơn: {str(e)}",
            )

        invoices_response = [
            HoaDonResponse(
                ma_hoa_don=inv.ma_hoa_don,
                ma_hop_dong=inv.ma_hop_dong,
                msv=inv.msv,
                ho_ten=inv.ho_ten,
                ma_phong=inv.ma_phong,
                so_phong=inv.so_phong,
                loai_hoa_don=inv.loai_hoa_don,
                ky_thanh_toan=inv.ky_thanh_toan,
                so_tien=inv.so_tien,
                ngay_lap=inv.ngay_lap,
                han_thanh_toan=inv.han_thanh_toan,
                trang_thai=inv.trang_thai,
                ghi_chu=inv.ghi_chu,
                nguoi_tao=inv.nguoi_tao,
            )
            for inv in created_invoices
        ]

        total_sum = sum(inv.so_tien for inv in created_invoices)
        msg = f"Đã phát hành thành công {len(created_invoices)} hóa đơn tiền phòng cho {request.ky_thanh_toan}."
        if already_issued_info:
            msg += f" (Đã bỏ qua {len(already_issued_info)} hợp đồng đã có hóa đơn trước đó: {', '.join(already_issued_info)})"

        return PublishResultResponse(
            success=True,
            message=msg,
            tong_hoa_don=len(created_invoices),
            tong_so_tien=total_sum,
            invoices=invoices_response,
            danh_sach_hoa_don=invoices_response,
        )

    @staticmethod
    def get_utility_billing_candidates(
        db: Session,
        thang: str = "Tháng 09/2026",
    ) -> List[UtilityBillingCandidate]:
        """
        Lấy danh sách các phòng phục vụ lập hóa đơn tiền điện nước theo tháng.
        Kiểm tra hóa đơn điện nước đã phát hành cho phòng trong tháng tương ứng.
        """
        rooms = db.query(Phong).all()
        candidates: List[UtilityBillingCandidate] = []

        for r in rooms:
            toa_ten = r.tang.toa_nha.ten_toa if r.tang and r.tang.toa_nha else "KTX"
            student_count = (
                db.query(HopDong)
                .join(Giuong, HopDong.ma_giuong == Giuong.ma_giuong)
                .filter(Giuong.ma_phong == r.ma_phong, HopDong.trang_thai == "ACTIVE")
                .count()
            )

            existing = (
                db.query(HoaDon)
                .filter(
                    HoaDon.ma_phong == r.ma_phong,
                    HoaDon.loai_hoa_don == LoaiHoaDon.DIEN_NUOC.value,
                    HoaDon.ky_thanh_toan == thang,
                )
                .first()
            )

            so_p = r.so_phong if r.so_phong.upper().startswith("P") else f"P{r.so_phong}"

            candidates.append(
                UtilityBillingCandidate(
                    ma_phong=r.ma_phong,
                    so_phong=so_p,
                    toa_nha=toa_ten,
                    so_sinh_vien=student_count if student_count > 0 else (r.suc_chua or 4),
                    chi_so_dien_cu_moi="--",
                    so_dien_kwh=0,
                    chi_so_nuoc_cu_moi="--",
                    so_nuoc_m3=0,
                    tong_tien=0.0,
                    so_dien_cu=0,
                    so_dien_moi=0,
                    so_nuoc_cu=0,
                    so_nuoc_moi=0,
                    tien_dien=0.0,
                    tien_nuoc=0.0,
                    da_lap_hoa_don=existing is not None,
                )
            )

        return candidates

    @staticmethod
    def publish_utility_invoices(
        db: Session,
        request: UtilityInvoicePublishRequest,
        creator_username: str,
    ) -> PublishResultResponse:
        """
        Phát hành hóa đơn tiền điện nước theo tháng cho các phòng ký túc xá.
        Kiểm tra chống tạo trùng cho cùng phòng trong cùng tháng.
        """
        if not request.thang or not request.thang.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tháng áp dụng không được để trống",
            )

        if not request.han_thanh_toan:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Hạn chót thanh toán không được để trống",
            )

        all_candidates = InvoiceService.get_utility_billing_candidates(
            db=db,
            thang=request.thang,
        )

        if not all_candidates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không tìm thấy phòng nào trong hệ thống để phát hành hóa đơn điện nước.",
            )

        targets = all_candidates
        if request.danh_sach_phong:
            selected_set = {p.strip().upper() for p in request.danh_sach_phong}
            targets = [
                c for c in all_candidates
                if c.ma_phong.upper() in selected_set or c.so_phong.upper() in selected_set
            ]
            if not targets:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Không tìm thấy phòng nào phù hợp với danh sách mã phòng đã chỉ định",
                )

        created_invoices: List[HoaDon] = []
        already_issued_rooms: List[str] = []

        # Nếu có chi tiết phòng gửi kèm từ file chỉ số điện nước tải lên
        room_detail_map = {}
        if request.chi_tiet_phong:
            for item in request.chi_tiet_phong:
                clean_mp = item.ma_phong.strip().upper()
                room_detail_map[clean_mp] = item
                if item.so_phong:
                    clean_sp = item.so_phong.strip().upper()
                    room_detail_map[clean_sp] = item
                    clean_digits = re.sub(r"[^0-9]", "", clean_sp)
                    if clean_digits:
                        room_detail_map[clean_digits] = item
                        room_detail_map[f"P{clean_digits}"] = item

        for c in targets:
            existing = (
                db.query(HoaDon)
                .filter(
                    HoaDon.ma_phong == c.ma_phong,
                    HoaDon.loai_hoa_don == LoaiHoaDon.DIEN_NUOC.value,
                    HoaDon.ky_thanh_toan == request.thang,
                )
                .first()
            )

            if existing:
                already_issued_rooms.append(c.ma_phong)
                continue

            today_str = datetime.date.today().strftime("%Y%m%d")
            unique_suffix = uuid.uuid4().hex[:6].upper()
            ma_hd = f"HDDN-{today_str}-{unique_suffix}"

            # Tính toán tiền điện nước:
            digits_so_phong = re.sub(r"[^0-9]", "", c.so_phong)
            meter_info = (
                room_detail_map.get(c.ma_phong.upper())
                or room_detail_map.get(c.so_phong.upper())
                or room_detail_map.get(digits_so_phong)
                or room_detail_map.get(f"P{digits_so_phong}")
            )
            if meter_info:
                calculated_amount = float(meter_info.tong_tien)
                so_dien_str = f"Điện: {meter_info.chi_so_dien_cu_moi} ({meter_info.so_dien_kwh} kWh)"
                so_nuoc_str = f"Nước: {meter_info.chi_so_nuoc_cu_moi} ({meter_info.so_nuoc_m3} m³)"
                note_str = f"Hóa đơn điện nước {request.thang} (Phòng {c.so_phong} - {c.toa_nha}. {so_dien_str}, {so_nuoc_str})"
            else:
                calculated_amount = (c.so_dien_kwh * request.don_gia_dien) + (c.so_nuoc_m3 * request.don_gia_nuoc)
                if calculated_amount <= 0:
                    calculated_amount = float(c.tong_tien or 0.0)
                if calculated_amount <= 0:
                    continue  # Bỏ qua các phòng chưa có chỉ số điện nước thực tế
                note_str = request.ghi_chu or f"Hóa đơn tiền điện nước {request.thang} (Phòng {c.so_phong} - {c.toa_nha})"

            # Tìm danh sách sinh viên đang lưu trú tại phòng này (Hợp đồng ACTIVE / DANG_O)
            active_contracts = (
                db.query(HopDong)
                .join(Giuong, HopDong.ma_giuong == Giuong.ma_giuong)
                .filter(
                    Giuong.ma_phong == c.ma_phong,
                    HopDong.trang_thai.in_(["ACTIVE", "DANG_O"]),
                )
                .all()
            )

            seen_msvs = set()
            unique_contracts = []
            for hd in active_contracts:
                if hd.msv and hd.msv.upper() not in seen_msvs:
                    seen_msvs.add(hd.msv.upper())
                    unique_contracts.append(hd)
            num_occupants = len(unique_contracts)

            if num_occupants > 0:
                # Phương án A: Chia đều tiền điện nước của cả phòng cho từng sinh viên đang ở
                per_person_amount = round(calculated_amount / num_occupants)

                for hd in unique_contracts:
                    u_suffix = uuid.uuid4().hex[:6].upper()
                    ma_hd = f"HDDN-{today_str}-{u_suffix}"
                    student_name = (
                        hd.sinh_vien.nguoi_dung.ho_ten
                        if (hd.sinh_vien and hd.sinh_vien.nguoi_dung and hd.sinh_vien.nguoi_dung.ho_ten)
                        else hd.msv
                    )
                    indiv_note = f"{note_str} - {student_name} ({hd.msv})"

                    new_invoice = HoaDon(
                        ma_hoa_don=ma_hd,
                        ma_hop_dong=hd.ma_hop_dong,
                        msv=hd.msv,
                        ho_ten=student_name,
                        ma_phong=c.ma_phong,
                        so_phong=f"{c.so_phong} - {c.toa_nha}",
                        loai_hoa_don=LoaiHoaDon.DIEN_NUOC.value,
                        ky_thanh_toan=request.thang,
                        so_tien=per_person_amount,
                        ngay_lap=datetime.date.today(),
                        han_thanh_toan=request.han_thanh_toan,
                        trang_thai=TrangThaiHoaDon.CHUA_THANH_TOAN.value,
                        ghi_chu=indiv_note,
                        nguoi_tao=creator_username,
                        ngay_tao=datetime.datetime.now(),
                    )
                    db.add(new_invoice)

                    # Tạo bản ghi vào bảng so_cong_no cho sinh viên
                    so_cong_no_rec = SoCongNo(
                        ma_hoa_don=new_invoice.ma_hoa_don,
                        msv=hd.msv,
                        so_phong=new_invoice.so_phong,
                        loai_cong_no=new_invoice.loai_hoa_don,
                        ky_thanh_toan=new_invoice.ky_thanh_toan,
                        tong_tien=new_invoice.so_tien,
                        da_tra=0.0,
                        con_thieu=new_invoice.so_tien,
                        han_thanh_toan=new_invoice.han_thanh_toan,
                        trang_thai="CON_NO",
                        ghi_chu=new_invoice.ghi_chu or f"Công nợ tiền điện nước {new_invoice.ky_thanh_toan}",
                        ngay_cap_nhat=datetime.datetime.now(),
                    )
                    db.add(so_cong_no_rec)
                    created_invoices.append(new_invoice)
            else:
                # Phòng chưa có sinh viên ở -> Giữ hóa đơn chung cho phòng
                u_suffix = uuid.uuid4().hex[:6].upper()
                empty_room_ma_hd = f"HDDN-{today_str}-{u_suffix}"
                new_invoice = HoaDon(
                    ma_hoa_don=empty_room_ma_hd,
                    ma_hop_dong=None,
                    msv=None,
                    ho_ten=None,
                    ma_phong=c.ma_phong,
                    so_phong=f"{c.so_phong} - {c.toa_nha}",
                    loai_hoa_don=LoaiHoaDon.DIEN_NUOC.value,
                    ky_thanh_toan=request.thang,
                    so_tien=calculated_amount,
                    ngay_lap=datetime.date.today(),
                    han_thanh_toan=request.han_thanh_toan,
                    trang_thai=TrangThaiHoaDon.CHUA_THANH_TOAN.value,
                    ghi_chu=note_str,
                    nguoi_tao=creator_username,
                    ngay_tao=datetime.datetime.now(),
                )
                db.add(new_invoice)
                created_invoices.append(new_invoice)

                so_cong_no_rec = SoCongNo(
                    ma_hoa_don=new_invoice.ma_hoa_don,
                    msv=None,
                    so_phong=new_invoice.so_phong,
                    loai_cong_no=new_invoice.loai_hoa_don,
                    ky_thanh_toan=new_invoice.ky_thanh_toan,
                    tong_tien=new_invoice.so_tien,
                    da_tra=0.0,
                    con_thieu=new_invoice.so_tien,
                    han_thanh_toan=new_invoice.han_thanh_toan,
                    trang_thai="CON_NO",
                    ghi_chu=new_invoice.ghi_chu or f"Công nợ tiền điện nước {new_invoice.ky_thanh_toan}",
                    ngay_cap_nhat=datetime.datetime.now(),
                )
                db.add(so_cong_no_rec)
                created_invoices.append(new_invoice)

        if not created_invoices:
            if already_issued_rooms:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Tất cả các phòng được chọn đã được phát hành hóa đơn điện nước cho {request.thang} trước đó ({', '.join(already_issued_rooms)}). Không thể phát hành trùng!",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Không có phòng nào hợp lệ để phát hành hóa đơn điện nước.",
                )

        db.commit()

        for inv in created_invoices:
            db.refresh(inv)

        invoices_response = [
            HoaDonResponse(
                ma_hoa_don=inv.ma_hoa_don,
                ma_hop_dong=inv.ma_hop_dong,
                msv=inv.msv,
                ho_ten=inv.ho_ten,
                ma_phong=inv.ma_phong,
                so_phong=inv.so_phong,
                loai_hoa_don=inv.loai_hoa_don,
                ky_thanh_toan=inv.ky_thanh_toan,
                so_tien=inv.so_tien,
                ngay_lap=inv.ngay_lap,
                han_thanh_toan=inv.han_thanh_toan,
                trang_thai=inv.trang_thai,
                ghi_chu=inv.ghi_chu,
                nguoi_tao=inv.nguoi_tao,
            )
            for inv in created_invoices
        ]

        total_sum = sum(inv.so_tien for inv in created_invoices)
        msg = f"Đã phát hành thành công {len(created_invoices)} hóa đơn điện nước cho {request.thang}."
        if already_issued_rooms:
            msg += f" (Đã bỏ qua các phòng đã có hóa đơn: {', '.join(already_issued_rooms)})"

        return PublishResultResponse(
            success=True,
            message=msg,
            tong_hoa_don=len(created_invoices),
            tong_so_tien=total_sum,
            invoices=invoices_response,
            danh_sach_hoa_don=invoices_response,
        )

    @staticmethod
    def upload_utility_readings(
        db: Session,
        file_bytes: bytes,
        filename: str,
        thang: str = "Tháng 09/2026",
        don_gia_dien: float = 3000.0,
        don_gia_nuoc: float = 15000.0,
    ) -> UtilityMeterUploadResponse:
        """
        Đọc file Excel hoặc CSV chỉ số điện nước, tự động tính toán:
        - Số điện tiêu thụ (kWh) = Chỉ số mới - Chỉ số cũ
        - Số nước tiêu thụ (m3) = Chỉ số mới - Chỉ số cũ
        - Tiền điện = kWh * đơn giá điện
        - Tiền nước = m3 * đơn giá nước
        - Tổng tiền = Tiền điện + Tiền nước
        Trả về danh sách phòng kèm kết quả tính toán chi tiết.
        """
        raw_rows = []
        is_excel = filename.lower().endswith((".xlsx", ".xls"))
        if is_excel:
            if not HAS_OPENPYXL:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Thư viện openpyxl chưa được cài đặt trên máy chủ để đọc file Excel.",
                )
            try:
                wb = load_workbook(io.BytesIO(file_bytes), data_only=True)
                ws = wb.active
                for row in ws.iter_rows(values_only=True):
                    if row and any(c is not None and str(c).strip() != "" for c in row):
                        raw_rows.append([c if c is not None else "" for c in row])
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Không thể đọc file Excel chỉ số: {str(e)}",
                )
        else:
            decoded = None
            for enc in ["utf-8-sig", "utf-8", "cp1258", "latin1"]:
                try:
                    decoded = file_bytes.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
            if decoded is None:
                decoded = file_bytes.decode("utf-8", errors="ignore")
            delim = ";" if decoded.count(";") > decoded.count(",") else ","
            reader = csv.reader(io.StringIO(decoded), delimiter=delim)
            for row in reader:
                if row and any(c.strip() for c in row):
                    raw_rows.append([c.strip() for c in row])

        if not raw_rows:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File chỉ số trống hoặc không có dòng dữ liệu hợp lệ",
            )

        def clean_norm(val: any) -> str:
            if val is None:
                return ""
            s = strip_accents(str(val))
            # Thay thế ký tự lũy thừa và đơn vị đo
            s = s.replace("³", "3").replace("²", "2")
            return re.sub(r"[^a-z0-9]", "", s)

        header_idx = -1
        col_room = -1
        col_toa = -1
        col_elec_old = -1
        col_elec_new = -1
        col_elec_pair = -1
        col_water_old = -1
        col_water_new = -1
        col_water_pair = -1
        col_elec_usage = -1
        col_water_usage = -1

        # 1. Tìm dòng tiêu đề thông minh (Hỗ trợ tiêu đề 1 dòng, 2 dòng gộp ô, cột gộp cũ-mới, và tên cột biến thiên)
        for idx in range(min(15, len(raw_rows))):
            r = raw_rows[idx]
            prev_r = raw_rows[idx - 1] if idx > 0 else []

            # Bỏ qua dòng nếu rõ ràng là dòng dữ liệu (ví dụ: ô đầu là số thứ tự 1, 2, 3... và có nhiều ô là số)
            first_val = str(r[0] if len(r) > 0 and r[0] is not None else "").strip()
            num_numeric = sum(1 for c in r if str(c).strip().replace(".", "").replace(",", "").isdigit())
            if first_val in ["1", "01"] and num_numeric >= 3:
                continue

            # Tạo danh sách tiêu đề cha từ dòng phía trên (hỗ trợ merged cells ngang/dọc)
            filled_parents = []
            last_parent = ""
            for c_i in range(len(r)):
                parent_val = str(prev_r[c_i]).strip() if (prev_r and c_i < len(prev_r) and prev_r[c_i] is not None) else ""
                if parent_val:
                    if len(parent_val) <= 45:
                        last_parent = parent_val
                    else:
                        last_parent = ""
                filled_parents.append(last_parent)

            tmp_room = -1
            tmp_toa = -1
            tmp_e_old = -1
            tmp_e_new = -1
            tmp_e_pair = -1
            tmp_w_old = -1
            tmp_w_new = -1
            tmp_w_pair = -1
            tmp_e_usage = -1
            tmp_w_usage = -1

            old_new_pairs = []

            for c_idx, cell in enumerate(r):
                # Kế thừa từ dòng trên nếu ô hiện tại rỗng
                cell_raw = str(cell).strip() if cell is not None else ""
                parent_direct = str(prev_r[c_idx]).strip() if (prev_r and c_idx < len(prev_r) and prev_r[c_idx] is not None) else ""
                effective_cell = cell_raw or parent_direct

                c_norm = clean_norm(effective_cell)
                cell_only_norm = clean_norm(cell_raw)
                p_norm = clean_norm(filled_parents[c_idx]) if c_idx < len(filled_parents) else ""
                combined = f"{p_norm}_{c_norm}"

                # Nhận diện cột phòng (loại trừ các trường loại phòng, tên phòng, tiền, ghi chú)
                if not any(ex in c_norm for ex in ["loaiphong", "tenphong", "ghichu", "songuoi", "thanhvien", "sothanhvien", "tiendien", "tiennuoc", "tongtien", "dongia", "giaphong", "tien", "stt"]):
                    if c_norm in ["phong", "sophong", "maphong", "room", "phongso", "phongktx"]:
                        tmp_room = c_idx
                    elif "phong" in c_norm and not any(ex in c_norm for ex in ["dien", "nuoc", "tien", "phi", "stt"]):
                        if tmp_room == -1:
                            tmp_room = c_idx

                # Nhận diện cột tòa
                if not any(ex in c_norm for ex in ["phong", "tien", "dien", "nuoc", "phi", "stt"]):
                    if any(k in c_norm for k in ["toanha", "toa", "building", "block", "khu", "day"]):
                        tmp_toa = c_idx

                # Nhận diện đặc tính điện / nước
                is_dien = any(k in cell_only_norm for k in ["dien", "elec", "kwh"]) or any(k in combined for k in ["dien", "elec", "kwh"])
                is_nuoc = any(k in cell_only_norm for k in ["nuoc", "water", "m3", "khoinuoc"]) or any(k in combined for k in ["nuoc", "water", "m3", "khoinuoc"])
                if not is_nuoc and any(k in cell_only_norm for k in ["tieuthu", "sudung"]) and cell_only_norm.endswith("m"):
                    is_nuoc = True

                # Nhận diện đặc tính cũ / mới hoặc cột gộp cũ - mới
                has_old = any(k in cell_only_norm for k in ["cu", "dau", "truoc", "old", "start", "begin"])
                has_new = any(k in cell_only_norm for k in ["moi", "cuoi", "nay", "new", "end", "hientai"])

                if is_dien:
                    if has_old and has_new:
                        tmp_e_pair = c_idx
                    elif has_old:
                        tmp_e_old = c_idx
                    elif has_new:
                        tmp_e_new = c_idx
                elif is_nuoc:
                    if has_old and has_new:
                        tmp_w_pair = c_idx
                    elif has_old:
                        tmp_w_old = c_idx
                    elif has_new:
                        tmp_w_new = c_idx

                # Nhận diện cột tiêu thụ
                is_usage = any(k in cell_only_norm for k in ["tieuthu", "sudung", "luong", "sanluong"])
                if is_dien and (is_usage or cell_only_norm in ["kwh", "sokwh"]):
                    tmp_e_usage = c_idx
                elif is_nuoc and (is_usage or cell_only_norm in ["m3", "som3", "tieuthum", "tieuthum3"]):
                    tmp_w_usage = c_idx

                if has_old and not has_new and not is_dien and not is_nuoc:
                    old_new_pairs.append(("old", c_idx))
                elif has_new and not has_old and not is_dien and not is_nuoc:
                    old_new_pairs.append(("new", c_idx))

            # Nếu tiêu đề chung có 2 cặp Số cũ - Số mới liên tiếp
            if tmp_e_old == -1 and len(old_new_pairs) >= 4:
                old_list = [c for t, c in old_new_pairs if t == "old"]
                new_list = [c for t, c in old_new_pairs if t == "new"]
                if len(old_list) >= 2 and len(new_list) >= 2:
                    tmp_e_old = old_list[0]
                    tmp_e_new = new_list[0]
                    tmp_w_old = old_list[1]
                    tmp_w_new = new_list[1]

            has_room = tmp_room != -1
            has_elec = (tmp_e_pair != -1) or (tmp_e_old != -1 and tmp_e_new != -1) or tmp_e_usage != -1
            has_water = (tmp_w_pair != -1) or (tmp_w_old != -1 and tmp_w_new != -1) or tmp_w_usage != -1

            if has_room and (has_elec or has_water):
                header_idx = idx
                col_room = tmp_room
                col_toa = tmp_toa
                col_elec_old = tmp_e_old
                col_elec_new = tmp_e_new
                col_elec_pair = tmp_e_pair
                col_water_old = tmp_w_old
                col_water_new = tmp_w_new
                col_water_pair = tmp_w_pair
                col_elec_usage = tmp_e_usage
                col_water_usage = tmp_w_usage
                break

        # Nếu không tự động bắt được tiêu đề, suy đoán dự phòng an toàn theo thứ tự cột chuẩn
        if header_idx == -1:
            for idx in range(min(5, len(raw_rows))):
                r = raw_rows[idx]
                if len(r) >= 5 and any(re.search(r"\b\d{3}\b", str(c)) for c in r):
                    header_idx = max(0, idx - 1)
                    break
            if header_idx == -1:
                header_idx = 0

            first_data_row = raw_rows[min(header_idx + 1, len(raw_rows) - 1)]
            row_len = len(first_data_row)
            if row_len >= 6:
                col_room = 1
                col_elec_old = 2
                col_elec_new = 3
                col_water_old = 4
                col_water_new = 5
            elif row_len >= 5:
                col_room = 0
                col_elec_old = 1
                col_elec_new = 2
                col_water_old = 3
                col_water_new = 4

        # Xây dựng danh sách tra cứu phòng đa chiều từ CSDL
        db_rooms = db.query(Phong).all()
        map_by_code = {}
        map_by_pair = {}
        map_by_num = {}

        for r in db_rooms:
            toa = r.tang.toa_nha.ten_toa if r.tang and r.tang.toa_nha else "Tòa A1"
            clean_so = re.sub(r"[^0-9]", "", r.so_phong or "")
            so_display = r.so_phong if (r.so_phong and r.so_phong.upper().startswith("P")) else f"P{r.so_phong}"
            info = (r.ma_phong, so_display, toa)

            map_by_code[r.ma_phong.upper()] = info
            if clean_so:
                toa_norm = clean_norm(toa)
                map_by_pair[(clean_so, toa_norm)] = info
                map_by_num.setdefault(clean_so, []).append(info)

        items: List[UtilityBillingCandidate] = []
        total_amount = 0.0

        for r_idx in range(header_idx + 1, len(raw_rows)):
            row = raw_rows[r_idx]
            if not row or col_room >= len(row) or not str(row[col_room]).strip():
                continue

            raw_room = str(row[col_room]).strip()
            norm_room = clean_norm(raw_room)

            # Bỏ qua các dòng tổng cộng, người lập, tiêu đề lặp lại
            if not norm_room or any(k in norm_room for k in ["tongcong", "tongso", "nguoilap", "ketoantruong", "banquanly", "kyten"]):
                continue
            if norm_room in ["phong", "sophong", "stt", "maphong"]:
                continue

            # Lấy thông tin tòa nhà từ cột riêng hoặc từ chuỗi phòng ("203 - Tòa A1")
            row_toa = str(row[col_toa]).strip() if 0 <= col_toa < len(row) else ""
            toa_norm = clean_norm(row_toa)
            clean_digits = re.findall(r"\d+", raw_room)
            room_digits = clean_digits[0] if clean_digits else ""

            target_toa_display = ""
            if row_toa:
                target_toa_display = row_toa
            elif "toaa1" in norm_room or "a1" in norm_room:
                target_toa_display = "Tòa A1"
                toa_norm = "toaa1"
            elif "toaa2" in norm_room or "a2" in norm_room:
                target_toa_display = "Tòa A2"
                toa_norm = "toaa2"
            elif "toab" in norm_room or "b" in norm_room:
                target_toa_display = "Tòa B"
                toa_norm = "toab"
            else:
                target_toa_display = "Tòa A1"
                toa_norm = "toaa1"

            # Tìm kiếm phòng chính xác trong CSDL
            found = None
            clean_code = re.sub(r"[^a-zA-Z0-9_]", "", raw_room).upper()
            if clean_code in map_by_code:
                found = map_by_code[clean_code]
            elif room_digits and toa_norm and (room_digits, toa_norm) in map_by_pair:
                found = map_by_pair[(room_digits, toa_norm)]
            elif room_digits and room_digits in map_by_num:
                cand_list = map_by_num[room_digits]
                # Chỉ match nếu tòa nhà tương ứng hoặc tương đồng, tuyệt đối không gán sang tòa khác
                matched = [c for c in cand_list if toa_norm and (toa_norm in clean_norm(c[2]) or clean_norm(c[2]) in toa_norm)]
                if matched:
                    found = matched[0]

            if found:
                ma_p, so_p, toa_p = found
            else:
                # Phòng không có sẵn trong DB: bảo toàn đúng số phòng và tòa nhà người dùng nhập
                clean_so_clean = room_digits or raw_room
                so_p = f"P{clean_so_clean}" if not str(clean_so_clean).upper().startswith("P") else str(clean_so_clean)
                toa_p = target_toa_display
                toa_prefix = "A1" if "a1" in toa_norm else ("B" if "b" in toa_norm else "KTX")
                ma_p = f"{toa_prefix}_{so_p}"

            # 2. Tính toán chính xác điện
            elec_old = 0
            elec_new = 0
            elec_usage = 0

            # 2.1 Nếu có cột gộp chỉ số (cũ - mới) dạng "1240 - 1385"
            if col_elec_pair != -1 and 0 <= col_elec_pair < len(row):
                cell_pair_str = str(row[col_elec_pair]).strip()
                nums = re.findall(r"\d+", cell_pair_str)
                if len(nums) >= 2:
                    elec_old = int(nums[0])
                    elec_new = int(nums[1])
                    elec_usage = max(0, elec_new - elec_old)
                elif len(nums) == 1:
                    elec_old = int(nums[0])

            # 2.2 Nếu có 2 cột riêng cũ và mới
            if col_elec_old != -1 and col_elec_new != -1 and col_elec_pair == -1:
                elec_old = parse_meter_number(row[col_elec_old]) if col_elec_old < len(row) else 0
                elec_new = parse_meter_number(row[col_elec_new]) if col_elec_new < len(row) else elec_old
                elec_usage = max(0, elec_new - elec_old)

            # 2.3 Cột tiêu thụ điện riêng
            if col_elec_usage != -1 and 0 <= col_elec_usage < len(row):
                val_u = parse_meter_number(row[col_elec_usage])
                if val_u > 0:
                    elec_usage = val_u
                    if elec_old > 0 and (elec_new == 0 or elec_new <= elec_old):
                        elec_new = elec_old + elec_usage
                    elif elec_old == 0 and elec_new > 0:
                        elec_old = max(0, elec_new - elec_usage)

            # 3. Tính toán chính xác nước
            water_old = 0
            water_new = 0
            water_usage = 0

            # 3.1 Nếu có cột gộp chỉ số nước (cũ - mới) dạng "45 - 58"
            if col_water_pair != -1 and 0 <= col_water_pair < len(row):
                cell_pair_str = str(row[col_water_pair]).strip()
                nums = re.findall(r"\d+", cell_pair_str)
                if len(nums) >= 2:
                    water_old = int(nums[0])
                    water_new = int(nums[1])
                    water_usage = max(0, water_new - water_old)
                elif len(nums) == 1:
                    water_old = int(nums[0])

            # 3.2 Nếu có 2 cột riêng cũ và mới
            if col_water_old != -1 and col_water_new != -1 and col_water_pair == -1:
                water_old = parse_meter_number(row[col_water_old]) if col_water_old < len(row) else 0
                water_new = parse_meter_number(row[col_water_new]) if col_water_new < len(row) else water_old
                water_usage = max(0, water_new - water_old)

            # 3.3 Cột tiêu thụ nước riêng
            if col_water_usage != -1 and 0 <= col_water_usage < len(row):
                val_w = parse_meter_number(row[col_water_usage])
                if val_w > 0:
                    water_usage = val_w
                    if water_old > 0 and (water_new == 0 or water_new <= water_old):
                        water_new = water_old + water_usage
                    elif water_old == 0 and water_new > 0:
                        water_old = max(0, water_new - water_usage)

            tien_dien = elec_usage * don_gia_dien
            tien_nuoc = water_usage * don_gia_nuoc
            row_total = tien_dien + tien_nuoc
            total_amount += row_total

            # Đếm số sinh viên thực tế đang cư trú trong phòng (Hợp đồng ACTIVE hoặc DANG_O)
            student_count = (
                db.query(HopDong)
                .join(Giuong, HopDong.ma_giuong == Giuong.ma_giuong)
                .filter(Giuong.ma_phong == ma_p, HopDong.trang_thai.in_(["ACTIVE", "DANG_O", "CON_HAN"]))
                .count()
            )

            existing = (
                db.query(HoaDon)
                .filter(
                    HoaDon.ma_phong == ma_p,
                    HoaDon.loai_hoa_don == LoaiHoaDon.DIEN_NUOC.value,
                    HoaDon.ky_thanh_toan == thang,
                )
                .first()
            )

            items.append(
                UtilityBillingCandidate(
                    ma_phong=ma_p,
                    so_phong=so_p,
                    toa_nha=toa_p,
                    so_sinh_vien=student_count,
                    chi_so_dien_cu_moi=f"{elec_old} - {elec_new}",
                    so_dien_kwh=elec_usage,
                    chi_so_nuoc_cu_moi=f"{water_old} - {water_new}",
                    so_nuoc_m3=water_usage,
                    tong_tien=row_total,
                    so_dien_cu=elec_old,
                    so_dien_moi=elec_new,
                    so_nuoc_cu=water_old,
                    so_nuoc_moi=water_new,
                    tien_dien=tien_dien,
                    tien_nuoc=tien_nuoc,
                    da_lap_hoa_don=existing is not None,
                )
            )

        return UtilityMeterUploadResponse(
            success=True,
            message=f"Đã đọc và tính toán thành công chỉ số điện nước cho {len(items)} phòng từ file {filename}",
            fileName=filename,
            totalRooms=len(items),
            totalAmount=total_amount,
            items=items,
        )

    @staticmethod
    def generate_utility_template(db: Optional[Session] = None) -> bytes:
        """
        Tạo file Excel mẫu chuẩn nhập chỉ số điện nước KTX, tự động điền danh sách phòng thực tế
        """
        if not HAS_OPENPYXL:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Thư viện openpyxl chưa được cài đặt trên máy chủ để xuất file Excel mẫu.",
            )
        wb = Workbook()
        ws = wb.active
        ws.title = "Chỉ số điện nước"

        headers = [
            "STT",
            "Phòng",
            "Chỉ số điện cũ (kWh)",
            "Chỉ số điện mới (kWh)",
            "Chỉ số nước cũ (m³)",
            "Chỉ số nước mới (m³)",
            "Ghi chú",
        ]
        ws.append(headers)

        if db:
            try:
                rooms = (
                    db.query(Phong)
                    .join(Tang, Phong.ma_tang == Tang.ma_tang)
                    .join(ToaNha, Tang.ma_toa == ToaNha.ma_toa)
                    .order_by(ToaNha.ten_toa, Phong.so_phong)
                    .all()
                )
                for idx, p in enumerate(rooms, start=1):
                    toa_name = p.tang.toa_nha.ten_toa if p.tang and p.tang.toa_nha else "Tòa A1"
                    so_p = p.so_phong if p.so_phong.upper().startswith("P") else f"P{p.so_phong}"
                    ws.append([
                        idx,
                        f"{so_p} - {toa_name}",
                        1000,
                        1050,
                        400,
                        410,
                        p.loai_phong or "Phòng tiêu chuẩn",
                    ])
            except Exception:
                pass
        else:
            # Mẫu dữ liệu mô phỏng
            sample_rooms = [
                ("P201 - Tòa A1", 1000, 1052, 400, 408, "Phòng tiêu chuẩn"),
                ("P202 - Tòa A1", 1020, 1085, 410, 421, "Phòng tiêu chuẩn"),
                ("P203 - Tòa A1", 950, 1015, 380, 392, "Phòng tiêu chuẩn"),
                ("P301 - Tòa A1", 1100, 1170, 450, 465, "Phòng dịch vụ"),
                ("P101 - Tòa B", 880, 940, 350, 360, "Phòng tiêu chuẩn"),
            ]
            for idx, r in enumerate(sample_rooms, start=1):
                ws.append([idx, r[0], r[1], r[2], r[3], r[4], r[5]])

        header_font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="2B85EC", end_color="2B85EC", fill_type="solid")
        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center", vertical="center")

        ws.column_dimensions["A"].width = 8
        ws.column_dimensions["B"].width = 22
        ws.column_dimensions["C"].width = 24
        ws.column_dimensions["D"].width = 24
        ws.column_dimensions["E"].width = 24
        ws.column_dimensions["F"].width = 24
        ws.column_dimensions["G"].width = 20

        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    @staticmethod
    def get_invoices(
        db: Session,
        loai_hoa_don: Optional[str] = None,
        ky_thanh_toan: Optional[str] = None,
        trang_thai: Optional[str] = None,
        msv: Optional[str] = None,
        ma_phong: Optional[str] = None,
    ) -> List[HoaDonResponse]:
        """
        Truy vấn danh sách hóa đơn theo các tiêu chí lọc.
        """
        query = db.query(HoaDon)

        if loai_hoa_don:
            query = query.filter(HoaDon.loai_hoa_don == loai_hoa_don.strip().upper())
        if ky_thanh_toan:
            query = query.filter(HoaDon.ky_thanh_toan == ky_thanh_toan.strip())
        if trang_thai:
            query = query.filter(HoaDon.trang_thai == trang_thai.strip().upper())
        if msv:
            query = query.filter(HoaDon.msv == msv.strip())
        if ma_phong:
            query = query.filter(HoaDon.ma_phong == ma_phong.strip())

        invoices = query.order_by(HoaDon.ngay_tao.desc()).all()

        results: List[HoaDonResponse] = []
        for inv in invoices:
            results.append(
                HoaDonResponse(
                    ma_hoa_don=inv.ma_hoa_don,
                    ma_hop_dong=inv.ma_hop_dong,
                    msv=inv.msv,
                    ho_ten=inv.ho_ten,
                    ma_phong=inv.ma_phong,
                    so_phong=inv.so_phong,
                    loai_hoa_don=inv.loai_hoa_don,
                    ky_thanh_toan=inv.ky_thanh_toan,
                    so_tien=inv.so_tien,
                    ngay_lap=inv.ngay_lap,
                    han_thanh_toan=inv.han_thanh_toan,
                    trang_thai=inv.trang_thai,
                    ghi_chu=inv.ghi_chu,
                    nguoi_tao=inv.nguoi_tao,
                )
            )

        return results

    @staticmethod
    def get_invoice_by_id(
        db: Session,
        ma_hoa_don: str,
    ) -> Optional[HoaDonResponse]:
        """
        Lấy thông tin chi tiết một hóa đơn theo mã.
        """
        if not ma_hoa_don:
            return None
        inv = db.query(HoaDon).filter(HoaDon.ma_hoa_don == ma_hoa_don.strip()).first()
        if not inv:
            return None

        return HoaDonResponse(
            ma_hoa_don=inv.ma_hoa_don,
            ma_hop_dong=inv.ma_hop_dong,
            msv=inv.msv,
            ho_ten=inv.ho_ten,
            ma_phong=inv.ma_phong,
            so_phong=inv.so_phong,
            loai_hoa_don=inv.loai_hoa_don,
            ky_thanh_toan=inv.ky_thanh_toan,
            so_tien=inv.so_tien,
            ngay_lap=inv.ngay_lap,
            han_thanh_toan=inv.han_thanh_toan,
            trang_thai=inv.trang_thai,
            ghi_chu=inv.ghi_chu,
            nguoi_tao=inv.nguoi_tao,
        )


def khoang_ngay_cua_thang(thang: str):
    # "Tháng 09/2026" -> (date(2026,9,1), date(2026,9,30))
    from datetime import date
    mm, yyyy = thang.replace("Tháng ", "").split("/")
    mm, yyyy = int(mm), int(yyyy)
    last = calendar.monthrange(yyyy, mm)[1]
    return date(yyyy, mm, 1), date(yyyy, mm, last)

def lay_so_nguoi_theo_phong(db, thang: str) -> dict:
    dau, cuoi = khoang_ngay_cua_thang(thang)
    rows = db.execute(
        text("""
            SELECT g.ma_phong, COUNT(DISTINCT hd.msv) AS so_nguoi
            FROM hop_dong hd
            JOIN giuong g ON g.ma_giuong = hd.ma_giuong
            WHERE hd.trang_thai = 'ACTIVE'
              AND hd.ngay_bat_dau <= :cuoi_thang
              AND hd.ngay_ket_thuc >= :dau_thang
            GROUP BY g.ma_phong
        """),
        {"dau_thang": dau, "cuoi_thang": cuoi},
    ).all()
    return {ma_phong: n for ma_phong, n in rows}
