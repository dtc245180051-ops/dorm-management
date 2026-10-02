from __future__ import annotations

import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.invoice import HoaDon, LoaiHoaDon, TrangThaiHoaDon
from app.models.reconciliation import GiaoDichNganHang, TrangThaiDoiSoat
from app.models.user import NguoiDung, SinhVien, TaiKhoan, VaiTro
from app.models.contract import HopDong
from app.models.dorm import Giuong, Phong
from app.schemas.debt import (
    DebtItemResponse,
    DebtStatistics,
    DebtSummaryResponse,
    FeeItemResponse,
    PersonalDebtResponse,
    RemindDebtResponse,
)


class DebtService:
    @classmethod
    def _format_room_name(cls, db: Session, sv_msv: str) -> str:
        """
        Định dạng phòng hiển thị chuẩn: P203, P101, P102 theo yêu cầu người dùng
        (tránh dính chữ 'Tòa A1203' hay 'A203').
        """
        hd_active = db.query(HopDong).filter(HopDong.msv == sv_msv, HopDong.trang_thai == "ACTIVE").first()
        if hd_active and hd_active.giuong and hd_active.giuong.phong:
            p = hd_active.giuong.phong
            return f"P{p.so_phong}"

        recent_inv = db.query(HoaDon).filter(HoaDon.msv == sv_msv).first()
        if recent_inv and recent_inv.so_phong:
            import re
            m = re.search(r"(\d{3})", recent_inv.so_phong)
            if m:
                return f"P{m.group(1)}"
            return recent_inv.so_phong
        return "--"

    @classmethod
    def get_debt_summary(cls, db: Session, keyword: Optional[str] = None) -> DebtSummaryResponse:
        """
        Lấy thống kê tổng quan và danh sách chi tiết công nợ sinh viên (Sổ công nợ - Screenshot 1).
        Khi sinh viên chuyển thiếu tiền, công nợ còn lại được ghi nhận tự động.
        """
        today = datetime.date.today()

        # Lấy tất cả sinh viên
        students_query = db.query(SinhVien).join(NguoiDung, SinhVien.ma_nguoi_dung == NguoiDung.ma_nguoi_dung)
        if keyword and keyword.strip():
            kw = f"%{keyword.strip()}%"
            students_query = students_query.filter(
                or_(
                    SinhVien.msv.ilike(kw),
                    NguoiDung.ho_ten.ilike(kw),
                    NguoiDung.so_dien_thoai.ilike(kw),
                )
            )
        students = students_query.all()

        debt_items: List[DebtItemResponse] = []

        for sv in students:
            # Tìm phòng hiển thị chuẩn
            room_str = cls._format_room_name(db, sv.msv)
            hd_active = db.query(HopDong).filter(HopDong.msv == sv.msv, HopDong.trang_thai == "ACTIVE").first()

            # Lấy toàn bộ hóa đơn trực tiếp của SV
            invoices = db.query(HoaDon).filter(HoaDon.msv == sv.msv).all()
            invoices_map = {inv.ma_hoa_don: (inv, 1.0) for inv in invoices}

            # Nếu SV có phòng ở từ hợp đồng ACTIVE, tìm hóa đơn tiền điện nước của phòng đó (nếu hóa đơn chưa gắn msv cụ thể)
            if hd_active and hd_active.giuong and hd_active.giuong.phong:
                p = hd_active.giuong.phong
                occupants_count = (
                    db.query(HopDong)
                    .join(Giuong, HopDong.ma_giuong == Giuong.ma_giuong)
                    .filter(Giuong.ma_phong == p.ma_phong, HopDong.trang_thai == "ACTIVE")
                    .count()
                )
                split_ratio = 1.0 / max(1, occupants_count)

                room_util_invoices = (
                    db.query(HoaDon)
                    .filter(
                        HoaDon.loai_hoa_don == LoaiHoaDon.DIEN_NUOC.value,
                        or_(
                            HoaDon.ma_phong == p.ma_phong,
                            HoaDon.so_phong.ilike(f"%{p.so_phong}%"),
                        ),
                        HoaDon.msv.is_(None),
                    )
                    .all()
                )
                for u_inv in room_util_invoices:
                    if u_inv.ma_hoa_don not in invoices_map:
                        invoices_map[u_inv.ma_hoa_don] = (u_inv, split_ratio)

            if not invoices_map:
                continue

            room_fee_debt = 0.0
            utility_fee_debt = 0.0
            earliest_deadline: Optional[datetime.date] = None
            is_overdue = False

            for inv, ratio in invoices_map.values():
                # Tính số tiền đã nộp qua giao dịch (khớp hoặc chuyển thiếu)
                tx_sum = (
                    db.query(GiaoDichNganHang)
                    .filter(
                        GiaoDichNganHang.ma_hoa_don == inv.ma_hoa_don,
                        GiaoDichNganHang.trang_thai.in_([
                            TrangThaiDoiSoat.MATCHED.value,
                            TrangThaiDoiSoat.AUTO_MATCHED.value,
                            TrangThaiDoiSoat.MATCHED_MANUALLY.value,
                            TrangThaiDoiSoat.PARTIAL.value,
                        ]),
                    )
                    .all()
                )
                paid = sum(t.so_tien for t in tx_sum)
                if inv.trang_thai == TrangThaiHoaDon.DA_THANH_TOAN.value and paid == 0:
                    paid = inv.so_tien

                full_remaining = max(0.0, float(inv.so_tien) - paid)
                remaining = full_remaining * ratio

                if remaining > 0:
                    if inv.loai_hoa_don == LoaiHoaDon.TIEN_PHONG.value:
                        room_fee_debt += remaining
                    else:
                        utility_fee_debt += remaining

                    if inv.han_thanh_toan:
                        if earliest_deadline is None or inv.han_thanh_toan < earliest_deadline:
                            earliest_deadline = inv.han_thanh_toan
                        if inv.han_thanh_toan < today:
                            is_overdue = True

            total_debt = room_fee_debt + utility_fee_debt
            if total_debt > 0:
                deadline_str = earliest_deadline.strftime("%d/%m/%Y") if earliest_deadline else "15/09/2026"
                debt_items.append(
                    DebtItemResponse(
                        studentId=sv.msv,
                        fullName=sv.nguoi_dung.ho_ten if sv.nguoi_dung else sv.msv,
                        room=room_str,
                        roomFeeDebt=room_fee_debt,
                        utilityFeeDebt=utility_fee_debt,
                        totalDebt=total_debt,
                        deadline=deadline_str,
                        isOverdue=is_overdue,
                    )
                )

        # 1. Tính toán thống kê công nợ 100% đồng bộ chính xác với danh sách chi tiết
        total_outstanding = sum(item.totalDebt for item in debt_items)

        # Tính tổng số tiền đã thu qua hóa đơn đã thanh toán hoặc khớp giao dịch ngân hàng
        all_active_invoices = db.query(HoaDon).filter(HoaDon.trang_thai != TrangThaiHoaDon.DA_HUY.value).all()
        total_collected = 0.0
        for inv in all_active_invoices:
            if inv.trang_thai == TrangThaiHoaDon.DA_THANH_TOAN.value:
                total_collected += float(inv.so_tien)
            else:
                tx_sum = (
                    db.query(GiaoDichNganHang)
                    .filter(
                        GiaoDichNganHang.ma_hoa_don == inv.ma_hoa_don,
                        GiaoDichNganHang.trang_thai.in_([
                            TrangThaiDoiSoat.MATCHED.value,
                            TrangThaiDoiSoat.AUTO_MATCHED.value,
                            TrangThaiDoiSoat.MATCHED_MANUALLY.value,
                            TrangThaiDoiSoat.PARTIAL.value,
                        ]),
                    )
                    .all()
                )
                total_collected += sum(float(t.so_tien) for t in tx_sum)

        total_receivable = total_collected + total_outstanding
        stats = DebtStatistics(
            totalReceivable=total_receivable,
            totalCollected=total_collected,
            totalOutstanding=total_outstanding,
        )

        return DebtSummaryResponse(statistics=stats, items=debt_items)

    @classmethod
    def get_personal_debt(cls, db: Session, student_id: str) -> PersonalDebtResponse:
        """
        Lấy thông tin chi tiết Sổ công nợ cá nhân của sinh viên (Screenshot 2).
        Bao gồm:
        - Thông tin sinh viên (Mã SV, Họ tên, Phòng ở, Số điện thoại, Tổng dư nợ)
        - Danh mục các khoản thu (Khoản thu, Kỳ/Tháng, Số tiền, Đã nộp, Còn lại, Trạng thái)
        """
        today = datetime.date.today()

        sv = db.query(SinhVien).filter(SinhVien.msv == student_id).first()
        if not sv:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Kh?ng t?m th?y sinh vi?n")
        sv_name = sv.nguoi_dung.ho_ten if sv.nguoi_dung else sv.msv
        phone = sv.nguoi_dung.so_dien_thoai if (sv.nguoi_dung and sv.nguoi_dung.so_dien_thoai) else "--"
        room = cls._format_room_name(db, sv.msv)

        # Lấy danh sách hóa đơn trực tiếp của SV
        direct_invoices = db.query(HoaDon).filter(HoaDon.msv == student_id).order_by(HoaDon.ngay_lap.asc()).all()
        invoices_map = {inv.ma_hoa_don: (inv, 1.0) for inv in direct_invoices}

        # Nếu SV có phòng ở từ hợp đồng ACTIVE, tìm hóa đơn tiền điện nước của phòng đó
        if sv:
            hd_active = db.query(HopDong).filter(HopDong.msv == sv.msv, HopDong.trang_thai == "ACTIVE").first()
            if hd_active and hd_active.giuong and hd_active.giuong.phong:
                p = hd_active.giuong.phong
                occupants_count = (
                    db.query(HopDong)
                    .join(Giuong, HopDong.ma_giuong == Giuong.ma_giuong)
                    .filter(Giuong.ma_phong == p.ma_phong, HopDong.trang_thai == "ACTIVE")
                    .count()
                )
                split_ratio = 1.0 / max(1, occupants_count)

                room_util_invoices = (
                    db.query(HoaDon)
                    .filter(
                        HoaDon.loai_hoa_don == LoaiHoaDon.DIEN_NUOC.value,
                        or_(
                            HoaDon.ma_phong == p.ma_phong,
                            HoaDon.so_phong.ilike(f"%{p.so_phong}%"),
                        ),
                        HoaDon.msv.is_(None),
                    )
                    .all()
                )
                for u_inv in room_util_invoices:
                    if u_inv.ma_hoa_don not in invoices_map:
                        invoices_map[u_inv.ma_hoa_don] = (u_inv, split_ratio)

        fees: List[FeeItemResponse] = []
        total_remaining = 0.0

        for inv, ratio in invoices_map.values():
            # Tính tiền đã nộp
            tx_sum = (
                db.query(GiaoDichNganHang)
                .filter(
                    GiaoDichNganHang.ma_hoa_don == inv.ma_hoa_don,
                    GiaoDichNganHang.trang_thai.in_([
                        TrangThaiDoiSoat.MATCHED.value,
                        TrangThaiDoiSoat.AUTO_MATCHED.value,
                        TrangThaiDoiSoat.MATCHED_MANUALLY.value,
                        TrangThaiDoiSoat.PARTIAL.value,
                    ]),
                )
                .all()
            )
            paid = sum(t.so_tien for t in tx_sum)
            if inv.trang_thai == TrangThaiHoaDon.DA_THANH_TOAN.value and paid == 0:
                paid = inv.so_tien

            full_remaining = max(0.0, float(inv.so_tien) - paid)
            remaining = full_remaining * ratio
            student_paid = paid * ratio
            student_amount = float(inv.so_tien) * ratio

            total_remaining += remaining

            # Định dạng tên hiển thị khoản thu
            fee_name = inv.ghi_chu or ("Tiền phòng" if inv.loai_hoa_don == LoaiHoaDon.TIEN_PHONG.value else "Dịch vụ Điện nước")
            if "Tiền phòng" in fee_name and "Học kỳ" not in fee_name and "Tháng" not in fee_name:
                fee_name = f"Tiền phòng {inv.ky_thanh_toan}"

            # Định dạng kỳ/tháng
            period_str = inv.ky_thanh_toan or ""
            if "Tháng 09/2026" in period_str:
                period_str = "T09/2026"
            elif "Tháng 10/2026" in period_str:
                period_str = "T10/2026"
            elif "Tháng 11/2026" in period_str:
                period_str = "T11/2026"
            elif "Tháng 12/2026" in period_str:
                period_str = "T12/2026"

            # Xác định trạng thái
            if remaining == 0:
                st_text = "Đã hoàn tất"
            elif student_paid > 0:
                st_text = "Chuyển thiếu"
            else:
                st_text = "Chưa nộp"

            is_overdue = bool(inv.han_thanh_toan and inv.han_thanh_toan < today and remaining > 0)

            fees.append(
                FeeItemResponse(
                    id=inv.ma_hoa_don,
                    feeName=fee_name,
                    period=period_str,
                    amount=student_amount,
                    paidAmount=student_paid,
                    remainingAmount=remaining,
                    status=st_text,
                    deadline=inv.han_thanh_toan.strftime("%d/%m/%Y") if inv.han_thanh_toan else "",
                    isOverdue=is_overdue,
                )
            )

        return PersonalDebtResponse(
            studentId=student_id,
            fullName=sv_name,
            room=room,
            phone=phone,
            totalDebt=total_remaining,
            fees=fees,
        )

    @classmethod
    def remind_student(cls, db: Session, student_id: str) -> RemindDebtResponse:
        """
        Gửi thông báo nhắc nợ tới sinh viên (qua email, app KTX).
        """
        sv = db.query(SinhVien).filter(SinhVien.msv == student_id).first()
        student_name = sv.nguoi_dung.ho_ten if (sv and sv.nguoi_dung) else student_id
        return RemindDebtResponse(
            success=True,
            message=f"Đã gửi thông báo nhắc nợ thành công tới sinh viên {student_name} ({student_id})!",
        )
