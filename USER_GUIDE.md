# TÀI LIỆU HƯỚNG DẪN SỬ DỤNG HỆ THỐNG
## HỆ THỐNG QUẢN LÝ KÝ TÚC XÁ THÔNG MINH (iDORM)

---

## 1. GIỚI THIỆU ỨNG DỤNG

Hệ thống Quản lý Ký túc xá Thông minh (**iDORM**) là giải pháp chuyển đổi số toàn diện công tác quản trị lưu trú nội trú tại trường Đại học Công nghệ Thông tin và Truyền thông (ICTU). Ứng dụng được thiết kế nhằm thay thế hoàn toàn các phương thức quản lý thủ công truyền thống qua sổ sách hoặc bảng tính rời rạc bằng một nền tảng web hiện đại, tập trung, an toàn và trực quan.

**Các điểm sáng công nghệ nổi bật của hệ thống:**
1. **Kiến trúc Hiện đại**: Frontend xây dựng trên nền tảng **React 19 / Vite** với bộ giao diện Tailwind CSS tối ưu trải nghiệm người dùng; Backend vận hành trên nền tảng **FastAPI (Python 3.10+)** theo chuẩn RESTful API hiệu năng cao kết hợp cơ sở dữ liệu quan hệ **MySQL**.
2. **Tích hợp Trí tuệ Nhân tạo (Generative AI - Google Gemini)**:
   - **AI Room Allocation**: Tự động gợi ý xếp phòng và giường trống phù hợp nhất với giới tính, khoa viện, khóa học và nguyện vọng cá nhân của sinh viên.
   - **AI Incident Classification & Summarization**: Tự động phân loại danh mục sự cố (Điện nước, Cơ sở vật chất, An ninh trật tự...), trích xuất tiêu đề tóm tắt và đánh giá mức độ ưu tiên (Khẩn cấp/Bình thường) ngay khi sinh viên gửi phản ánh.
   - **RAG Regulation Chatbot**: Trợ lý ảo tư vấn nội quy KTX hoạt động 24/7 dựa trên văn bản quy chế chính thức (Ground Truth), giải đáp thông minh, chuẩn xác và có cơ chế fallback ngoại tuyến linh hoạt.
3. **Thanh toán số VietQR 24/7 & Đối soát Ngân hàng Tự động**:
   - Sinh viên thanh toán phí ký túc xá tức thì qua mã động **VietQR NAPAS 247**.
   - Bộ phận Kế toán tải file sao kê ngân hàng (`.xlsx`, `.csv`) để hệ thống tự động nhận diện cú pháp chuyển khoản, đối chiếu số tiền và gạch nợ tức thời vào CSDL.
4. **Báo cáo Tài chính Đạt chuẩn Kế toán**:
   - Xuất file báo cáo tài chính doanh thu, công nợ định dạng **Excel (`.xlsx`)** chuyên nghiệp, tích hợp sẵn công thức tính toán tự động (`SUM`), viền đôi chuẩn kế toán và chữ ký phê duyệt.

Hệ thống phân quyền nghiêm ngặt theo 3 nhóm tác nhân chính: **Sinh viên**, **Quản lý KTX (Admin/Quản trị viên)** và **Kế toán**.

---

## 2. CẤU HÌNH PHẦN CỨNG - PHẦN MỀM

### 2.1 Phần cứng

#### Phía Người dùng (Client - Sinh viên, Quản lý, Kế toán)
- **Bộ vi xử lý (CPU)**: Intel Core i3 / AMD Ryzen 3 trở lên (hoặc chip di động tương đương).
- **Bộ nhớ trong (RAM)**: Tối thiểu 4 GB (khuyến nghị 8 GB trở lên để trải nghiệm duyệt web mượt mà).
- **Màn hình**: Độ phân giải tối thiểu HD (1366 x 768), tối ưu trên Full HD (1920 x 1080) và hỗ trợ co giãn linh hoạt trên thiết bị di động/máy tính bảng.
- **Kết nối mạng**: Băng thông Internet tối thiểu 5 Mbps.

#### Phía Máy chủ (Server Deployment)
- **Bộ vi xử lý (CPU)**: Tối thiểu 2 vCPU (khuyến nghị 4 vCPU trở lên cho môi trường tải cao).
- **Bộ nhớ trong (RAM)**: Tối thiểu 4 GB RAM (khuyến nghị 8 GB - 16 GB).
- **Ổ cứng lưu trữ (Storage)**: Tối thiểu 20 GB SSD khả dụng (dành cho CSDL MySQL, file ảnh minh chứng sự cố và logs).
- **Mạng**: Địa chỉ IP tĩnh, mở cổng `80/443` (HTTP/HTTPS) cho Web Server, cổng `8000` (FastAPI API Gateway) và cổng `3306` (MySQL Database).

---

### 2.2 Phần mềm

- **Hệ điều hành hỗ trợ**:
  - Máy trạm Client: Windows 10/11, macOS, Linux, Android, iOS.
  - Máy chủ Server: Ubuntu Server 20.04/22.04 LTS, Debian 11/12, CentOS 8/Stream hoặc Windows Server 2019/2022.
