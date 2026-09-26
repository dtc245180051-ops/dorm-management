from __future__ import annotations

import datetime
import uuid
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.contract import HopDong, Phi
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
)

DEFAULT_DEMO_UTILITY_ROOMS = [
    {
        "ma_phong": "P102",
        "so_phong": "102",
        "toa_nha": "A1",
        "so_sinh_vien": 4,
        "chi_so_dien_cu_moi": "1240 - 1340",
        "so_dien_kwh": 100,
        "chi_so_nuoc_cu_moi": "450 - 460",
        "so_nuoc_m3": 10,
        "tong_tien": 450000.0,
    },
    {
        "ma_phong": "P103",
        "so_phong": "103",
        "toa_nha": "A1",
        "so_sinh_vien": 4,
        "chi_so_dien_cu_moi": "2100 - 2215",
        "so_dien_kwh": 115,
        "chi_so_nuoc_cu_moi": "610 - 622",
        "so_nuoc_m3": 12,
        "tong_tien": 525000.0,
    },
    {
        "ma_phong": "P201",
        "so_phong": "201",
        "toa_nha": "A2",
        "so_sinh_vien": 4,
        "chi_so_dien_cu_moi": "0890 - 0985",
        "so_dien_kwh": 95,
        "chi_so_nuoc_cu_moi": "320 - 328",
        "so_nuoc_m3": 8,
        "tong_tien": 405000.0,
    },
    {
        "ma_phong": "P205",
        "so_phong": "205",
        "toa_nha": "A2",
        "so_sinh_vien": 4,
        "chi_so_dien_cu_moi": "1540 - 1670",
        "so_dien_kwh": 130,
        "chi_so_nuoc_cu_moi": "540 - 554",
        "so_nuoc_m3": 14,
        "tong_tien": 600000.0,
    },
]


