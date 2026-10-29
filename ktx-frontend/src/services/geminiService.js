import api from "./api";

// Xuất khẩu để tương thích ngược với code cũ nếu có
export const ai = null;

/**
 * Chuẩn hóa phân loại giới tính để so khớp chính xác (xử lý Nữ / Nu / Nam / Nam & Nữ)
 */
export function normalizeGender(gender = "") {
  const g = String(gender || "").trim().toLowerCase();
  if (g.includes("nam") && (g.includes("nữ") || g.includes("nu"))) return "ALL";
  if (g.includes("cả") || g.includes("all") || g.includes("tat ca")) return "ALL";
  if (g.includes("nữ") || g.includes("nu") || g.includes("female") || g === "f") return "FEMALE";
  if (g.includes("nam") || g.includes("male") || g === "m") return "MALE";
  return "UNKNOWN";
}

export function isGenderCompatible(studentGender, roomOrBuildingGender) {
  const sNorm = normalizeGender(studentGender);
  const rNorm = normalizeGender(roomOrBuildingGender);
  if (sNorm === "UNKNOWN" || rNorm === "UNKNOWN") return false;
  if (rNorm === "ALL") return true;
  return sNorm === rNorm;
}

/**
 * Thuật toán xếp phòng dự phòng ngoại tuyến (Rule-based Fallback)
 * Kích hoạt khi mất kết nối mạng hoặc Backend AI tạm thời bảo trì.
 */
function getSmartFallbackMatching(studentInfo, candidateRooms = []) {
  const sGender = studentInfo?.gioi_tinh || studentInfo?.gender || "";
  const sNorm = normalizeGender(sGender);
  const genderLabel = sNorm === "FEMALE" ? "Nữ" : (sNorm === "MALE" ? "Nam" : (sGender || "sinh viên"));
  const notFoundMessage = `Không tìm thấy phòng phù hợp: Ký túc xá hiện không có phòng dành cho giới tính ${genderLabel} hoặc các phòng đã hết chỗ.`;

  const eligibleRooms = (candidateRooms || []).filter((room) => {
    const isGenderOk = isGenderCompatible(sGender, room.gioi_tinh);
    const hasSpace =
      (room.danh_sach_giuong && room.danh_sach_giuong.some((g) => !g.da_co_nguoi)) ||
      (room.suc_chua != null && room.thanh_vien_hien_tai != null
        ? room.thanh_vien_hien_tai < room.suc_chua
        : (room.so_cho_trong != null ? room.so_cho_trong > 0 : true));
    return isGenderOk && hasSpace;
  });

  if (eligibleRooms.length === 0) {
    return {
      best_room_id: "",
      toa: "",
      giuong: "",
      match_score: 0,
      ai_reason: notFoundMessage,
      suggestion: null,
      message: notFoundMessage,
    };
  }

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

  const targetType = String(studentInfo.loai_phong || (rawWish.includes("dịch vụ") ? "Phòng dịch vụ" : "")).trim();

  // Ràng buộc cứng loại phòng: Nếu sinh viên yêu cầu loại phòng cụ thể
  if (targetType) {
    const typeMatched = eligibleRooms.filter((r) =>
      String(r.loai_phong || "").trim().toLowerCase() === targetType.toLowerCase()
    );
    if (typeMatched.length === 0) {
      const altType = eligibleRooms[0]?.loai_phong || "Phòng tiêu chuẩn";
      const mismatchMsg = `⚠️ KTX hiện đã hết (hoặc chưa có) ${targetType} dành cho ${genderLabel}. Đang hiển thị các phòng ${altType.toLowerCase()} còn trống để Quản lý cân nhắc thỏa thuận với sinh viên.`;
      return {
        best_room_id: "",
        toa: eligibleRooms[0]?.toa || "",
        giuong: "",
        match_score: 0,
        is_room_type_mismatch: true,
        requested_room_type: targetType,
        available_alternative_type: altType,
        ai_reason: mismatchMsg,
        suggestion: null,
        message: mismatchMsg,
      };
    }
    eligibleRooms = typeMatched;
  }

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
    return true;
  };

  const hasExplicitBuildingWish = wishesToaA1 || wishesToaA || wishesToaB;
  const roomMatch = rawWish.match(/phòng\s*([0-9a-z_-]+)|p([0-9a-z_-]+)/i);
  const specificRoom = roomMatch ? (roomMatch[1] || roomMatch[2]).toLowerCase() : "";

  const wantsHighFloor = /tầng\s*cao|trên\s*cao|tầng\s*[4-9]|lầu\s*cao|ở\s*cao|tầng\s*trên/i.test(rawWish);
  const wantsLowFloor = /tầng\s*thấp|tầng\s*1\b|tầng\s*trệt|ở\s*dưới|dưới\s*thấp|tầng\s*dưới/i.test(rawWish);

  const specificFloorMatch = rawWish.match(/tầng\s*(\d+)/i);
  const specificFloor = specificFloorMatch
    ? specificFloorMatch[1]
    : (studentInfo.tang_mong_muon ? String(studentInfo.tang_mong_muon).replace(/\D/g, "") : "");

  const scoredRooms = eligibleRooms.map((room) => {
    let score = 50;
    const reasons = [];

    if (hasExplicitBuildingWish) {
      if (matchesBuildingWish(room)) {
        score += 40;
        reasons.push(`đúng nguyện vọng ${room.toa}`);
      } else {
        score -= 35;
      }
    }

    const targetType = studentInfo.loai_phong || (rawWish.includes("dịch vụ") ? "Phòng dịch vụ" : "Phòng tiêu chuẩn");
    if (room.loai_phong && room.loai_phong.toLowerCase() === targetType.toLowerCase()) {
      score += 20;
      reasons.push(`loại phòng ${room.loai_phong}`);
    }

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
      reason: `Đề xuất xếp vào phòng ${room.so_phong || room.ten_phong} (${room.toa}) vì ${reasons.join(", ") || "phù hợp tiêu chuẩn"}.`,
    };
  });

  scoredRooms.sort((a, b) => b.score - a.score);
  const best = scoredRooms[0];
  const bestRoom = best.room;
  const availableBed =
    bestRoom.danh_sach_giuong?.find((g) => !g.da_co_nguoi)?.ma_giuong ||
    bestRoom.beds?.[0]?.ma_giuong ||
    "Giường G01";

  const bestRoomId = bestRoom.ma_phong || bestRoom.ten_phong || bestRoom.id;
  const bestToa = bestRoom.toa;

  return {
    best_room_id: bestRoomId,
    toa: bestToa,
    giuong: availableBed,
    match_score: best.score,
    ai_reason: best.reason,
    suggestion: {
      ma_toa: bestToa,
      ma_phong: bestRoomId,
      ma_giuong: availableBed,
    },
    message: null,
  };
}