- **Trình duyệt web khuyến nghị**: Google Chrome (phiên bản 100+), Microsoft Edge, Mozilla Firefox, Apple Safari.
- **Môi trường Runtime & Công nghệ**:
  - **Backend**: Python 3.10 trở lên, FastAPI, Uvicorn, SQLAlchemy, Pydantic v2, PyMySQL, Google GenAI SDK.
  - **Frontend**: Node.js 18.x hoặc 20.x LTS, npm 9.x+, React 19, Vite 6.x, Axios, Lucide React, ExcelJS.
  - **Hệ quản trị CSDL**: MySQL Server 8.0 trở lên.
  - **Khóa bảo mật / API Key**: Google Gemini AI API Key (cấu hình trong file môi trường `.env`), Google Cloud OAuth 2.0 Web Client ID.

#### Hướng dẫn các lệnh khởi chạy dự án tại Local Development

**1. Khởi chạy Cơ sở dữ liệu MySQL:**
Đảm bảo dịch vụ MySQL đang chạy trên cổng `3306` và đã tạo database `dorm_management`:
```sql
CREATE DATABASE IF NOT EXISTS dorm_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**2. Khởi chạy Backend (FastAPI):**
Mở một cửa sổ Terminal tại thư mục `ktx-backend`:
```bash
# Di chuyển vào thư mục backend
cd ktx-backend

# Kích hoạt môi trường ảo Python (nếu có)
# venv\Scripts\activate   (Windows)
# source venv/bin/activate (Linux/macOS)

# Cài đặt các gói thư viện phụ thuộc (lần đầu)
pip install -r requirements.txt

# Khởi chạy máy chủ API với chế độ tự động reload
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
*API Swagger Documentation kiểm tra tại: `http://localhost:8000/docs`.*

**3. Khởi chạy Frontend (React + Vite):**
Mở một cửa sổ Terminal thứ hai tại thư mục `ktx-frontend`:
```bash
# Di chuyển vào thư mục frontend
cd ktx-frontend

# Cài đặt gói thư viện Node.js (lần đầu)
npm install

# Khởi chạy máy chủ phát triển Vite
npm run dev
```
*Truy cập giao diện người dùng tại URL:* `http://localhost:5173`

---

## 3. CÁC CHỨC NĂNG CHÍNH

---

### 3.1 CHỨC NĂNG CỦA SINH VIÊN

#### 3.1.1 Đăng ký tài khoản (UC001)

- **Ý nghĩa chức năng**: Cho phép sinh viên mới chưa có tài khoản trong hệ thống tự khởi tạo tài khoản đăng nhập KTX gắn liền với mã sinh viên và địa chỉ hòm thư điện tử do nhà trường cấp.
- **Các bước thực hiện**:
  - **Bước 1**: Từ trình duyệt web, truy cập Trang chủ Landing Page của hệ thống theo địa chỉ `http://localhost:5173`.
  - **Bước 2**: Sinh viên thực hiện một trong hai thao tác điều hướng sau:
    - Bấm nút **"Đăng ký"** (nút màu xanh dương) ở góc trên bên phải thanh Header.
    - Hoặc bấm nút **"Đăng ký ngay ->"** trên khối Banner Hero chính giữa màn hình.
  - **Bước 3**: Hệ thống chuyển hướng sang giao diện xác thực tại tab **"Đăng ký"**. Sinh viên tiến hành điền đầy đủ các thông tin tại form:
    - *Họ và tên*: Nhập đầy đủ họ tên tiếng Việt có dấu (ví dụ: `Nguyễn Văn An`).
    - *Email trường*: Nhập địa chỉ email trường ICTU có đuôi bắt buộc `@ictu.edu.vn` (ví dụ: `dtc245180001@ictu.edu.vn`). Hệ thống sẽ tự động tách phần tiền tố trước `@` để định danh Mã sinh viên (`DTC245180001`).
    - *Mật khẩu*: Nhập mật khẩu bảo mật (tối thiểu 6 ký tự).
    - *Nhập lại mật khẩu*: Nhập lại chính xác mật khẩu đã đặt ở trên.
  - **Bước 4**: Bấm nút **"Đăng ký tài khoản"**.
- **Kết quả hiển thị**:
  - Nếu thông tin hợp lệ, hệ thống hiển thị thông báo màu xanh: *"Đăng ký thành công! Vui lòng đăng nhập để tiếp tục."*.
  - Hệ thống tự động chuyển giao diện sang tab **"Đăng nhập"** và tự động điền sẵn email vừa đăng ký vào ô tài khoản để sinh viên đăng nhập ngay lập tức.
  - Nếu có lỗi (email sai định dạng `@ictu.edu.vn`, mật khẩu dưới 6 ký tự hoặc email đã tồn tại), hệ thống hiển thị banner cảnh báo màu đỏ chi tiết.

[Chèn hình ảnh: Giao diện Landing Page nút Đăng ký ngay và Form Đăng ký tài khoản sinh viên]

---

#### 3.1.2 Đăng nhập hệ thống (UC002)

- **Ý nghĩa chức năng**: Xác thực danh tính sinh viên để cấp quyền truy cập vào các tiện ích nội trú cá nhân.
- **Các bước thực hiện**:
  Từ Landing Page hoặc đường dẫn trực tiếp `http://localhost:5173/login`, sinh viên lựa chọn 1 trong 2 phương thức:
  - **Cách 1: Đăng nhập bằng tài khoản nội bộ (Username / Mật khẩu)**
    - *Bước 1*: Tại tab **Đăng nhập**, nhập thông tin vào ô **"Tên đăng nhập hoặc Email trường"** (chấp nhận Mã sinh viên như `DTC245180001` hoặc Email `dtc245180001@ictu.edu.vn`).
    - *Bước 2*: Nhập mật khẩu vào ô **"Mật khẩu"** (có thể bấm biểu tượng con mắt để ẩn/hiện mật khẩu).
    - *Bước 3*: Bấm nút **"Đăng nhập"**.
  - **Cách 2: Đăng nhập nhanh bằng tài khoản Google (Google OAuth 2.0)**
    - *Bước 1*: Bấm vào nút **"Đăng nhập bằng Google"** (nút xác thực chính thức tích hợp Google Identity Services).
    - *Bước 2*: Cửa sổ đăng nhập của Google hiển thị, sinh viên chọn hoặc đăng nhập tài khoản Google Mail trường cấp (`@ictu.edu.vn`).
    - *Bước 3*: Google xác thực và trả token ủy quyền an toàn về hệ thống. Hệ thống tự động kiểm tra đuôi domain trường và kích hoạt phiên đăng nhập.
