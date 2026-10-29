import { useState, useEffect, useCallback } from "react";
import {
  resolveStudentStatus,
  STUDENT_STATUS,
  canAccessStudentFeature,
  getStudentStage,
} from "../services/studentStatusService";
import { getStudentAccount } from "../services/studentAccountService";

// Module-level cache để giữ trạng thái liên tục giữa các lần chuyển trang (không bị giật nhấp nháy lock icon)
let cachedStudentStatusState = null;

/**
 * Trích xuất an toàn mã sinh viên từ tham số (chuỗi msv hoặc object user)
 * Hỗ trợ đăng nhập thông thường lẫn Google OAuth 2.0
 */
export function extractStudentCode(studentInput) {
  let raw = "";

  if (typeof studentInput === "string") {
    raw = studentInput;
  } else if (studentInput && typeof studentInput === "object") {
    raw =
      studentInput.code ||
      studentInput.student_code ||
      studentInput.studentCode ||
      studentInput.student_id ||
      studentInput.studentId ||
      studentInput.msv ||
      studentInput.username ||
      studentInput.user_name ||
      studentInput.email?.split?.("@")?.[0] ||
      studentInput.nguoi_dung?.sinh_vien?.msv ||
      studentInput.user?.code ||
      studentInput.user?.student_code ||
      studentInput.user?.studentCode ||
      studentInput.user?.student_id ||
      studentInput.user?.studentId ||
      studentInput.user?.msv ||
      studentInput.user?.email?.split?.("@")?.[0] ||
      "";
  }

  if (!raw) {
    try {
      raw =
        localStorage.getItem("ktx_msv") ||
        localStorage.getItem("ktx_student_msv") ||
        localStorage.getItem("ktx_username") ||
        localStorage.getItem("user_name") ||
        localStorage.getItem("ktx_email")?.split?.("@")?.[0] ||
        "";
    } catch (_) {
      raw = "";
    }
  }

  return (typeof raw === "string" ? raw : "").trim().toLowerCase();
}

function getInitialStudentStatus(studentMsv) {
  if (cachedStudentStatusState) {
    return cachedStudentStatusState;
  }

  // Khắc phục biến code chưa định nghĩa ngoài khối try-catch:
  // Lấy mã sinh viên an toàn với fallback chuỗi rỗng
  const code = extractStudentCode(studentMsv) || "";

  try {
    // 1. Kiểm tra sessionStorage
    const sessionCached = sessionStorage.getItem("ktx_cached_student_status");
    if (sessionCached) {
      const parsed = JSON.parse(sessionCached);
      if (parsed && parsed.status) {
        cachedStudentStatusState = parsed;
        return parsed;
      }
    }

    // 2. Kiểm tra nhanh localStorage phòng hiện tại hoặc tài khoản sinh viên
    const cachedRoom = localStorage.getItem("dorm_current_room_info");
    if (cachedRoom) {
      const parsedRoom = JSON.parse(cachedRoom);
      if (parsedRoom && parsedRoom.so_phong) {
        const initial = {
          status: STUDENT_STATUS.ACTIVE_RESIDENT,
          stage: 3,
          studentInfo: { msv: code, trang_thai_o: "DANG_O" },
          activeRoom: parsedRoom,
          latestRequest: null,
          account: getStudentAccount(code),
          loading: false,
        };
        cachedStudentStatusState = initial;
        return initial;
      }
    }

    const account = getStudentAccount(code);
    if (account?.currentResidence?.isActive && account?.currentResidence?.roomNumber) {
      const initial = {
        status: STUDENT_STATUS.ACTIVE_RESIDENT,
        stage: 3,
        studentInfo: { msv: code, trang_thai_o: "DANG_O" },
        activeRoom: account.currentResidence,
        latestRequest: account.registrationHistory?.[0] || null,
        account,
        loading: false,
      };
      cachedStudentStatusState = initial;
      return initial;
    }
  } catch (_) {}

  return {
    status: STUDENT_STATUS.NOT_REGISTERED,
    stage: 1,
    studentInfo: { msv: code, trang_thai_o: "CHUA_XEP" },
    activeRoom: null,
    latestRequest: null,
    account: null,
    loading: false,
  };
}

/**
 * Hook useStudentStatus
 * Cung cấp trạng thái vòng đời sinh viên (3 Giai đoạn) và hàm kiểm tra quyền truy cập tính năng (Feature Gating)
 */
export function useStudentStatus(studentMsv) {
  const [state, setState] = useState(() => getInitialStudentStatus(studentMsv));

  const checkStatus = useCallback(async () => {
    try {
      const code = extractStudentCode(studentMsv) || "";

      const res = await resolveStudentStatus(code);
      const newState = {
        status: res?.status || STUDENT_STATUS.NOT_REGISTERED,
        stage: res?.stage || getStudentStage(res?.status || STUDENT_STATUS.NOT_REGISTERED),
        studentInfo: res?.studentInfo || { msv: code, trang_thai_o: "CHUA_XEP" },
        activeRoom: res?.activeRoom || null,
        latestRequest: res?.latestRequest || null,
        account: res?.account || getStudentAccount(code),
        loading: false,
      };

      cachedStudentStatusState = newState;
      try {
        sessionStorage.setItem("ktx_cached_student_status", JSON.stringify(newState));
      } catch (_) {}

      setState(newState);
    } catch (e) {
      console.warn("Lỗi cập nhật useStudentStatus:", e);
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [studentMsv]);

  useEffect(() => {
    checkStatus();

    const handleUpdate = () => {
      checkStatus();
    };

    window.addEventListener("occupancy-updated", handleUpdate);
    window.addEventListener("student-account-updated", handleUpdate);
    window.addEventListener("student-status-changed", handleUpdate);
    window.addEventListener("ktx-payment-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("occupancy-updated", handleUpdate);
      window.removeEventListener("student-account-updated", handleUpdate);
      window.removeEventListener("student-status-changed", handleUpdate);
      window.removeEventListener("ktx-payment-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [checkStatus]);

  const canAccess = useCallback(
    (featureId) => {
      return canAccessStudentFeature(state.status, featureId);
    },
    [state.status]
  );

  return {
    ...state,
    canAccess,
    refresh: checkStatus,
    isStage1: state.stage === 1,
    isStage2: state.stage === 2,
    isStage3: state.stage === 3,
    hasActiveRoom: state.stage === 3,
    hasPendingRequest: state.stage === 2,
  };
}

export default useStudentStatus;
