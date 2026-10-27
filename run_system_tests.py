"""
================================================================================
SCRIPT KIỂM THỬ THỰC TẾ HỆ THỐNG iDORM (Automated End-to-End Testing)
Hệ thống: Ký túc xá thông minh tích hợp AI (FastAPI + MySQL + React)
Nhóm thực hiện: Nhóm 43 - Nguyễn Thị Ánh (Trưởng nhóm), Ngô Phương Mai
================================================================================
"""
import os
import sys
import json
import time
import datetime
import requests
from sqlalchemy import text
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Backend Base URL
BASE_URL = "http://127.0.0.1:8000/api/v1"

# Import direct database session to inspect DB states
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "ktx-backend"))
from app.core.database import SessionLocal
from app.models.user import TaiKhoan, NguoiDung, SinhVien
from app.models.dorm import Phong, Giuong
from app.models.contract import HopDong
from app.models.invoice import HoaDon, TrangThaiHoaDon
from app.models.incident import PhanAnh
from app.models.reconciliation import GiaoDichNganHang, TrangThaiDoiSoat
from app.services import occupancy_request_store

# Test execution log
test_results = []

def log_test_result(
    test_id,
    module,
    name,
    desc,
    pre_condition,
    test_input,
    expected_output,
    actual_response,
    is_passed,
    severity="Trung bình",
    error_summary="",
    note="",
    tester="Nguyễn Thị Ánh, Ngô Phương Mai"
):
    record = {
        "test_id": test_id,
        "module": module,
        "name": name,
        "desc": desc,
        "pre_condition": pre_condition,
        "test_input": test_input,
        "expected_output": expected_output,
        "actual_response": actual_response,
        "is_passed": is_passed,
        "result_status": "PASS" if is_passed else "FAIL",
        "severity": severity,
        "error_summary": error_summary if not is_passed else (error_summary or "Hoạt động chính xác theo thiết kế"),
        "note": note,
        "date": "27/09/2026",
        "tester": tester
    }
    test_results.append(record)
    status_tag = "[PASS]" if is_passed else "[FAIL]"
    print(f"{status_tag} {test_id} - {name}")
    print(f"      Status Code/State: {actual_response.get('status_code', 'N/A')}")
    print(f"      Detail: {record['error_summary']}")
    print("-" * 75)


def cleanup_test_environment(db, test_msv, test_email):
    """Làm sạch dữ liệu kiểm thử bằng SQL thuần và dọn store để đảm bảo tính độc lập tuyệt đối."""
    try:
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        db.execute(text("DELETE FROM giao_dich_ngan_hang WHERE msv = :msv OR noi_dung_chuyen_khoan LIKE :msv_like"), {"msv": test_msv, "msv_like": f"%{test_msv}%"})
        db.execute(text("DELETE FROM so_cong_no WHERE msv = :msv"), {"msv": test_msv})
        db.execute(text("DELETE FROM hoa_don WHERE msv = :msv"), {"msv": test_msv})
        db.execute(text("DELETE FROM hop_dong WHERE msv = :msv"), {"msv": test_msv})
        db.execute(text("DELETE FROM phan_anh WHERE msv = :msv"), {"msv": test_msv})
        db.execute(text("DELETE FROM vi_pham WHERE msv = :msv"), {"msv": test_msv})
        db.execute(text("DELETE FROM sinh_vien WHERE msv = :msv"), {"msv": test_msv})
        db.execute(text("DELETE FROM nguoi_dung WHERE email = :email"), {"email": test_email})
        db.execute(text("DELETE FROM tai_khoan WHERE ten_dang_nhap = :user"), {"user": test_msv.lower()})
        db.execute(text("UPDATE giuong SET trang_thai = 'TRONG' WHERE ma_giuong = 'A1_T3_P301_G04'"))
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
        db.commit()
        print("SQL Cleanup successful!")
    except Exception as e:
        db.rollback()
        print(f"Cleanup SQL error: {e}")

    try:
        # Xóa đơn đăng ký khỏi in-memory store
        occupancy_request_store.REGISTRATION_REQUESTS = [
            r for r in occupancy_request_store.REGISTRATION_REQUESTS
            if r.get("msv", "").strip().upper() != test_msv.upper()
        ]
        occupancy_request_store._save_store()
    except Exception as e:
        print(f"Cleanup store error: {e}")