- **Kết quả hiển thị**:
  - Hệ thống thông báo *"Đăng nhập thành công! Đang chuyển vào trang chủ..."*.
  - Màn hình chuyển hướng trực tiếp vào phân hệ sinh viên tại URL `/student/dashboard`. Header hiển thị đúng ảnh đại diện, họ tên và vai trò "Sinh viên".

[Chèn hình ảnh: Form Đăng nhập tài khoản nội bộ và nút Đăng nhập bằng Google OAuth 2.0]

---

#### 3.1.3 Tra cứu chỗ trống & Đăng ký ở (UC003, UC005)

- **Ý nghĩa chức năng**: Giúp sinh viên nắm bắt số lượng chỗ trống hiện tại của từng phòng/tòa nhà KTX và nộp đơn đăng ký xét duyệt lưu trú trực tuyến mà không cần đến nộp phiếu giấy.
- **Các bước thực hiện**:
  - **Bước 1: Tra cứu phòng trống (UC005)**:
    - Trên thanh menu bên trái, chọn mục **"Tra cứu phòng"** (mục QUẢN LÝ PHÒNG).
    - Sinh viên chọn bộ lọc: Tòa nhà (Tòa A1, Tòa A2, Tòa B1...), Loại phòng (Phòng tiêu chuẩn 6-8 người, Phòng dịch vụ 4 người khép kín), Tầng mong muốn.
    - Xem danh sách thẻ phòng hiển thị trực quan: Tỷ lệ lấp đầy, số giường còn trống (màu xanh lá: còn chỗ, màu xám: đã kín), giới tính phòng quy định (Nam/Nữ) và mức giá phòng/tháng.
  - **Bước 2: Điền đơn đăng ký ở KTX (UC003)**:
    - Bấm chọn menu **"Đăng ký phòng"** trên thanh Sidebar.
    - Tại phần **1. Thông tin sinh viên**: Hệ thống tự động điền sẵn Mã sinh viên, Họ và tên, Email. Sinh viên hoàn thiện tiếp: Giới tính, Ngày sinh, Số CCCD/CMND, Số điện thoại, Khoa/Viện, Lớp và chọn Đối tượng ưu tiên (nếu có: *Con thương binh/liệt sĩ, Hộ nghèo/cận nghèo, Vùng sâu vùng xa, Dân tộc thiểu số*).
    - Điền địa chỉ thường trú 3 cấp hành chính: Tỉnh/Thành phố -> Quận/Huyện -> Xã/Phường/Số nhà.
    - Tại phần **2. Thông tin liên hệ khẩn cấp**: Điền Họ tên người giám hộ, Mối quan hệ (Bố/Mẹ/Người bảo trợ), Số điện thoại liên hệ.
    - Tại phần **3. Nguyện vọng xếp phòng**: Chọn Tòa nhà mong muốn, Loại phòng ưu tiên và điền ghi chú nguyện vọng cụ thể (ví dụ: *Muốn ở cùng bạn cùng lớp, thích tầng thấp thoáng mát...*).
    - Tích chọn cam kết: *"Tôi cam kết các thông tin khai báo trên là chính xác và chấp hành nghiêm túc nội quy KTX"*.
  - **Bước 3**: Bấm nút **"Gửi đơn đăng ký"**.
- **Kết quả hiển thị**:
  - Hệ thống chuyển ngay sang màn hình thông báo gửi đơn thành công kèm Mã hồ sơ đăng ký (ví dụ: `DK-2026-0012`).
  - Trạng thái hồ sơ chuyển sang **"Chờ xét duyệt"** (`PENDING_APPROVAL`). Sinh viên có thể bấm liên kết *"Xem lịch sử đơn yêu cầu"* để theo dõi tiến trình phê duyệt của Ban quản lý.

[Chèn hình ảnh: Giao diện Tra cứu phòng trống và Form Đăng ký lưu trú KTX trực tuyến]

---

#### 3.1.4 Gửi phản ánh sự cố tích hợp AI phân loại & tóm tắt (UC008)

