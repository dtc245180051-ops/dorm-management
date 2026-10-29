# 🏢 iDORM - Hệ Thống Quản Lý Ký Túc Xá Thông Minh

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_19-61DAFB.svg?style=flat-square&logo=react)](https://react.dev)
[![Vite](https://img.shields.io/badge/Build-Vite-646CFF.svg?style=flat-square&logo=vite)](https://vitejs.dev)
[![TailwindCSS](https://img.shields.io/badge/Styling-Tailwind_CSS-38B2AC.svg?style=flat-square&logo=tailwind-css)](https://tailwindcss.com)
[![MySQL](https://img.shields.io/badge/Database-MySQL_8.0+-4479A1.svg?style=flat-square&logo=mysql&logoColor=white)](https://www.mysql.com)
[![Google Gemini](https://img.shields.io/badge/AI-Google_Gemini-8E75C2.svg?style=flat-square&logo=google)](https://aistudio.google.com/)

---

## 📖 1. Giới thiệu tổng quan (Overview)

**iDORM** là giải pháp phần mềm toàn diện hỗ trợ chuyển đổi số công tác quản lý và vận hành ký túc xá đại học theo tiêu chuẩn hiện đại. Hệ thống kết nối liền mạch giữa sinh viên nội trú, ban quản lý ký túc xá và phòng tài chính - kế toán, đồng thời tích hợp trí tuệ nhân tạo **Google Gemini AI** nhằm tự động hóa quy trình phân loại sự cố và hỗ trợ tư vấn 24/7.

### 👥 Các phân hệ người dùng chính:
* **🎓 Phân hệ Sinh viên (Student):**
  * Tra cứu thông tin phòng ở, đăng ký phòng mới trực tuyến theo nhu cầu.
  * Nộp đơn xin chuyển phòng, trả phòng, theo dõi tiến độ phê duyệt theo thời gian thực.
  * Báo hỏng, phản ánh sự cố cơ sở vật chất (tự động phân loại qua Gemini AI).
  * Tra cứu hóa đơn tiền phòng/điện nước định kỳ, thanh toán nhanh qua mã VietQR.
  * Trợ lý ảo Chatbot AI giải đáp nội quy, quy định và thủ tục KTX.
* **🛡️ Phân hệ Quản lý (Manager / Admin):**
  * Quản lý danh mục tòa nhà, phòng ở, giường và tình trạng lưu trú (trống, đang ở, bảo trì).
  * Tiếp nhận và xét duyệt đơn đăng ký, đơn chuyển phòng và hoàn tất thủ tục trả phòng.
  * Quản lý hồ sơ lý lịch sinh viên, ghi nhận và xử lý vi phạm nội quy.
  * Phân công kỹ thuật xử lý phản ánh sự cố, theo dõi tiến độ sửa chữa.
* **💼 Phân hệ Kế toán (Accountant):**
  * Thiết lập đơn giá phòng tiêu chuẩn/dịch vụ, tính toán định mức điện nước sinh hoạt.
  * Lập và phát hành hóa đơn định kỳ đồng loạt cho toàn bộ sinh viên/phòng ở.
  * Tải lên sao kê giao dịch ngân hàng (Excel/CSV) và tự động đối soát thanh toán thông minh.
  * Quản lý sổ công nợ, cảnh báo nợ quá hạn và in văn bản báo cáo tài chính hành chính khổ A4 chuẩn.

---

## 🛠️ 2. Công nghệ sử dụng (Tech Stack)

| Thành phần | Công nghệ / Thư viện | Vai trò trong hệ thống |
| :--- | :--- | :--- |
| **Backend Framework** | **FastAPI** (Python 3.10+) | Xây dựng RESTful API hiệu năng cao, tự động sinh Swagger docs |
| **ORM & Database Tool** | **SQLAlchemy 2.0** + **PyMySQL** | Ánh xạ đối tượng quan hệ, quản lý kết nối CSDL MySQL an toàn |
| **Validation & Schema** | **Pydantic v2** | Xác thực kiểu dữ liệu đầu vào/ra của API nghiêm ngặt |
| **Security & Auth** | **OAuth2**, **JWT (PyJWT)**, **Passlib (Bcrypt)** | Xác thực người dùng, mã hóa mật khẩu, phân quyền RBAC đa vai trò |
| **ASGI Web Server** | **Uvicorn** | Máy chủ ứng dụng bất đồng bộ chạy Backend |
| **Unit & Integration Test**| **Pytest**, **Httpx** | Kiểm thử tự động API, logic đối soát và luồng bảo mật |
| **Frontend Framework** | **React 19** + **Vite** | Single Page Application (SPA) tốc độ render và Hot Reload cao |
| **Styling & Icons** | **Tailwind CSS**, **Lucide React** | Hệ thống thiết kế hiện đại, responsive, icon đồng bộ |
| **HTTP Client** | **Axios** | Kết nối Backend API, tự động đính kèm Bearer token qua Interceptor |
| **Database Engine** | **MySQL 8.0+** | Cơ sở dữ liệu quan hệ lưu trữ hồ sơ, hợp đồng, hóa đơn và sự cố |
| **Trí tuệ nhân tạo (AI)** | **Google Gemini AI API** | Tự động phân loại sự cố cơ sở vật chất & Chatbot AI sinh viên |

---

## 📁 3. Cấu trúc thư mục dự án (Project Directory Tree)

```text
dorm-management/
│
├── README.md                      # Tài liệu hướng dẫn dự án hoàn chỉnh
│
├── ktx-backend/                   # Mã nguồn Backend (FastAPI + MySQL)
│   ├── .env.example               # Mẫu cấu hình biến môi trường Backend
│   ├── requirements.txt           # Danh mục thư viện Python dependencies
│   ├── seed_staff_accounts.py     # Script khởi tạo tài khoản Quản lý & Kế toán
│   ├── seed_students.py           # Script nạp dữ liệu mẫu sinh viên & hợp đồng
│   ├── seed_dashboard_data.py     # Script nạp số liệu thống kê Dashboard
│   ├── test_invoices_api.py       # Script kiểm thử API hóa đơn & tài chính
│   ├── test_auth_security_fixes.py# Script kiểm thử bảo mật & phân quyền RBAC
│   │
│   └── app/
│       ├── main.py                # Điểm khởi chạy ứng dụng FastAPI & định tuyến CORS
│       ├── core/                  # Cấu hình lõi (Database, Security JWT, Config)
│       ├── models/                # Thực thể SQLAlchemy ORM (User, Room, Incident, Invoice,...)
│       ├── schemas/               # Lược đồ Pydantic kiểm thực dữ liệu (Request/Response)
│       ├── routers/               # Router API các phân hệ (Auth, Rooms, Invoices, Incidents,...)
│       └── services/              # Tầng xử lý nghiệp vụ, tích hợp Gemini AI & đối soát
│
└── ktx-frontend/                  # Mã nguồn Frontend (React + Vite + Tailwind CSS)
    ├── .env.example               # Mẫu cấu hình biến môi trường Frontend
    ├── package.json               # Cấu hình gói và kịch bản khởi chạy Node.js
    ├── vite.config.js             # Cấu hình trình đóng gói Vite
    ├── tailwind.config.js         # Cấu hình bảng màu, font và breakpoint Tailwind
    │
    └── src/
        ├── main.jsx               # Điểm gắn kết React DOM
        ├── App.jsx                # Bộ điều hướng và phân quyền đường dẫn trung tâm
        ├── index.css              # Tệp định dạng CSS toàn cục
        │
        ├── components/            # Thành phần giao diện dùng chung
        │   ├── common/            # Modal xác nhận đăng xuất LogoutConfirmModal, Dialog,...
        │   ├── Sidebar.jsx        # Thanh điều hướng phân hệ Quản lý
        │   ├── Header.jsx         # Thanh công cụ & thông báo Quản lý
        │   └── AppFooter.jsx      # Chân trang giao diện sinh viên
        │
        ├── layouts/               # Khung giao diện theo vai trò (Student, Accountant, Admin)
        │   ├── Student.jsx        # Bố cục phân hệ Sinh viên
        │   ├── Accountant.jsx     # Bố cục phân hệ Kế toán
        │   └── Admin.jsx          # Bố cục phân hệ Ban Quản Lý
        │
        ├── pages/                 # Màn hình chức năng theo từng phân hệ
        │   ├── auth/              # Đăng nhập, đăng ký, modal tài khoản
        │   ├── student/           # Đăng ký phòng, chuyển/trả phòng, thanh toán, phản ánh
        │   ├── accountant/        # Dashboard tài chính, lập hóa đơn, đối soát, báo cáo A4
        │   ├── admin/             # Quản lý phòng ở, duyệt đơn, hồ sơ SV, sự cố, vi phạm
        │   └── public/            # Trang giới thiệu KTX (Landing Page)
        │
        └── services/              # Tầng gọi API Backend (authService, financeService,...)
```

---

## ⚙️ 4. Yêu cầu môi trường tiên quyết (Prerequisites)

Trước khi tiến hành cài đặt, đảm bảo máy tính của bạn đã cài đặt sẵn các môi trường sau:
* **Python:** Phiên bản `3.10` trở lên (Khuyến nghị `3.11` hoặc `3.12`).
* **Node.js:** Phiên bản `18.x` hoặc `20.x LTS` (kèm theo `npm` 9+).
* **MySQL Server:** Phiên bản `8.0` trở lên đang chạy cục bộ trên cổng `3306`.
* **Git:** Quản lý mã nguồn.
* *(Tùy chọn)* **Google Gemini API Key:** Đăng ký miễn phí tại [Google AI Studio](https://aistudio.google.com/) để kích hoạt đầy đủ tính năng AI.

---

## 🚀 5. Hướng dẫn cài đặt và Khởi chạy chi tiết (Local Setup Guide)

Dự án được triển khai cục bộ (Local Development) theo quy trình chuẩn 3 bước như sau:

### 🔹 Bước 1: Chuẩn bị Cơ sở dữ liệu (MySQL Database)

1. Mở công cụ quản trị MySQL (**MySQL Workbench**, **HeidiSQL** hoặc **MySQL CLI**).
2. Đăng nhập với tài khoản quản trị (mặc định: `root`).
3. Khởi tạo Database cho dự án:

```sql
CREATE DATABASE IF NOT EXISTS dorm_management 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;
```

---

### 🔹 Bước 2: Thiết lập Backend (FastAPI)

1. Mở cửa sổ dòng lệnh (Terminal / PowerShell) và di chuyển vào thư mục backend:

```bash
cd ktx-backend
```

2. Tạo và kích hoạt môi trường ảo Python:
* **Trên Windows (PowerShell):**
  ```powershell
  python -m venv venv
  .\venv\Scripts\Activate.ps1
  ```
* **Trên Linux / macOS:**
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

3. Nâng cấp `pip` và cài đặt danh sách thư viện phụ thuộc:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

4. Thiết lập biến môi trường Backend:
Sao chép tệp cấu hình mẫu `.env.example` thành `.env`:
* **Windows:**
  ```powershell
  copy .env.example .env
  ```
* **Linux / macOS:**
  ```bash
  cp .env.example .env
  ```

5. Mở tệp `.env` vừa tạo và điều chỉnh thông tin kết nối CSDL và API Key:
```env
# Google Gemini AI API Key (Lấy tại: https://aistudio.google.com/)
GEMINI_API_KEY=your_actual_gemini_api_key_here

# Cấu hình CSDL MySQL (thay đổi 'root' và '12345678' theo mật khẩu MySQL trên máy của bạn)
DATABASE_URL=mysql+pymysql://root:12345678@localhost:3306/dorm_management

# Cấu hình khóa bí mật tạo JWT Token
SECRET_KEY=secret_jwt_key_dorm_management_2026_super_secure
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

6. Nạp dữ liệu mẫu ban đầu (Seed Accounts & Data):
*Chạy các script tạo tài khoản mặc định và dữ liệu KTX mẫu:*
```bash
python seed_staff_accounts.py
python seed_students.py
```

7. Khởi động máy chủ Backend FastAPI:
```bash
uvicorn app.main:app --reload --port 8000
```
> Backend đang lắng nghe tại: `http://localhost:8000`  
> Tài liệu Swagger UI tương tác tại: `http://localhost:8000/docs`

---

### 🔹 Bước 3: Thiết lập Frontend (React + Vite)

1. Mở một cửa sổ Terminal mới và di chuyển vào thư mục frontend:

```bash
cd ktx-frontend
```

2. Cài đặt các gói phụ thuộc (Dependencies):

```bash
npm install
```

3. Thiết lập biến môi trường Frontend:
Sao chép tệp `.env.example` thành `.env` (hoặc `.env.local`):
* **Windows:**
  ```powershell
  copy .env.example .env
  ```
* **Linux / macOS:**
  ```bash
  cp .env.example .env
  ```

4. Kiểm tra cấu hình trong tệp `.env`:
```env
# Địa chỉ Backend API cục bộ
VITE_API_URL=http://localhost:8000/api/v1

# Khóa Gemini AI hỗ trợ Chatbot phía Client
VITE_GEMINI_API_KEY=your_actual_gemini_api_key_here

# Thông tin tài khoản nhận tiền thụ hưởng VietQR
VITE_BANK_ID=TPBank
VITE_ACCOUNT_NO=20020813520
VITE_ACCOUNT_NAME=BAN QUAN LY KTX ICTU
```

5. Khởi chạy giao diện Frontend:

```bash
npm run dev
```
> Giao diện web iDORM sẽ hiển thị tại: **`http://localhost:5173`**

---

## 🔑 6. Tài khoản kiểm thử mặc định (Demo / Seed Accounts)

Sau khi chạy script `seed_staff_accounts.py` và `seed_students.py`, bạn có thể đăng nhập ngay với các tài khoản sau:

| Phân hệ / Vai trò | Tên đăng nhập (`Username`) | Mật khẩu (`Password`) | Họ và tên hiển thị | Quyền hạn tiêu biểu |
| :--- | :--- | :--- | :--- | :--- |
| **🛡️ Ban Quản Lý (Manager)** | `quanly` hoặc `QL_Minh` | `password123` | Quản Lý Minh | Toàn quyền quản lý phòng, duyệt đơn đăng ký/chuyển/trả phòng, xử lý sự cố & vi phạm |
| **💼 Kế Toán (Accountant)** | `ketoan` hoặc `KT_Hoa` | `password123` | Kế Toán Hoa | Quản lý hóa đơn thu phí, đối soát ngân hàng VietQR, sổ nợ và xuất báo cáo A4 |
| **🎓 Sinh Viên (Student)** | `LNS26012113` | `password123` | Hoàng Đông Huy | Xem phòng hiện tại, gửi đơn, báo hỏng thiết bị, thanh toán và chat với Gemini AI |

> 💡 **Mẹo:** Bạn cũng có thể truy cập trang **Đăng ký tài khoản** (`/login`) để tạo trực tiếp một tài khoản sinh viên mới (sử dụng định dạng email đuôi `@ictu.edu.vn`).

---

## 🧪 7. Hướng dẫn chạy kiểm thử tự động (Testing)

Dự án bao gồm bộ kiểm thử toàn diện bảo vệ toàn bộ API nghiệp vụ, phân quyền chống leo thang đặc quyền (RBAC) và chống tấn công IDOR:

1. Di chuyển vào thư mục backend và kích hoạt môi trường ảo:
```bash
cd ktx-backend
.\venv\Scripts\Activate.ps1
```

2. Chạy toàn bộ bài test với **Pytest**:
```bash
pytest -v
```

3. Chạy kiểm thử kèm thống kê tỷ lệ bao phủ mã nguồn (Coverage Report):
```bash
pytest --cov=app --cov-report=term-missing
```

4. Chạy kiểm thử xác thực chuyên sâu & bảo mật tài chính:
```bash
# Kiểm thử phân quyền RBAC & chống IDOR
python test_auth_security_fixes.py

# Kiểm thử luồng phát hành & đối soát hóa đơn
python test_invoices_api.py

# Kiểm thử đăng nhập của các vai trò nhân viên
python test_staff_logins.py
```

---

## 📑 8. Tài liệu giao diện lập trình ứng dụng (API Documentation)

Khi máy chủ Backend đang hoạt động, FastAPI tự động cung cấp tài liệu kỹ thuật chi tiết theo chuẩn OpenAPI:

* **Interactive Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)  
  *Giao diện tương tác trực quan cho phép kiểm thử trực tiếp các endpoint, đính kèm token xác thực `Authorize` Bearer JWT.*
* **ReDoc Documentation:** [http://localhost:8000/redoc](http://localhost:8000/redoc)  
  *Tài liệu tra cứu cấu trúc dữ liệu Pydantic và mã lỗi phản hồi chi tiết.*

---

## 🛡️ 9. Một số lưu ý quan trọng khi triển khai (Important Notes)

1. **Tuyệt đối không commit tệp `.env` lên GitHub:** Cả hai thư mục `ktx-backend` và `ktx-frontend` đều đã được cấu hình `.gitignore` để loại trừ các tệp nhạy cảm chứa mật khẩu CSDL và khóa bí mật.
2. **Cấu hình Cross-Origin Resource Sharing (CORS):** Backend đã cấu hình cho phép các domain cục bộ phổ biến (`localhost:5173`, `127.0.0.1:5173`, `localhost:3000`) gọi API. Nếu thay đổi cổng Frontend, hãy cập nhật danh sách `allow_origins` trong [ktx-backend/app/main.py](ktx-backend/app/main.py).
3. **Độ ổn định của Google Gemini AI:** Đảm bảo `GEMINI_API_KEY` hợp lệ để tính năng Chatbot và bộ phân loại sự cố tự động hoạt động tối ưu. Hệ thống đã cài sẵn phương án dự phòng (fallback) tự động trong trường hợp mạng ngắt quãng.

---

<p align="center">
  <b>iDORM - Nền tảng quản lý KTX Đại học thông minh, hiện đại và chuẩn mực.</b><br>
  <i>Thực hiện phục vụ đánh giá, nghiệm thu học phần & báo cáo đồ án kỹ thuật.</i>
</p>
