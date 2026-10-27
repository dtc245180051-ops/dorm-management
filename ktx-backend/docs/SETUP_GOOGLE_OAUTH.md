# HƯỚNG DẪN CẤU HÌNH ĐĂNG NHẬP GOOGLE OAUTH 2.0 THỰC TẾ (GOOGLE IDENTITY SERVICES)

Tài liệu này hướng dẫn chi tiết các bước tạo và liên kết **Google OAuth 2.0 Client ID** từ Google Cloud Console vào hệ thống **iDORM** (FastAPI + React).

---

## 1. TỔNG QUAN LUỒNG HOẠT ĐỘNG

```
[Người dùng Click Nút Google] 
       │
       ▼
[Google Popup: accounts.google.com] (Đăng nhập / Chọn tài khoản)
       │
       ▼
[Frontend React: @react-oauth/google] (Nhận Google ID Token JWT)
       │
       ▼
[POST /api/v1/auth/google-login] (Gửi credential ID Token về FastAPI)
       │
       ▼
[Backend: google.oauth2.id_token.verify_oauth2_token]
 ├── Kiểm tra chữ ký số công khai từ Google Certs
 ├── Kiểm tra domain: Bắt buộc đuôi @ictu.edu.vn (Nếu sai -> 403 Forbidden)
 ├── Tự động tra cứu hoặc tạo mới User/SinhVien (MSV = tiền tố email)
 └── Ký và trả về JWT Access Token nội bộ của iDORM
```

---

## 2. CÁC BƯỚC THIẾT LẬP TRÊN GOOGLE CLOUD CONSOLE

