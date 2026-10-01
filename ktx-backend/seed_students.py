from datetime import date
from sqlalchemy import text
from app.core.database import engine

def run_seed():
    with engine.connect() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        # Clean spaces in msv
        conn.execute(text("UPDATE sinh_vien SET msv=REPLACE(msv, ' ', '')"))
        conn.execute(text("UPDATE hop_dong SET msv=REPLACE(msv, ' ', '')"))
        conn.execute(text("UPDATE tai_khoan SET ten_dang_nhap=REPLACE(ten_dang_nhap, ' ', '') WHERE vai_tro='SinhVien'"))
        
        # Check or update LNS26012113
        huy = conn.execute(text("SELECT msv FROM sinh_vien WHERE msv='LNS26012113'")).first()
        if not huy:
            conn.execute(text("UPDATE sinh_vien SET msv='LNS26012113' WHERE msv='LNS2611312106'"))
            conn.execute(text("UPDATE hop_dong SET msv='LNS26012113' WHERE msv='LNS2611312106'"))
            conn.execute(text("UPDATE tai_khoan SET ten_dang_nhap='LNS26012113' WHERE ten_dang_nhap='LNS2611312106'"))
        
        # Update Huy's info to match Figma Image 2
        conn.execute(text("""
            UPDATE sinh_vien sv
            JOIN nguoi_dung nd ON sv.ma_nguoi_dung = nd.ma_nguoi_dung
            SET sv.lop='CNTTK24M', sv.gioi_tinh='Nam', sv.khoa='Công nghệ thông tin',
                sv.que_quan='Thái Nguyên', sv.ngay_sinh='21/01/2006', sv.cccd='019206001234',
                sv.dia_chi='Số 45, Đường Hoàng Văn Thụ, Thái Nguyên',
                sv.nguoi_giam_ho='Hoàng Văn Hùng', sv.moi_quan_he='Bố', sv.sdt_nguoi_giam_ho='0988765432',
                sv.anh_dai_dien='https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200',
                nd.ho_ten='Hoàng Đông Huy', nd.email='LNS26012113@lns.edu.vn', nd.so_dien_thoai='0331 131 211'
            WHERE sv.msv='LNS26012113'
        """))
        
        # Ensure active contract for Huy in A1_P102_G01 (Tòa A1 - Phòng 102 - Giường 1)
        conn.execute(text("UPDATE giuong SET trang_thai='DA_O' WHERE ma_giuong='A1_P102_G01'"))
        conn.execute(text("""
            INSERT INTO hop_dong (ma_hop_dong, msv, ma_giuong, ngay_bat_dau, ngay_ket_thuc, trang_thai)
            VALUES ('HD26-A1102-G1', 'LNS26012113', 'A1_P102_G01', '2026-01-14', '2027-01-13', 'ACTIVE')
            ON DUPLICATE KEY UPDATE ma_giuong='A1_P102_G01', trang_thai='ACTIVE', ngay_ket_thuc='2027-01-13'
        """))
        
        # Incidents for Huy
        conn.execute(text("DELETE FROM phan_anh WHERE msv='LNS26012113'"))
        conn.execute(text("""
            INSERT INTO phan_anh (ma_phan_anh, msv, noi_dung, trang_thai, ngay_gui, phan_loai)
            VALUES 
            ('PA-26-001', 'LNS26012113', 'Đèn hành lang tầng 1 bị hỏng', 'Đã xử lý', '2026-03-10', 'Cơ sở vật chất'),
            ('PA-26-002', 'LNS26012113', 'Vòi nước phòng tắm chảy yếu', 'Đang xử lý', '2026-03-15', 'Điện nước')
        """))
        
        # Update DTC245080050 to Nguyễn Văn A in P102 - A1 (Figma Image 1)
        conn.execute(text("""
            UPDATE sinh_vien sv
            JOIN nguoi_dung nd ON sv.ma_nguoi_dung = nd.ma_nguoi_dung
            SET nd.ho_ten='Nguyễn Văn A', nd.email='dtc245080050@ictu.edu.vn', nd.so_dien_thoai='0388 123 456',
                sv.lop='CNTTK24A', sv.khoa='Công nghệ thông tin', sv.gioi_tinh='Nam',
                sv.que_quan='Hà Nội', sv.ngay_sinh='15/05/2006', sv.cccd='001206004567',
                sv.dia_chi='Phường Dịch Vọng, Quận Cầu Giấy, Hà Nội',
                sv.nguoi_giam_ho='Nguyễn Văn Long', sv.moi_quan_he='Bố', sv.sdt_nguoi_giam_ho='0912 345 678'
            WHERE sv.msv='DTC245080050'
        """))
        conn.execute(text("UPDATE giuong SET trang_thai='DA_O' WHERE ma_giuong='A1_P102_G02'"))
        conn.execute(text("""
            INSERT INTO hop_dong (ma_hop_dong, msv, ma_giuong, ngay_bat_dau, ngay_ket_thuc, trang_thai)
            VALUES ('HD26-A1102-G2', 'DTC245080050', 'A1_P102_G02', '2026-01-14', '2027-01-13', 'ACTIVE')
            ON DUPLICATE KEY UPDATE ma_giuong='A1_P102_G02', trang_thai='ACTIVE', ngay_ket_thuc='2027-01-13'
        """))
        
        # Update DTC245080051 & DTC245080052
        conn.execute(text("""
            UPDATE sinh_vien sv
            JOIN nguoi_dung nd ON sv.ma_nguoi_dung = nd.ma_nguoi_dung
            SET nd.ho_ten='Nguyễn Văn B', nd.email='dtc245080051@ictu.edu.vn', nd.so_dien_thoai='0399 234 567',
                sv.lop='KTPM01', sv.khoa='Kỹ thuật phần mềm', sv.gioi_tinh='Nam',
                sv.que_quan='Bắc Ninh', sv.ngay_sinh='20/08/2006', sv.cccd='027206008901',
                sv.dia_chi='Phường Suối Hoa, Thành phố Bắc Ninh, Bắc Ninh',
                sv.nguoi_giam_ho='Trần Thị Mai', sv.moi_quan_he='Mẹ', sv.sdt_nguoi_giam_ho='0987 654 321'
            WHERE sv.msv='DTC245080051'
        """))
        conn.execute(text("UPDATE giuong SET trang_thai='DA_O' WHERE ma_giuong='A1_P102_G03'"))
        conn.execute(text("""
            INSERT INTO hop_dong (ma_hop_dong, msv, ma_giuong, ngay_bat_dau, ngay_ket_thuc, trang_thai)
            VALUES ('HD26-A1102-G3', 'DTC245080051', 'A1_P102_G03', '2026-01-14', '2027-01-13', 'ACTIVE')
            ON DUPLICATE KEY UPDATE ma_giuong='A1_P102_G03', trang_thai='ACTIVE', ngay_ket_thuc='2027-01-13'
        """))

        # Update DTC245080052
        conn.execute(text("""
            UPDATE sinh_vien sv
            JOIN nguoi_dung nd ON sv.ma_nguoi_dung = nd.ma_nguoi_dung
            SET nd.ho_ten='Phan Vũ Hoàng Long', nd.email='dtc245080052@ictu.edu.vn', nd.so_dien_thoai='0377 345 678',
                sv.lop='CNTTK24B', sv.khoa='Công nghệ thông tin', sv.gioi_tinh='Nam',
                sv.que_quan='Hải Phòng', sv.ngay_sinh='10/11/2006', sv.cccd='031206012345',
                sv.dia_chi='Phường Lạch Tray, Quận Ngô Quyền, Hải Phòng',
                sv.nguoi_giam_ho='Phan Văn Hùng', sv.moi_quan_he='Bố', sv.sdt_nguoi_giam_ho='0976 543 210'
            WHERE sv.msv='DTC245080052'
        """))

        # Update any remaining students without info to have complete fallback data
        conn.execute(text("""
            UPDATE sinh_vien sv
            JOIN nguoi_dung nd ON sv.ma_nguoi_dung = nd.ma_nguoi_dung
            SET 
                sv.gioi_tinh = COALESCE(sv.gioi_tinh, 'Nam'),
                sv.ngay_sinh = COALESCE(sv.ngay_sinh, '21/01/2006'),
                sv.cccd = COALESCE(sv.cccd, '019206001234'),
                sv.que_quan = COALESCE(sv.que_quan, 'Thái Nguyên'),
                sv.dia_chi = COALESCE(sv.dia_chi, 'Số 45, Đường Hoàng Văn Thụ, Thái Nguyên'),
                sv.nguoi_giam_ho = COALESCE(sv.nguoi_giam_ho, 'Hoàng Văn Hùng'),
                sv.moi_quan_he = COALESCE(sv.moi_quan_he, 'Bố'),
                sv.sdt_nguoi_giam_ho = COALESCE(sv.sdt_nguoi_giam_ho, '0988 765 432'),
                nd.so_dien_thoai = COALESCE(nd.so_dien_thoai, '0331 131 211')
            WHERE sv.dia_chi IS NULL OR sv.cccd IS NULL OR sv.ngay_sinh IS NULL
        """))

        conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
        conn.commit()
        print("Data seeded successfully!")

if __name__ == "__main__":
    run_seed()
