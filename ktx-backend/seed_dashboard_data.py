import uuid
from datetime import date
from sqlalchemy import text
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import TaiKhoan, NguoiDung, SinhVien, VaiTro
from app.models.contract import HopDong
from app.models.dorm import Giuong, Phong, ToaNha

def seed():
    db = SessionLocal()
    try:
        # -------------------------------------------------------------
        # 1. SETUP ACCOUNT sv_noroom (Sinh viên chưa nộp đơn/chưa có phòng)
        # -------------------------------------------------------------
        acc = db.query(TaiKhoan).filter(TaiKhoan.ten_dang_nhap == "sv_noroom").first()
        if not acc:
            acc = TaiKhoan(
                ma_tai_khoan=f"TK_{uuid.uuid4().hex[:12]}",
                ten_dang_nhap="sv_noroom",
                mat_khau=get_password_hash("123456"),
                vai_tro=VaiTro.SINH_VIEN,
            )
            db.add(acc)
            db.flush()
        else:
            acc.mat_khau = get_password_hash("123456")
            acc.vai_tro = VaiTro.SINH_VIEN

        nd = db.query(NguoiDung).filter(
            (NguoiDung.ma_tai_khoan == acc.ma_tai_khoan) | (NguoiDung.email == "sv_noroom@ictu.edu.vn")
        ).first()
        if not nd:
            nd = NguoiDung(
                ma_nguoi_dung=f"ND_{uuid.uuid4().hex[:12]}",
                ma_tai_khoan=acc.ma_tai_khoan,
                ho_ten="Sinh viên Chưa có phòng",
                email="sv_noroom@ictu.edu.vn",
                so_dien_thoai="0999000111",
            )
            db.add(nd)
            db.flush()
        else:
            nd.ma_tai_khoan = acc.ma_tai_khoan
            nd.ho_ten = "Sinh viên Chưa có phòng"
            nd.email = "sv_noroom@ictu.edu.vn"

        sv = db.query(SinhVien).filter(SinhVien.msv.in_(["SV_NOROOM", "sv_noroom"])).first()
        if not sv:
            sv = SinhVien(
                msv="SV_NOROOM",
                ma_nguoi_dung=nd.ma_nguoi_dung,
                lop="CNTTK24A",
                khoa="Công nghệ thông tin",
                gioi_tinh="Nam",
            )
            db.add(sv)
            db.flush()
        else:
            sv.ma_nguoi_dung = nd.ma_nguoi_dung

        # Xóa tất cả hợp đồng & yêu cầu của sv_noroom nếu có
        db.query(HopDong).filter(HopDong.msv.in_(["SV_NOROOM", "sv_noroom"])).delete(synchronize_session=False)
        db.execute(text("DELETE FROM yeu_cau_chuyen_tra_phong WHERE msv IN ('SV_NOROOM', 'sv_noroom')"))
        db.execute(text("DELETE FROM phan_anh WHERE msv IN ('SV_NOROOM', 'sv_noroom')"))

        print("1. Seeded sv_noroom successfully without any room or request.")

        # -------------------------------------------------------------
        # 2. SEED OCCUPANCY FOR TOA A1 (9/12 giuong = 75%)
        # -------------------------------------------------------------
        student_bed_map = [
            # P101 (3/4 occupied)
            ("DTC245180008", "Nguyễn Văn Dũng", "A1_T1_P101_G01", "HD26-A1101-G01"),
            ("DTC245180086", "Trần Đình Trọng", "A1_T1_P101_G02", "HD26-A1101-G02"),
            ("DTC245180096", "Lê Văn Hùng", "A1_T1_P101_G03", "HD26-A1101-G03"),
            # P201 (3/4 occupied)
            ("DTC245180097", "Phạm Quốc Tuấn", "A1_T2_P201_G01", "HD26-A1201-G01"),
            ("DTC245180099", "Hoàng Đông Huy", "A1_T2_P201_G02", "HD26-A1201-G02"),
            ("DTC245180123", "Vũ Minh Quân", "A1_T2_P201_G03", "HD26-A1201-G03"),
            # P301 (3/4 occupied)
            ("DTC245180006", "Đào Tuấn Cường", "A1_T3_P301_G01", "HD26-A1301-G01"),
            ("DTC245180010", "Nguyễn Văn B", "A1_T3_P301_G02", "HD26-A1301-G02"),
            ("DTC245180001", "Nguyễn Văn An", "A1_T3_P301_G03", "HD26-A1301-G03"),
        ]

        empty_beds = [
            "A1_T1_P101_G04",
            "A1_T2_P201_G04",
            "A1_T3_P301_G04",
        ]

        # Ensure all empty beds have status TRONG and no contract
        for bed_id in empty_beds:
            b = db.query(Giuong).filter(Giuong.ma_giuong == bed_id).first()
            if b:
                b.trang_thai = "TRONG"
                db.query(HopDong).filter(HopDong.ma_giuong == bed_id).delete(synchronize_session=False)

        # Assign the 9 occupied beds
        for msv, name, bed_id, hd_id in student_bed_map:
            s_sv = db.query(SinhVien).filter(SinhVien.msv == msv).first()
            if not s_sv:
                email_val = f"{msv.lower()}@ictu.edu.vn"
                s_nd = db.query(NguoiDung).filter(NguoiDung.email == email_val).first()
                if not s_nd:
                    s_acc = db.query(TaiKhoan).filter(TaiKhoan.ten_dang_nhap == msv.lower()).first()
                    if not s_acc:
                        s_acc = TaiKhoan(
                            ma_tai_khoan=f"TK_{uuid.uuid4().hex[:12]}",
                            ten_dang_nhap=msv.lower(),
                            mat_khau=get_password_hash("123456"),
                            vai_tro=VaiTro.SINH_VIEN,
                        )
                        db.add(s_acc)
                        db.flush()

                    s_nd = NguoiDung(
                        ma_nguoi_dung=f"ND_{uuid.uuid4().hex[:12]}",
                        ma_tai_khoan=s_acc.ma_tai_khoan,
                        ho_ten=name,
                        email=email_val,
                        so_dien_thoai="0988123456",
                    )
                    db.add(s_nd)
                    db.flush()

                s_sv = SinhVien(
                    msv=msv,
                    ma_nguoi_dung=s_nd.ma_nguoi_dung,
                    lop="CNTTK24A",
                    khoa="Công nghệ thông tin",
                    gioi_tinh="Nam",
                )
                db.add(s_sv)
                db.flush()

            # Set bed status
            b = db.query(Giuong).filter(Giuong.ma_giuong == bed_id).first()
            if b:
                b.trang_thai = "DA_CO_NGUOI"

            # Create or update active contract
            hd = db.query(HopDong).filter(HopDong.ma_hop_dong == hd_id).first()
            if not hd:
                hd = HopDong(
                    ma_hop_dong=hd_id,
                    msv=msv,
                    ma_giuong=bed_id,
                    ngay_bat_dau=date(2026, 9, 1),
                    ngay_ket_thuc=date(2027, 6, 30),
                    trang_thai="ACTIVE",
                )
                db.add(hd)
            else:
                hd.msv = msv
                hd.ma_giuong = bed_id
                hd.ngay_bat_dau = date(2026, 9, 1)
                hd.ngay_ket_thuc = date(2027, 6, 30)
                hd.trang_thai = "ACTIVE"

        db.commit()
        print("2. Seeded Toa A1 occupancy: 9/12 beds occupied (75%).")
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