### Bước 1: Đăng nhập Google Cloud Console
1. Truy cập vào trang quản trị: [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Đăng nhập bằng tài khoản Google của bạn.
3. Ở thanh menu trên cùng, bấm chọn dự án (Project Dropdown) -> Bấm **New Project** (Dự án mới).
4. Đặt tên dự án: `iDORM - Dorm Management` -> Bấm **Create** (Tạo).

---

### Bước 2: Cấu hình Màn hình đồng ý OAuth (OAuth Consent Screen)
Trước khi tạo Client ID, Google yêu cầu cấu hình thông tin hiển thị khi người dùng đăng nhập:
1. Vào menu bên trái: **APIs & Services** (API và dịch vụ) -> **OAuth consent screen** (Màn hình đồng ý OAuth).
2. Chọn **User Type**:
   - Nếu bạn dùng tài khoản Google Workspace trường: Chọn **Internal** (Nội bộ).
   - Nếu bạn dùng tài khoản cá nhân để phát triển/test: Chọn **External** (Bên ngoài) -> Bấm **Create**.
3. Điền thông tin ứng dụng cơ bản:
   - **App name**: `iDORM Ký túc xá`
   - **User support email**: Chọn email của bạn.
   - **Developer contact information**: Nhập email của bạn.
4. Bấm **Save and Continue** qua các bước Scopes (Mặc định đã có `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`).
5. Nếu ở chế độ *External (Testing)*: Tại mục **Test users**, bấm **Add users** và nhập các email `@ictu.edu.vn` bạn dùng để test.
6. Bấm **Save and Continue** để hoàn tất.

---

### Bước 3: Tạo OAuth 2.0 Client ID (Web Application)
1. Vào mục: **APIs & Services** -> **Credentials** (Thông tin xác thực).
2. Bấm nút **+ CREATE CREDENTIALS** ở trên cùng -> Chọn **OAuth client ID**.
3. Tại ô **Application type** (Loại ứng dụng): Chọn **Web application**.
4. Đặt tên: `iDORM Web Client`.
5. Cấu hình **Authorized JavaScript origins** (Nguồn gốc JavaScript được ủy quyền):
   - Bấm **+ ADD URI** và nhập:
     ```
     http://localhost:5173
     ```
   - Bấm **+ ADD URI** và nhập thêm:
     ```
     http://127.0.0.1:5173
     ```
6. Cấu hình **Authorized redirect URIs** (URI chuyển hướng được ủy quyền):
   - Bấm **+ ADD URI** và nhập:
     ```
     http://localhost:5173
     ```
   - Bấm **+ ADD URI** và nhập:
     ```
     http://localhost:5173/login
     ```
7. Bấm nút **CREATE** (Tạo).

---

### Bước 4: Lấy Client ID
1. Một hộp thoại popup sẽ hiển thị: **OAuth client created**.
2. Sao chép chuỗi **Your Client ID** (có định dạng: `xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`).

---

## 3. CẤU HÌNH VÀO DỰ ÁN iDORM

### 3.1. Cấu hình Phía Frontend (`ktx-frontend/.env`)
Mở tệp `d:\QLY_KTX\ktx-frontend\.env` và dán Client ID vừa tạo vào biến `VITE_GOOGLE_CLIENT_ID`:

```env
# Google Gemini AI API Key
VITE_GEMINI_API_KEY=AQ.Ab8RN6KUM-AC-yXC0GqTAKtw2CmaL_l2EdUL06Fc0yKPstoLlg

# Google OAuth 2.0 Web Client ID
VITE_GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
```

### 3.2. Cấu hình Phía Backend (`ktx-backend/.env` - Tùy chọn)
Nếu muốn backend kiểm tra chặt chẽ trường `audience` khớp với Client ID:
Mở tệp `d:\QLY_KTX\ktx-backend\.env` (hoặc tạo nếu chưa có) và thêm:

```env
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
```

*(Lưu ý: Nếu không cấu hình biến này ở Backend, hệ thống vẫn tự động xác thực chữ ký cryptographic và thời hạn của token thông qua chứng chỉ SSL công khai của Google).*

---

## 4. QUY TẮC BẢO MẬT VÀ PHÂN QUYỀN

| Trường hợp | Hành vi của hệ thống | Mã phản hồi |
| :--- | :--- | :---: |
| **Email ngoài trường (`@gmail.com`, `@yahoo.com`)** | Hệ thống từ chối đăng nhập và thông báo: *"Hệ thống chỉ chấp nhận tài khoản Google do trường cấp (@ictu.edu.vn)"* | **HTTP 403 Forbidden** |
| **Email trường lần đầu đăng nhập (`dtc... @ictu.edu.vn`)** | Tự động tạo bản ghi `tai_khoan`, `nguoi_dung`, `sinh_vien` với MSV lấy từ tiền tố email. Cấp phát JWT Access Token và chuyển hướng vào `/student/dashboard`. | **HTTP 200 OK** |
| **Email trường đã tồn tại trong CSDL** | Đăng nhập trực tiếp, cấp phát JWT Access Token theo vai trò tương ứng của tài khoản. | **HTTP 200 OK** |
| **Token giả mạo hoặc hết hạn** | Từ chối truy cập: *"Mã Google ID Token không hợp lệ hoặc đã hết hạn"*. | **HTTP 401 Unauthorized** |

---

## 5. XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

1. **Lỗi `origin_mismatch` hoặc `GSI error: The given origin is not allowed for the given client ID`**:
   - *Nguyên nhân*: URL đang chạy (`http://localhost:5173`) chưa được thêm vào ô **Authorized JavaScript origins** trên Google Cloud Console.
   - *Khắc phục*: Vào Credentials -> Chọn Client ID của bạn -> Thêm chính xác `http://localhost:5173` (không có dấu `/` ở cuối) -> Bấm **Save** và chờ 1-2 phút để Google cập nhật.

2. **Lỗi `Access blocked: iDORM has not completed the Google verification process`**:
   - *Nguyên nhân*: Ứng dụng ở trạng thái Testing và tài khoản Google của bạn chưa được thêm vào danh sách Test Users.
   - *Khắc phục*: Vào **OAuth consent screen** -> Mục **Test users** -> Bấm **Add Users** -> Nhập email bạn đang dùng để đăng nhập.

3. **Cửa sổ đăng nhập Google tự đóng (`popup_closed_by_user`)**:
   - Người dùng bấm tắt popup hoặc chặn popup trên trình duyệt. Frontend sẽ bắt lỗi này và hiển thị cảnh báo thân thiện trên giao diện.
