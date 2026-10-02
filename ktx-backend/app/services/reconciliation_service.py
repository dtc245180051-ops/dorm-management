from __future__ import annotations

import datetime
import math
import re
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import and_, desc, func, or_
from sqlalchemy.orm import Session

from app.models.contract import HopDong
from app.models.debt import SoCongNo
from app.models.dorm import Phong
from app.models.invoice import HoaDon, LoaiHoaDon, TrangThaiHoaDon
from app.models.reconciliation import GiaoDichNganHang, TrangThaiDoiSoat
from app.models.user import NguoiDung, SinhVien
from app.schemas.reconciliation import (
    ManualMatchResponse,
    ReconciliationItemResponse,
    ReconciliationListResponse,
    StatementUploadResponse,
    StudentInvoiceItem,
    StudentSearchItem,
    TransactionDetailResponse,
    TransactionStatistics,
    UnpaidInvoiceItem,
)


class ReconciliationService:
    @staticmethod
    def _format_datetime(dt: Optional[datetime.datetime]) -> str:
        if not dt:
            return ""
        return dt.strftime("%d/%m %H:%M")

    @staticmethod
    def parse_transfer_syntax(content: Optional[str]) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Phân tích cú pháp nội dung chuyển khoản theo đúng quy định:
        1. Tiền phòng: Bắt buộc cú pháp 'TP <mã sinh viên>' (hoặc 'TIEN PHONG <mã sinh viên>', 'TIEN PHÒNG <mã sinh viên>')
           - Trả về ('TIEN_PHONG', student_code, None)
        2. Tiền điện nước: Bắt buộc cú pháp 'DN <số phòng>' (hoặc 'DIEN NUOC <số phòng>', 'DIENNUOC <số phòng>', 'TIEN NUOC <số phòng>')
           - Trả về ('DIEN_NUOC', None, room_code)
        3. Sai cú pháp: Các trường hợp còn lại
           - Trả về (None, None, None)
        """
        if not content:
            return None, None, None

        raw = content.strip()

        # Regex tiền phòng: bắt đầu hoặc có từ khóa TP / TIEN PHONG / TIEN PHÒNG rồi đến mã sinh viên
        pattern_room = re.compile(
            r"^\s*(?:TP|TIEN\s*PH[OÒ]NG)\s*[:\-]?(?:\s*|\b)([A-Za-z0-9]+)",
            re.IGNORECASE,
        )
        m_tp = pattern_room.search(raw)
        if m_tp:
            code = m_tp.group(1).strip().upper()
            # Mã SV phải có ít nhất 1 chữ số và độ dài >= 4
            if any(c.isdigit() for c in code) and len(code) >= 4:
                return "TIEN_PHONG", code, None

        # Regex tiền điện nước: bắt đầu hoặc có từ khóa DN / DIEN NUOC / DIENNUOC / TIEN NUOC rồi đến số phòng
        pattern_util = re.compile(
            r"^\s*(?:DN|DIEN\s*NUOC|DIENNUOC|TIEN\s*NUOC|TIEN\s*DIEN(?:\s*NUOC)?)\s*[:\-]?(?:\s*|\b)([A-Za-z0-9_\-]+)",
            re.IGNORECASE,
        )
        m_dn = pattern_util.search(raw)
        if m_dn:
            room = m_dn.group(1).strip()
            # Số phòng không được là các từ dừng (stopwords)
            if room.upper() not in ["TIEN", "NUOC", "DIEN", "KTX", "NOP"]:
                return "DIEN_NUOC", None, room

        return None, None, None

    @staticmethod
    def parse_student_code(content: Optional[str]) -> Optional[str]:
        """
        Helper trích xuất mã SV nếu có từ nội dung chuyển khoản
        """
        fee_type, code, _ = ReconciliationService.parse_transfer_syntax(content)
        if fee_type == "TIEN_PHONG" and code:
            return code
        if not content:
            return None
        match = re.search(r'\b(DTC\d+|SV\d+)\b', content.strip(), re.IGNORECASE)
        if match:
            return match.group(1).upper()
        return None

    @staticmethod
    def is_room_match(target_room: Optional[str], ma_phong: Optional[str], so_phong: Optional[str]) -> bool:
        """
        Kiểm tra độ trùng khớp giữa phòng trong nội dung CK (ví dụ: 'P203', '203', 'P36-A2')
        với thông tin phòng của hóa đơn (ma_phong: 'A203', 'P36_A2'; so_phong: '203 - Tòa A1', 'P36-A2').
        Quy tắc:
        - Bỏ qua ký tự đặc biệt, so sánh không phân biệt hoa thường.
        - Khớp trọn bộ danh sách số (ví dụ: 'P203' -> ['203'] == 'A203' -> ['203']).
        - Hỗ trợ số phòng 3 chữ số (ví dụ: '203', '101', '102') khớp tiền tố của '203 - Tòa A1'.
        - Tránh khớp sai giữa các phòng khác tòa (ví dụ: 'P36-A8' KHÔNG khớp 'P36-A2').
        """
        if not target_room:
            return False

        t_clean = re.sub(r"[^a-zA-Z0-9]", "", target_room).lower()
        m_clean = re.sub(r"[^a-zA-Z0-9]", "", ma_phong or "").lower()
        s_clean = re.sub(r"[^a-zA-Z0-9]", "", so_phong or "").lower()

        # 1. Khớp chính xác hoàn toàn chuỗi chuẩn hóa
        if t_clean and (t_clean == m_clean or t_clean == s_clean):
            return True

        d_target = re.findall(r"\d+", target_room)
        d_ma = re.findall(r"\d+", ma_phong or "")
        d_so = re.findall(r"\d+", so_phong or "")

        if not d_target:
            return False

        # 2. Khớp trọn bộ danh sách số (ví dụ: 'P203' -> ['203'] == 'A203' -> ['203'])
        # hoặc 'P36-A2' -> ['36', '2'] == 'P36_A2' -> ['36', '2']
        if d_target == d_ma or d_target == d_so:
            return True

        # 3. Target là số phòng dạng 3 chữ số (ví dụ: 101, 102, 203, P203, P101)
        # và số phòng trong ma_phong hoặc so_phong bắt đầu bằng số này
        if len(d_target) == 1 and len(d_target[0]) >= 3:
            room_num = d_target[0]
            if (d_ma and d_ma[0] == room_num) or (d_so and d_so[0] == room_num):
                return True

        return False

    @classmethod
    def auto_reconcile_transaction(cls, db: Session, tx: GiaoDichNganHang) -> None:
        """
        Nghiệp vụ đối soát giao dịch ngân hàng theo quy tắc:
        - Nếu giao dịch đã khớp thủ công (MATCHED_MANUALLY) thì giữ nguyên.
        - Phân tích cú pháp nội dung chuyển khoản:
          1. Tiền phòng (TP <mã sinh viên>):
             - Khớp với hóa đơn tiền phòng (TIEN_PHONG, CHUA_THANH_TOAN / QUA_HAN) của SV.
             - Nếu khớp số tiền: GẠCH NỢ (DA_THANH_TOAN), cập nhật Sổ công nợ, gắn mã HĐ, trạng thái 'Đã khớp'.
          2. Tiền điện nước (DN <số phòng>):
             - Khớp với hóa đơn tiền điện nước (DIEN_NUOC, CHUA_THANH_TOAN / QUA_HAN) của phòng.
             - Nếu khớp số tiền: GẠCH NỢ (DA_THANH_TOAN), cập nhật Sổ công nợ, gắn mã HĐ, trạng thái 'Đã khớp'.
          3. Không đúng cú pháp (hoặc không khớp số tiền/không tìm thấy hóa đơn):
             - Trạng thái: Sai cú pháp (INVALID_SYNTAX).
             - Khớp với hóa đơn: Rỗng (None).
             - Ghi chú: "Sai cú pháp".
             - Không gạch nợ.
        """
        if tx.trang_thai == TrangThaiDoiSoat.MATCHED_MANUALLY.value:
            return

        fee_type, student_code, room_code = cls.parse_transfer_syntax(tx.noi_dung_chuyen_khoan)

        # 1. Trường hợp không đúng cú pháp: Cột hóa đơn sẽ không có gì, trạng thái là Sai cú pháp
        if not fee_type:
            tx.trang_thai = TrangThaiDoiSoat.INVALID_SYNTAX.value
            tx.ma_hoa_don = None
            tx.msv = None
            tx.ghi_chu_doi_soat = "Sai cú pháp"
            return

        # Nếu giao dịch đã khớp trước đó và hóa đơn thực sự khớp cú pháp/đối tượng thì giữ nguyên
        if tx.trang_thai in [TrangThaiDoiSoat.MATCHED.value, TrangThaiDoiSoat.AUTO_MATCHED.value] and tx.ma_hoa_don:
            inv = db.query(HoaDon).filter(HoaDon.ma_hoa_don == tx.ma_hoa_don).first()
            if inv and abs(float(inv.so_tien) - float(tx.so_tien)) < 1.0:
                is_valid = False
                if fee_type == "TIEN_PHONG" and student_code and inv.msv and inv.msv.upper() == student_code.upper():
                    is_valid = True
                elif fee_type == "DIEN_NUOC" and room_code and cls.is_room_match(room_code, inv.ma_phong, getattr(inv, "so_phong", "")):
                    is_valid = True
                if is_valid:
                    return

        # 2. Xử lý TIỀN PHÒNG (TP <mã sinh viên>)
        if fee_type == "TIEN_PHONG" and student_code:
            tx.msv = student_code

            # Tìm các hóa đơn tiền phòng chưa thanh toán của sinh viên
            unpaid_invoices = (
                db.query(HoaDon)
                .filter(
                    HoaDon.loai_hoa_don == LoaiHoaDon.TIEN_PHONG.value,
                    HoaDon.msv.ilike(student_code),
                    HoaDon.trang_thai.in_([
                        TrangThaiHoaDon.CHUA_THANH_TOAN.value,
                        TrangThaiHoaDon.QUA_HAN.value,
                    ]),
                )
                .order_by(HoaDon.han_thanh_toan.asc())
                .all()
            )

            # Tìm hóa đơn khớp số tiền
            matching_invoice = next(
                (inv for inv in unpaid_invoices if abs(float(inv.so_tien) - float(tx.so_tien)) < 1.0),
                None,
            )

            # Nếu không tìm thấy trong hóa đơn chưa thanh toán, kiểm tra xem hóa đơn đã được thanh toán chưa
            if not matching_invoice:
                paid_invoices = (
                    db.query(HoaDon)
                    .filter(
                        HoaDon.loai_hoa_don == LoaiHoaDon.TIEN_PHONG.value,
                        HoaDon.msv.ilike(student_code),
                        HoaDon.trang_thai == TrangThaiHoaDon.DA_THANH_TOAN.value,
                    )
                    .all()
                )
                matching_invoice = next(
                    (inv for inv in paid_invoices if abs(float(inv.so_tien) - float(tx.so_tien)) < 1.0),
                    None,
                )

            if matching_invoice:
                # Khớp thành công -> TỰ ĐỘNG GẠCH NỢ
                matching_invoice.trang_thai = TrangThaiHoaDon.DA_THANH_TOAN.value
                cong_no = db.query(SoCongNo).filter(SoCongNo.ma_hoa_don == matching_invoice.ma_hoa_don).first()
                if cong_no:
                    cong_no.da_tra = float(matching_invoice.so_tien)
                    cong_no.con_thieu = 0.0
                    cong_no.trang_thai = "DA_THANH_TOAN"
                    cong_no.ngay_cap_nhat = datetime.datetime.now()

                tx.ma_hoa_don = matching_invoice.ma_hoa_don
                code_to_set = matching_invoice.msv or student_code
                sv_exists = db.query(SinhVien).filter(SinhVien.msv == code_to_set).first() if code_to_set else None
                tx.msv = sv_exists.msv if sv_exists else None
                tx.trang_thai = TrangThaiDoiSoat.AUTO_MATCHED.value
                tx.ghi_chu_doi_soat = f"Khớp tự động với hóa đơn {matching_invoice.ma_hoa_don}"
                tx.nguoi_xu_ly = "Hệ thống"
                tx.ngay_cap_nhat = datetime.datetime.now()
            else:
                # Chỉ giữ 2 trạng thái: Đã khớp hoặc Sai cú pháp
                tx.trang_thai = TrangThaiDoiSoat.INVALID_SYNTAX.value
                tx.ma_hoa_don = None
                tx.msv = None
                tx.ghi_chu_doi_soat = "Sai cú pháp"
            return

        # 3. Xử lý TIỀN ĐIỆN NƯỚC (DN <số phòng>)
        if fee_type == "DIEN_NUOC" and room_code:
            # Tìm các hóa đơn tiền điện nước chưa thanh toán
            unpaid_util = (
                db.query(HoaDon)
                .filter(
                    HoaDon.loai_hoa_don == LoaiHoaDon.DIEN_NUOC.value,
                    HoaDon.trang_thai.in_([
                        TrangThaiHoaDon.CHUA_THANH_TOAN.value,
                        TrangThaiHoaDon.QUA_HAN.value,
                    ]),
                )
                .order_by(HoaDon.han_thanh_toan.asc())
                .all()
            )

            # Lọc danh sách hóa đơn khớp với phòng (hỗ trợ cả P203 khớp A203 / 203 - Tòa A1)
            candidate_invoices = [
                inv for inv in unpaid_util
                if cls.is_room_match(room_code, inv.ma_phong, getattr(inv, "so_phong", ""))
            ]

            matching_invoice = next(
                (inv for inv in candidate_invoices if abs(float(inv.so_tien) - float(tx.so_tien)) < 1.0),
                None,
            )

            if not matching_invoice:
                paid_util = (
                    db.query(HoaDon)
                    .filter(
                        HoaDon.loai_hoa_don == LoaiHoaDon.DIEN_NUOC.value,
                        HoaDon.trang_thai == TrangThaiHoaDon.DA_THANH_TOAN.value,
                    )
                    .all()
                )
                for inv in paid_util:
                    if cls.is_room_match(room_code, inv.ma_phong, getattr(inv, "so_phong", "")):
                        if abs(float(inv.so_tien) - float(tx.so_tien)) < 1.0:
                            matching_invoice = inv
                            break

            if matching_invoice:
                # Khớp thành công -> TỰ ĐỘNG GẠCH NỢ
                matching_invoice.trang_thai = TrangThaiHoaDon.DA_THANH_TOAN.value
                cong_no = db.query(SoCongNo).filter(SoCongNo.ma_hoa_don == matching_invoice.ma_hoa_don).first()
                if cong_no:
                    cong_no.da_tra = float(matching_invoice.so_tien)
                    cong_no.con_thieu = 0.0
                    cong_no.trang_thai = "DA_THANH_TOAN"
                    cong_no.ngay_cap_nhat = datetime.datetime.now()

                tx.ma_hoa_don = matching_invoice.ma_hoa_don
                sv_exists = db.query(SinhVien).filter(SinhVien.msv == matching_invoice.msv).first() if matching_invoice.msv else None
                tx.msv = sv_exists.msv if sv_exists else None
                tx.trang_thai = TrangThaiDoiSoat.AUTO_MATCHED.value
                tx.ghi_chu_doi_soat = f"Khớp tự động với hóa đơn {matching_invoice.ma_hoa_don}"
                tx.nguoi_xu_ly = "Hệ thống"
                tx.ngay_cap_nhat = datetime.datetime.now()
            else:
                # Chỉ giữ 2 trạng thái: Đã khớp hoặc Sai cú pháp
                tx.trang_thai = TrangThaiDoiSoat.INVALID_SYNTAX.value
                tx.ma_hoa_don = None
                tx.msv = None
                tx.ghi_chu_doi_soat = "Sai cú pháp"
            return

    @classmethod
    def _to_item_response(cls, tx: GiaoDichNganHang, db: Session) -> ReconciliationItemResponse:
        student_name = None
        student_code = tx.msv or cls.parse_student_code(tx.noi_dung_chuyen_khoan)

        if tx.sinh_vien:
            student_code = tx.sinh_vien.msv
            if tx.sinh_vien.nguoi_dung:
                student_name = tx.sinh_vien.nguoi_dung.ho_ten
        elif student_code:
            sv = db.query(SinhVien).filter(SinhVien.msv == student_code).first()
            if sv:
                student_code = sv.msv
                if sv.nguoi_dung:
                    student_name = sv.nguoi_dung.ho_ten

        if not student_name and tx.hoa_don and tx.hoa_don.ho_ten:
            student_name = tx.hoa_don.ho_ten

        st = tx.trang_thai
        invoice_code = tx.ma_hoa_don
        invoice_display = invoice_code or ""
        matched_inv = invoice_code or ""
        status_text = "Đã khớp"
        action = "VIEW"
        display_message = tx.ghi_chu_doi_soat or ""

        # Hệ thống chỉ quy về đúng 2 trạng thái: Đã khớp hoặc Sai cú pháp
        if st in [TrangThaiDoiSoat.MATCHED.value, TrangThaiDoiSoat.AUTO_MATCHED.value, TrangThaiDoiSoat.MATCHED_MANUALLY.value]:
            st = "MATCHED"
            status_text = "Đã khớp"
            action = "VIEW"
            invoice_display = invoice_code or ""
            matched_inv = invoice_code or ""
        else:
            st = "INVALID_SYNTAX"
            status_text = "Sai cú pháp"
            action = "MANUAL_MATCH"
            invoice_code = None
            invoice_display = ""
            matched_inv = ""
            display_message = "Sai cú pháp"

        return ReconciliationItemResponse(
            id=tx.id,
            bankTransactionCode=tx.ma_giao_dich_ngan_hang,
            transactionDate=cls._format_datetime(tx.ngay_giao_dich),
            amount=float(tx.so_tien),
            transferContent=tx.noi_dung_chuyen_khoan,
            bankName=tx.ten_ngan_hang,
            bankAccount=tx.so_tai_khoan,
            status=st,
            statusText=status_text,
            action=action,
            invoiceId=invoice_code,
            invoiceCode=invoice_code,
            invoiceDisplay=invoice_display,
            matched_invoice=matched_inv,
            matchedInvoice=matched_inv,
            displayMessage=display_message,
            studentId=tx.msv or student_code,
            studentCode=student_code,
            studentName=student_name,
            matchNote=display_message,
            createdAt=tx.ngay_tao.isoformat() if tx.ngay_tao else None,
            updatedAt=tx.ngay_cap_nhat.isoformat() if tx.ngay_cap_nhat else None,
        )

    @classmethod
    def sync_student_code_reconciliation(cls, db: Session) -> None:
        """
        Đồng bộ quy tắc đối soát tự động cho các giao dịch trong CSDL:
        - Các giao dịch đã khớp thì giữ nguyên.
        - Các giao dịch chưa khớp được phân tích nội dung và chạy auto_reconcile_transaction.
        """
        txs = db.query(GiaoDichNganHang).all()
        for tx in txs:
            if tx.trang_thai not in [
                TrangThaiDoiSoat.MATCHED.value,
                TrangThaiDoiSoat.AUTO_MATCHED.value,
                TrangThaiDoiSoat.MATCHED_MANUALLY.value,
            ]:
                cls.auto_reconcile_transaction(db, tx)
        db.commit()

    @classmethod
    def get_reconciliation_list(
        cls,
        db: Session,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        bank: Optional[str] = None,
        status_filter: Optional[str] = None,
        keyword: Optional[str] = None,
        page: int = 1,
        page_size: int = 10,
        has_uploaded: Optional[bool] = None,
    ) -> ReconciliationListResponse:
        """
        Lấy danh sách giao dịch ngân hàng kèm bộ lọc và thống kê động từ CSDL thật.
        - Khi chưa upload file (has_uploaded is False): Trả về bảng rỗng và thống kê = 0.
        """
        if has_uploaded is False:
            return ReconciliationListResponse(
                items=[],
                total=0,
                page=1,
                pageSize=page_size,
                totalPages=1,
                statistics=TransactionStatistics(
                    totalTransactions=0,
                    autoMatched=0,
                    manualRequired=0,
                ),
            )

        # Chỉ tạo dữ liệu mẫu ban đầu nếu bảng hoàn toàn trống

        query = db.query(GiaoDichNganHang)

        # 1. Lọc theo khoảng ngày giao dịch
        if date_from:
            try:
                df = datetime.datetime.strptime(date_from, "%Y-%m-%d")
                query = query.filter(GiaoDichNganHang.ngay_giao_dich >= df)
            except ValueError:
                pass

        if date_to:
            try:
                dt = datetime.datetime.strptime(date_to, "%Y-%m-%d").replace(
                    hour=23, minute=59, second=59
                )
                query = query.filter(GiaoDichNganHang.ngay_giao_dich <= dt)
            except ValueError:
                pass

        # 2. Lọc theo ngân hàng
        if bank and bank.strip() and bank.lower() != "all":
            b_norm = bank.lower().strip()
            if "tp" in b_norm:
                query = query.filter(GiaoDichNganHang.ten_ngan_hang.ilike("%TP%"))
            elif "vcb" in b_norm or "vietcombank" in b_norm:
                query = query.filter(GiaoDichNganHang.ten_ngan_hang.ilike("%Vietcombank%"))
            elif "bidv" in b_norm:
                query = query.filter(GiaoDichNganHang.ten_ngan_hang.ilike("%BIDV%"))
            else:
                query = query.filter(GiaoDichNganHang.ten_ngan_hang.ilike(f"%{bank}%"))

        # 3. Lọc theo trạng thái
        if status_filter and status_filter.strip() and status_filter.upper() != "ALL":
            s_val = status_filter.upper().strip()
            if s_val in ["MATCHED", "AUTO_MATCHED"]:
                query = query.filter(
                    GiaoDichNganHang.trang_thai.in_([
                        TrangThaiDoiSoat.MATCHED.value,
                        TrangThaiDoiSoat.AUTO_MATCHED.value,
                        TrangThaiDoiSoat.MATCHED_MANUALLY.value,
                    ])
                )
            else:
                query = query.filter(
                    ~GiaoDichNganHang.trang_thai.in_([
                        TrangThaiDoiSoat.MATCHED.value,
                        TrangThaiDoiSoat.AUTO_MATCHED.value,
                        TrangThaiDoiSoat.MATCHED_MANUALLY.value,
                    ])
                )

        # 4. Lọc theo từ khóa (Mã GD, nội dung chuyển khoản, mã hóa đơn, MSV)
        if keyword and keyword.strip():
            kw = f"%{keyword.strip()}%"
            query = query.filter(
                or_(
                    GiaoDichNganHang.ma_giao_dich_ngan_hang.ilike(kw),
                    GiaoDichNganHang.noi_dung_chuyen_khoan.ilike(kw),
                    GiaoDichNganHang.ma_hoa_don.ilike(kw),
                    GiaoDichNganHang.msv.ilike(kw),
                )
            )

        total_filtered = query.count()

        # 5. Phân trang
        page = max(1, page)
        page_size = max(1, page_size)
        offset = (page - 1) * page_size
        items_db = (
            query.order_by(GiaoDichNganHang.id.asc())
            .offset(offset)
            .limit(page_size)
            .all()
        )

        items = [cls._to_item_response(tx, db) for tx in items_db]

        # 6. Tính toán thống kê thật từ database
        total_tx = db.query(func.count(GiaoDichNganHang.id)).scalar() or 0
        auto_matched = (
            db.query(func.count(GiaoDichNganHang.id))
            .filter(
                GiaoDichNganHang.trang_thai.in_([
                    TrangThaiDoiSoat.MATCHED.value,
                    TrangThaiDoiSoat.AUTO_MATCHED.value,
                    TrangThaiDoiSoat.MATCHED_MANUALLY.value,
                ])
            )
            .scalar()
            or 0
        )
        manual_required = max(0, total_tx - auto_matched)

        statistics = TransactionStatistics(
            totalTransactions=total_tx,
            autoMatched=auto_matched,
            manualRequired=manual_required,
        )

        total_pages = max(1, math.ceil(total_filtered / page_size)) if page_size > 0 else 1

        return ReconciliationListResponse(
            items=items,
            total=total_filtered,
            page=page,
            pageSize=page_size,
            totalPages=total_pages,
            statistics=statistics,
        )

    @classmethod
    def get_transaction_detail(
        cls, db: Session, transaction_id: str
    ) -> TransactionDetailResponse:
        """
        Lấy chi tiết giao dịch theo ID hoặc mã giao dịch.
        """
        tx = None
        if transaction_id.isdigit():
            tx = db.query(GiaoDichNganHang).filter(GiaoDichNganHang.id == int(transaction_id)).first()
        if not tx:
            tx = (
                db.query(GiaoDichNganHang)
                .filter(GiaoDichNganHang.ma_giao_dich_ngan_hang == transaction_id)
                .first()
            )

        if not tx:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy giao dịch ngân hàng với ID '{transaction_id}'",
            )

        student_info = None
        if tx.msv:
            sv = db.query(SinhVien).filter(SinhVien.msv == tx.msv).first()
            if sv:
                student_info = {
                    "studentId": sv.msv,
                    "studentCode": sv.msv,
                    "studentName": sv.nguoi_dung.ho_ten if sv.nguoi_dung else sv.msv,
                    "lop": sv.lop,
                }

        invoice_info = None
        if tx.ma_hoa_don:
            inv = db.query(HoaDon).filter(HoaDon.ma_hoa_don == tx.ma_hoa_don).first()
            if inv:
                paid_val = float(tx.so_tien) if tx.trang_thai == TrangThaiDoiSoat.PARTIAL.value else (float(inv.so_tien) if inv.trang_thai == TrangThaiHoaDon.DA_THANH_TOAN.value else 0.0)
                remaining_val = max(0.0, float(inv.so_tien) - paid_val)
                invoice_info = {
                    "invoiceCode": inv.ma_hoa_don,
                    "loaiHoaDon": inv.loai_hoa_don,
                    "kyThanhToan": inv.ky_thanh_toan,
                    "soTien": inv.so_tien,
                    "daNop": paid_val,
                    "conLai": remaining_val,
                    "trangThai": inv.trang_thai,
                    "hanThanhToan": inv.han_thanh_toan.isoformat() if inv.han_thanh_toan else "",
                }

        return TransactionDetailResponse(
            transaction=cls._to_item_response(tx, db),
            student=student_info,
            invoice=invoice_info,
            reconciliationStatus=tx.trang_thai,
        )

    @classmethod
    def search_students(
        cls, db: Session, keyword: Optional[str] = None, limit: int = 15
    ) -> List[StudentSearchItem]:
        """
        Tìm kiếm sinh viên theo tên hoặc mã sinh viên.
        """
        query = db.query(SinhVien).join(NguoiDung, SinhVien.ma_nguoi_dung == NguoiDung.ma_nguoi_dung)

        if keyword and keyword.strip():
            kw = f"%{keyword.strip()}%"
            query = query.filter(
                or_(
                    SinhVien.msv.ilike(kw),
                    NguoiDung.ho_ten.ilike(kw),
                    SinhVien.lop.ilike(kw),
                )
            )

        students = query.limit(limit).all()

        results = []
        for sv in students:
            # Tìm phòng đang ở qua hợp đồng active nếu có
            hd = (
                db.query(HopDong)
                .filter(HopDong.msv == sv.msv, HopDong.trang_thai == "ACTIVE")
                .first()
            )
            room_name = ""
            if hd and hd.giuong and hd.giuong.phong:
                room_name = f"{hd.giuong.phong.ma_phong}"

            results.append(
                StudentSearchItem(
                    studentId=sv.msv,
                    studentCode=sv.msv,
                    studentName=sv.nguoi_dung.ho_ten if sv.nguoi_dung else sv.msv,
                    room=room_name,
                    lop=sv.lop,
                )
            )

        return results

    @classmethod
    def get_invoices_by_student(
        cls, db: Session, student_id: str
    ) -> List[StudentInvoiceItem]:
        """
        Lấy danh sách hóa đơn còn nợ của sinh viên có thể dùng để đối soát.
        """
        # Kiểm tra sinh viên có tồn tại
        sv = db.query(SinhVien).filter(SinhVien.msv == student_id).first()
        if not sv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sinh viên với mã '{student_id}' không tồn tại trong hệ thống",
            )

        # Lấy các hóa đơn chưa thanh toán hoặc quá hạn
        invoices = (
            db.query(HoaDon)
            .filter(
                HoaDon.msv == sv.msv,
                HoaDon.trang_thai.in_([
                    TrangThaiHoaDon.CHUA_THANH_TOAN.value,
                    TrangThaiHoaDon.QUA_HAN.value,
                ]),
            )
            .order_by(HoaDon.han_thanh_toan.asc())
            .all()
        )

        results = []
        for inv in invoices:
            loai_text = "Điện nước" if inv.loai_hoa_don == "DIEN_NUOC" else "Tiền phòng"
            amount_str = f"{int(inv.so_tien):,}".replace(",", ".")
            desc = f"{inv.ma_hoa_don} ({loai_text} {inv.ky_thanh_toan} – Còn nợ: {amount_str} đ)"

            results.append(
                StudentInvoiceItem(
                    id=inv.ma_hoa_don,
                    invoiceCode=inv.ma_hoa_don,
                    description=desc,
                    amount=float(inv.so_tien),
                    status=inv.trang_thai,
                    dueDate=inv.han_thanh_toan.isoformat() if inv.han_thanh_toan else "",
                )
            )

        return results

    @classmethod
    def get_unpaid_invoices(
        cls,
        db: Session,
        keyword: Optional[str] = None,
        invoice_type: Optional[str] = None,
        amount: Optional[float] = None,
    ) -> List[UnpaidInvoiceItem]:
        """
        Lấy danh sách các hóa đơn chưa thanh toán trong hệ thống để kế toán gán khớp tay:
        - Hỗ trợ cả Hóa đơn Tiền phòng (theo Sinh viên) và Hóa đơn Điện nước (theo Phòng).
        - Tìm kiếm linh hoạt theo Số phòng, Mã SV, Tên SV, Mã hóa đơn.
        - Ưu tiên hiển thị các hóa đơn trùng khớp số tiền lên đầu.
        """
        query = db.query(HoaDon).filter(
            HoaDon.trang_thai != TrangThaiHoaDon.DA_THANH_TOAN.value,
            HoaDon.trang_thai != TrangThaiHoaDon.DA_HUY.value,
        )
        if invoice_type and invoice_type != "ALL":
            query = query.filter(HoaDon.loai_hoa_don == invoice_type)

        invoices = query.order_by(HoaDon.ngay_lap.desc()).all()

        results: List[UnpaidInvoiceItem] = []
        kw = (keyword or "").strip().lower()

        for inv in invoices:
            is_tien_phong = inv.loai_hoa_don == LoaiHoaDon.TIEN_PHONG.value
            type_name = "Tiền phòng" if is_tien_phong else "Tiền điện nước"

            # Tìm tên phòng
            room_str = "Chưa xếp phòng"
            if inv.so_phong:
                sp = inv.so_phong.strip()
                room_str = sp if (sp.startswith("P") or sp.startswith("p")) else f"P{sp}"
            elif inv.hop_dong and inv.hop_dong.giuong and inv.hop_dong.giuong.phong:
                p = inv.hop_dong.giuong.phong
                t = p.tang.toa_nha.ten_toa if p.tang and p.tang.toa_nha else ""
                room_str = f"P{p.so_phong} - {t}".strip(" -")

            # Tìm đối tượng
            if is_tien_phong:
                target_name = f"{inv.ho_ten or inv.msv or 'Sinh viên'} ({inv.msv or ''})".strip()
            else:
                target_name = f"Phòng {inv.so_phong or room_str}"

            # Lọc theo từ khóa tìm kiếm nếu có
            if kw:
                searchable = f"{inv.ma_hoa_don} {inv.msv or ''} {inv.ho_ten or ''} {room_str} {inv.so_phong or ''} {target_name} {inv.ky_thanh_toan or ''}".lower()
                if kw not in searchable:
                    continue

            due_str = inv.han_thanh_toan.strftime("%d/%m/%Y") if inv.han_thanh_toan else ""
            status_text = "Chờ thanh toán" if inv.trang_thai in ["CHO_THANH_TOAN", "CHUA_THANH_TOAN"] else inv.trang_thai

            results.append(
                UnpaidInvoiceItem(
                    id=inv.ma_hoa_don,
                    invoiceCode=inv.ma_hoa_don,
                    invoiceType=inv.loai_hoa_don,
                    invoiceTypeName=type_name,
                    targetName=target_name,
                    room=room_str,
                    msv=inv.msv,
                    studentName=inv.ho_ten,
                    period=inv.ky_thanh_toan or "Tháng 09/2026",
                    amount=float(inv.so_tien),
                    status=inv.trang_thai,
                    statusText=status_text,
                    dueDate=due_str,
                )
            )

        # Sắp xếp: Ưu tiên hóa đơn trùng khớp số tiền lên đầu
        if amount is not None and amount > 0:
            results.sort(key=lambda x: (abs(x.amount - amount) > 0.01, x.dueDate or ""))

        return results

    @classmethod
    def manual_match(
        cls,
        db: Session,
        transaction_id: str,
        student_id: Optional[str],
        invoice_id: str,
        accountant_username: str,
    ) -> ManualMatchResponse:
        """
        Thực hiện gán giao dịch thủ công với hóa đơn:
        - Hỗ trợ cả Hóa đơn Tiền phòng (theo SV) và Hóa đơn Điện nước (theo Phòng).
        - Validate chặt chẽ tính tồn tại, chưa thanh toán và số tiền khớp.
        - Cập nhật giao dịch -> MATCHED, hóa đơn -> DA_THANH_TOAN và gạch nợ sổ công nợ.
        """
        # 1. Kiểm tra Transaction tồn tại
        tx = None
        if transaction_id.isdigit():
            tx = db.query(GiaoDichNganHang).filter(GiaoDichNganHang.id == int(transaction_id)).first()
        if not tx:
            tx = (
                db.query(GiaoDichNganHang)
                .filter(GiaoDichNganHang.ma_giao_dich_ngan_hang == transaction_id)
                .first()
            )

        if not tx:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Giao dịch ngân hàng với ID '{transaction_id}' không tồn tại",
            )

        # 2. Kiểm tra Transaction chưa được đối soát
        if tx.trang_thai in [
            TrangThaiDoiSoat.MATCHED.value,
            TrangThaiDoiSoat.AUTO_MATCHED.value,
            TrangThaiDoiSoat.MATCHED_MANUALLY.value,
        ]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Giao dịch '{tx.ma_giao_dich_ngan_hang}' đã được đối soát trước đó (Trạng thái: {tx.trang_thai})",
            )

        # 3. Kiểm tra Hóa đơn tồn tại
        invoice = db.query(HoaDon).filter(HoaDon.ma_hoa_don == invoice_id).first()
        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Hóa đơn với mã '{invoice_id}' không tồn tại",
            )

        # 4. Kiểm tra Sinh viên (nếu có truyền hoặc nếu là TIEN_PHONG)
        sv = None
        if student_id:
            sv = db.query(SinhVien).filter(SinhVien.msv == student_id).first()
            if not sv:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Sinh viên với mã '{student_id}' không tồn tại",
                )
            if invoice.msv and invoice.msv != sv.msv:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Hóa đơn '{invoice_id}' (thuộc MSV: {invoice.msv}) không thuộc về sinh viên đã chọn (MSV: {sv.msv})",
                )
        elif invoice.msv:
            sv = db.query(SinhVien).filter(SinhVien.msv == invoice.msv).first()

        # 5. Kiểm tra Hóa đơn còn trạng thái cho phép thanh toán
        if invoice.trang_thai == TrangThaiHoaDon.DA_THANH_TOAN.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Hóa đơn '{invoice_id}' đã được thanh toán hoàn tất trước đó",
            )

        if invoice.trang_thai == TrangThaiHoaDon.DA_HUY.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Hóa đơn '{invoice_id}' đã bị hủy, không thể đối soát",
            )

        # 6. Kiểm tra Transaction amount hợp lệ
        if tx.so_tien <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số tiền giao dịch không hợp lệ (phải lớn hơn 0)",
            )

        if abs(tx.so_tien - invoice.so_tien) > 0.01:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Số tiền giao dịch ({tx.so_tien:,.0f} đ) không khớp với số tiền trên hóa đơn "
                    f"({invoice.so_tien:,.0f} đ)"
                ),
            )

        # 7. Kiểm tra không có transaction khác đã được gán vào hóa đơn này
        other_tx = (
            db.query(GiaoDichNganHang)
            .filter(
                GiaoDichNganHang.ma_hoa_don == invoice.ma_hoa_don,
                GiaoDichNganHang.id != tx.id,
                GiaoDichNganHang.trang_thai.in_([
                    TrangThaiDoiSoat.MATCHED.value,
                    TrangThaiDoiSoat.AUTO_MATCHED.value,
                    TrangThaiDoiSoat.MATCHED_MANUALLY.value,
                ]),
            )
            .first()
        )
        if other_tx:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Hóa đơn '{invoice_id}' đã được gán đối soát với giao dịch '{other_tx.ma_giao_dich_ngan_hang}'",
            )

        # 8. Thực hiện cập nhật trong Database Transaction
        try:
            tx.ma_hoa_don = invoice.ma_hoa_don
            tx.msv = sv.msv if sv else invoice.msv
            tx.trang_thai = TrangThaiDoiSoat.MATCHED.value
            tx.ghi_chu_doi_soat = f"Khớp thủ công bởi {accountant_username}"
            tx.nguoi_xu_ly = accountant_username
            tx.ngay_cap_nhat = datetime.datetime.now()

            invoice.trang_thai = TrangThaiHoaDon.DA_THANH_TOAN.value

            # Cập nhật sổ công nợ nếu có
            cong_no = db.query(SoCongNo).filter(SoCongNo.ma_hoa_don == invoice.ma_hoa_don).first()
            if cong_no:
                cong_no.da_thu = invoice.so_tien
                cong_no.con_lai = 0.0
                cong_no.trang_thai = "DA_THU"
                cong_no.ngay_thu = datetime.date.today()

            db.commit()
            db.refresh(tx)
            db.refresh(invoice)
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Lỗi khi thực hiện gán giao dịch thủ công: {str(e)}",
            )

        return ManualMatchResponse(
            success=True,
            message="Gán giao dịch và gạch nợ thành công",
            transactionId=str(tx.id),
            invoiceCode=invoice.ma_hoa_don,
            status="MATCHED",
            transaction=cls._to_item_response(tx, db),
        )

    @classmethod
    def process_statement_upload(
        cls,
        db: Session,
        file_bytes: bytes,
        filename: str,
        bank_name: Optional[str] = None,
        period: Optional[str] = None,
        accountant_username: Optional[str] = None,
    ) -> StatementUploadResponse:
        """
        Xử lý upload file sao kê ngân hàng (Excel/CSV):
        1. Trích xuất metadata: Tên file, Ngân hàng, Kỳ sao kê.
        2. Đọc và parse dữ liệu từng dòng giao dịch.
        3. Chạy đối soát tự động:
           - Đúng cú pháp TP <mã SV> hoặc DN <số phòng> và khớp hóa đơn -> Đã khớp (MATCHED), gạch nợ.
           - Không đúng cú pháp -> Sai cú pháp (INVALID_SYNTAX), cột khớp hóa đơn rỗng.
        4. Cập nhật thống kê và trả về danh sách giao dịch.
        """
        import csv
        import io

        clean_filename = filename.strip() if filename else "sao_ke_ngan_hang.csv"

        # 1. Trích xuất metadata Ngân hàng & Kỳ sao kê
        detected_bank = bank_name.strip() if bank_name and bank_name.strip() else ""
        if not detected_bank:
            fn_lower = clean_filename.lower()
            if "vcb" in fn_lower or "vietcombank" in fn_lower:
                detected_bank = "Vietcombank - TK 1012345678"
            elif "bidv" in fn_lower:
                detected_bank = "BIDV - TK 123456789"
            else:
                detected_bank = "TP Bank - TK 20020813520"

        # 2. Parse dữ liệu các dòng
        raw_rows = []
        is_excel = clean_filename.lower().endswith((".xlsx", ".xls"))

        if is_excel:
            try:
                from openpyxl import load_workbook
                wb = load_workbook(io.BytesIO(file_bytes), data_only=True)
                # Tìm sheet phù hợp nhất (ưu tiên sheet có chữ 'sao kê', 'saoke', 'giao dịch', 'trans', hoặc sheet có nhiều dòng dữ liệu nhất)
                target_ws = None
                for sname in wb.sheetnames:
                    s_clean = sname.lower().replace(" ", "").replace("_", "")
                    if any(k in s_clean for k in ["saoke", "giaodich", "trans"]):
                        target_ws = wb[sname]
                        break
                if not target_ws:
                    best_ws = wb.active
                    max_valid_rows = 0
                    for candidate_ws in wb.worksheets:
                        cnt = sum(1 for r in candidate_ws.iter_rows(values_only=True) if any(c is not None and str(c).strip() != "" for c in r))
                        if cnt > max_valid_rows:
                            max_valid_rows = cnt
                            best_ws = candidate_ws
                    target_ws = best_ws or wb.active

                for row in target_ws.iter_rows(values_only=True):
                    if row and any(c is not None and str(c).strip() != "" for c in row):
                        raw_rows.append([str(c).strip() if c is not None else "" for c in row])
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Không thể đọc file Excel: {str(e)}",
                )
        else:
            # File CSV / text
            decoded = None
            for enc in ["utf-8-sig", "utf-8", "cp1258", "latin1"]:
                try:
                    decoded = file_bytes.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
            if decoded is None:
                decoded = file_bytes.decode("utf-8", errors="ignore")

            first_line = decoded.splitlines()[0] if decoded.splitlines() else ""
            delim = ";" if first_line.count(";") > first_line.count(",") else ","
            reader = csv.reader(io.StringIO(decoded), delimiter=delim)
            for row in reader:
                if row and any(c.strip() for c in row):
                    raw_rows.append([c.strip() for c in row])

        if not raw_rows:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File sao kê trống hoặc không có dòng dữ liệu hợp lệ",
            )

        # Tìm dòng tiêu đề (header)
        header_idx = -1
        col_code = 0
        col_date = 1
        col_amount = 2
        col_content = 3
        col_acc = 5

        for i, row in enumerate(raw_rows):
            row_str = " ".join([c.lower() for c in row])
            if any(k in row_str for k in ["mã gd", "mã giao dịch", "ngày", "số tiền", "nội dung", "amount", "transaction", "content"]):
                header_idx = i
                for c_idx, cell in enumerate(row):
                    cl = cell.lower().strip()
                    if any(k in cl for k in ["mã", "ref", "số gd", "trans"]):
                        col_code = c_idx
                    elif any(k in cl for k in ["ngày", "thời gian", "date", "time"]):
                        col_date = c_idx
                    elif any(k in cl for k in ["tiền", "amount", "ghi có", "credit"]):
                        col_amount = c_idx
                    elif any(k in cl for k in ["nội dung", "diễn giải", "desc", "remark"]):
                        col_content = c_idx
                    elif any(k in cl for k in ["tài khoản", "account"]):
                        col_acc = c_idx
                break

        data_rows = raw_rows[header_idx + 1 :] if header_idx >= 0 else raw_rows

        # Trích xuất Kỳ sao kê chính xác từ nội dung file sao kê:
        detected_period = ""

        # A. Quét các dòng đầu của file xem có ghi rõ "Kỳ sao kê: Tháng MM/YYYY" hoặc "Tháng MM/YYYY"
        for r in raw_rows[:15]:
            r_text = " ".join(r).lower()
            m = re.search(r"th[aá]ng\s*0?(\d{1,2})[/-](\d{4})", r_text)
            if m:
                detected_period = f"Tháng {int(m.group(1)):02d}/{m.group(2)}"
                break
            m2 = re.search(r"k[yỳ]\s*(?:sao\s*k[eê])?[:\s]*0?(\d{1,2})[/-](\d{4})", r_text)
            if m2:
                detected_period = f"Tháng {int(m2.group(1)):02d}/{m2.group(2)}"
                break

        # B. Phân tích trực tiếp từ cột Ngày/Thời gian của các dòng giao dịch thực tế trong file
        if not detected_period and data_rows:
            parsed_months = []
            for r in data_rows:
                raw_date = r[col_date] if col_date < len(r) else ""
                if raw_date:
                    for fmt in [
                        "%Y-%m-%d %H:%M:%S",
                        "%Y-%m-%d %H:%M",
                        "%d/%m/%Y %H:%M:%S",
                        "%d/%m/%Y %H:%M",
                        "%d/%m/%Y",
                        "%Y-%m-%d",
                    ]:
                        try:
                            d_parsed = datetime.datetime.strptime(raw_date, fmt)
                            parsed_months.append((d_parsed.month, d_parsed.year))
                            break
                        except ValueError:
                            pass
            if parsed_months:
                from collections import Counter
                most_common = Counter(parsed_months).most_common(1)[0][0]
                detected_period = f"Tháng {most_common[0]:02d}/{most_common[1]}"

        # C. Nếu file không có ngày rõ ràng, trích xuất từ tên file
        if not detected_period:
            fn_lower = clean_filename.lower()
            m_fn = re.search(r"t(?:h[aá]ng)?[\s_]*0?(\d{1,2})(?:[\s_-]*(\d{4}))?", fn_lower)
            if m_fn:
                m_num = int(m_fn.group(1))
                y_num = int(m_fn.group(2)) if m_fn.group(2) else 2026
                detected_period = f"Tháng {m_num:02d}/{y_num}"

        # D. Fallback theo tham số truyền vào nếu hợp lệ hoặc thời gian hiện tại
        if not detected_period:
            if period and period.strip() and period.strip() != "--":
                detected_period = period.strip()
            else:
                detected_period = f"Tháng {datetime.datetime.now().strftime('%m/%Y')}"

        # 3. Đảm bảo cấu trúc CSDL và dữ liệu hóa đơn/sinh viên sẵn sàng

        # Khi tải lên file sao kê mới, làm sạch các giao dịch cũ để bảng phản ánh đúng và đủ dữ liệu của file sao kê vừa tải
        db.query(GiaoDichNganHang).delete(synchronize_session=False)
        db.flush()

        processed_txs = []

        for row_idx, r in enumerate(data_rows):
            if not r or len(r) == 0:
                continue

            # Trích xuất Mã GD
            tx_code = r[col_code] if col_code < len(r) and r[col_code].strip() else f"FT{datetime.datetime.now().strftime('%y%j')}{row_idx+1:04d}"
            # Trích xuất Thời gian
            raw_date = r[col_date] if col_date < len(r) else ""
            dt_val = None
            if raw_date:
                for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y", "%Y-%m-%d"]:
                    try:
                        dt_val = datetime.datetime.strptime(raw_date, fmt)
                        break
                    except ValueError:
                        pass
            if not dt_val:
                dt_val = datetime.datetime(2026, 9, 12, 9, 15) + datetime.timedelta(minutes=row_idx * 15)

            # Trích xuất Số tiền
            raw_amount = r[col_amount] if col_amount < len(r) else "0"
            clean_amt = re.sub(r"[^\d.]", "", raw_amount.replace(",", "."))
            if clean_amt.count(".") > 1:
                clean_amt = clean_amt.replace(".", "")
            try:
                amt_val = float(clean_amt)
            except ValueError:
                amt_val = 0.0

            # Trích xuất Nội dung CK
            content = r[col_content] if col_content < len(r) else ""
            acc_val = r[col_acc] if col_acc < len(r) else "20020813520"

            # Tìm hoặc tạo giao dịch trong CSDL
            tx = db.query(GiaoDichNganHang).filter(GiaoDichNganHang.ma_giao_dich_ngan_hang == tx_code).first()
            if not tx:
                tx = GiaoDichNganHang(
                    ma_giao_dich_ngan_hang=tx_code,
                    ngay_giao_dich=dt_val,
                    so_tien=amt_val,
                    noi_dung_chuyen_khoan=content,
                    ten_ngan_hang=detected_bank.split(" - ")[0] if " - " in detected_bank else detected_bank,
                    so_tai_khoan=acc_val or "20020813520",
                    trang_thai=TrangThaiDoiSoat.MANUAL_REQUIRED.value,
                    nguoi_xu_ly=accountant_username or "Hệ thống",
                )
                db.add(tx)
                db.flush()
            else:
                tx.ngay_giao_dich = dt_val
                tx.so_tien = amt_val
                tx.noi_dung_chuyen_khoan = content
                tx.ten_ngan_hang = detected_bank.split(" - ")[0] if " - " in detected_bank else detected_bank
                tx.so_tai_khoan = acc_val or tx.so_tai_khoan
                if tx.trang_thai != TrangThaiDoiSoat.MATCHED_MANUALLY.value:
                    tx.trang_thai = TrangThaiDoiSoat.INVALID_SYNTAX.value
                    tx.ma_hoa_don = None
                    tx.msv = None
                    tx.ghi_chu_doi_soat = "Sai cú pháp"
                db.flush()

            # Chạy quy tắc đối soát tự động bám sát nghiệp vụ
            cls.auto_reconcile_transaction(db, tx)
            processed_txs.append(tx)

        db.commit()

        # Tạo phản hồi item list
        items = [cls._to_item_response(tx, db) for tx in processed_txs]

        # Thống kê trên batch vừa upload
        total_tx = len(processed_txs)
        auto_matched = sum(
            1 for tx in processed_txs
            if tx.trang_thai in [TrangThaiDoiSoat.MATCHED.value, TrangThaiDoiSoat.AUTO_MATCHED.value, TrangThaiDoiSoat.MATCHED_MANUALLY.value]
        )
        manual_required = sum(
            1 for tx in processed_txs
            if tx.trang_thai in [TrangThaiDoiSoat.INVALID_SYNTAX.value, TrangThaiDoiSoat.STUDENT_NOT_FOUND.value, TrangThaiDoiSoat.MANUAL_REQUIRED.value, TrangThaiDoiSoat.ERROR.value]
        )

        statistics = TransactionStatistics(
            totalTransactions=total_tx,
            autoMatched=auto_matched,
            manualRequired=manual_required,
        )

        return StatementUploadResponse(
            success=True,
            message=f"Tải lên và xử lý đối soát thành công {total_tx} giao dịch từ file {clean_filename}",
            fileName=clean_filename,
            bankName=detected_bank,
            period=detected_period,
            statistics=statistics,
            items=items,
            totalTransactions=total_tx,
            autoMatched=auto_matched,
            manualRequired=manual_required,
        )
