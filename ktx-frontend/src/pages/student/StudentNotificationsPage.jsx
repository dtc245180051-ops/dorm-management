import React, { useState, useEffect } from "react";
import {
  Bell,
  ArrowLeftRight,
  CreditCard,
  Bed,
  Calendar,
  CheckCircle2,
  Clock,
  Building2,
  DollarSign,
  AlertCircle,
  ExternalLink,
  X,
  Check,
  Filter,
  Sparkles,
  AlertTriangle,
  Scale,
  Send,
  Paperclip,
  MapPin,
  Users,
  FileText,
} from "lucide-react";
import StudentLayout from "../../layouts/Student";
import studentNotificationService, {
  getNotificationTimestamp,
} from "../../services/studentNotificationService";
import api from "../../services/api";

export default function StudentNotificationsPage({ onSelectTab, onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'latest'
  const [sourceFilter, setSourceFilter] = useState("ALL"); // 'ALL' | 'MANAGEMENT' | 'ACCOUNTANT'
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [viewingTicketModal, setViewingTicketModal] = useState(null);
  const [explanationText, setExplanationText] = useState("");
  const [isEditingExplanation, setIsEditingExplanation] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Lấy tên sinh viên hiển thị
  const studentName =
    localStorage.getItem("ktx_fullname") ||
    localStorage.getItem("ktx_username") ||
    "Nguyễn Văn A";

  const loadData = async () => {
    try {
      const initial = studentNotificationService.getNotifications();
      if (notifications.length === 0) {
        setNotifications([...initial]);
      }
      await studentNotificationService.syncViolations();
      await studentNotificationService.syncFromBackend();
      const updated = studentNotificationService.getNotifications();
      setNotifications([...updated]);
    } catch (_) {}
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    // Quét định kỳ mỗi 30 giây và khi quay lại tab để nhận thông báo tức thì khi Quản lý thao tác
    const intervalId = setInterval(handleUpdate, 30000);
    window.addEventListener("focus", handleUpdate);

    window.addEventListener("ktx-notifications-updated", handleUpdate);
    window.addEventListener("ktx-announcements-updated", handleUpdate);
    window.addEventListener("occupancy-updated", handleUpdate);
    window.addEventListener("student-account-updated", handleUpdate);
    window.addEventListener("ktx-payment-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", handleUpdate);
      window.removeEventListener("ktx-notifications-updated", handleUpdate);
      window.removeEventListener("ktx-announcements-updated", handleUpdate);
      window.removeEventListener("occupancy-updated", handleUpdate);
      window.removeEventListener("student-account-updated", handleUpdate);
      window.removeEventListener("ktx-payment-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Xử lý khi nhấn vào thông báo (tự động đọc và cập nhật lên chuông)
  const handleItemClick = (item) => {
    if (!item.isRead) {
      studentNotificationService.markAsRead(item.id);
    }
    const currentExp =
      item.meta?.studentExplanation ||
      (item.meta?.ma_bb
        ? localStorage.getItem(`ktx_violation_explanation_${item.meta.ma_bb}`)
        : "");
    setExplanationText(currentExp || "");
    setIsEditingExplanation(false);
    setSelectedNotification({
      ...item,
      isRead: true,
      meta: {
        ...(item.meta || {}),
        studentExplanation: currentExp || item.meta?.studentExplanation || null,
      },
    });
    loadData();
  };

  // Gửi bản giải trình của sinh viên
  const handleSubmitExplanation = async (notif) => {
    if (!explanationText.trim()) {
      alert("Vui lòng nhập nội dung giải trình hoặc ý kiến phản hồi.");
      return;
    }
    const nowStr = new Date().toLocaleString("vi-VN");
    const updatedMeta = {
      ...(notif.meta || {}),
      studentExplanation: explanationText.trim(),
      studentExplanationAt: nowStr,
    };

    // 1. Lưu vào service
    studentNotificationService.updateNotification(notif.id, {
      meta: updatedMeta,
    });

    // 2. Lưu vào localStorage cho Admin xem được theo mã biên bản
    if (notif.meta?.ma_bb) {
      localStorage.setItem(
        `ktx_violation_explanation_${notif.meta.ma_bb}`,
        explanationText.trim(),
      );
      localStorage.setItem(
        `ktx_violation_explanation_at_${notif.meta.ma_bb}`,
        nowStr,
      );
      window.dispatchEvent(
        new CustomEvent("ktx-violation-explanation-updated", {
          detail: {
            ma_bb: notif.meta.ma_bb,
            explanation: explanationText.trim(),
            at: nowStr,
          },
        }),
      );

      // 3. Đồng bộ trực tiếp vào CSDL backend qua API
      try {
        await api.put(`/incidents/violations/${notif.meta.ma_bb}`, {
          giai_trinh: explanationText.trim(),
          giai_trinh_at: nowStr,
        });
      } catch (err) {
        console.warn("Lỗi lưu giải trình vào API backend:", err);
      }
    }

    setSelectedNotification((prev) => ({
      ...prev,
      meta: updatedMeta,
    }));
    setIsEditingExplanation(false);
    loadData();
    showToast(
      "Đã gửi bản giải trình thành công! Ban quản lý KTX sẽ tiếp nhận và xem xét.",
    );
  };

  // Đánh dấu lại là chưa đọc
  const handleMarkAsUnread = (notifId) => {
    studentNotificationService.markAsUnread(notifId);
    setSelectedNotification(null);
    loadData();
  };

  // Lọc thông báo
  const filteredNotifications = notifications.filter((item) => {
    if (sourceFilter !== "ALL" && item.source !== sourceFilter) {
      return false;
    }

    // Tab "Mới nhất": Chỉ hiển thị thông báo trong 3 ngày gần nhất
    if (activeTab === "latest") {
      const itemTs = getNotificationTimestamp(item);
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      const refTime = notifications.reduce(
        (max, n) => Math.max(max, getNotificationTimestamp(n)),
        Date.now(),
      );
      if (!itemTs || refTime - itemTs > threeDaysMs) {
        return false;
      }
    }

    // Tab "Chưa đọc": Chỉ hiển thị thông báo chưa đọc
    if (activeTab === "unread") {
      if (item.isRead) {
        return false;
      }
    }

    return true;
  });

  // Phân trang hiển thị 10 thông báo ban đầu
  const [visibleCount, setVisibleCount] = useState(10);

  // Tự động reset về 10 khi đổi tab hoặc bộ lọc
  useEffect(() => {
    setVisibleCount(10);
  }, [activeTab, sourceFilter]);

  // Luôn sắp xếp thông báo mới nhất lên đầu theo timestamp thực tế
  const sortedList = [...filteredNotifications].sort((a, b) => {
    return getNotificationTimestamp(b) - getNotificationTimestamp(a);
  });

  // Danh sách hiển thị theo số lượng hiện tại
  const visibleList = sortedList.slice(0, visibleCount);
  const hasMore = sortedList.length > visibleCount;

  // Số lượng thông báo chưa đọc
  const totalUnreadCount = notifications.filter((n) => !n.isRead).length;

  // Render Icon theo loại thông báo chuẩn theo ảnh Figma
  const renderIcon = (type, source) => {
    switch (type) {
      case "violation_warning":
      case "warning":
        return (
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0 shadow-xs">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        );
      case "violation_summon":
      case "discipline_urgent":
        return (
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#FFE4E6] text-[#E11D48] flex items-center justify-center shrink-0 shadow-xs">
            <Scale className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        );
      case "violation_resolved":
      case "discipline_resolved":
        return (
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        );
      case "transfer":
        return (
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#E8F8F0] text-[#10B981] flex items-center justify-center shrink-0 shadow-xs">
            <ArrowLeftRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        );
      case "billing":
        return (
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#F3E8FF] text-[#9333EA] flex items-center justify-center shrink-0 shadow-xs">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        );
      case "registration":
        return (
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center shrink-0 shadow-xs">
            <Bed className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        );
      case "inspection":
        return (
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center shrink-0 shadow-xs">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        );
      default:
        return source === "ACCOUNTANT" ? (
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#F3E8FF] text-[#9333EA] flex items-center justify-center shrink-0 shadow-xs">
            <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        ) : (
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center shrink-0 shadow-xs">
            <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        );
    }
  };

  const handleActionNavigate = (url) => {
    if (!url) return;
    setSelectedNotification(null);
    if (onNavigate) {
      onNavigate(url);
    } else {
      window.history.pushState({}, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(
        new CustomEvent("student-navigate", { detail: { path: url } }),
      );
    }
  };

  return (
    <StudentLayout
      activeTab="dashboard"
      onSelectTab={onSelectTab}
      userName={studentName}
      userRole="Sinh viên"
    >
      <div className="w-full max-w-6xl mx-auto pb-4 flex-1 flex flex-col min-h-0">
        {/* CSS tùy biến thanh cuộn nằm sát mép phải gọn đẹp */}
        <style>{`
          .custom-notif-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-notif-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-notif-scrollbar::-webkit-scrollbar-thumb {
            background: #CBD5E1;
            border-radius: 9999px;
          }
          .custom-notif-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #94A3B8;
          }
        `}</style>

        {/* Card trắng chính theo chuẩn thiết kế Figma */}
        <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-sm transition-all flex flex-col h-[calc(100vh-140px)] min-h-[520px] max-h-[860px] overflow-hidden">
          
          {/* Phần cố định (Header Banner & Hàng bộ lọc khoanh đỏ) */}
          <div className="p-5 sm:p-7 pb-4 border-b border-slate-100 shrink-0 bg-white z-10">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Biểu tượng chuông xanh trên nền bo tròn mềm mại */}
              <div className="w-14 h-14 rounded-2xl bg-[#E8F2FF] flex items-center justify-center text-[#0084FF] shrink-0 shadow-xs">
                <svg
                  className="w-7 h-7 fill-current"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                </svg>
              </div>

              <div>
                <h1 className="text-2xl sm:text-[26px] font-bold text-slate-800 tracking-tight leading-none">
                  Thông báo
                </h1>
                <p className="text-sm sm:text-[14px] text-slate-500 mt-1.5">
                  Cập nhật những thông tin mới nhất từ Ban quản lý KTX dành cho bạn.
                </p>
              </div>
            </div>
          </div>

          {/* Hàng bộ lọc: Nút "Tất cả", "Mới nhất", "Chưa đọc" */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
              {/* Nút Tất cả */}
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`px-5 sm:px-6 py-2 rounded-full text-sm font-semibold transition-all shadow-xs cursor-pointer ${
                  activeTab === "all"
                    ? "bg-[#0084FF] text-white hover:bg-[#0073e6]"
                    : "bg-[#F1F5F9] text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                }`}
              >
                Tất cả
              </button>

              {/* Nút Mới nhất */}
              <button
                type="button"
                onClick={() => setActiveTab("latest")}
                className={`px-5 sm:px-6 py-2 rounded-full text-sm font-semibold transition-all shadow-xs cursor-pointer ${
                  activeTab === "latest"
                    ? "bg-[#0084FF] text-white hover:bg-[#0073e6]"
                    : "bg-[#F1F5F9] text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                }`}
                title="Thông báo trong 3 ngày gần nhất"
              >
                Mới nhất
              </button>

              {/* Nút Chưa đọc */}
              <button
                type="button"
                onClick={() => setActiveTab("unread")}
                className={`px-5 sm:px-6 py-2 rounded-full text-sm font-semibold transition-all shadow-xs cursor-pointer flex items-center gap-2 ${
                  activeTab === "unread"
                    ? "bg-[#0084FF] text-white hover:bg-[#0073e6]"
                    : "bg-[#F1F5F9] text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                }`}
                title="Chỉ xem các thông báo chưa đọc"
              >
                <span>Chưa đọc</span>
                {totalUnreadCount > 0 && (
                  <span
                    className={`min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold flex items-center justify-center leading-none ${
                      activeTab === "unread"
                        ? "bg-white text-[#0084FF]"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {totalUnreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Bộ lọc nguồn: Quản lý KTX / Kế toán */}
            <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl text-xs sm:text-sm">
              <button
                type="button"
                onClick={() => setSourceFilter("ALL")}
                className={`px-3 py-1 rounded-lg font-medium transition ${
                  sourceFilter === "ALL"
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Toàn bộ
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter("MANAGEMENT")}
                className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1 transition ${
                  sourceFilter === "MANAGEMENT"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-500 hover:text-emerald-700"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Quản lý KTX
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter("ACCOUNTANT")}
                className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1 transition ${
                  sourceFilter === "ACCOUNTANT"
                    ? "bg-white text-purple-700 shadow-xs"
                    : "text-slate-500 hover:text-purple-700"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                Kế toán
              </button>
            </div>
          </div>
        </div>

        {/* Danh sách Thẻ Thông báo có thanh cuộn nằm sát mép phải */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 pr-3 sm:pr-4 space-y-3.5 focus:outline-none custom-notif-scrollbar">
            {sortedList.length > 0 ? (
              <>
                {visibleList.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`border rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 transition-all duration-200 cursor-pointer group ${
                    !item.isRead
                      ? "bg-blue-50/20 border-blue-200 hover:border-blue-400 hover:shadow-sm"
                      : "bg-white border-slate-200/90 hover:border-blue-300 hover:shadow-sm"
                  }`}
                >
                  {/* Cột Trái: Icon + Tiêu đề + Nội dung */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {renderIcon(item.type, item.source)}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-base sm:text-[17px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                          {item.title}
                        </h2>

                        {/* Tag nguồn hoặc tag kịch bản vi phạm */}
                        {item.type === "violation_warning" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            Nhắc nhở vi phạm
                          </span>
                        ) : item.type === "violation_summon" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                            Triệu tập kỷ luật
                          </span>
                        ) : item.type === "violation_resolved" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            Đã xử lý dứt điểm
                          </span>
                        ) : item.source === "ACCOUNTANT" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                            Phòng Kế toán
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            Ban quản lý KTX
                          </span>
                        )}

                        {/* Chấm xanh chưa đọc */}
                        {!item.isRead && (
                          <span
                            className="w-2 h-2 rounded-full bg-blue-600"
                            title="Thông báo mới chưa đọc"
                          ></span>
                        )}
                      </div>

                      <p className="text-xs sm:text-[13.5px] text-slate-500 leading-relaxed mt-1 line-clamp-2">
                        {item.content}
                      </p>
                    </div>
                  </div>

                  {/* Cột Phải: Giờ và Ngày */}
                  <div className="text-right shrink-0 select-none pl-2">
                    <div className="text-xs sm:text-[13px] text-slate-400 font-medium">
                      {item.time || "12:00"}
                    </div>
                    <div className="text-xs sm:text-[13px] text-slate-400 font-medium mt-0.5">
                      {item.date || "01/09/2026"}
                    </div>
                  </div>
                </div>
              ))}

              {/* Nút Xem thêm hoặc thông báo đã xem hết */}
              {hasMore ? (
                <div className="pt-3 pb-4 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 10)}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-blue-600 bg-blue-50/90 hover:bg-blue-100 hover:text-blue-700 transition cursor-pointer active:scale-95 shadow-xs border border-blue-200/60"
                  >
                    <span>Xem thêm</span>
                    <span className="text-xs bg-blue-200/70 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                      +{sortedList.length - visibleCount > 10 ? 10 : sortedList.length - visibleCount}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="pt-4 pb-6 text-center select-none">
                  <p className="text-xs sm:text-sm text-slate-400 font-medium">
                    Bạn đã xem hết thông báo
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 my-auto">
              <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-700">
                {activeTab === "unread"
                  ? "Không có thông báo chưa đọc nào"
                  : activeTab === "latest"
                    ? "Không có thông báo mới trong 3 ngày qua"
                    : "Không có thông báo nào"}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {activeTab === "unread"
                  ? "Bạn đã đọc hết tất cả thông báo hiện có."
                  : "Bạn sẽ nhận được thông báo từ Ban quản lý KTX và Phòng Kế toán khi có cập nhật mới."}
              </p>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Modal Xem chi tiết Thông báo */}
      {selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            {/* Nút đóng */}
            <button
              type="button"
              onClick={() => setSelectedNotification(null)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header modal */}
            <div className="flex items-start gap-4">
              {renderIcon(
                selectedNotification.type,
                selectedNotification.source,
              )}
              <div className="pr-6">
                <div className="flex items-center gap-2 mb-1">
                  {selectedNotification.type === "violation_warning" ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      Cảnh báo vi phạm
                    </span>
                  ) : selectedNotification.type === "violation_summon" ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200">
                      Triệu tập Hội đồng
                    </span>
                  ) : selectedNotification.type === "violation_resolved" ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      Đã xử lý dứt điểm
                    </span>
                  ) : selectedNotification.source === "ACCOUNTANT" ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                      Phòng Kế toán
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                      Ban quản lý KTX
                    </span>
                  )}
                  <span className="text-xs text-slate-400">
                    {selectedNotification.time} • {selectedNotification.date}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-snug">
                  {selectedNotification.title}
                </h3>
              </div>
            </div>

            {/* Nội dung chi tiết theo từng Kịch bản */}
            {selectedNotification.type === "violation_warning" ||
            selectedNotification.meta?.scenario === 1 ||
            selectedNotification.title.includes("ghi nhận vi phạm") ? (
              /* KỊCH BẢN 1: Chờ sinh viên giải trình */
              <div className="mt-5 flex flex-col gap-4">
                {/* Thông báo tóm tắt */}
                <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl text-xs sm:text-sm text-amber-950 leading-relaxed font-medium">
                  {selectedNotification.content}
                </div>

                {/* Khối chi tiết biên bản */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-2.5 text-xs sm:text-sm">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-600" />
                    Chi tiết biên bản vi phạm
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                    <div>
                      <span className="text-slate-500 font-medium">Mã biên bản: </span>
                      <span className="font-bold text-slate-900">
                        {selectedNotification.meta?.ma_bb || "VP-5242D61FF355"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Ngày ghi nhận: </span>
                      <span className="font-semibold text-slate-900">
                        {selectedNotification.meta?.ngay || selectedNotification.date || "20/10/2026"}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-500 font-medium">Hành vi vi phạm: </span>
                      <span className="font-semibold text-rose-700">
                        {selectedNotification.meta?.hanh_vi || "Dùng đồ có công suất lớn trong phòng"}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-500 font-medium">Địa điểm ghi nhận: </span>
                      <span className="font-semibold text-slate-900">
                        {selectedNotification.meta?.dia_diem || "Phòng 203 - Tòa B"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Khu vực Gửi bản giải trình / Ý kiến phản hồi */}
                <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-blue-600" />
                    <span>Gửi bản giải trình / Ý kiến phản hồi</span>
                  </label>

                  {selectedNotification.meta?.studentExplanation && !isEditingExplanation ? (
                    <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Đã gửi bản giải trình tới Ban quản lý
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsEditingExplanation(true)}
                          className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                        >
                          Sửa nội dung
                        </button>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-800 bg-white/90 p-3 rounded-xl border border-emerald-100 whitespace-pre-line font-medium leading-relaxed">
                        {selectedNotification.meta.studentExplanation}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-emerald-700 pt-0.5">
                        <span>Gửi lúc: {selectedNotification.meta.studentExplanationAt || "Vừa xong"}</span>
                        <span className="font-semibold">Đang chờ Ban quản lý xem xét</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      <p className="text-xs text-slate-500">
                        Sinh viên trình bày rõ lý do hoặc ý kiến của mình về vụ việc để Ban quản lý xem xét trước khi đưa ra quyết định tiếp theo:
                      </p>
                      <textarea
                        rows={3}
                        value={explanationText}
                        onChange={(e) => setExplanationText(e.target.value)}
                        placeholder="Ví dụ: Em xin giải trình về việc sử dụng thiết bị do không nắm rõ quy định công suất định mức. Em xin nhận khuyết điểm và cam kết không tái phạm..."
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none transition leading-relaxed"
                      />

                      {/* Gợi ý nhanh */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-slate-400">Gợi ý nhanh:</span>
                        {[
                          "Em xin nhận khuyết điểm và cam kết không tái phạm",
                          "Em mượn thiết bị của bạn và đã cất đi ngay",
                          "Em xin nộp bản tự kiểm điểm trực tiếp tại văn phòng",
                        ].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => {
                              const sep = explanationText.trim() ? " " : "";
                              setExplanationText((prev) => `${prev.trim()}${sep}${chip}.`);
                            }}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200 transition cursor-pointer"
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        {isEditingExplanation && (
                          <button
                            type="button"
                            onClick={() => setIsEditingExplanation(false)}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition cursor-pointer"
                          >
                            Hủy sửa
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleSubmitExplanation(selectedNotification)}
                          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm flex items-center gap-2 cursor-pointer active:scale-98 transition"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Gửi bản giải trình / Ý kiến phản hồi</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : selectedNotification.type === "violation_summon" ||
              selectedNotification.meta?.scenario === 2 ||
              selectedNotification.title.includes("triệu tập Hội đồng") ? (
              /* KỊCH BẢN 2: Lên lịch triệu tập Hội đồng kỷ luật */
              <div className="mt-5 flex flex-col gap-4">
                <div className="p-3.5 bg-rose-50/80 border border-rose-200/80 rounded-2xl text-xs sm:text-sm text-rose-950 leading-relaxed font-medium">
                  {selectedNotification.content}
                </div>

                {/* Bảng lịch hẹn triệu tập rõ ràng */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5">
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-rose-600" />
                      Lịch triệu tập Hội đồng Kỷ luật
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                      Bắt buộc tham dự
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                    <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Thời gian triệu tập
                        </span>
                        <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                          {selectedNotification.meta?.thoi_gian || "08:30 - 22/10/2026"}
                        </span>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Địa điểm tổ chức
                        </span>
                        <span className="text-sm font-bold text-slate-900 mt-0.5 block">
                          {selectedNotification.meta?.dia_diem || "Văn phòng Ban quản lý KTX"}
                        </span>
                      </div>
                    </div>

                    {selectedNotification.meta?.thanh_phan && (
                      <div className="sm:col-span-2 bg-white p-3 rounded-xl border border-slate-200/80 flex items-start gap-2.5">
                        <Users className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            Thành phần tham gia
                          </span>
                          <span className="text-xs sm:text-sm font-medium text-slate-800 mt-0.5 block">
                            {selectedNotification.meta.thanh_phan}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Yêu cầu mang theo */}
                  <div className="p-3 bg-amber-50 border border-amber-200/90 rounded-xl text-xs text-amber-900 leading-relaxed flex items-start gap-2">
                    <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-0.5">Yêu cầu đối với sinh viên:</span>
                      {selectedNotification.meta?.yeu_cau ||
                        "Yêu cầu sinh viên có mặt đúng giờ quy định, mang theo Thẻ sinh viên và nộp bản tự kiểm điểm."}
                    </div>
                  </div>
                </div>
              </div>
            ) : selectedNotification.type === "violation_resolved" ||
              selectedNotification.meta?.scenario === 3 ||
              selectedNotification.title.includes("Kết quả xử lý vi phạm") ? (
              /* KỊCH BẢN 3: Đã xử lý dứt điểm */
              <div className="mt-5 flex flex-col gap-4">
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl text-xs sm:text-sm text-emerald-950 leading-relaxed font-medium">
                  {selectedNotification.content}
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5 text-xs sm:text-sm">
                  <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Quyết định xử lý chính thức
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      Hồ sơ đã đóng
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-200/80">
                    <span className="text-slate-500 font-medium">Hình thức kỷ luật:</span>
                    <span className="font-bold text-rose-700 bg-rose-50 px-3 py-1 rounded-lg border border-rose-200 text-xs sm:text-sm">
                      {(() => {
                        const raw = selectedNotification.meta?.hinh_thuc;
                        if (typeof raw === "string" && raw.trim().startsWith("{")) {
                          try {
                            const parsed = JSON.parse(raw);
                            return parsed.quyet_dinh || "Cảnh cáo toàn KTX";
                          } catch (_) {}
                        }
                        return raw || "Cảnh cáo toàn KTX";
                      })()}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 flex flex-col gap-1">
                    <span className="text-slate-500 font-medium">Quyết định / Kết luận của Hội đồng:</span>
                    <p className="text-slate-800 font-medium leading-relaxed whitespace-pre-line">
                      {(() => {
                        const raw = selectedNotification.meta?.ket_luan;
                        if (!raw) return "Vụ việc vi phạm đã được xử lý hoàn tất theo quy chế nội trú KTX ICTU. Hồ sơ vi phạm đã được đóng dứt điểm.";
                        if (typeof raw === "string" && raw.trim().startsWith("{")) {
                          try {
                            const parsed = JSON.parse(raw);
                            return parsed.ket_luan || parsed.ghi_chu || "Đã đóng hồ sơ vụ việc.";
                          } catch (_) {}
                        }
                        return raw;
                      })()}
                    </p>
                  </div>

                  {(() => {
                    let fileVal = selectedNotification.meta?.file;
                    if (!fileVal && typeof selectedNotification.meta?.ket_luan === "string" && selectedNotification.meta.ket_luan.includes('"file":')) {
                      try {
                        const parsed = JSON.parse(selectedNotification.meta.ket_luan);
                        fileVal = parsed.file;
                      } catch (_) {}
                    }
                    if (!fileVal) return null;
                    return (
                      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200/80">
                        <span className="text-slate-500 font-medium">Biên bản đính kèm:</span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 text-xs font-bold">
                          <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                          {fileVal}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              /* Thông báo mặc định */
              <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                {selectedNotification.content}
              </div>
            )}

            {/* Footer hành động */}
            <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Đóng
              </button>

              {/* Bỏ nút 'Xem & Gửi giải trình' ở Kịch bản 1 (vì đã có nút Gửi bản giải trình phía trên) */}
              {selectedNotification.actionUrl &&
                selectedNotification.type !== "violation_warning" &&
                selectedNotification.meta?.scenario !== 1 &&
                !selectedNotification.title?.includes("ghi nhận vi phạm") && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedNotification.type === "violation_summon" || selectedNotification.id?.includes("violation")) {
                        setViewingTicketModal(selectedNotification);
                      } else {
                        handleActionNavigate(selectedNotification.actionUrl);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-[#0084FF] hover:bg-[#0073e6] text-white shadow-sm transition cursor-pointer"
                  >
                    <span>
                      {selectedNotification.type === "violation_summon"
                        ? "Xem chi tiết biên bản"
                        : selectedNotification.actionLabel || "Xem chi tiết"}
                    </span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
            </div>
          </div>
        </div>
      )}
      {/* Modal Chi tiết Biên bản vi phạm */}
      {viewingTicketModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setViewingTicketModal(null)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Chi tiết biên bản vi phạm kỷ luật KTX
                </h3>
                <p className="text-xs text-slate-500">
                  Hồ sơ xử lý vi phạm nội quy nội trú ký túc xá
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 text-xs sm:text-sm">
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/70">
                <span className="text-slate-500 font-medium">Mã biên bản:</span>
                <span className="font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  {viewingTicketModal.meta?.ma_bb || "VP-5242D61FF355"}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/70">
                <span className="text-slate-500 font-medium">Sinh viên lập biên bản:</span>
                <span className="font-bold text-slate-900">
                  {viewingTicketModal.meta?.ho_ten || "Ngô Phương Mai"} ({viewingTicketModal.meta?.msv || viewingTicketModal.msv || "DTC245180037"})
                </span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/70">
                <span className="text-slate-500 font-medium">Hành vi vi phạm:</span>
                <span className="font-bold text-rose-700 text-right max-w-[65%]">
                  {viewingTicketModal.meta?.hanh_vi || "DÙNG ĐỒ CÓ CÔNG SUẤT LỚN TRONG PHÒNG"}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/70">
                <span className="text-slate-500 font-medium">Thời điểm ghi nhận:</span>
                <span className="font-semibold text-slate-800">
                  {viewingTicketModal.time || "13:01"} - {viewingTicketModal.date || "20/10/2026"}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-200/70">
                <span className="text-slate-500 font-medium">Địa điểm lập biên bản:</span>
                <span className="font-semibold text-slate-800">
                  {viewingTicketModal.meta?.dia_diem || "Phòng 101 - Tòa A1, Ký túc xá"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Trạng thái xử lý:</span>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Đang triệu tập Hội đồng kỷ luật
                </span>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingTicketModal(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