- **Ý nghĩa chức năng**: Cho phép sinh viên sinh sống nội trú phản ánh nhanh chóng các hư hỏng cơ sở vật chất, sự cố điện nước hay kiến nghị an ninh trật tự. Hệ thống tích hợp **Google Gemini AI** tự động phân loại chuyên môn và xác định độ khẩn cấp, loại bỏ việc sinh viên phải phân vân lựa chọn danh mục thủ công.
- **Các bước thực hiện**:
  - **Bước 1**: Trên Sidebar phân hệ Sinh viên, bấm chọn mục **"Gửi phản ánh"** (URL `/student/feedback`).
  - **Bước 2**: Tại form **Tạo phản ánh mới**:
    - *Số phòng*: Hệ thống tự động điền số phòng sinh viên đang ở (ví dụ: `P203 - Tòa A1`).
    - *Mô tả chi tiết sự cố*: Nhập nội dung ngôn ngữ tự nhiên về sự cố gặp phải (ví dụ: *"Bóng đèn tuýp phòng tắm bị chớp nháy liên tục rồi tắt hẳn kèm mùi khét, đồng thời vòi xịt nước bị rò rỉ chảy lênh láng cả sàn nhà"*).
    - *Hình ảnh minh chứng (tùy chọn)*: Bấm ô tải ảnh hoặc biểu tượng Máy ảnh để đính kèm ảnh chụp hiện trường (dung lượng tối đa 5MB).
  - **Bước 3**: Bấm nút **"Gửi phản ánh sự cố"**.
- **Kết quả hiển thị**:
  - Nút chuyển trạng thái loading và gửi payload về Backend AI.
  - Ngay sau đó, xuất hiện khung thông báo thành công màu xanh lục nổi bật:
    - **Mã phản ánh**: Sinh mã ticket duy nhất (ví dụ: `PA-928341`).
    - **AI phân loại**: Tự động gán nhãn chuyên môn (ví dụ: `Điện nước & Thiết bị vệ sinh`).
    - **AI tóm tắt tiêu đề**: Tự động trích xuất tiêu đề ngắn gọn súc tích (ví dụ: `Hỏng đèn tuýp phòng tắm có mùi khét và rò rỉ vòi xịt`).
    - **Mức độ ưu tiên**: Tự động đánh giá tag `Khẩn cấp` (màu đỏ) nếu phát hiện nguy cơ chập cháy, rò rỉ nước lớn.
  - Phiếu phản ánh tự động lưu vào tab **"Lịch sử phản ánh"** với trạng thái ban đầu là `Chờ tiếp nhận`.

[Chèn hình ảnh: Form gửi phản ánh sự cố và Banner kết quả AI phân loại, tóm tắt tự động]

---

#### 3.1.5 Tra cứu quy chế qua Trợ lý AI Chatbot RAG (UC010)

- **Ý nghĩa chức năng**: Trợ lý ảo AI thông minh thường trực hỗ trợ sinh viên tra cứu ngay lập tức các câu hỏi về nội quy ký túc xá, thời gian mở/đóng cổng, quy định nấu ăn, tiếp khách, gửi xe, mức thu phí phòng dựa trên tài liệu quy chế chính thức (RAG - Retrieval-Augmented Generation) chống ảo giác.
- **Các bước thực hiện**:
  - **Bước 1**: Tại bất kỳ trang nào của phân hệ Sinh viên (hoặc tại Trang chủ Landing Page), tìm nút tròn nổi hình **Avatar Robot Công nghệ** ở góc dưới bên phải màn hình (kèm chấm xanh online).
  - **Bước 2**: Bấm vào nút nổi để mở cửa sổ chat popup **"Trợ lý AI iDORM"**.
  - **Bước 3**: Nhập câu hỏi thắc mắc vào ô nhập liệu dưới đáy khung chat (ví dụ: *"Ký túc xá có cho phép nấu ăn trong phòng không?"* hoặc *"Mấy giờ thì đóng cổng KTX và về muộn thì xử lý thế nào?"*).
  - **Bước 4**: Bấm nút **Gửi** (biểu tượng mũi tên xanh) hoặc nhấn phím **Enter**.
- **Kết quả hiển thị**:
  - Hệ thống hiển thị hiệu ứng bong bóng *"AI đang trả lời..."*.
  - Sau khoảng 1-2 giây, câu trả lời chuẩn xác xuất hiện với định dạng văn bản chuyên nghiệp: in đậm các điều khoản trọng tâm, gạch đầu dòng rõ ràng, dẫn chiếu khung giờ cụ thể (ví dụ: Giờ đóng cổng mùa hè `23:00`, mùa đông `22:30`, nghiêm cấm nấu ăn vì an toàn PCCC...).
  - Trong trường hợp mất kết nối mạng hoặc gián đoạn API ngoài, bộ heuristic dự phòng thông minh tại Backend vẫn phản hồi tức thì các câu hỏi thông dụng.

[Chèn hình ảnh: Khung hội thoại Trợ lý ảo AI Chatbot RAG tư vấn nội quy KTX]

---

#### 3.1.6 Tra cứu công nợ & Thanh toán phí phòng qua mã VietQR (UC011, UC012)

