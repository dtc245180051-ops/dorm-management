---
name: database-design
description: Design normalized relational database schema, SQLAlchemy models, and design documentation for Dormitory Management System based on domain class specifications.
---

# Database Design Skill

## 1. Objective
Thiết kế cấu trúc cơ sở dữ liệu quan hệ chuẩn hóa (chuẩn 3NF), sinh mã nguồn SQLAlchemy 2.0 Models và lập tài liệu đặc tả thiết kế cơ sở dữ liệu hoàn chỉnh cho hệ thống Quản lý Ký túc xá có tích hợp AI.

## 2. Đặc tả Thực thể & Thuộc tính Nghiệp vụ

### 2.1. Nhóm Người dùng & Phân quyền (Account & Identity)
- **`tai_khoan` (TaiKhoan)**:
  - `ma_tai_khoan`: String/UUID, Primary Key
  - `ten_dang_nhap`: String(50), Unique, Not Null, Index
  - `mat_khau`: String(255), Not Null (Lưu trữ hashed password với bcrypt)
  - `vai_tro`: Enum ("QuanLy", "SinhVien", "KeToan"), Not Null
- **`nguoi_dung` (NguoiDung)**:
  - `ma_nguoi_dung`: String/UUID, Primary Key
  - `ma_tai_khoan`: String/UUID, Foreign Key (`tai_khoan.ma_tai_khoan`), Unique, Not Null (Quan hệ 1-1)
  - `ho_ten`: String(100), Not Null
  - `email`: String(100), Unique, Nullable
  - `so_dien_thoai`: String(15), Nullable
- **Phân quyền người dùng chi tiết (Role Specialization)**:
  - **`sinh_vien` (SinhVien)**:
    - `msv`: String(20), Primary Key / Unique, Index
    - `ma_nguoi_dung`: String/UUID, Foreign Key (`nguoi_dung.ma_nguoi_dung`), Unique
    - `lop`: String(50), Not Null
    - `gioi_tinh`: String(10), Not Null ("Nam", "Nu")
  - **`quan_ly` (QuanLy)**:
    - `ma_quan_ly`: String(20), Primary Key
    - `ma_nguoi_dung`: String/UUID, Foreign Key (`nguoi_dung.ma_nguoi_dung`), Unique
  - **`ke_toan` (KeToan)**:
    - `ma_ke_toan`: String(20), Primary Key
    - `ma_nguoi_dung`: String/UUID, Foreign Key (`nguoi_dung.ma_nguoi_dung`), Unique

### 2.2. Nhóm Cơ sở vật chất Ký túc xá (Facilities)
- **`toa_nha` (ToaNha)**:
  - `ma_toa`: String(20), Primary Key
  - `ten_toa`: String(50), Not Null, Unique
- **`tang` (Tang)**:
  - `ma_tang`: String(20), Primary Key
  - `so_tang`: Integer, Not Null
  - `ma_toa`: String(20), Foreign Key (`toa_nha.ma_toa`), Not Null (Quan hệ N-1)
- **`phong` (Phong)**:
  - `ma_phong`: String(20), Primary Key
  - `so_phong`: String(20), Not Null
  - `suc_chua`: Integer, Default=4
  - `loai_phong`: String(50), Not Null (Ví dụ: "Phong 4 nguoi", "Phong 6 nguoi")
  - `ma_tang`: String(20), Foreign Key (`tang.ma_tang`), Not Null (Quan hệ N-1)
- **`giuong` (Giuong)**:
  - `ma_giuong`: String(20), Primary Key
  - `trang_thai`: String(20), Default="TRONG" ("TRONG", "DA_CO_NGUOI")
  - `ma_phong`: String(20), Foreign Key (`phong.ma_phong`), Not Null (Quan hệ N-1)

### 2.3. Nhóm Nghiệp vụ Ở, Hợp đồng & Tài chính (Contracts & Billing)
- **`hop_dong` (HopDong)**:
  - `ma_hop_dong`: String(20), Primary Key
  - `msv`: String(20), Foreign Key (`sinh_vien.msv`), Not Null
  - `ma_giuong`: String(20), Foreign Key (`giuong.ma_giuong`), Not Null
  - `ngay_bat_dau`: Date, Not Null
  - `ngay_ket_thuc`: Date, Nullable
  - `trang_thai`: String(20), Default="ACTIVE" ("ACTIVE", "EXPIRED", "TERMINATED")
