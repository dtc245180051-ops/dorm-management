import React, { useState, useEffect } from "react";
import { Search, Bell, User } from "lucide-react";
import NotificationPopover from "./NotificationPopover";
import adminNotificationService from "../services/adminNotificationService";

export default function Header({
  searchTerm = "",
  onSearchChange,
  userName = "QL",
  onSelectTab,
}) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [notifications, setNotifications] = useState(() =>
    adminNotificationService.getNotifications()
  );
  const [unreadCount, setUnreadCount] = useState(() =>
    adminNotificationService.getUnreadCount()
  );
  const [actionRequiredCount, setActionRequiredCount] = useState(() =>
    adminNotificationService.getActionRequiredCount()
  );

  useEffect(() => {
    const handleUpdate = () => {
      setNotifications(adminNotificationService.getNotifications());
      setUnreadCount(adminNotificationService.getUnreadCount());
      setActionRequiredCount(adminNotificationService.getActionRequiredCount());
    };

    handleUpdate();
    adminNotificationService.syncFromSystem().then(handleUpdate);

    // Lắng nghe cập nhật (CHỈ đọc lại từ service, KHÔNG gọi syncFromSystem để tránh lặp vô tận)
    window.addEventListener("admin-notifications-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    const handleExternalSync = () => {
      adminNotificationService.syncFromSystem().then(handleUpdate);
    };
    window.addEventListener("occupancy-updated", handleExternalSync);

    const intervalId = setInterval(handleExternalSync, 30000);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("admin-notifications-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("occupancy-updated", handleExternalSync);
    };
  }, []);

  const handleMarkAllAsRead = () => {
    adminNotificationService.markAllAsRead();
    setNotifications(adminNotificationService.getNotifications());
    setUnreadCount(0);
  };

  const handleNotificationClick = (item) => {
    adminNotificationService.markAsRead(item.id);
    setNotifications(adminNotificationService.getNotifications());
    setUnreadCount(adminNotificationService.getUnreadCount());

    setIsPopoverOpen(false);
    if (item.deepLink?.targetUrl) {
      const url = item.deepLink.targetUrl;
      if (url.includes("incident")) {
        onSelectTab && onSelectTab("incidents");
      } else if (url.includes("violation")) {
        onSelectTab && onSelectTab("violations");
      } else if (url.includes("student")) {
        onSelectTab && onSelectTab("students");
      } else if (url.includes("request") || url.includes("registration") || url.includes("room")) {
        onSelectTab && onSelectTab("rooms");
      }
      window.history.pushState({}, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(
        new CustomEvent("student-navigate", { detail: { path: url } })
      );
    }
  };

  const handleQuickAction = (actionKey, item) => {
    adminNotificationService.resolveNotification(item.id);
    setNotifications(adminNotificationService.getNotifications());
    setUnreadCount(adminNotificationService.getUnreadCount());
    setActionRequiredCount(adminNotificationService.getActionRequiredCount());

    setIsPopoverOpen(false);
    if (item.deepLink?.targetUrl) {
      window.history.pushState({}, "", item.deepLink.targetUrl);
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(
        new CustomEvent("student-navigate", { detail: { path: item.deepLink.targetUrl } })
      );
    }
  };

  const handleViewAll = () => {
    setIsPopoverOpen(false);
    if (onSelectTab) {
      onSelectTab("notifications");
    } else {
      window.history.pushState({}, "", "/admin/notifications");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  return (
    <header className="bg-[#f4f5f7] rounded-2xl border border-slate-200/60 px-8 py-3 flex items-center justify-between gap-6 shrink-0 relative z-30">
      {/* Search Input Bar */}
      <div className="relative flex-1 max-w-lg">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          placeholder="Tra cứu phòng, sinh viên, sự cố..."
          className="block w-full pl-11 pr-4 py-2.5 bg-white hover:bg-slate-50 focus:bg-white text-sm text-slate-800 placeholder-slate-400 rounded-full border border-slate-200/90 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 transition-all duration-150 shadow-2xs"
        />
      </div>

      {/* Right User & Actions */}
      <div className="flex items-center gap-3">
        {/* Notifications button with Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsPopoverOpen((prev) => !prev)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all shadow-2xs cursor-pointer select-none ${
              isPopoverOpen
                ? "bg-sky-600 text-white border border-sky-600 shadow-md"
                : "bg-white hover:bg-sky-50 text-sky-700 border border-sky-300"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Bell className={`w-4 h-4 ${isPopoverOpen ? "text-white" : "text-sky-600"}`} />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
            <span>Thông báo</span>
            {actionRequiredCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title={`${actionRequiredCount} việc cần xử lý`}></span>
            )}
          </button>

          <NotificationPopover
            isOpen={isPopoverOpen}
            onClose={() => setIsPopoverOpen(false)}
            role="admin"
            notifications={notifications}
            unreadCount={unreadCount}
            actionRequiredCount={actionRequiredCount}
            onMarkAllAsRead={handleMarkAllAsRead}
            onNotificationClick={handleNotificationClick}
            onQuickAction={handleQuickAction}
            onViewAll={handleViewAll}
          />
        </div>

        {/* User profile pill */}
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-semibold transition-colors shadow-xs select-none">
          <User className="w-4 h-4 fill-white/20" />
          <span>{userName}</span>
        </div>
      </div>
    </header>
  );
}
