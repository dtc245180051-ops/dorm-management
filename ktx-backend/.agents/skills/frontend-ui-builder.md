# SKILL: Frontend UI Builder (Quy chuẩn Thiết kế Giao diện Toàn hệ thống)

## 1. Mục tiêu & Nguyên tắc Thiết kế
Chuẩn hóa toàn bộ hệ thống giao diện KTX (React + Tailwind CSS) theo đúng các mẫu Figma thực tế[cite: 4, 7]:
- Bố cục nhất quán: Sidebar cố định bên trái (nền trắng/xám sáng), Header thanh mảnh ở trên cùng, Content chính bo góc nằm trên nền xám nhạt (`bg-[#f4f7fb]` hoặc `bg-slate-50`)[cite: 4, 7].
- Card & Container: Nền trắng (`bg-white`), viền bo tròn nhẹ (`rounded-2xl` cho khung lớn, `rounded-lg` cho card nhỏ), đổ bóng nhẹ (`shadow-sm`)[cite: 4, 7].
- Bo góc Input / Button: Thống nhất dùng `rounded-lg` hoặc `rounded-[5px]`[cite: 4, 7]. Không bo tròn viên thuốc (`rounded-full`) ngoại trừ avatar và pill badge trạng thái[cite: 4, 7].

---

## 2. Bảng Màu Thương hiệu (Color Tokens)

### Màu chủ đạo (Primary & Brand)
- **Primary Blue:** `#007bff` hoặc `bg-blue-600` (dùng cho nút chính, icon active, trạng thái active menu)[cite: 4, 7].
- **Light Blue Background:** `#e7f1ff` hoặc `bg-blue-50` (dùng cho background active item trên menu, card highlight)[cite: 4, 7].
- **Primary Text:** `#1e293b` (slate-800 - tiêu đề, nhãn input chính)[cite: 4, 7].
- **Muted Text:** `#64748b` (slate-500 - placeholder, nhãn phụ)[cite: 4, 7].
- **Border Input:** `#e2e8f0` (slate-200)[cite: 4, 7].

### Màu Trạng thái (Status Badges & Action Buttons)
- **Chờ duyệt / Cảnh báo:** `bg-amber-50 text-amber-600 border border-amber-200`.
- **Thành công / Đã duyệt / Còn trống:** `bg-emerald-50 text-emerald-600 border border-emerald-200`.
- **Từ chối / Vi phạm / Khẩn cấp:** `bg-rose-50 text-rose-600 border border-rose-200` (Nút từ chối: `bg-rose-200 text-rose-700` hoặc hover `bg-rose-300`)[cite: 7].
- **Đang xử lý / Đã xếp:** `bg-blue-50 text-blue-600 border border-blue-200`[cite: 7].

---

## 3. Hệ thống Layouts theo 3 Phân hệ (Role Layouts)

### A. Phân hệ Quản lý KTX (Admin Layout)
- **Sidebar Brand:** Logo thương hiệu dạng text/icon đen đậm **iDoRM**[cite: 7].
- **Danh mục Menu (`AdminSidebar`):**
  - Group `MENU`: Dashboard, Quản lý phòng ở, Hồ sơ sinh viên, Phản ánh sự cố, Quản lý vi phạm, Báo cáo[cite: 7].
  - Group `HỆ THỐNG`: Đăng xuất[cite: 7].
- **Header:**
  - Ô tìm kiếm rộng có kính lúp: *"Tra cứu phòng, sinh viên,..."* (`bg-white rounded-full` hoặc `rounded-xl`)[cite: 7].
  - Nút chuông "Thông báo" (`rounded-full border border-blue-200 text-blue-600`)[cite: 7].
  - Pill User: Nền xanh `bg-blue-600 text-white rounded-full` hiển thị icon user + username (ví dụ: `QL_Minh`)[cite: 7].

### B. Phân hệ Sinh viên (Student Layout)
- **Sidebar Brand:** Logo hình ngôi nhà kèm text **KTX - Hệ thống ký túc xá**[cite: 4, 5].
- **Danh mục Menu (`StudentSidebar`):**
  - Trang chủ (`Home`)[cite: 4, 5].
  - Group `QUẢN LÝ PHÒNG`: Đăng ký ở, Chuyển / trả phòng, Tra cứu phòng, Lịch sử, Gửi phản ánh[cite: 4, 5].
  - Group `TÀI CHÍNH`: Thanh toán phí KTX, Lịch sử thanh toán[cite: 4, 5].
  - Group `CÁ NHÂN`: Thông tin cá nhân[cite: 4, 5].
  - Group `HỆ THỐNG`: Trợ giúp và hỗ trợ, Đăng xuất[cite: 4, 5].
