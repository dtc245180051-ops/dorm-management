---
name: occupancy-lifecycle
description: Nghiệp vụ vòng đời lưu trú Ký túc xá - Đăng ký ở, phê duyệt xếp phòng, chuyển và trả phòng dành cho phân hệ Sinh viên và Ban Quản lý.
---

# Occupancy Lifecycle Management Skill (Quy trình Quản lý Lưu trú KTX)

## 1. Mục tiêu & Phạm vi
Tài liệu này chuẩn hóa quy trình và API cho toàn bộ vòng đời lưu trú của sinh viên trong Ký túc xá:
1. **Đăng ký ở mới (Room Registration)**: Sinh viên tra cứu các vị trí phòng/giường trống khả dụng, điền đơn đăng ký trực tuyến với thông tin cá nhân, thông tin liên hệ khẩn cấp và nguyện vọng lưu trú.
2. **Tiếp nhận & Xử lý yêu cầu (Admin Approval)**: Ban Quản lý xem chi tiết đơn, xem gợi ý xếp chỗ của AI/hệ thống, chọn Tòa - Phòng - Giường để duyệt hoặc từ chối đơn kèm lý do. Khi duyệt: hệ thống tự động sinh mã hợp đồng chuẩn `HD{YY}-{toa}{phong}-G{giuong}` và kích hoạt hợp đồng lưu trú.
3. **Chuyển phòng & Trả phòng**: Xử lý yêu cầu thay đổi phòng ở hoặc chấm dứt hợp đồng khi sinh viên hoàn thành khóa học.

---

## 2. API Endpoints Chuẩn hóa

### 2.1. Tra cứu tùy chọn phòng khả dụng
- **Endpoint**: `GET /api/v1/student/requests/available-options`
- **Quyền hạn**: Sinh viên (`SinhVien`), Quản lý (`QuanLy`)
- **Mô tả**: Trả về danh sách các phòng và giường còn trống để sinh viên lựa chọn khi đăng ký.

### 2.2. Gửi đơn đăng ký ở
- **Endpoint**: `POST /api/v1/student/requests/register`
- **Quyền hạn**: Sinh viên (`SinhVien`)
- **Payload**: Gồm thông tin sinh viên, đối tượng ưu tiên, người giám hộ, nguyện vọng phòng và nội dung nguyện vọng.

### 2.3. Lấy chi tiết đơn đăng ký phía Quản lý
- **Endpoint**: `GET /api/v1/admin/occupancy/requests/{id}`
- **Quyền hạn**: Quản lý (`QuanLy`)
- **Response Format**:
```json
{
  "id": "DK-001",
  "msv": "B21DCCN001",
  "ho_ten": "Nguyễn Văn A",
  "gioi_tinh": "Nam",
  "ngay_sinh": "2003-05-15",
  "cccd": "001203004567",
  "so_dien_thoai": "0987654321",
  "email": "nguyenvana@ictu.edu.vn",
  "khoa": "Công nghệ thông tin",
  "lop": "D21CQCN01-B",
  "dia_chi": "Số 123 Đường Cầu Giấy, Hà Nội",
  "nguoi_giam_ho": "Nguyễn Văn B",
  "moi_quan_he": "Bố",
  "sdt_nguoi_giam_ho": "0912345678",
  "nguyen_vong": "Xin hãy xếp cho em 1 phòng nào đó ở tòa A với ạ 🥹",
  "goi_y": {
    "ma_toa": "A",
    "ma_phong": "A203",
    "ma_giuong": "G04"
  }
}
```

### 2.4. Phê duyệt & Xếp phòng
- **Endpoint**: `PUT /api/v1/admin/occupancy/requests/{id}/approve`
- **Quyền hạn**: Quản lý (`QuanLy`)
- **Payload**:
```json
{
  "ma_toa": "A",
  "phong_id": "A203",
  "giuong_id": "G04"
}
```
- **Quy tắc tạo mã hợp đồng tự động**:
  Format: `HD{YY}-{toa}{phong}-G{giuong}` (Ví dụ năm 2026: `HD26-A203-G04`).
- **Hành động hệ thống**:
  + Chuyển trạng thái giường sang đã có người ở (`DA_CO_NGUOI` hoặc `DA_O`).
  + Tạo hợp đồng lưu trú `HopDong` với trạng thái `ACTIVE`.
  + Cập nhật trạng thái đơn thành `DA_DUYET`.

### 2.5. Từ chối đơn đăng ký
- **Endpoint**: `PUT /api/v1/admin/occupancy/requests/{id}/reject`
- **Quyền hạn**: Quản lý (`QuanLy`)
- **Payload**:
```json
{
  "ly_do_tu_choi": "Hiện tại các phòng tòa A đã hết giường trống phù hợp."
}
```
- **Hành động hệ thống**:
  + Cập nhật trạng thái đơn thành `TU_CHOI` và ghi nhận lý do.

---

## 3. Quy chuẩn luồng giao diện Quản lý (Admin UI Lifecycle Flow)
1. **Giao diện trang xử lý yêu cầu**:
   - Sử dụng `AdminLayout` với Sidebar iDORM và Header quản trị viên.
   - Nút quay lại (`<`) cạnh tiêu đề "Yêu cầu đăng ký ở".
   - 4 Card dữ liệu:
     * Card 1: Thông tin sinh viên (2 cột, read-only input).
     * Card 2: Thông tin liên hệ khẩn cấp (Họ tên người giám hộ, Mối quan hệ, SĐT).
     * Card 3: Nguyện vọng (Hiển thị text nguyện vọng của sinh viên).
     * Card 4: Gợi ý xếp chỗ của hệ thống (3 dropdown liên hoàn: Tòa -> Phòng -> Giường).
   - Bộ 2 nút hành động:
     * Nút "Từ chối đơn" (Màu hồng/đỏ nhạt): Mở popup `RejectModal` yêu cầu nhập lý do.
     * Nút "Phê duyệt & xếp phòng" (Màu xanh dương nhạt): Kiểm tra hợp lệ và gọi API phê duyệt.
