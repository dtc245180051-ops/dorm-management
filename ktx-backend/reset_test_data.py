"""
================================================================================
SCRIPT RESET MÔI TRƯỜNG KIỂM THỬ (iDORM Test Environment Reset)
Hệ thống: Quản lý ký túc xá thông minh
================================================================================
"""
import os
import sys
import json
from sqlalchemy import text

# Đảm bảo mã hóa UTF-8 cho console Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Thêm thư mục backend vào sys.path để import app modules
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.core.database import SessionLocal, engine


def reset_test_data():
    """
    Làm sạch dữ liệu kiểm thử:
    1. Xóa sạch dữ liệu giao dịch và lịch sử: ThanhToan, Phi, HopDong, YeuCauChuyenTraPhong, PhanAnh, ViPham (và HoaDon, SoCongNo).
    2. Xóa sạch bảng SinhVien.
    3. Xóa các tài khoản trong bảng TaiKhoan có vaiTro == 'sinh_vien' (kèm thông tin NguoiDung tương ứng).
    4. TUYỆT ĐỐI GIỮ LẠI tài khoản có vaiTro là 'quan_ly' và 'ke_toan'.
    5. GIỮ NGUYÊN danh mục cơ sở vật chất (ToaNha, Tang, Phong, NoiQuy).
    6. Cập nhật toàn bộ bản ghi trong bảng Giuong về trangThai = 'TRONG'.
    7. Reset các file JSON store tạm nếu có.
    """
    db = SessionLocal()
    try:
        # Vô hiệu hóa kiểm tra khóa ngoại FK để tránh xung đột ràng buộc khi xóa
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))

        # 1. Xóa sạch toàn bộ dữ liệu giao dịch và lịch sử
        db.execute(text("DELETE FROM giao_dich_ngan_hang;"))
        db.execute(text("DELETE FROM thanh_toan;"))
        db.execute(text("DELETE FROM phi;"))
        db.execute(text("DELETE FROM so_cong_no;"))
        db.execute(text("DELETE FROM hoa_don;"))
        db.execute(text("DELETE FROM bao_cao_dinh_ky;"))
        db.execute(text("DELETE FROM yeu_cau_chuyen_tra_phong;"))
        db.execute(text("DELETE FROM room_requests;"))
        db.execute(text("DELETE FROM hop_dong;"))
        db.execute(text("DELETE FROM phan_anh;"))
        db.execute(text("DELETE FROM vi_pham;"))

        # 2. Xóa sạch bảng SinhVien
        db.execute(text("DELETE FROM sinh_vien;"))

        # 3. Xóa thông tin người dùng tương ứng với tài khoản sinh viên
        db.execute(text("""
            DELETE nd FROM nguoi_dung nd
            INNER JOIN tai_khoan tk ON nd.ma_tai_khoan = tk.ma_tai_khoan
            WHERE LOWER(tk.vai_tro) IN ('sinh_vien', 'sinhvien');
        """))

        # Xóa các tài khoản sinh viên (TUYỆT ĐỐI GIỮ LẠI quan_ly và ke_toan)
        db.execute(text("""
            DELETE FROM tai_khoan 
            WHERE LOWER(vai_tro) IN ('sinh_vien', 'sinhvien');
        """))

        # 4. Chuẩn hóa đồng bộ dữ liệu Tòa - Tầng - Phòng - Giường:
        # Cập nhật mã tầng của Phòng 101 về A1_T1
        db.execute(text("""
            UPDATE phong SET ma_tang = 'A1_T1' 
            WHERE ma_tang = 'TANG_1_A1' OR (so_phong = '101' AND (ma_tang LIKE '%A1%' OR ma_tang IS NULL));
        """))
        # Xóa tầng dị biệt / trùng lặp (ví dụ: TANG_1_A1)
        db.execute(text("DELETE FROM tang WHERE ma_tang = 'TANG_1_A1' OR ma_tang LIKE 'TANG_%';"))

        # Đảm bảo các tầng chuẩn của Tòa A1 luôn tồn tại đồng bộ
        db.execute(text("""
            INSERT INTO tang (ma_tang, so_tang, ma_toa) VALUES 
            ('A1_T1', 1, 'A1'),
            ('A1_T2', 2, 'A1'),
            ('A1_T3', 3, 'A1')
            ON DUPLICATE KEY UPDATE so_tang = VALUES(so_tang), ma_toa = VALUES(ma_toa);
        """))

        # Đảm bảo các phòng 101, 201, 301 trỏ đúng vào tầng tương ứng
        db.execute(text("UPDATE phong SET ma_tang = 'A1_T1' WHERE so_phong = '101';"))
        db.execute(text("UPDATE phong SET ma_tang = 'A1_T2' WHERE so_phong = '201';"))
        db.execute(text("UPDATE phong SET ma_tang = 'A1_T3' WHERE so_phong = '301';"))

        # Cập nhật toàn bộ bản ghi trong bảng Giuong về trạng thái trống
        db.execute(text("UPDATE giuong SET trang_thai = 'TRONG';"))

        # Kích hoạt lại kiểm tra khóa ngoại FK
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        db.commit()

        # 5. Dọn dẹp hoàn toàn các file JSON store cũ nếu còn tồn tại
        app_dir = os.path.join(BASE_DIR, "app")
        json_files_to_clean = [
            "data_store_requests.json",
            "data_store_incidents.json",
            "data_store_transactions.json",
            "data_store_bank.json",
            "data_store_notifications.json",
            "bank_statements.json",
        ]
        for jf in json_files_to_clean:
            target_path = os.path.join(app_dir, jf)
            if os.path.exists(target_path):
                try:
                    os.remove(target_path)
                except Exception:
                    pass

        # In thông báo hoàn tất chuẩn theo yêu cầu
        print("Đã làm sạch dữ liệu sinh viên thành công, sẵn sàng test mới!")
        return True

    except Exception as e:
        db.rollback()
        try:
            db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
            db.commit()
        except Exception:
            pass
        print(f"Lỗi khi làm sạch dữ liệu: {e}")
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    reset_test_data()
