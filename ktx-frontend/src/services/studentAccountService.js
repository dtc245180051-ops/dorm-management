/**
 * Service quản lý Hồ sơ tài khoản sinh viên chuẩn hóa dùng chung (Global State / localStorage)
 * Đảm bảo đồng bộ 100% giữa Ban Quản lý (Admin) và Sinh viên.
 */

const STORAGE_KEY = "ktx_student_account";

export const DEFAULT_STUDENT_ACCOUNT = {
  studentId: "dtc245180051",
  fullName: "Nguyễn Thị Ánh",
  currentResidence: {
    isActive: true, // false nếu chưa có phòng hoặc hợp đồng đã kết thúc
    building: "Tòa A4",
    roomNumber: "501",
    roomType: "Phòng tiêu chuẩn",
    contractStatus: "ACTIVE", // "ACTIVE" (Đang hiệu lực), "EXPIRED" (Đã kết thúc)
    startDate: "01/10/2026",
    endDate: "30/06/2027",
  },
  registrationHistory: [
    {
      id: "REG-01",
      date: "01/10/2026",
      roomType: "Phòng tiêu chuẩn",
      status: "APPROVED",
      assignedRoom: "501 - Tòa A4",
    },
  ],
  residenceHistory: [
    {
      id: "RES-01",
      building: "Tòa A4",
      roomNumber: "501",
      roomType: "Phòng tiêu chuẩn",
      startDate: "01/10/2026",
      endDate: null, // null biểu thị đang ở
      status: "ACTIVE", // Chuyển thành "COMPLETED" khi kết thúc hợp đồng
    },
  ],
  bills: [
    {
      id: "BILL-10-2026",
      title: "Tiền phòng & Dịch vụ KTX Tháng 10/2026",
      amount: 400000,
      status: "UNPAID",
      dueDate: "15/10/2026",
    },
  ],
};

/**
 * Lấy hồ sơ tài khoản sinh viên hiện tại theo schema chuẩn
 * @param {string} [studentId]
 */
export function getStudentAccount(studentId) {
  const currentId = (
    studentId ||
    localStorage.getItem("ktx_username") ||
    "dtc245180051"
  )
    .trim()
    .toLowerCase();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const accId = String(parsed.studentId || "").trim().toLowerCase();
        if (!currentId || accId === currentId || currentId.includes("dtc245180051") || accId.includes("dtc245180051")) {
          return normalizeAccount(parsed);
        }
      }
    }
  } catch (e) {
    console.error("Lỗi đọc tài khoản sinh viên từ localStorage:", e);
  }

  // Khởi tạo mặc định nếu chưa có
  const defaultAcc = {
    ...DEFAULT_STUDENT_ACCOUNT,
    studentId: currentId || DEFAULT_STUDENT_ACCOUNT.studentId,
    fullName: localStorage.getItem("ktx_fullname") || DEFAULT_STUDENT_ACCOUNT.fullName,
  };
  saveStudentAccount(defaultAcc);
  return defaultAcc;
}

/**
 * Chuẩn hóa object tài khoản đảm bảo đúng 100% schema và không thiếu trường
 */
function normalizeAccount(acc) {
  const normalized = {
    studentId: String(acc.studentId || "dtc245180051").toLowerCase(),
    fullName: acc.fullName || "Nguyễn Thị Ánh",
    currentResidence: {
      isActive: Boolean(acc.currentResidence?.isActive),
      building: acc.currentResidence?.building || "Tòa A4",
      roomNumber: acc.currentResidence?.roomNumber || "501",
      roomType: acc.currentResidence?.roomType || "Phòng tiêu chuẩn",
      contractStatus: acc.currentResidence?.contractStatus || (acc.currentResidence?.isActive ? "ACTIVE" : "EXPIRED"),
      startDate: acc.currentResidence?.startDate || "01/10/2026",
      endDate: acc.currentResidence?.endDate || "30/06/2027",
    },
    registrationHistory: Array.isArray(acc.registrationHistory) ? acc.registrationHistory : [],
    residenceHistory: Array.isArray(acc.residenceHistory) ? acc.residenceHistory : [],
    bills: Array.isArray(acc.bills) ? acc.bills : [],
  };

  // Đảm bảo có ít nhất 1 khoản phí mẫu nếu bills trống
  if (normalized.bills.length === 0) {
    normalized.bills = [...DEFAULT_STUDENT_ACCOUNT.bills];
  }

  return normalized;
}

/**
 * Lưu hồ sơ tài khoản sinh viên và phát sự kiện đồng bộ
 * @param {object} account
 */
export function saveStudentAccount(account) {
  try {
    const normalized = normalizeAccount(account);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));

    // Đồng bộ các key phụ trợ truyền thống
    if (normalized.studentId) {
      localStorage.setItem("ktx_username", normalized.studentId);
    }
    if (normalized.fullName) {
      localStorage.setItem("ktx_fullname", normalized.fullName);
    }
    if (normalized.currentResidence?.isActive) {
      localStorage.setItem(
        "ktx_room",
        `${normalized.currentResidence.roomNumber} - ${normalized.currentResidence.building}`
      );
    } else {
      localStorage.removeItem("ktx_room");
    }

    // Phát sự kiện toàn cục để tất cả các tab / component cập nhật tức thì
    window.dispatchEvent(new CustomEvent("student-account-updated", { detail: normalized }));
    window.dispatchEvent(new Event("occupancy-updated"));
    window.dispatchEvent(new Event("ktx-payment-updated"));
    window.dispatchEvent(new Event("storage"));
    return normalized;
  } catch (e) {
    console.error("Lỗi lưu tài khoản sinh viên vào localStorage:", e);
    return account;
  }
}

