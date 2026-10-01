# KỸ NĂNG NGHIỆP VỤ & THUẬT TOÁN: PHÂN BỔ PHÒNG KTX (ROOM ASSIGNMENT RULES)

Tài liệu này định nghĩa bộ quy tắc, tiêu chí ràng buộc và thuật toán phân bổ, gợi ý phòng/giường cho sinh viên tại Ký túc xá Đại học Công nghệ Thông tin & Truyền thông (ICTU) dựa trên sự kết hợp giữa **Loại phòng đăng ký**, **Phân tích ngữ nghĩa chi tiết nguyện vọng bằng Gemini AI (NLP)** và **Quy tắc vận hành KTX**.

---

## 1. NGUYÊN TẮC RÀNG BUỘC CỨNG (HARD CONSTRAINTS)

> **Bắt buộc 100%:** Bất kỳ phòng/giường nào vi phạm một trong các điều kiện sau sẽ bị LOẠI BỎ NGAY LẬP TỨC khỏi danh sách ứng viên (không xét tính điểm tiếp theo).

1. **Phân tách giới tính (Gender Separation):**
   - Sinh viên Nam chỉ được xếp vào các Tòa/Khu vực/Phòng quy định dành cho Nam.
   - Sinh viên Nữ chỉ được xếp vào các Tòa/Khu vực/Phòng quy định dành cho Nữ.
2. **Sức chứa & Giường trống (Capacity & Availability):**
   - Phòng phải còn ít nhất 01 giường ở trạng thái trống (`da_o < suc_chua`).
   - Giường được chọn phải chưa có sinh viên nào đăng ký/được duyệt (`trang_thai_giuong === 'TRONG'`).
3. **Trạng thái hoạt động của phòng (Operational Status):**
   - Phòng phải ở trạng thái sẵn sàng đón tiếp (`HOAT_DONG`).
   - Tuyệt đối không xếp vào phòng đang sửa chữa, bảo trì, khử khuẩn hoặc niêm phong sự cố.

---

## 2. DỮ LIỆU ĐẦU VÀO TỪ FORM NGUYỆN VỌNG SINH VIÊN

Form đăng ký phòng của sinh viên gồm 2 trường nguyện vọng trọng tâm:

1. **`loai_phong` (Dropdown Select):**
   - `Phòng tiêu chuẩn` (quạt trần, giường tầng, công trình phụ khép kín).
   - `Phòng dịch vụ` (có điều hòa, bình nóng lạnh, tủ lạnh/tiện ích nâng cao).
2. **`chi_tiet_nguyen_vong` (Textarea - Tự do):**
   - Sinh viên tự do diễn đạt thói quen sinh hoạt, nhu cầu học tập, mong muốn tầng cao/thấp, sở thích bạn cùng phòng (ví dụ: _"Em học CNTT hay thức khuya làm bài, muốn ở tầng thấp, không gian yên tĩnh và cùng bạn cùng ngành..."_).

---

## 3. CƠ CHẾ TÍNH ĐIỂM & GỢI Ý PHÒNG (MATCH SCORE)

Điểm tổng quy chuẩn theo thang điểm **100**:

$$\text{MatchScore} = \text{Score}_{\text{loai\_phong}} + \text{Score}_{\text{ai\_nlp}} + \text{Score}_{\text{profile}} + \text{Score}_{\text{operation}}$$

### 3.1. Khớp Loại phòng (`loai_phong`): Tối đa 40 điểm

- Khớp chính xác `Phòng tiêu chuẩn` hoặc `Phòng dịch vụ`: **+40 điểm**.
- Không khớp loại phòng mong muốn: **0 điểm** (hạ mức ưu tiên xuống cuối danh sách).

### 3.2. Phân tích chi tiết nguyện vọng bằng Gemini AI (NLP Score): Tối đa 30 điểm

Gemini AI (`gemini-2.5-flash`) đọc nội dung `chi_tiet_nguyen_vong` để chấm điểm tương thích với từng phòng:

