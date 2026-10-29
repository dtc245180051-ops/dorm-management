import occupancyService from "./occupancyService";
import { invoiceService } from "./invoiceService";
import { reconciliationService } from "./reconciliationService";

const ACCOUNTANT_NOTIFS_STORAGE_KEY = "ktx_accountant_notifications_v5";

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
 * Service quản lý thông báo nghiệp vụ chuyên sâu cho Kế toán (Accountant)
 * ĐỒNG BỘ 100% TỪ DỮ LIỆU THẬT:
 * 1. Hóa đơn thật từ invoiceService.getInvoices()
 * 2. Giao dịch ngân hàng thật từ reconciliationService.getReconciliations()
 * 3. Đơn xếp phòng thật từ occupancyService.getAllRequests()
 * 4. Các khoản phí sinh viên vừa xác nhận chuyển khoản chờ đối soát
 */
class AccountantNotificationService {
  constructor() {
    this._listeners = [];
    this._isSyncing = false;
  }

  _purgeMockAndStaleKeys() {
    try {
      // 1. Dọn dẹp cache đối soát cũ nếu chứa 2 giao dịch mẫu hoặc trạng thái upload cũ
      const reconCache = localStorage.getItem("reconciliation_cache_data");
      if (reconCache && (reconCache.includes("FT2625501977") || reconCache.includes("FT2625501980"))) {
        localStorage.removeItem("reconciliation_cache_data");
      }
      const stmUpload = localStorage.getItem("ktx_statement_upload") || sessionStorage.getItem("ktx_statement_upload");
      if (stmUpload && (stmUpload.includes("FT2625501977") || stmUpload.includes("FT2625501980"))) {
        localStorage.removeItem("ktx_statement_upload");
        sessionStorage.removeItem("ktx_statement_upload");
      }
      // 2. Dọn dẹp key thông báo kế toán cũ
      const legacyKey = localStorage.getItem("ktx_accountant_notifications");
      if (legacyKey && (legacyKey.includes("FT2625501977") || legacyKey.includes("FT2625501980") || legacyKey.includes("350.000"))) {
        localStorage.removeItem("ktx_accountant_notifications");
      }
    } catch (_) {}
  }

  _getStoredList() {
    try {
      this._purgeMockAndStaleKeys();
      const raw = localStorage.getItem(ACCOUNTANT_NOTIFS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Lọc sạch bất kỳ thông báo mock hay giao dịch mẫu tồn đọng
      const cleaned = parsed.filter((n) => {
        const id = String(n.id || "");
        const title = String(n.title || "");
        const preview = String(n.previewText || "");
        const createdAt = String(n.createdAt || "");
        if (
          id.includes("FT2625501977") ||
          id.includes("FT2625501980") ||
          title.includes("FT2625501977") ||
          title.includes("FT2625501980") ||
          preview.includes("FT2625501977") ||
          preview.includes("FT2625501980") ||
          preview.includes("TP DTC245180037") ||
          preview.includes("Ngo Phuong Mai nop tien phong KTX") ||
          createdAt.includes("2001")
        ) {
          return false;
        }
        return true;
      });
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(ACCOUNTANT_NOTIFS_STORAGE_KEY, JSON.stringify(cleaned));
      }
      return cleaned;
    } catch {
      return [];
    }
  }

  _saveList(list) {
    try {
      const rawCurrent = localStorage.getItem(ACCOUNTANT_NOTIFS_STORAGE_KEY);
      const strNew = JSON.stringify(list);
      // Nếu dữ liệu không thay đổi, tuyệt đối không dispatch để tránh loop
      if (rawCurrent === strNew) {
        return;
      }
      localStorage.setItem(ACCOUNTANT_NOTIFS_STORAGE_KEY, strNew);
      window.dispatchEvent(
        new CustomEvent("accountant-notifications-updated", { detail: list })
      );
    } catch (e) {
      console.warn("Lỗi lưu accountant notifications:", e);
    }
  }

