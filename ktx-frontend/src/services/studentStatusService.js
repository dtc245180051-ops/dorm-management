import occupancyService from "./occupancyService";
import { API_BASE_URL } from "./authService";
import { getStudentAccount } from "./studentAccountService";

/**
 * Trạng thái sinh viên trong hệ thống KTX:
 * - NOT_REGISTERED: Mới tạo tài khoản/đăng nhập, chưa gửi bất kỳ đơn đăng ký ở nào.
 * - PENDING_APPROVAL: Đã nộp đơn đăng ký phòng thành công, đang chờ BQL duyệt / AI xếp phòng.
 * - ACTIVE_RESIDENT: Đơn đã được duyệt VÀ sinh viên đã được xếp phòng chính thức (đang ở).
 * - APPLICATION_CLOSED: Đã kết thúc hợp đồng lưu trú (trả phòng).
 */
export const STUDENT_STATUS = {
  NOT_REGISTERED: "NOT_REGISTERED",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  ACTIVE_RESIDENT: "ACTIVE_RESIDENT",
  APPLICATION_CLOSED: "APPLICATION_CLOSED",
};

const getAssignedRoom = (record) => {
  if (!record) return null;

  const roomDetails = record.thong_tin_phong_hien_tai || {};
  const roomObject = typeof record.phong === "object" ? record.phong : {};
  const roomNumber =
    record.phong_hien_tai ||
    record.phong_duoc_xep ||
    record.so_phong ||
    record.ma_phong ||
    record.goi_y?.so_phong ||
    record.goi_y?.ma_phong ||
    roomDetails.so_phong ||
    roomDetails.ma_phong ||
    roomObject.so_phong ||
    roomObject.ma_phong ||
    (typeof record.phong === "string" ? record.phong : "") ||
    record.phong_giuong ||
    "";

  if (!roomNumber) return null;

  return {
    ...roomDetails,
    ...roomObject,
    so_phong: roomNumber,
    ma_phong:
      record.ma_phong ||
      record.goi_y?.ma_phong ||
      roomDetails.ma_phong ||
      roomObject.ma_phong,
    loai_phong:
      record.loai_phong ||
      roomDetails.loai_phong ||
      roomObject.loai_phong ||
      "Phòng tiêu chuẩn",
    suc_chua:
      record.suc_chua ||
      roomDetails.suc_chua ||
      roomObject.suc_chua ||
      "4 người",
    ma_giuong:
      record.ma_giuong ||
      record.goi_y?.ma_giuong ||
      roomDetails.ma_giuong ||
      roomObject.ma_giuong ||
      "G01",
    so_giuong:
      (
        record.so_giuong ||
        record.giuong ||
        record.goi_y?.so_giuong ||
        roomDetails.so_giuong ||
        roomObject.so_giuong ||
        record.ma_giuong ||
        "G01"
      )
        .toString()
        .split("_")
        .pop() || "G01",
    giuong:
      (
        record.giuong ||
        record.so_giuong ||
        record.ma_giuong ||
        "G01"
      )
        .toString()
        .split("_")
        .pop() || "G01",
    tang:
      record.so_tang ||
      record.tang ||
      roomDetails.so_tang ||
      roomDetails.tang ||
      roomObject.tang ||
      5,
    toa:
      record.toa_hien_tai ||
      record.toa_nha ||
      record.toa ||
      record.ma_toa ||
      record.goi_y?.ma_toa ||
      roomDetails.ten_toa ||
      roomDetails.toa_nha ||
      roomDetails.ma_toa ||
      roomObject.toa ||
      "Tòa A4",
  };
};

/**
 * Hàm lấy số giai đoạn nghiệp vụ (1, 2, 3)
 * @param {string} status 
 * @returns {number} 1 | 2 | 3
 */
export function getStudentStage(status) {
  if (status === STUDENT_STATUS.ACTIVE_RESIDENT) return 3;
  if (status === STUDENT_STATUS.PENDING_APPROVAL) return 2;
  return 1;
}

