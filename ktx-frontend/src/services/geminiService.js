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
 * NGUỒN DỮ LIỆU BẮT BUỘC (GROUND TRUTH) - NỘI QUY KTX TRƯỜNG ĐẠI HỌC CNTT & TRUYỀN THÔNG (ICTU)
 */
export const KTX_REGULATIONS_GROUND_TRUTH = `
# NỘI QUY KÝ TÚC XÁ TRƯỜNG ĐẠI HỌC CÔNG NGHỆ THÔNG TIN & TRUYỀN THÔNG

### Điều 1. Đối tượng điều chỉnh và phạm vi áp dụng
1. Nội quy này áp dụng cho tất cả học sinh, sinh viên, học viên, nghiên cứu sinh, lưu học sinh (gọi chung là người học - NH) ở tại Ký túc xá Trường Đại học Công nghệ Thông tin & Truyền thông (KTX).
2. Người học ở nội trú phải tuân thủ các nội dung về nếp sống, sinh hoạt, an ninh trật tự, giữ gìn tài sản, vệ sinh môi trường, phòng cháy, chữa cháy, phát ngôn, chia sẻ thông tin, văn hóa ứng xử nơi công cộng, trên không gian mạng, khung xử lý kỷ luật với những hành vi vi phạm các quy định được nêu trong văn bản này.

### Điều 2. Quy định chung
1. Người học có nhu cầu ở nội trú phải đăng ký và làm các thủ tục cần thiết với BQL KTX trước khi được bố trí ở trong KTX. NH có thể đăng ký ở trong KTX theo hình thức trực tuyến.
2. Chấp hành nghiêm túc sự quản lý, điều động, sắp xếp chỗ ở của BQL KTX.
3. Người học khi ra, vào KTX phải xuất trình thẻ sinh viên, học viên, nghiên cứu sinh, lưu học sinh hoặc các giấy tờ liên quan do BQL KTX cấp (nếu có). Khách đến liên hệ công tác, bạn bè, người thân của NH đến thăm phải báo cáo và thực hiện theo sự hướng dẫn của trực ban KTX.
4. Nộp tiền lệ phí nhà ở, tiền điện, nước và các khoản tiền sử dụng dịch vụ khác đầy đủ, đúng hạn theo thông báo của BQL KTX.

### Điều 3. Quy định về sinh hoạt của người học tại Khu nội trú
1. Giờ mở/đóng cổng:
   - Giờ mùa hè: Mở cổng lúc 05:00 | Đóng cổng lúc 23:00.
   - Giờ mùa đông: Mở cổng lúc 05:30 | Đóng cổng lúc 22:30.
2. NH phải có mặt tại phòng trước giờ đóng cổng hàng ngày và chỉ được ra khỏi phòng sau giờ mở cổng (các trường hợp vào KTX muộn hơn hoặc ra sớm hơn phải báo cáo và được sự đồng ý của trực ban KTX); Thực hiện đầy đủ, đúng thời hạn các thủ tục đăng ký tạm trú, tạm vắng theo Luật cư trú.
3. Mỗi phòng ở cử 01 Trưởng phòng. Trưởng phòng có trách nhiệm hướng dẫn thành viên trong phòng thực hiện Nội quy, Quy định của Khu nội trú.
4. Không được tiếp khách, tổ chức các hoạt động trong giờ tự học và giờ nghỉ ảnh hưởng tới việc sinh hoạt, học tập của bạn cùng phòng và toàn Khu nội trú:
   - Buổi sáng: từ 07:30 đến 11:00.
   - Buổi chiều: từ 13:30 đến 17:00.
5. Chơi thể thao đúng nơi quy định; không chơi thể thao trong phòng ở, hành lang, ban công, lối đi, vườn cây,...
6. Cần có tác phong, ăn mặc, lời nói chuẩn mực. "Đi nhẹ - Nói khẽ - Cười duyên" trong KTX, đặc biệt là vào giờ tự học và giờ nghỉ; Trang phục phải lịch sự, gọn gàng khi xuống phòng làm việc với cán bộ BQL KTX.
7. Giữ gìn vệ sinh chung, đổ rác, chất thải đúng nơi quy định; tham gia đầy đủ, có chất lượng công tác tuyên truyền, tổng vệ sinh KTX khi được phân công.
8. Tắm, giặt, phơi quần áo, màn,... và vệ sinh cá nhân đúng nơi quy định.
9. Giữ gìn phòng ở sạch sẽ, có lịch trực vệ sinh phòng ở, không đổ hóa chất vào bồn cầu, luôn đậy nắp xi phông và thoát sàn để ngăn ngừa tóc, rác,... gây tắc hệ thống thoát chất thải.
10. Khi đi học phải khóa cửa, khi đi ngủ phải đóng cửa. Khi về nghỉ hè, nghỉ tết, đi thực tập, thực tế chuyên môn phải gửi tài sản có giá trị (nếu có) tại Kho của BQL KTX.
11. Chỉ được đem vào phòng những đồ dùng cá nhân thiết yếu theo mùa; quần áo, sách vở, đồ dùng cá nhân phải sắp xếp gọn gàng, ngăn nắp và để đúng nơi quy định.
12. Quản lý, sử dụng tài sản đúng quy định, tiết kiệm, hiệu quả; Tự bảo quản tài sản cá nhân; Chịu trách nhiệm đền bù tài sản công do bản thân gây ra hư hỏng, mất mát.
13. Để xe đúng nơi quy định; không để xe trong phòng ở, trên hành lang, chân cầu thang, xung quanh các tòa nhà trong KTX.
14. Vệ sinh sạch sẽ phòng ở trước khi bàn giao phòng ở cho BQL KTX khi nghỉ hè, nghỉ Tết hoặc kết thúc hợp đồng ở nội trú.
15. Thực hiện tốt công tác phòng, chống dịch bệnh. Khi có dịch bệnh xảy ra, người học phải chấp hành đúng theo quy định và hướng dẫn của Bộ Y tế, của địa phương và của BQL KTX.

### Điều 4. Quy định đối với cán bộ, nhân viên trực ban và đội thanh niên xung kích / đội tự quản
1. Đối với cán bộ, nhân viên: Đảm bảo thực hiện các nhiệm vụ được phân công, đảm bảo thời gian, ngày giờ công lao động theo quy định.
2. Trong mỗi ca trực, CBNV có trách nhiệm hỗ trợ lẫn nhau nếu có phát sinh các tình huống phức tạp xảy ra trong Khu nội trú.
3. Đội thanh niên xung kích / đội tự quản được thành lập để hỗ trợ các hoạt động đảm bảo an ninh, trật tự và các hoạt động khác trong Khu nội trú; Được hưởng chế độ, chính sách theo Quy định của Trường.

### Điều 5. Các hành vi người học không được làm trong KTX
1. Sản xuất, tàng trữ, sử dụng, buôn bán, vận chuyển, phát tán các loại vũ khí, chất gây cháy, gây nổ, hóa chất độc hại, ma túy và các chế phẩm của ma túy, các tài liệu, ấn phẩm, phim ảnh, thông tin phản động, đồi trụy và các vật dụng không được phép khác theo quy định của Nhà nước.
2. Tổ chức hoặc tham gia các hoạt động đánh bạc, số đề, mại dâm và các tệ nạn xã hội khác dưới mọi hình thức.
3. Uống rượu bia, gây gổ đánh nhau hoặc kích động đánh nhau, tổ chức băng nhóm, phe phái, tụ tập gây mất an ninh, trật tự trong và ngoài KTX.
4. Cung cấp, đăng tải, phản ánh, chia sẻ, cập nhật thông tin không chính xác, thiếu căn cứ, không trung thực, một chiều các hoạt động trong KTX ra bên ngoài tạo dư luận xấu và bất ổn tới uy tín, thương hiệu của Nhà trường nói chung và KTX nói riêng.
5. Tự ý sửa chữa, cải tạo phòng ở, di chuyển trang thiết bị, vật tư của KTX ra khỏi vị trí được bố trí. Có hành vi hủy hoại, trộm cắp tài sản của Nhà nước, của đơn vị đào tạo, của KTX và tài sản riêng của công dân; sử dụng tài sản công không đúng mục đích.
6. Tự ý chuyển đổi chỗ ở, cho người khác hay đưa người vào phòng ở mà chưa được phép của Ban Quản lý KTX.
7. Có hành động thiếu văn hoá, trái thuần phong mỹ tục, gây mất trật tự công cộng, gây ô nhiễm môi trường; đặt bát hương, thờ cúng trong KTX. Tổ chức, tham gia truyền bá các hoạt động tôn giáo, tín ngưỡng trái pháp luật.
8. Nấu ăn trong KTX.
9. Che chắn phòng ở, giường ngủ làm mất mỹ quan hoặc nhằm mục đích không lành mạnh. Viết, vẽ bậy và tùy tiện treo, dán quảng cáo, áp phích lên tường, phòng ở và trong khuôn viên KTX.
10. Báo cháy giả, nghịch phá hoặc có hành vi phá hoại hệ thống phòng cháy chữa cháy, cứu nạn cứu hộ.
11. Nuôi, chăn, thả động vật trong KTX.

### Điều 6. Khen thưởng, kỷ luật
1. Tập thể, cá nhân có thành tích trong các mặt phong trào, thực hiện tốt nội quy sẽ được xem xét đề nghị khen thưởng vào mỗi năm học. Các cá nhân có thành tích xuất sắc sẽ được xem xét khen thưởng đột xuất theo quy định.
2. Trong trường hợp NH vi phạm nội quy, tùy mức độ BQL KTX sẽ có hình thức xử lý như sau: Khiển trách, Cảnh cáo, Buộc rời khỏi KTX, nặng hơn có thể đề nghị truy cứu trách nhiệm hình sự.
3. NH ở nội trú phải chấp hành nghiêm nội quy, thực hiện đầy đủ những điều cam kết với BQL KTX.
4. Kết quả khen thưởng, kỷ luật của NH ở nội trú sẽ được thông báo về nhà trường (nơi NH đang học tập) để làm cơ sở đánh giá điểm rèn luyện hằng năm.

### Điều 7. Chấm dứt hiệu lực của Quyết định kỷ luật
1. NH bị kỷ luật khiển trách: Sau 03 tháng kể từ ngày có quyết định kỷ luật, nếu NH không tái phạm hoặc không vi phạm đến mức phải xử lý kỷ luật thì được chấm dứt hiệu lực của quyết định kỷ luật và được hưởng quyền lợi của NH ở nội trú. NH muốn đăng ký ở nội trú phải cam kết tuân thủ nội quy mới được xét duyệt.
2. NH bị kỷ luật cảnh cáo: Sau 06 tháng kể từ ngày có quyết định kỷ luật, nếu NH không tái phạm hoặc không vi phạm đến mức phải xử lý kỷ luật thì được chấm dứt hiệu lực của quyết định kỷ luật và được hưởng quyền lợi của NH ở nội trú. NH muốn đăng ký ở nội trú phải cam kết tuân thủ nội quy mới được xét duyệt.
3. NH bị kỷ luật buộc rời khỏi KTX: Không được đăng ký ở nội trú các năm tiếp theo. Kết quả kỷ luật được thông báo về đơn vị đào tạo, với gia đình NH và chính quyền địa phương liên quan để phối hợp giáo dục, quản lý.
`;