  /**
   * Đồng bộ 100% dữ liệu tài chính & hóa đơn thật từ CSDL
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

      // Đọc danh sách các hóa đơn sinh viên vừa xác nhận chuyển khoản đang chờ gạch nợ
      let pendingInvoiceIds = [];
      try {
        const storedPending = localStorage.getItem("ktx_pending_invoices");
        if (storedPending) {
          pendingInvoiceIds = JSON.parse(storedPending);
        }
      } catch (_) {}

      // 1. Quét giao dịch ngân hàng thật từ API Đối soát
      try {
        const recRes = await reconciliationService.getReconciliations({ pageSize: 50 });
        const txItems = recRes?.data?.items || [];
        if (Array.isArray(txItems)) {
          txItems.forEach((tx) => {
            const txCode = tx.bankTransactionCode || tx.ma_giao_dich_ngan_hang || tx.ma_giao_dich || tx.id;
            if (!txCode) return;

            const isMatched =
              tx.status === "MATCHED" ||
              tx.status === "AUTO_MATCHED" ||
              tx.status === "MATCHED_MANUALLY" ||
              tx.trang_thai === "MATCHED" ||
              tx.trang_thai === "AUTO_MATCHED" ||
              tx.trang_thai === "MATCHED_MANUALLY";

            const notifId = `NOTIF_REC_${txCode}`;
            const existing = storedMap.get(notifId);
            const amt = Number(tx.amount || tx.so_tien || 0);
            const txContent = tx.transferContent || tx.noi_dung_chuyen_khoan || tx.content || "Nộp tiền KTX";
            const txMsv = tx.studentCode || tx.msv || tx.studentId || "";
            const txName = tx.studentName || tx.ho_ten || "";

            realNotifs.push({
              id: notifId,
              recipientRole: "ACCOUNTANT",
              category: "PAYMENT_RECONCILE",
              priority: isMatched ? "NORMAL" : "URGENT",
              status: existing
                ? existing.status
                : isMatched
                ? "ACTION_RESOLVED"
                : "ACTION_REQUIRED",
              isRead: existing ? existing.isRead : isMatched,
              title: isMatched
                ? `Đã khớp giao dịch: +${amt.toLocaleString("vi-VN")} đ`
                : `Giao dịch cần đối soát: +${amt.toLocaleString("vi-VN")} đ`,
              previewText: `Mã GD: ${txCode} (${tx.bankName || tx.ten_ngan_hang || "Ngân hàng"}). Nội dung: "${txContent}". ${txMsv ? `MSV: ${txMsv}${txName ? ` (${txName})` : ""}.` : "Chưa xác định MSV."} ${!isMatched ? "Cần đối soát & gạch nợ." : ""}`,
              avatarOrIcon: {
                type: "ICON",
                name: "BadgeCheck",
                badgeColor: isMatched ? "emerald" : "amber",
              },
              metadata: {
                transactionId: txCode,
                studentId: txMsv,
                amount: amt,
                invoiceId: tx.invoiceCode || tx.invoiceId,
              },
              deepLink: {
                targetUrl: `/accountant/reconciliation`,
                openMode: "NAVIGATE",
                entityId: txCode,
              },
              quickActions: [
                { actionKey: "VIEW_DETAIL", label: "Xem chi tiết", variant: "secondary" },
              ],
              createdAt: existing?.createdAt || tx.transactionDate || tx.ngay_giao_dich || tx.createdAt || "2026-10-26T12:00:00.000Z",
              resolvedAt: isMatched ? (tx.updatedAt || existing?.resolvedAt || new Date().toISOString()) : null,
            });
          });
        }
      } catch (e) {
        console.warn("Lỗi đồng bộ giao dịch ngân hàng thật cho kế toán:", e);
      }

      // 2. Quét hóa đơn thật từ invoiceService.getInvoices()
      try {
        const invoices = await invoiceService.getInvoices();
        if (Array.isArray(invoices)) {
          invoices.forEach((inv) => {
            const invId = inv.ma_hoa_don || inv.id;
            if (!invId) return;

            const isPendingReconcile =
              pendingInvoiceIds.includes(invId) ||
              inv.trang_thai === "CHO_DOI_SOAT" ||
              inv.trang_thai === "PENDING";
            const isPaid = inv.trang_thai === "DA_THANH_TOAN";
            const isUnpaid = !isPaid && !isPendingReconcile;

            const notifId = `NOTIF_INV_${invId}`;
            const existing = storedMap.get(notifId);
            const amt = Number(inv.so_tien || inv.tong_tien || 0);

            if (isPendingReconcile && !isPaid) {
              // HÓA ĐƠN ĐANG CHỜ ĐỐI SOÁT TỪ SINH VIÊN -> THÔNG BÁO KHẨN CẤP ĐỐI SOÁT CHO KẾ TOÁN!
              realNotifs.push({
                id: notifId,
                recipientRole: "ACCOUNTANT",
                category: "PAYMENT_RECONCILE",
                priority: "URGENT",
                status: existing ? existing.status : "ACTION_REQUIRED",
                isRead: existing ? existing.isRead : false,
                title: `Chờ đối soát: +${amt.toLocaleString("vi-VN")} đ (${inv.msv || "Sinh viên"})`,
                previewText: `Sinh viên ${inv.msv || "---"} đã chuyển khoản thanh toán cho #${invId} (${inv.ky_thanh_toan || "Kỳ này"}). Đang chờ kế toán đối soát & gạch nợ.`,
                avatarOrIcon: {
                  type: "ICON",
                  name: "RotateCw",
                  badgeColor: "amber",
                },
                metadata: {
                  invoiceId: invId,
                  studentId: inv.msv,
                  amount: amt,
                },
                deepLink: {
                  targetUrl: `/accountant/reconciliation`,
                  openMode: "NAVIGATE",
                  entityId: invId,
                },
                quickActions: [
                  { actionKey: "VIEW_DETAIL", label: "Xem chi tiết", variant: "secondary" },
                ],
                createdAt: existing?.createdAt || inv.ngay_tao || "2026-10-26T12:00:00.000Z",
                resolvedAt: existing?.resolvedAt || null,
              });
            } else {
              realNotifs.push({
                id: notifId,
                recipientRole: "ACCOUNTANT",
                category: "INVOICE_GENERATION",
                priority: isUnpaid ? "HIGH" : "NORMAL",
                status: existing
                  ? existing.status
                  : isUnpaid
                  ? "ACTION_REQUIRED"
                  : "ACTION_RESOLVED",
                isRead: existing ? existing.isRead : !isUnpaid,
                title: isUnpaid
                  ? `Hóa đơn chờ thu: #${invId}`
                  : `Đã hoàn tất thanh toán: #${invId}`,
                previewText: `Sinh viên: ${inv.msv || "---"}. Số tiền: ${amt.toLocaleString("vi-VN")} đ. Kỳ: ${inv.ky_thanh_toan || "Kỳ thu hiện tại"}. Hạn nộp: ${inv.han_thanh_toan || "Cuối tháng"}.`,
                avatarOrIcon: {
                  type: "ICON",
                  name: "Receipt",
                  badgeColor: isUnpaid ? "rose" : "emerald",
                },
                metadata: {
                  invoiceId: invId,
                  studentId: inv.msv,
                  amount: amt,
                },
                deepLink: {
                  targetUrl: `/accountant/billing`,
                  openMode: "NAVIGATE",
                  entityId: invId,
                },
                quickActions: [
                  { actionKey: "VIEW_DETAIL", label: "Xem chi tiết", variant: "secondary" },
                ],
                createdAt: existing?.createdAt || inv.ngay_tao || "2026-10-26T12:00:00.000Z",
                resolvedAt: isPaid ? (existing?.resolvedAt || new Date().toISOString()) : null,
              });
            }
          });
        }
      } catch (e) {
        console.warn("Lỗi đồng bộ hóa đơn thật cho kế toán:", e);
      }

      // 3. Quét sinh viên mới được duyệt chỗ ở cần lập hóa đơn tiền phòng
      try {
        const requests = await occupancyService.getAllRequests();
        if (Array.isArray(requests)) {
          requests.forEach((req) => {
            const rawId = String(req.id || req.ma_yeu_cau || req.msv || "").replace(/^#/, "").trim();
            if (!rawId) return;

            const isApproved = req.trang_thai === "APPROVED" || req.trang_thai === "DA_DUYET";
            if (isApproved && req.msv) {
              const notifId = `NOTIF_NEW_RESIDENT_${rawId}`;
              const existing = storedMap.get(notifId);

              realNotifs.push({
                id: notifId,
                recipientRole: "ACCOUNTANT",
                category: "INVOICE_GENERATION",
                priority: "HIGH",
                status: existing ? existing.status : "ACTION_REQUIRED",
                isRead: existing ? existing.isRead : false,
                title: `Lập hóa đơn phòng: ${req.msv} (${req.ho_ten || "Sinh viên"})`,
                previewText: `SV: ${req.ho_ten} (${req.msv || "---"}) được duyệt vào ${req.so_phong ? `P${req.so_phong}` : "phòng KTX"} - ${req.toa_nha || req.ma_toa || "KTX"}. Cần lập hóa đơn tiền phòng.`,
                avatarOrIcon: {
                  type: "ICON",
                  name: "Receipt",
                  badgeColor: "indigo",
                },
                metadata: {
                  requestId: rawId,
                  studentId: req.msv,
                  studentName: req.ho_ten,
                  roomCode: req.so_phong,
                },
                deepLink: {
                  targetUrl: `/accountant/billing`,
                  openMode: "NAVIGATE",
                  entityId: rawId,
                },
                quickActions: [
                  { actionKey: "VIEW_DETAIL", label: "Xem chi tiết", variant: "secondary" },
                ],
                createdAt: existing?.createdAt || req.ngay_duyet || req.ngay_gui || "2026-10-26T12:00:00.000Z",
                resolvedAt: existing?.resolvedAt || null,
              });
            }
          });
        }
      } catch (e) {
        console.warn("Lỗi đồng bộ sinh viên mới xếp phòng cho kế toán:", e);
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

  /**
   * Kế toán xác nhận gạch nợ cho hóa đơn từ thông báo
   */
  async matchAndClearInvoice(invoiceId) {
    if (!invoiceId) return;

    try {
      // 1. Gọi API gạch nợ trên backend
      await invoiceService.markInvoicePaid(invoiceId);
    } catch (e) {
      console.warn("Lỗi gọi markInvoicePaid API:", e);
    }

    try {
      // 2. Xóa khỏi danh sách chờ đối soát trong localStorage
      const storedPending = localStorage.getItem("ktx_pending_invoices");
      if (storedPending) {
        const arr = JSON.parse(storedPending).filter((id) => id !== invoiceId);
        localStorage.setItem("ktx_pending_invoices", JSON.stringify(arr));
      }

      // 3. Cập nhật trạng thái thông báo thành ACTION_RESOLVED
      this.resolveNotification(`NOTIF_INV_${invoiceId}`);

      // 4. Bắn sự kiện cập nhật đồng bộ toàn hệ thống
      window.dispatchEvent(new CustomEvent("ktx-payment-updated"));
      window.dispatchEvent(new CustomEvent("student-account-updated"));
      window.dispatchEvent(new CustomEvent("occupancy-updated"));
      window.dispatchEvent(new CustomEvent("accountant-notifications-updated"));
    } catch (e) {
      console.error("Lỗi hoàn tất matchAndClearInvoice:", e);
    }
  }
}

export const accountantNotificationService = new AccountantNotificationService();
export default accountantNotificationService;
