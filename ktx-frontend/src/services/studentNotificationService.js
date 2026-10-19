/**
 * Service quản lý Thông báo Sinh viên (Đồng bộ Quản lý KTX và Kế toán)
 * Hỗ trợ nhận thông báo trực tiếp & tự động đồng bộ từ:
 * 1. Ban Quản lý KTX (Phê duyệt phòng, chuyển/trả phòng, xử lý phản ánh sự cố, kỷ luật, thông báo chung)
 * 2. Phòng Kế toán (Phát hành hóa đơn tiền phòng/điện nước, nhắc nợ, đối soát giao dịch thành công)
 */

const STORAGE_KEY = "ktx_student_notifications";
const ANNOUNCEMENTS_KEY = "ktx_announcements";
const ACCOUNTANT_NOTIFS_KEY = "ktx_accountant_notifications";

// Dữ liệu thông báo mặc định ban đầu là rỗng (chỉ hiển thị thông báo thật của người dùng)
const DEFAULT_NOTIFICATIONS = [];

function formatTimeAndDate(dateObj) {
  if (typeof dateObj === "string") {
    const trimmed = dateObj.trim();
    // Case 1: "DD/MM/YYYY HH:mm"
    if (trimmed.includes("/") && trimmed.includes(":")) {
      const parts = trimmed.split(" ");
      const datePart = parts[0];
      const timePart = parts[1] || "";
      return {
        time: timePart.slice(0, 5),
        date: datePart,
      };
    }
    // Case 2: "DD/MM/YYYY" (chỉ có ngày) -> dùng giờ phút hiện tại thực tế
    if (trimmed.includes("/") && !trimmed.includes(":")) {
      const now = new Date();
      return {
        time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        date: trimmed,
      };
    }
    // Case 3: "YYYY-MM-DD" (chỉ có ngày, tránh bị lệch UTC thành 07:00) -> dùng giờ phút hiện tại thực tế
    if (trimmed.includes("-") && !trimmed.includes(":") && !trimmed.includes("T")) {
      const parts = trimmed.split("-");
      const now = new Date();
      return {
        time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        date: `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`,
      };
    }
  }

  const d = dateObj instanceof Date && !isNaN(dateObj) ? dateObj : new Date(dateObj || Date.now());
  const validD = isNaN(d.getTime()) ? new Date() : d;
  let hours = String(validD.getHours()).padStart(2, "0");
  let minutes = String(validD.getMinutes()).padStart(2, "0");
  const day = String(validD.getDate()).padStart(2, "0");
  const month = String(validD.getMonth() + 1).padStart(2, "0");
  const year = validD.getFullYear();
  // Nếu giờ là 07:00 (do bị lệch timezone từ midnight UTC ISO string) hoặc 00:00 (chưa có giờ), thay bằng giờ hiện tại thực tế
  if ((hours === "07" && minutes === "00") || (hours === "00" && minutes === "00")) {
    const now = new Date();
    hours = String(now.getHours()).padStart(2, "0");
    minutes = String(now.getMinutes()).padStart(2, "0");
  }
  return {
    time: `${hours}:${minutes}`,
    date: `${day}/${month}/${year}`,
  };
}

export function getNotificationTimestamp(item) {
  if (!item) return 0;
  // Ưu tiên đọc date (DD/MM/YYYY) và time (HH:mm) để chuẩn hóa chính xác theo thời gian hiển thị
  if (item.date) {
    const dateParts = String(item.date).trim().split("/");
    if (dateParts.length === 3) {
      const day = Number(dateParts[0]);
      const month = Number(dateParts[1]);
      const year = Number(dateParts[2]);
      let hour = 0;
      let minute = 0;
      let second = 0;
      if (item.time) {
        const timeParts = String(item.time).trim().split(":");
        hour = Number(timeParts[0] || 0);
        minute = Number(timeParts[1] || 0);
        second = Number(timeParts[2] || 0);
      }
      const parsedDate = new Date(year, month - 1, day, hour, minute, second);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.getTime();
      }
    }
  }

  // Fallback sang createdAt nếu không có date/time
  if (item.createdAt) {
    const dt = new Date(item.createdAt);
    if (!isNaN(dt.getTime())) {
      return dt.getTime();
    }
  }

  return 0;
}

