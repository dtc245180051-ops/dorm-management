import occupancyService from "./occupancyService";
import { API_BASE_URL } from "./authService";

/**
 * Trạng thái sinh viên trong hệ thống KTX:
 * - NOT_REGISTERED: Mới tạo tài khoản/đăng nhập, chưa gửi bất kỳ đơn đăng ký ở nào.
 * - PENDING_APPROVAL: Đã nộp đơn đăng ký phòng thành công, đang chờ BQL duyệt / AI xếp phòng.
 * - ACTIVE_RESIDENT: Đơn đã được duyệt VÀ sinh viên đã được xếp phòng chính thức (đang ở).
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
      roomObject.loai_phong,
    ma_giuong:
      record.ma_giuong ||
      record.goi_y?.ma_giuong ||
      roomDetails.ma_giuong ||
      roomObject.ma_giuong,
    so_giuong:
      record.so_giuong ||
      record.goi_y?.so_giuong ||
      roomDetails.so_giuong ||
      roomObject.so_giuong,
    tang:
      record.so_tang ||
      record.tang ||
      roomDetails.so_tang ||
      roomDetails.tang ||
      roomObject.tang,
    toa:
      record.toa_hien_tai ||
      record.toa_nha ||
      record.toa ||
      record.ma_toa ||
      record.goi_y?.ma_toa ||
      roomDetails.ten_toa ||
      roomDetails.toa_nha ||
      roomDetails.ma_toa ||
      roomObject.toa,
  };
};

/**
 * Xác định trạng thái hiện tại của sinh viên
 * @param {string} [studentMsv]
 * @returns {Promise<{ status: string, studentInfo: any, activeRoom: any, latestRequest: any }>}
 */
export async function resolveStudentStatus(studentMsv) {
  const token =
    localStorage.getItem("ktx_token") ||
    localStorage.getItem("access_token") ||
    "";

  const code = (
    studentMsv ||
    localStorage.getItem("ktx_username") ||
    localStorage.getItem("ktx_email")?.split("@")[0] ||
    ""
  )
    .trim()
    .toUpperCase();

  let backendStudent = null;

  // 1. Kiểm tra trạng thái nội trú từ Backend API (nếu có token)
  if (token && code) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/students/${encodeURIComponent(code)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        backendStudent = await response.json();
        const activeRoom = getAssignedRoom(backendStudent);
        if (backendStudent.trang_thai_o === "DANG_O" && activeRoom) {
          return {
            status: STUDENT_STATUS.ACTIVE_RESIDENT,
            studentInfo: backendStudent,
            activeRoom,
            latestRequest: null,
          };
        }
      }
    } catch (e) {
      // Backend offline fallback
    }
  }

  // 2. Kiểm tra hợp đồng lưu trú (stay contracts)
  try {
    const contracts = await occupancyService.getMyContracts(code);
    const activeContract = Array.isArray(contracts)
      ? contracts.find(
          (c) =>
            (c.trang_thai === "DANG_O" ||
              c.trang_thai === "HIEU_LUC" ||
              c.trang_thai_label?.includes("Đang ở")) &&
            getAssignedRoom(c),
        )
      : null;

    if (activeContract) {
      return {
        status: STUDENT_STATUS.ACTIVE_RESIDENT,
        studentInfo: backendStudent,
        activeRoom: {
          ...activeContract,
          ...getAssignedRoom(activeContract),
        },
        latestRequest: null,
      };
    }
  } catch (err) {
    console.warn("Lỗi kiểm tra contracts khi phân giải trạng thái:", err);
  }

  // 3. Kiểm tra đơn đăng ký phòng (registration requests)
  try {
    const requests = await occupancyService.getMyRequests(code);
    const myRequests = Array.isArray(requests)
      ? requests.filter((r) => {
          const rMsv = (r.msv || "").trim().toUpperCase();
          return !code || !rMsv || rMsv === code;
        })
      : [];

    if (myRequests.length > 0) {
      // Đơn đã duyệt VÀ đã có phòng gán cụ thể
      const approvedWithRoom = myRequests.find(
        (r) =>
          (["DA_DUYET", "APPROVED"].includes(
            String(r.trang_thai || "").toUpperCase(),
          ) || r.trang_thai_label?.includes("Đã duyệt")) &&
          getAssignedRoom(r),
      );

      if (approvedWithRoom) {
        return {
          status: STUDENT_STATUS.ACTIVE_RESIDENT,
          studentInfo: backendStudent,
          activeRoom: getAssignedRoom(approvedWithRoom),
          latestRequest: approvedWithRoom,
        };
      }

      // Đơn đang chờ xét duyệt hoặc đã nộp
      const pendingReq = myRequests.find(
        (r) =>
          ["CHO_DUYET", "PENDING"].includes(
            String(r.trang_thai || "").toUpperCase(),
          ) ||
          r.trang_thai_label?.includes("xét duyệt") ||
          r.trang_thai_label?.includes("Chờ duyệt") ||
          ["DA_DUYET", "APPROVED"].includes(
            String(r.trang_thai || "").toUpperCase(),
          ),
      );

      if (pendingReq) {
        return {
          status: STUDENT_STATUS.PENDING_APPROVAL,
          studentInfo: backendStudent,
          activeRoom: null,
          latestRequest: pendingReq || myRequests[0],
        };
      }

      return {
        status: STUDENT_STATUS.APPLICATION_CLOSED,
        studentInfo: backendStudent,
        activeRoom: null,
        latestRequest: myRequests[0],
      };
    }
  } catch (err) {
    console.warn("Lỗi kiểm tra requests khi phân giải trạng thái:", err);
  }

  // 4. Mặc định: Chưa gửi đơn nào
  return {
    status: STUDENT_STATUS.NOT_REGISTERED,
    studentInfo: backendStudent,
    activeRoom: null,
    latestRequest: null,
  };
}