/**
 * Tri thức nghiệp vụ KTX dự phòng thông minh khi offline hoặc hết quota API
 * Trích dẫn chuẩn xác từng Điều theo đúng văn bản Nội quy
 */
function getSmartLocalChatbotReply(question) {
  const qRaw = String(question || "").toLowerCase().trim();
  const qNorm = qRaw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d");

  // 1. Thể thao / đá bóng / cầu lông (ưu tiên nhận diện trước để tránh nhầm chữ "chơi")
  if (
    /the thao|da bong|da cau|cau long|bong ban|choi the thao|tap the duc|san bong|tap the thao/.test(qNorm) ||
    /thể thao|đá bóng|đá cầu|cầu lông|bóng bàn|tập thể dục|chơi thể thao/i.test(qRaw)
  ) {
    return "⚽ **Quy định chơi thể thao:**\nBạn có thể chơi thể thao tại các khu vực được quy định (như sân thể thao KTX).\nLưu ý: Không chơi thể thao trong phòng ở, hành lang, ban công, lối đi hay vườn cây để đảm bảo an toàn và tránh gây ồn ào ảnh hưởng đến người khác nhé.";
  }

  // 2. Để xe / Gửi xe / Nhà xe
  if (
    /\b(de xe|gui xe|nha xe|bai xe|xe may|xe dap)\b/.test(qNorm) ||
    /gửi xe|để xe|nhà xe|bãi xe|xe máy|xe đạp/i.test(qRaw)
  ) {
    return "🛵 **Quy định để xe & gửi xe:**\n- Bạn để xe đúng nơi quy định tại nhà xe / khu vực trông giữ xe của KTX nhé.\n- Tuyệt đối không để xe trong phòng ở, trên hành lang, chân cầu thang hoặc xung quanh các tòa nhà.";
  }

  // 3. Nuôi thú cưng / Chó mèo / Động vật (không dùng chữ 'cho' đơn lẻ tránh nhầm với cho bạn, cho phép, chỗ ở)
  if (
    /nuoi cho|nuoi meo|nuoi thu|nuoi dong vat|thu cung|cho meo|con cho|con meo/.test(qNorm) ||
    /thú cưng|động vật/i.test(qRaw) ||
    (/chó|mèo/i.test(qRaw) && /nuôi|thú|chó|mèo|động vật/i.test(qRaw))
  ) {
    return "🐾 **Quy định nuôi thú cưng:**\nKý túc xá không cho phép nuôi chó, mèo hay bất kỳ động vật, thú cưng nào trong phòng để giữ gìn vệ sinh và không gian chung.";
  }

  // 4. Nấu ăn trong KTX
  if (
    /nau an|bep|bep tu|bep ga|gas|dun nau|nau nuong/.test(qNorm) ||
    /nấu ăn|bếp|bếp từ|bếp ga|gas|đun nấu/i.test(qRaw)
  ) {
    return "🍳 **Quy định nấu ăn:**\nKý túc xá nghiêm cấm nấu ăn trong phòng ở dưới mọi hình thức nhằm đảm bảo an toàn phòng cháy chữa cháy.";
  }

  // 5. Giờ giấc đóng/mở cổng, giới nghiêm, ra vào KTX
  if (
    /gio|mo cong|dong cong|gioi nghiem|ve muon|ra som|di muon|ve tre/.test(qNorm) ||
    /giờ|mở cổng|đóng cổng|giới nghiêm|về muộn|ra sớm|đi muộn/i.test(qRaw)
  ) {
    return "⏰ **Giờ mở và đóng cổng KTX:**\n- **Mùa hè:** Mở cổng lúc `05:00` | Đóng cổng lúc `23:00`\n- **Mùa đông:** Mở cổng lúc `05:30` | Đóng cổng lúc `22:30`\nBạn nhớ có mặt tại phòng trước giờ đóng cổng. Nếu có việc cần ra sớm hoặc về muộn, bạn hãy báo cáo trực ban KTX nhé.";
  }

  // 6. Tiếp khách & Giờ tự học, bạn bè vào phòng
  if (
    /tiep khach|ban be|nguoi than|gio tu hoc|gio nghi|tham ban|den tham|qua dem|vao phong|den choi|o nho/.test(qNorm) ||
    /tiếp khách|bạn bè|thăm|giờ nghỉ|giờ tự học|người thân|qua đêm|vào phòng|ở nhờ/i.test(qRaw)
  ) {
    return "👥 **Quy định tiếp khách & bạn bè đến thăm:**\n- Bạn bè hoặc người thân đến thăm cần báo cáo với trực ban KTX.\n- Không tiếp khách và không tổ chức hoạt động trong giờ tự học và giờ nghỉ:\n  + **Buổi sáng:** từ `07:30` đến `11:00`\n  + **Buổi chiều:** từ `13:30` đến `17:00`\n- Tuyệt đối không tự ý cho người lạ ở lại phòng qua đêm.";
  }

  // 7. Văn hóa ứng xử, tác phong, trang phục, ồn ào
  if (
    /tac phong|an mac|trang phuc|di nhe noi khe|cuoi duyen|on ao|tieng on|mat trat tu/.test(qNorm) ||
    /tác phong|ăn mặc|trang phục|đi nhẹ nói khẽ|cười duyên|ồn ào|mất trật tự/i.test(qRaw)
  ) {
    return "🗣️ **Văn hóa ứng xử & tác phong:**\n- Tác phong, ăn mặc, lời nói chuẩn mực. Thực hiện *'Đi nhẹ - Nói khẽ - Cười duyên'*, đặc biệt vào giờ tự học và giờ nghỉ.\n- Trang phục lịch sự, gọn gàng khi đến phòng làm việc của Ban Quản lý KTX.";
  }

  // 8. Vệ sinh phòng ở, đổ rác, chống tắc cống
  if (
    /ve sinh|rac|don phong|truc nhat|bon cau|thoat san|tac cong/.test(qNorm) ||
    /vệ sinh|rác|dọn phòng|trực nhật|bồn cầu|thoát sàn|tắc cống/i.test(qRaw)
  ) {
    return "🧹 **Quy định vệ sinh phòng ở:**\n- Giữ gìn phòng sạch sẽ, phân công lịch trực nhật phòng và đổ rác đúng nơi quy định.\n- Không đổ hóa chất vào bồn cầu; luôn đậy nắp thoát sàn để tránh tóc, rác gây tắc cống.\n- Dọn dẹp vệ sinh sạch sẽ trước khi bàn giao phòng khi nghỉ hè, nghỉ Tết hoặc kết thúc hợp đồng.";
  }

  // 9. Giặt giũ & phơi phóng
  if (
    /tam|giat|phoi|quan ao|man|giat do/.test(qNorm) ||
    /tắm|giặt|phơi|quần áo|màn/i.test(qRaw)
  ) {
    return "👕 **Quy định giặt và phơi đồ:**\nBạn thực hiện tắm, giặt và phơi quần áo, màn... đúng nơi quy định của tòa nhà KTX nhé.";
  }

  // 10. Khóa cửa, gửi đồ khi nghỉ hè/Tết, bảo quản tài sản
  if (
    /khoa cua|di ngu|nghi he|nghi tet|gui do|kho gui do|bao quan tai san|tai san/.test(qNorm) ||
    /khóa cửa|đi ngủ|nghỉ hè|nghỉ tết|gửi đồ|kho|tài sản/i.test(qRaw)
  ) {
    return "🔐 **Bảo quản tài sản & gửi đồ:**\n- Khi đi học phải khóa cửa, khi đi ngủ phải đóng cửa phòng.\n- Tự bảo quản tài sản cá nhân và có ý thức giữ gìn tài sản chung của phòng.\n- Khi về nghỉ hè, nghỉ Tết hoặc đi thực tập, bạn có thể gửi đồ có giá trị tại Kho của Ban Quản lý KTX.";
  }

  // 11. Đem đồ dùng, thiết bị cá nhân vào phòng
  if (
    /do dung|thiet bi|mang vao|do dung ca nhan|vat dung/.test(qNorm) ||
    /đồ dùng|thiết bị|mang vào|vật dụng/i.test(qRaw)
  ) {
    return "📦 **Đồ dùng mang vào phòng:**\nChỉ được đem vào phòng những đồ dùng cá nhân thiết yếu theo mùa; quần áo, sách vở và đồ dùng cá nhân phải sắp xếp gọn gàng, ngăn nắp và để đúng nơi quy định.";
  }

  // 12. Rượu bia, đánh nhau, đánh bạc, tệ nạn
  if (
    /ruou|bia|danh nhau|gay roi|danh bac|so de|mai dam|te nan|vu khi|ma tuy/.test(qNorm) ||
    /rượu|bia|đánh nhau|gây rối|đánh bạc|số đề|mại dâm|tệ nạn|vũ khí|ma túy/i.test(qRaw)
  ) {
    return "🚫 **Trật tự & An toàn:**\nNghiêm cấm uống rượu bia, đánh nhau, đánh bạc, số đề, tàng trữ vũ khí, chất cháy nổ hoặc tụ tập gây mất an ninh trật tự trong và ngoài KTX.";
  }

  // 13. Sửa chữa phòng, di chuyển tài sản
  if (
    /sua phong|cai tao|di chuyen giuong|di chuyen do|vat tu|trom cap/.test(qNorm) ||
    /sửa phòng|cải tạo|di chuyển giường|vật tư|trộm cắp/i.test(qRaw)
  ) {
    return "🔨 **Sửa chữa & di chuyển tài sản:**\nNghiêm cấm tự ý sửa chữa, cải tạo phòng ở; tự ý di chuyển trang thiết bị, giường tủ của KTX ra khỏi vị trí ban đầu; không sử dụng tài sản công sai mục đích.";
  }

  // 14. Che chắn giường, vẽ bậy, dán quảng cáo
  if (
    /che chan|che giuong|ve bay|dan quang cao|ap phich/.test(qNorm) ||
    /che chắn|che giường|vẽ bậy|dán quảng cáo|áp phích/i.test(qRaw)
  ) {
    return "🎨 **Mỹ quan phòng ở:**\nKhông che chắn phòng ở, giường ngủ làm mất mỹ quan; nghiêm cấm viết, vẽ bậy và tùy tiện treo, dán quảng cáo, áp phích lên tường phòng ở và khuôn viên KTX.";
  }

  // 15. Báo cháy giả, nghịch thiết bị PCCC
  if (
    /pccc|bao chay|phong chay|chua chay|pha hoai pccc/.test(qNorm) ||
    /báo cháy|phòng cháy|chữa cháy|pccc/i.test(qRaw)
  ) {
    return "🧯 **Quy định PCCC:**\nNghiêm cấm báo cháy giả, nghịch phá hoặc có hành vi phá hoại hệ thống phòng cháy chữa cháy, cứu nạn cứu hộ trong KTX.";
  }

  // 16. Khen thưởng & Các hình thức kỷ luật
  if (
    /ky luat|vi pham|hinh thuc xu ly|bi phat|khen thuong|khien trach|canh cao|buoc roi|duoi|xoa ky luat|thoi han/.test(qNorm) ||
    /kỷ luật|vi phạm|hình thức xử lý|bị phạt|khen thưởng|khiển trách|cảnh cáo|buộc rời/i.test(qRaw)
  ) {
    return "⚖️ **Quy định xử lý vi phạm & Kỷ luật:**\n- Các mức xử lý gồm: **Khiển trách**, **Cảnh cáo**, **Buộc rời khỏi KTX**.\n- Thời hạn chấm dứt hiệu lực kỷ luật nếu không tái phạm:\n  + Khiển trách: Sau **03 tháng**\n  + Cảnh cáo: Sau **06 tháng**\n  + Buộc rời khỏi KTX: Không được đăng ký ở lại KTX các năm tiếp theo.";
  }

  // 17. Chuyển phòng, đổi phòng, trả phòng
  if (
    /chuyen phong|doi phong|tra phong|doi cho o|chuyen giuong/.test(qNorm) ||
    /chuyển phòng|đổi phòng|trả phòng|chuyển chỗ ở/i.test(qRaw)
  ) {
    return "🔄 **Thủ tục chuyển / trả phòng:**\nBạn vào mục **'Chuyển / trả phòng'** trên menu để gửi yêu cầu cho Ban Quản lý duyệt, không tự ý chuyển chỗ hay đổi giường nhé.";
  }

  // 18. Nộp tiền phòng, điện nước, lệ phí
  if (
    /tien phong|dien nuoc|thanh toan|le phi|dong tien|vietqr|hoc phi/.test(qNorm) ||
    /tiền phòng|điện nước|thanh toán|lệ phí|đóng tiền/i.test(qRaw)
  ) {
    return "💳 **Thanh toán chi phí KTX:**\nBạn có thể nộp tiền phòng và tiền điện nước trực tuyến qua mã VietQR tại mục **'Thanh toán phí KTX'** trên thanh menu trước hạn thông báo hàng tháng nhé.";
  }

  // 19. Đăng ký phòng, thủ tục vào ở
  if (
    /dang ky|thu tuc o|vao o|dang ky phong|thue phong/.test(qNorm) ||
    /đăng ký|thủ tục ở|vào ở|đăng ký phòng/i.test(qRaw)
  ) {
    return "📝 **Đăng ký ở KTX:**\nBạn có thể đăng ký trực tuyến tại mục **'Đăng ký phòng'** trên menu. Hệ thống sẽ tiếp nhận và gửi Ban Quản lý xét duyệt bố trí chỗ ở cho bạn.";
  }

  // 20. Thẻ sinh viên, thủ tục ra vào KTX
  if (
    /the sinh vien|xuat trinh the|the ktx|ra vao ktx/.test(qNorm) ||
    /thẻ sinh viên|xuất trình thẻ|thẻ ktx|ra vào/i.test(qRaw)
  ) {
    return "🪪 **Quy định xuất trình thẻ ra vào:**\nSinh viên khi ra, vào KTX cần xuất trình thẻ sinh viên hoặc giấy tờ liên quan khi có yêu cầu từ Ban Quản lý hoặc bảo vệ trực ban.";
  }

  return "Rất tiếc, thông tin này hiện chưa có trong văn bản Nội quy được cung cấp. Bạn vui lòng liên hệ trực tiếp Ban Quản lý để được hỗ trợ cụ thể.";
}