- **Ý nghĩa chức năng**: Sinh viên theo dõi chi tiết từng khoản nợ phí lưu trú, tiền điện nước trong kỳ và thanh toán trực tiếp qua chuyển khoản ngân hàng bằng mã chuẩn quốc gia VietQR NAPAS 247 được sinh động theo từng hóa đơn.
- **Các bước thực hiện**:
  - **Bước 1**: Trên Sidebar sinh viên, chọn mục **"Thanh toán phí KTX"** (URL `/student/payment`).
  - **Bước 2**: Quan sát màn hình tổng quan:
    - 3 thẻ chỉ số trên cùng: *Phòng hiện tại*, *Kỳ thanh toán đang mở*, *Tổng tiền cần nộp*.
    - Bảng danh sách chi tiết các khoản phí: Cột Tên khoản phí (Tiền phòng KTX, Tiền điện nước sinh hoạt), Hạn nộp, Số tiền và Trạng thái (`Chưa thanh toán` - màu đỏ, `Đang chờ đối soát` - màu vàng cam, `Đã thanh toán` - màu xanh lục).
  - **Bước 3**: Nhấp chuột vào nút **"Thanh toán"** tại dòng khoản phí cần nộp (hoặc nút **"Thanh toán ngay"** ở tổng kết cuối trang).
  - **Bước 4**: Modal thanh toán **VietQR 24/7** hiển thị:
    - Quét mã QR hiển thị ở cột trái bằng ứng dụng Ngân hàng (Mobile Banking) hoặc Ví điện tử (MoMo, Viettel Money, ZaloPay).
    - Cột phải hiển thị thông tin chuyển khoản chuẩn: *Ngân hàng TPBank*, *Số tài khoản: 20020813520*, *Tên người thụ hưởng: BAN QUAN LY KTX ICTU*, *Số tiền chính xác*, *Nội dung chuyển khoản chuẩn hóa* (ví dụ: `KTX DTC245180001 HD1024`). Sinh viên có thể bấm nút biểu tượng **Copy** bên cạnh để sao chép nhanh nếu thao tác chuyển khoản thủ công.
    - Lưu ý theo dõi đồng hồ đếm ngược hiệu lực mã QR (15 phút).
  - **Bước 5**: Sau khi thực hiện chuyển khoản thành công trên app ngân hàng, sinh viên bấm nút **"Tôi đã hoàn tất chuyển khoản"** trên màn hình.
- **Kết quả hiển thị**:
  - Trạng thái khoản phí ngay lập tức cập nhật sang badge màu vàng: **"Đang chờ đối soát"** (`CHO_DOI_SOAT`).
  - Hệ thống ghi nhận lịch sử giao dịch và chuyển giao dịch vào hàng đợi đối soát tự động của Kế toán. Khi giao dịch ngân hàng khớp lệnh, trạng thái sẽ tự động đổi sang **"Đã thanh toán"** và gửi thông báo xác nhận về tài khoản sinh viên.

[Chèn hình ảnh: Bảng tra cứu công nợ sinh viên và Modal quét mã VietQR ngân hàng TPBank]

---

### 3.2 CHỨC NĂNG CỦA QUẢN LÝ KTX (ADMIN)

#### 3.2.1 Quản lý Cơ sở vật chất Tòa - Tầng - Phòng - Giường (UC006)

- **Ý nghĩa chức năng**: Cho phép cán bộ Quản trị KTX theo dõi toàn bộ cấu trúc vật lý khu nội trú theo mô hình phân cấp 4 tầng: Tòa nhà -> Tầng lầu -> Phòng ở -> Giường ngủ; nắm bắt tỷ lệ lấp đầy chỗ ở và cập nhật bảo trì cơ sở vật chất.
- **Các bước thực hiện**:
  - **Bước 1**: Đăng nhập tài khoản Quản lý KTX, hệ thống chuyển vào giao diện Admin. Chọn menu **"Quản lý phòng"** trên Sidebar (URL `/admin/rooms`).
  - **Bước 2**: Lựa chọn danh mục cần quản lý:
    - *Xem theo Tòa nhà*: Bấm vào tab các tòa nhà (Tòa A1, A2, B1...). Bấm nút **"Thêm tòa nhà"** nếu muốn bổ sung cụm tòa mới vào CSDL.
    - *Lọc danh sách phòng*: Dùng thanh lọc trạng thái (Tất cả, Còn chỗ trống, Đã đầy, Đang bảo dưỡng).
  - **Bước 3: Xem và điều chỉnh chi tiết phòng & giường**:
    - Bấm vào một thẻ phòng bất kỳ (ví dụ: `Phòng 203 - Tòa A1`).
    - Hệ thống mở giao diện chi tiết phòng (`RoomDetailPage`): Quan sát sơ đồ các giường (G01 đến G08).
    - Mỗi giường hiển thị thông tin trực quan: Mã giường, Trạng thái (Trống / Đang ở / Hỏng), Họ tên & Mã sinh viên đang nằm (nếu có).
    - Quản lý có thể bấm nút chuyển trạng thái giường sang **"Bảo trì/Sửa chữa"** khi giường hỏng hóc hoặc mở lại giường sẵn sàng đón sinh viên mới.
- **Kết quả hiển thị**:
  - Cập nhật tức thời số lượng chỗ trống lên hệ thống.
  - Tỷ lệ phần trăm lấp đầy của toàn bộ ký túc xá được đồng bộ tự động lên biểu đồ thống kê Dashboard quản trị.

[Chèn hình ảnh: Giao diện Sơ đồ quản lý Tòa - Tầng - Phòng và Chi tiết trạng thái từng giường ngủ]

---

#### 3.2.2 Xét duyệt đơn lưu trú với gợi ý xếp phòng AI (UC003)

