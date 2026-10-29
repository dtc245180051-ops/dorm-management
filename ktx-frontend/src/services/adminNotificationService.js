import occupancyService from "./occupancyService";
import { feedbackService } from "./feedbackService";

const ADMIN_NOTIFS_STORAGE_KEY = "ktx_admin_notifications_v5";

/**
 * Hàm phân tích ngày an toàn không trả về NaN đối với định dạng dd/mm/yyyy
 */
function parseSafeDate(str) {
  if (!str) return 0;
  if (typeof str === "number") return str;
  const s = String(str).trim();
  const dmyMatch = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/
  );
  if (dmyMatch) {
    const [, day, month, year, hour = 0, minute = 0, second = 0] = dmyMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    ).getTime();
  }
  const t = new Date(s).getTime();
  return isNaN(t) ? 0 : t;
}

/**
 * Service quản lý toàn bộ thông báo nghiệp vụ cho Quản lý KTX (Dorm Manager)
 * ĐỒNG BỘ 100% TỪ DỮ LIỆU THẬT CỦA HỆ THỐNG:
 * - Đơn đăng ký, chuyển, trả phòng từ occupancyService.getAllRequests()
 * - Sự cố kỹ thuật từ feedbackService.getAllIncidents()
 */
class AdminNotificationService {
  constructor() {
    this._listeners = [];
    this._isSyncing = false;
  }