- **`yeu_cau_chuyen_tra_phong` (YeuCauChuyenTraPhong)**:
  - `ma_yeu_cau`: String(20), Primary Key
  - `msv`: String(20), Foreign Key (`sinh_vien.msv`), Not Null
  - `ma_hop_dong`: String(20), Foreign Key (`hop_dong.ma_hop_dong`), Not Null
  - `loai_yeu_cau`: String(50), Not Null ("CHUYEN_PHONG", "TRA_PHONG")
  - `trang_thai`: String(20), Default="CHO_DUYET" ("CHO_DUYET", "DA_DUYET", "TU_CHOI")
- **`phi` (Phi)**:
  - `ma_phi`: String(20), Primary Key
  - `ma_hop_dong`: String(20), Foreign Key (`hop_dong.ma_hop_dong`), Not Null
  - `loai_phi`: String(50), Not Null ("TIEN_PHONG", "TIEN_DIEN", "TIEN_NUOC")
  - `so_tien`: Double / Float, Not Null
  - `han_nop`: Date, Not Null
- **`thanh_toan` (ThanhToan)**:
  - `ma_thanh_toan`: String(20), Primary Key
  - `ma_phi`: String(20), Foreign Key (`phi.ma_phi`), Not Null
  - `so_tien_da_dong`: Double / Float, Not Null
  - `ngay_thanh_toan`: Date, Not Null

### 2.4. Nhóm Phản ánh, Vi phạm & Tri thức AI (Incidents & AI Knowledge)
- **`phan_anh` (PhanAnh)**:
  - `ma_phan_anh`: String(20), Primary Key
  - `msv`: String(20), Foreign Key (`sinh_vien.msv`), Not Null
  - `noi_dung`: Text, Not Null
  - `trang_thai`: String(20), Default="TIEP_NHAN" ("TIEP_NHAN", "DANG_XU_LY", "HOAN_THANH")
  - `ngay_gui`: Date, Not Null
  - `phan_loai`: String(50), Nullable (Do AI phân loại tự động: "Dien", "Nuoc", "VeSinh", "AnNinh")
  - `tom_tat`: Text, Nullable (Do AI tóm tắt ngắn gọn sự cố)
- **`vi_pham` (ViPham)**:
  - `ma_vi_pham`: String(20), Primary Key
  - `msv`: String(20), Foreign Key (`sinh_vien.msv`), Not Null
  - `mo_ta`: Text, Not Null
  - `ngay_vi_pham`: Date, Not Null
  - `hinh_thuc_xu_ly`: String(100), Not Null
- **`noi_quy` (NoiQuy)**:
  - `ma_noi_quy`: String(20), Primary Key
  - `noi_dung`: Text, Not Null (Lưu trữ điều khoản nội quy KTX làm nguồn dữ liệu RAG cho Chatbot)

## 3. Rules & Coding Conventions
- **Không tạo bảng cho các lớp Service/Logic**:
  - `ChatbotService`, `AIService`, `GoiYXepPhong` là các lớp xử lý thuật toán/AI nằm ở tầng service (`app/services/`), tuyệt đối không tạo bảng CSDL cho các lớp này.
- **Quy chuẩn CSDL**:
  - Sử dụng SQLAlchemy 2.0 với cú pháp Declarative Base.
  - Tên bảng và tên trường tuân theo chuẩn `snake_case`.
  - Mọi quan hệ 1-1, 1-N đều phải định nghĩa `relationship()` kèm `back_populates` đối xứng ở cả 2 bên.
  - Khóa ngoại luôn có `ondelete="CASCADE"` ở các quan hệ phụ thuộc (ví dụ xóa Tòa -> xóa Tầng -> xóa Phòng -> xóa Giường).
- **Phục vụ truy vấn**:
  - Đánh index cho các trường thường xuyên tra cứu: `ten_dang_nhap`, `msv`, `trang_thai` (phòng, giường, hợp đồng).

## 4. Outputs
Khi thực thi skill này, sinh ra đúng các kết quả sau:

1. **Tài liệu thiết kế CSDL (`docs/database-design.md`)**:
   - Thuyết minh danh sách bảng, cột, kiểu dữ liệu, khóa chính, khóa ngoại.
   - Sơ đồ liên kết quan hệ dạng Text/Mermaid.
   - Mô tả cách lưu trữ dữ liệu hỗ trợ các tính năng AI (RAG nội quy, tóm tắt phản ánh).

2. **Mã nguồn Models SQLAlchemy**:
   - `app/models/user.py`
   - `app/models/dorm.py`
   - `app/models/contract.py`
   - `app/models/incident.py`
   - `app/models/__init__.py`