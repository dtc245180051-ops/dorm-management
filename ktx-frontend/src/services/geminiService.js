import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
export const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * 1. HÀM GỢI Ý XẾP PHÒNG BẰNG GEMINI AI
 */
export async function matchRoomWithGemini(studentInfo, candidateRooms = []) {
  // Lọc ràng buộc cứng: Cùng giới tính và còn chỗ trống
  const eligibleRooms = (candidateRooms || []).filter(
    (room) =>
      room.gioi_tinh === studentInfo.gioi_tinh &&
      room.thanh_vien_hien_tai < room.suc_chua,
  );

  if (eligibleRooms.length === 0) {
    return {
      best_room_id: "",
      toa: "",
      giuong: "",
      match_score: 0,
      ai_reason: "Hiện không còn phòng trống phù hợp với giới tính sinh viên.",
    };
  }

  // Fallback ngoại tuyến nếu chưa cấu hình API key
  if (!ai) {
    const fallbackRoom =
      eligibleRooms.find((r) => r.loai_phong === studentInfo.loai_phong) ||
      eligibleRooms[0];
    const availableBed =
      fallbackRoom.danh_sach_giuong?.find((g) => !g.da_co_nguoi)?.ma_giuong ||
      "Giường 01";
    return {
      best_room_id: fallbackRoom.ten_phong,
      toa: fallbackRoom.toa,
      giuong: availableBed,
      match_score: 80,
      ai_reason:
        "Gợi ý tự động từ hệ thống dựa trên loại phòng và giới tính (Chế độ ngoại tuyến).",
    };
  }

  try {
    const prompt = `
Bạn là chuyên gia phân bổ chỗ ở Ký túc xá Đại học Công nghệ Thông tin & Truyền thông (ICTU).
Nhiệm vụ: Phân tích thông tin sinh viên và chọn ra DUY NHẤT 1 phòng cùng 1 giường trống tối ưu nhất từ danh sách phòng ứng viên.

1. THÔNG TIN SINH VIÊN:
- Họ tên: ${studentInfo.ho_ten || studentInfo.fullName || ""} (Giới tính: ${studentInfo.gioi_tinh || studentInfo.gender || ""})
- Khoa/Ngành: ${studentInfo.khoa || studentInfo.department || ""}
- Lớp: ${studentInfo.lop || studentInfo.className || ""}
- Quê quán: ${studentInfo.que_quan || ""}

2. NGUYỆN VỌNG ĐĂNG KÝ:
- Loại phòng mong muốn: ${studentInfo.loai_phong || "Phòng tiêu chuẩn"}
- Chi tiết nguyện vọng tự do: "${studentInfo.chi_tiet_nguyen_vong || studentInfo.nguyen_vong || "Không có mô tả thêm"}"

3. DANH SÁCH PHÒNG CÒN CHỖ TRỐNG:
${JSON.stringify(eligibleRooms, null, 2)}

4. QUY TẮC ƯU TIÊN:
- Ưu tiên 1: Khớp đúng Loại phòng (Phòng tiêu chuẩn / Phòng dịch vụ).
- Ưu tiên 2: Phân tích chi tiết nguyện vọng tự do (thói quen sinh hoạt thức khuya/dậy sớm, mong muốn tầng cao/thấp, yên tĩnh).
- Ưu tiên 3: Ưu tiên cùng Khoa/Ngành hoặc cùng quê quán, tối ưu tỷ lệ lấp đầy phòng.

Trả về kết quả ở định dạng JSON thuần túy (không kèm markdown \`\`\`json):
{
  "best_room_id": "Tên phòng (ví dụ: Phòng 101)",
  "toa": "Tòa A2",
  "giuong": "Giường 01",
  "match_score": 95,
  "ai_reason": "Giải thích ngắn gọn 1-2 câu lý do xếp phòng này"
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const cleanText = response.text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleanText);
  } catch (error) {
    console.error("Lỗi khi gọi Gemini AI Matching:", error);
    const fallbackRoom = eligibleRooms[0];
    return {
      best_room_id: fallbackRoom.ten_phong,
      toa: fallbackRoom.toa,
      giuong: "Giường 01",
      match_score: 75,
      ai_reason:
        "Đề xuất dựa trên số chỗ trống hiện tại do gián đoạn kết nối máy chủ AI.",
    };
  }
}

//** 2. HÀM TRẢ LỜI CHATBOT TƯ VẤN KTX */
export async function askGeminiChatbot(userMessage, conversationHistory = []) {
  if (!apiKey) {
    return "Hệ thống AI đang bảo trì hoặc chưa cấu hình API Key. Bạn vui lòng liên hệ Ban Quản lý KTX nhé!";
  }

  try {
    const prompt = `
Bạn là Trợ lý AI Ký túc xá Đại học Công nghệ Thông tin & Truyền thông (ICTU).
Nhiệm vụ của bạn: Trả lời thân thiện, lịch sự, ngắn gọn và chính xác bằng tiếng Việt dựa trên quy định KTX ICTU:
- Giờ KTX: Mùa hè mở cổng lúc 5h00, đóng cổng giới nghiêm lúc 23h00; Mùa đông mở lúc 5h30, đóng lúc 22h30.
- Nội quy: Nghiêm cấm nấu ăn trong phòng, không cờ bạc, không gây mất trật tự, không nuôi động vật, tiếp khách đúng giờ.
- Tiền phòng, điện nước: Thanh toán qua mã VietQR trước ngày 15 hàng tháng.
- Mọi thủ tục đăng ký phòng, chuyển phòng đều thực hiện trực tuyến.

Câu hỏi của sinh viên: "${userMessage}"
Hãy trả lời sinh viên:
`;

    // Gọi generateContent trực tiếp với prompt tổng hợp
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Lỗi Chatbot Gemini chi tiết:", error);
    // Trả về câu thông báo có kèm thông điệp lỗi để dễ debug nếu muốn
    return `Đã xảy ra lỗi khi gọi AI: ${error.message || "Vui lòng kiểm tra tab Console (F12)"}`;
  }
}
