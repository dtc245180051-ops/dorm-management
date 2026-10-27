import sys
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.main import app
from app.models.contract import HopDong
from app.models.room_request import RoomRequest
from app.models.user import SinhVien

if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def test_full_occupancy_mysql_lifecycle():
    client = TestClient(app)
    db: Session = SessionLocal()

    # Dọn dẹp dữ liệu test cũ nếu có
    test_msv = "DTC245180999"
    db.query(RoomRequest).filter(RoomRequest.student_id == test_msv).delete()
    db.query(HopDong).filter(HopDong.msv == test_msv).delete()
    db.commit()

    print("[1] Kiểm tra gửi đơn đăng ký phòng mới (POST /api/v1/student/requests/register)...")
    reg_payload = {
        "msv": test_msv,
        "ho_ten": "Nguyễn Test ORM",
        "gioi_tinh": "Nam",
        "khoa": "CNTT",
        "lop": "KTPM K24",
        "dia_chi": "Hà Nội",
        "so_dien_thoai": "0988776655",
        "email": "dtc245180999@ictu.edu.vn",
        "loai_phong": "Phòng tiêu chuẩn",
        "tang_mong_muon": "Tầng 2",
        "muc_gia_mong_muon": "6600000",
        "nguyen_vong": "Đăng ký tầng 2 thoáng mát",
        "ma_toa_mong_muon": "A1",
        "xac_nhan": True,
    }

    res = client.post("/api/v1/student/requests/register", json=reg_payload)
    assert res.status_code in (200, 201), f"Register failed: {res.text}"
    data = res.json()
    assert data["status"] == "success"
    req_data = data["data"]
    req_id = req_data["id"]
    print(f"  -> Tạo đơn thành công với mã: {req_id}, trạng thái: {req_data['trang_thai']}")

    # Kiểm tra trực tiếp trong MySQL table room_requests
    db_req = db.query(RoomRequest).filter(RoomRequest.ma_yeu_cau == req_id).first()
    assert db_req is not None, "Không tìm thấy RoomRequest trong MySQL!"
    assert db_req.student_id == test_msv
    assert db_req.loai_don == "DANG_KY"
    assert db_req.trang_thai == "PENDING"
    print(f"  -> Bản ghi MySQL ORM RoomRequest tồn tại: id={db_req.id}, ma_yeu_cau={db_req.ma_yeu_cau}")

    print("\n[2] Kiểm tra lấy danh sách đơn của sinh viên (GET /api/v1/student/requests/my-requests)...")
    res_my = client.get(f"/api/v1/student/requests/my-requests?msv={test_msv}")
    assert res_my.status_code == 200
    my_list = res_my.json()
    assert len(my_list) >= 1
    assert any(r["id"] == req_id for r in my_list)
    print(f"  -> Tìm thấy {len(my_list)} đơn đăng ký cho sinh viên {test_msv}")

    print("\n[3] Kiểm tra quản lý lấy danh sách đơn có bộ lọc (GET /api/v1/admin/occupancy/requests)...")
    from app.core.security import create_access_token
    token = create_access_token(data={"sub": "quanly", "role": "QuanLy"})
    admin_headers = {"Authorization": f"Bearer {token}"}

    res_all = client.get(f"/api/v1/admin/occupancy/requests?msv={test_msv}&loai_don=DANG_KY", headers=admin_headers)
    assert res_all.status_code == 200
    admin_list = res_all.json()
    assert len(admin_list) >= 1
    assert admin_list[0]["id"] == req_id
    print(f"  -> Admin truy vấn MySQL thành công với bộ lọc msv & loai_don")

    print("\n[4] Kiểm tra quản lý phê duyệt đơn đăng ký (POST /api/v1/admin/occupancy/requests/{id}/approve)...")
    approve_payload = {
        "ma_toa": "A1",
        "phong_id": "A1_P201",
        "giuong_id": "A1_P201_G01",
        "msv": test_msv,
        "ho_ten": "Nguyễn Test ORM",
    }
    res_app = client.post(f"/api/v1/admin/occupancy/requests/{req_id}/approve", json=approve_payload, headers=admin_headers)
    assert res_app.status_code == 200, f"Approve failed: {res_app.text}"
    app_data = res_app.json()
    assert app_data["status"] == "success"
    print(f"  -> Phê duyệt thành công: mã hợp đồng {app_data['data']['ma_hop_dong']}")

    db.commit()
    db_req = db.query(RoomRequest).filter(RoomRequest.ma_yeu_cau == req_id).first()
    assert db_req.trang_thai == "APPROVED", f"Expected APPROVED but got {db_req.trang_thai}"
    print(f"  -> Trạng thái RoomRequest trong MySQL đã chuyển sang APPROVED")

    print("\n[5] Kiểm tra gửi đơn chuyển phòng (POST /api/v1/student/requests/transfer)...")
    transfer_payload = {
        "msv": test_msv,
        "ho_ten": "Nguyễn Test ORM",
        "phong_hien_tai": "A1_P201",
        "ly_do": "Xin chuyển sang tầng 3",
        "ngay_mong_muon": "30/10/2026",
        "phong_mong_muon": "A1_P301",
        "mo_ta_chi_tiet": "Em muốn ở gần bạn bè",
    }
    res_tf = client.post("/api/v1/student/requests/transfer", json=transfer_payload)
    assert res_tf.status_code == 201, f"Transfer failed: {res_tf.text}"
    tf_data = res_tf.json()["data"]
    tf_id = tf_data["id"]
    print(f"  -> Đơn chuyển phòng đã tạo: id={tf_id}")

    db.commit()
    db_tf = db.query(RoomRequest).filter(RoomRequest.ma_yeu_cau == tf_id).first()
    assert db_tf is not None
    assert db_tf.loai_don == "CHUYEN_PHONG"
    assert db_tf.trang_thai == "CHO_DUYET"
    print(f"  -> MySQL ORM RoomRequest lưu đơn chuyển phòng thành công")

    print("\n[6] Kiểm tra phê duyệt đơn chuyển phòng (PUT /api/v1/admin/occupancy/requests/transfer/{id}/approve)...")
    tf_app_payload = {
        "ma_toa": "A1",
        "phong_id": "A1_P301",
        "giuong_id": "A1_P301_G01",
        "msv": test_msv,
    }
    res_tf_app = client.put(f"/api/v1/admin/occupancy/requests/transfer/{tf_id}/approve", json=tf_app_payload, headers=admin_headers)
    assert res_tf_app.status_code == 200
    db.commit()
    db_tf = db.query(RoomRequest).filter(RoomRequest.ma_yeu_cau == tf_id).first()
    assert db_tf.trang_thai == "DA_DUYET"
    print(f"  -> Đơn chuyển phòng đã được duyệt và lưu trạng thái DA_DUYET trong MySQL")

    print("\n[7] Kiểm tra gửi đơn trả phòng (POST /api/v1/student/requests/checkout)...")
    checkout_payload = {
        "msv": test_msv,
        "ho_ten": "Nguyễn Test ORM",
        "phong_hien_tai": "A1_P301",
        "ly_do": "Chuyển ra ngoài ở",
        "ngay_mong_muon": "05/11/2026",
        "dia_chi_lien_he": "Số 123, Phường A, TP Hà Nội",
        "mo_ta_chi_tiet": "Cảm ơn ban quản lý",
    }
    res_co = client.post("/api/v1/student/requests/checkout", json=checkout_payload)
    assert res_co.status_code == 201
    co_data = res_co.json()["data"]
    co_id = co_data["id"]
    print(f"  -> Đơn trả phòng đã tạo: id={co_id}")

    db.commit()
    db_co = db.query(RoomRequest).filter(RoomRequest.ma_yeu_cau == co_id).first()
    assert db_co is not None
    assert db_co.loai_don == "TRA_PHONG"
    print(f"  -> MySQL ORM RoomRequest lưu đơn trả phòng thành công")

    print("\n[8] Kiểm tra từ chối đơn trả phòng (PUT /api/v1/admin/occupancy/requests/checkout/{id}/reject)...")
    res_co_rej = client.put(
        f"/api/v1/admin/occupancy/requests/checkout/{co_id}/reject",
        json={"ly_do_tu_choi": "Chưa đến thời hạn xét duyệt trả phòng"},
        headers=admin_headers,
    )
    assert res_co_rej.status_code == 200
    db.commit()
    db_co = db.query(RoomRequest).filter(RoomRequest.ma_yeu_cau == co_id).first()
    assert db_co.trang_thai == "TU_CHOI"
    assert db_co.ly_do_tu_choi == "Chưa đến thời hạn xét duyệt trả phòng"
    print(f"  -> Đơn trả phòng bị từ chối thành công, lý do lưu trong MySQL: '{db_co.ly_do_tu_choi}'")

    # Dọn dẹp dữ liệu test
    db.query(RoomRequest).filter(RoomRequest.student_id == test_msv).delete()
    db.query(HopDong).filter(HopDong.msv == test_msv).delete()
    db.commit()
    db.close()
    print("\n[+] TẤT CẢ CÁC BƯỚC KIỂM TRA ĐỀU HOÀN THÀNH XUẤT SẮC TRÊN CƠ SỞ DỮ LIỆU MYSQL VÀ SQLALCHEMY ORM!")


if __name__ == "__main__":
    test_full_occupancy_mysql_lifecycle()