/**
 * 1. HÀM GỢI Ý XẾP PHÒNG BẰNG AI (Gọi qua Backend API)
 * POST /api/ai/recommend-room hoặc /api/v1/ai/recommend-room
 */
export async function matchRoomWithGemini(studentInfo, candidateRooms = []) {
  const sGender = studentInfo?.gioi_tinh || studentInfo?.gender || "";
  const sNorm = normalizeGender(sGender);
  const genderLabel = sNorm === "FEMALE" ? "Nữ" : (sNorm === "MALE" ? "Nam" : (sGender || "sinh viên"));
  const notFoundMessage = `Không tìm thấy phòng phù hợp: Ký túc xá hiện không có phòng dành cho giới tính ${genderLabel} hoặc các phòng đã hết chỗ.`;

  try {
    const res = await api.post("/ai/recommend-room", {
      studentInfo,
      candidateRooms,
    });

    if (res?.data) {
      if (!res.data.best_room_id && !res.data.suggestion) {
        return {
          best_room_id: "",
          toa: res.data.toa ?? "",
          giuong: "",
          match_score: 0,
          is_room_type_mismatch: res.data.is_room_type_mismatch || false,
          requested_room_type: res.data.requested_room_type || "",
          available_alternative_type: res.data.available_alternative_type || "",
          ai_reason: res.data.message || res.data.ai_reason || notFoundMessage,
          suggestion: null,
          message: res.data.message || notFoundMessage,
        };
      }
      return {
        best_room_id: res.data.best_room_id ?? "",
        toa: res.data.toa ?? "",
        giuong: res.data.giuong ?? "",
        match_score: Number(res.data.match_score) || 90,
        is_room_type_mismatch: false,
        ai_reason: res.data.ai_reason || "Gợi ý tự động từ hệ thống AI",
        suggestion: res.data.suggestion || {
          ma_toa: res.data.toa ?? "",
          ma_phong: res.data.best_room_id ?? "",
          ma_giuong: res.data.giuong ?? "",
        },
        message: null,
      };
    }
  } catch (error) {
    console.warn("Lỗi khi gọi API AI xếp phòng từ Backend, chuyển sang dự phòng ngoại tuyến:", error);
  }

  // Fallback thông minh khi Backend không phản hồi hoặc mất mạng
  return getSmartFallbackMatching(studentInfo, candidateRooms);
}

