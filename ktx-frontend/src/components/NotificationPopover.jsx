import React, { useState, useEffect, useRef } from "react";
import {
  Bell,
  CheckCheck,
  X,
  AlertTriangle,
  UserPlus,
  ArrowLeftRight,
  LogOut,
  Receipt,
  BadgeCheck,
  CreditCard,
  Clock,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";

/**
 * Helper format thời gian tương đối
 */
function formatRelativeTime(dateStr) {
  if (!dateStr) return "Vừa xong";
  const now = new Date();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 60) return "Vừa xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/**
 * Helper render icon tương ứng với category
 */
function renderCategoryIcon(category, badgeColor) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    cyan: "bg-cyan-50 text-cyan-600 border-cyan-200",
    amber: "bg-amber-50 text-amber-600 border-amber-200",
    rose: "bg-rose-50 text-rose-600 border-rose-200",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-200",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-200",
    violet: "bg-violet-50 text-violet-600 border-violet-200",
  };
  const colorClass = colorMap[badgeColor] || "bg-slate-50 text-slate-600 border-slate-200";

  switch (category) {
    case "ROOM_REGISTRATION":
      return (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${colorClass}`}>
          <UserPlus className="w-4 h-4" />
        </div>
      );
    case "ROOM_TRANSFER":
      return (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${colorClass}`}>
          <ArrowLeftRight className="w-4 h-4" />
        </div>
      );
    case "ROOM_CHECKOUT":
      return (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${colorClass}`}>
          <LogOut className="w-4 h-4" />
        </div>
      );
    case "INCIDENT_REPORT":
      return (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${colorClass}`}>
          <AlertTriangle className="w-4 h-4" />
        </div>
      );
    case "INVOICE_GENERATION":
      return (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${colorClass}`}>
          <Receipt className="w-4 h-4" />
        </div>
      );
    case "PAYMENT_RECONCILE":
      return (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${colorClass}`}>
          <BadgeCheck className="w-4 h-4" />
        </div>
      );
    case "DEPOSIT_REFUND":
      return (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${colorClass}`}>
          <CreditCard className="w-4 h-4" />
        </div>
      );
    default:
      return (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${colorClass}`}>
          <Bell className="w-4 h-4" />
        </div>
      );
  }
}

export default function NotificationPopover({
  isOpen,
  onClose,
  role = "admin", // "admin" | "accountant"
  notifications = [],
  unreadCount = 0,
  actionRequiredCount = 0,
  onMarkAllAsRead,
  onNotificationClick,
  onQuickAction,
  onViewAll,
}) {
  const [activeTab, setActiveTab] = useState("all"); // "all" | "action" | "unread"
  const popoverRef = useRef(null);

  // Đóng khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose && onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Lọc thông báo theo tab
  const filteredList = notifications.filter((item) => {
    if (activeTab === "action") return item.status === "ACTION_REQUIRED";
    if (activeTab === "unread") return !item.isRead;
    return true;
  });

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 w-[420px] max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 select-none"
      style={{ maxHeight: "580px" }}
    >
      {/* 1. HEADER POPOVER */}
      <div className="p-4 pb-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-sm">Trung tâm thông báo</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-bold bg-blue-100 text-blue-700 rounded-full">
                  {unreadCount} mới
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {role === "admin" ? "Ban Quản lý KTX" : "Phòng Kế toán"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition flex items-center gap-1 cursor-pointer"
              title="Đánh dấu tất cả là đã đọc"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Đã đọc hết</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. SUB-NAVIGATION TABS */}
      <div className="px-3 pt-2 pb-1 border-b border-slate-100 flex items-center gap-1.5 text-xs bg-white">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            activeTab === "all"
              ? "bg-slate-900 text-white shadow-xs font-semibold"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          Tất cả ({notifications.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("action")}
          className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "action"
              ? "bg-amber-500 text-white shadow-xs font-semibold"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <span>Cần xử lý</span>
          {actionRequiredCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === "action" ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-700"
              }`}
            >
              {actionRequiredCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("unread")}
          className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
            activeTab === "unread"
              ? "bg-blue-600 text-white shadow-xs font-semibold"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          Chưa đọc ({unreadCount})
        </button>
      </div>

      {/* 3. DANH SÁCH THÔNG BÁO (Scrollable) */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1.5">
        {filteredList.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-2.5">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Không có thông báo mới</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Hiện tại không có thông báo hay công việc tồn đọng nào cần xử lý.
            </p>
          </div>
        ) : (
          filteredList.map((item) => {
            const isUnread = !item.isRead;
            const isUrgent = item.priority === "URGENT";
            const isActionRequired = item.status === "ACTION_REQUIRED";

            return (
              <div
                key={item.id}
                onClick={() => onNotificationClick && onNotificationClick(item)}
                className={`p-3 rounded-xl transition cursor-pointer relative group flex gap-3 ${
                  isUnread
                    ? "bg-blue-50/40 hover:bg-blue-50/70"
                    : "hover:bg-slate-50"
                }`}
              >
                {/* Chấm tròn chưa đọc */}
                {isUnread && (
                  <span className="absolute top-3.5 right-3 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-white"></span>
                )}

                {/* Icon nghiệp vụ */}
                {renderCategoryIcon(item.category, item.avatarOrIcon?.badgeColor)}

                {/* Nội dung thông báo */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    {isUrgent && (
                      <span className="px-1.5 py-0.2 text-[10px] font-bold bg-rose-100 text-rose-700 rounded">
                        KHẨN CẤP
                      </span>
                    )}
                    {item.status === "ACTION_RESOLVED" && (
                      <span className="px-1.5 py-0.2 text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded">
                        Đã xử lý ✓
                      </span>
                    )}
                    <h4
                      className={`text-xs tracking-tight line-clamp-1 ${
                        isUnread ? "font-bold text-slate-900" : "font-medium text-slate-700"
                      }`}
                    >
                      {item.title}
                    </h4>
                  </div>

                  <p className="text-[12px] text-slate-500 line-clamp-2 leading-relaxed">
                    {item.previewText}
                  </p>

                  <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(item.createdAt)}
                    </span>

                    {/* Duy nhất 1 nút Xem chi tiết theo yêu cầu */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNotificationClick && onNotificationClick(item);
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg transition shadow-2xs cursor-pointer bg-slate-50 hover:bg-blue-600 hover:text-white text-slate-700 border border-slate-200"
                      >
                        Xem chi tiết
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. FOOTER POPOVER */}
      <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
        <button
          type="button"
          onClick={() => {
            onClose && onClose();
            onViewAll && onViewAll();
          }}
          className="w-full py-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1 hover:underline cursor-pointer"
        >
          <span>Xem tất cả thông báo chi tiết trong trang quản lý</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
