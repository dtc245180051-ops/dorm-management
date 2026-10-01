---
name: dorm-crud-setup
description: Implement full CRUD and business logic APIs for Buildings, Floors, Rooms, Beds, and Students with role-based access control (RBAC).
---

# Dormitory & Student Management CRUD Skill

## 1. Objective
Triển khai toàn bộ tầng Pydantic Schemas, Services và Routers cho các nghiệp vụ:
1. Quản lý cơ sở vật chất KTX: Tòa nhà (`ToaNha`), Tầng (`Tang`), Phòng (`Phong`), Giường (`Giuong`).
2. Quản lý hồ sơ sinh viên: Sinh viên (`SinhVien`), liên kết tài khoản và thông tin người dùng (`NguoiDung`).
3. Nghiệp vụ tra cứu chỗ trống theo tòa/tầng/phòng phục vụ trực tiếp cho module AI gợi ý xếp phòng sau này.

## 2. Invariants & Architecture Rules
- **Phân quyền (RBAC)**:
  - Chỉ `QuanLy` có quyền: Tạo/Sửa/Xóa Tòa nhà, Tầng, Phòng, Giường, Sinh viên.
  - `QuanLy`, `KeToan`, `SinhVien` đều có quyền xem danh sách phòng/giường trống và thông tin hồ sơ của chính mình (`get_current_user`).
- **Ràng buộc nghiệp vụ (Business Constraints)**:
  - Khi tạo một `Phong` mới với `suc_chua = N`, tự động sinh sẵn `N` bản ghi `Giuong` tương ứng (ví dụ: giường 1, 2, ..., N) với trạng thái mặc định là `"TRONG"`.
  - Không được phép xóa `Phong` hoặc `Giuong` nếu đang có hợp đồng (`HopDong`) có trạng thái `ACTIVE`.
  - Không được tạo trùng `so_phong` trong cùng một `Tang`.
  - `SinhVien.msv` là duy nhất (Unique).

## 3. Execution Process for AI Agent

### Bước 1: Định nghĩa Pydantic Schemas (`app/schemas/dorm.py` & `app/schemas/student.py`)
- Trong `app/schemas/dorm.py`:
  - `ToaNhaCreate`, `ToaNhaResponse`
  - `TangCreate`, `TangResponse`
  - `PhongCreate` (so_phong, suc_chua, loai_phong, ma_tang), `PhongUpdate`, `PhongResponse` (kèm danh sách giường)
  - `GiuongCreate`, `GiuongUpdateStatus`, `GiuongResponse`
  - `RoomAvailableResponse`: Chứa thông tin phòng, tòa, số giường trống hiện có.
- Trong `app/schemas/student.py`:
  - `SinhVienCreate` (msv, ho_ten, email, so_dien_thoai, lop, gioi_tinh, mat_khau_khoi_tao)
  - `SinhVienUpdate` (ho_ten, so_dien_thoai, lop, email)
  - `SinhVienResponse` (msv, ho_ten, email, so_dien_thoai, lop, gioi_tinh, thong_tin_phong_hien_tai)

### Bước 2: Xây dựng Services Layer (`app/services/dorm_service.py` & `app/services/student_service.py`)
- Trong `app/services/dorm_service.py`:
  - CRUD cho `ToaNha`, `Tang`.
  - `create_room(db, room_data)`: Tạo phòng và tự động vòng lặp tạo danh sách `Giuong` tương ứng.
  - `get_available_beds(db, gender=None, building_id=None)`: Lọc danh sách giường có trạng thái `"TRONG"`.
  - `delete_room(db, ma_phong)`: Kiểm tra ràng buộc hợp đồng trước khi xóa.
- Trong `app/services/student_service.py`:
  - `create_student(db, student_data)`: Tạo tài khoản (`TaiKhoan` với vai trò `SinhVien`), tạo `NguoiDung`, sau đó tạo `SinhVien`.
  - `get_students(db, skip, limit, search_keyword)`: Lọc theo MSV, tên, lớp.
  - `get_student_by_msv(db, msv)`: Lấy chi tiết sinh viên kèm lịch sử hợp đồng/giường.
  - `update_student(db, msv, update_data)`: Cập nhật thông tin sinh viên và người dùng.

### Bước 3: Xây dựng Routers (`app/routers/rooms.py` & `app/routers/students.py`)
- Trong `app/routers/rooms.py` (prefix: `/api/v1/rooms`):
  - `POST /buildings`: Tạo tòa mới với `dependencies=[Depends(RoleChecker(["QuanLy"]))]`.
  - `GET /buildings`: Lấy danh sách tòa kèm các tầng.
  - `POST /`: Tạo phòng mới (tự sinh giường) với `RoleChecker(["QuanLy"])`.
  - `GET /available`: Lấy danh sách các phòng/giường còn trống.
  - `GET /{ma_phong}`: Chi tiết phòng và danh sách giường.
  - `PUT /{ma_phong}`: Sửa thông tin phòng với `RoleChecker(["QuanLy"])`.
  - `DELETE /{ma_phong}`: Xóa phòng với `RoleChecker(["QuanLy"])`.
- Trong `app/routers/students.py` (prefix: `/api/v1/students`):
  - `POST /`: Tiếp nhận hồ sơ sinh viên mới với `RoleChecker(["QuanLy"])`.
  - `GET /`: Danh sách sinh viên có phân trang & tìm kiếm với `RoleChecker(["QuanLy", "KeToan"])`.
  - `GET /{msv}`: Chi tiết một sinh viên.
  - `PUT /{msv}`: Cập nhật thông tin sinh viên.
  - `DELETE /{msv}`: Xóa hồ sơ sinh viên với `RoleChecker(["QuanLy"])`.

### Bước 4: Đăng ký Routers vào `app/main.py`
- Import `rooms` và `students` routers.
- Gắn vào app chính:
  - `app.include_router(rooms.router, prefix="/api/v1")`
  - `app.include_router(students.router, prefix="/api/v1")`

## 4. Outputs
- Tạo mới/cập nhật:
  - `app/schemas/dorm.py`
  - `app/schemas/student.py`
  - `app/services/dorm_service.py`
  - `app/services/student_service.py`
  - `app/routers/rooms.py`
  - `app/routers/students.py`
  - `app/main.py`
- Đảm bảo kiểm thử thành công trên Swagger UI (`/docs`) với đầy đủ các API CRUD cho cơ sở vật chất và sinh viên.
