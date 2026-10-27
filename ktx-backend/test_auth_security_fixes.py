import sys
import uuid
import requests

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_URL = "http://127.0.0.1:8000/api/v1"

def log_test(name, passed, detail=""):
    mark = " [PASS]" if passed else " [FAIL]"
    print(f"{mark} {name}")
    if detail:
        print(f"       -> {detail}")

def test_unauthenticated_blocked_401():
    print("\n--- TEST 1: CHƯA ĐĂNG NHẬP BỊ CHẶN 401 ---")
    endpoints = [
        ("GET", "/admin/occupancy/requests"),
        ("GET", "/students"),
        ("GET", "/incidents/violations"),
        ("GET", "/invoices/room/candidates"),
        ("POST", "/student/requests/transfer"),
        ("POST", "/student/requests/checkout"),
        ("POST", "/incidents"),
    ]
    all_passed = True
    for method, ep in endpoints:
        url = f"{BASE_URL}{ep}"
        if method == "GET":
            res = requests.get(url)
        else:
            res = requests.post(url, json={})
        
        is_401 = (res.status_code == 401)
        detail = res.json().get("detail", "") if res.headers.get("content-type", "").startswith("application/json") else res.text
        log_test(f"{method} {ep} => HTTP {res.status_code}", is_401, f"Detail: {detail}")
        if not is_401:
            all_passed = False
    return all_passed

def test_register_role_escalation_blocked():
    print("\n--- TEST 2: ĐĂNG KÝ CHẶN TỰ PHONG QUYỀN (LUÔN RA SINHVIEN) ---")
    random_id = uuid.uuid4().hex[:6]
    test_username = f"sv_test_{random_id}"
    test_email = f"test_{random_id}@ictu.edu.vn"
    
    # Kẻ tấn công cố tình gửi role = "QuanLy" hoặc "Admin"
    payload = {
        "username": test_username,
        "password": "Password123@",
        "full_name": f"Hacker Escalate {random_id}",
        "email": test_email,
        "role": "QuanLy",
        "msv": f"DTC{random_id.upper()}",
    }
    
    res = requests.post(f"{BASE_URL}/auth/register", json=payload)
    if res.status_code != 201:
        log_test("Đăng ký tài khoản mới", False, f"HTTP {res.status_code}: {res.text}")
        return False
    
    user_data = res.json()
    actual_role = user_data.get("vai_tro")
    is_sinh_vien = (actual_role == "SinhVien")
    log_test("Client gửi role='QuanLy', Backend gán cứng SinhVien", is_sinh_vien, f"Created Role: {actual_role}")
    
    # Thử đăng nhập bằng tài khoản vừa tạo và kiểm tra role trong token
    login_res = requests.post(
        f"{BASE_URL}/auth/login",
        data={"username": test_username, "password": "Password123@"},
    )
    if login_res.status_code == 200:
        token_data = login_res.json()
        token_role = token_data.get("role")
        is_token_sv = (token_role == "SinhVien")
        log_test("Token JWT sau đăng nhập có role=SinhVien", is_token_sv, f"Token Role: {token_role}")
        return is_sinh_vien and is_token_sv
    else:
        log_test("Đăng nhập tài khoản mới", False, login_res.text)
        return False

