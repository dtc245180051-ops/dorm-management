"""
Script kiểm thử xác thực logic Hợp đồng và Phát hành hóa đơn:
1. Kiểm tra dữ liệu hop_dong trong CSDL.
2. Kiểm tra chỉ phát hành hóa đơn với hợp đồng tồn tại:
   - Khi hợp đồng không tồn tại -> Trả về lỗi 400 Bad Request.
   - Khi hợp đồng tồn tại -> Phát hành thành công 201 Created với ma_hop_dong thực tế.
3. Kiểm tra tính toàn vẹn Foreign Key (không tắt FK).
4. Kiểm tra chống phát hành trùng lặp.
5. Kiểm tra các chức năng khác không bị ảnh hưởng.
"""
import sys
import json
import urllib.request
import urllib.error
import urllib.parse
from datetime import date, timedelta

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

def ensure_sample_contract_exists():
    """
    Tạo dữ liệu hợp đồng mẫu hợp lệ trực tiếp vào DB nếu DB chưa có hợp đồng nào.
    Tuân thủ đúng 100% quan hệ FK của DB hiện có:
    ToaNha -> Tang -> Phong -> Giuong
    NguoiDung -> SinhVien
    HopDong (ma_hop_dong, msv, ma_giuong, trang_thai='ACTIVE')
    """
    try:
        from app.core.database import SessionLocal
        from app.models.dorm import ToaNha, Tang, Phong, Giuong
        from app.models.user import NguoiDung, SinhVien
        from app.models.contract import HopDong

        db = SessionLocal()
        try:
            existing_contract = db.query(HopDong).filter(HopDong.trang_thai == "ACTIVE").first()
            if existing_contract:
                print(f"[INIT] Đã có hợp đồng ACTIVE trong CSDL: ma_hop_dong={existing_contract.ma_hop_dong}, msv={existing_contract.msv}")
                return existing_contract.ma_hop_dong, existing_contract.msv

            print("[INIT] CSDL chưa có hợp đồng. Tiến hành khởi tạo 1 hợp đồng mẫu hợp lệ...")
            # 1. ToaNha
            toa = db.query(ToaNha).filter(ToaNha.ma_toa == "TOA_A1").first()
            if not toa:
                toa = ToaNha(ma_toa="TOA_A1", ten_toa="Tòa A1")
                db.add(toa)
                db.flush()

            # 2. Tang
            tang = db.query(Tang).filter(Tang.ma_tang == "TANG_1_A1").first()
            if not tang:
                tang = Tang(ma_tang="TANG_1_A1", so_tang=1, ma_toa=toa.ma_toa)
                db.add(tang)
                db.flush()

            # 3. Phong
            phong = db.query(Phong).filter(Phong.ma_phong == "P101_A1").first()
            if not phong:
                phong = Phong(ma_phong="P101_A1", so_phong="101", suc_chua=4, loai_phong="TIÊU CHUẨN", ma_tang=tang.ma_tang)
                db.add(phong)
                db.flush()

            # 4. Giuong
            giuong = db.query(Giuong).filter(Giuong.ma_giuong == "G101_01").first()
            if not giuong:
                giuong = Giuong(ma_giuong="G101_01", ma_phong=phong.ma_phong, trang_thai="OCCUPIED")
                db.add(giuong)
                db.flush()

            # 5. NguoiDung + SinhVien
            from app.models.user import TaiKhoan, VaiTro
            tk_sv = db.query(TaiKhoan).filter(TaiKhoan.vai_tro == VaiTro.SINH_VIEN).first()
            if not tk_sv:
                import uuid
                tk_sv = TaiKhoan(
                    ma_tai_khoan=str(uuid.uuid4()),
                    ten_dang_nhap="sv_test_sample",
                    mat_khau_hash="dummy_hash",
                    vai_tro=VaiTro.SINH_VIEN,
                )
                db.add(tk_sv)
                db.flush()

            nd = db.query(NguoiDung).filter(NguoiDung.ma_tai_khoan == tk_sv.ma_tai_khoan).first()
            if not nd:
                import uuid
                nd = NguoiDung(
                    ma_nguoi_dung=str(uuid.uuid4()),
                    ma_tai_khoan=tk_sv.ma_tai_khoan,
                    ho_ten="Nguyễn Văn An",
                    email="an.nv@student.edu.vn",
                    so_dien_thoai="0987654321",
                )
                db.add(nd)
                db.flush()

            sv = db.query(SinhVien).filter(SinhVien.ma_nguoi_dung == nd.ma_nguoi_dung).first()
            if not sv:
                msv_val = tk_sv.ten_dang_nhap.upper() if tk_sv.ten_dang_nhap.startswith("dtc") else "DTC245180001"
                sv = SinhVien(msv=msv_val, ma_nguoi_dung=nd.ma_nguoi_dung, lop="K18-CNTT", gioi_tinh="NAM")
                db.add(sv)
                db.flush()


            # 6. HopDong
            ma_hd = "HD-2026-0001"
            hd = db.query(HopDong).filter(HopDong.ma_hop_dong == ma_hd).first()
            if not hd:
                hd = HopDong(
                    ma_hop_dong=ma_hd,
                    msv=sv.msv,
                    ma_giuong=giuong.ma_giuong,
                    ngay_bat_dau=date(2026, 9, 1),
                    ngay_ket_thuc=date(2027, 1, 31),
                    trang_thai="ACTIVE",
                )
                db.add(hd)

            db.commit()
            print(f"[INIT] Khởi tạo thành công hợp đồng mẫu: ma_hop_dong={ma_hd}, msv={sv.msv}")
            return ma_hd, sv.msv
        except Exception as e:
            db.rollback()
            print(f"[INIT ERROR] Không thể khởi tạo hợp đồng mẫu: {e}")
            return None, None
        finally:
            db.close()
    except Exception as e:
        print(f"[INIT ERROR] Lỗi import database: {e}")
        return None, None