- **Header:**
  - Ô search nhỏ bo tròn nhẹ `Tìm kiếm...`[cite: 4, 5].
  - Icon chuông thông báo (có chấm đỏ)[cite: 4, 5].
  - Avatar tròn xám + Profile info (Họ tên: `Nguyễn Văn A`, role: `Sinh viên`)[cite: 4, 5].
- **Floating AI Assistant:** Icon Chatbot AI luôn ghim cố định ở góc dưới bên phải màn hình (`fixed bottom-6 right-6`)[cite: 5].

### C. Phân hệ Kế toán (Accountant Layout)
- Kế thừa cấu trúc của Admin Layout nhưng tùy biến danh mục menu chuyên về tài chính:
  - Hóa đơn phòng & dịch vụ điện nước.
  - Sổ theo dõi công nợ sinh viên.
  - Lịch sử thu / xác nhận chuyển khoản.
  - Báo cáo thu chi tháng / kỳ.

---

## 4. Quy chuẩn Component Chi tiết

### Input & Form Fields
- Label: `text-sm font-medium text-slate-700 mb-1.5 block`.
- Ô nhập dữ liệu (`input`, `select`):
  - Class: `w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all`.
  - Placeholder: `placeholder:text-slate-400`.
- Chế độ chỉ đọc (Read-only / View): Dùng `bg-slate-50 border-slate-200 text-slate-600 cursor-not-allowed` khi hiển thị thông tin không được chỉnh sửa[cite: 7].

### Buttons (Nút bấm)
- **Nút Primary (Gửi / Phê duyệt):** `px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm transition-all` (Ví dụ: Nút "Phê duyệt & xếp phòng", "Gửi yêu cầu đăng ký")[cite: 4, 7].
- **Nút Secondary / Quay lại:** `px-6 py-2.5 bg-white border border-blue-500 text-blue-600 hover:bg-blue-50 font-medium text-sm rounded-lg transition-all`[cite: 4, 5].
- **Nút Danger / Từ chối:** `px-6 py-2.5 bg-rose-200 hover:bg-rose-300 text-rose-700 font-medium text-sm rounded-lg transition-all`[cite: 7].

### Bảng Dữ liệu (Data Tables)
- Container: `overflow-hidden bg-white border border-slate-100 rounded-xl shadow-sm`.
- Table Header (`<thead>`): `bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider`.
- Table Row (`<tr>`): `border-b border-slate-100 hover:bg-slate-50/80 transition-colors`.
- Cell Padding: `px-4 py-3.5 text-sm text-slate-700`.

---

## 5. Cấu trúc Thư mục Frontend Chuẩn (`src/`)
Tất cả code giao diện bắt buộc tuân theo sơ đồ phân chia thư mục:
```text
src/
├── components/                # Modal, popup, card, button tái sử dụng
│   ├── common/                # Button, Input, Modal wrapper, Table
│   ├── room/                  # AddRoomModal, EditRoomModal, RoomFilter
│   └── occupancy/             # ApproveModal, RejectModal, AiSuggestModal
├── layouts/                   # Layout khung bọc ngoài theo vai trò
│   ├── AdminLayout.jsx        # Sidebar iDoRM + Header QL_Minh
│   ├── StudentLayout.jsx      # Sidebar KTX + Header Sinh viên + Bot nổi
│   └── AccountantLayout.jsx   # Sidebar & Header chuyên biệt Kế toán
├── pages/                     # Màn hình trang hoàn chỉnh tương ứng route
│   ├── admin/                 # Dashboard, RoomManagement, ProcessRegistrationPage
│   ├── student/               # RoomRegistrationPage, RoomTransferPage, ComplaintsPage
│   └── accountant/            # InvoicesPage, DebtTrackingPage
├── services/                  # Toàn bộ hàm gọi API Axios
└── routes/                    # File AppRoutes.jsx cấu hình phân quyền và link