/**
 * Kiểm tra quyền truy cập tính năng (Feature Gating) theo 3 giai đoạn
 * 
 * - GIAI ĐOẠN 1 (NOT_REGISTERED):
 *     Cho phép: dashboard, lookup, register, profile
 *     Khóa: transfer, history, feedback, payment, payment_history
 * 
 * - GIAI ĐOẠN 2 (PENDING_APPROVAL):
 *     Cho phép thêm: history (Lịch sử)
 *     Tiếp tục khóa: transfer, feedback, payment, payment_history
 * 
 * - GIAI ĐOẠN 3 (ACTIVE_RESIDENT):
 *     Mở khóa toàn bộ tính năng!
 * 
 * @param {string} status - STUDENT_STATUS
 * @param {string} featureId - Mã tính năng / tab id
 * @returns {boolean}
 */
export function canAccessStudentFeature(status, featureId) {
  const id = String(featureId || "").toLowerCase().trim();

  // Các trang luôn mở ở cả 3 giai đoạn: Trang chủ, Tra cứu phòng, Đăng ký phòng, Thông tin cá nhân
  const ALWAYS_OPEN = [
    "dashboard",
    "home",
    "trang-chu",
    "lookup",
    "tra-cuu",
    "search-rooms",
    "register",
    "dang-ky",
    "register-room",
    "room-registration",
    "profile",
    "thong-tin-ca-nhan",
  ];
  if (ALWAYS_OPEN.includes(id)) {
    return true;
  }

  // Giai đoạn 3 (ACTIVE_RESIDENT): Mở khóa toàn bộ
  if (status === STUDENT_STATUS.ACTIVE_RESIDENT) {
    return true;
  }

  // Giai đoạn 2 (PENDING_APPROVAL): Mở khóa thêm tab Lịch sử (history)
  if (status === STUDENT_STATUS.PENDING_APPROVAL) {
    if (id === "history" || id === "lich-su") {
      return true;
    }
    // Các trang nội trú khác tiếp tục khóa
    return false;
  }

  // Giai đoạn 1 (NOT_REGISTERED / APPLICATION_CLOSED chưa có phòng): Khóa
  return false;
}

/**
 * Xác định trạng thái hiện tại của sinh viên theo 3 giai đoạn nghiệp vụ:
 * 1. ACTIVE_RESIDENT (Giai đoạn 3): Đang có phòng nội trú hợp lệ & hợp đồng ACTIVE
 * 2. PENDING_APPROVAL (Giai đoạn 2): Đã gửi đơn đăng ký, đang chờ BQL duyệt
 * 3. NOT_REGISTERED (Giai đoạn 1): Mới đăng nhập, chưa có đơn và chưa có phòng
 *
 * @param {string} [studentMsv]
 * @returns {Promise<{ status: string, stage: number, studentInfo: any, activeRoom: any, latestRequest: any, account: any }>}
 */