//** 2. HÀM TRẢ LỜI CHATBOT TƯ VẤN KTX */
export async function askGeminiChatbot(userMessage, conversationHistory = []) {
  if (!apiKey || !ai) {
    return getSmartLocalChatbotReply(userMessage);
  }

  try {
    const prompt = `
Bạn là Trợ lý Ảo hỗ trợ giải đáp Nội quy và Quy định của Ký túc xá / Tòa nhà.

### NGUỒN DỮ LIỆU BẮT BUỘC (GROUND TRUTH):
Dưới đây là toàn bộ tài liệu "NỘI QUY" được cung cấp từ hệ thống:
---
${KTX_REGULATIONS_GROUND_TRUTH}
---

### QUY TẮC PHẢN HỒI (BẮT BUỘC TUÂN THỦ NGHIÊM NGẶT):
1. TRẢ LỜI TỰ NHIÊN, THÂN THIỆN & KHÔNG NÊU SỐ ĐIỀU KHOẢN:
   - Dựa trực tiếp vào nội dung trong tài liệu "NỘI QUY" ở trên.
   - TUYỆT ĐỐI KHÔNG đưa các trích dẫn điều khoản luật cứng nhắc (như "Khoản X - Điều Y", "Căn cứ Điều...") vào câu trả lời, trừ khi người dùng hỏi đích danh số điều khoản.
   - Trả lời thân thiện, súc tích, ngắt dòng thành các gạch đầu dòng rõ ràng, dễ hiểu cho sinh viên.

2. LINH HOẠT VỚI CÂU HỎI MỞ:
   - Phân tích ngữ cảnh của người dùng thay vì chỉ khớp câu từ máy móc với một số ít mẫu câu định sẵn.
   - Nếu người dùng hỏi một ý nằm trong nội quy bằng nhiều cách diễn đạt khác nhau, bạn vẫn phải tìm đúng điều khoản tương ứng trong tài liệu để trả lời.

3. XỬ LÝ KHI KHÔNG CÓ THÔNG TIN:
   - Chỉ khi nội dung người dùng hỏi HOÀN TOÀN KHÔNG XUẤT HIỆN trong tài liệu nội quy trên, bạn mới trả lời: 
     "Rất tiếc, thông tin này hiện chưa có trong văn bản Nội quy được cung cấp. Bạn vui lòng liên hệ trực tiếp Ban Quản lý để được hỗ trợ cụ thể."
   - Tuyệt đối không tự suy diễn hoặc dùng kiến thức ngoài tài liệu để tạo ra quy định giả định.

### CÂU HỎI CỦA NGƯỜI DÙNG:
"${userMessage}"
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

