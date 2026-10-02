---
name: invoice-backend
description: Xây dựng Backend cho chức năng lập hóa đơn định kỳ dành cho Kế toán, tích hợp với cấu trúc và authentication hiện có của hệ thống.
---

# Backend - Lập hóa đơn định kỳ

## 1. Mục tiêu

Xây dựng Backend cho chức năng:

- Lập hóa đơn tiền phòng theo kỳ.
- Lập hóa đơn tiền điện nước theo tháng.
- Phát hành hóa đơn.
- Kiểm tra quyền Kế toán.

Chức năng này phải được tích hợp vào Backend hiện tại.

---

## 2. Quy tắc bắt buộc

### Không được làm ảnh hưởng hệ thống hiện tại

- Không xóa file hiện có.
- Không xóa function, API, model hoặc router hiện có.
- Không thay đổi logic của chức năng khác.
- Không đổi tên file hoặc thư mục hiện có.
- Không di chuyển file hiện có.
- Không thay đổi framework hoặc kiến trúc Backend.
- Không tạo lại database.
- Không reset database.
- Không tự ý refactor code không liên quan.

### Trước khi code

Phải kiểm tra:

- Cấu trúc Backend.
- Authentication hiện tại.
- Role hiện tại.
- Model/database hiện tại.
- Router/API hiện tại.
- Cơ chế migration hiện tại.

Chỉ thêm những thành phần cần thiết cho chức năng lập hóa đơn.

Nếu cần chỉnh sửa file dùng chung:

- Giữ nguyên logic cũ.
- Chỉ thêm phần cần thiết.
- Không thay đổi hành vi của chức năng hiện tại.

---

## 3. Phân quyền

Chức năng lập hóa đơn chỉ dành cho role:

`KeToan`

Backend phải kiểm tra quyền.

- `KeToan` → được phép.
- `SinhVien` → không được phép.
- `QuanLy` → không được phép.
- Chưa đăng nhập → không được phép.

Sử dụng authentication và role hiện có.

Không tạo hệ thống authentication hoặc role mới.

Frontend không được là lớp bảo mật duy nhất.

---

## 4. Hóa đơn tiền phòng

Backend cần hỗ trợ:

- Lấy danh sách đối tượng cần lập hóa đơn.
- Lấy thông tin sinh viên.
- Lấy thông tin phòng.
- Lấy thời hạn hợp đồng.
- Xác định kỳ thanh toán.
- Tính hoặc lấy số tiền phòng theo nghiệp vụ hiện có.
- Tính tổng số tiền.
- Phát hành hóa đơn.

Thông tin hóa đơn cần có theo cấu trúc database hiện tại, tối thiểu gồm các thông tin phù hợp như:

- Mã hóa đơn.
- Sinh viên.
- Phòng.
- Loại hóa đơn.
- Kỳ thanh toán.
- Số tiền.
- Ngày lập.
- Hạn thanh toán.
- Trạng thái.

Không tự ý tạo thêm trường nếu database hiện tại đã có trường tương ứng.

---

## 5. Hóa đơn điện nước

Backend cần hỗ trợ:

- Chọn tháng.
- Lấy thông tin phòng/sinh viên.
- Lấy dữ liệu điện nước hiện có.
- Tính tiền điện nước theo nghiệp vụ hiện tại.
- Tạo và phát hành hóa đơn.

Nếu project chưa có dữ liệu hoặc nghiệp vụ tính điện nước:

- Không tự đoán công thức.
- Không tự ý thay đổi các module khác.
- Báo rõ phần dữ liệu/nghiệp vụ còn thiếu.

---

## 6. API

Tạo API theo quy ước Router/API hiện tại.

Có thể cần:

### GET

Lấy danh sách dữ liệu phục vụ lập hóa đơn.

### POST

Phát hành hóa đơn tiền phòng.

Phát hành hóa đơn điện nước.

API phải:

- Yêu cầu đăng nhập.
- Kiểm tra role `KeToan`.
- Validate dữ liệu.
- Trả HTTP status code phù hợp.
- Trả thông báo lỗi rõ ràng.

Không thay đổi API hiện có.

---

## 7. Database

Trước khi tạo model/table mới phải kiểm tra database hiện tại.

Nếu đã có bảng hóa đơn/invoice:

- Tái sử dụng bảng hiện tại nếu phù hợp.

Nếu thực sự cần bảng mới:

- Chỉ tạo bảng phục vụ chức năng này.
- Không xóa bảng hiện tại.
- Không thay đổi quan hệ không liên quan.
- Sử dụng migration hiện tại của project.
- Không reset database.

---

## 8. Validation

Backend phải kiểm tra:

- User đã đăng nhập.
- User có role `KeToan`.
- Dữ liệu bắt buộc.
- Sinh viên/phòng/hợp đồng tồn tại.
- Kỳ/tháng thanh toán hợp lệ.
- Số tiền hợp lệ.
- Không tạo trùng hóa đơn cho cùng đối tượng và cùng kỳ.

---

## 9. Kiểm thử

Phải kiểm tra tối thiểu:

### Authentication/Authorization

- KeToan gọi API → thành công.
- SinhVien gọi API → 403.
- QuanLy gọi API → 403.
- Chưa đăng nhập → 401.

### Hóa đơn

- Lấy danh sách thành công.
- Phát hành hóa đơn thành công.
- Dữ liệu không hợp lệ → trả lỗi.
- Phát hành trùng → trả lỗi phù hợp.

### Regression

Sau khi hoàn thành phải đảm bảo:

- API cũ vẫn hoạt động.
- Authentication cũ vẫn hoạt động.
- Các chức năng khác không bị ảnh hưởng.

---

## 10. Nguyên tắc

- Tích hợp vào code hiện tại, không xây lại hệ thống.
- Ưu tiên tái sử dụng model, service, repository và authentication hiện có.
- Chỉ thêm code cần thiết.
- Không tự suy đoán nghiệp vụ khi project chưa cung cấp dữ liệu.
- Không làm thay đổi cấu trúc project.
- Không xóa hoặc làm mất bất kỳ chức năng nào hiện có.

Sau khi hoàn thành phải báo cáo:

- File mới tạo.
- File cũ chỉnh sửa.
- Lý do chỉnh sửa từng file.
- API mới.
- Database/migration thay đổi.
- Cách chạy và test Backend.