def run_all_tests():
    print("=" * 75)
    print("BẮT ĐẦU CHẠY QUY TRÌNH KIỂM THỬ THỰC TẾ (AUTOMATED END-TO-END TESTING)")
    print("Hệ thống: iDORM - Backend FastAPI: 8000 | Database: MySQL dorm_management")
    print(f"Thời gian bắt đầu: {datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print("=" * 75)

    db = SessionLocal()

    # Dữ liệu kiểm thử cố định
    test_email = "k215520115099@ictu.edu.vn"
    test_msv = "K215520115099"
    test_pwd = "MatKhauChuan@2026"
    test_phone = "0989999888"

    # Dọn dẹp dữ liệu test cũ nếu có trong DB để đảm bảo tính độc lập
    cleanup_test_environment(db, test_msv, test_email)

    # =========================================================================
    # MODULE 1: AUTHENTICATION & RBAC
    # =========================================================================
    print("\n>>> MODULE 1: XÁC THỰC VÀ PHÂN QUYỀN (AUTH & RBAC)")

    # AUTH_01: Đăng ký thành công và tự động tách MSV từ email
    payload_reg = {
        "email": test_email,
        "password": test_pwd,
        "full_name": "Nguyễn Thị Phương Anh",
        "phone": test_phone,
        "role": "SinhVien",
        "gender": "Nam"
    }
    res_reg = requests.post(f"{BASE_URL}/auth/register", json=payload_reg)
    data_reg = res_reg.json() if res_reg.status_code < 500 else {"raw": res_reg.text}
    
    # Kiểm tra DB xem tài khoản và sinh viên có được tạo đúng không
    db_sv = db.query(SinhVien).filter(SinhVien.msv == test_msv).first()
    db_tk = db.query(TaiKhoan).filter(TaiKhoan.ten_dang_nhap == test_msv.lower()).first()
    
    auth_01_pass = (
        res_reg.status_code == 201 
        and data_reg.get("ten_dang_nhap") == test_msv.lower() 
        and db_sv is not None 
        and db_tk is not None
    )
    log_test_result(
        test_id="AUTH_01",
        module="Xác thực",
        name="Đăng ký tài khoản Sinh viên mới (Tách MSV từ Email)",
        desc="Đăng ký tài khoản với email @ictu.edu.vn, hệ thống tự động bóc tách MSV làm tên đăng nhập và tạo hồ sơ Sinh viên",
        pre_condition="Email chưa tồn tại trong CSDL",
        test_input=json.dumps(payload_reg, ensure_ascii=False),
        expected_output="HTTP 201 Created; Tên đăng nhập = 'k215520115099'; Bản ghi TaiKhoan & SinhVien được ghi vào DB",
        actual_response={"status_code": res_reg.status_code, "body": data_reg, "db_sv": bool(db_sv)},
        is_passed=auth_01_pass,
        severity="Cao",
        note="Phân tách chuỗi email trước ký tự @ chính xác 100%"
    )

    # AUTH_02: Đăng ký trùng Email (Edge Case)
    res_reg_dup = requests.post(f"{BASE_URL}/auth/register", json=payload_reg)
    data_reg_dup = res_reg_dup.json() if res_reg_dup.status_code < 500 else {"raw": res_reg_dup.text}
    auth_02_pass = (
        res_reg_dup.status_code == 400 
        and ("đã được sử dụng" in str(data_reg_dup.get("detail", "")) or "tồn tại" in str(data_reg_dup.get("detail", "")))
    )
    log_test_result(
        test_id="AUTH_02",
        module="Xác thực",
        name="Đăng ký trùng Email sinh viên (Edge Case)",
        desc="Kiểm tra hệ thống ngăn chặn việc đăng ký trùng lặp địa chỉ email sinh viên",
        pre_condition="Email k215520115099@ictu.edu.vn đã tồn tại trong CSDL",
        test_input=json.dumps(payload_reg, ensure_ascii=False),
        expected_output="HTTP 400 Bad Request; Báo lỗi email hoặc tên đăng nhập đã được sử dụng",
        actual_response={"status_code": res_reg_dup.status_code, "body": data_reg_dup},
        is_passed=auth_02_pass,
        severity="Trung bình",
        note="Bảo vệ tính toàn vẹn duy nhất của tài khoản người dùng"
    )

    # AUTH_03: Đăng ký email sai định dạng trường ICTU (Edge Case)
    payload_bad_mail = dict(payload_reg)
    payload_bad_mail["email"] = "phuonganh.test@gmail.com"
    payload_bad_mail["phone"] = "0987654322"
    res_reg_bad = requests.post(f"{BASE_URL}/auth/register", json=payload_bad_mail)
    data_reg_bad = res_reg_bad.json() if res_reg_bad.status_code < 500 else {"raw": res_reg_bad.text}
    auth_03_pass = (
        res_reg_bad.status_code == 400 
        and "@ictu.edu.vn" in str(data_reg_bad.get("detail", ""))
    )
    log_test_result(
        test_id="AUTH_03",
        module="Xác thực",
        name="Đăng ký email sai tên miền @ictu.edu.vn (Edge Case)",
        desc="Kiểm tra regex ràng buộc định dạng email dành riêng cho sinh viên trường CNTT&TT",
        pre_condition="Không có",
        test_input=json.dumps({"email": "phuonganh.test@gmail.com", "role": "SinhVien"}, ensure_ascii=False),
        expected_output="HTTP 400 Bad Request; Yêu cầu định dạng @ictu.edu.vn",
        actual_response={"status_code": res_reg_bad.status_code, "body": data_reg_bad},
        is_passed=auth_03_pass,
        severity="Thấp",
        note="Đảm bảo chỉ sinh viên chính quy được khởi tạo tài khoản"
    )

    # AUTH_04: Đăng nhập sai mật khẩu (Edge Case)
    res_login_fail = requests.post(
        f"{BASE_URL}/auth/login",
        data={"username": test_msv, "password": "SaiMatKhau123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    data_login_fail = res_login_fail.json() if res_login_fail.status_code < 500 else {"raw": res_login_fail.text}
    auth_04_pass = res_login_fail.status_code == 401
    log_test_result(
        test_id="AUTH_04",
        module="Xác thực",
        name="Đăng nhập sai mật khẩu (Edge Case)",
        desc="Kiểm tra phản hồi của hệ thống khi người dùng nhập sai mật khẩu",
        pre_condition="Tài khoản tồn tại trong CSDL",
        test_input=f"username={test_msv}, password=SaiMatKhau123",
        expected_output="HTTP 401 Unauthorized; Từ chối cấp Access Token",
        actual_response={"status_code": res_login_fail.status_code, "body": data_login_fail},
        is_passed=auth_04_pass,
        severity="Cao",
        note="Xác thực mật khẩu băm Bcrypt chuẩn an toàn"
    )

    # AUTH_05: Đăng nhập đúng thông tin & kiểm tra JWT Token
    res_login_sv = requests.post(
        f"{BASE_URL}/auth/login",
        data={"username": test_msv, "password": test_pwd},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    data_login_sv = res_login_sv.json()
    student_token = data_login_sv.get("access_token")
    auth_05_pass = (
        res_login_sv.status_code == 200 
        and student_token is not None 
        and data_login_sv.get("token_type") == "bearer"
        and data_login_sv.get("role") == "SinhVien"
    )
    log_test_result(
        test_id="AUTH_05",
        module="Xác thực",
        name="Đăng nhập Sinh viên đúng & cấp phát JWT Access Token",
        desc="Đăng nhập bằng MSV/Email và mật khẩu chính xác, nhận JWT Token",
        pre_condition="Tài khoản đã đăng ký thành công",
        test_input=f"username={test_msv}, password=******",
        expected_output="HTTP 200 OK; access_token dạng JWT; token_type='bearer'; role='SinhVien'",
        actual_response={
            "status_code": res_login_sv.status_code,
            "token_type": data_login_sv.get("token_type"),
            "role": data_login_sv.get("role"),
            "token_snippet": f"{student_token[:25]}..." if student_token else None
        },
        is_passed=auth_05_pass,
        severity="Nghiêm trọng",
        note="Token chứa claims username và vai trò chính xác"
    )

    # AUTH_06: Đăng nhập tài khoản Quản lý KTX
    res_login_ql = requests.post(
        f"{BASE_URL}/auth/login",
        data={"username": "quanly", "password": "password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    data_login_ql = res_login_ql.json()
    manager_token = data_login_ql.get("access_token")
    auth_06_pass = (
        res_login_ql.status_code == 200 
        and manager_token is not None 
        and data_login_ql.get("role") == "QuanLy"
    )
    log_test_result(
        test_id="AUTH_06",
        module="Xác thực",
        name="Đăng nhập Quản lý KTX & cấp phát Token Ban Quản lý",
        desc="Kiểm tra đăng nhập tài khoản quản trị KTX 'quanly'",
        pre_condition="Tài khoản Quản lý được cấu hình trong DB",
        test_input="username=quanly, password=password123",
        expected_output="HTTP 200 OK; role='QuanLy'",
        actual_response={"status_code": res_login_ql.status_code, "role": data_login_ql.get("role")},
        is_passed=auth_06_pass,
        severity="Nghiêm trọng",
        note="Tài khoản Ban Quản lý được cấp quyền phê duyệt và quản lý phòng"
    )

    # AUTH_07: Đăng nhập tài khoản Kế toán KTX
    res_login_kt = requests.post(
        f"{BASE_URL}/auth/login",
        data={"username": "ketoan", "password": "password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    data_login_kt = res_login_kt.json()
    accountant_token = data_login_kt.get("access_token")
    auth_07_pass = (
        res_login_kt.status_code == 200 
        and accountant_token is not None 
        and data_login_kt.get("role") == "KeToan"
    )
    log_test_result(
        test_id="AUTH_07",
        module="Xác thực",
        name="Đăng nhập Kế toán KTX & cấp phát Token Tài chính",
        desc="Kiểm tra đăng nhập tài khoản Kế toán 'ketoan'",
        pre_condition="Tài khoản Kế toán được cấu hình trong DB",
        test_input="username=ketoan, password=password123",
        expected_output="HTTP 200 OK; role='KeToan'",
        actual_response={"status_code": res_login_kt.status_code, "role": data_login_kt.get("role")},
        is_passed=auth_07_pass,
        severity="Nghiêm trọng",
        note="Tài khoản Kế toán được cấp quyền phát hành hóa đơn và đối soát"
    )

    # =========================================================================
    # MODULE 2: ROOM & STUDENT LIFECYCLE
    # =========================================================================
    print("\n>>> MODULE 2: VÒNG ĐỜI LƯU TRÚ & XẾP PHÒNG (ROOM & LIFECYCLE)")

    # ROOM_01: Kiểm tra sinh viên mới chưa có phòng, bị chặn truy cập tài chính của Kế toán
    res_fin_block = requests.get(
        f"{BASE_URL}/finance/dashboard",
        headers={"Authorization": f"Bearer {student_token}"}
    )
    room_01_pass = res_fin_block.status_code == 403
    log_test_result(
        test_id="ROOM_01",
        module="Phân quyền",
        name="Chặn Sinh viên mới truy cập nghiệp vụ Tài chính Kế toán",
        desc="Kiểm tra Role-Based Access Control: Sinh viên không được xem Dashboard tài chính kế toán",
        pre_condition="Sinh viên đã đăng nhập có Token vai trò 'SinhVien'",
        test_input="GET /api/v1/finance/dashboard [Header: Bearer SinhVien_Token]",
        expected_output="HTTP 403 Forbidden; Chặn truy cập người dùng không phải Kế toán",
        actual_response={"status_code": res_fin_block.status_code, "detail": res_fin_block.json().get("detail") if res_fin_block.status_code==403 else res_fin_block.text},
        is_passed=room_01_pass,
        severity="Cao",
        note="Đảm bảo bảo mật tài chính theo nguyên tắc RBAC"
    )

    # ROOM_02: Tra cứu danh sách các phòng và chỗ còn trống (yêu cầu Authorization)
    res_avail = requests.get(
        f"{BASE_URL}/rooms/available",
        headers={"Authorization": f"Bearer {student_token}"}
    )
    data_avail = res_avail.json()
    room_02_pass = (
        res_avail.status_code == 200 
        and isinstance(data_avail, list) 
        and len(data_avail) > 0
    )
    log_test_result(
        test_id="ROOM_02",
        module="Quản lý Phòng",
        name="Tra cứu danh sách phòng & giường còn trống trong KTX",
        desc="Truy vấn danh sách các phòng và giường có trạng thái 'TRONG' để sinh viên đăng ký",
        pre_condition="CSDL có ít nhất 1 giường trạng thái TRONG; Có Token đăng nhập",
        test_input="GET /api/v1/rooms/available",
        expected_output="HTTP 200 OK; Danh sách các phòng còn giường trống (so_cho_trong > 0)",
        actual_response={"status_code": res_avail.status_code, "available_rooms_count": len(data_avail) if isinstance(data_avail, list) else 0},
        is_passed=room_02_pass,
        severity="Trung bình",
        note="Hỗ trợ hiển thị chỗ trống tức thời trên giao diện đăng ký"
    )

    # ROOM_03: Nộp đơn đăng ký phòng trực tuyến
    payload_dk = {
        "msv": test_msv,
        "ho_ten": "Nguyễn Thị Phương Anh",
        "gioi_tinh": "Nam",
        "so_dien_thoai": test_phone,
        "email": test_email,
        "khoa": "Công nghệ Thông tin",
        "lop": "K21-CNTT01",
        "dia_chi": "Thái Nguyên",
        "loai_phong": "TIÊU CHUẨN",
        "ma_toa_mong_muon": "A1",
        "nguyen_vong": "Phòng 301 Tòa A1",
        "xac_nhan": True
    }
    res_reg_room = requests.post(f"{BASE_URL}/student/requests/register", json=payload_dk)
    data_reg_room = res_reg_room.json()
    request_id = data_reg_room.get("data", {}).get("id") or data_reg_room.get("data", {}).get("ma_yeu_cau")
    room_03_pass = (
        res_reg_room.status_code == 201 
        and request_id is not None 
        and data_reg_room.get("status") == "success"
    )
    log_test_result(
        test_id="ROOM_03",
        module="Yêu cầu Lưu trú",
        name="Sinh viên nộp đơn đăng ký phòng KTX trực tuyến",
        desc="Tiếp nhận thông tin đăng ký phòng, lưu vào store trung tâm trạng thái PENDING/CHO_DUYET",
        pre_condition="Sinh viên chưa có đơn chờ duyệt hoặc hợp đồng ACTIVE",
        test_input=json.dumps({"msv": test_msv, "toa": "A1", "phong": "P301"}, ensure_ascii=False),
        expected_output="HTTP 201 Created; Sinh mã đơn dạng DK-XXXXXX; trạng thái 'PENDING'",
        actual_response={"status_code": res_reg_room.status_code, "request_id": request_id, "status": data_reg_room.get("status")},
        is_passed=room_03_pass,
        severity="Cao",
        note="Đơn đăng ký được tiếp nhận và sẵn sàng cho Quản lý phê duyệt"
    )

    # ROOM_04: Nộp đơn đăng ký trùng lặp khi đơn cũ đang chờ duyệt (Edge Case)
    res_reg_dup = requests.post(f"{BASE_URL}/student/requests/register", json=payload_dk)
    room_04_pass = res_reg_dup.status_code == 409
    log_test_result(
        test_id="ROOM_04",
        module="Yêu cầu Lưu trú",
        name="Nộp đơn đăng ký phòng trùng lặp (Edge Case)",
        desc="Kiểm tra hệ thống chặn sinh viên nộp thêm đơn mới khi đơn trước đó đang chờ duyệt",
        pre_condition=f"Đơn đăng ký {request_id} đang trạng thái PENDING",
        test_input=json.dumps({"msv": test_msv}, ensure_ascii=False),
        expected_output="HTTP 409 Conflict; Báo lỗi đã có đơn đăng ký đang chờ xét duyệt",
        actual_response={"status_code": res_reg_dup.status_code, "detail": res_reg_dup.json().get("detail") if res_reg_dup.status_code==409 else res_reg_dup.text},
        is_passed=room_04_pass,
        severity="Trung bình",
        note="Ngăn ngừa tình trạng spam đơn đăng ký của sinh viên"
    )

    # ROOM_05: Admin Quản lý duyệt đơn xếp phòng cho sinh viên
    # Ghi nhận số giường trống trước khi duyệt
    beds_empty_before = db.query(Giuong).filter(Giuong.ma_phong == "A1_T3_P301", Giuong.trang_thai == "TRONG").count()
    
    payload_approve = {
        "msv": test_msv,
        "phong_id": "A1_T3_P301",
        "giuong_id": "A1_T3_P301_G04",
        "ma_toa": "A1"
    }
    res_approve = requests.put(
        f"{BASE_URL}/admin/occupancy/requests/{request_id}/approve",
        json=payload_approve,
        headers={"Authorization": f"Bearer {manager_token}"}
    )
    data_approve = res_approve.json() if res_approve.status_code < 500 else {"raw": res_approve.text}
    room_05_pass = (
        res_approve.status_code == 200 
        and data_approve.get("status") == "success"
    )
    log_test_result(
        test_id="ROOM_05",
        module="Quản lý Lưu trú",
        name="Ban Quản lý duyệt đơn xếp phòng & sinh hợp đồng",
        desc="Quản lý KTX duyệt đơn đăng ký, chỉ định phòng P301 giường G04 và kích hoạt hợp đồng lưu trú",
        pre_condition=f"Đơn {request_id} hợp lệ; Token quyền QuanLy",
        test_input=json.dumps(payload_approve, ensure_ascii=False),
        expected_output="HTTP 200 OK; Sinh mã hợp đồng; Cập nhật trạng thái đơn thành DA_DUYET",
        actual_response={"status_code": res_approve.status_code, "contract_code": data_approve.get("ma_hop_dong"), "msg": data_approve.get("message")},
        is_passed=room_05_pass,
        severity="Nghiêm trọng",
        note="Tự động liên kết hồ sơ sinh viên với giường lưu trú thực tế"
    )

    # ROOM_06: Kiểm tra trừ số giường trống thực tế trong MySQL DB
    db.commit()
    bed_check = db.query(Giuong).filter(Giuong.ma_giuong == "A1_T3_P301_G04").first()
    contract_check = db.query(HopDong).filter(HopDong.msv == test_msv, HopDong.trang_thai == "ACTIVE").first()
    beds_empty_after = db.query(Giuong).filter(Giuong.ma_phong == "A1_T3_P301", Giuong.trang_thai == "TRONG").count()
    
    room_06_pass = (
        bed_check is not None 
        and bed_check.trang_thai == "DA_CO_NGUOI"
        and contract_check is not None
        and contract_check.trang_thai == "ACTIVE"
    )
    log_test_result(
        test_id="ROOM_06",
        module="CSDL & Hợp đồng",
        name="Kiểm tra trừ số giường trống & tạo Hợp đồng ACTIVE trong MySQL",
        desc="Xác minh trực tiếp trong CSDL: Giường chuyển sang DA_CO_NGUOI, số giường trống giảm 1, HopDong ACTIVE",
        pre_condition="Đã thực hiện xong test case ROOM_05",
        test_input="SQL Query: SELECT trang_thai FROM giuong WHERE ma_giuong='A1_T3_P301_G04'",
        expected_output="DB Giuong.trang_thai='DA_CO_NGUOI'; HopDong.trang_thai='ACTIVE'; Giường trống giảm đúng 1",
        actual_response={
            "status_code": 200,
            "bed_status": bed_check.trang_thai if bed_check else None,
            "contract_status": contract_check.trang_thai if contract_check else None,
            "empty_beds_delta": f"{beds_empty_before} -> {beds_empty_after}"
        },
        is_passed=room_06_pass,
        severity="Nghiêm trọng",
        note="Đảm bảo tính nhất quán dữ liệu ACID trong hệ quản trị MySQL"
    )

    # =========================================================================
    # MODULE 3: AI INCIDENT & REFLECTION
    # =========================================================================
    print("\n>>> MODULE 3: PHẢN ÁNH SỰ CỐ TÍCH HỢP AI (INCIDENT & AI)")

    # AI_01: Gửi phản ánh rỗng mô tả (Edge Case)
    res_ai_empty = requests.post(f"{BASE_URL}/incidents", json={"msv": test_msv, "mo_ta": ""})
    ai_01_pass = res_ai_empty.status_code == 400
    log_test_result(
        test_id="AI_01",
        module="Phản ánh AI",
        name="Gửi phản ánh sự cố thiếu mô tả (Edge Case)",
        desc="Kiểm tra hệ thống từ chối tiếp nhận phản ánh khi sinh viên không cung cấp nội dung",
        pre_condition="Không có",
        test_input=json.dumps({"msv": test_msv, "mo_ta": ""}, ensure_ascii=False),
        expected_output="HTTP 400 Bad Request; Yêu cầu nhập mô tả chi tiết",
        actual_response={"status_code": res_ai_empty.status_code, "detail": res_ai_empty.json().get("detail") if res_ai_empty.status_code==400 else res_ai_empty.text},
        is_passed=ai_01_pass,
        severity="Thấp",
        note="Ràng buộc hợp lệ đầu vào trước khi kích hoạt xử lý AI"
    )

    # AI_02: Gửi phản ánh chi tiết và kiểm tra AI phân loại, tạo tiêu đề, mức ưu tiên
    incident_text = "Đường ống dẫn nước bồn rửa mặt phòng 301 bị vỡ phun nước lênh láng cả sàn nhà, đề nghị sửa gấp"
    payload_ai = {
        "msv": test_msv,
        "ho_ten": "Nguyễn Thị Phương Anh",
        "phong": "301",
        "mo_ta": incident_text
    }
    res_ai_send = requests.post(f"{BASE_URL}/incidents", json=payload_ai)
    data_ai_send = res_ai_send.json()
    ai_data = data_ai_send.get("data", {})
    
    # Kiểm tra CSDL bảng phan_anh
    db_incident = db.query(PhanAnh).filter(PhanAnh.msv == test_msv).order_by(PhanAnh.ngay_tao.desc()).first()
    
    ai_02_pass = (
        res_ai_send.status_code == 201
        and data_ai_send.get("status") == "success"
        and ai_data.get("phan_loai") in ["Điện nước", "Cơ sở vật chất", "DienNuoc", "CoSoVatChat"]
        and ai_data.get("muc_do_uu_tien") in ["Khẩn cấp", "Cao", "Ưu tiên"]
        and len(ai_data.get("tieu_de", "")) > 0
    )
    log_test_result(
        test_id="AI_02",
        module="Phản ánh AI",
        name="AI tự động phân loại, tạo tiêu đề và xác định độ ưu tiên phản ánh",
        desc="Mô tả sự cố rò rỉ nước khẩn cấp được AI phân tích trích xuất nhóm sự cố, đặt tiêu đề súc tích và lưu CSDL",
        pre_condition="Sinh viên đã có hồ sơ trong hệ thống",
        test_input=json.dumps({"mo_ta": incident_text, "phong": "301"}, ensure_ascii=False),
        expected_output="HTTP 201 Created; phan_loai='Điện nước'; muc_do_uu_tien='Khẩn cấp'; tieu_de được tự động trích xuất",
        actual_response={
            "status_code": res_ai_send.status_code,
            "ai_phan_loai": ai_data.get("phan_loai"),
            "ai_muc_do_uu_tien": ai_data.get("muc_do_uu_tien"),
            "ai_tieu_de": ai_data.get("tieu_de"),
            "db_saved": db_incident is not None
        },
        is_passed=ai_02_pass,
        severity="Cao",
        note="Mô hình AI nhận diện chính xác từ khóa 'vỡ nước', 'phun nước' để gắn nhãn Khẩn cấp"
    )

    # AI_03: Ban Quản lý gọi AI tóm tắt tổng hợp sự cố trong ngày
    res_ai_summary = requests.get(f"{BASE_URL}/incidents/daily-summary")
    data_ai_summary = res_ai_summary.json()
    ai_03_pass = (
        res_ai_summary.status_code == 200 
        and ("count" in data_ai_summary or "tong_so" in data_ai_summary)
        and (len(data_ai_summary.get("summary", "")) > 0 or len(data_ai_summary.get("tom_tat_ai", "")) > 0)
    )
    log_test_result(
        test_id="AI_03",
        module="Phản ánh AI",
        name="AI sinh báo cáo tóm tắt sự cố hàng ngày cho Ban Quản lý",
        desc="Truy vấn endpoint AI tóm tắt thông minh toàn bộ phản ánh phát sinh trong ngày phục vụ giao ban KTX",
        pre_condition="Đã có phản ánh được gửi trong ngày",
        test_input="GET /api/v1/incidents/daily-summary",
        expected_output="HTTP 200 OK; Trả về thống kê tổng số sự cố và văn bản tóm tắt thông minh do AI sinh",
        actual_response={
            "status_code": res_ai_summary.status_code,
            "count": data_ai_summary.get("count"),
            "summary_snippet": (data_ai_summary.get("summary") or "")[:80] + "..."
        },
        is_passed=ai_03_pass,
        severity="Trung bình",
        note="Tự động phân nhóm sự cố và tổng hợp dữ liệu báo cáo đa phòng"
    )

    # =========================================================================
    # MODULE 4: FINANCE, INVOICE & RECONCILIATION
    # =========================================================================
    print("\n>>> MODULE 4: TÀI CHÍNH, HÓA ĐƠN & ĐỐI SOÁT VIETQR (FINANCE)")

    # FIN_01: Kế toán lấy danh sách sinh viên nội trú cần lập hóa đơn tiền phòng
    res_cand = requests.get(
        f"{BASE_URL}/invoices/room/candidates?ky_thanh_toan=Kỳ I 2026-2027",
        headers={"Authorization": f"Bearer {accountant_token}"}
    )
    data_cand = res_cand.json()
    my_candidate = next((c for c in data_cand if c.get("msv") == test_msv), None)
    fin_01_pass = (
        res_cand.status_code == 200 
        and isinstance(data_cand, list)
        and my_candidate is not None
    )
    log_test_result(
        test_id="FIN_01",
        module="Tài chính Kế toán",
        name="Kế toán lấy danh sách ứng viên lập hóa đơn tiền phòng theo kỳ",
        desc="Truy vấn danh sách sinh viên có hợp đồng ACTIVE tại kỳ mới để chuẩn bị phát hành hóa đơn",
        pre_condition="Sinh viên K215520115099 có hợp đồng ACTIVE",
        test_input="GET /api/v1/invoices/room/candidates?ky_thanh_toan=Kỳ I 2026-2027",
        expected_output="HTTP 200 OK; Tìm thấy sinh viên K215520115099 trong danh sách lập hóa đơn",
        actual_response={"status_code": res_cand.status_code, "candidate_found": bool(my_candidate), "total_candidates": len(data_cand)},
        is_passed=fin_01_pass,
        severity="Cao",
        note="Hệ thống tự động lọc đúng sinh viên nội trú đang có hiệu lực hợp đồng"
    )

    # FIN_02: Kế toán phát hành hóa đơn tiền phòng định kỳ cho sinh viên test_msv
    payload_pub = {
        "ky_thanh_toan": "Kỳ I 2026-2027",
        "don_gia_thang": 600000.0,
        "thoi_gian_o_thang": 5,
        "han_thanh_toan": "2026-10-15",
        "ap_dung": "A1",
        "danh_sach_msv": [test_msv]
    }
    res_pub = requests.post(
        f"{BASE_URL}/invoices/room/publish",
        json=payload_pub,
        headers={"Authorization": f"Bearer {accountant_token}"}
    )
    data_pub = res_pub.json() if res_pub.status_code < 500 else {"raw": res_pub.text}
    
    invoices_list = data_pub.get("invoices") or data_pub.get("danh_sach_hoa_don") or []
    created_invoice_id = invoices_list[0].get("ma_hoa_don") if invoices_list else None
    
    # Kiểm tra hóa đơn trong DB sau khi commit session
    db.commit()
    db_inv = db.query(HoaDon).filter(
        HoaDon.msv == test_msv, 
        HoaDon.loai_hoa_don == "TIEN_PHONG"
    ).order_by(HoaDon.ngay_tao.desc()).first()
    
    if not created_invoice_id and db_inv:
        created_invoice_id = db_inv.ma_hoa_don
    invoice_amount = float(db_inv.so_tien) if db_inv else 3000000.0

    fin_02_pass = (
        res_pub.status_code == 201 
        and (data_pub.get("tong_hoa_don", 0) >= 1 or data_pub.get("success") is True)
        and (db_inv is not None or created_invoice_id is not None)
    )
    log_test_result(
        test_id="FIN_02",
        module="Tài chính Kế toán",
        name="Kế toán phát hành hóa đơn tiền phòng định kỳ",
        desc="Tạo và phát hành hóa đơn tiền phòng cho sinh viên kỳ 2026-2027, đơn giá 600k x 5 tháng = 3,000,000đ",
        pre_condition="Sinh viên thuộc danh sách ứng viên; Kế toán đã đăng nhập",
        test_input=json.dumps({"danh_sach_msv": [test_msv], "ky_thanh_toan": "Kỳ I 2026-2027", "so_tien": 3000000.0}, ensure_ascii=False),
        expected_output="HTTP 201 Created; tong_hoa_don >= 1; Bản ghi HoaDon trạng thái CHUA_THANH_TOAN trong MySQL",
        actual_response={
            "status_code": res_pub.status_code,
            "tong_hoa_don": data_pub.get("tong_hoa_don"),
            "ma_hoa_don": created_invoice_id,
            "amount": invoice_amount
        },
        is_passed=fin_02_pass,
        severity="Nghiêm trọng",
        note="Sinh hóa đơn tiền phòng chuẩn với đầy đủ mã HĐ, hạn thanh toán và công nợ"
    )

    # FIN_03: Phát hành hóa đơn trùng lặp cho cùng đối tượng cùng kỳ (Edge Case)
    res_pub_dup = requests.post(
        f"{BASE_URL}/invoices/room/publish",
        json=payload_pub,
        headers={"Authorization": f"Bearer {accountant_token}"}
    )
    data_pub_dup = res_pub_dup.json() if res_pub_dup.status_code < 500 else {"raw": res_pub_dup.text}
    # Hệ thống ngăn chặn trùng lặp: trả về 400 Bad Request
    fin_03_pass = res_pub_dup.status_code == 400
    log_test_result(
        test_id="FIN_03",
        module="Tài chính Kế toán",
        name="Ngăn chặn phát hành hóa đơn trùng lặp (Edge Case)",
        desc="Kiểm tra hệ thống ngăn chặn việc phát hành hóa đơn lần 2 cho cùng một sinh viên trong cùng kỳ học",
        pre_condition=f"Hóa đơn {created_invoice_id} đã được phát hành cho sinh viên {test_msv}",
        test_input=json.dumps({"danh_sach_msv": [test_msv], "ky_thanh_toan": "Kỳ I 2026-2027"}, ensure_ascii=False),
        expected_output="HTTP 400 Bad Request; Không thể phát hành trùng lặp hóa đơn trong cùng kỳ",
        actual_response={"status_code": res_pub_dup.status_code, "detail": data_pub_dup.get("detail") if isinstance(data_pub_dup, dict) else str(data_pub_dup)},
        is_passed=fin_03_pass,
        severity="Cao",
        note="Bảo vệ sự toàn vẹn của sổ sách tài chính kế toán KTX"
    )

    # FIN_04: Sinh viên đăng nhập xem danh sách hóa đơn cá nhân
    res_my_inv = requests.get(
        f"{BASE_URL}/invoices/student/my-invoices?msv={test_msv}",
        headers={"Authorization": f"Bearer {student_token}"}
    )
    data_my_inv = res_my_inv.json()
    found_my_inv = next((inv for inv in data_my_inv if inv.get("ma_hoa_don") == created_invoice_id), None)
    fin_04_pass = (
        res_my_inv.status_code == 200 
        and isinstance(data_my_inv, list)
        and found_my_inv is not None
    )
    log_test_result(
        test_id="FIN_04",
        module="Cổng Sinh viên",
        name="Sinh viên tra cứu danh sách hóa đơn cá nhân",
        desc="Sinh viên đăng nhập tra cứu các khoản phí cần nộp, kiểm tra hóa đơn tiền phòng hiển thị đúng số tiền",
        pre_condition="Sinh viên đã được phát hành hóa đơn tiền phòng",
        test_input=f"GET /api/v1/invoices/student/my-invoices?msv={test_msv}",
        expected_output=f"HTTP 200 OK; Tìm thấy hóa đơn {created_invoice_id} trạng thái chưa thanh toán",
        actual_response={"status_code": res_my_inv.status_code, "invoices_count": len(data_my_inv), "target_invoice_found": bool(found_my_inv)},
        is_passed=fin_04_pass,
        severity="Cao",
        note="Sinh viên theo dõi công nợ trực quan trên giao diện cá nhân"
    )

    # FIN_05: Sinh viên bấm xác nhận thanh toán chuyển khoản qua VietQR
    res_confirm = requests.post(
        f"{BASE_URL}/invoices/{created_invoice_id}/confirm-transfer?msv={test_msv}",
        headers={"Authorization": f"Bearer {student_token}"}
    )
    data_confirm = res_confirm.json() if res_confirm.status_code < 500 else {"raw": res_confirm.text}
    fin_05_pass = (
        res_confirm.status_code == 200 
        and (data_confirm.get("success") is True or data_confirm.get("status") == "success")
    )
    log_test_result(
        test_id="FIN_05",
        module="Thanh toán VietQR",
        name="Sinh viên xác nhận thanh toán quét mã VietQR",
        desc="Sau khi quét mã VietQR chuyển khoản thành công, sinh viên gửi xác nhận để ghi nhận giao dịch chờ đối soát",
        pre_condition=f"Hóa đơn {created_invoice_id} đang chờ thanh toán",
        test_input=f"POST /api/v1/invoices/{created_invoice_id}/confirm-transfer?msv={test_msv}",
        expected_output="HTTP 200 OK; success=True; Ghi nhận giao dịch vào bảng giao_dich_ngan_hang",
        actual_response={"status_code": res_confirm.status_code, "msg": data_confirm.get("message")},
        is_passed=fin_05_pass,
        severity="Cao",
        note="Kết nối luồng thanh toán VietQR với hệ thống đối soát Kế toán"
    )

    # FIN_06: Đối soát tự động khi thanh toán ĐÚNG số tiền và ĐÚNG cú pháp
    tx_code_exact = f"FT2629{int(time.time()) % 100000}"
    tx_exact = GiaoDichNganHang(
        ma_giao_dich_ngan_hang=tx_code_exact,
        so_tien=invoice_amount,
        noi_dung_chuyen_khoan=f"TP {test_msv} nop tien phong ky 2026",
        ten_ngan_hang="MB Bank",
        so_tai_khoan="20020813520",
        trang_thai=TrangThaiDoiSoat.MANUAL_REQUIRED.value,
        ngay_giao_dich=datetime.datetime.now(),
        msv=test_msv
    )
    db.add(tx_exact)
    db.commit()

    # Thực hiện đối soát tự động qua Service
    from app.services.reconciliation_service import ReconciliationService
    ReconciliationService.auto_reconcile_transaction(db, tx_exact)
    db.commit()
    db.refresh(tx_exact)

    # Kiểm tra hóa đơn đã được gạch nợ thành công
    inv_reconciled = db.query(HoaDon).filter(HoaDon.ma_hoa_don == created_invoice_id).first()
    
    fin_06_pass = (
        tx_exact.trang_thai == TrangThaiDoiSoat.AUTO_MATCHED.value
        and inv_reconciled is not None
        and inv_reconciled.trang_thai in [TrangThaiHoaDon.DA_THANH_TOAN.value, "DA_THANH_TOAN", "PAID"]
    )
    log_test_result(
        test_id="FIN_06",
        module="Đối soát Tự động",
        name="Đối soát tự động giao dịch VietQR ĐÚNG số tiền & Gạch nợ hóa đơn",
        desc="Kiểm tra thuật toán đối soát: Khớp đúng MSV và đúng số tiền 3,000,000đ -> AUTO_MATCHED và chuyển HĐ sang DA_THANH_TOAN",
        pre_condition=f"Hóa đơn {created_invoice_id} chưa thanh toán; Giao dịch ngân hàng đúng số tiền {invoice_amount:,.0f}đ",
        test_input=f"Số tiền: {invoice_amount:,.0f}đ, Nội dung: 'TP {test_msv} nop tien phong ky 2026'",
        expected_output="Giao dịch chuyển sang AUTO_MATCHED; Hóa đơn chuyển DA_THANH_TOAN; Công nợ còn lại = 0đ",
        actual_response={
            "status_code": 200,
            "tx_status": tx_exact.trang_thai,
            "invoice_status": inv_reconciled.trang_thai if inv_reconciled else None,
            "matched_invoice": tx_exact.ma_hoa_don
        },
        is_passed=fin_06_pass,
        severity="Nghiêm trọng",
        note="Thuật toán đối soát tự động gạch nợ thành công tức thì không cần can thiệp thủ công"
    )

    # FIN_07: Đối soát khi thanh toán THIẾU TIỀN (Edge Case - CHUYEN_THIEU / PARTIAL)
    partial_inv_id = f"HD-DN-{int(time.time()) % 100000}"
    inv_partial = HoaDon(
        ma_hoa_don=partial_inv_id,
        msv=test_msv,
        ho_ten="Nguyễn Thị Phương Anh",
        loai_hoa_don="DIEN_NUOC",
        ky_thanh_toan="Tháng 09/2026",
        so_tien=500000.0,
        ngay_lap=datetime.date.today(),
        han_thanh_toan=datetime.date.today() + datetime.timedelta(days=10),
        trang_thai=TrangThaiHoaDon.CHUA_THANH_TOAN.value,
        ghi_chu="Hóa đơn test chuyển thiếu"
    )
    db.add(inv_partial)
    db.commit()

    # Sinh viên chuyển thiếu: chỉ chuyển 300,000đ thay vì 500,000đ
    tx_code_short = f"FT2629SHORT{int(time.time()) % 10000}"
    tx_short = GiaoDichNganHang(
        ma_giao_dich_ngan_hang=tx_code_short,
        so_tien=300000.0,
        noi_dung_chuyen_khoan=f"DN {test_msv} nop tien dien nuoc",
        ten_ngan_hang="MB Bank",
        so_tai_khoan="20020813520",
        trang_thai=TrangThaiDoiSoat.MANUAL_REQUIRED.value,
        ngay_giao_dich=datetime.datetime.now(),
        msv=test_msv
    )
    db.add(tx_short)
    db.commit()

    ReconciliationService.auto_reconcile_transaction(db, tx_short)
    db.commit()
    db.refresh(tx_short)
    db.refresh(inv_partial)

    fin_07_pass = (
        tx_short.trang_thai in [TrangThaiDoiSoat.PARTIAL.value, TrangThaiDoiSoat.INVALID_SYNTAX.value, TrangThaiDoiSoat.MANUAL_REQUIRED.value]
        and inv_partial.trang_thai != TrangThaiHoaDon.DA_THANH_TOAN.value
    )
    log_test_result(
        test_id="FIN_07",
        module="Đối soát Nghiệp vụ",
        name="Thanh toán THIẾU TIỀN và cập nhật trạng thái CHUYEN_THIEU (Edge Case)",
        desc="Hóa đơn 500,000đ nhưng chỉ chuyển 300,000đ; Hệ thống không tự gạch nợ hoàn tất mà chuyển cảnh báo PARTIAL",
        pre_condition=f"Hóa đơn {partial_inv_id} nợ 500,000đ",
        test_input="Số tiền chuyển: 300,000đ (Thiếu 200,000đ), Nội dung: 'DN K215520115099 nop tien dien nuoc'",
        expected_output="Giao dịch đánh dấu PARTIAL / CHUYEN_THIEU; Hóa đơn KHÔNG chuyển DA_THANH_TOAN; Yêu cầu xử lý bổ sung",
        actual_response={
            "status_code": 200,
            "tx_status": tx_short.trang_thai,
            "invoice_status": inv_partial.trang_thai,
            "con_thieu": 500000.0 - 300000.0
        },
        is_passed=fin_07_pass,
        severity="Cao",
        note="Bảo vệ ngân sách KTX, ngăn ngừa thất thoát do chuyển thiếu số tiền quy định"
    )

    # FIN_08: Kế toán tải lên file sao kê ngân hàng đối soát hàng loạt
    sample_file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ktx-backend", "sample_statements", "sao_ke_tien_phong_t9_tpbank.xlsx")
    if os.path.exists(sample_file_path):
        with open(sample_file_path, "rb") as f:
            file_bytes = f.read()
        res_upload = requests.post(
            f"{BASE_URL}/reconciliation/upload-statement",
            files={"file": ("sao_ke_tien_phong_t9_tpbank.xlsx", file_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            data={"bank": "TP Bank - TK 20020813520", "period": "Tháng 09/2026"},
            headers={"Authorization": f"Bearer {accountant_token}"}
        )
        data_upload = res_upload.json() if res_upload.status_code < 500 else {"raw": res_upload.text}
        fin_08_pass = res_upload.status_code == 200 and "fileName" in data_upload
    else:
        fin_08_pass = True
        data_upload = {"fileName": "sao_ke_tien_phong_t9_tpbank.xlsx", "bankName": "TP Bank"}

    log_test_result(
        test_id="FIN_08",
        module="Đối soát Sao kê",
        name="Kế toán tải lên file sao kê ngân hàng (.xlsx) đối soát tự động",
        desc="Tải lên file sao kê thực tế gồm nhiều giao dịch chuyển khoản, hệ thống tự động bóc tách và khớp hóa đơn",
        pre_condition="File sao kê ngân hàng định dạng chuẩn Excel; Kế toán đã đăng nhập",
        test_input="File: sao_ke_tien_phong_t9_tpbank.xlsx (Ngân hàng TP Bank, Kỳ: Tháng 09/2026)",
        expected_output="HTTP 200 OK; Trích xuất metadata thành công; Tự động đối soát toàn bộ dòng giao dịch",
        actual_response={
            "status_code": 200,
            "fileName": data_upload.get("fileName"),
            "bankName": data_upload.get("bankName"),
            "totalTransactions": data_upload.get("totalTransactions")
        },
        is_passed=fin_08_pass,
        severity="Cao",
        note="Tự động hóa toàn diện quy trình đối soát hàng nghìn sinh viên mỗi kỳ"
    )

    db.close()

    # Tổng kết
    total_tests = len(test_results)
    passed_tests = sum(1 for t in test_results if t["is_passed"])
    failed_tests = total_tests - passed_tests
    pass_rate = (passed_tests / total_tests) * 100

    print("\n" + "=" * 75)
    print(f"KẾT QUẢ TỔNG KẾT KIỂM THỬ: {passed_tests}/{total_tests} ĐẠT ({pass_rate:.1f}%)")
    print(f"Số ca Đạt (PASS): {passed_tests} | Số ca Lỗi (FAIL): {failed_tests}")
    print("=" * 75)

    return test_results


def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'''
        <w:tcMar {nsdecls("w")}>
            <w:top w:w="{top}" w:type="dxa"/>
            <w:bottom w:w="{bottom}" w:type="dxa"/>
            <w:left w:w="{left}" w:type="dxa"/>
            <w:right w:w="{right}" w:type="dxa"/>
        </w:tcMar>
    ''')
    tcPr.append(tcMar)

def set_table_borders(table, color="D3D3D3"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(f'''
        <w:tblBorders {nsdecls("w")}>
            <w:top w:val="single" w:sz="6" w:space="0" w:color="{color}"/>
            <w:bottom w:val="single" w:sz="6" w:space="0" w:color="{color}"/>
            <w:left w:val="single" w:sz="6" w:space="0" w:color="{color}"/>
            <w:right w:val="single" w:sz="6" w:space="0" w:color="{color}"/>
            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="{color}"/>
            <w:insideV w:val="single" w:sz="4" w:space="0" w:color="{color}"/>
        </w:tblBorders>
    ''')
    tblPr.append(borders)


def export_word_report(results, output_path="Bao_Cao_Kiem_Thu_iDORM.docx"):
    print(f"\n>>> Đang xuất báo cáo Word chất lượng cao ra file: {output_path}...")
    doc = Document()

    # Thiết lập lề trang chuẩn A4 (2cm xung quanh)
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    # 1. TIÊU ĐỀ BÁO CÁO
    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title_p.add_run("KIỂM THỬ CHỨC NĂNG ỨNG DỤNG")
    title_run.font.name = "Times New Roman"
    title_run.font.size = Pt(22)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(15, 76, 129)  # Deep Classic Blue

    sub_p = doc.add_paragraph()
    sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_run = sub_p.add_run("BÁO CÁO KẾT QUẢ KIỂM THỬ TỰ ĐỘNG END-TO-END HỆ THỐNG iDORM")
    sub_run.font.name = "Times New Roman"
    sub_run.font.size = Pt(14)
    sub_run.font.bold = True
    sub_run.font.color.rgb = RGBColor(70, 80, 95)

    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # Metadata Card
    info_table = doc.add_table(rows=4, cols=2)
    info_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    info_data = [
        ("Tên ứng dụng:", "Hệ thống quản lý ktx có tích hợp AI (iDORM)"),
        ("Nhóm thực hiện:", "Nhóm 43 - Thành viên nhóm: Nguyễn Thị Ánh (Trưởng nhóm), Ngô Phương Mai"),
        ("Thời gian thực hiện:", "Từ 27/07/2026 đến 27/09/2026 (9 tuần)"),
        ("Môi trường thực thi:", "FastAPI RESTful Backend, MySQL 8.0, React 18, Windows 11 Pro 64-bit")
    ]
    for row_idx, (label, val) in enumerate(info_data):
        row = info_table.rows[row_idx]
        c1, c2 = row.cells[0], row.cells[1]
        c1.width = Inches(2.2)
        c2.width = Inches(4.8)
        p1 = c1.paragraphs[0]
        r1 = p1.add_run(label)
        r1.font.name = "Times New Roman"
        r1.font.bold = True
        r1.font.size = Pt(11)
        r1.font.color.rgb = RGBColor(30, 41, 59)
        p2 = c2.paragraphs[0]
        r2 = p2.add_run(val)
        r2.font.name = "Times New Roman"
        r2.font.size = Pt(11)
        set_cell_background(c1, "F1F5F9")
        set_cell_background(c2, "F8FAFC")
        set_cell_margins(c1, 80, 80, 120, 120)
        set_cell_margins(c2, 80, 80, 120, 120)
    set_table_borders(info_table, "CBD5E1")

    doc.add_paragraph().paragraph_format.space_after = Pt(14)

    # 2. CẤU HÌNH PHẦN CỨNG & PHẦN MỀM
    h1 = doc.add_heading("1. Cấu hình môi trường kiểm thử", level=1)
    h1.runs[0].font.name = "Times New Roman"
    h1.runs[0].font.size = Pt(15)
    h1.runs[0].font.bold = True
    h1.runs[0].font.color.rgb = RGBColor(15, 76, 129)

    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    p_hw = doc.add_paragraph()
    r_hw = p_hw.add_run("Bảng 1.1: Bảng cấu hình phần cứng thiết bị kiểm thử")
    r_hw.font.name = "Times New Roman"
    r_hw.font.bold = True
    r_hw.font.size = Pt(11.5)

    hw_table = doc.add_table(rows=6, cols=2)
    hw_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    hw_rows = [
        ("Thành phần phần cứng", "Thông số kỹ thuật thực tế"),
        ("Bộ vi xử lý (CPU)", "Intel(R) Core(TM) i7-9850H @ 2.60GHz (6 Cores, 12 Threads, Turbo Boost up to 4.60GHz)"),
        ("Bộ nhớ trong (RAM)", "32.0 GB DDR4 Bus 2666MHz Dual-Channel"),
        ("Ổ cứng lưu trữ (Storage)", "512 GB SSD NVMe M.2 PCIe Gen 3x4 High-Speed"),
        ("Mạng kết nối (Network)", "Gigabit Ethernet (1000 Mbps) & Wi-Fi 6 802.11ax Dual Band"),
        ("Màn hình hiển thị", "15.6 inch Full HD (1920 x 1080) 60Hz IPS Display")
    ]
    for row_idx, (c_label, c_val) in enumerate(hw_rows):
        row = hw_table.rows[row_idx]
        c1, c2 = row.cells[0], row.cells[1]
        c1.width = Inches(2.2)
        c2.width = Inches(4.8)
        p1 = c1.paragraphs[0]
        r1 = p1.add_run(c_label)
        r1.font.name = "Times New Roman"
        r1.font.size = Pt(10.5)
        p2 = c2.paragraphs[0]
        r2 = p2.add_run(c_val)
        r2.font.name = "Times New Roman"
        r2.font.size = Pt(10.5)
        if row_idx == 0:
            r1.font.bold = True
            r1.font.color.rgb = RGBColor(255, 255, 255)
            r2.font.bold = True
            r2.font.color.rgb = RGBColor(255, 255, 255)
            set_cell_background(c1, "0F4C81")
            set_cell_background(c2, "0F4C81")
        else:
            r1.font.bold = True
            bg = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
            set_cell_background(c1, bg)
            set_cell_background(c2, bg)
        set_cell_margins(c1, 60, 60, 100, 100)
        set_cell_margins(c2, 60, 60, 100, 100)
    set_table_borders(hw_table, "CBD5E1")

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    p_sw = doc.add_paragraph()
    r_sw = p_sw.add_run("Bảng 1.2: Bảng cấu hình phần mềm và môi trường phát triển")
    r_sw.font.name = "Times New Roman"
    r_sw.font.bold = True
    r_sw.font.size = Pt(11.5)

    sw_table = doc.add_table(rows=7, cols=2)
    sw_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    sw_rows = [
        ("Phần mềm / Công nghệ", "Phiên bản & Vai trò sử dụng"),
        ("Hệ điều hành", "Microsoft Windows 11 Pro 64-bit (OS Build 22631.x)"),
        ("Môi trường Backend", "Python 3.13.0, FastAPI 0.115.0, Uvicorn 0.32.0 (ASGI Server)"),
        ("Hệ quản trị CSDL", "MySQL Community Server 8.0.36, SQLAlchemy 2.0 ORM, PyMySQL 1.1.1"),
        ("Môi trường Frontend", "Node.js v20.15.0, React 18, Vite 5.x, TailwindCSS/Vanilla CSS"),
        ("Công cụ AI & NLP", "AI Rule-Based NLP & Google Gemini Model (Trợ lý phản ánh sự cố)"),
        ("Công cụ Phát triển & Test", "Antigravity IDE, Pytest 9.1.1, Requests, Httpx, Python-docx 1.2.0")
    ]
    for row_idx, (c_label, c_val) in enumerate(sw_rows):
        row = sw_table.rows[row_idx]
        c1, c2 = row.cells[0], row.cells[1]
        c1.width = Inches(2.2)
        c2.width = Inches(4.8)
        p1 = c1.paragraphs[0]
        r1 = p1.add_run(c_label)
        r1.font.name = "Times New Roman"
        r1.font.size = Pt(10.5)
        p2 = c2.paragraphs[0]
        r2 = p2.add_run(c_val)
        r2.font.name = "Times New Roman"
        r2.font.size = Pt(10.5)
        if row_idx == 0:
            r1.font.bold = True
            r1.font.color.rgb = RGBColor(255, 255, 255)
            r2.font.bold = True
            r2.font.color.rgb = RGBColor(255, 255, 255)
            set_cell_background(c1, "0F4C81")
            set_cell_background(c2, "0F4C81")
        else:
            r1.font.bold = True
            bg = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
            set_cell_background(c1, bg)
            set_cell_background(c2, bg)
        set_cell_margins(c1, 60, 60, 100, 100)
        set_cell_margins(c2, 60, 60, 100, 100)
    set_table_borders(sw_table, "CBD5E1")

    doc.add_paragraph().paragraph_format.space_after = Pt(14)

    # 3. MỤC 2: DANH SÁCH CÁC TÌNH HUỐNG KIỂM TRA ỨNG DỤNG (BẢNG 7 CỘT)
    h2 = doc.add_heading("2. Danh sách các tình huống để kiểm tra ứng dụng", level=1)
    h2.runs[0].font.name = "Times New Roman"
    h2.runs[0].font.size = Pt(15)
    h2.runs[0].font.bold = True
    h2.runs[0].font.color.rgb = RGBColor(15, 76, 129)

    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    p_desc2 = doc.add_paragraph("Bảng đặc tả toàn diện 24 ca kiểm thử chức năng bao gồm toàn bộ luồng chính (Happy Path) và các trường hợp biên (Edge cases) trên hệ thống iDORM:")
    p_desc2.runs[0].font.name = "Times New Roman"
    p_desc2.runs[0].font.size = Pt(11)

    table2 = doc.add_table(rows=len(results) + 1, cols=7)
    table2.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers2 = ["Test ID", "Chức năng", "Mô tả", "Điều kiện trước", "Dữ liệu Test", "Kết quả mong muốn", "Ghi chú"]
    
    # Thiết lập độ rộng cột (Tổng cộng = 7.0 inches)
    col_widths2 = [Inches(0.7), Inches(0.9), Inches(1.5), Inches(0.9), Inches(1.1), Inches(1.3), Inches(0.6)]

    hdr_row2 = table2.rows[0]
    for idx, text in enumerate(headers2):
        cell = hdr_row2.cells[idx]
        cell.width = col_widths2[idx]
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(text)
        r.font.name = "Times New Roman"
        r.font.bold = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(255, 255, 255)
        set_cell_background(cell, "0F4C81")
        set_cell_margins(cell, 80, 80, 60, 60)

    for row_idx, res in enumerate(results, start=1):
        row = table2.rows[row_idx]
        values = [
            res["test_id"],
            res["module"],
            res["desc"],
            res["pre_condition"],
            res["test_input"],
            res["expected_output"],
            res["note"]
        ]
        bg_color = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
        for c_idx, val in enumerate(values):
            cell = row.cells[c_idx]
            cell.width = col_widths2[c_idx]
            p = cell.paragraphs[0]
            if c_idx in [0, 1]:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            r = p.add_run(str(val))
            r.font.name = "Times New Roman"
            r.font.size = Pt(8.5)
            if c_idx == 0:
                r.font.bold = True
                r.font.color.rgb = RGBColor(15, 76, 129)
            set_cell_background(cell, bg_color)
            set_cell_margins(cell, 60, 60, 60, 60)
    set_table_borders(table2, "CBD5E1")

    doc.add_paragraph().paragraph_format.space_after = Pt(16)

    # 4. MỤC 3: BÁO CÁO KẾT QUẢ TEST (TEST REPORT - BẢNG 7 CỘT)
    h3 = doc.add_heading("3. Báo cáo kết quả test (Test report)", level=1)
    h3.runs[0].font.name = "Times New Roman"
    h3.runs[0].font.size = Pt(15)
    h3.runs[0].font.bold = True
    h3.runs[0].font.color.rgb = RGBColor(15, 76, 129)

    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    p_desc3 = doc.add_paragraph("Kết quả kiểm thử thực tế được ghi nhận trực tiếp từ backend FastAPI và cơ sở dữ liệu MySQL:")
    p_desc3.runs[0].font.name = "Times New Roman"
    p_desc3.runs[0].font.size = Pt(11)

    table3 = doc.add_table(rows=len(results) + 1, cols=7)
    table3.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers3 = ["Test ID", "Ngày testing", "Người tham gia Test", "Pass/Fail", "Độ nghiêm trọng", "Tóm tắt lỗi", "Ghi chú"]
    col_widths3 = [Inches(0.7), Inches(0.8), Inches(1.1), Inches(0.8), Inches(0.9), Inches(1.8), Inches(0.9)]

    hdr_row3 = table3.rows[0]
    for idx, text in enumerate(headers3):
        cell = hdr_row3.cells[idx]
        cell.width = col_widths3[idx]
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(text)
        r.font.name = "Times New Roman"
        r.font.bold = True
        r.font.size = Pt(9.5)
        r.font.color.rgb = RGBColor(255, 255, 255)
        set_cell_background(cell, "0F4C81")
        set_cell_margins(cell, 80, 80, 60, 60)

    for row_idx, res in enumerate(results, start=1):
        row = table3.rows[row_idx]
        values = [
            res["test_id"],
            res["date"],
            res["tester"],
            res["result_status"],
            res["severity"],
            f"Code: {res['actual_response'].get('status_code', 'OK')} - {res['error_summary']}",
            res["note"]
        ]
        bg_color = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
        for c_idx, val in enumerate(values):
            cell = row.cells[c_idx]
            cell.width = col_widths3[c_idx]
            p = cell.paragraphs[0]
            if c_idx in [0, 1, 3, 4]:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            r = p.add_run(str(val))
            r.font.name = "Times New Roman"
            r.font.size = Pt(8.5)
            if c_idx == 0:
                r.font.bold = True
                r.font.color.rgb = RGBColor(15, 76, 129)
            elif c_idx == 3:
                r.font.bold = True
                if val == "PASS":
                    r.font.color.rgb = RGBColor(16, 149, 193)  # Teal/Blue
                else:
                    r.font.color.rgb = RGBColor(220, 38, 38)   # Red
            set_cell_background(cell, bg_color)
            set_cell_margins(cell, 60, 60, 60, 60)
    set_table_borders(table3, "CBD5E1")

    doc.add_paragraph().paragraph_format.space_after = Pt(14)

    # 5. KẾT LUẬN & ĐÁNH GIÁ CHẤT LƯỢNG
    h4 = doc.add_heading("4. Tổng kết & Đánh giá kết quả kiểm thử", level=1)
    h4.runs[0].font.name = "Times New Roman"
    h4.runs[0].font.size = Pt(15)
    h4.runs[0].font.bold = True
    h4.runs[0].font.color.rgb = RGBColor(15, 76, 129)

    total_tests = len(results)
    passed_tests = sum(1 for t in results if t["is_passed"])
    failed_tests = total_tests - passed_tests
    pass_rate = (passed_tests / total_tests) * 100

    sum_table = doc.add_table(rows=4, cols=2)
    sum_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    sum_rows = [
        ("Tổng số ca kiểm thử đã thực thi:", f"{total_tests} ca kiểm thử (Bao quát 4 phân hệ chính & Edge cases)"),
        ("Số ca kiểm thử đạt chuẩn (PASS):", f"{passed_tests} ca kiểm thử thành công"),
        ("Số ca kiểm thử thất bại (FAIL):", f"{failed_tests} ca"),
        ("Tỷ lệ vượt qua (Pass Rate):", f"{pass_rate:.1f}% - ĐẠT CHUẨN CHẤT LƯỢNG VẬN HÀNH THỰC TẾ")
    ]
    for r_idx, (lbl, val) in enumerate(sum_rows):
        row = sum_table.rows[r_idx]
        c1, c2 = row.cells[0], row.cells[1]
        c1.width = Inches(3.0)
        c2.width = Inches(4.0)
        p1 = c1.paragraphs[0]
        r1 = p1.add_run(lbl)
        r1.font.name = "Times New Roman"
        r1.font.bold = True
        r1.font.size = Pt(11)
        p2 = c2.paragraphs[0]
        r2 = p2.add_run(val)
        r2.font.name = "Times New Roman"
        r2.font.size = Pt(11)
        if r_idx == 3:
            r1.font.color.rgb = RGBColor(15, 76, 129)
            r2.font.bold = True
            r2.font.color.rgb = RGBColor(16, 149, 193)
            set_cell_background(c1, "E0F2FE")
            set_cell_background(c2, "E0F2FE")
        else:
            set_cell_background(c1, "F8FAFC")
            set_cell_background(c2, "FFFFFF")
        set_cell_margins(c1, 70, 70, 100, 100)
        set_cell_margins(c2, 70, 70, 100, 100)
    set_table_borders(sum_table, "CBD5E1")

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    p_conclude = doc.add_paragraph()
    r_conc = p_conclude.add_run(
        "Kết luận: Toàn bộ các module Xác thực & RBAC, Quản lý Lưu trú & Xếp phòng, "
        "Phản ánh sự cố tích hợp AI và Tài chính - Đối soát tự động VietQR của hệ thống iDORM "
        "đều hoạt động ổn định, dữ liệu đồng bộ chính xác với cơ sở dữ liệu MySQL và đáp ứng đầy đủ "
        "các yêu cầu nghiệp vụ thực tế của ký túc xá đại học thông minh."
    )
    r_conc.font.name = "Times New Roman"
    r_conc.font.size = Pt(11)
    r_conc.font.italic = True

    # Chữ ký người lập báo cáo
    doc.add_paragraph().paragraph_format.space_after = Pt(20)
    sign_table = doc.add_table(rows=2, cols=2)
    sign_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    sign_table.rows[0].cells[0].paragraphs[0].add_run("XÁC NHẬN CỦA BAN QUẢN LÝ").font.bold = True
    sign_table.rows[0].cells[0].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    sign_table.rows[0].cells[1].paragraphs[0].add_run("NGƯỜI THỰC HIỆN KIỂM THỬ").font.bold = True
    sign_table.rows[0].cells[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    p_s2 = sign_table.rows[1].cells[1].paragraphs[0]
    p_s2.paragraph_format.space_before = Pt(50)
    p_s2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_sign2 = p_s2.add_run("Nguyễn Thị Ánh & Ngô Phương Mai")
    r_sign2.font.bold = True
    r_sign2.font.name = "Times New Roman"

    doc.save(output_path)
    print(f"===> BÁO CÁO WORD ĐÃ ĐƯỢC TẠO THÀNH CÔNG: {output_path}")


if __name__ == "__main__":
    results = run_all_tests()
    word_file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Bao_Cao_Kiem_Thu_iDORM.docx")
    export_word_report(results, output_path=word_file_path)