- **Ý nghĩa chức năng**: Hỗ trợ cán bộ quản lý phê duyệt đơn đăng ký ở của sinh viên một cách khoa học, khách quan và nhanh chóng nhờ mô hình **Gemini AI** phân tích đa tiêu chí (đúng giới tính, khoa viện cùng chuyên ngành, phân bổ phòng trống tối ưu).
- **Các bước thực hiện**:
  - **Bước 1**: Tại Dashboard Quản lý KTX, chọn mục **"Xử lý đăng ký phòng"** (danh sách các đơn ở trạng thái `Chờ duyệt`).
  - **Bước 2**: Nhấp chuột vào một đơn cần duyệt (ví dụ: Đơn `DK-001` của sinh viên `Trần Thị Mai`).
  - **Bước 3: Khảo sát thông tin đơn và khuyến nghị AI**:
    - Cột trái hiển thị hồ sơ sinh viên: Điểm ưu tiên chính sách, Giới tính, Khoa Công nghệ Thông tin, nguyện vọng ở Tòa A1.
    - Tại mục **"Gợi ý xếp chỗ của hệ thống"**: Mô hình AI tự động quét cây phòng trống và hiển thị kết quả phân tích:
      - *Phòng gợi ý tối ưu nhất* (ví dụ: `Tòa A1 - Phòng 203 - Giường G04`).
      - *Điểm số phù hợp*: (ví dụ: `Độ khớp: 95%`).
      - *Lý giải AI*: *"Gợi ý xếp vào Tòa A1 - Phòng 203 vì phòng dành riêng cho nữ sinh viên, cùng thuộc Khoa CNTT và còn đúng 1 giường trống dưới tầng thấp phù hợp nguyện vọng"*.
    - Hệ thống **tự động nhảy cả 3 dropdown** liên hoàn: Tòa -> Phòng -> Giường theo gợi ý này. Quản lý có thể giữ nguyên gợi ý AI hoặc tùy ý chọn phòng/giường khác theo nhận định thực tế.
  - **Bước 4: Quyết định xử lý**:
    - **Nếu đồng ý xếp phòng**: Bấm nút màu xanh **"Xác nhận xếp chỗ"**.
    - **Nếu không đủ điều kiện**: Bấm nút màu đỏ **"Từ chối đơn"**, hệ thống mở Modal yêu cầu nhập lý do từ chối (ví dụ: *Hết chỉ tiêu phòng nữ đợt 1 / Thông tin đối tượng ưu tiên chưa hợp lệ*) và bấm *Xác nhận từ chối*.
- **Kết quả hiển thị**:
  - Đơn chuyển trạng thái sang `Đã duyệt` (hoặc `Từ chối`).
  - Giường tương ứng trên CSDL chuyển ngay sang trạng thái `DANG_O` (Đang có người).
  - Hệ thống tự động kích hoạt tạo hồ sơ nội trú cho sinh viên, đồng thời gửi thông báo kết quả duyệt phòng kèm thông tin Tòa/Phòng/Giường đến tài khoản sinh viên.

[Chèn hình ảnh: Giao diện Duyệt đơn đăng ký lưu trú tích hợp Gợi ý xếp phòng AI đa tiêu chí]

---

#### 3.2.3 Xử lý phản ánh sự cố & Lập biên bản vi phạm (UC008, UC009)

- **Ý nghĩa chức năng**: Quản lý quy trình xử lý khiếu nại, sửa chữa hạ tầng KTX và duy trì kỷ cương nếp sống nội trú thông qua lập biên bản vi phạm kỷ luật.
- **Các bước thực hiện**:
  - **Nghiệp vụ 1: Xử lý phản ánh sự cố (UC008)**:
    - Truy cập menu **"Quản lý sự cố"** (URL `/admin/incidents`).
    - Lọc sự cố theo danh mục (Điện nước, Cơ sở vật chất, An ninh...) hoặc mức độ ưu tiên (`Khẩn cấp`).
    - Bấm nút **"Xem / Xử lý"** tại một phản ánh (ví dụ sự cố hỏng đèn phòng P203).
    - Xem ảnh chụp hiện trường sinh viên đính kèm và đọc tóm tắt AI.
    - Chọn trạng thái mới: `Đang xử lý` (khi đã bàn giao cho thợ điện nước) hoặc `Đã giải quyết` (khi sửa chữa xong) hoặc `Từ chối`.
    - Nhập ghi chú xử lý (ví dụ: *"Đã thay bóng tuýp LED 1m2 mới và sửa gioăng cao su vòi xịt"*).
    - Bấm **"Lưu trạng thái"**. Hệ thống tự động gửi thông báo tiến độ xử lý về cho sinh viên phản ánh.
  - **Nghiệp vụ 2: Lập biên bản vi phạm nội quy (UC009)**:
    - Truy cập menu **"Biên bản vi phạm"** (URL `/admin/violations`).
    - Bấm nút **"Lập biên bản vi phạm mới"**.
    - Nhập thông tin: Chọn Sinh viên vi phạm (qua tìm kiếm Mã SV/Họ tên), Số phòng vi phạm, Thời gian xảy ra vi phạm.
    - Chọn Hành vi vi phạm theo danh mục chuẩn: *Sử dụng thiết bị đun nấu công suất lớn trong phòng, Gây mất trật tự sau 23h00, Đưa người lạ vào phòng qua đêm, Vi phạm quy định vệ sinh chung...*
    - Nhập nội dung diễn giải sự việc và tải ảnh bằng chứng (nếu có).
    - Chọn Hình thức xử lý đề xuất: *Nhắc nhở, Khiển trách, Cảnh cáo toàn KTX, Buộc rời khỏi KTX*.
    - Thiết lập Lịch triệu tập Hội đồng Kỷ luật (Ngày giờ, Địa điểm: Văn phòng BQL KTX) nếu vi phạm mức độ nghiêm trọng.
    - Bấm **"Lưu và ban hành biên bản"**.
- **Kết quả hiển thị**:
  - Biên bản được lưu vào hồ sơ kỷ luật của sinh viên trong CSDL.
  - Hệ thống tự động gửi thông báo cảnh cáo khẩn và giấy triệu tập hội đồng đến tài khoản của sinh viên vi phạm.

[Chèn hình ảnh: Giao diện Xử lý phản ánh sự cố kỹ thuật và Form Lập biên bản vi phạm kỷ luật]

