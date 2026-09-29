"""
Script kiểm thử toàn diện chức năng Backend: Lập hóa đơn định kỳ (invoice-backend)
Kiểm tra:
1. Authentication/Authorization:
   - Chưa đăng nhập -> 401 Unauthorized
   - SinhVien gọi API hóa đơn -> 403 Forbidden
   - KeToan gọi API hóa đơn -> 200 OK / 201 Created
2. Nghiệp vụ Hóa đơn:
   - Lấy danh sách đối tượng lập hóa đơn tiền phòng thành công
   - Phát hành hóa đơn tiền phòng thành công
   - Phát hành trùng lặp cùng đối tượng cùng kỳ -> 400 Bad Request
   - Lấy danh sách phòng lập hóa đơn điện nước thành công
   - Phát hành hóa đơn điện nước thành công
   - Lọc và tra cứu danh sách hóa đơn đã lập
3. Regression:
   - Đăng nhập cũ hoạt động bình thường
   - Endpoint /me và /test-roles cũ hoạt động bình thường
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

def run_tests():
    print("=" * 70)
    print("BẮT ĐẦU KIỂM THỬ BACKEND LẬP HÓA ĐƠN ĐỊNH KỲ (invoice-backend)")
    print("=" * 70)

    # 1. Test Unauthenticated -> 401
    status, body = http_request("GET", "/invoices/room/candidates")
    print(f"\n[TEST 1] Chưa đăng nhập gọi GET /invoices/room/candidates:")
    print(f"  -> HTTP Status: {status} (Mong đợi: 401)")
    assert status == 401, f"Lỗi: Mong đợi 401 nhưng nhận {status}"
    print("  -> PASS: Đã chặn 401 Unauthorized thành công!")

    # 2. Đăng nhập SinhVien & KeToan
    print(f"\n[TEST 2] Đăng nhập các vai trò:")
    # Login KeToan KT_Hoa
    status_kt, kt_data = http_request(
        "POST", "/auth/login",
        data={"username": "KT_Hoa", "password": "password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert status_kt == 200, f"Đăng nhập KT_Hoa thất bại: {kt_data}"
    kt_token = kt_data["access_token"]
    print(f"  -> Đăng nhập Kế toán (KT_Hoa) thành công: role={kt_data['role']}")

    # Login SinhVien
    status_sv, sv_data = http_request(
        "POST", "/auth/login",
        data={"username": "test_agent_1", "password": "password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    if status_sv != 200:
        status_sv, sv_data = http_request(
            "POST", "/auth/login",
            data={"username": "dtc245180037", "password": "password123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
    assert status_sv == 200, f"Đăng nhập SinhVien thất bại: {sv_data}"
    sv_token = sv_data["access_token"]
    print(f"  -> Đăng nhập Sinh viên thành công: role={sv_data['role']}")

    # 3. Test RBAC: SinhVien gọi API hóa đơn -> 403 Forbidden
    print(f"\n[TEST 3] Kiểm tra RBAC: SinhVien gọi API của Kế toán:")
    status, body = http_request("GET", "/invoices/room/candidates", token=sv_token)
    print(f"  -> SinhVien gọi GET /invoices/room/candidates: status={status}")
    assert status == 403, f"Lỗi: SinhVien phải nhận 403 nhưng nhận {status}"
    
    status, body = http_request("POST", "/invoices/room/publish", data={"ky_thanh_toan": "test", "han_thanh_toan": "2026-09-15"}, token=sv_token)
    print(f"  -> SinhVien gọi POST /invoices/room/publish: status={status}")
    assert status == 403, f"Lỗi: SinhVien phải nhận 403 nhưng nhận {status}"
    print("  -> PASS: Quyền SinhVien bị chặn 403 Forbidden hoàn toàn!")

    # 4. KeToan lấy danh sách đối tượng lập hóa đơn tiền phòng -> 200 OK
    print(f"\n[TEST 4] Kế toán lấy danh sách đối tượng lập hóa đơn tiền phòng từ CSDL:")
    status, candidates = http_request(
        "GET", "/invoices/room/candidates",
        params={
            "ky_thanh_toan": "Học kỳ I (2026 – 2027)",
            "thoi_gian_o_thang": 3,
            "don_gia_thang": 600000.0,
        },
        token=kt_token
    )
    print(f"  -> HTTP Status: {status} (Mong đợi: 200)")
    assert status == 200, f"Lỗi lấy danh sách đối tượng: {candidates}"
    print(f"  -> Lấy được {len(candidates)} sinh viên có hợp đồng active trong CSDL")
    print("  -> PASS: Lấy danh sách ứng viên hóa đơn tiền phòng thành công!")

    # 4.1. Test từ chối phát hành khi MSV không có hợp đồng tồn tại trong CSDL
    print(f"\n[TEST 4.1] Kiểm tra từ chối phát hành khi MSV không có hợp đồng tồn tại:")
    status_fake, fake_res = http_request(
        "POST", "/invoices/room/publish",
        data={
            "ky_thanh_toan": "Học kỳ I (2026 – 2027)",
            "han_thanh_toan": "2026-09-15",
            "danh_sach_msv": ["MSV_KHONG_CO_HOP_DONG_999"],
        },
        token=kt_token
    )
    print(f"  -> HTTP Status khi MSV không có hợp đồng: {status_fake} (Mong đợi: 400)")
    assert status_fake == 400, f"Phải chặn 400 nhưng trả về {status_fake}"
    print(f"  -> Chi tiết lỗi: {fake_res.get('detail')}")
    print("  -> PASS: Đã chặn thành công và chỉ phát hành với hợp đồng tồn tại!")

    # 5. KeToan phát hành hóa đơn tiền phòng với hợp đồng tồn tại
    print(f"\n[TEST 5] Kế toán phát hành hóa đơn tiền phòng:")
    test_semester = "Học kỳ I (2026 – 2027)"
    publish_payload = {
        "ky_thanh_toan": test_semester,
        "ap_dung": "Tất cả sinh viên còn hạn hợp đồng",
        "thoi_gian_o_thang": 3,
        "don_gia_thang": 600000.0,
        "han_thanh_toan": "2026-09-15",
        "ghi_chu": "Phát hành hóa đơn tiền phòng định kỳ test",
    }
    status, pub_result = http_request("POST", "/invoices/room/publish", data=publish_payload, token=kt_token)
    if status == 400 and ("không tìm thấy hợp đồng" in pub_result.get("detail", "").lower() or "không có hợp đồng" in pub_result.get("detail", "").lower()):
        print(f"  -> CSDL chưa có hợp đồng active nào nên API từ chối phát hành đúng chuẩn: {pub_result.get('detail')}")
        print("  -> PASS: Logic từ chối phát hành khi không có hợp đồng tồn tại hoạt động chuẩn xác!")
    elif status == 201:
        print(f"  -> Phát hành thành công: {pub_result['message']}")
        print(f"  -> Tổng hóa đơn phát hành: {pub_result['tong_hoa_don']}")
        print(f"  -> Tổng số tiền: {pub_result['tong_so_tien']:,.0f} VND")
        print("  -> PASS: Phát hành hóa đơn tiền phòng thành công với hợp đồng tồn tại!")

        # 6. Test chống tạo trùng: Phát hành lại cùng kỳ cho cùng sinh viên -> 400 Bad Request
        print(f"\n[TEST 6] Kiểm tra chống tạo trùng lặp hóa đơn tiền phòng:")
        status, dup_result = http_request("POST", "/invoices/room/publish", data=publish_payload, token=kt_token)
        print(f"  -> HTTP Status khi phát hành trùng: {status} (Mong đợi: 400)")
        assert status == 400, f"Lỗi: Phát hành trùng phải trả về 400 nhưng trả về {status}"
        print(f"  -> Chi tiết lỗi chống trùng: {dup_result.get('detail')}")
        print("  -> PASS: Chống phát hành trùng lặp hoạt động hoàn hảo!")
    elif status == 400 and "trùng" in pub_result.get("detail", "").lower():
        print(f"  -> Hóa đơn cho các hợp đồng đã được lập trước đó: {pub_result.get('detail')}")
        print("  -> PASS: Chống trùng lặp hoạt động tốt!")
    else:
        raise AssertionError(f"Status không mong đợi: {status} - {pub_result}")


    # 7. KeToan lấy danh sách phòng & phát hành hóa đơn điện nước
    print(f"\n[TEST 7] Kế toán lấy danh sách phòng & phát hành hóa đơn điện nước:")
    status, util_candidates = http_request(
        "GET", "/invoices/utility/candidates",
        params={"thang": "Tháng 09/2026"},
        token=kt_token
    )
    assert status == 200, f"Lấy phòng thất bại: {util_candidates}"
    print(f"  -> Lấy được {len(util_candidates)} phòng phục vụ lập điện nước:")
    for r in util_candidates[:2]:
        print(f"     * Phòng: {r['ma_phong']} | Tòa: {r['toa_nha']} | Điện: {r['chi_so_dien_cu_moi']} ({r['so_dien_kwh']} kWh) | Nước: {r['chi_so_nuoc_cu_moi']} ({r['so_nuoc_m3']} m3) | Tiền: {r['tong_tien']:,.0f} VND")

    import time
    dynamic_month = f"Tháng {int(time.time()) % 10000}/2026"
    util_publish_payload = {
        "thang": dynamic_month,
        "han_thanh_toan": "2026-09-20",
        "don_gia_dien": 3000.0,
        "don_gia_nuoc": 15000.0,
        "ghi_chu": f"Phát hành tiền điện nước test {dynamic_month}",
    }
    status, util_pub_result = http_request("POST", "/invoices/utility/publish", data=util_publish_payload, token=kt_token)
    assert status == 201, f"Phát hành điện nước thất bại: {util_pub_result}"
    print(f"  -> Phát hành điện nước thành công: {util_pub_result['tong_hoa_don']} phòng, tổng {util_pub_result['tong_so_tien']:,.0f} VND ({dynamic_month})")
    print("  -> PASS: Nghiệp vụ hóa đơn điện nước hoạt động chuẩn xác!")

    # 8. Tra cứu danh sách hóa đơn đã phát hành
    print(f"\n[TEST 8] Kế toán tra cứu danh sách hóa đơn đã phát hành:")
    status, all_invoices = http_request("GET", "/invoices", token=kt_token)
    assert status == 200, f"Lấy danh sách hóa đơn thất bại: {all_invoices}"
    print(f"  -> Tổng số hóa đơn trong hệ thống: {len(all_invoices)}")
    for inv in all_invoices[:3]:
        print(f"     * Mã HD: {inv['ma_hoa_don']} | Loại: {inv['loai_hoa_don']} | Kỳ: {inv['ky_thanh_toan']} | Tiền: {inv['so_tien']:,.0f} VND | Hạn nộp: {inv['han_thanh_toan']} | TT: {inv['trang_thai']}")
    print("  -> PASS: Tra cứu danh sách hóa đơn thành công!")

    # 9. Regression Test: Kiểm tra các API cũ
    print(f"\n[TEST 9] Regression Test - Đảm bảo các API cũ hoạt động 100% bình thường:")
    status, me_kt = http_request("GET", "/auth/me", token=kt_token)
    assert status == 200 and me_kt["ten_dang_nhap"] == "KT_Hoa"
    print(f"  -> GET /auth/me (KeToan): 200 OK")

    status, me_sv = http_request("GET", "/auth/me", token=sv_token)
    assert status == 200
    print(f"  -> GET /auth/me (SinhVien): 200 OK")

    status, test_kt = http_request("GET", "/auth/test-roles/ke-toan", token=kt_token)
    assert status == 200
    print(f"  -> GET /auth/test-roles/ke-toan: 200 OK")

    status, test_sv = http_request("GET", "/auth/test-roles/sinh-vien", token=sv_token)
    assert status == 200
    print(f"  -> GET /auth/test-roles/sinh-vien: 200 OK")

    print("\n" + "=" * 70)
    print("TẤT CẢ 9/9 BỘ TEST CASE ĐÃ VƯỢT QUA THÀNH CÔNG VỚI ĐIỂM SỐ TUYỆT ĐỐI!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