  _getStoredList() {
    try {
      const raw = localStorage.getItem(ADMIN_NOTIFS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  _saveList(list) {
    try {
      const rawCurrent = localStorage.getItem(ADMIN_NOTIFS_STORAGE_KEY);
      const strNew = JSON.stringify(list);
      // Nếu dữ liệu không đổi, tuyệt đối không dispatch để tránh loop
      if (rawCurrent === strNew) {
        return;
      }
      localStorage.setItem(ADMIN_NOTIFS_STORAGE_KEY, strNew);
      window.dispatchEvent(new CustomEvent("admin-notifications-updated", { detail: list }));
    } catch (e) {
      console.warn("Lỗi lưu admin notifications:", e);
    }
  }

  /**
   * Đồng bộ 100% dữ liệu thật từ Backend API & Database
   */
  async syncFromSystem() {
    if (this._isSyncing) {
      return this.getNotifications();
    }
    this._isSyncing = true;

    try {
      const stored = this._getStoredList();
      const storedMap = new Map(stored.map((n) => [n.id, n]));
      const realNotifs = [];

      // 1. Quét dữ liệu thật từ occupancyService.getAllRequests()
      try {
        const allRequests = await occupancyService.getAllRequests();
        if (Array.isArray(allRequests)) {
          allRequests.forEach((req) => {
            const rawId = String(req.id || req.ma_yeu_cau || req.msv || "").replace(/^#/, "").trim();
            if (!rawId) return;

            const loaiDon = String(req.loai_don || req.loai_yeu_cau || "").toUpperCase();
            const isTransfer = loaiDon.includes("CHUYEN") || rawId.startsWith("YC") || rawId.startsWith("CP");
            const isCheckout = loaiDon.includes("TRA") || loaiDon.includes("CHECKOUT") || rawId.startsWith("TP");
            const isRegistration = !isTransfer && !isCheckout;

            const trangThai = String(req.trang_thai || "").toUpperCase();
            const isPending =
              trangThai === "CHO_DUYET" ||
              trangThai === "PENDING" ||
              trangThai === "CHO_XU_LY" ||
              trangThai === "DANG_XU_LY";
            const isApproved = trangThai === "APPROVED" || trangThai === "DA_DUYET";
            const isRejected = trangThai === "TU_CHOI" || trangThai === "REJECTED";

            let category = "ROOM_REGISTRATION";
            let notifTitle = `Đơn đăng ký phòng #${rawId}`;
            let preview = "";
            let deepUrl = `/admin/requests/registration/${encodeURIComponent(rawId)}`;

            if (isTransfer) {
              category = "ROOM_TRANSFER";
              notifTitle = `Yêu cầu chuyển phòng #${rawId}`;
              preview = `Sinh viên ${req.ho_ten || req.msv || "---"} (${req.msv}) xin chuyển từ ${req.phong_hien_tai || "phòng cũ"} sang ${req.phong_chuyen_den || req.nguyen_vong || "phòng mới"}. Lý do: ${req.ly_do || "Lý do cá nhân"}.`;
              deepUrl = `/admin/requests/transfer`;
            } else if (isCheckout) {
              category = "ROOM_CHECKOUT";
              notifTitle = `Yêu cầu trả phòng #${rawId}`;
              preview = `Sinh viên ${req.ho_ten || req.msv || "---"} (${req.msv}) xin trả phòng ${req.phong_hien_tai || "KTX"}. Ngày dự kiến: ${req.ngay_tra_du_kien || req.ngay_gui || "Hết kỳ"}. Lý do: ${req.ly_do || "Kết thúc khóa học"}.`;
              deepUrl = `/admin/requests/checkout`;
            } else {
              category = "ROOM_REGISTRATION";
              notifTitle = `Đơn đăng ký phòng mới #${rawId}`;
              preview = `Sinh viên ${req.ho_ten || req.msv || "---"} (${req.msv}) đăng ký phòng ${req.nguyen_vong || req.loai_phong || "tiêu chuẩn"}. Nguyện vọng: ${req.nguyen_vong_label || req.nguyen_vong || "Theo sắp xếp của ban quản lý"}.`;
              deepUrl = `/admin/requests/registration/${encodeURIComponent(rawId)}`;
            }

            let badgeColor = "indigo";
            if (category === "ROOM_TRANSFER") badgeColor = "cyan";
            if (category === "ROOM_CHECKOUT") badgeColor = "amber";

            const notifId = `NOTIF_REQ_${rawId}`;
            const existing = storedMap.get(notifId);

            const quickActions = [
              { actionKey: "VIEW_DETAIL", label: "Xem chi tiết", variant: "secondary" },
            ];

            realNotifs.push({
              id: notifId,
              recipientRole: "DORM_MANAGER",
              category,
              priority: isPending ? "HIGH" : "NORMAL",
              status: existing
                ? existing.status
                : isPending
                ? "ACTION_REQUIRED"
                : isApproved || isRejected
                ? "ACTION_RESOLVED"
                : "ARCHIVED",
              isRead: existing ? existing.isRead : !isPending,
              title: notifTitle,
              previewText: preview,
              avatarOrIcon: {
                type: "ICON",
                name: isTransfer ? "ArrowLeftRight" : isCheckout ? "LogOut" : "UserPlus",
                badgeColor,
              },
              metadata: {
                requestId: rawId,
                studentId: req.msv,
                studentName: req.ho_ten,
                roomCode: req.phong_hien_tai || req.phong_duoc_xep || req.nguyen_vong || "",
              },
              deepLink: {
                targetUrl: deepUrl,
                openMode: "NAVIGATE",
                entityId: rawId,
              },
              quickActions,
              createdAt: existing?.createdAt || req.ngay_gui || req.ngay_tao || "2026-10-26T12:00:00.000Z",
              resolvedAt: isApproved || isRejected ? (req.ngay_duyet || existing?.resolvedAt || new Date().toISOString()) : null,
            });
          });
        }
      } catch (e) {
        console.warn("Lỗi đồng bộ danh sách đơn thực tế cho admin:", e);
      }

      // 2. Quét sự cố thực tế từ feedbackService.getAllIncidents()
      try {
        const allIncidents = await feedbackService.getAllIncidents();
        if (Array.isArray(allIncidents)) {
          allIncidents.forEach((inc) => {
            const rawIncId = String(inc.id || inc.ma_phan_anh || "").replace(/^#/, "").trim();
            if (!rawIncId) return;

            const isResolved =
              inc.trang_thai === "DA_XU_LY" ||
              inc.trang_thai === "RESOLVED" ||
              inc.status === "RESOLVED";
            const isCritical =
              inc.muc_do === "KHAN_CAP" ||
              inc.muc_do === "CAO" ||
              inc.priority === "URGENT";

            const notifId = `NOTIF_INC_${rawIncId}`;
            const existing = storedMap.get(notifId);

            realNotifs.push({
              id: notifId,
              recipientRole: "DORM_MANAGER",
              category: "INCIDENT_REPORT",
              priority: isCritical ? "URGENT" : isResolved ? "NORMAL" : "HIGH",
              status: existing
                ? existing.status
                : !isResolved
                ? "ACTION_REQUIRED"
                : "ACTION_RESOLVED",
              isRead: existing ? existing.isRead : isResolved,
              title: isCritical
                ? `[Khẩn cấp] Sự cố: ${inc.tieu_de || inc.mo_ta || "Hỏng hóc CSVC"}`
                : `Báo cáo sự cố: ${inc.tieu_de || inc.mo_ta || "Sự cố phòng"}`,
              previewText: `Phòng ${inc.phong || "KTX"}: "${inc.mo_ta}". Người gửi: ${inc.ho_ten || inc.msv || "Sinh viên"}. Phân loại: ${inc.loai_phan_anh || inc.phan_loai || "CSVC"}.`,
              avatarOrIcon: {
                type: "ICON",
                name: "AlertTriangle",
                badgeColor: isCritical ? "rose" : "amber",
              },
              metadata: {
                incidentId: rawIncId,
                studentId: inc.msv,
                studentName: inc.ho_ten,
                roomCode: inc.phong,
                incidentSeverity: isCritical ? "CRITICAL" : "NORMAL",
              },
              deepLink: {
                targetUrl: `/admin/incidents`,
                openMode: "NAVIGATE",
                entityId: rawIncId,
              },
              quickActions: [
                { actionKey: "VIEW_DETAIL", label: "Xem chi tiết", variant: "secondary" },
              ],
              createdAt: existing?.createdAt || inc.ngay_gui || inc.ngay_tao || "2026-10-26T12:00:00.000Z",
              resolvedAt: isResolved ? (inc.ngay_xu_ly || existing?.resolvedAt || new Date().toISOString()) : null,
            });
          });
        }
      } catch (e) {
        console.warn("Lỗi đồng bộ sự cố thực tế cho admin:", e);
      }

      // 3. Quét giải trình vi phạm từ Backend API & localStorage
      try {
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
        const token =
          localStorage.getItem("ktx_token") ||
          localStorage.getItem("access_token") ||
          localStorage.getItem("token") ||
          "";
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const vioRes = await fetch(`${API_URL}/incidents/violations`, { headers });
        if (vioRes.ok) {
          const vios = await vioRes.json();
          if (Array.isArray(vios)) {
            vios.forEach((vio) => {
              const rawVioId = String(vio.ma_bb || vio.id || "").replace(/^#/, "").trim();
              if (!rawVioId) return;

              const localExp = localStorage.getItem(`ktx_violation_explanation_${rawVioId}`);
              const localExpAt = localStorage.getItem(`ktx_violation_explanation_at_${rawVioId}`);
              const explanationText = (vio.giai_trinh || localExp || "").trim();
              if (!explanationText) return;

              const isResolved =
                vio.sub_status === "DA_XU_LY_DUT_DIEM" ||
                vio.trang_thai === "DA_XU_LY";

              const notifId = `NOTIF_VIO_EXP_${rawVioId}`;
              const existing = storedMap.get(notifId);

              realNotifs.push({
                id: notifId,
                recipientRole: "DORM_MANAGER",
                category: "VIOLATION_EXPLANATION",
                priority: isResolved ? "NORMAL" : "HIGH",
                status: existing
                  ? existing.status
                  : !isResolved
                  ? "ACTION_REQUIRED"
                  : "ACTION_RESOLVED",
                isRead: existing ? existing.isRead : false,
                title: `Sinh viên nộp giải trình: #${rawVioId}`,
                previewText: `Sinh viên ${vio.ho_ten || vio.msv} (${vio.msv}) đã gửi giải trình: "${explanationText}".`,
                avatarOrIcon: {
                  type: "ICON",
                  name: "Scale",
                  badgeColor: "amber",
                },
                metadata: {
                  violationId: rawVioId,
                  studentId: vio.msv,
                  studentName: vio.ho_ten,
                  roomCode: vio.phong,
                  explanation: explanationText,
                  explanationAt: vio.giai_trinh_at || localExpAt,
                },
                deepLink: {
                  targetUrl: `/admin?tab=violations&id=${encodeURIComponent(rawVioId)}`,
                  openMode: "NAVIGATE",
                  entityId: rawVioId,
                },
                quickActions: [
                  { actionKey: "VIEW_DETAIL", label: "Xem biên bản", variant: "secondary" },
                ],
                createdAt: existing?.createdAt || vio.giai_trinh_at || localExpAt || new Date().toISOString(),
                resolvedAt: isResolved ? (existing?.resolvedAt || new Date().toISOString()) : null,
              });
            });
          }
        }
      } catch (e) {
        console.warn("Lỗi đồng bộ giải trình vi phạm cho admin:", e);
      }

      // Sắp xếp ổn định (Stable Sort): Ưu tiên URGENT lên đầu, sau đó ACTION_REQUIRED, rồi thời gian giảm dần
      realNotifs.sort((a, b) => {
        if (a.priority === "URGENT" && b.priority !== "URGENT") return -1;
        if (b.priority === "URGENT" && a.priority !== "URGENT") return 1;
        if (a.status === "ACTION_REQUIRED" && b.status !== "ACTION_REQUIRED") return -1;
        if (b.status === "ACTION_REQUIRED" && a.status !== "ACTION_REQUIRED") return 1;
        const diff = parseSafeDate(b.createdAt) - parseSafeDate(a.createdAt);
        if (diff !== 0) return diff;
        return String(a.id).localeCompare(String(b.id));
      });

      this._saveList(realNotifs);
      return realNotifs;
    } finally {
      this._isSyncing = false;
    }
  }

  getNotifications() {
    return this._getStoredList();
  }

  getUnreadCount() {
    return this._getStoredList().filter((n) => !n.isRead).length;
  }

  getActionRequiredCount() {
    return this._getStoredList().filter((n) => n.status === "ACTION_REQUIRED").length;
  }

  markAsRead(id) {
    const list = this._getStoredList().map((n) =>
      n.id === id ? { ...n, isRead: true } : n
    );
    this._saveList(list);
  }

  markAllAsRead() {
    const list = this._getStoredList().map((n) => ({ ...n, isRead: true }));
    this._saveList(list);
  }

  resolveNotification(id) {
    const list = this._getStoredList().map((n) =>
      n.id === id ? { ...n, status: "ACTION_RESOLVED", isRead: true } : n
    );
    this._saveList(list);
  }

  deleteNotification(id) {
    const list = this._getStoredList().filter((n) => n.id !== id);
    this._saveList(list);
  }
}

export const adminNotificationService = new AdminNotificationService();
export default adminNotificationService;