def run_tests():
    print("=" * 75)
    print("KIỂM THỬ XÁC THỰC HỢP ĐỒNG & KHÓA NGOẠI PHÁT HÀNH HÓA ĐƠN")
    print("=" * 75)

    # Đảm bảo có hợp đồng trước
    ma_hd_real, msv_real = ensure_sample_contract_exists()



    # 1. Đăng nhập Kế toán
    status_kt, kt_data = http_request(
        "POST", "/auth/login",
        data={"username": "KT_Hoa", "password": "password123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert status_kt == 200, f"Đăng nhập Kế toán thất bại: {kt_data}"
    kt_token = kt_data["access_token"]
    print(f"\n[1] Đăng nhập Kế toán KT_Hoa thành công: role={kt_data['role']}")

    # 2. Test từ chối phát hành khi MSV không có hợp đồng tồn tại
    print(f"\n[2] Kiểm tra từ chối phát hành khi MSV không có hợp đồng tồn tại trong CSDL:")
    fake_payload = {
        "ky_thanh_toan": "Học kỳ I (2026 – 2027)",
        "ap_dung": "Sinh viên chỉ định",
        "thoi_gian_o_thang": 3,
        "don_gia_thang": 600000.0,
        "han_thanh_toan": "2026-09-15",
        "danh_sach_msv": ["MSV_KHONG_TON_TAI_9999"],
        "ghi_chu": "Test phát hành hợp đồng không tồn tại",
    }
    status, res = http_request("POST", "/invoices/room/publish", data=fake_payload, token=kt_token)
    print(f"  -> HTTP Status: {status} (Mong đợi: 400)")
    print(f"  -> Chi tiết phản hồi: {res.get('detail')}")
    assert status == 400, f"Lỗi: Phải trả về 400 Bad Request khi hợp đồng không tồn tại nhưng nhận {status}"
    assert "hợp đồng không tồn tại" in res.get("detail", "").lower() or "không tìm thấy" in res.get("detail", "").lower()
    print("  -> PASS: Đã chặn thành công và chỉ phát hành với hợp đồng tồn tại!")

    # 3. Đảm bảo có hợp đồng thực tế tồn tại trong CSDL
    print(f"\n[3] Kiểm tra và chuẩn bị dữ liệu hợp đồng thực tế trong CSDL:")
    ma_hd_real, msv_real = ensure_sample_contract_exists()
    assert ma_hd_real is not None, "Không thể xác định hoặc tạo hợp đồng thực tế trong CSDL"
    print(f"  -> Hợp đồng hợp lệ: ma_hop_dong='{ma_hd_real}', msv='{msv_real}'")

    # 4. Kế toán lấy danh sách candidates -> Phải có hợp đồng tồn tại này
    print(f"\n[4] Kế toán lấy danh sách sinh viên cần lập hóa đơn tiền phòng:")
    status, candidates = http_request(
        "GET", "/invoices/room/candidates",
        params={
            "ky_thanh_toan": "Học kỳ I (2026 – 2027)",
            "thoi_gian_o_thang": 3,
            "don_gia_thang": 600000.0,
        },
        token=kt_token
    )
    assert status == 200, f"Lỗi lấy candidates: {candidates}"
    print(f"  -> Số lượng ứng viên tìm thấy từ CSDL: {len(candidates)}")
    found = any(c["ma_hop_dong"] == ma_hd_real for c in candidates)
    assert found, f"Hợp đồng {ma_hd_real} phải xuất hiện trong danh sách candidates từ DB"
    print(f"  -> PASS: Hợp đồng '{ma_hd_real}' xuất hiện chuẩn xác trong danh sách candidates!")

    # 5. Phát hành hóa đơn tiền phòng cho hợp đồng thực tế tồn tại
    print(f"\n[5] Kế toán phát hành hóa đơn tiền phòng cho hợp đồng thực tế:")
    ky_test = "Học kỳ I (2026 – 2027)"
    publish_payload = {
        "ky_thanh_toan": ky_test,
        "ap_dung": "Tất cả sinh viên còn hạn hợp đồng",
        "thoi_gian_o_thang": 3,
        "don_gia_thang": 600000.0,
        "han_thanh_toan": "2026-09-15",
        "danh_sach_msv": [msv_real],
        "ghi_chu": f"Phát hành hóa đơn tiền phòng cho hợp đồng {ma_hd_real}",
    }
    status, pub_result = http_request("POST", "/invoices/room/publish", data=publish_payload, token=kt_token)
    print(f"  -> HTTP Status: {status} (Mong đợi: 201 hoặc 400 nếu đã lập)")
    if status == 400 and "trùng" in pub_result.get("detail", "").lower():
        print(f"  -> Hợp đồng đã có hóa đơn từ trước: {pub_result.get('detail')}")
    else:
        assert status == 201, f"Lỗi phát hành hóa đơn: {pub_result}"
        print(f"  -> Phát hành thành công: {pub_result['message']}")
        created_inv = pub_result["danh_sach_hoa_don"][0]
        assert created_inv["ma_hop_dong"] == ma_hd_real, f"Mã hợp đồng phải là {ma_hd_real} nhưng nhận {created_inv['ma_hop_dong']}"
        print(f"  -> Hóa đơn tạo ra: ma_hoa_don='{created_inv['ma_hoa_don']}', ma_hop_dong='{created_inv['ma_hop_dong']}' (Khớp FK hợp đồng tồn tại)")

    # 6. Test chống phát hành trùng lặp
    print(f"\n[6] Kiểm tra chống phát hành trùng lặp cho cùng hợp đồng cùng kỳ:")
    status, dup_result = http_request("POST", "/invoices/room/publish", data=publish_payload, token=kt_token)
    print(f"  -> HTTP Status khi phát hành lại: {status} (Mong đợi: 400)")
    assert status == 400, f"Phát hành trùng lặp phải trả về 400 nhưng trả về {status}"
    print(f"  -> Thông báo lỗi chống trùng: {dup_result.get('detail')}")
    print("  -> PASS: Chống phát hành trùng lặp hoạt động chính xác!")

    # 7. Kiểm tra các chức năng khác không bị ảnh hưởng (Điện nước & Tra cứu)
    print(f"\n[7] Kiểm tra chức năng Hóa đơn Điện nước (không bị ảnh hưởng):")
    status, util_candidates = http_request("GET", "/invoices/utility/candidates", token=kt_token)
    assert status == 200, f"Lỗi lấy phòng điện nước: {util_candidates}"
    print(f"  -> Lấy danh sách phòng điện nước thành công: {len(util_candidates)} phòng")

    print(f"\n[8] Kiểm tra tra cứu danh sách hóa đơn:")
    status, all_invs = http_request("GET", "/invoices", token=kt_token)
    assert status == 200, f"Lỗi tra cứu hóa đơn: {all_invs}"
    print(f"  -> Tra cứu thành công, tổng số hóa đơn: {len(all_invs)}")

    print("\n" + "=" * 75)
    print("HOÀN THÀNH: TẤT CẢ CÁC BỘ TEST ĐÃ VƯỢT QUA 100%!")
    print("Hệ thống chỉ phát hành hóa đơn với hợp đồng tồn tại, khóa ngoại FK được duy trì toàn vẹn!")
    print("=" * 75)

if __name__ == "__main__":
    run_tests()
