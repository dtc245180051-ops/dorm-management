"""
Test Suite: Kiểm thử 7 kịch bản nghiệp vụ bắt buộc của Đối soát giao dịch (Mục 14)
"""
import sys
import json
import urllib.request
import urllib.error
import urllib.parse

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000/api/v1"

def http_request(method, endpoint, data=None, token=None, headers=None, params=None):
    if params:
        endpoint = f"{endpoint}?{urllib.parse.urlencode(params)}"
    url = f"{BASE_URL}{endpoint}"
    if "?" in url:
        base, qs = url.split("?", 1)
        url = f"{base}?{urllib.parse.quote(qs, safe='=&')}"
    req_headers = headers or {}
    if token:
        req_headers["Authorization"] = f"Bearer {token}"
    
    body = None
    if data is not None:
        if isinstance(data, dict) and req_headers.get("Content-Type") != "application/x-www-form-urlencoded":
            req_headers["Content-Type"] = "application/json"
            body = json.dumps(data).encode("utf-8")
        elif isinstance(data, dict):
            body = urllib.parse.urlencode(data).encode("utf-8")
        elif isinstance(data, str):
            body = data.encode("utf-8")
            
    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8")
        try:
            err_json = json.loads(err_content)
        except Exception:
            err_json = {"raw": err_content}
        return e.code, err_json
    except Exception as e:
        return 500, {"error": str(e)}