/**
 * Trả lời thông minh ngoại tuyến theo nội quy KTX (Fallback)
 */
function getSmartLocalChatbotReply(userMessage) {
  const qRaw = String(userMessage || "").trim();
  const qNorm = qRaw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // 1. Giờ giới nghiêm, giờ đóng / mở cổng
  if (
    /gio gioi nghiem|dong cong|mo cong|ve muon|ra ngoai muon|gio giac|may gio khoa cong|may gio dong cong/.test(qNorm) ||
    /mấy giờ đóng|mấy giờ mở|giờ giấc|về muộn/i.test(qRaw)
  ) {
    return "⏰ **Thời gian mở/đóng cổng KTX:**\n- **Mùa hè:** Mở cổng lúc **05:00**, đóng cổng lúc **23:00**.\n- **Mùa đông:** Mở cổng lúc **05:30**, đóng cổng lúc **22:30**.\n\n*Lưu ý:* Sinh viên ra ngoài sớm hoặc về muộn hơn giờ quy định phải báo cáo và được sự đồng ý của trực ban KTX.";
  }

  // 2. Tiếp khách, bạn bè vào phòng
  if (
    /tiep khach|dan ban ve|cho ban vao|ban vao phong|nguoi ngoai vao|nguoi la|o qua dem|ngu qua dem|ban be/.test(qNorm) ||
    /tiếp khách|dẫn bạn|vào phòng|ở qua đêm|ngủ qua đêm/i.test(qRaw)
  ) {
    return "👥 **Quy định tiếp khách & người ngoài:**\n- Sinh viên **KHÔNG được tự ý tiếp khách** hoặc dẫn người ngoài vào phòng ở.\n- Việc tiếp người thân/bạn bè phải thực hiện tại **phòng tiếp khách chung** của KTX và được sự đồng ý của Ban Quản lý.\n- Nghiêm cấm đưa người ngoài vào lưu trú, ngủ qua đêm trong phòng KTX.";
  }

  // 3. Nấu ăn, đun nấu trong phòng
  if (
    /nau an|dun nau|bep gas|bep tu|bep dien|noi com|noi com dien|nau com|dun nuoc/.test(qNorm) ||
    /nấu ăn|đun nấu|bếp ga|bếp từ|bếp điện|nồi cơm/i.test(qRaw)
  ) {
    return "🍳 **Quy định về đun nấu & an toàn cháy nổ:**\nNghiêm cấm nấu ăn, đun nước bằng các thiết bị công suất lớn, bếp gas, bếp từ, bếp điện hoặc ngọn lửa trần trong phòng ở KTX để phòng ngừa nguy cơ cháy nổ.";
  }

  // 4. Nuôi thú cưng, chó mèo
  if (
    /nuoi cho|nuoi meo|thu cung|dong vat|cho meo|nuoi pet/.test(qNorm) ||
    /nuôi chó|nuôi mèo|thú cưng|động vật/i.test(qRaw)
  ) {
    return "🐾 **Quy định về vật nuôi:**\nKý túc xá nghiêm cấm việc nuôi, chăm sóc hoặc đưa các loại gia súc, gia cầm, thú cưng (chó, mèo, chim, bò sát...) vào trong khuôn viên và phòng ở KTX.";
  }

  // 5. Cờ bạc, rượu bia, chất cấm
  if (
    /co bac|uong ruou|uong bia|ruou bia|hut thuoc|chat cam|ma tuy|shisha|bong cuoi|danh bai/.test(qNorm) ||
    /cờ bạc|uống rượu|rượu bia|hút thuốc|chất cấm|ma túy|đánh bài/i.test(qRaw)
  ) {
    return "🚫 **Hành vi nghiêm cấm tuyệt đối:**\n- Nghiêm cấm sử dụng rượu, bia, chất kích thích, ma túy, hút thuốc lá/thuốc lá điện tử trong toàn bộ khuôn viên KTX.\n- Tuyệt đối nghiêm cấm đánh bài, cá độ dưới mọi hình thức.";
  }

  // 6. Báo sự cố, hư hỏng cơ sở vật chất
  if (
    /bao hong|su co|hong dien|hong nuoc|chay bong|sua chua|sua phong|hu hong|dien nuoc hong/.test(qNorm) ||
    /báo hỏng|sự cố|hỏng điện|hỏng nước|sửa chữa/i.test(qRaw)
  ) {
    return "🛠️ **Báo cáo sự cố & sửa chữa:**\nKhi phát hiện hỏng hóc điện nước, thiết bị, bạn vui lòng truy cập menu **'Báo cáo sự cố'** trên hệ thống để Ban Quản lý tiếp nhận và cử kỹ thuật viên xử lý sớm nhất.";
  }

  // 7. Chuyển phòng, đổi phòng, trả phòng
  if (
    /chuyen phong|doi phong|tra phong|doi cho o|chuyen giuong/.test(qNorm) ||
    /chuyển phòng|đổi phòng|trả phòng|chuyển chỗ ở/i.test(qRaw)
  ) {
    return "🔄 **Thủ tục chuyển / trả phòng:**\nBạn vào mục **'Chuyển / trả phòng'** trên menu để gửi yêu cầu cho Ban Quản lý duyệt, không tự ý chuyển chỗ hay đổi giường nhé.";
  }

  // 8. Nộp tiền phòng, điện nước, lệ phí
  if (
    /tien phong|dien nuoc|thanh toan|le phi|dong tien|vietqr|hoc phi/.test(qNorm) ||
    /tiền phòng|điện nước|thanh toán|lệ phí|đóng tiền/i.test(qRaw)
  ) {
    return "💳 **Thanh toán chi phí KTX:**\nBạn có thể nộp tiền phòng và tiền điện nước trực tuyến qua mã VietQR tại mục **'Thanh toán phí KTX'** trên thanh menu trước hạn thông báo hàng tháng nhé.";
  }

  // 9. Giữ gìn trật tự, gây ồn
  if (
    /on ao|tieng on|gay on|karaoke|loa keo|nhac lon|mat trat tu/.test(qNorm) ||
    /ồn ào|tiếng ồn|gây ồn|karaoke|mất trật tự/i.test(qRaw)
  ) {
    return "🔇 **Quy định trật tự, yên tĩnh:**\nSinh viên không được gây ồn ào, mở nhạc lớn, hát hò làm ảnh hưởng đến người xung quanh. Đặc biệt sau **22:00**, bắt buộc phải giữ yên tĩnh tuyệt đối cho các phòng nghỉ ngơi và học tập.";
  }

  return "Rất tiếc, thông tin này hiện chưa có trong văn bản Nội quy được cung cấp. Bạn vui lòng liên hệ trực tiếp Ban Quản lý để được hỗ trợ cụ thể.";
}

/**
 * 2. HÀM TRẢ LỜI CHATBOT TƯ VẤN NỘI QUY KTX (Gọi qua Backend API)
 * POST /api/ai/chat-regulation hoặc /api/v1/ai/chat-regulation
 */
export async function askGeminiChatbot(userMessage, conversationHistory = []) {
  if (!userMessage || !userMessage.trim()) {
    return "Chào bạn! Mình có thể giúp gì cho bạn về nội quy KTX?";
  }

  try {
    const res = await api.post("/ai/chat-regulation", {
      userMessage,
      conversationHistory,
    });

    if (res?.data?.reply) {
      return res.data.reply;
    }
  } catch (error) {
    console.warn("Lỗi khi kết nối Chatbot AI Backend, chuyển sang phản hồi nội bộ:", error);
  }

  // Fallback thông minh phản hồi dựa trên nội quy KTX
  return getSmartLocalChatbotReply(userMessage);
}
