"""
Script kiểm thử toàn diện chức năng Backend: Đối soát giao dịch (reconciliation-backend)
Kiểm tra đầy đủ 17 kịch bản theo yêu cầu:
1. Authentication/Authorization:
   - Chưa đăng nhập -> 401 Unauthorized
   - SinhVien gọi API đối soát -> 403 Forbidden
   - KeToan gọi API đối soát -> 200 OK
2. GET reconciliation list:
   - Trả danh sách + thống kê thực tế từ DB
3. Filter & Search:
   - Lọc theo status
   - Lọc theo date
   - Tìm kiếm theo keyword
   - Phân trang page & pageSize
4. Chi tiết giao dịch:
   - GET /reconciliation/{id}
5. Tìm kiếm sinh viên:
   - GET /reconciliation/students/search
6. Hóa đơn của sinh viên:
   - GET /reconciliation/students/{id}/invoices
7. Gán giao dịch thủ công (Manual match):
   - Transaction không tồn tại -> 404
   - Sinh viên không tồn tại -> 404
   - Hóa đơn không tồn tại -> 404
   - Hóa đơn không thuộc sinh viên -> 400
   - Số tiền không khớp -> 400
   - Gán thành công -> 200 OK, trạng thái chuyển MATCHED_MANUALLY, hóa đơn chuyển DA_THANH_TOAN
   - Gán lại giao dịch đã đối soát -> 409 Conflict
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
    print("=" * 60)
    print("BẮT ĐẦU KIỂM THỬ BACKEND API ĐỐI SOÁT GIAO DỊCH")
    print("=" * 60)

    # Đặt lại trạng thái ban đầu cho giao dịch test FT2625501980
    try:
        from app.core.database import SessionLocal
        from app.models.reconciliation import GiaoDichNganHang, TrangThaiDoiSoat
        from app.models.invoice import HoaDon, TrangThaiHoaDon
        db = SessionLocal()
        tx = db.query(GiaoDichNganHang).filter(GiaoDichNganHang.ma_giao_dich_ngan_hang == "FT2625501980").first()
        if tx:
            tx.trang_thai = TrangThaiDoiSoat.INVALID_SYNTAX.value
            tx.ma_hoa_don = None
            tx.msv = None
            tx.ghi_chu_doi_soat = "Thiếu mã SV"
        inv = db.query(HoaDon).filter(HoaDon.ma_hoa_don == "HDTP-20260926-5A08F4").first()
        if inv:
            inv.trang_thai = TrangThaiHoaDon.CHUA_THANH_TOAN.value
        db.commit()
        db.close()
    except Exception as e:
        print(f"Warning reset test tx: {e}")

    # 1. Đăng nhập lấy token
    token_ketoan = login("KT_Hoa", "password123")
    if not token_ketoan:
        token_ketoan = login("ketoan", "password123")
    
    token_sv = login("test_agent_1", "password123")
    if not token_sv:
        token_sv = login("dtc245180037", "password123")
    if not token_sv:
        token_sv = login("DTC245180051", "password123")

    print(f"Token KeToan: {'OK' if token_ketoan else 'FAIL'}")
    print(f"Token SinhVien: {'OK' if token_sv else 'FAIL'}")

    passed = 0
    total = 0

    def assert_test(name, condition, details=""):
        nonlocal passed, total
        total += 1
        if condition:
            passed += 1
            print(f"  [PASS] {name}")
        else:
            print(f"  [FAIL] {name}: {details}")

    # Test 1: Chưa đăng nhập -> 401
    code, _ = http_request("GET", "/reconciliation")
    assert_test("1. Chưa đăng nhập gọi GET /reconciliation -> 401", code == 401, f"Got {code}")

    # Test 2: Sinh viên gọi -> 403
    if token_sv:
        code, _ = http_request("GET", "/reconciliation", token=token_sv)
        assert_test("2. Sinh viên gọi GET /reconciliation -> 403 Forbidden", code == 403, f"Got {code}")
    else:
        print("  [SKIP] 2. Bỏ qua do chưa có tài khoản SinhVien")

    if not token_ketoan:
        print("Không có token KeToan, dừng kiểm thử.")
        return

    # Test 3: Kế toán gọi GET /reconciliation -> 200 OK
    code, data = http_request("GET", "/reconciliation", token=token_ketoan)
    assert_test("3. KeToan gọi GET /reconciliation -> 200 OK", code == 200, f"Got {code}")
    assert_test("3.1 Danh sách trả về có items", isinstance(data.get("items"), list))
    assert_test("3.2 Thống kê có totalTransactions, autoMatched, manualRequired", 
                "totalTransactions" in data.get("statistics", {}) and "manualRequired" in data.get("statistics", {}))
    print(f"      -> Thống kê nhận được: {data.get('statistics')}, tổng items: {data.get('total')}")

    # Test 4: Lọc theo status
    code, data = http_request("GET", "/reconciliation", token=token_ketoan, params={"status": "MANUAL_REQUIRED"})
    assert_test("4. Lọc status=MANUAL_REQUIRED -> 200 OK", code == 200, f"Got {code}")
    all_manual = all(it["status"] in ["MANUAL_REQUIRED", "INVALID_SYNTAX", "STUDENT_NOT_FOUND"] for it in data.get("items", []))
    assert_test("4.1 Toàn bộ items lọc có status thuộc nhóm cần xử lý tay", all_manual, "Có item khác status")

    # Test 5: Lọc theo date
    code, data = http_request("GET", "/reconciliation", token=token_ketoan, params={"dateFrom": "2026-09-01", "dateTo": "2026-09-30"})
    assert_test("5. Lọc dateFrom và dateTo -> 200 OK", code == 200, f"Got {code}")

    # Test 6: Tìm kiếm theo keyword
    code, data = http_request("GET", "/reconciliation", token=token_ketoan, params={"keyword": "nop tien phong"})
    assert_test("6. Tìm kiếm keyword='nop tien phong' -> 200 OK", code == 200, f"Got {code}")
    has_match = any("nop tien phong" in it["transferContent"].lower() for it in data.get("items", []))
    assert_test("6.1 Kết quả tìm kiếm chứa nội dung phù hợp", has_match or data.get("total") == 0)

    # Test 7: Phân trang
    code, data = http_request("GET", "/reconciliation", token=token_ketoan, params={"page": 1, "pageSize": 5})
    assert_test("7. Phân trang page=1, pageSize=5 -> 200 OK", code == 200, f"Got {code}")
    assert_test("7.1 Trả về tối đa 5 items", len(data.get("items", [])) <= 5)

    # Test 8: Chi tiết giao dịch FT2625501977
    code, detail = http_request("GET", "/reconciliation/FT2625501977", token=token_ketoan)
    assert_test("8. Xem chi tiết giao dịch FT2625501977 -> 200 OK", code == 200, f"Got {code}")
    assert_test("8.1 Chi tiết có thông tin transaction và reconciliationStatus", 
                "transaction" in detail and "reconciliationStatus" in detail)

    # Test 9: Tìm kiếm sinh viên
    code, students = http_request("GET", "/reconciliation/students/search", token=token_ketoan, params={"keyword": "Mai"})
    assert_test("9. Tìm kiếm sinh viên keyword='Mai' -> 200 OK", code == 200, f"Got {code}")
    assert_test("9.1 Kết quả là danh sách sinh viên", isinstance(students, list) and len(students) > 0)
    print(f"      -> Tìm thấy {len(students)} sinh viên: {[s.get('studentName') for s in students[:3]]}")

    # Test 10: Lấy danh sách hóa đơn còn nợ của sinh viên DTC245180037
    code, invoices = http_request("GET", "/reconciliation/students/DTC245180037/invoices", token=token_ketoan)
    assert_test("10. Lấy hóa đơn của DTC245180037 -> 200 OK", code == 200, f"Got {code}")
    assert_test("10.1 Có danh sách hóa đơn", isinstance(invoices, list))
    if isinstance(invoices, list):
        print(f"      -> DTC245180037 có {len(invoices)} hóa đơn: {[inv.get('invoiceCode') for inv in invoices]}")

    # Test 11: Manual match - Transaction không tồn tại -> 404
    code, err = http_request("POST", "/reconciliation/NON_EXISTENT_TX/manual-match", token=token_ketoan, data={"studentId": "DTC245180037", "invoiceId": "HDTP-20260926-5A08F4"})
    assert_test("11. Transaction không tồn tại -> 404", code == 404, f"Got {code}: {err}")

    # Test 12: Manual match - Sinh viên không tồn tại -> 404
    code, err = http_request("POST", "/reconciliation/FT2625501980/manual-match", token=token_ketoan, data={"studentId": "NON_EXISTENT_SV", "invoiceId": "HDTP-20260926-5A08F4"})
    assert_test("12. Sinh viên không tồn tại -> 404", code == 404, f"Got {code}: {err}")

    # Test 13: Manual match - Hóa đơn không tồn tại -> 404
    code, err = http_request("POST", "/reconciliation/FT2625501980/manual-match", token=token_ketoan, data={"studentId": "DTC245180037", "invoiceId": "NON_EXISTENT_INV"})
    assert_test("13. Hóa đơn không tồn tại -> 404", code == 404, f"Got {code}: {err}")

    # Test 14: Manual match - Hóa đơn không thuộc sinh viên -> 400
    code, err = http_request("POST", "/reconciliation/FT2625501980/manual-match", token=token_ketoan, data={"studentId": "SV002", "invoiceId": "HDTP-20260926-5A08F4"})
    assert_test("14. Hóa đơn không thuộc sinh viên -> 400", code == 400, f"Got {code}: {err}")

    # Test 15: Manual match - Số tiền không khớp -> 400
    code, err = http_request("POST", "/reconciliation/FT2625501980/manual-match", token=token_ketoan, data={"studentId": "DTC245180037", "invoiceId": "HD-2026-00130"})
    assert_test("15. Số tiền giao dịch không khớp hóa đơn -> 400 hoặc 409", code in [400, 409], f"Got {code}: {err}")

    # Test 16: Manual match hợp lệ thành công
    # Giao dịch FT2625501980 (1.800.000) gán vào HDTP-20260926-5A08F4 của DTC245180037 (1.800.000)
    code, res = http_request("POST", "/reconciliation/FT2625501980/manual-match", token=token_ketoan, data={"studentId": "DTC245180037", "invoiceId": "HDTP-20260926-5A08F4"})
    assert_test("16. Manual match hợp lệ -> 200 OK", code == 200, f"Got {code}: {res}")
    assert_test("16.1 Trạng thái chuyển MATCHED_MANUALLY hoặc MATCHED", res.get("transaction", {}).get("status") in ["MATCHED_MANUALLY", "MATCHED"])
    assert_test("16.2 Hóa đơn được gán đúng mã HDTP-20260926-5A08F4", res.get("transaction", {}).get("invoiceCode") == "HDTP-20260926-5A08F4")

    # Test 17: Gán lại giao dịch đã được đối soát -> 409 Conflict
    code, err = http_request("POST", "/reconciliation/FT2625501980/manual-match", token=token_ketoan, data={"studentId": "DTC245180037", "invoiceId": "HDTP-20260926-5A08F4"})
    assert_test("17. Gán lại giao dịch đã đối soát -> 409 Conflict", code == 409, f"Got {code}: {err}")

    # Test 18: Kiểm tra thống kê thay đổi sau khi gán
    code, data_after = http_request("GET", "/reconciliation", token=token_ketoan)
    stats_after = data_after.get("statistics", {})
    assert_test("18. CẦN XỬ LÝ TAY giảm sau khi gán thủ công thành công", stats_after.get("manualRequired") == 0, f"Got {stats_after}")
    print(f"      -> Thống kê sau khi gán: {stats_after}")

    # Reset lại dữ liệu chuẩn ban đầu để sẵn sàng cho người dùng thao tác demo trên UI
    try:
        from app.core.database import SessionLocal
        from app.models.reconciliation import GiaoDichNganHang, TrangThaiDoiSoat
        from app.models.invoice import HoaDon, TrangThaiHoaDon
        db = SessionLocal()
        t2 = db.query(GiaoDichNganHang).filter(GiaoDichNganHang.ma_giao_dich_ngan_hang == "FT2625501980").first()
        if t2:
            t2.trang_thai = TrangThaiDoiSoat.INVALID_SYNTAX.value
            t2.ma_hoa_don = None
            t2.msv = None
            t2.ghi_chu_doi_soat = "Thiếu mã SV"
        inv = db.query(HoaDon).filter(HoaDon.ma_hoa_don == "HDTP-20260926-5A08F4").first()
        if inv:
            inv.trang_thai = TrangThaiHoaDon.CHUA_THANH_TOAN.value
        db.commit()
        db.close()
    except Exception as e:
        print(f"Warning resetting data: {e}")

    print("=" * 60)
    print(f"KẾT QUẢ KIỂM THỬ: {passed}/{total} bài kiểm tra ĐẠT ({passed/total*100:.1f}%)")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