class InvoiceService:
    @staticmethod
    def get_room_billing_candidates(
        db: Session,
        ky_thanh_toan: str = "Năm học 2026 – 2027",
        don_gia_thang: float = 600000.0,
        thoi_gian_o_thang: int = 11,
        ap_dung: Optional[str] = None,
    ) -> List[RoomBillingCandidate]:
        """
        Lấy danh sách sinh viên nội trú cần lập hóa đơn tiền phòng theo năm học/kỳ, đơn giá, thời gian ở và tòa nhà áp dụng.
        Chỉ lấy từ các hợp đồng ACTIVE thực sự tồn tại trong CSDL.
        Nếu CSDL chưa có hợp đồng hiệu lực, trả về danh sách rỗng (không tự tạo hợp đồng giả).
        """
        amount = don_gia_thang * thoi_gian_o_thang

        # 1. Truy vấn các hợp đồng đang hiệu lực từ CSDL
        query = db.query(HopDong).filter(HopDong.trang_thai == "ACTIVE")
        active_contracts = query.all()

        # Lọc theo tòa nhà áp dụng (ví dụ: "Sinh viên tòa A1", "Tòa A2", ...)
        if ap_dung and "tòa" in ap_dung.lower():
            import re
            m = re.search(r"A\d+", ap_dung, re.IGNORECASE)
            if m:
                target_building = m.group(0).upper()
                filtered = []
                for hd in active_contracts:
                    building_str = ""
                    if hd.giuong and hd.giuong.phong and hd.giuong.phong.tang and hd.giuong.phong.tang.toa_nha:
                        toa = hd.giuong.phong.tang.toa_nha
                        building_str = f"{toa.ma_toa} {toa.ten_toa}".upper()
                    if target_building in building_str:
                        filtered.append(hd)
                active_contracts = filtered

        candidates: List[RoomBillingCandidate] = []

        for hd in active_contracts:
            sv = hd.sinh_vien
            nd = sv.nguoi_dung if sv else None
            ho_ten = nd.ho_ten if nd else (sv.msv if sv else hd.msv)

            # Tìm thông tin phòng
            phong_str = "Chưa xếp phòng"
            ma_phong_val = None
            if hd.giuong and hd.giuong.phong:
                p = hd.giuong.phong
                ma_phong_val = p.ma_phong
                t = p.tang.toa_nha.ten_toa if p.tang and p.tang.toa_nha else ""
                phong_str = f"P{p.so_phong} - {t}".strip(" -")

            # Định dạng thời hạn hợp đồng
            start_str = hd.ngay_bat_dau.strftime("%d/%m/%Y") if hd.ngay_bat_dau else ""
            end_str = hd.ngay_ket_thuc.strftime("%d/%m/%Y") if hd.ngay_ket_thuc else "Hiện tại"
            term_str = f"{start_str} - {end_str}".strip(" -")

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

            candidates.append(
                RoomBillingCandidate(
                    msv=hd.msv,
                    ho_ten=ho_ten,
                    phong=phong_str,
                    ma_phong=ma_phong_val,
                    ma_hop_dong=hd.ma_hop_dong,
                    thoi_han_hop_dong=term_str,
                    thoi_gian_o_thang=thoi_gian_o_thang,
                    don_gia_thang=don_gia_thang,
                    so_tien=amount,
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

        # Lọc theo tòa nhà áp dụng nếu không truyền danh sách MSV cụ thể
        if not request.danh_sach_msv and request.ap_dung and "tòa" in request.ap_dung.lower():
            import re
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

        total_amount_calculated = request.don_gia_thang * request.thoi_gian_o_thang

        try:
            for hd in valid_contracts:
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

                # Trích xuất thông tin người dùng và phòng từ quan hệ hợp đồng
                sv = hd.sinh_vien
                nd = sv.nguoi_dung if sv else None
                ho_ten = nd.ho_ten if nd else (sv.msv if sv else hd.msv)

                phong_str = "Chưa xếp phòng"
                ma_phong_val = None
                if hd.giuong and hd.giuong.phong:
                    p = hd.giuong.phong
                    ma_phong_val = p.ma_phong
                    t = p.tang.toa_nha.ten_toa if p.tang and p.tang.toa_nha else ""
                    phong_str = f"P{p.so_phong} - {t}".strip(" -")

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
                    so_tien=total_amount_calculated,
                    ngay_lap=datetime.date.today(),
                    han_thanh_toan=request.han_thanh_toan,
                    trang_thai=TrangThaiHoaDon.CHUA_THANH_TOAN.value,
                    ghi_chu=request.ghi_chu or f"Hóa đơn tiền phòng {request.ky_thanh_toan} ({phong_str})",
                    nguoi_tao=creator_username,
                    ngay_tao=datetime.datetime.now(),
                )
                db.add(new_invoice)

                # 4. Tạo bản ghi vào bảng phi hiện có gắn với mã hợp đồng thực tế
                phi_rec = Phi(
                    ma_phi=f"P-{unique_suffix}"[:20],
                    ma_hop_dong=hd.ma_hop_dong,
                    loai_phi="TIEN_PHONG",
                    so_tien=total_amount_calculated,
                    han_nop=request.han_thanh_toan,
                )
                db.add(phi_rec)

                created_invoices.append(new_invoice)

            if not created_invoices and already_issued_info:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Tất cả hợp đồng được chọn đã được phát hành hóa đơn cho {request.ky_thanh_toan} trước đó ({', '.join(already_issued_info)}). Không thể phát hành trùng!",
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
        # Truy vấn phòng từ CSDL
        rooms = db.query(Phong).all()
        candidates: List[UtilityBillingCandidate] = []

        if rooms:
            for r in rooms:
                toa_ten = r.tang.toa_nha.ten_toa if r.tang and r.tang.toa_nha else "KTX"
                # Đếm số sinh viên đang ở trong phòng
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

                candidates.append(
                    UtilityBillingCandidate(
                        ma_phong=r.ma_phong,
                        so_phong=r.so_phong,
                        toa_nha=toa_ten,
                        so_sinh_vien=student_count,
                        chi_so_dien_cu_moi="1000 - 1100",
                        so_dien_kwh=100,
                        chi_so_nuoc_cu_moi="400 - 410",
                        so_nuoc_m3=10,
                        tong_tien=450000.0,
                        da_lap_hoa_don=existing is not None,
                    )
                )
        else:
            # Fallback danh sách phòng mẫu chuẩn Figma
            for item in DEFAULT_DEMO_UTILITY_ROOMS:
                existing = (
                    db.query(HoaDon)
                    .filter(
                        HoaDon.ma_phong == item["ma_phong"],
                        HoaDon.loai_hoa_don == LoaiHoaDon.DIEN_NUOC.value,
                        HoaDon.ky_thanh_toan == thang,
                    )
                    .first()
                )
                candidates.append(
                    UtilityBillingCandidate(
                        ma_phong=item["ma_phong"],
                        so_phong=item["so_phong"],
                        toa_nha=item["toa_nha"],
                        so_sinh_vien=item["so_sinh_vien"],
                        chi_so_dien_cu_moi=item["chi_so_dien_cu_moi"],
                        so_dien_kwh=item["so_dien_kwh"],
                        chi_so_nuoc_cu_moi=item["chi_so_nuoc_cu_moi"],
                        so_nuoc_m3=item["so_nuoc_m3"],
                        tong_tien=item["tong_tien"],
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

        targets = all_candidates
        if request.danh_sach_phong:
            selected_set = set(request.danh_sach_phong)
            targets = [c for c in all_candidates if c.ma_phong in selected_set]
            if not targets:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Không tìm thấy phòng nào phù hợp với danh sách mã phòng đã chỉ định",
                )

        created_invoices: List[HoaDon] = []
        already_issued_rooms: List[str] = []

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
            # Nếu có số liệu tiêu thụ cụ thể thì: số điện * đơn giá điện + số nước * đơn giá nước
            calculated_amount = (c.so_dien_kwh * request.don_gia_dien) + (c.so_nuoc_m3 * request.don_gia_nuoc)
            if calculated_amount <= 0:
                calculated_amount = c.tong_tien

            new_invoice = HoaDon(
                ma_hoa_don=ma_hd,
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
                ghi_chu=request.ghi_chu or f"Hóa đơn tiền điện nước {request.thang} (Phòng {c.so_phong} - {c.toa_nha})",
                nguoi_tao=creator_username,
                ngay_tao=datetime.datetime.now(),
            )
            db.add(new_invoice)
            created_invoices.append(new_invoice)

        if not created_invoices and already_issued_rooms:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tất cả các phòng được chọn đã được phát hành hóa đơn điện nước cho {request.thang} trước đó ({', '.join(already_issued_rooms)}). Không thể phát hành trùng!",
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
        )

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
            query = query.filter(HoaDon.loai_hoa_don == loai_hoa_don)
        if ky_thanh_toan:
            query = query.filter(HoaDon.ky_thanh_toan == ky_thanh_toan)
        if trang_thai:
            query = query.filter(HoaDon.trang_thai == trang_thai)
        if msv:
            query = query.filter(HoaDon.msv == msv)
        if ma_phong:
            query = query.filter(HoaDon.ma_phong == ma_phong)

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
        inv = db.query(HoaDon).filter(HoaDon.ma_hoa_don == ma_hoa_don).first()
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

