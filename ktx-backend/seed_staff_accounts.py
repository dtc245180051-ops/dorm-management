import uuid
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import TaiKhoan, NguoiDung, QuanLy, KeToan, VaiTro

def upsert_account(
    db,
    username: str,
    password: str,
    role: VaiTro,
    full_name: str,
    email: str,
    phone: str,
    staff_id: str,
):
    print(f"--- Đang cấu hình tài khoản: {username} ({role.value}) ---")
    
    # 1. TaiKhoan
    acc = db.query(TaiKhoan).filter(TaiKhoan.ten_dang_nhap == username).first()
    if not acc:
        acc = TaiKhoan(
            ma_tai_khoan=f"TK_{uuid.uuid4().hex[:12]}",
            ten_dang_nhap=username,
            mat_khau=get_password_hash(password),
            vai_tro=role,
        )
        db.add(acc)
        db.flush()
        print(f"  [+] Đã tạo tài khoản mới: {username}")
    else:
        acc.mat_khau = get_password_hash(password)
        acc.vai_tro = role
        db.flush()
        print(f"  [*] Đã cập nhật mật khẩu & vai trò cho tài khoản: {username}")

    # 2. NguoiDung
    nd = db.query(NguoiDung).filter(
        (NguoiDung.ma_tai_khoan == acc.ma_tai_khoan) | (NguoiDung.email == email)
    ).first()
    if not nd:
        nd = NguoiDung(
            ma_nguoi_dung=f"ND_{uuid.uuid4().hex[:12]}",
            ma_tai_khoan=acc.ma_tai_khoan,
            ho_ten=full_name,
            email=email,
            so_dien_thoai=phone,
        )
        db.add(nd)
        db.flush()
        print(f"  [+] Đã tạo thông tin người dùng: {full_name} ({email})")
    else:
        nd.ma_tai_khoan = acc.ma_tai_khoan
        nd.ho_ten = full_name
        nd.email = email
        nd.so_dien_thoai = phone
        db.flush()
        print(f"  [*] Đã cập nhật thông tin người dùng: {full_name}")

    # 3. Role-specific record (QuanLy / KeToan)
    if role == VaiTro.QUAN_LY:
        ql = db.query(QuanLy).filter(
            (QuanLy.ma_quan_ly == staff_id) | (QuanLy.ma_nguoi_dung == nd.ma_nguoi_dung)
        ).first()
        if not ql:
            ql = QuanLy(
                ma_quan_ly=staff_id,
                ma_nguoi_dung=nd.ma_nguoi_dung,
            )
            db.add(ql)
            print(f"  [+] Đã liên kết bản ghi Quản Lý (Mã QL: {staff_id})")
        else:
            ql.ma_quan_ly = staff_id
            ql.ma_nguoi_dung = nd.ma_nguoi_dung
            print(f"  [*] Bản ghi Quản Lý đã tồn tại (Mã QL: {staff_id})")

    elif role == VaiTro.KE_TOAN:
        kt = db.query(KeToan).filter(
            (KeToan.ma_ke_toan == staff_id) | (KeToan.ma_nguoi_dung == nd.ma_nguoi_dung)
        ).first()
        if not kt:
            kt = KeToan(
                ma_ke_toan=staff_id,
                ma_nguoi_dung=nd.ma_nguoi_dung,
            )
            db.add(kt)
            print(f"  [+] Đã liên kết bản ghi Kế Toán (Mã KT: {staff_id})")
        else:
            kt.ma_ke_toan = staff_id
            kt.ma_nguoi_dung = nd.ma_nguoi_dung
            print(f"  [*] Bản ghi Kế Toán đã tồn tại (Mã KT: {staff_id})")

    return acc


def main():
    db = SessionLocal()
    try:
        # 1. Tài khoản Quản lý KTX: quanly (mk: 123456)
        upsert_account(
            db=db,
            username="quanly",
            password="password123",  # also 123456
            role=VaiTro.QUAN_LY,
            full_name="Quản Lý Ký Túc Xá",
            email="quanly@ictu.edu.vn",
            phone="0988000001",
            staff_id="QL01",
        )

        # 2. Tài khoản Quản lý KTX: QL_Minh (mk: password123)
        upsert_account(
            db=db,
            username="QL_Minh",
            password="password123",
            role=VaiTro.QUAN_LY,
            full_name="Quản lý Minh",
            email="ql_minh@ictu.edu.vn",
            phone="0988000002",
            staff_id="QL_MINH",
        )

        # 3. Tài khoản Kế toán: ketoan (mk: 123456)
        upsert_account(
            db=db,
            username="ketoan",
            password="password123",
            role=VaiTro.KE_TOAN,
            full_name="Kế Toán Ký Túc Xá",
            email="ketoan@ictu.edu.vn",
            phone="0988000003",
            staff_id="KT01",
        )

        # 4. Tài khoản Kế toán: KT_Hoa (mk: password123)
        upsert_account(
            db=db,
            username="KT_Hoa",
            password="password123",
            role=VaiTro.KE_TOAN,
            full_name="Kế Toán Hoa",
            email="kt_hoa@ictu.edu.vn",
            phone="0988000004",
            staff_id="KT_HOA",
        )

        db.commit()
        print("\n===> Hoàn thành thiết lập tài khoản Quản lý và Kế toán thành công!")
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    main()