---

### 3.3 CHỨC NĂNG CỦA KẾ TOÁN

#### 3.3.1 Lập hóa đơn & Quản lý thu phí phòng (UC011)

- **Ý nghĩa chức năng**: Tự động hóa quá trình tính toán và phát hành hàng loạt hóa đơn tiền phòng định kỳ và hóa đơn điện nước theo chỉ số công tơ thực tế cho toàn thể sinh viên nội trú.
- **Các bước thực hiện**:
  - **Bước 1**: Đăng nhập tài khoản Kế toán, hệ thống mở phân hệ Kế toán. Chọn menu **"Lập hóa đơn định kỳ"** (URL `/accountant/periodic-billing`).
  - **Bước 2: Phát hành hóa đơn Tiền phòng**:
    - Chọn tab **"Tiền phòng"**.
    - Chọn Năm học áp dụng (ví dụ: `Năm học 2026 - 2027`).
    - Chọn Phạm vi áp dụng: *Tất cả phòng (Tiêu chuẩn & Dịch vụ)*, *Chỉ phòng tiêu chuẩn* hoặc *Chỉ phòng dịch vụ*.
    - Chọn Hạn chốt nộp tiền (`Hạn thanh toán` - hệ thống mặc định 7 ngày kể từ ngày lập và chặn không cho chọn ngày quá khứ).
    - Hệ thống tự động quét danh sách sinh viên đang cư trú và tính mức thu tương ứng (Phòng tiêu chuẩn: 4.800.000đ/năm, Phòng dịch vụ: 8.200.000đ/năm).
    - Kiểm tra bảng danh sách ứng viên (Mã SV, Họ tên, Phòng, Loại phòng, Mức phí). Bấm nút **"Phát hành hóa đơn tiền phòng"**.
  - **Bước 3: Phát hành hóa đơn Điện nước**:
    - Chuyển sang tab **"Điện nước"**.
    - Chọn Kỳ thanh toán theo tháng (ví dụ: `Tháng 10/2026`).
    - Bấm nút **"Tải lên file chỉ số điện nước"** (chọn file Excel định dạng `.xlsx` ghi nhận chỉ số đầu - chỉ số cuối của từng phòng).
    - Hệ thống tự động tính sản lượng tiêu thụ theo công thức: $\text{Số điện} \times 3.500\text{ đ/kWh} + \text{Số nước} \times 20.000\text{ đ/m}^3$ và chia đều số tiền cho số lượng sinh viên thực tế đang sinh hoạt trong từng phòng.
    - Kiểm tra bảng tính toán chi tiết từng sinh viên và bấm **"Phát hành hóa đơn điện nước"**.
- **Kết quả hiển thị**:
  - Hàng loạt bản ghi hóa đơn mới được sinh ra trong CSDL với trạng thái `Chưa thanh toán` (`CHUA_THANH_TOAN`).
  - Hệ thống tự động phát thông báo công nợ mới đến từng sinh viên liên quan trên ứng dụng để nhắc nhở thanh toán đúng hạn.

[Chèn hình ảnh: Giao diện Lập hóa đơn Tiền phòng và Upload bảng chỉ số tính tiền điện nước]

---

#### 3.3.2 Đối soát giao dịch chuyển khoản ngân hàng tự động (UC012)

- **Ý nghĩa chức năng**: Giải phóng hoàn toàn sức lao động thủ công của kế toán trong việc đọc sao kê ngân hàng từng dòng để gạch nợ. Hệ thống tự động nhận dạng mã sinh viên, mã hóa đơn và số tiền chuyển khoản để khớp lệnh và xóa nợ tức thì.
- **Các bước thực hiện**:
  - **Bước 1**: Trên thanh menu Kế toán, bấm chọn **"Đối soát giao dịch"** (URL `/accountant/reconciliation`).
  - **Bước 2**: Khi chưa có dữ liệu sao kê, màn hình hiển thị trạng thái chờ với các chỉ số bằng 0. Kế toán nhấp chuột vào nút **"Tải file sao kê ngân hàng"** (hỗ trợ file Excel `.xlsx`, `.csv` tải từ dịch vụ Internet Banking của ngân hàng TPBank).
  - **Bước 3: Đối soát tự động (Batch Processing)**:
    - Hệ thống tự động trích xuất thông tin: Tên file sao kê, Ngân hàng, Số tài khoản quản lý và Số lượng giao dịch.
    - Thuật toán đối soát tự động phân tích cú pháp nội dung chuyển khoản:
      - **Giao dịch Đã khớp tự động** (`AUTO_MATCHED` - nhãn xanh lục): Tìm thấy đúng cú pháp chứa Mã SV / Mã hóa đơn và số tiền chuyển khoản khớp 100% với hóa đơn nợ. Hệ thống **tự động gạch nợ**, cập nhật trạng thái hóa đơn sang `Đã thanh toán` và gửi thông báo xác nhận thành công cho sinh viên.
      - **Giao dịch Cần xử lý tay** (`MANUAL_REQUIRED` - nhãn màu cam): Sinh viên chuyển thiếu tiền, chuyển thừa tiền, ghi sai cú pháp nội dung hoặc không ghi Mã sinh viên.
  - **Bước 4: Xử lý giao dịch gán thủ công (Khớp tay)**:
    - Tại dòng giao dịch có nhãn *Cần xử lý tay*, bấm nút **"Khớp tay"**.
    - Modal `Gán giao dịch thủ công` mở ra: Kế toán gõ tìm kiếm Mã SV hoặc Tên sinh viên thực tế chuyển tiền, chọn hóa đơn còn nợ tương ứng của sinh viên đó.
    - Bấm nút **"Xác nhận gạch nợ thủ công"**.
