import { useState, useEffect, useCallback } from "react";
import {
  resolveStudentStatus,
  STUDENT_STATUS,
  canAccessStudentFeature,
  getStudentStage,
} from "../services/studentStatusService";
import { getStudentAccount } from "../services/studentAccountService";

/**
 * Hook useStudentStatus
 * Cung cấp trạng thái vòng đời sinh viên (3 Giai đoạn) và hàm kiểm tra quyền truy cập tính năng (Feature Gating)
 *
 * Giai đoạn 1: Sinh viên mới (Chưa có đơn request = null, chưa có phòng room = null, contract = null)
 *   -> status: NOT_REGISTERED, stage: 1
 *   -> Cho phép: dashboard, lookup, register, profile
 *   -> Khóa: transfer, history, feedback, payment, payment_history
 *
 * Giai đoạn 2: Sinh viên đã gửi đơn thành công (Chờ duyệt)
 *   -> status: PENDING_APPROVAL, stage: 2
 *   -> Mở khóa thêm: history (Lịch sử: Đăng ký xem đơn PENDING, Ở báo chưa có)
 *   -> Tiếp tục khóa: transfer, feedback, payment, payment_history
 *
 * Giai đoạn 3: Admin duyệt đơn và chỉ định phòng
 *   -> status: ACTIVE_RESIDENT, stage: 3
 *   -> Mở khóa TOÀN BỘ các trang!
 */
export function useStudentStatus(studentMsv) {
  const [state, setState] = useState({
    status: STUDENT_STATUS.NOT_REGISTERED,
    stage: 1,
    studentInfo: null,
    activeRoom: null,
    latestRequest: null,
    account: null,
    loading: true,
  });

  const checkStatus = useCallback(async () => {
    try {
      const code = (
        studentMsv ||
        localStorage.getItem("ktx_username") ||
        localStorage.getItem("ktx_email")?.split("@")[0] ||
        ""
      )
        .trim()
        .toLowerCase();

      const res = await resolveStudentStatus(code);
      setState({
        status: res.status,
        stage: res.stage || getStudentStage(res.status),
        studentInfo: res.studentInfo,
        activeRoom: res.activeRoom,
        latestRequest: res.latestRequest,
        account: res.account || getStudentAccount(code),
        loading: false,
      });
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
    window.addEventListener("ktx-payment-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("occupancy-updated", handleUpdate);
      window.removeEventListener("student-account-updated", handleUpdate);
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
