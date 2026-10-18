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

  // Thuật toán chọn phòng tối ưu ngoại tuyến (Fallback thông minh phân tích ngữ nghĩa nguyện vọng)
  const getSmartFallback = () => {
    const rawWish = [
      studentInfo.nguyen_vong,
      studentInfo.noi_dung_nguyen_vong,
      studentInfo.nguyen_vong_label,
      studentInfo.chi_tiet_nguyen_vong,
      studentInfo.ma_toa_mong_muon,
      studentInfo.nguyen_vong_phong,
      studentInfo.tang_mong_muon,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    // 1. Phân tích nguyện vọng Tòa nhà (ví dụ: "Tòa A1", "A1", "Tòa A", "Tòa B"...)
    const wishesToaA1 = /tòa\s*a1\b|toa\s*a1\b|\ba1\b/i.test(rawWish) || String(studentInfo.ma_toa_mong_muon || "").toLowerCase().includes("a1");
    const wishesToaA = !wishesToaA1 && (/tòa\s*a\b|toa\s*a\b|\ba\b/i.test(rawWish) || String(studentInfo.ma_toa_mong_muon || "").toLowerCase().startsWith("a"));
    const wishesToaB = /tòa\s*b\b|toa\s*b\b|\bb\b/i.test(rawWish) || String(studentInfo.ma_toa_mong_muon || "").toLowerCase().startsWith("b");

    const matchesBuildingWish = (room) => {
      const rToa = String(room.toa || "").toLowerCase();
      const rMa = String(room.ma_toa || "").toLowerCase();
      if (wishesToaA1) {
        return rToa.includes("a1") || rMa.includes("a1") || rMa.includes("toa_a1");
      }
      if (wishesToaA) {
        return rToa.includes("a") || rMa.includes("a");
      }
      if (wishesToaB) {
        return rToa.includes("b") || rMa.includes("b");
      }
      return true; // Không chỉ định tòa cụ thể
    };

    const hasExplicitBuildingWish = wishesToaA1 || wishesToaA || wishesToaB;

    // 2. Phân tích nguyện vọng phòng cụ thể
    const roomMatch = rawWish.match(/phòng\s*([0-9a-z_-]+)|p([0-9a-z_-]+)/i);
    const specificRoom = roomMatch ? (roomMatch[1] || roomMatch[2]).toLowerCase() : "";

    // 3. Phân tích nguyện vọng tầng cao / tầng thấp từ văn bản tự do
    const wantsHighFloor = /tầng\s*cao|trên\s*cao|tầng\s*[4-9]|lầu\s*cao|ở\s*cao|tầng\s*trên/i.test(rawWish);
    const wantsLowFloor = /tầng\s*thấp|tầng\s*1\b|tầng\s*trệt|ở\s*dưới|dưới\s*thấp|tầng\s*dưới/i.test(rawWish);

    // Tìm số tầng cụ thể nếu có (ví dụ: tầng 2, tầng 3, tầng 5)
    const specificFloorMatch = rawWish.match(/tầng\s*(\d+)/i);
    const specificFloor = specificFloorMatch
      ? specificFloorMatch[1]
      : (studentInfo.tang_mong_muon ? String(studentInfo.tang_mong_muon).replace(/\D/g, "") : "");

    // 4. Tính điểm phù hợp đa tiêu chí cho từng phòng
    const scoredRooms = eligibleRooms.map((room) => {
      let score = 50;
      const reasons = [];

      // Tiêu chí 1: Khớp Tòa nhà mong muốn (Ưu tiên hàng đầu)
      if (hasExplicitBuildingWish) {
        if (matchesBuildingWish(room)) {
          score += 40;
          reasons.push(`đúng nguyện vọng ${room.toa}`);
        } else {
          score -= 35; // Trừ điểm nặng nếu không đúng tòa sinh viên yêu cầu
        }
      }

      // Tiêu chí 2: Khớp Loại phòng
      const targetType = studentInfo.loai_phong || (rawWish.includes("dịch vụ") ? "Phòng dịch vụ" : "Phòng tiêu chuẩn");
      if (room.loai_phong && room.loai_phong.toLowerCase() === targetType.toLowerCase()) {
        score += 20;
        reasons.push(`loại phòng ${room.loai_phong}`);
      }

      // Tiêu chí 3: Khớp Tầng
      const floorNum = Number(room.so_tang || 1);
      if (specificFloor) {
        if (String(floorNum) === specificFloor) {
          score += 20;
          reasons.push(`Tầng ${floorNum}`);
        }
      } else if (wantsHighFloor) {
        if (floorNum >= 3) {
          score += 12 + floorNum * 2;
          reasons.push(`tầng cao (Tầng ${floorNum})`);
        }
      } else if (wantsLowFloor) {
        if (floorNum <= 2) {
          score += 12 + (3 - floorNum) * 2;
          reasons.push(`tầng thấp (Tầng ${floorNum})`);
        }
      }

      // Tiêu chí 4: Khớp số phòng cụ thể
      if (specificRoom) {
        const rSo = String(room.so_phong || "").toLowerCase();
        const rMa = String(room.ma_phong || "").toLowerCase();
        if (rSo === specificRoom || rMa.includes(specificRoom)) {
          score += 30;
          reasons.push(`đúng phòng ${room.so_phong || room.ma_phong}`);
        }
      }

      return {
        room,
        score: Math.min(Math.max(score, 10), 99),
        reason: `Đề xuất tối ưu theo hệ thống: Phòng ${room.so_phong || room.ten_phong} (${room.toa}) đáp ứng ${reasons.join(", ") || "tiêu chí KTX"}.`,
      };
    });

    // Sắp xếp theo điểm số giảm dần
    scoredRooms.sort((a, b) => b.score - a.score);

    return scoredRooms[0] || {
      room: eligibleRooms[0],
      score: 80,
      reason: `Đề xuất theo hệ thống: Phòng ${eligibleRooms[0].so_phong || eligibleRooms[0].ten_phong} (${eligibleRooms[0].toa}).`,
    };
  };

  const { room: fallbackRoom, score: fallbackScore, reason: fallbackReason } = getSmartFallback();
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
      ai_reason: fallbackReason,
    };
  }

  try {
    const prompt = `
Bạn là chuyên gia phân bổ chỗ ở Ký túc xá Đại học Công nghệ Thông tin & Truyền thông (ICTU).
Nhiệm vụ: Phân tích kỹ nguyện vọng sinh viên và chọn ra DUY NHẤT 1 phòng cùng 1 giường trống tối ưu nhất từ danh sách phòng ứng viên.

1. THÔNG TIN SINH VIÊN:
- Họ tên: ${studentInfo.ho_ten || studentInfo.fullName || ""} (Giới tính: ${studentInfo.gioi_tinh || studentInfo.gender || ""})
- Khoa/Ngành: ${studentInfo.khoa || studentInfo.department || ""}
- Lớp: ${studentInfo.lop || studentInfo.className || ""}
- Quê quán: ${studentInfo.que_quan || studentInfo.dia_chi || ""}

2. NGUYỆN VỌNG ĐĂNG KÝ CỦA SINH VIÊN:
- Nguyện vọng tự do: "${studentInfo.chi_tiet_nguyen_vong || studentInfo.nguyen_vong || studentInfo.noi_dung_nguyen_vong || studentInfo.nguyen_vong_label || "Không có mô tả thêm"}"
- Tòa mong muốn: ${studentInfo.ma_toa_mong_muon || "Tự động phân tích từ nguyện vọng tự do"}
- Loại phòng mong muốn: ${studentInfo.loai_phong || "Phòng tiêu chuẩn"}
- Tầng mong muốn: ${studentInfo.tang_mong_muon || "Không chỉ định"}

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

4. QUY TẮC ƯU TIÊN TUYỆT ĐỐI THEO NGUYỆN VỌNG:
- Ưu tiên 1 (CỰC KỲ QUAN TRỌNG): NGUYỆN VỌNG TỰ DO VỀ TÒA NHÀ & PHÒNG CỤ THỂ:
  + Nếu nguyện vọng tự do ghi rõ tên tòa (ví dụ: "TÒA A1 Ạ", "Tòa A1", "tòa a", "tòa B"...): BẮT BUỘC phải ưu tiên chọn phòng thuộc tòa mà sinh viên ghi! TUYỆT ĐỐI KHÔNG xếp sang tòa khác khi tòa đó còn phòng trống.
  + Nếu có nguyện vọng phòng cụ thể: Ưu tiên chọn đúng phòng đó nếu còn giường.
- Ưu tiên 2: NGUYỆN VỌNG VỀ TẦNG:
  + Nếu muốn "tầng cao", "trên cao": Chọn phòng ở tầng cao nhất có thể (Tầng 4, Tầng 5).
  + Nếu muốn "tầng thấp", "tầng 1", "ở dưới": Chọn tầng thấp nhất (Tầng 1, Tầng 2).
- Ưu tiên 3: Khớp đúng Loại phòng (Phòng tiêu chuẩn / Phòng dịch vụ).
- Ưu tiên 4: Tối ưu tỷ lệ lấp đầy phòng.

Trả về kết quả ở định dạng JSON thuần túy (không kèm markdown \`\`\`json):
{
  "best_room_id": "Mã phòng hoặc Tên phòng (ví dụ: P101_A1 hoặc Phòng 101)",
  "toa": "Tên tòa (ví dụ: Tòa A1 hoặc Tòa B)",
  "giuong": "Mã giường hoặc Tên giường trống (ví dụ: P101_A1_G03 hoặc Giường G03)",
  "match_score": 95,
  "ai_reason": "Giải thích ngắn gọn 1-2 câu lý do xếp phòng này (nhấn mạnh đáp ứng đúng nguyện vọng tòa nhà/tầng/loại phòng của sinh viên)"
}
`;

    let response;
    const modelCandidates = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    let lastError = null;

    for (const m of modelCandidates) {
      try {
        response = await ai.models.generateContent({
          model: m,
          contents: prompt,
        });
        if (response?.text) break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!response?.text) {
      throw lastError || new Error("Không thể kết nối mô hình AI");
    }

    const cleanText = response.text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(cleanText);
    return {
      best_room_id: parsed.best_room_id || fallbackRoom.ma_phong || fallbackRoom.ten_phong,
      toa: parsed.toa || fallbackRoom.toa,
      giuong: parsed.giuong || availableBed,
      match_score: parsed.match_score || 95,
      ai_reason: parsed.ai_reason || fallbackReason,
    };
  } catch (error) {
    console.warn("Gemini AI matching fallback:", error);
    return {
      best_room_id: fallbackRoom.ma_phong || fallbackRoom.ten_phong,
      toa: fallbackRoom.toa,
      giuong: availableBed,
      match_score: fallbackScore,
      ai_reason: fallbackReason,
    };
  }
}