export async function resolveStudentStatus(studentMsv) {
  const code = (
    studentMsv ||
    localStorage.getItem("ktx_username") ||
    localStorage.getItem("ktx_email")?.split("@")[0] ||
    "dtc245180051"
  )
    .trim()
    .toLowerCase();

  // 1. Kiểm tra nguồn chân lý chuẩn hóa: studentAccountService
  const account = getStudentAccount(code);
  const residence = account?.currentResidence;

  // 1. GIAI ĐOẠN 3: Sinh viên đang có phòng hợp lệ và hợp đồng ACTIVE
  if (
    residence?.isActive === true &&
    residence?.contractStatus === "ACTIVE" &&
    residence?.roomNumber
  ) {
    const activeRoom = {
      so_phong: residence.roomNumber,
      phong: `P${residence.roomNumber}`,
      toa: residence.building || "Tòa A4",
      loai_phong: residence.roomType || "Phòng tiêu chuẩn",
      ngay_bat_dau: residence.startDate || "01/10/2026",
      ngay_ket_thuc: residence.endDate || "30/06/2027",
      trang_thai: "ACTIVE",
      trang_thai_label: "Đang ở",
      tang: String(residence.roomNumber).startsWith("5")
        ? 5
        : parseInt(residence.roomNumber) / 100 || 1,
    };
    return {
      status: STUDENT_STATUS.ACTIVE_RESIDENT,
      stage: 3,
      studentInfo: {
        msv: account.studentId || code,
        ho_ten: account.fullName || "Sinh viên",
        trang_thai_o: "DANG_O",
      },
      activeRoom,
      latestRequest: account.registrationHistory?.[0] || null,
      account,
    };
  }

  // Kiểm tra hợp đồng lưu trú từ backend API nếu có
  try {
    const contracts = await occupancyService.getMyContracts(code);
    if (Array.isArray(contracts)) {
      const activeContract = contracts.find(
        (c) =>
          c.trang_thai === "ACTIVE" ||
          c.trang_thai === "DANG_O" ||
          c.trang_thai === "HIEU_LUC" ||
          c.trang_thai_label?.includes("Đang ở"),
      );
      if (activeContract) {
        return {
          status: STUDENT_STATUS.ACTIVE_RESIDENT,
          stage: 3,
          studentInfo: { msv: code, trang_thai_o: "DANG_O" },
          activeRoom: getAssignedRoom(activeContract),
          latestRequest: account.registrationHistory?.[0] || null,
          account,
        };
      }
    }
  } catch (err) {
    console.warn("Lỗi kiểm tra backend contracts:", err);
  }

  // 2. GIAI ĐOẠN 2: Sinh viên đã nộp đơn đăng ký phòng thành công (CHỜ DUYỆT)
  // 2a. Tìm trong account.registrationHistory
  let pendingRequest = account?.registrationHistory?.find(
    (r) =>
      r.status === "PENDING" ||
      r.status === "CHO_DUYET" ||
      r.status === "Đang xét duyệt" ||
      r.status === "Chờ duyệt",
  );

  // 2b. Tìm trong localStorage ("dorm_registration_requests")
  if (!pendingRequest) {
    try {
      const rawReqs = localStorage.getItem("dorm_registration_requests");
      if (rawReqs) {
        const parsedReqs = JSON.parse(rawReqs);
        if (Array.isArray(parsedReqs)) {
          pendingRequest = parsedReqs.find((r) => {
            const rMsv = String(r.msv || "").trim().toLowerCase();
            const isMatch = !code || !rMsv || rMsv === code;
            const isPending =
              r.trang_thai === "PENDING" ||
              r.trang_thai === "CHO_DUYET" ||
              r.trang_thai_label?.includes("xét duyệt") ||
              r.trang_thai_label?.includes("Chờ duyệt");
            return isMatch && isPending;
          });
        }
      }
    } catch (_) {}
  }

  // 2c. Tìm trong backend requests
  if (!pendingRequest) {
    try {
      const backendReqs = await occupancyService.getMyRequests(code);
      if (Array.isArray(backendReqs)) {
        pendingRequest = backendReqs.find(
          (r) =>
            r.trang_thai === "PENDING" ||
            r.trang_thai === "CHO_DUYET" ||
            r.trang_thai_label?.includes("xét duyệt") ||
            r.trang_thai_label?.includes("Chờ duyệt"),
        );
      }
    } catch (_) {}
  }

  if (pendingRequest) {
    return {
      status: STUDENT_STATUS.PENDING_APPROVAL,
      stage: 2,
      studentInfo: {
        msv: account.studentId || code,
        ho_ten: account.fullName || "Sinh viên",
        trang_thai_o: "CHUA_XEP",
      },
      activeRoom: null,
      latestRequest: pendingRequest,
      account,
    };
  }

  // 3. Nếu hợp đồng đã kết thúc hoàn toàn (trả phòng) và không có đơn chờ duyệt
  if (
    account?.residenceHistory?.length > 0 &&
    account.residenceHistory.every((r) => r.status === "COMPLETED" || r.endDate)
  ) {
    return {
      status: STUDENT_STATUS.APPLICATION_CLOSED,
      stage: 1,
      studentInfo: {
        msv: account.studentId || code,
        ho_ten: account.fullName,
        trang_thai_o: "DA_TRA_PHONG",
      },
      activeRoom: null,
      latestRequest: account.registrationHistory?.[0] || null,
      account,
    };
  }

  // 4. GIAI ĐOẠN 1: Mặc định sinh viên mới chưa đăng ký phòng nào (request = null, room = null, contract = null)
  return {
    status: STUDENT_STATUS.NOT_REGISTERED,
    stage: 1,
    studentInfo: {
      msv: account.studentId || code,
      ho_ten: account.fullName || "Sinh viên",
      trang_thai_o: "CHUA_XEP",
    },
    activeRoom: null,
    latestRequest: null,
    account,
  };
}
