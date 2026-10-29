import { useState, useEffect } from 'react';
import './Accountant.css';
import { authService } from '../services/authService';
import NotificationPopover from '../components/NotificationPopover';
import accountantNotificationService from '../services/accountantNotificationService';

/**
 * Layout cho phân hệ Kế toán (Chuẩn 100% theo bản thiết kế Figma iDORM)
 * - Sidebar bên trái: Logo iDORM, Menu (Dashboard, Lập hóa đơn, Đối soát, Sổ công nợ, Báo cáo tài chính), Hệ thống (Đăng xuất)
 * - Header bên phải: Thanh tìm kiếm "Tra cứu phòng, sinh viên,...", Nút "Thông báo", Badge người dùng "KT_Hoa"
 */
export default function AccountantLayout({
  user,
  onLogout,
  activeMenu = 'dashboard',
  onMenuChange,
  searchTerm = '',
  onSearchChange,
  children,
}) {
  const [internalMenu, setInternalMenu] = useState(activeMenu);
  const currentMenu = activeMenu !== undefined ? activeMenu : internalMenu;

  // Lấy tên hiển thị tài khoản: ưu tiên username từ DB (KT_Hoa) hoặc người dùng
  const displayName =
    user?.username ||
    user?.ten_dang_nhap ||
    localStorage.getItem('ktx_username') ||
    'KT_Hoa';

  const handleSelectMenu = (menuKey) => {
    setInternalMenu(menuKey);
    if (onMenuChange) {
      onMenuChange(menuKey);
    }
  };

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [notifications, setNotifications] = useState(() =>
    accountantNotificationService.getNotifications()
  );
  const [unreadCount, setUnreadCount] = useState(() =>
    accountantNotificationService.getUnreadCount()
  );
  const [actionRequiredCount, setActionRequiredCount] = useState(() =>
    accountantNotificationService.getActionRequiredCount()
  );

  useEffect(() => {
    const handleUpdate = () => {
      setNotifications(accountantNotificationService.getNotifications());
      setUnreadCount(accountantNotificationService.getUnreadCount());
      setActionRequiredCount(accountantNotificationService.getActionRequiredCount());
    };

    // Khởi tạo ban đầu
    handleUpdate();
    accountantNotificationService.syncFromSystem().then(handleUpdate);

    // Lắng nghe cập nhật (CHỈ đọc lại từ service, KHÔNG gọi syncFromSystem để tránh lặp vô tận)
    window.addEventListener("accountant-notifications-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    const handleExternalSync = () => {
      accountantNotificationService.syncFromSystem().then(handleUpdate);
    };
    window.addEventListener("occupancy-updated", handleExternalSync);

    // Polling định kỳ 30s
    const intervalId = setInterval(handleExternalSync, 30000);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("accountant-notifications-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("occupancy-updated", handleExternalSync);
    };
  }, []);

  const handleMarkAllAsRead = () => {
    accountantNotificationService.markAllAsRead();
    setNotifications(accountantNotificationService.getNotifications());
    setUnreadCount(0);
  };

  const handleNotificationClick = (item) => {
    accountantNotificationService.markAsRead(item.id);
    setNotifications(accountantNotificationService.getNotifications());
    setUnreadCount(accountantNotificationService.getUnreadCount());

    setIsPopoverOpen(false);
    if (item.deepLink?.targetUrl) {
      const url = item.deepLink.targetUrl;
      if (url.includes("reconciliation")) {
        handleSelectMenu("reconciliation");
      } else if (url.includes("billing") || url.includes("invoices")) {
        handleSelectMenu("billing");
      } else if (url.includes("debt")) {
        handleSelectMenu("debt-book");
      } else if (url.includes("report")) {
        handleSelectMenu("reports");
      } else {
        window.history.pushState({}, "", url);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }
  };

  const handleQuickAction = async (actionKey, item) => {
    if (actionKey === "MATCH_AND_CLEAR") {
      const invId = item.metadata?.invoiceId || item.id.replace("NOTIF_INV_", "");
      await accountantNotificationService.matchAndClearInvoice(invId);
    } else {
      accountantNotificationService.resolveNotification(item.id);
    }

    setNotifications(accountantNotificationService.getNotifications());
    setUnreadCount(accountantNotificationService.getUnreadCount());
    setActionRequiredCount(accountantNotificationService.getActionRequiredCount());

    setIsPopoverOpen(false);
    if (item.deepLink?.targetUrl && actionKey !== "MATCH_AND_CLEAR") {
      window.history.pushState({}, "", item.deepLink.targetUrl);
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(
        new CustomEvent("student-navigate", { detail: { path: item.deepLink.targetUrl } })
      );
    }
  };

  const handleViewAll = () => {
    setIsPopoverOpen(false);
    handleSelectMenu('notifications');
  };

  const handleLogoutClick = () => {
    authService.logout();
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <div className="acc-shell">
      {/* ================= SIDEBAR ================= */}
      <aside className="acc-sidebar">
        {/* Logo iDORM */}
        <div className="acc-brand" onClick={() => handleSelectMenu('dashboard')}>
          <div className="acc-logo-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
          </div>
          <div className="acc-logo-copy">
            <div className="acc-logo-text">
              <span className="acc-logo-i">i</span>
              <span className="acc-logo-dorm">DORM</span>
            </div>
            <div className="acc-logo-subtitle">Hệ thống ký túc xá</div>
          </div>
        </div>

        {/* Section: MENU */}
        <div className="acc-nav-section-title">MENU</div>
        <nav className="acc-nav-list">
          {/* Tổng quan (Dashboard) */}
          <button
            type="button"
            className={`acc-nav-item ${currentMenu === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleSelectMenu('dashboard')}
          >
            <div className="acc-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="7" height="9" x="3" y="3" rx="1" />
                <rect width="7" height="5" x="14" y="3" rx="1" />
                <rect width="7" height="9" x="14" y="12" rx="1" />
                <rect width="7" height="5" x="3" y="16" rx="1" />
              </svg>
            </div>
            <span>Tổng quan</span>
          </button>

          {/* Lập hóa đơn */}
          <button
            type="button"
            className={`acc-nav-item ${currentMenu === 'billing' ? 'active' : ''}`}
            onClick={() => handleSelectMenu('billing')}
          >
            <div className="acc-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <span>Lập hóa đơn</span>
          </button>

          {/* Đối soát giao dịch */}
          <button
            type="button"
            className={`acc-nav-item ${currentMenu === 'reconciliation' ? 'active' : ''}`}
            onClick={() => handleSelectMenu('reconciliation')}
          >
            <div className="acc-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="m9 15 2 2 4-4" />
              </svg>
            </div>
            <span>Đối soát</span>
          </button>

          {/* Sổ công nợ */}
          <button
            type="button"
            className={`acc-nav-item ${currentMenu === 'debt-book' ? 'active' : ''}`}
            onClick={() => handleSelectMenu('debt-book')}
          >
            <div className="acc-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <line x1="9" y1="9" x2="15" y2="9" />
              </svg>
            </div>
            <span>Sổ công nợ</span>
          </button>

          {/* Báo cáo thống kê */}
          <button
            type="button"
            className={`acc-nav-item ${currentMenu === 'reports' ? 'active' : ''}`}
            onClick={() => handleSelectMenu('reports')}
          >
            <div className="acc-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <span>Báo cáo thống kê</span>
          </button>
        </nav>

        {/* Section: HỆ THỐNG */}
        <div className="acc-nav-section-title" style={{ marginTop: '36px' }}>HỆ THỐNG</div>
        <nav className="acc-nav-list">
          <button
            type="button"
            className="acc-nav-item acc-logout-item"
            onClick={handleLogoutClick}
            title="Đăng xuất khỏi hệ thống"
          >
            <div className="acc-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            <span>Đăng xuất</span>
          </button>
        </nav>
      </aside>

      {/* ================= MAIN CONTAINER ================= */}
      <div className="acc-main-wrapper">
        {/* Header trên */}
        <header className="acc-header">
          {/* Thanh tìm kiếm */}
          <div className="acc-search-box">
            <span className="acc-search-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              className="acc-search-input"
              placeholder="Tra cứu phòng, sinh viên,..."
              value={searchTerm}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            />
          </div>

          {/* Actions: Thông báo Popover & Profile Pill */}
          <div className="acc-header-right">
            <div className="relative">
              <button
                type="button"
                className={`acc-notify-btn ${isPopoverOpen ? 'active' : ''}`}
                style={{ position: 'relative' }}
                title="Trung tâm thông báo tài chính & đối soát"
                onClick={() => setIsPopoverOpen((prev) => !prev)}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <span
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      backgroundColor: unreadCount > 0 ? '#ef4444' : '#94a3b8',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: '800',
                      borderRadius: '9999px',
                      minWidth: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 3px',
                      border: '2px solid #fff',
                      lineHeight: 1,
                    }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                </div>
                <span>Thông báo</span>
                {actionRequiredCount > 0 && (
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '9999px',
                      backgroundColor: '#f59e0b',
                    }}
                    title={`${actionRequiredCount} việc cần xử lý`}
                  />
                )}
              </button>

              <NotificationPopover
                isOpen={isPopoverOpen}
                onClose={() => setIsPopoverOpen(false)}
                role="accountant"
                notifications={notifications}
                unreadCount={unreadCount}
                actionRequiredCount={actionRequiredCount}
                onMarkAllAsRead={handleMarkAllAsRead}
                onNotificationClick={handleNotificationClick}
                onQuickAction={handleQuickAction}
                onViewAll={handleViewAll}
              />
            </div>

            <div className="acc-profile-pill" title={`Tài khoản: ${displayName} (Vai trò: Kế toán)`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
              <span>{displayName}</span>
            </div>
          </div>
        </header>

        {/* Nội dung chính */}
        <main className="acc-content">
          {children}
        </main>
      </div>
    </div>
  );
}