- **Kết quả hiển thị**:
  - Giao dịch được chuyển trạng thái sang `Đã khớp`.
  - Các thẻ chỉ số thống kê trên đỉnh trang được làm mới ngay lập tức: Tổng giao dịch, Số giao dịch khớp tự động, Số giao dịch đã xử lý tay, Tổng số tiền đã thu vào quỹ.

[Chèn hình ảnh: Màn hình Đối soát sao kê tự động và Modal gán giao dịch thủ công gạch nợ]

---

#### 3.3.3 Thống kê tài chính & Xuất báo cáo Excel định dạng .xlsx chuyên nghiệp (UC013)

- **Ý nghĩa chức năng**: Cung cấp bức tranh toàn cảnh về sức khỏe tài chính khu ký túc xá qua các kỳ thu; hỗ trợ kế toán lưu trữ lịch sử báo cáo định kỳ và kết xuất file bảng tính Excel (`.xlsx`) tiêu chuẩn nghiệp vụ phục vụ báo cáo Ban Giám hiệu nhà trường và lưu trữ hồ sơ tài chính.
- **Các bước thực hiện**:
  - **Bước 1**: Chọn mục **"Báo cáo & Thống kê"** trên Sidebar (URL `/accountant/reports`).
  - **Bước 2: Khảo sát bức tranh tài chính qua các KPI Cards**:
    - *Tổng tiền phải thu*: Tổng giá trị hóa đơn đã phát hành trong kỳ.
    - *Tổng tiền đã thu*: Doanh thu thực tế đã thu về tài khoản ngân hàng.
    - *Công nợ còn tồn*: Tổng số tiền chưa thanh toán của sinh viên.
    - *Tỷ lệ thu hồi nợ (%)*: Tỷ lệ phần trăm giữa số tiền đã thu trên tổng tiền phát hành.
    - *Cơ cấu doanh thu*: Tỷ trọng đóng góp từ phòng tiêu chuẩn, phòng dịch vụ và tiền điện nước.
  - **Bước 3: Lọc dữ liệu báo cáo**:
    - Chọn Kỳ thu hoạch toán (ví dụ: `Tháng 09/2026`, `Tháng 10/2026`, `Cả năm học 2026 - 2027`).
    - Lọc theo Loại phí (Tất cả, Tiền phòng, Điện nước) hoặc Trạng thái (Đã thanh toán, Còn nợ, Quá hạn).
    - Tìm kiếm nhanh theo họ tên sinh viên hoặc số phòng trên thanh tìm kiếm.
  - **Bước 4: Lưu báo cáo định kỳ vào hệ thống**:
    - Bấm nút **"Lập báo cáo định kỳ"**.
    - Điền Mã báo cáo, Tên tiêu đề báo cáo, Người lập biểu (Kế toán), Người phê duyệt (Trưởng Ban quản lý KTX), Ghi chú nhận xét và Đề xuất thu hồi nợ.
    - Bấm **"Lưu báo cáo vào hệ thống"** (có thể tra cứu lại tại modal Lịch sử báo cáo bất kỳ lúc nào).
  - **Bước 5: Xuất file Excel chuẩn nghiệp vụ (.xlsx)**:
    - Bấm nút **"Xuất Excel (.xlsx)"** (biểu tượng bảng tính màu xanh lá).
- **Kết quả hiển thị**:
  - Hệ thống sử dụng thư viện **ExcelJS** biên dịch trực tiếp trên trình duyệt và tự động tải về file: `Bao_Cao_Thu_Phi_KTX_[Ky_Thu].xlsx`.
  - **Quy cách file Excel xuất ra đạt chuẩn thẩm mỹ và kế toán**:
    - Hàng 1-3: Quốc hiệu Tiêu ngữ, Tên Đơn vị chủ quản (*Trường Đại học Công nghệ Thông tin và Truyền thông - Ban Quản lý KTX*), Tiêu đề báo cáo in hoa đậm, căn giữa.
    - Hàng 5 (Header bảng): Nền xanh Navy (`#1F497D`), chữ trắng in đậm, viền mỏng tinh tế gồm 8 cột: *Mã SV, Họ và tên, Phòng/Giường, Loại phí, Số tiền phải thu, Đã đóng, Còn nợ, Trạng thái*.
    - Dữ liệu chi tiết: Canh giữa Mã SV/Phòng/Trạng thái; Canh trái Họ tên/Loại phí; Canh phải các cột tiền tệ và định dạng số có dấu phân cách hàng nghìn chuẩn (`#,##0`).
    - Hàng **TỔNG CỘNG**: In đậm, nền xám nhạt (`#F2F2F2`), viền dưới nét đôi (`double`), chứa công thức Excel động (`=SUM(...)`).
    - Tự động co giãn bề rộng cột (Auto-fit Column Width) chống tràn chữ.
    - Cuối bảng có phần ký tên trang trọng của **Người lập biểu** và **Trưởng Ban Quản lý Ký túc xá**.

[Chèn hình ảnh: Giao diện Bảng thống kê tài chính phân hệ Kế toán và File Excel .xlsx chuyên nghiệp được xuất tự động]

---
*Tài liệu được biên soạn phục vụ công tác nghiệm thu, đánh giá đồ án tốt nghiệp hệ thống iDORM.*