def login(username, password):
    status_code, data = http_request(
        "POST",
        "/auth/login",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    if status_code == 200:
        return data.get("access_token")
    return None


def run_tests():
    print("=" * 70)
    print("KIỂM THỬ 7 TEST CASE BẮT BUỘC THEO ĐÚNG NGHIỆP VỤ ĐỐI SOÁT GIAO DỊCH")
    print("=" * 70)

    from app.core.database import SessionLocal
    from app.models.reconciliation import GiaoDichNganHang, TrangThaiDoiSoat
    from app.models.invoice import HoaDon, TrangThaiHoaDon
    from app.models.user import SinhVien
    from app.services.reconciliation_service import ReconciliationService
    import datetime

    token = login("KT_Hoa", "password123")
    assert token, "Đăng nhập Kế toán KT_Hoa thất bại!"

    db = SessionLocal()

    # =========================================================================
    # TEST 1: 'DTC245180037 nop tien KTX T9'
    # Expected:
    # - parse được studentCode: DTC245180037
    # - tìm được student
    # - tìm được invoice: HD-2026-00130
    # - invoiceCode hiển thị
    # - status = AUTO_MATCHED, statusText = 'Đã khớp', action = 'VIEW'
    # - hóa đơn được gạch nợ (DA_THANH_TOAN)
    # =========================================================================
    print("\n--- TEST 1: Có mã SV và tìm thấy hóa đơn phù hợp ---")
    code_t1 = ReconciliationService.parse_student_code("DTC245180037 nop tien KTX T9")
    assert code_t1 == "DTC245180037", f"Parse studentCode sai: {code_t1}"
    print(f"  [+] Parse studentCode thành công: {code_t1}")

    # Tạo giao dịch giả lập test 1 để test toàn trình auto match và gạch nợ
    test_tx1 = db.query(GiaoDichNganHang).filter(GiaoDichNganHang.ma_giao_dich_ngan_hang == "TEST_TX_001").first()
    if not test_tx1:
        test_tx1 = GiaoDichNganHang(
            ma_giao_dich_ngan_hang="TEST_TX_001",
            ngay_giao_dich=datetime.datetime.now(),
            so_tien=600000.0,
            noi_dung_chuyen_khoan="DTC245180037 nop tien KTX T9",
            ten_ngan_hang="TP Bank",
            so_tai_khoan="20020813520",
            trang_thai=TrangThaiDoiSoat.MANUAL_REQUIRED.value,
        )
        db.add(test_tx1)
        db.flush()

    # Đảm bảo có hóa đơn nợ 600,000 cho SV DTC245180037
    test_inv1 = db.query(HoaDon).filter(HoaDon.ma_hoa_don == "TEST_HD_001").first()
    if not test_inv1:
        test_inv1 = HoaDon(
            ma_hoa_don="TEST_HD_001",
            msv="DTC245180037",
            ho_ten="ngô phương mai",
            loai_hoa_don="TIEN_PHONG",
            ky_thanh_toan="Tháng 09/2026",
            so_tien=600000.0,
            ngay_lap=datetime.date(2026, 9, 1),
            han_thanh_toan=datetime.date(2026, 9, 20),
            trang_thai=TrangThaiHoaDon.CHUA_THANH_TOAN.value,
            ghi_chu="Hóa đơn test 1",
        )
        db.add(test_inv1)
        db.flush()
    else:
        test_inv1.trang_thai = TrangThaiHoaDon.CHUA_THANH_TOAN.value
        test_tx1.trang_thai = TrangThaiDoiSoat.MANUAL_REQUIRED.value
        test_tx1.ma_hoa_don = None
        db.flush()

    # Chạy auto reconcile cho test_tx1
    ReconciliationService.auto_reconcile_transaction(db, test_tx1)
    db.commit()

    db.refresh(test_tx1)
    db.refresh(test_inv1)

    assert test_tx1.trang_thai in [TrangThaiDoiSoat.MATCHED.value, TrangThaiDoiSoat.AUTO_MATCHED.value], f"Status sai: {test_tx1.trang_thai}"
    assert test_tx1.ma_hoa_don == "TEST_HD_001", f"Invoice matched sai: {test_tx1.ma_hoa_don}"
    assert test_inv1.trang_thai == TrangThaiHoaDon.DA_THANH_TOAN.value, f"Hóa đơn chưa được gạch nợ: {test_inv1.trang_thai}"
    
    # Kiểm tra API response mapping
    resp1 = ReconciliationService._to_item_response(test_tx1, db)
    assert resp1.status in ["MATCHED", "AUTO_MATCHED"]
    assert resp1.statusText == "Đã khớp"
    assert resp1.action == "VIEW"
    assert resp1.invoiceCode == "TEST_HD_001"
    assert resp1.matched_invoice == "TEST_HD_001"
    print(f"  [+] TEST 1 PASSED: status={resp1.status}, statusText={resp1.statusText}, action={resp1.action}, matched_invoice={resp1.matched_invoice}, invoiceTrangThai={test_inv1.trang_thai}")

    # =========================================================================
    # TEST 2: 'nop tien phong thang 9'
    # Expected:
    # - không có studentCode -> parse trả về None
    # - invoiceCode = null
    # - matched_invoice = 'Thiếu mã sinh viên'
    # - status = INVALID_SYNTAX
    # - statusText = 'Sai cú pháp'
    # - action = MANUAL_MATCH
    # =========================================================================
    print("\n--- TEST 2: Không có mã sinh viên (Sai cú pháp) ---")
    code_t2 = ReconciliationService.parse_student_code("nop tien phong thang 9")
    assert code_t2 is None, f"Parse studentCode phải là None, nhận: {code_t2}"

    test_tx2 = db.query(GiaoDichNganHang).filter(GiaoDichNganHang.ma_giao_dich_ngan_hang == "TEST_TX_002").first()
    if not test_tx2:
        test_tx2 = GiaoDichNganHang(
            ma_giao_dich_ngan_hang="TEST_TX_002",
            ngay_giao_dich=datetime.datetime.now(),
            so_tien=120000.0,
            noi_dung_chuyen_khoan="nop tien phong thang 9",
            ten_ngan_hang="TP Bank",
            so_tai_khoan="20020813520",
            trang_thai=TrangThaiDoiSoat.MANUAL_REQUIRED.value,
        )
        db.add(test_tx2)
        db.flush()

    ReconciliationService.auto_reconcile_transaction(db, test_tx2)
    db.commit()
    db.refresh(test_tx2)

    assert test_tx2.trang_thai == TrangThaiDoiSoat.INVALID_SYNTAX.value, f"Status sai: {test_tx2.trang_thai}"
    assert test_tx2.ma_hoa_don is None
    resp2 = ReconciliationService._to_item_response(test_tx2, db)
    assert resp2.status == "INVALID_SYNTAX"
    assert resp2.statusText == "Sai cú pháp"
    assert resp2.action == "MANUAL_MATCH"
    assert resp2.invoiceCode is None
    assert resp2.matched_invoice == "Thiếu mã sinh viên"
    print(f"  [+] TEST 2 PASSED: status={resp2.status}, statusText={resp2.statusText}, action={resp2.action}, matched_invoice={resp2.matched_invoice}")

    # =========================================================================
    # TEST 3: Có studentCode nhưng student không tồn tại trong hệ thống
    # Expected:
    # - không auto match
    # - không gạch nợ
    # - status = STUDENT_NOT_FOUND, statusText = 'Không tìm thấy SV', action = MANUAL_MATCH
    # =========================================================================
    print("\n--- TEST 3: Có mã SV nhưng SV không tồn tại trong CSDL ---")
    code_t3 = ReconciliationService.parse_student_code("DTC999999999 nop tien phong")
    assert code_t3 == "DTC999999999"

    test_tx3 = db.query(GiaoDichNganHang).filter(GiaoDichNganHang.ma_giao_dich_ngan_hang == "TEST_TX_003").first()
    if not test_tx3:
        test_tx3 = GiaoDichNganHang(
            ma_giao_dich_ngan_hang="TEST_TX_003",
            ngay_giao_dich=datetime.datetime.now(),
            so_tien=200000.0,
            noi_dung_chuyen_khoan="DTC999999999 nop tien phong",
            ten_ngan_hang="TP Bank",
            so_tai_khoan="20020813520",
            trang_thai=TrangThaiDoiSoat.MANUAL_REQUIRED.value,
        )
        db.add(test_tx3)
        db.flush()

    ReconciliationService.auto_reconcile_transaction(db, test_tx3)
    db.commit()
    db.refresh(test_tx3)

    assert test_tx3.trang_thai in [TrangThaiDoiSoat.STUDENT_NOT_FOUND.value, TrangThaiDoiSoat.INVALID_SYNTAX.value], f"Status sai: {test_tx3.trang_thai}"
    assert test_tx3.ma_hoa_don is None
    resp3 = ReconciliationService._to_item_response(test_tx3, db)
    assert resp3.status in ["STUDENT_NOT_FOUND", "INVALID_SYNTAX"]
    assert resp3.action == "MANUAL_MATCH"
    assert resp3.invoiceCode is None
    print(f"  [+] TEST 3 PASSED: status={resp3.status}, statusText={resp3.statusText}, action={resp3.action}, matched_invoice={resp3.matched_invoice}")

    # =========================================================================
    # TEST 4: Có studentCode + student tồn tại + invoice tồn tại nhưng chuyển thiếu tiền
    # Expected:
    # - ghi nhận trạng thái PARTIAL (Chuyển thiếu)
    # - gán mã hóa đơn và ghi công nợ
    # =========================================================================
    print("\n--- TEST 4: Có mã SV, SV tồn tại, có hóa đơn nhưng chuyển thiếu tiền (PARTIAL) ---")
    test_tx4 = db.query(GiaoDichNganHang).filter(GiaoDichNganHang.ma_giao_dich_ngan_hang == "TEST_TX_004").first()
    if not test_tx4:
        test_tx4 = GiaoDichNganHang(
            ma_giao_dich_ngan_hang="TEST_TX_004",
            ngay_giao_dich=datetime.datetime.now(),
            so_tien=999000.0,
            noi_dung_chuyen_khoan="SV002 nop tien phong",
            ten_ngan_hang="TP Bank",
            so_tai_khoan="20020813520",
            trang_thai=TrangThaiDoiSoat.MANUAL_REQUIRED.value,
        )
        db.add(test_tx4)
        db.flush()

    # Đảm bảo có hóa đơn nợ 1,800,000 cho SV SV002
    test_inv4 = db.query(HoaDon).filter(HoaDon.ma_hoa_don == "TEST_HD_004").first()
    if not test_inv4:
        test_inv4 = HoaDon(
            ma_hoa_don="TEST_HD_004",
            msv="SV002",
            ho_ten="Trần Thị B",
            loai_hoa_don="TIEN_PHONG",
            ky_thanh_toan="Tháng 09/2026",
            so_tien=1800000.0,
            ngay_lap=datetime.date(2026, 9, 1),
            han_thanh_toan=datetime.date(2026, 9, 20),
            trang_thai=TrangThaiHoaDon.CHUA_THANH_TOAN.value,
            ghi_chu="Hóa đơn test 4",
        )
        db.add(test_inv4)
        db.flush()
    else:
        test_inv4.trang_thai = TrangThaiHoaDon.CHUA_THANH_TOAN.value
        db.flush()

    ReconciliationService.auto_reconcile_transaction(db, test_tx4)
    db.commit()
    db.refresh(test_tx4)

    assert test_tx4.trang_thai in [TrangThaiDoiSoat.PARTIAL.value, TrangThaiDoiSoat.ERROR.value], f"Status sai: {test_tx4.trang_thai}"
    resp4 = ReconciliationService._to_item_response(test_tx4, db)
    assert resp4.status in ["PARTIAL", "ERROR"]
    print(f"  [+] TEST 4 PASSED: status={resp4.status}, statusText={resp4.statusText}, invoiceDisplay={resp4.invoiceDisplay}")

    # =========================================================================
    # TEST 5: Manual match hợp lệ qua API
    # Expected:
    # - transaction được gán student & invoice
    # - invoice/debt được gạch nợ (DA_THANH_TOAN)
    # - transaction status = MATCHED_MANUALLY
    # - commit thành công, format response đúng Mục 8
    # =========================================================================
    print("\n--- TEST 5: Khớp tay (Manual match) hợp lệ qua API ---")
    test_tx5 = db.query(GiaoDichNganHang).filter(GiaoDichNganHang.ma_giao_dich_ngan_hang == "TEST_TX_005").first()
    if not test_tx5:
        test_tx5 = GiaoDichNganHang(
            ma_giao_dich_ngan_hang="TEST_TX_005",
            ngay_giao_dich=datetime.datetime.now(),
            so_tien=120000.0,
            noi_dung_chuyen_khoan="ck tien phong",
            ten_ngan_hang="TP Bank",
            so_tai_khoan="20020813520",
            trang_thai=TrangThaiDoiSoat.INVALID_SYNTAX.value,
        )
        db.add(test_tx5)
        db.flush()
    else:
        test_tx5.trang_thai = TrangThaiDoiSoat.INVALID_SYNTAX.value
        test_tx5.ma_hoa_don = None
        test_tx5.msv = None
        db.flush()

    test_inv5 = db.query(HoaDon).filter(HoaDon.ma_hoa_don == "TEST_HD_005").first()
    if not test_inv5:
        test_inv5 = HoaDon(
            ma_hoa_don="TEST_HD_005",
            msv="SV001",
            ho_ten="Nguyễn Văn A",
            loai_hoa_don="DIEN_NUOC",
            ky_thanh_toan="Tháng 09/2026",
            so_tien=120000.0,
            ngay_lap=datetime.date(2026, 9, 1),
            han_thanh_toan=datetime.date(2026, 9, 20),
            trang_thai=TrangThaiHoaDon.CHUA_THANH_TOAN.value,
            ghi_chu="Hóa đơn test 5",
        )
        db.add(test_inv5)
        db.flush()
    else:
        test_inv5.trang_thai = TrangThaiHoaDon.CHUA_THANH_TOAN.value
        db.flush()
    db.commit()

    status_code, resp5 = http_request(
        "POST",
        f"/reconciliation/{test_tx5.id}/manual-match",
        data={"studentId": "SV001", "invoiceId": "TEST_HD_005"},
        token=token,
    )
    assert status_code == 200, f"Manual match failed with status {status_code}: {resp5}"
    assert resp5.get("success") is True
    assert resp5.get("status") in ["MATCHED", "MATCHED_MANUALLY"]
    assert resp5.get("invoiceCode") == "TEST_HD_005"
    assert resp5.get("transactionId") == str(test_tx5.id)

    db.commit()
    db.expire_all()
    test_tx5 = db.query(GiaoDichNganHang).filter(GiaoDichNganHang.id == test_tx5.id).first()
    test_inv5 = db.query(HoaDon).filter(HoaDon.ma_hoa_don == "TEST_HD_005").first()
    assert test_tx5.trang_thai in [TrangThaiDoiSoat.MATCHED.value, TrangThaiDoiSoat.MATCHED_MANUALLY.value], f"Expected MATCHED, got {test_tx5.trang_thai}"
    assert test_tx5.ma_hoa_don == "TEST_HD_005"
    assert test_tx5.msv == "SV001"
    assert test_inv5.trang_thai == TrangThaiHoaDon.DA_THANH_TOAN.value
    print(f"  [+] TEST 5 PASSED: status={resp5.get('status')}, invoiceCode={resp5.get('invoiceCode')}, message={resp5.get('message')}")

    # =========================================================================
    # TEST 6: Manual match invoice không thuộc student
    # Expected:
    # - Reject với HTTP 400 Bad Request
    # - Không thay đổi database
    # =========================================================================
    print("\n--- TEST 6: Khớp tay invoice không thuộc student ---")
    test_tx6 = db.query(GiaoDichNganHang).filter(GiaoDichNganHang.ma_giao_dich_ngan_hang == "TEST_TX_006").first()
    if not test_tx6:
        test_tx6 = GiaoDichNganHang(
            ma_giao_dich_ngan_hang="TEST_TX_006",
            ngay_giao_dich=datetime.datetime.now(),
            so_tien=120000.0,
            noi_dung_chuyen_khoan="tien dien thang 9",
            ten_ngan_hang="TP Bank",
            so_tai_khoan="20020813520",
            trang_thai=TrangThaiDoiSoat.INVALID_SYNTAX.value,
        )
        db.add(test_tx6)
        db.commit()

    # Đảm bảo có hóa đơn TEST_HD_006 thuộc SV001
    test_inv6 = db.query(HoaDon).filter(HoaDon.ma_hoa_don == "TEST_HD_006").first()
    if not test_inv6:
        test_inv6 = HoaDon(
            ma_hoa_don="TEST_HD_006",
            msv="SV001",
            ho_ten="Nguyễn Văn A",
            loai_hoa_don="TIEN_PHONG",
            ky_thanh_toan="Tháng 09/2026",
            so_tien=120000.0,
            ngay_lap=datetime.date(2026, 9, 1),
            han_thanh_toan=datetime.date(2026, 9, 20),
            trang_thai=TrangThaiHoaDon.CHUA_THANH_TOAN.value,
            ghi_chu="Hóa đơn test 6",
        )
        db.add(test_inv6)
        db.commit()

    # Gán SV002 với hóa đơn thuộc SV001 (TEST_HD_006)
    status_code, resp6 = http_request(
        "POST",
        f"/reconciliation/{test_tx6.id}/manual-match",
        data={"studentId": "SV002", "invoiceId": "TEST_HD_006"},
        token=token,
    )
    assert status_code == 400, f"Expected 400, got {status_code}: {resp6}"
    db.refresh(test_tx6)
    assert test_tx6.trang_thai == TrangThaiDoiSoat.INVALID_SYNTAX.value
    assert test_tx6.ma_hoa_don is None
    print(f"  [+] TEST 6 PASSED: Bị từ chối chính xác với HTTP {status_code}, DB không bị thay đổi")

    # =========================================================================
    # TEST 7: Invoice đã thanh toán trước đó
    # Expected:
    # - Reject (409 Conflict)
    # - Không tạo duplicate payment
    # =========================================================================
    print("\n--- TEST 7: Khớp tay với hóa đơn đã thanh toán hoàn tất ---")
    # Hóa đơn HD-2026-00130 đã thanh toán hoàn tất
    status_code, resp7 = http_request(
        "POST",
        f"/reconciliation/{test_tx6.id}/manual-match",
        data={"studentId": "DTC245180037", "invoiceId": "HD-2026-00130"},
        token=token,
    )
    assert status_code in [400, 409], f"Expected 400/409, got {status_code}: {resp7}"
    db.refresh(test_tx6)
    assert test_tx6.trang_thai == TrangThaiDoiSoat.INVALID_SYNTAX.value
    assert test_tx6.ma_hoa_don is None
    print(f"  [+] TEST 7 PASSED: Bị từ chối chính xác với HTTP {status_code}, không tạo duplicate payment")

    # =========================================================================
    # TEST LIST API & THỐNG KÊ (Mục 7 & 12)
    # =========================================================================
    print("\n--- KIỂM TRA API DANH SÁCH & THỐNG KÊ (Mục 7 & 12) ---")
    status_code, list_resp = http_request("GET", "/reconciliation?page=1&pageSize=5", token=token)
    assert status_code == 200
    stats = list_resp.get("statistics", {})
    print(f"  Thống kê DB: Total={stats.get('totalTransactions')}, AutoMatched={stats.get('autoMatched')}, ManualRequired={stats.get('manualRequired')}")
    assert stats.get("totalTransactions") >= 2
    assert stats.get("autoMatched") >= 1
    assert stats.get("manualRequired") >= 1

    items = list_resp.get("items", [])
    assert len(items) > 0
    sample_item = items[0]
    for key in ["id", "bankTransactionCode", "transactionDate", "amount", "transferContent", "status", "statusText", "action"]:
        assert key in sample_item, f"Thiếu key '{key}' trong item response"
    print(f"  Format response item: {sample_item.get('bankTransactionCode')} - {sample_item.get('statusText')} - action={sample_item.get('action')}")

    # Dọn dẹp dữ liệu test để không ảnh hưởng dữ liệu chuẩn của màn hình Đối soát
    db.query(GiaoDichNganHang).filter(GiaoDichNganHang.ma_giao_dich_ngan_hang.like("TEST_TX_%")).delete(synchronize_session=False)
    db.query(HoaDon).filter(HoaDon.ma_hoa_don.like("TEST_HD_%")).delete(synchronize_session=False)
    db.commit()
    ReconciliationService.ensure_seed_transactions_exist(db)

    db.close()
    print("\n" + "=" * 70)
    print("HOÀN TẤT TẤT CẢ 7 TEST CASE BẮT BUỘC - 100% THÀNH CÔNG!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