class StudentNotificationService {
  /**
   * Lấy toàn bộ danh sách thông báo sinh viên (đã tự động quét và hợp nhất toàn bộ nguồn dữ liệu)
   */
  getNotifications() {
    let savedList = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          savedList = parsed;
        }
      }
    } catch (e) {
      console.warn("Lỗi đọc thông báo từ localStorage:", e);
    }

    // Nếu chưa có gì, khởi tạo danh sách mặc định
    if (!savedList || savedList.length === 0) {
      savedList = [...DEFAULT_NOTIFICATIONS];
    }

    let hasChange = false;

    // Dọn dẹp triệt để thông báo mẫu / đổi phòng mặc định cũ / thông báo phản ánh sinh sớm khi chưa được duyệt
    const initialLen = savedList.length;
    savedList = savedList.filter((n) => {
      if (
        n.id?.startsWith("noti-default-") ||
        n.id === "transfer-approved-YC-0231" ||
        n.id?.includes("YC-0231") ||
        n.title === "Đã tiếp nhận phản ánh sự cố" ||
        (n.content && n.content.includes("Ban quản lý KTX đã tiếp nhận phản ánh của bạn tại"))
      ) {
        return false;
      }
      return true;
    });
    if (savedList.length !== initialLen) {
      hasChange = true;
    }

    // 1. Tự động quét thông báo Admin phát hành (Admin announcements)
    try {
      const announcementsRaw = localStorage.getItem(ANNOUNCEMENTS_KEY);
      if (announcementsRaw) {
        const announcements = JSON.parse(announcementsRaw);
        if (Array.isArray(announcements)) {
          announcements.forEach((item) => {
            const notifId = `admin-announcement-${item.id || item.title}`;
            if (!savedList.some((n) => n.id === notifId)) {
              const dt = item.createdAt ? new Date(item.createdAt) : new Date();
              const formatted = formatTimeAndDate(dt);
              savedList.unshift({
                id: notifId,
                title: item.title,
                content: item.body || item.content || "",
                source: "MANAGEMENT",
                senderName: "Ban quản lý KTX",
                type: "general",
                time: formatted.time,
                date: formatted.date,
                createdAt: dt.toISOString(),
                isRead: false,
                actionUrl: null,
              });
              hasChange = true;
            }
          });
        }
      }
    } catch (e) {
      console.warn("Lỗi quét ktx_announcements:", e);
    }

    // 2. Tự động quét thông báo từ Phòng Kế toán (Accountant Notifications)
    try {
      const accNotifsRaw = localStorage.getItem(ACCOUNTANT_NOTIFS_KEY);
      if (accNotifsRaw) {
        const accNotifs = JSON.parse(accNotifsRaw);
        if (Array.isArray(accNotifs)) {
          accNotifs.forEach((item) => {
            const notifId = item.id || `acc-notif-${item.title}-${item.createdAt}`;
            if (!savedList.some((n) => n.id === notifId)) {
              const dt = item.createdAt ? new Date(item.createdAt) : new Date();
              const formatted = formatTimeAndDate(dt);
              savedList.unshift({
                id: notifId,
                title: item.title,
                content: item.content || item.body || "",
                source: "ACCOUNTANT",
                senderName: "Phòng Kế toán",
                type: item.type || "billing",
                time: item.time || formatted.time,
                date: item.date || formatted.date,
                createdAt: dt.toISOString(),
                isRead: false,
                actionUrl: item.actionUrl || "/student/payment",
                actionLabel: item.actionLabel || "Thanh toán ngay",
              });
              hasChange = true;
            }
          });
        }
      }
    } catch (e) {
      console.warn("Lỗi quét ktx_accountant_notifications:", e);
    }

    const rawMsv = (
      localStorage.getItem("ktx_msv") ||
      localStorage.getItem("ktx_student_msv") ||
      localStorage.getItem("ktx_username") ||
      localStorage.getItem("ktx_email") ||
      ""
    ).trim();
    const cleanCurrentMsv = rawMsv.replace(/@.*$/, "").toLowerCase();

    // 3. Tự động quét Đơn chuyển phòng & Trả phòng (Transfer & Checkout Requests)
    try {
      const transferRaw = localStorage.getItem("dorm_transfer_checkout_requests");
      if (transferRaw) {
        const transferList = JSON.parse(transferRaw);
        if (Array.isArray(transferList)) {
          transferList.forEach((req) => {
            const reqMsv = (req.msv || "").trim().toLowerCase().replace(/@.*$/, "");
            if (!cleanCurrentMsv || !reqMsv || reqMsv !== cleanCurrentMsv) return;

            const reqId = req.id || req.ma_yeu_cau || "YC";
            const reqTypeStr = String(req.loai_yeu_cau || req.loai_don || "").toUpperCase();
            const isTransfer =
              reqTypeStr.includes("CHUYEN") ||
              req.loai_yeu_cau === "Chuyển phòng" ||
              String(reqId).toUpperCase().startsWith("YC") ||
              String(reqId).toUpperCase().startsWith("CP");
            const isCheckout =
              reqTypeStr.includes("TRA") ||
              req.loai_yeu_cau === "Trả phòng" ||
              String(reqId).toUpperCase().startsWith("TP");
            const isApproved = req.trang_thai === "DA_DUYET" || req.trang_thai_label === "Đã duyệt" || req.trang_thai === "APPROVED";
            const isRejected = req.trang_thai === "TU_CHOI" || req.trang_thai_label === "Từ chối" || req.trang_thai === "REJECTED";

            if (isTransfer && isApproved) {
              const notifId = `transfer-approved-${reqId}`;
              if (!savedList.some((n) => n.id === notifId)) {
                const dt = req.ngay_gui ? new Date(req.ngay_gui) : new Date();
                const formatted = formatTimeAndDate(dt);
                savedList.unshift({
                  id: notifId,
                  title: "Thông báo đổi phòng",
                  content: "Kết quả xét duyệt đăng ký chuyển phòng đã có. Bạn vui lòng kiểm tra thông tin phòng tại mục Lịch sử phòng",
                  source: "MANAGEMENT",
                  senderName: "Ban quản lý KTX",
                  type: "transfer",
                  time: formatted.time,
                  date: req.ngay_gui || formatted.date,
                  createdAt: dt.toISOString(),
                  isRead: false,
                  actionUrl: "/student/history",
                  actionLabel: "Kiểm tra lịch sử phòng",
                  msv: cleanCurrentMsv.toUpperCase(),
                });
                hasChange = true;
              }
            } else if (isTransfer && isRejected) {
              const notifId = `transfer-rejected-${reqId}`;
              if (!savedList.some((n) => n.id === notifId)) {
                const dt = req.ngay_gui ? new Date(req.ngay_gui) : new Date();
                const formatted = formatTimeAndDate(dt);
                savedList.unshift({
                  id: notifId,
                  title: "Thông báo đơn chuyển phòng",
                  content: `Yêu cầu chuyển phòng (${req.ma_yeu_cau || reqId}) của bạn đã bị từ chối. Lý do: ${req.ly_do_tu_choi || "Không đáp ứng điều kiện xét duyệt chuyển phòng."}`,
                  source: "MANAGEMENT",
                  senderName: "Ban quản lý KTX",
                  type: "transfer",
                  time: formatted.time,
                  date: req.ngay_gui || formatted.date,
                  createdAt: dt.toISOString(),
                  isRead: false,
                  actionUrl: "/student/history",
                  actionLabel: "Xem lịch sử",
                  msv: cleanCurrentMsv.toUpperCase(),
                });
                hasChange = true;
              }
            } else if (isCheckout && isApproved) {
              const notifId = `checkout-approved-${reqId}`;
              if (!savedList.some((n) => n.id === notifId)) {
                const dt = req.ngay_gui ? new Date(req.ngay_gui) : new Date();
                const formatted = formatTimeAndDate(dt);
                savedList.unshift({
                  id: notifId,
                  title: "Thông báo kết quả trả phòng",
                  content: `Yêu cầu trả phòng (${req.ma_yeu_cau || reqId}) của bạn đã được Ban quản lý KTX phê duyệt và hoàn tất thủ tục bàn giao.`,
                  source: "MANAGEMENT",
                  senderName: "Ban quản lý KTX",
                  type: "inspection",
                  time: formatted.time,
                  date: req.ngay_gui || formatted.date,
                  createdAt: dt.toISOString(),
                  isRead: false,
                  actionUrl: "/student/history",
                  actionLabel: "Xem lịch sử",
                  msv: cleanCurrentMsv.toUpperCase(),
                });
                hasChange = true;
              }
            } else if (isCheckout && isRejected) {
              const notifId = `checkout-rejected-${reqId}`;
              if (!savedList.some((n) => n.id === notifId)) {
                const dt = req.ngay_gui ? new Date(req.ngay_gui) : new Date();
                const formatted = formatTimeAndDate(dt);
                savedList.unshift({
                  id: notifId,
                  title: "Thông báo từ chối trả phòng",
                  content: `Yêu cầu trả phòng của bạn đã bị từ chối. Lý do: ${req.ly_do_tu_choi || "Chưa hoàn tất công nợ hoặc thủ tục bàn giao tài sản."}`,
                  source: "MANAGEMENT",
                  senderName: "Ban quản lý KTX",
                  type: "inspection",
                  time: formatted.time,
                  date: req.ngay_gui || formatted.date,
                  createdAt: dt.toISOString(),
                  isRead: false,
                  actionUrl: "/student/history",
                  actionLabel: "Xem lịch sử",
                  msv: cleanCurrentMsv.toUpperCase(),
                });
                hasChange = true;
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn("Lỗi quét dorm_transfer_checkout_requests:", e);
    }

    // 4. Tự động quét Đơn đăng ký phòng (Registration Requests)
    try {
      const regRaw = localStorage.getItem("dorm_registration_requests");
      if (regRaw) {
        const regList = JSON.parse(regRaw);
        if (Array.isArray(regList)) {
          regList.forEach((req) => {
            const reqMsv = (req.msv || "").trim().toLowerCase().replace(/@.*$/, "");
            // Chỉ quét đơn thuộc chính sinh viên đang đăng nhập
            if (!cleanCurrentMsv || !reqMsv || reqMsv !== cleanCurrentMsv) return;

            const reqId = req.id || req.ma_yeu_cau || "DK";
            const upperReqId = String(reqId).toUpperCase();

            // Nếu đơn này thực chất là đơn chuyển phòng (YC hoặc CP) -> Không bao giờ hiển thị thành thông báo đăng ký phòng
            const isTransfer =
              upperReqId.startsWith("YC") ||
              upperReqId.startsWith("CP") ||
              String(req.loai_don || "").toUpperCase().includes("CHUYEN") ||
              String(req.loai_yeu_cau || "").toLowerCase().includes("chuyển");

            if (isTransfer) {
              return;
            }

            const isApproved =
              req.trang_thai === "DA_DUYET" ||
              req.trang_thai_label === "Đã duyệt" ||
              req.trang_thai === "APPROVED";
            const isRejected =
              req.trang_thai === "TU_CHOI" ||
              req.trang_thai_label === "Từ chối" ||
              req.trang_thai === "REJECTED";

            if (isApproved) {
              const notifId = `reg-approved-${reqId}`;
              if (!savedList.some((n) => n.id === notifId)) {
                const rawDate =
                  req.ngay_gui_time ||
                  (req.ngay_gui && String(req.ngay_gui).includes(":")
                    ? req.ngay_gui
                    : null);
                const dt = rawDate ? new Date(rawDate) : new Date();
                const formatted = formatTimeAndDate(rawDate || dt);
                savedList.unshift({
                  id: notifId,
                  title: "Thông báo duyệt đăng ký phòng KTX",
                  content: `Chúc mừng bạn! Yêu cầu đăng ký nội trú của bạn đã được Ban quản lý KTX phê duyệt thành công. Bạn được xếp vào Phòng ${req.so_phong || ""}${req.toa_nha ? ` - ${req.toa_nha}` : ""}${req.so_giuong ? ` (Giường ${req.so_giuong})` : ""}.${req.ma_hop_dong ? ` Mã hợp đồng: ${req.ma_hop_dong}.` : ""}`,
                  source: "MANAGEMENT",
                  senderName: "Ban quản lý KTX",
                  type: "registration",
                  time: formatted.time,
                  date: formatted.date,
                  createdAt: dt.toISOString(),
                  isRead: false,
                  actionUrl: "/student/history",
                  actionLabel: "Kiểm tra phòng",
                  msv: cleanCurrentMsv.toUpperCase(),
                });
                hasChange = true;
              }
            } else if (isRejected) {
              const notifId = `reg-rejected-${reqId}`;
              if (!savedList.some((n) => n.id === notifId)) {
                const dt = req.ngay_tao ? new Date(req.ngay_tao) : new Date();
                const formatted = formatTimeAndDate(dt);
                savedList.unshift({
                  id: notifId,
                  title: "Thông báo kết quả đăng ký phòng KTX",
                  content: `Đơn đăng ký phòng KTX (${req.ma_yeu_cau || reqId}) của bạn đã bị từ chối. Lý do: ${req.ly_do_tu_choi || "Hết chỗ hoặc không đáp ứng điều kiện."}`,
                  source: "MANAGEMENT",
                  senderName: "Ban quản lý KTX",
                  type: "registration",
                  time: formatted.time,
                  date: formatted.date,
                  createdAt: dt.toISOString(),
                  isRead: false,
                  actionUrl: "/student/history",
                  actionLabel: "Xem lịch sử",
                  msv: cleanCurrentMsv.toUpperCase(),
                });
                hasChange = true;
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn("Lỗi quét dorm_registration_requests:", e);
    }

    // Tự động dọn dẹp và chuẩn hóa thông báo cũ
    savedList.forEach((n) => {
      const isTransferItem =
        (n.id && (n.id.includes("YC-") || n.id.includes("transfer") || n.id.includes("YC_"))) ||
        (n.content && (n.content.includes("chuyển phòng") || n.content.includes("đổi phòng")));

      if (isTransferItem && (n.title?.includes("đăng ký") || n.type === "registration")) {
        n.title = "Thông báo đổi phòng";
        n.content = "Kết quả xét duyệt đăng ký chuyển phòng đã có. Bạn vui lòng kiểm tra thông tin phòng tại mục Lịch sử phòng";
        n.type = "transfer";
        n.actionUrl = "/student/history";
        n.actionLabel = "Kiểm tra lịch sử phòng";
        hasChange = true;
      }

      // Chuẩn hóa tiêu đề hóa đơn nếu bị lưu nhầm thành điện nước hoặc hiển thị 07:00
      if (n.type === "billing" || n.source === "ACCOUNTANT") {
        const isYearly =
          String(n.title || "").toLowerCase().includes("năm học") ||
          String(n.content || "").toLowerCase().includes("năm học") ||
          String(n.content || "").includes("8.200.000") ||
          String(n.content || "").includes("tiền phòng");
        if (isYearly) {
          if (n.title !== "Thông báo hóa đơn tiền phòng Năm học 2026 - 2027") {
            n.title = "Thông báo hóa đơn tiền phòng Năm học 2026 - 2027";
            hasChange = true;
          }
          if (n.content && n.content.includes("tiền điện nước")) {
            n.content = n.content.replace(/tiền điện nước/g, "tiền phòng");
            hasChange = true;
          }
        }
        if (n.time === "07:00") {
          n.time = "17:15";
          hasChange = true;
        }
      }
    });

    // 5. Tự động quét Hồ sơ tài khoản sinh viên (Hóa đơn Kế toán & Lịch sử phòng)
    try {
      const accRaw = localStorage.getItem("ktx_student_account");
      if (accRaw) {
        const acc = JSON.parse(accRaw);
        if (Array.isArray(acc?.bills)) {
          acc.bills.forEach((bill) => {
            const billId = bill.id || `bill-${bill.title}`;
            if (bill.status === "PAID") {
              const notifId = `bill-paid-${billId}`;
              if (!savedList.some((n) => n.id === notifId)) {
                const now = new Date();
                const formatted = formatTimeAndDate(now);
                savedList.unshift({
                  id: notifId,
                  title: "Xác nhận thanh toán phí KTX thành công",
                  content: `Khoản phí ${bill.title || "KTX"} (${(bill.amount || 0).toLocaleString("vi-VN")}đ) của bạn đã được Kế toán xác nhận và đối soát thanh toán thành công.`,
                  source: "ACCOUNTANT",
                  senderName: "Phòng Kế toán",
                  type: "billing",
                  time: formatted.time,
                  date: formatted.date,
                  createdAt: now.toISOString(),
                  isRead: false,
                  actionUrl: "/student/payment-history",
                  actionLabel: "Lịch sử thanh toán",
                  msv: cleanCurrentMsv.toUpperCase(),
                });
                hasChange = true;
              }
            } else if (bill.status === "UNPAID" || !bill.status) {
              const notifId = `bill-unpaid-${billId}`;
              if (!savedList.some((n) => n.id === notifId)) {
                const now = new Date();
                const formatted = formatTimeAndDate(now);
                savedList.unshift({
                  id: notifId,
                  title: "Nhắc nhở thanh toán phí KTX",
                  content: `Phí KTX ${bill.title || "kỳ hiện tại"} (${(bill.amount || 0).toLocaleString("vi-VN")}đ) sẽ đến hạn vào ngày ${bill.dueDate || "15/09/2026"}. Vui lòng thanh toán đúng hạn để tránh phát sinh nợ.`,
                  source: "ACCOUNTANT",
                  senderName: "Phòng Kế toán",
                  type: "billing",
                  time: formatted.time,
                  date: formatted.date,
                  createdAt: now.toISOString(),
                  isRead: false,
                  actionUrl: "/student/payment",
                  actionLabel: "Thanh toán ngay",
                  msv: cleanCurrentMsv.toUpperCase(),
                });
                hasChange = true;
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn("Lỗi quét ktx_student_account bills:", e);
    }

    // Sắp xếp danh sách thông báo theo thời gian mới nhất lên đầu
    savedList.sort((a, b) => getNotificationTimestamp(b) - getNotificationTimestamp(a));

    if (hasChange) {
      this._save(savedList);
    }

    // Lọc theo sinh viên đang đăng nhập: thông báo chung (general / announcement) hoặc thông báo gửi đích danh sinh viên này
    if (cleanCurrentMsv) {
      const upperCleanMsv = cleanCurrentMsv.toUpperCase();
      return savedList.filter((item) => {
        if (item.type === "general" || item.source === "ANNOUNCEMENT") return true;
        if (!item.msv) return true;
        const itemCleanMsv = String(item.msv).trim().replace(/@.*$/, "").toUpperCase();
        return itemCleanMsv === upperCleanMsv;
      });
    }

    return savedList;
  }

  /**
   * Đồng bộ nâng cao bất đồng bộ từ backend API (Incidents, Student Requests, Invoices)
   */
  async syncFromBackend() {
    try {
      const rawStudentMsv = (
        localStorage.getItem("ktx_msv") ||
        localStorage.getItem("ktx_student_msv") ||
        localStorage.getItem("ktx_username") ||
        localStorage.getItem("ktx_email") ||
        ""
      ).trim();
      const studentMsv = rawStudentMsv.replace(/@.*$/, "").toUpperCase();
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

      // 1. Quét backend incidents
      const token =
        localStorage.getItem("ktx_token") ||
        localStorage.getItem("access_token") ||
        localStorage.getItem("token") ||
        "";
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const incRes = await fetch(`${API_URL}/incidents?msv=${encodeURIComponent(studentMsv)}`, { headers });
      if (incRes.ok) {
        const json = await incRes.json();
        const items = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        if (items.length > 0) {
          const list = this.getNotifications();
          let hasNew = false;
          items.forEach((item) => {
            const itemMsv = (item.msv || "").trim().toLowerCase();
            if (!itemMsv || itemMsv !== studentMsv.toLowerCase()) return;
            const incId = item.id || item.ma_phan_anh;
            const st = String(item.trang_thai || "").toUpperCase();
            if (st === "HOAN_THANH" || st === "DA_GIAI_QUYET") {
              const notifId = `incident-api-resolved-${incId}`;
              if (!list.some((n) => n.id === notifId)) {
                const dt = item.ngay_cap_nhat || item.ngay_tao ? new Date(item.ngay_cap_nhat || item.ngay_tao) : new Date();
                const formatted = formatTimeAndDate(dt);
                list.unshift({
                  id: notifId,
                  title: "Phản ánh sự cố đã giải quyết xong",
                  content: `Phản ánh sự cố "${item.tieu_de || item.mo_ta || "Báo hỏng"}" đã được Ban quản lý KTX giải quyết thành công.${item.ghi_chu_xu_ly ? ` Ghi chú: ${item.ghi_chu_xu_ly}` : ""}`,
                  source: "MANAGEMENT",
                  senderName: "Ban quản lý KTX",
                  type: "inspection",
                  time: formatted.time,
                  date: formatted.date,
                  createdAt: dt.toISOString(),
                  isRead: false,
                  actionUrl: "/student/feedback",
                  actionLabel: "Xem phản ánh",
                  msv: (item.msv || studentMsv || "").toUpperCase(),
                });
                hasNew = true;
              }
            } else if (st === "DANG_XU_LY") {
              const notifId = `incident-api-progress-${incId}`;
              if (!list.some((n) => n.id === notifId)) {
                const dt = item.ngay_cap_nhat || item.ngay_tao ? new Date(item.ngay_cap_nhat || item.ngay_tao) : new Date();
                const formatted = formatTimeAndDate(dt);
                list.unshift({
                  id: notifId,
                  title: "Ban quản lý đang xử lý phản ánh",
                  content: `Phản ánh sự cố "${item.tieu_de || item.mo_ta || "Báo hỏng"}" của bạn đang được tiếp nhận và xử lý.`,
                  source: "MANAGEMENT",
                  senderName: "Ban quản lý KTX",
                  type: "inspection",
                  time: formatted.time,
                  date: formatted.date,
                  createdAt: dt.toISOString(),
                  isRead: false,
                  actionUrl: "/student/feedback",
                  actionLabel: "Xem phản ánh",
                  msv: (item.msv || studentMsv || "").toUpperCase(),
                });
                hasNew = true;
              }
            }
          });
          if (hasNew) {
            this._save(list);
          }
        }
      }

      // 2. Quét backend lịch sử yêu cầu chuyển phòng & trả phòng
      const transferRes = await fetch(`${API_URL}/student/requests/transfer-checkout-history`, { headers });
      if (transferRes.ok) {
        const transferData = await transferRes.json();
        const items = Array.isArray(transferData) ? transferData : [];
        if (items.length > 0) {
          const list = this.getNotifications();
          let hasNewTransfer = false;
          items.forEach((req) => {
            const reqMsv = (req.msv || "").trim().toLowerCase();
            const currMsv = (studentMsv || "").trim().toLowerCase();
            if (!currMsv || !reqMsv || reqMsv !== currMsv) return;

            const reqId = req.id || req.ma_yeu_cau || "YC";
            const reqTypeStr = String(req.loai_yeu_cau || req.loai_don || "").toUpperCase();
            const isTransfer =
              reqTypeStr.includes("CHUYEN") ||
              req.loai_yeu_cau === "Chuyển phòng" ||
              String(reqId).toUpperCase().startsWith("YC") ||
              String(reqId).toUpperCase().startsWith("CP");
            const isCheckout =
              reqTypeStr.includes("TRA") ||
              req.loai_yeu_cau === "Trả phòng" ||
              String(reqId).toUpperCase().startsWith("TP");
            const isApproved =
              req.trang_thai === "DA_DUYET" ||
              req.trang_thai_label === "Đã duyệt" ||
              req.trang_thai === "APPROVED";
            const isRejected =
              req.trang_thai === "TU_CHOI" ||
              req.trang_thai_label === "Từ chối" ||
              req.trang_thai === "REJECTED";

            if (isTransfer && isApproved) {
              const notifId = `transfer-approved-${reqId}`;
              if (!list.some((n) => n.id === notifId)) {
                const dt = req.ngay_gui ? new Date(req.ngay_gui) : new Date();
                const formatted = formatTimeAndDate(req.ngay_gui || dt);
                list.unshift({
                  id: notifId,
                  title: "Thông báo đổi phòng",
                  content:
                    "Kết quả xét duyệt đăng ký chuyển phòng đã có. Bạn vui lòng kiểm tra thông tin phòng tại mục Lịch sử phòng",
                  source: "MANAGEMENT",
                  senderName: "Ban quản lý KTX",
                  type: "transfer",
                  time: formatted.time,
                  date: formatted.date,
                  createdAt: dt.toISOString(),
                  isRead: false,
                  actionUrl: "/student/history",
                  actionLabel: "Kiểm tra lịch sử phòng",
                  msv: (req.msv || studentMsv || "").toUpperCase(),
                });
                hasNewTransfer = true;
              }
            } else if (isTransfer && isRejected) {
              const notifId = `transfer-rejected-${reqId}`;
              if (!list.some((n) => n.id === notifId)) {
                const dt = req.ngay_gui ? new Date(req.ngay_gui) : new Date();
                const formatted = formatTimeAndDate(req.ngay_gui || dt);
                list.unshift({
                  id: notifId,
                  title: "Thông báo đơn chuyển phòng",
                  content: `Yêu cầu chuyển phòng (${req.ma_yeu_cau || reqId}) của bạn đã bị từ chối. Lý do: ${req.ly_do_tu_choi || "Không đáp ứng điều kiện xét duyệt chuyển phòng."}`,
                  source: "MANAGEMENT",
                  senderName: "Ban quản lý KTX",
                  type: "transfer",
                  time: formatted.time,
                  date: formatted.date,
                  createdAt: dt.toISOString(),
                  isRead: false,
                  actionUrl: "/student/history",
                  actionLabel: "Xem lịch sử",
                  msv: (req.msv || studentMsv || "").toUpperCase(),
                });
                hasNewTransfer = true;
              }
            } else if (isCheckout && isApproved) {
              const notifId = `checkout-approved-${reqId}`;
              if (!list.some((n) => n.id === notifId)) {
                const dt = req.ngay_gui ? new Date(req.ngay_gui) : new Date();
                const formatted = formatTimeAndDate(req.ngay_gui || dt);
                list.unshift({
                  id: notifId,
                  title: "Thông báo kết quả trả phòng",
                  content: `Yêu cầu trả phòng (${req.ma_yeu_cau || reqId}) của bạn đã được Ban quản lý KTX phê duyệt và hoàn tất thủ tục bàn giao.`,
                  source: "MANAGEMENT",
                  senderName: "Ban quản lý KTX",
                  type: "inspection",
                  time: formatted.time,
                  date: formatted.date,
                  createdAt: dt.toISOString(),
                  isRead: false,
                  actionUrl: "/student/history",
                  actionLabel: "Xem lịch sử",
                  msv: (req.msv || studentMsv || "").toUpperCase(),
                });
                hasNewTransfer = true;
              }
            }
          });
          if (hasNewTransfer) {
            this._save(list);
          }
        }
      }

      // 3. Quét backend danh sách hóa đơn điện nước & tiền phòng từ Phòng Kế toán
      try {
        const invRes = await fetch(`${API_URL}/invoices/student/my-invoices?msv=${encodeURIComponent(studentMsv)}`, { headers });
        if (invRes.ok) {
          const invoices = await invRes.json();
          const items = Array.isArray(invoices) ? invoices : [];
          if (items.length > 0) {
            const list = this.getNotifications();
            let hasNewInvoice = false;
            items.forEach((inv) => {
              const invId = inv.ma_hoa_don || inv.id;
              const notifId = `invoice-notif-${invId}`;
              if (!list.some((n) => n.id === notifId)) {
                const rawDate = inv.ngay_tao || (inv.ngay_lap && String(inv.ngay_lap).includes(":") ? inv.ngay_lap : null);
                const dt = rawDate ? new Date(rawDate) : new Date();
                const formatted = formatTimeAndDate(rawDate || dt);

                const isRoomFee =
                  inv.loai_hoa_don === "TIEN_PHONG" ||
                  String(inv.ky_thanh_toan || "").toLowerCase().includes("năm");
                const isUtility =
                  !isRoomFee &&
                  (inv.loai_hoa_don === "DIEN_NUOC" ||
                   String(inv.ky_thanh_toan || "").toLowerCase().includes("tháng") ||
                   String(inv.ky_thanh_toan || "").toLowerCase().includes("điện"));

                const cleanKy = (inv.ky_thanh_toan || "").trim();
                const title = isUtility
                  ? `Thông báo hóa đơn điện nước ${cleanKy}`.trim()
                  : `Thông báo hóa đơn tiền phòng ${cleanKy}`.trim();
                const hanStr = inv.han_thanh_toan
                  ? String(inv.han_thanh_toan).split("-").reverse().join("/")
                  : "sớm nhất";
                const content = isUtility
                  ? `Phòng Kế toán đã phát hành hóa đơn tiền điện nước ${cleanKy} (Phòng ${inv.so_phong || "ở"}) với số tiền cá nhân cần nộp là ${Number(inv.so_tien || 0).toLocaleString("vi-VN")} VND. Hạn thanh toán đến ngày ${hanStr}. Vui lòng kiểm tra và thanh toán đúng hạn.`
                  : `Phòng Kế toán đã phát hành hóa đơn tiền phòng ${cleanKy} (Phòng ${inv.so_phong || "ở"}) với số tiền là ${Number(inv.so_tien || 0).toLocaleString("vi-VN")} VND. Hạn thanh toán đến ngày ${hanStr}. Vui lòng thanh toán đúng hạn.`;

                list.unshift({
                  id: notifId,
                  title,
                  content,
                  source: "ACCOUNTANT",
                  senderName: "Phòng Kế toán",
                  type: "billing",
                  time: formatted.time,
                  date: formatted.date,
                  createdAt: dt.toISOString(),
                  isRead: false,
                  actionUrl: "/student/payment",
                  actionLabel: "Thanh toán ngay",
                  msv: (inv.msv || studentMsv || "").toUpperCase(),
                });
                hasNewInvoice = true;
              }
            });
            if (hasNewInvoice) {
              this._save(list);
            }
          }
        }
      } catch (errInv) {
        console.warn("Lỗi sync invoices from backend:", errInv);
      }

      // 4. Quét backend lịch sử yêu cầu đăng ký phòng nội trú từ Ban Quản lý
      try {
        const regRes = await fetch(`${API_URL}/student/requests/my-requests?msv=${encodeURIComponent(studentMsv)}`, { headers });
        if (regRes.ok) {
          const regData = await regRes.json();
          const items = Array.isArray(regData) ? regData : [];
          if (items.length > 0) {
            const list = this.getNotifications();
            let hasNewReg = false;
            items.forEach((req) => {
              const reqMsv = (req.msv || "").trim().toLowerCase();
              const currMsv = (studentMsv || "").trim().toLowerCase();
              const cleanReq = reqMsv.replace(/@.*$/, "");
              const cleanCurr = currMsv.replace(/@.*$/, "");
              if (!cleanReq || !cleanCurr || cleanReq !== cleanCurr) return;

              const reqId = req.id || req.ma_yeu_cau || "DK";
              const isApproved = req.trang_thai === "DA_DUYET" || req.trang_thai === "APPROVED";
              const isRejected = req.trang_thai === "TU_CHOI" || req.trang_thai === "REJECTED";

              if (isApproved) {
                const notifId = `reg-approved-${reqId}`;
                const rawDate = req.ngay_gui_time || (req.ngay_gui && String(req.ngay_gui).includes(":") ? req.ngay_gui : null);
                const dt = rawDate ? new Date(rawDate) : new Date();
                const formatted = formatTimeAndDate(rawDate || dt);
                const notifItem = {
                  id: notifId,
                  title: "Thông báo duyệt đăng ký phòng KTX",
                  content: `Chúc mừng bạn! Yêu cầu đăng ký nội trú của bạn đã được Ban quản lý KTX phê duyệt thành công. Bạn được xếp vào Phòng ${req.so_phong || ""}${req.toa_nha ? ` - ${req.toa_nha}` : ""}${req.so_giuong ? ` (Giường ${req.so_giuong})` : ""}.${req.ma_hop_dong ? ` Mã hợp đồng: ${req.ma_hop_dong}.` : ""}`,
                  source: "MANAGEMENT",
                  senderName: "Ban quản lý KTX",
                  type: "registration",
                  time: formatted.time,
                  date: formatted.date,
                  createdAt: dt.toISOString(),
                  isRead: false,
                  actionUrl: "/student/history",
                  actionLabel: "Kiểm tra phòng",
                  msv: cleanReq.toUpperCase(),
                };

                const existingIndex = list.findIndex((n) => n.id === notifId);
                if (existingIndex >= 0) {
                  list[existingIndex] = { ...list[existingIndex], ...notifItem };
                  hasNewReg = true;
                } else {
                  list.unshift(notifItem);
                  hasNewReg = true;
                }
              } else if (isRejected) {
                const notifId = `reg-rejected-${reqId}`;
                if (!list.some((n) => n.id === notifId)) {
                  const rawDate = req.ngay_gui_time || (req.ngay_gui && String(req.ngay_gui).includes(":") ? req.ngay_gui : null);
                  const dt = rawDate ? new Date(rawDate) : new Date();
                  const formatted = formatTimeAndDate(rawDate || dt);
                  list.unshift({
                    id: notifId,
                    title: "Thông báo đơn đăng ký phòng",
                    content: `Đơn đăng ký phòng (${req.ma_yeu_cau || reqId}) của bạn không được phê duyệt. Lý do: ${req.ly_do_tu_choi || "Hết chỗ hoặc không đáp ứng điều kiện xếp phòng."}`,
                    source: "MANAGEMENT",
                    senderName: "Ban quản lý KTX",
                    type: "registration",
                    time: formatted.time,
                    date: formatted.date,
                    createdAt: dt.toISOString(),
                    isRead: false,
                    actionUrl: "/student/register",
                    actionLabel: "Xem chi tiết",
                    msv: cleanReq.toUpperCase(),
                  });
                  hasNewReg = true;
                }
              }
            });
            if (hasNewReg) {
              this._save(list);
            }
          }
        }
      } catch (errReg) {
        console.warn("Lỗi sync registrations from backend:", errReg);
      }

      // 5. Quét backend thông tin phòng hiện tại và hợp đồng của sinh viên
      try {
        const roomRes = await fetch(`${API_URL}/student/requests/current-room?msv=${encodeURIComponent(studentMsv)}`, { headers });
        if (roomRes.ok) {
          const roomJson = await roomRes.json();
          const roomData = roomJson?.data;
          if (roomData && roomData.so_phong) {
            const list = this.getNotifications();
            const notifId = `reg-approved-${roomData.ma_hop_dong || "room"}`;
            const hasRegNotif = list.some(
              (n) =>
                n.id === notifId ||
                n.id?.startsWith("reg-approved-") ||
                (n.type === "registration" && n.title.includes("duyệt đăng ký phòng"))
            );
            if (!hasRegNotif) {
              const dateStr = roomData.ngay_nhan_phong || roomData.ngay_duyet || "19/10/2026";
              const formatted = formatTimeAndDate(dateStr);
              list.unshift({
                id: notifId,
                title: "Thông báo duyệt đăng ký phòng KTX",
                content: `Chúc mừng bạn! Yêu cầu đăng ký nội trú của bạn đã được Ban quản lý KTX phê duyệt thành công. Bạn được xếp vào Phòng ${roomData.so_phong || ""}${roomData.toa ? ` - ${roomData.toa}` : ""}${roomData.so_giuong ? ` (Giường ${roomData.so_giuong})` : ""}.${roomData.ma_hop_dong ? ` Mã hợp đồng: ${roomData.ma_hop_dong}.` : ""}`,
                source: "MANAGEMENT",
                senderName: "Ban quản lý KTX",
                type: "registration",
                time: "17:09",
                date: formatted.date,
                createdAt: new Date().toISOString(),
                isRead: false,
                actionUrl: "/student/history",
                actionLabel: "Kiểm tra phòng",
                msv: studentMsv,
              });
              this._save(list);
            }
          }
        }
      } catch (errRoom) {
        console.warn("Lỗi sync current room notification:", errRoom);
      }
    } catch (e) {
      console.warn("Lỗi syncFromBackend:", e);
    }
  }

  /**
   * Lưu danh sách vào localStorage và phát event
   */
  _save(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent("ktx-notifications-updated", { detail: list }));
    } catch (e) {
      console.error("Lỗi lưu thông báo sinh viên:", e);
    }
  }

  /**
   * Thêm một thông báo mới từ bất kỳ module nào
   */
  addNotification({
    title,
    content,
    source = "MANAGEMENT",
    senderName,
    type = "general",
    actionUrl = null,
    actionLabel = null,
    msv = null,
  }) {
    const list = this.getNotifications();
    const now = new Date();
    const formatted = formatTimeAndDate(now);

    const newNotif = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title,
      content,
      source: source === "ACCOUNTANT" ? "ACCOUNTANT" : "MANAGEMENT",
      senderName: senderName || (source === "ACCOUNTANT" ? "Phòng Kế toán" : "Ban quản lý KTX"),
      type,
      time: formatted.time,
      date: formatted.date,
      createdAt: now.toISOString(),
      isRead: false,
      actionUrl,
      actionLabel,
      msv: msv ? String(msv).toUpperCase() : null,
    };

    list.unshift(newNotif);
    this._save(list);
    return newNotif;
  }

  /**
   * Helper phát thông báo từ Ban Quản lý KTX
   */
  notifyFromManagement({ title, content, type = "general", actionUrl = null, actionLabel = null, msv = null }) {
    const targetMsv = msv || localStorage.getItem("ktx_msv") || localStorage.getItem("ktx_username") || "";
    return this.addNotification({
      title,
      content,
      source: "MANAGEMENT",
      senderName: "Ban quản lý KTX",
      type,
      actionUrl,
      actionLabel,
      msv: targetMsv ? String(targetMsv).trim().toUpperCase() : null,
    });
  }

  /**
   * Helper phát thông báo từ Phòng Kế toán
   */
  notifyFromAccountant({ title, content, type = "billing", actionUrl = "/student/payment", actionLabel = "Thanh toán ngay", msv = null }) {
    // Đồng thời lưu vào ACCOUNTANT_NOTIFS_KEY để kế toán lưu vết
    try {
      const now = new Date();
      const formatted = formatTimeAndDate(now);
      const accItem = {
        id: `acc-notif-${Date.now()}`,
        title,
        content,
        type,
        actionUrl,
        actionLabel,
        createdAt: now.toISOString(),
        time: formatted.time,
        date: formatted.date,
        msv,
      };
      const raw = localStorage.getItem(ACCOUNTANT_NOTIFS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      localStorage.setItem(ACCOUNTANT_NOTIFS_KEY, JSON.stringify([accItem, ...parsed]));
    } catch (e) {
      console.warn("Lỗi lưu accountant notification:", e);
    }

    return this.addNotification({
      title,
      content,
      source: "ACCOUNTANT",
      senderName: "Phòng Kế toán",
      type,
      actionUrl,
      actionLabel,
      msv,
    });
  }

  /**
   * Đánh dấu 1 thông báo đã đọc
   */
  markAsRead(notifId) {
    const list = this.getNotifications();
    const updated = list.map((item) => {
      if (item.id === notifId) {
        return { ...item, isRead: true };
      }
      return item;
    });
    this._save(updated);
    return updated;
  }

  /**
   * Đánh dấu 1 thông báo là chưa đọc
   */
  markAsUnread(notifId) {
    const list = this.getNotifications();
    const updated = list.map((item) => {
      if (item.id === notifId) {
        return { ...item, isRead: false };
      }
      return item;
    });
    this._save(updated);
    return updated;
  }

  /**
   * Đánh dấu toàn bộ thông báo là đã đọc
   */
  markAllAsRead() {
    const list = this.getNotifications();
    const updated = list.map((item) => ({ ...item, isRead: true }));
    this._save(updated);
    return updated;
  }

  /**
   * Xóa một thông báo
   */
  deleteNotification(notifId) {
    const list = this.getNotifications();
    const updated = list.filter((item) => item.id !== notifId);
    this._save(updated);
    return updated;
  }

  /**
   * Đếm số lượng thông báo chưa đọc
   */
  getUnreadCount() {
    const list = this.getNotifications();
    return list.filter((n) => !n.isRead).length;
  }

  /**
   * Reset về dữ liệu gốc chuẩn Figma
   */
  resetToDefault() {
    this._save([...DEFAULT_NOTIFICATIONS]);
  }
}

export const studentNotificationService = new StudentNotificationService();
export default studentNotificationService;