def test_anti_idor_and_role_checker():
    print("\n--- TEST 3: CHỐNG IDOR KHI GỬI ĐƠN & PHÂN QUYỀN ROLECHECKER ---")
    random_id = uuid.uuid4().hex[:6]
    student_a_user = f"sva_{random_id}"
    student_a_msv = f"DTC245{random_id.upper()}"
    student_a_email = f"sva_{random_id}@ictu.edu.vn"
    
    # 1. Tạo tài khoản Sinh viên A
    reg_a = requests.post(
        f"{BASE_URL}/auth/register",
        json={
            "username": student_a_user,
            "password": "Password123@",
            "full_name": f"Sinh Viên A {random_id}",
            "email": student_a_email,
            "msv": student_a_msv,
        },
    )
    if reg_a.status_code != 201:
        log_test("Tạo tài khoản Sinh viên A", False, reg_a.text)
        return False
    
    # Đăng nhập lấy Token Sinh viên A
    login_a = requests.post(
        f"{BASE_URL}/auth/login",
        data={"username": student_a_user, "password": "Password123@"},
    )
    token_a = login_a.json().get("access_token")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Kiểm tra Sinh viên A cố truy cập API Quản lý -> Phải trả về 403 Forbidden
    res_admin = requests.get(f"{BASE_URL}/admin/occupancy/requests", headers=headers_a)
    is_403 = (res_admin.status_code == 403)
    log_test(
        "Sinh viên A truy cập API Quản lý (/admin/occupancy/requests) bị chặn 403",
        is_403,
        f"HTTP {res_admin.status_code}: {res_admin.json().get('detail', '')}"
    )

    # 3. Chống IDOR: Sinh viên A gửi đơn chuyển phòng, cố tình ghi MSV của Sinh viên B
    fake_victim_msv = "DTC_VICTIM_9999"
    transfer_payload = {
        "msv": fake_victim_msv,
        "ho_ten": "Sinh viên Nạn Nhân",
        "phong_hien_tai": "P101",
        "ly_do": "Xin chuyển phòng do ồn ào",
        "ngay_mong_muon": "2026-11-01",
        "phong_mong_muon": "P202",
        "mo_ta_chi_tiet": "IDOR Attack Test",
    }
    res_transfer = requests.post(
        f"{BASE_URL}/student/requests/transfer",
        json=transfer_payload,
        headers=headers_a,
    )
    transfer_saved_msv = None
    if res_transfer.status_code == 201:
        req_data = res_transfer.json().get("data", {})
        transfer_saved_msv = req_data.get("msv")
    
    idor_blocked_transfer = (transfer_saved_msv == student_a_msv)
    log_test(
        "Gửi đơn chuyển phòng: Client gửi MSV B nhưng đơn được lưu với MSV A",
        idor_blocked_transfer,
        f"Input MSV: {fake_victim_msv} => Saved MSV: {transfer_saved_msv}"
    )

    # 4. Chống IDOR: Sinh viên A gửi phản ánh sự cố, cố tình ghi MSV của Sinh viên B
    incident_payload = {
        "msv": fake_victim_msv,
        "ho_ten": "Sinh viên Nạn Nhân",
        "phong": "P101",
        "mo_ta": "Vòi nước trong phòng tắm bị rò rỉ nước liên tục",
        "tieu_de": "Hỏng vòi nước",
    }
    res_incident = requests.post(
        f"{BASE_URL}/incidents",
        json=incident_payload,
        headers=headers_a,
    )
    incident_saved_msv = None
    if res_incident.status_code == 201:
        inc_data = res_incident.json().get("data", {})
        incident_saved_msv = inc_data.get("msv")
    
    idor_blocked_incident = (incident_saved_msv == student_a_msv)
    log_test(
        "Gửi phản ánh sự cố: Client gửi MSV B nhưng phản ánh được lưu với MSV A",
        idor_blocked_incident,
        f"Input MSV: {fake_victim_msv} => Saved MSV: {incident_saved_msv}"
    )

    return is_403 and idor_blocked_transfer and idor_blocked_incident

if __name__ == "__main__":
    t1 = test_unauthenticated_blocked_401()
    t2 = test_register_role_escalation_blocked()
    t3 = test_anti_idor_and_role_checker()
    
    print("\n==========================================")
    if t1 and t2 and t3:
        print("TẤT CẢ TEST BẢO MẬT XÁC THỰC & PHÂN QUYỀN ĐỀU VƯỢT QUA (PASSED)!")
    else:
        print("MỘT SỐ TEST THẤT BẠI. VUI LÒNG KIỂM TRA LẠI CHI TIẾT.")
    print("==========================================")
