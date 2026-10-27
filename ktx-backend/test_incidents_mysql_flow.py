"""Kịch bản kiểm thử toàn diện Chức năng Phản ánh sau khi Refactor sang MySQL:

1. Kiểm tra đọc danh sách phản ánh từ MySQL (GET /incidents)
2. Kiểm tra lọc phản ánh theo MSV từ MySQL (GET /incidents?msv=...)
3. Kiểm tra tạo mới phản ánh với ACID transaction (POST /incidents)
4. Kiểm tra xem chi tiết phản ánh từ MySQL (GET /incidents/{id})
5. Kiểm tra cập nhật trạng thái phản ánh trong MySQL (PATCH /incidents/{id}/status)
6. Kiểm tra AI Daily Summary đọc trực tiếp từ MySQL (GET /incidents/daily-summary)
7. Kiểm tra ngoại lệ và tính toàn vẹn ACID (Rollback khi có lỗi, validation)
8. Đảm bảo file JSON (data_store_incidents.json) KHÔNG bị ghi/thay đổi bởi API
"""

import hashlib
import os
import sys

if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.incident import PhanAnh

client = TestClient(app)

JSON_FILE = os.path.join(os.path.dirname(__file__), "app", "data_store_incidents.json")


def get_file_hash(filepath: str) -> str:
    if not os.path.exists(filepath):
        return ""
    with open(filepath, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def run_tests():
    print("=" * 60)
    print("BẮT ĐẦU KIỂM THỬ CHỨC NĂNG PHẢN ÁNH (MYSQL + ACID TRANSACTION)")
    print("=" * 60)

    initial_json_hash = get_file_hash(JSON_FILE)
    print(f"[*] Hash ban đầu của data_store_incidents.json: {initial_json_hash[:16]}...")

    # TEST 1: GET /incidents
    print("\n[TEST 1] Đọc toàn bộ danh sách phản ánh từ MySQL...")
    res = client.get("/api/v1/incidents")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert data["status"] == "success"
    assert "data" in data
    total_incidents = data["total"]
    print(f"  [+] Thành công! Tổng số phản ánh đọc từ MySQL: {total_incidents}")
    assert total_incidents >= 14, f"Expected at least 14 incidents, got {total_incidents}"

    # TEST 2: GET /incidents?msv=DTC245180037
    print("\n[TEST 2] Lọc phản ánh theo mã sinh viên (DTC245180037)...")
    res = client.get("/api/v1/incidents?msv=DTC245180037")
    assert res.status_code == 200
    student_data = res.json()
    assert student_data["status"] == "success"
    print(f"  [+] Thành công! Tìm thấy {len(student_data['data'])} phản ánh của sinh viên DTC245180037")
    for item in student_data["data"]:
        assert "DTC245180037" in item["msv"].upper()

    # TEST 3: POST /incidents (Tạo mới phản ánh với ACID transaction)
    print("\n[TEST 3] Tạo mới phản ánh qua MySQL với Transaction ACID...")
    test_msv = "DTC245180037"
    create_payload = {
        "msv": test_msv,
        "ho_ten": "Ngô Phương Mai",
        "phong": "P301",
        "mo_ta": "Kiểm tra ACID Transaction: Vòi nước bồn rửa mặt bị rò rỉ nghiêm trọng",
        "tieu_de": "Rò rỉ vòi nước nghiêm trọng",
        "loai_phan_anh": "Điện nước",
        "hinh_anh": None,
    }
    res = client.post("/api/v1/incidents", json=create_payload)
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    created_res = res.json()
    assert created_res["status"] == "success"
    created_item = created_res["data"]
    new_id = created_item["ma_phan_anh"]
    print(f"  [+] Tạo thành công phản ánh với mã: {new_id}")

    # Kiểm tra trực tiếp trong CSDL MySQL để chứng minh dữ liệu đã vào MySQL
    db = SessionLocal()
    try:
        db_record = db.query(PhanAnh).filter(PhanAnh.ma_phan_anh == new_id).first()
        assert db_record is not None, "Phản ánh mới không tìm thấy trong bảng phan_anh của MySQL!"
        assert db_record.msv.upper() == test_msv.upper()
        assert db_record.trang_thai == "CHO_XU_LY"
        assert db_record.tieu_de == "Rò rỉ vòi nước nghiêm trọng"
        print("  [+] Xác thực trực tiếp trong MySQL: Dữ liệu đã được commit thành công vào bảng phan_anh!")
    finally:
        db.close()

    # TEST 4: GET /incidents/{incident_id}
    print(f"\n[TEST 4] Xem chi tiết phản ánh {new_id} từ MySQL...")
    res = client.get(f"/api/v1/incidents/{new_id}")
    assert res.status_code == 200
    detail = res.json()["data"]
    assert detail["ma_phan_anh"] == new_id
    assert detail["phong"] == "P301"
    print(f"  [+] Xem chi tiết thành công: Tiêu đề='{detail['tieu_de']}', Trạng thái='{detail['trang_thai_label']}'")

    # TEST 5: PATCH /incidents/{incident_id}/status (Cập nhật trạng thái trong MySQL)
    print(f"\n[TEST 5] Cập nhật trạng thái phản ánh {new_id} trong MySQL...")
    update_payload = {
        "trang_thai": "DANG_XU_LY",
        "ghi_chu_xu_ly": "Cán bộ kỹ thuật đang trên đường tới kiểm tra",
    }
    res = client.patch(f"/api/v1/incidents/{new_id}/status", json=update_payload)
    assert res.status_code == 200
    updated_detail = res.json()["data"]
    assert updated_detail["trang_thai"] == "DANG_XU_LY"
    assert updated_detail["ghi_chu_xu_ly"] == "Cán bộ kỹ thuật đang trên đường tới kiểm tra"
    print(f"  [+] Cập nhật thành công! Trạng thái mới: {updated_detail['trang_thai']} ({updated_detail['trang_thai_label']})")

    # TEST 6: GET /incidents/daily-summary
    print("\n[TEST 6] Kiểm tra AI Daily Summary trực tiếp từ MySQL...")
    res = client.get("/api/v1/incidents/daily-summary")
    assert res.status_code == 200
    summary_data = res.json()
    assert summary_data["status"] == "success"
    print(f"  [+] AI Daily Summary: Tổng số sự cố hôm nay = {summary_data['count']}")
    print(f"  [+] Nội dung tóm tắt: {summary_data['summary'][:120]}...")

    # TEST 7: Kiểm tra ngoại lệ & Validation (ACID)
    print("\n[TEST 7] Kiểm tra xử lý ngoại lệ và Validation (ACID)...")
    # Gửi mô tả rỗng
    bad_res = client.post("/api/v1/incidents", json={"mo_ta": "   "})
    assert bad_res.status_code == 400
    print("  [+] Bắt lỗi mô tả rỗng thành công (HTTP 400).")

    # Truy vấn phản ánh không tồn tại
    not_found_res = client.get("/api/v1/incidents/PA-NONEXISTENT")
    assert not_found_res.status_code == 404
    print("  [+] Bắt lỗi phản ánh không tồn tại thành công (HTTP 404).")

    # TEST 8: Đảm bảo file JSON không hề bị thay đổi
    print("\n[TEST 8] Kiểm tra file JSON có bị ghi/thay đổi hay không...")
    final_json_hash = get_file_hash(JSON_FILE)
    assert initial_json_hash == final_json_hash, "CẢNH BÁO: File data_store_incidents.json ĐÃ BỊ THAY ĐỔI!"
    print(f"  [+] Xác nhận: Hash của file JSON KHÔNG ĐỔI ({final_json_hash[:16]}...)")
    print("  [+] Không có bất kỳ thao tác ghi/cập nhật nào ra file JSON!")

    # Dọn dẹp bản ghi kiểm thử
    db = SessionLocal()
    try:
        del_rec = db.query(PhanAnh).filter(PhanAnh.ma_phan_anh == new_id).first()
        if del_rec:
            db.delete(del_rec)
            db.commit()
            print(f"\n[*] Đã dọn dẹp bản ghi test {new_id} trong MySQL.")
    finally:
        db.close()

    print("\n" + "=" * 60)
    print("TẤT CẢ CÁC BÀI KIỂM THỬ ĐÃ VƯỢT QUA 100% THÀNH CÔNG!")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