/**
 * Tri thức nghiệp vụ KTX dự phòng thông minh khi offline hoặc hết quota API
 */
function getSmartLocalChatbotReply(question) {
  const q = String(question || "").toLowerCase().trim();

  if (/giờ|mở cổng|đóng cổng|giới nghiêm|về muộn/i.test(q)) {
    return "⏰ Giờ đóng/mở cổng KTX ICTU:\n- Mùa hè: Mở cổng lúc 05:00, đóng cổng giới nghiêm lúc 23:00.\n- Mùa đông: Mở cổng lúc 05:30, đóng cổng lúc 22:30.\nNếu về muộn vì lý do học tập, bạn cần xuất trình thẻ sinh viên cho cán bộ trực ký túc xá nhé!";
  }

  if (/nấu ăn|bếp|bếp từ|gas/i.test(q)) {
    return "🍳 Quy định nấu ăn: Nhằm đảm bảo an toàn phòng cháy chữa cháy, KTX nghiêm cấm nấu ăn bằng bếp gas, bếp từ công suất lớn trong phòng ở. Bạn có thể sử dụng khu vực bếp chung hoặc nhà ăn KTX nhé!";
  }

  if (/chuyển phòng|đổi phòng|trả phòng/i.test(q)) {
    return "🔄 Thủ tục chuyển / trả phòng:\nBạn chỉ cần vào mục 'Chuyển / trả phòng' trên menu bên trái, chọn tab Chuyển phòng hoặc Trả phòng, điền lý do và gửi đơn. Ban Quản lý sẽ xét duyệt trực tuyến trong vòng 24 - 48h.";
  }

  if (/tiền phòng|điện nước|thanh toán|học phí|vietqr|ngân hàng|chi phí/i.test(q)) {
    return "💳 Thanh toán chi phí KTX:\n- Tiền phòng và tiền điện nước được thanh toán trực tuyến qua mã VietQR tại mục 'Thanh toán phí KTX'.\n- Hạn thanh toán định kỳ: Trước ngày 15 hàng tháng.\n- Hệ thống đối soát tự động cập nhật trạng thái 'Đã hoàn tất' ngay khi ngân hàng khớp lệnh.";
  }

  if (/hỏng|sự cố|báo hỏng|cháy bóng|mất nước|mất điện|sửa chữa|tắc cống/i.test(q)) {
    return "🛠️ Báo cáo sự cố cơ sở vật chất:\nBạn hãy vào mục 'Gửi phản ánh' trên thanh menu, nhập mô tả sự cố (kèm hình ảnh nếu có). Trợ lý AI sẽ tự động phân loại và gửi kỹ thuật viên đến sửa chữa ngay cho phòng bạn.";
  }

  if (/đăng ký|thủ tục ở|thuê phòng|vào ở/i.test(q)) {
    return "📝 Đăng ký nội trú KTX:\nSinh viên thực hiện nộp đơn tại mục 'Đăng ký phòng'. Hệ thống AI sẽ tự động phân tích nguyện vọng (loại phòng, tầng, giới tính) và gợi ý xếp phòng tối ưu nhất cho bạn.";
  }

  if (/thú cưng|chó|mèo|động vật/i.test(q)) {
    return "🐾 Quy định nuôi thú cưng: Theo nội quy Ký túc xá ICTU, sinh viên không được phép nuôi chó, mèo hoặc bất kỳ động vật nào trong phòng nhằm đảm bảo vệ sinh và mỹ quan chung.";
  }

  if (/liên hệ|hotline|số điện thoại|ban quản lý|văn phòng/i.test(q)) {
    return "📞 Ban Quản lý KTX ICTU:\n- Địa chỉ: Đường Z115, xã Quyết Thắng, TP. Thái Nguyên\n- Hotline hỗ trợ: 0208.3846.254\n- Giờ hành chính: 08:00 - 17:00 từ Thứ 2 đến Thứ 6.";
  }

  return "Chào bạn! Mình là Trợ lý AI KTX ICTU. Mình có thể hỗ trợ bạn về:\n- ⏰ Giờ giấc giới nghiêm & đóng/mở cổng KTX\n- 📝 Thủ tục đăng ký, chuyển phòng, trả phòng\n- 💳 Hướng dẫn thanh toán tiền phòng & điện nước qua VietQR\n- 🛠️ Hướng dẫn gửi phản ánh hỏng hóc, sửa chữa điện nước\nBạn có câu hỏi cụ thể nào về KTX không?";
}

//** 2. HÀM TRẢ LỜI CHATBOT TƯ VẤN KTX */
export async function askGeminiChatbot(userMessage, conversationHistory = []) {
  if (!apiKey || !ai) {
    return getSmartLocalChatbotReply(userMessage);
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

    const modelCandidates = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    let reply = "";

    for (const m of modelCandidates) {
      try {
        const response = await ai.models.generateContent({
          model: m,
          contents: prompt,
        });
        if (response?.text) {
          reply = response.text;
          break;
        }
      } catch (err) {
        // Thử model kế tiếp
      }
    }

    if (reply) {
      return reply;
    }
    return getSmartLocalChatbotReply(userMessage);
  } catch (error) {
    console.warn("Chatbot Gemini API error, fallback to smart reply:", error);
    return getSmartLocalChatbotReply(userMessage);
  }
}
