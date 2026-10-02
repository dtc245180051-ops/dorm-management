from __future__ import annotations

import datetime
import re
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.invoice import HoaDon, LoaiHoaDon, TrangThaiHoaDon
from app.models.reconciliation import GiaoDichNganHang, TrangThaiDoiSoat
from app.models.dorm import Phong, Giuong
from app.models.contract import HopDong
from app.models.user import SinhVien
from app.schemas.financial import (
    DashboardResponse,
    DashboardKPIs,
    PeriodRevenue,
    RoomTypeStat,
    ReconciliationBreakdown,
    RecentTransactionItem,
    FinancialReportResponse,
    FinancialSummary,
    FinancialReportItem,
)


class FinancialService:
    @classmethod
    def _format_room(cls, db: Session, inv: HoaDon) -> tuple[str, str]:
        """
        Trả về (mã phòng rút gọn Pxxx, loại phòng).
        """
        # Nếu có hợp đồng gắn liền
        if inv.ma_hop_dong:
            hd = db.query(HopDong).filter(HopDong.ma_hop_dong == inv.ma_hop_dong).first()
            if hd and hd.giuong and hd.giuong.phong:
                p = hd.giuong.phong
                loai = p.loai_phong or ("Phòng dịch vụ" if "203" in str(p.so_phong) else "Phòng tiêu chuẩn")
                return f"P{p.so_phong}", loai

        # Nếu có sinh viên
        if inv.msv:
            hd = db.query(HopDong).filter(HopDong.msv == inv.msv, HopDong.trang_thai == "ACTIVE").first()
            if hd and hd.giuong and hd.giuong.phong:
                p = hd.giuong.phong
                loai = p.loai_phong or ("Phòng dịch vụ" if "203" in str(p.so_phong) else "Phòng tiêu chuẩn")
                return f"P{p.so_phong}", loai

        # Thử trích xuất từ so_phong
        raw_phong = inv.so_phong or ""
        m = re.search(r"(\d{3})", raw_phong)
        room_num = m.group(1) if m else "101"
        loai = "Phòng dịch vụ" if room_num == "203" else "Phòng tiêu chuẩn"
        return f"P{room_num}", loai

    @classmethod
    def get_dashboard_data(cls, db: Session) -> DashboardResponse:
        today = datetime.date.today()
        all_invoices = db.query(HoaDon).filter(HoaDon.trang_thai != TrangThaiHoaDon.DA_HUY.value).all()

        total_revenue = 0.0
        collected_revenue = 0.0
        overdue_debt = 0.0

        for inv in all_invoices:
            amount = float(inv.so_tien)
            total_revenue += amount

            # Tìm số tiền đã thanh toán qua hóa đơn hoặc giao dịch
            if inv.trang_thai == TrangThaiHoaDon.DA_THANH_TOAN.value:
                collected_revenue += amount
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
                paid = sum(float(t.so_tien) for t in tx_sum)
                collected_revenue += paid
                remaining = max(0.0, amount - paid)
                if inv.han_thanh_toan and inv.han_thanh_toan < today:
                    overdue_debt += remaining

        total_outstanding = max(0.0, total_revenue - collected_revenue)
        collection_rate = round((collected_revenue / total_revenue * 100.0), 1) if total_revenue > 0 else 100.0

        # Thống kê giao dịch đối soát ngân hàng
        all_txs = db.query(GiaoDichNganHang).all()
        total_tx = len(all_txs)
        auto_matched = sum(1 for t in all_txs if t.trang_thai == TrangThaiDoiSoat.AUTO_MATCHED.value)
        manual_matched = sum(1 for t in all_txs if t.trang_thai in [TrangThaiDoiSoat.MATCHED.value, TrangThaiDoiSoat.MATCHED_MANUALLY.value])
        invalid_syntax = sum(1 for t in all_txs if t.trang_thai == TrangThaiDoiSoat.INVALID_SYNTAX.value)
        partial_paid = sum(1 for t in all_txs if t.trang_thai == TrangThaiDoiSoat.PARTIAL.value)
        pending = sum(1 for t in all_txs if t.trang_thai in [TrangThaiDoiSoat.MANUAL_REQUIRED.value, "PENDING"])

        matched_tx = auto_matched + manual_matched
        unmatched_tx = total_tx - matched_tx
        recon_rate = round((matched_tx / total_tx * 100.0), 1) if total_tx > 0 else 0.0

        kpis = DashboardKPIs(
            totalRevenue=total_revenue,
            collectedRevenue=collected_revenue,
            collectionRate=collection_rate,
            totalOutstanding=total_outstanding,
            overdueDebt=overdue_debt,
            reconciliationRate=recon_rate,
            totalTransactions=total_tx,
            matchedTransactions=matched_tx,
            unmatchedTransactions=unmatched_tx,
        )

        # Xu hướng theo tháng (Monthly Trend)
        period_dict = {}
        for inv in all_invoices:
            p_name = inv.ky_thanh_toan or "Tháng 09/2026"
            if p_name not in period_dict:
                period_dict[p_name] = {
                    "roomFee": 0.0,
                    "utilityFee": 0.0,
                    "totalInvoiced": 0.0,
                    "totalCollected": 0.0,
                }
            amt = float(inv.so_tien)
            period_dict[p_name]["totalInvoiced"] += amt
            if inv.loai_hoa_don == LoaiHoaDon.TIEN_PHONG.value:
                period_dict[p_name]["roomFee"] += amt
            else:
                period_dict[p_name]["utilityFee"] += amt

            if inv.trang_thai == TrangThaiHoaDon.DA_THANH_TOAN.value:
                period_dict[p_name]["totalCollected"] += amt
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
                period_dict[p_name]["totalCollected"] += sum(float(t.so_tien) for t in tx_sum)

        monthly_trend: List[PeriodRevenue] = []
        for period, data in sorted(period_dict.items(), key=lambda x: x[0]):
            outstanding = max(0.0, data["totalInvoiced"] - data["totalCollected"])
            monthly_trend.append(
                PeriodRevenue(
                    period=period,
                    roomFee=data["roomFee"],
                    utilityFee=data["utilityFee"],
                    totalInvoiced=data["totalInvoiced"],
                    totalCollected=data["totalCollected"],
                    outstanding=outstanding,
                )
            )

        # Thống kê theo 2 loại phòng niêm yết chuẩn
        standard_rec = 0.0
        standard_col = 0.0
        service_rec = 0.0
        service_col = 0.0
        standard_count = 0
        service_count = 0

        for inv in all_invoices:
            if inv.loai_hoa_don == LoaiHoaDon.TIEN_PHONG.value:
                room_str, loai = cls._format_room(db, inv)
                amt = float(inv.so_tien)
                is_paid = inv.trang_thai == TrangThaiHoaDon.DA_THANH_TOAN.value

                if "dịch vụ" in loai.lower() or "203" in room_str:
                    service_count += 1
                    service_rec += amt
                    if is_paid:
                        service_col += amt
                else:
                    standard_count += 1
                    standard_rec += amt
                    if is_paid:
                        standard_col += amt

        room_type_stats = [
            RoomTypeStat(
                roomType="Phòng tiêu chuẩn",
                monthlyRate=(standard_rec / standard_count) if standard_count else 0,
                count=standard_count,
                totalReceivable=standard_rec,
                totalCollected=standard_col,
                totalOutstanding=max(0.0, standard_rec - standard_col),
            ),
            RoomTypeStat(
                roomType="Phòng dịch vụ",
                monthlyRate=(service_rec / service_count) if service_count else 0,
                count=service_count,
                totalReceivable=service_rec,
                totalCollected=service_col,
                totalOutstanding=max(0.0, service_rec - service_col),
            ),
        ]

        recon_breakdown = ReconciliationBreakdown(
            autoMatched=auto_matched,
            manualMatched=manual_matched,
            invalidSyntax=invalid_syntax,
            partialPaid=partial_paid,
            pending=pending,
        )

        # 5 Giao dịch ngân hàng mới nhất
        recent_tx_models = (
            db.query(GiaoDichNganHang)
            .order_by(GiaoDichNganHang.ngay_giao_dich.desc())
            .limit(5)
            .all()
        )
        recent_txs: List[RecentTransactionItem] = []
        for t in recent_tx_models:
            st_text = "Đã khớp tự động" if t.trang_thai == TrangThaiDoiSoat.AUTO_MATCHED.value else (
                "Đã khớp" if t.trang_thai in [TrangThaiDoiSoat.MATCHED.value, TrangThaiDoiSoat.MATCHED_MANUALLY.value] else (
                    "Sai cú pháp" if t.trang_thai == TrangThaiDoiSoat.INVALID_SYNTAX.value else (
                        "Chuyển thiếu" if t.trang_thai == TrangThaiDoiSoat.PARTIAL.value else "Chờ đối soát"
                    )
                )
            )
            d_str = t.ngay_giao_dich.strftime("%d/%m/%Y %H:%M") if t.ngay_giao_dich else ""
            recent_txs.append(
                RecentTransactionItem(
                    id=t.ma_giao_dich_ngan_hang,
                    date=d_str,
                    amount=float(t.so_tien),
                    content=t.noi_dung_chuyen_khoan,
                    status=t.trang_thai,
                    statusText=st_text,
                    studentId=t.msv,
                    invoiceId=t.ma_hoa_don,
                )
            )

        return DashboardResponse(
            kpis=kpis,
            monthlyTrend=monthly_trend,
            roomTypeStats=room_type_stats,
            reconciliationBreakdown=recon_breakdown,
            recentTransactions=recent_txs,
        )

    @classmethod
    def get_financial_report(
        cls,
        db: Session,
        thang: Optional[str] = None,
        loai_hoa_don: Optional[str] = None,
        trang_thai: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> FinancialReportResponse:
        today = datetime.date.today()
        query = db.query(HoaDon).filter(HoaDon.trang_thai != TrangThaiHoaDon.DA_HUY.value)

        if thang and thang.strip() and thang != "ALL":
            query = query.filter(HoaDon.ky_thanh_toan == thang.strip())
        if loai_hoa_don and loai_hoa_don.strip() and loai_hoa_don != "ALL":
            query = query.filter(HoaDon.loai_hoa_don == loai_hoa_don.strip())
        if trang_thai and trang_thai.strip() and trang_thai != "ALL":
            if trang_thai == "PAID":
                query = query.filter(HoaDon.trang_thai == TrangThaiHoaDon.DA_THANH_TOAN.value)
            elif trang_thai == "UNPAID":
                query = query.filter(HoaDon.trang_thai != TrangThaiHoaDon.DA_THANH_TOAN.value)
            elif trang_thai == "OVERDUE":
                query = query.filter(
                    HoaDon.trang_thai != TrangThaiHoaDon.DA_THANH_TOAN.value,
                    HoaDon.han_thanh_toan < today,
                )

        if keyword and keyword.strip():
            kw = f"%{keyword.strip()}%"
            query = query.filter(
                or_(
                    HoaDon.ma_hoa_don.ilike(kw),
                    HoaDon.msv.ilike(kw),
                    HoaDon.ho_ten.ilike(kw),
                    HoaDon.so_phong.ilike(kw),
                )
            )

        invoices = query.order_by(HoaDon.ngay_lap.desc(), HoaDon.ma_hoa_don.desc()).all()

        items: List[FinancialReportItem] = []
        tot_inv = 0.0
        tot_col = 0.0
        tot_overdue = 0.0
        room_std = 0.0
        room_svc = 0.0
        util_rev = 0.0
        paid_count = 0

        for inv in invoices:
            room_str, loai_phong = cls._format_room(db, inv)
            amt = float(inv.so_tien)
            tot_inv += amt

            # Tra cứu giao dịch đã khớp nếu có
            tx = (
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
                .first()
            )
            matched_tx_id = tx.ma_giao_dich_ngan_hang if tx else None

            if inv.trang_thai == TrangThaiHoaDon.DA_THANH_TOAN.value:
                paid = amt
                remaining = 0.0
                st_code = "PAID"
                st_text = "Đã hoàn tất"
                paid_count += 1
            else:
                paid = float(tx.so_tien) if tx else 0.0
                remaining = max(0.0, amt - paid)
                if inv.han_thanh_toan and inv.han_thanh_toan < today:
                    st_code = "OVERDUE"
                    st_text = "Quá hạn"
                    tot_overdue += remaining
                elif paid > 0:
                    st_code = "PARTIAL"
                    st_text = "Chuyển thiếu"
                else:
                    st_code = "UNPAID"
                    st_text = "Chưa thanh toán"

            tot_col += paid

            # Doanh thu theo khoản mục
            if inv.loai_hoa_don == LoaiHoaDon.TIEN_PHONG.value:
                fee_label = "Tiền phòng"
                if "dịch vụ" in loai_phong.lower() or "203" in room_str:
                    room_svc += amt
                else:
                    room_std += amt
            else:
                fee_label = "Điện nước"
                util_rev += amt

            issue_str = inv.ngay_lap.strftime("%d/%m/%Y") if inv.ngay_lap else ""
            due_str = inv.han_thanh_toan.strftime("%d/%m/%Y") if inv.han_thanh_toan else ""

            items.append(
                FinancialReportItem(
                    invoiceId=inv.ma_hoa_don,
                    studentId=inv.msv,
                    studentName=inv.ho_ten or (inv.msv or "--"),
                    room=room_str,
                    roomType=loai_phong,
                    feeType=fee_label,
                    period=inv.ky_thanh_toan or "Tháng 09/2026",
                    amount=amt,
                    paid=paid,
                    remaining=remaining,
                    status=st_code,
                    statusText=st_text,
                    issueDate=issue_str,
                    dueDate=due_str,
                    matchedTxId=matched_tx_id,
                )
            )

        tot_out = max(0.0, tot_inv - tot_col)
        rate = round((tot_col / tot_inv * 100.0), 1) if tot_inv > 0 else 100.0

        summary = FinancialSummary(
            totalInvoiced=tot_inv,
            totalCollected=tot_col,
            totalOutstanding=tot_out,
            totalOverdue=tot_overdue,
            roomRevenueStandard=room_std,
            roomRevenueService=room_svc,
            utilityRevenue=util_rev,
            collectionRate=rate,
            invoiceCount=len(invoices),
            paidInvoiceCount=paid_count,
        )

        return FinancialReportResponse(summary=summary, items=items)
