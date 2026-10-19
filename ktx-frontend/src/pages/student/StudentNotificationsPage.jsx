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
} from "lucide-react";
import StudentLayout from "../../layouts/Student";
import studentNotificationService, {
  getNotificationTimestamp,
} from "../../services/studentNotificationService";

export default function StudentNotificationsPage({ onSelectTab, onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'latest'
  const [sourceFilter, setSourceFilter] = useState("ALL"); // 'ALL' | 'MANAGEMENT' | 'ACCOUNTANT'
  const [selectedNotification, setSelectedNotification] = useState(null);

  // Lấy tên sinh viên hiển thị
  const studentName =
    localStorage.getItem("ktx_fullname") ||
    localStorage.getItem("ktx_username") ||
    "Nguyễn Văn A";

  const loadData = async () => {
    const list = studentNotificationService.getNotifications();
    setNotifications([...list]);
    try {
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

    window.addEventListener("ktx-notifications-updated", handleUpdate);
    window.addEventListener("ktx-announcements-updated", handleUpdate);
    window.addEventListener("occupancy-updated", handleUpdate);
    window.addEventListener("student-account-updated", handleUpdate);
    window.addEventListener("ktx-payment-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
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
    setSelectedNotification({ ...item, isRead: true });
    loadData();
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

                        {/* Tag nguồn: Ban quản lý KTX hay Phòng Kế toán */}
                        {item.source === "ACCOUNTANT" ? (
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
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 relative">
            {/* Nút đóng */}
            <button
              type="button"
              onClick={() => setSelectedNotification(null)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
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
                  {selectedNotification.source === "ACCOUNTANT" ? (
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

            {/* Nội dung chi tiết */}
            <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-700 text-sm leading-relaxed whitespace-pre-line">
              {selectedNotification.content}
            </div>

            {/* Footer hành động */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleMarkAsUnread(selectedNotification.id)}
                className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                title="Đánh dấu thông báo này là chưa đọc"
              >
                Đánh dấu chưa đọc
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedNotification(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Đóng
                </button>

                {selectedNotification.actionUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      handleActionNavigate(selectedNotification.actionUrl)
                    }
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-[#0084FF] hover:bg-[#0073e6] text-white shadow-sm transition cursor-pointer"
                  >
                    <span>
                      {selectedNotification.actionLabel || "Xem chi tiết"}
                    </span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
