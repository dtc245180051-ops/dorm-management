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
    ma_giuong:
      record.ma_giuong ||
      record.goi_y?.ma_giuong ||
      roomDetails.ma_giuong ||
      roomObject.ma_giuong ||
      "G01",
    so_giuong:
      record.so_giuong ||
      record.goi_y?.so_giuong ||
      roomDetails.so_giuong ||
      roomObject.so_giuong ||
      "G01",
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
 * Xác định trạng thái hiện tại của sinh viên
 * @param {string} [studentMsv]
 * @returns {Promise<{ status: string, studentInfo: any, activeRoom: any, latestRequest: any, account: any }>}
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
  const residence = account.currentResidence;

  // Nếu hợp đồng đã bị kết thúc / hết hạn: KHÔNG BAO GIỜ hiển thị ACTIVE_RESIDENT
  if (residence?.contractStatus === "EXPIRED" || residence?.isActive === false) {
    return {
      status: STUDENT_STATUS.APPLICATION_CLOSED,
      studentInfo: {
        msv: account.studentId,
        ho_ten: account.fullName,
        trang_thai_o: "DA_TRA_PHONG",
      },
      activeRoom: null,
      latestRequest: account.registrationHistory[0] || null,
      account,
    };
  }

  // Nếu sinh viên đang có phòng hợp lệ và hợp đồng ACTIVE: là cư dân đang ở chính thức
  if (residence?.isActive === true && residence?.contractStatus === "ACTIVE") {
    const activeRoom = {
      so_phong: residence.roomNumber,
      phong: `P${residence.roomNumber}`,
      toa: residence.building,
      loai_phong: residence.roomType,
      ngay_bat_dau: residence.startDate,
      ngay_ket_thuc: residence.endDate,
      trang_thai: "ACTIVE",
      trang_thai_label: "Đang ở",
      tang: String(residence.roomNumber).startsWith("5") ? 5 : (parseInt(residence.roomNumber) / 100 || 1),
    };
    return {
      status: STUDENT_STATUS.ACTIVE_RESIDENT,
      studentInfo: {
        msv: account.studentId,
        ho_ten: account.fullName,
        trang_thai_o: "DANG_O",
      },
      activeRoom,
      latestRequest: account.registrationHistory[0] || null,
      account,
    };
  }

  // 2. Kiểm tra hợp đồng lưu trú từ backend API nếu có
  try {
    const contracts = await occupancyService.getMyContracts(code);
    if (Array.isArray(contracts)) {
      const activeContract = contracts.find(
        (c) =>
          c.trang_thai === "ACTIVE" ||
          c.trang_thai === "DANG_O" ||
          c.trang_thai === "HIEU_LUC" ||
          c.trang_thai_label?.includes("Đang ở")
      );
      if (activeContract) {
        return {
          status: STUDENT_STATUS.ACTIVE_RESIDENT,
          studentInfo: { msv: code, trang_thai_o: "DANG_O" },
          activeRoom: getAssignedRoom(activeContract),
          latestRequest: null,
          account,
        };
      }
    }
  } catch (err) {
    console.warn("Lỗi kiểm tra backend contracts:", err);
  }

  // 3. Kiểm tra đơn đăng ký đang chờ duyệt
  const hasPending = account.registrationHistory?.some(
    (r) => r.status === "PENDING" || r.status === "CHO_DUYET"
  );
  if (hasPending) {
    return {
      status: STUDENT_STATUS.PENDING_APPROVAL,
      studentInfo: { msv: code, trang_thai_o: "CHUA_XEP" },
      activeRoom: null,
      latestRequest: account.registrationHistory[0] || null,
      account,
    };
  }

  // 4. Mặc định: Chưa đăng ký
  return {
    status: STUDENT_STATUS.NOT_REGISTERED,
    studentInfo: { msv: code, trang_thai_o: "CHUA_XEP" },
    activeRoom: null,
    latestRequest: null,
    account,
  };
}