- **Nguyện vọng tầng (nếu có nhắc đến):** Nhắc "tầng thấp/tầng 1-2" $\rightarrow$ phòng tầng 1, 2 nhận **+10 điểm**; nhắc "tầng cao/thoáng" $\rightarrow$ phòng tầng 3, 4 nhận **+10 điểm**.
- **Thói quen sinh hoạt:** Thức khuya học bài / dậy sớm $\rightarrow$ ghép vào phòng có thành viên có lịch sinh hoạt tương đồng: **+10 điểm**.
- **Không gian sống / Bạn bè:** Mong muốn yên tĩnh, ở chung với bạn cụ thể hoặc cùng sở thích: **+10 điểm**.

### 3.3. Tương thích hồ sơ sinh viên (Profile Match): Tối đa 20 điểm

- **Cùng Khoa / Ngành (`khoa_vien`):** Có bạn cùng khoa (CNTT, Điện tử...) trong phòng: **+12 điểm** (thuận tiện học nhóm, thi cử).
- **Cùng Quê quán / Tỉnh thành (`que_quan`):** Có bạn cùng quê trong phòng: **+8 điểm**.

### 3.4. Tối ưu hóa vận hành KTX (Consolidation): Tối đa 10 điểm

- **Tối ưu lấp đầy:** Ưu tiên lấp đầy các phòng đang có từ 4 đến 6 người (trên 8 chỗ): **+10 điểm** (giúp tiết kiệm điện hành lang, tinh gọn công tác quản lý).

---

## 4. PROMPT GEMINI AI CHUẨN (`geminiService.js`)

Khi gửi yêu cầu phân bổ phòng lên Gemini API, sử dụng prompt chuẩn:

```javascript
const prompt = `
Bạn là chuyên gia phân bổ chỗ ở ký túc xá (KTX) Đại học CNTT & TT.
Nhiệm vụ: Phân tích thông tin sinh viên và chọn ra duy nhất 1 phòng cùng 1 giường trống tối ưu nhất từ danh sách phòng ứng viên.

1. THÔNG TIN SINH VIÊN:
- Họ tên: ${studentInfo.ho_ten} (${studentInfo.gioi_tinh})
- Khoa / Lớp: ${studentInfo.khoa} - ${studentInfo.lop || ""}
- Quê quán: ${studentInfo.que_quan || ""}

2. NGUYỆN VỌNG ĐĂNG KÝ:
- Loại phòng mong muốn: ${studentInfo.loai_phong} (Phòng tiêu chuẩn / Phòng dịch vụ)
- Chi tiết nguyện vọng tự do: "${studentInfo.chi_tiet_nguyen_vong || "Không có mô tả thêm"}"

3. DANH SÁCH PHÒNG ỨNG VIÊN CÒN TRỐNG (ĐÃ LỌC CÙNG GIỚI TÍNH):
${JSON.stringify(candidateRooms, null, 2)}

4. TIÊU CHÍ ƯU TIÊN:
- Phải khớp đúng loại phòng (Tiêu chuẩn hoặc Dịch vụ).
- Phân tích đoạn "Chi tiết nguyện vọng tự do" để trích xuất mong muốn về tầng ở, thói quen sinh hoạt, tính cách và so khớp với thông tin các thành viên/vị trí phòng.
- Ưu tiên ghép cùng Khoa/Ngành và cùng quê quán.

Trả về kết quả duy nhất ở định dạng JSON:
{
  "best_room_id": "Tên phòng (ví dụ: Phòng 101)",
  "toa": "Tòa A2",
  "giuong": "Mã giường (ví dụ: Giường 01)",
  "match_score": 95,
  "ai_reason": "Giải thích ngắn gọn 1-2 câu lý do chọn phòng (ví dụ: Đúng loại phòng tiêu chuẩn, đáp ứng nguyện vọng ở tầng thấp yên tĩnh và phòng đã có 2 bạn cùng khoa CNTT)."
}
`;
```