/**
 * Admin phê duyệt & xếp phòng cho sinh viên
 * Cập nhật:
 * - currentResidence.isActive = true, contractStatus = "ACTIVE"
 * - Thêm / cập nhật registrationHistory sang APPROVED
 * - Thêm / cập nhật residenceHistory sang ACTIVE (endDate: null)
 */
export function approveStudentRoom(studentId, roomData = {}) {
  const account = getStudentAccount(studentId);
  const building = roomData.building || roomData.toa || "Tòa A4";
  const roomNumber = String(roomData.roomNumber || roomData.so_phong || "501").replace(/^P/i, "");
  const roomType = roomData.roomType || roomData.loai_phong || "Phòng tiêu chuẩn";
  const startDate = roomData.startDate || "01/10/2026";
  const endDate = roomData.endDate || "30/06/2027";
  const assignedRoom = `${roomNumber} - ${building}`;

  // 1. Cập nhật nơi lưu trú hiện tại
  account.currentResidence = {
    isActive: true,
    building,
    roomNumber,
    roomType,
    contractStatus: "ACTIVE",
    startDate,
    endDate,
  };

  // 2. Cập nhật lịch sử đăng ký
  const existingRegIndex = account.registrationHistory.findIndex(
    (r) => r.id === roomData.requestId || r.status === "PENDING"
  );
  const regEntry = {
    id: roomData.requestId || (existingRegIndex >= 0 ? account.registrationHistory[existingRegIndex].id : `REG-${String(account.registrationHistory.length + 1).padStart(2, "0")}`),
    date: roomData.date || "01/10/2026",
    roomType,
    status: "APPROVED",
    assignedRoom,
  };
  if (existingRegIndex >= 0) {
    account.registrationHistory[existingRegIndex] = {
      ...account.registrationHistory[existingRegIndex],
      ...regEntry,
    };
  } else {
    account.registrationHistory.unshift(regEntry);
  }

  // 3. Cập nhật lịch sử ở
  const existingResIndex = account.residenceHistory.findIndex(
    (r) => r.building === building && r.roomNumber === roomNumber && r.status === "ACTIVE"
  );
  if (existingResIndex === -1) {
    // Đóng tất cả các lịch sử đang ở cũ nếu có
    account.residenceHistory.forEach((r) => {
      if (r.status === "ACTIVE") {
        r.status = "COMPLETED";
        r.endDate = startDate;
      }
    });

    account.residenceHistory.unshift({
      id: `RES-${String(account.residenceHistory.length + 1).padStart(2, "0")}`,
      building,
      roomNumber,
      roomType,
      startDate,
      endDate: null,
      status: "ACTIVE",
    });
  }

  // 4. Đảm bảo có khoản tiền phòng phát sinh
  if (!account.bills.some((b) => b.id === "BILL-10-2026")) {
    account.bills.unshift({
      id: "BILL-10-2026",
      title: "Tiền phòng & Dịch vụ KTX Tháng 10/2026",
      amount: 400000,
      status: "UNPAID",
      dueDate: "15/10/2026",
    });
  }

  return saveStudentAccount(account);
}

/**
 * Admin kết thúc hợp đồng lưu trú của sinh viên
 * Cập nhật:
 * - currentResidence.isActive = false, contractStatus = "EXPIRED"
 * - Chuyển residenceHistory từ "ACTIVE" sang "COMPLETED" với endDate = ngày hôm nay
 */
export function terminateStudentContract(studentId, termData = {}) {
  const account = getStudentAccount(studentId);
  const now = new Date();
  const todayStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;

  // 1. Chuyển trạng thái lưu trú sang EXPIRED
  account.currentResidence = {
    ...account.currentResidence,
    isActive: false,
    contractStatus: "EXPIRED",
    endDate: termData.endDate || todayStr,
  };

  // 2. Chuyển bản ghi lịch sử ở đang ACTIVE sang COMPLETED
  let hasActive = false;
  account.residenceHistory = account.residenceHistory.map((res) => {
    if (res.status === "ACTIVE") {
      hasActive = true;
      return {
        ...res,
        endDate: termData.endDate || todayStr,
        status: "COMPLETED",
      };
    }
    return res;
  });

  if (!hasActive && account.residenceHistory.length > 0) {
    account.residenceHistory[0].status = "COMPLETED";
    if (!account.residenceHistory[0].endDate) {
      account.residenceHistory[0].endDate = todayStr;
    }
  }

  return saveStudentAccount(account);
}

/**
 * Sinh viên thanh toán hóa đơn
 */
export function payStudentBill(studentId, billId) {
  const account = getStudentAccount(studentId);
  account.bills = account.bills.map((bill) => {
    if (bill.id === billId || !billId) {
      return { ...bill, status: "PAID" };
    }
    return bill;
  });
  return saveStudentAccount(account);
}

export default {
  getStudentAccount,
  saveStudentAccount,
  approveStudentRoom,
  terminateStudentContract,
  payStudentBill,
};
