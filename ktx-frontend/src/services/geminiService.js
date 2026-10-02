import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
export const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/**
 * Chuẩn hóa phân loại giới tính để so khớp chính xác (xử lý Nữ / Nu / Nam / Nam & Nữ)
 */
export function normalizeGender(gender = "") {
  const g = String(gender || "").trim().toLowerCase();
  if (g.includes("nam") && (g.includes("nữ") || g.includes("nu"))) return "ALL";
  if (g.includes("cả") || g.includes("all") || g.includes("tat ca")) return "ALL";
  if (g.includes("nữ") || g.includes("nu") || g.includes("female") || g === "f") return "FEMALE";
  if (g.includes("nam") || g.includes("male") || g === "m") return "MALE";
  return "ALL";
}

export function isGenderCompatible(studentGender, roomOrBuildingGender) {
  const sNorm = normalizeGender(studentGender);
  const rNorm = normalizeGender(roomOrBuildingGender);
  if (rNorm === "ALL" || sNorm === "ALL") return true;
  return sNorm === rNorm;
}

/**
 * 1. HÀM GỢI Ý XẾP PHÒNG BẰNG GEMINI AI
 */
export async function matchRoomWithGemini(studentInfo, candidateRooms = []) {
  // Lọc ràng buộc cứng: Cùng giới tính và còn chỗ trống
  const eligibleRooms = (candidateRooms || []).filter((room) => {
    const isGenderOk = isGenderCompatible(studentInfo.gioi_tinh, room.gioi_tinh);
    const hasSpace =
      (room.danh_sach_giuong && room.danh_sach_giuong.some((g) => !g.da_co_nguoi)) ||
      (room.suc_chua != null && room.thanh_vien_hien_tai != null
        ? room.thanh_vien_hien_tai < room.suc_chua
        : ((room.beds || []).length > 0));
    return isGenderOk && hasSpace;
  });

  if (eligibleRooms.length === 0) {
    return {
      best_room_id: "",
      toa: "",
      giuong: "",
      match_score: 0,
      ai_reason: `Hiện không còn phòng trống phù hợp với giới tính ${studentInfo.gioi_tinh || ""} của sinh viên.`,
    };
  }

  // Thuật toán chọn phòng tối ưu ngoại tuyến (Fallback thông minh)
  const getSmartFallback = () => {
    const desiredFloor = String(
      studentInfo.tang_mong_muon ||
      (studentInfo.nguyen_vong?.toLowerCase().includes("tầng 1") ? "1" : "") ||
      (studentInfo.nguyen_vong?.toLowerCase().includes("tầng 2") ? "2" : "") ||
      (studentInfo.nguyen_vong?.toLowerCase().includes("tầng 3") ? "3" : "") ||
      ""
    ).replace(/\D/g, "");

    // 1. Khớp cả Loại phòng & Tầng
    const matchBoth = eligibleRooms.find((r) => {
      const typeOk = !studentInfo.loai_phong || (r.loai_phong && r.loai_phong.toLowerCase() === studentInfo.loai_phong.toLowerCase());
      const floorOk = !desiredFloor || String(r.so_tang) === desiredFloor;
      return typeOk && floorOk;
    });
    if (matchBoth) return { room: matchBoth, score: 95 };

    // 2. Khớp Loại phòng
    const matchType = eligibleRooms.find(
      (r) => !studentInfo.loai_phong || (r.loai_phong && r.loai_phong.toLowerCase() === studentInfo.loai_phong.toLowerCase())
    );
    if (matchType) return { room: matchType, score: 88 };

    return { room: eligibleRooms[0], score: 80 };
  };

  const { room: fallbackRoom, score: fallbackScore } = getSmartFallback();
  const availableBed =
    fallbackRoom.danh_sach_giuong?.find((g) => !g.da_co_nguoi)?.ma_giuong ||
    fallbackRoom.beds?.[0]?.ma_giuong ||
    "Giường G01";

  // Fallback ngoại tuyến nếu chưa cấu hình API key
  if (!ai) {
    return {
      best_room_id: fallbackRoom.ma_phong || fallbackRoom.ten_phong,
      toa: fallbackRoom.toa,
      giuong: availableBed,
      match_score: fallbackScore,
      ai_reason: `Gợi ý tự động từ hệ thống: Phòng ${fallbackRoom.so_phong || fallbackRoom.ten_phong} (${fallbackRoom.toa}) hoàn toàn phù hợp giới tính ${studentInfo.gioi_tinh || ""} và nguyện vọng của sinh viên.`,
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
- Quê quán: ${studentInfo.que_quan || studentInfo.dia_chi || ""}

2. NGUYỆN VỌNG ĐĂNG KÝ:
- Loại phòng mong muốn: ${studentInfo.loai_phong || "Phòng tiêu chuẩn"}
- Tầng mong muốn: ${studentInfo.tang_mong_muon || "Không chỉ định"}
- Chi tiết nguyện vọng tự do: "${studentInfo.chi_tiet_nguyen_vong || studentInfo.nguyen_vong || "Không có mô tả thêm"}"

3. DANH SÁCH PHÒNG CÒN CHỖ TRỐNG (ĐÃ ĐƯỢC LỌC ĐÚNG THEO GIỚI TÍNH):
${JSON.stringify(
  eligibleRooms.map((r) => ({
    ma_phong: r.ma_phong,
    so_phong: r.so_phong,
    toa: r.toa,
    so_tang: r.so_tang,
    loai_phong: r.loai_phong,
    suc_chua: r.suc_chua,
    thanh_vien_hien_tai: r.thanh_vien_hien_tai,
    danh_sach_giuong_trong: (r.danh_sach_giuong || r.beds || []).map((b) => b.ma_giuong || b.label),
  })),
  null,
  2,
)}

4. QUY TẮC ƯU TIÊN:
- Ưu tiên 1: Khớp đúng Giới tính và Loại phòng (Phòng tiêu chuẩn / Phòng dịch vụ).
- Ưu tiên 2: Phân tích chi tiết nguyện vọng tự do (ví dụ: mong muốn ở tầng 1, thức khuya/dậy sớm, yên tĩnh).
- Ưu tiên 3: Ưu tiên cùng Khoa/Ngành hoặc cùng quê quán, tối ưu tỷ lệ lấp đầy phòng.

Trả về kết quả ở định dạng JSON thuần túy (không kèm markdown \`\`\`json):
{
  "best_room_id": "Mã phòng hoặc Tên phòng (ví dụ: A3_T1_P101 hoặc Phòng 101)",
  "toa": "Tên tòa (ví dụ: Tòa A3 hoặc A3)",
  "giuong": "Mã giường hoặc Tên giường trống (ví dụ: A3_T1_P101_G02 hoặc Giường G02)",
  "match_score": 95,
  "ai_reason": "Giải thích ngắn gọn 1-2 câu lý do xếp phòng này (nhấn mạnh sự phù hợp giới tính, loại phòng và tầng/nguyện vọng)"
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
    const parsed = JSON.parse(cleanText);
    return {
      best_room_id: parsed.best_room_id || fallbackRoom.ma_phong || fallbackRoom.ten_phong,
      toa: parsed.toa || fallbackRoom.toa,
      giuong: parsed.giuong || availableBed,
      match_score: parsed.match_score || 90,
      ai_reason: parsed.ai_reason || `Phòng ${fallbackRoom.so_phong || fallbackRoom.ten_phong} (${fallbackRoom.toa}) hoàn toàn phù hợp với nguyện vọng và giới tính ${studentInfo.gioi_tinh}.`,
    };
  } catch (error) {
    console.error("Lỗi khi gọi Gemini AI Matching:", error);
    return {
      best_room_id: fallbackRoom.ma_phong || fallbackRoom.ten_phong,
      toa: fallbackRoom.toa,
      giuong: availableBed,
      match_score: fallbackScore,
      ai_reason: `Đề xuất tối ưu theo hệ thống: Phòng ${fallbackRoom.so_phong || fallbackRoom.ten_phong} (${fallbackRoom.toa}) phù hợp với loại phòng và giới tính ${studentInfo.gioi_tinh}.`,
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
