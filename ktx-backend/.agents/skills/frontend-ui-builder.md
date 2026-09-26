---
name: frontend-ui-builder
description: Quy chuẩn thiết kế giao diện người dùng (Frontend Design System) cho hệ thống Ký túc xá KTX.
---

# KTX Frontend UI Design System & Guidelines

## 1. Màu sắc thương hiệu & Trực quan (Color Tokens)
- **Primary Brand Blue**: `#2563eb` (Tailwind `blue-600`), hover `#1d4ed8` (Tailwind `blue-700`).
- **Primary Accent / Sky**: `#0284c7` (Tailwind `sky-600`), `#0ea5e9` (Tailwind `sky-500`), `#dbeafe` (Tailwind `blue-100`).
- **Success Green**: `#15803d` (Tailwind `green-700`), `#166534` (Tailwind `green-800`), `#2d6a4f`.
- **Neutral Backgrounds**:
  - Toàn bộ trang nền xanh lam/xám nhạt: `#f0f4f8` hoặc `#edf2f7`.
  - Khối Sidebar / Header: `#f4f5f7` hoặc `#ffffff`.
  - Khối thẻ Card nội dung: Nền trắng `#ffffff`, bo tròn mềm mại `rounded-2xl` hoặc `rounded-xl`.
- **Text & Borders**:
  - Tiêu đề đậm: `#0f172a` (Slate 900) hoặc `#1e293b` (Slate 800).
  - Nhãn in hoa phụ: Text Slate 600 - 700, font-bold, tracking-wide.
  - Văn bản phụ / Placeholder: `#64748b` (Slate 500) hoặc `#94a3b8` (Slate 400).
  - Đường viền nhẹ: `border-slate-200` hoặc `border-blue-100/80`.

---

## 2. Quy chuẩn Bố cục Form Đăng ký ở (Room Registration)
Theo mẫu thiết kế Figma chuẩn (Ảnh 1):
1. **Header trang con**:
   - Icon nét vẽ bút viết ô vuông (Edit Icon) màu xanh nổi bật.
   - Tiêu đề chính "Đăng ký ở" (size 24px - 28px, font-bold).
   - Mô tả phụ: "Kiểm tra thông tin trước khi xác nhận" (size 14px, màu xám nhạt).
2. **Hệ thống 3 Thẻ Card nền trắng**:
   - **Card 1: THÔNG TIN SINH VIÊN**: Form 2 cột cân đối, viền nhẹ, tự động điền sẵn thông tin sinh viên từ tài khoản/API.
   - **Card 2: THÔNG TIN LIÊN HỆ KHẨN CẤP**: Họ tên người giám hộ, Mối liên hệ, Số điện thoại liên hệ.
   - **Card 3: NGUYỆN VỌNG**: Dropdown chọn phòng/giường trống và Textarea nhập nội dung nguyện vọng của sinh viên.
3. **Thanh thao tác chân trang**:
   - Checkbox xác nhận: "Tôi xác nhận thông tin đăng ký ở là đúng".
   - Nút "Quay lại": Viền xanh, text xanh, hover nền xanh nhạt.
   - Nút "Gửi yêu cầu đăng ký": Nền xanh thương hiệu, chữ trắng, chỉ active khi đã tích checkbox xác nhận.

---

## 3. Quy chuẩn Màn hình gửi thành công (Success Screen)
Theo mẫu thiết kế Figma chuẩn (Ảnh 2):
1. Căn giữa toàn bộ nội dung theo cả chiều ngang và chiều dọc.
2. Tiêu đề: "Gửi yêu cầu đăng ký thành công" với tông xanh lục đậm trang nhã.
3. Đoạn giải thích 2 dòng:
   - "Yêu cầu của bạn đã được gửi đến quản lý ktx."
   - "Bạn có thể theo dõi kết quả tại Lịch sử đăng ký."
4. Bộ 2 nút điều hướng:
   - "Xem lịch sử đăng ký": Viền xanh, chữ xanh, điều hướng tới `/student/history`.
   - "Về trang chủ": Nút xanh đầy đủ, điều hướng tới `/student/dashboard`.
5. Nút nổi Chatbot AI ở góc dưới bên phải màn hình: Icon robot tròn, viền đổ bóng nổi, điểm nhấn công nghệ.
