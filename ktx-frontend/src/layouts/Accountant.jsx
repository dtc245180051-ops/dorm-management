import { useState } from 'react';
import './Accountant.css';
import { authService } from '../services/authService';

/**
 * Layout cho phân hệ Kế toán (Chuẩn 100% theo bản thiết kế Figma iDORM)
 * - Sidebar bên trái: Logo iDORM, Menu (Dashboard, Lập hóa đơn, Đối soát, Sổ công nợ, Báo cáo tài chính), Hệ thống (Đăng xuất)
 * - Header bên phải: Thanh tìm kiếm "Tra cứu phòng, sinh viên,...", Nút "Thông báo", Badge người dùng "KT_Hoa"
 */
export default function AccountantLayout({
  user,
  onLogout,
  activeMenu = 'billing',
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
        <div className="acc-brand" onClick={() => handleSelectMenu('billing')}>
          <div className="acc-logo-text">
            <span className="acc-logo-i">i</span>
            <span className="acc-logo-dorm">DORM</span>
          </div>
        </div>

        {/* Section: MENU */}
        <div className="acc-nav-section-title">MENU</div>
        <nav className="acc-nav-list">
          {/* Dashboard */}
          <button
            type="button"
            className={`acc-nav-item ${currentMenu === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleSelectMenu('dashboard')}
          >
            <div className="acc-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </div>
            <span>Dashboard</span>
          </button>

          {/* Lập hóa đơn (Active mặc định theo Figma) */}
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

          {/* Báo cáo tài chính */}
          <button
            type="button"
            className={`acc-nav-item ${currentMenu === 'financial-report' ? 'active' : ''}`}
            onClick={() => handleSelectMenu('financial-report')}
          >
            <div className="acc-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M12 18v-4" />
                <path d="M8 18v-2" />
                <path d="M16 18v-6" />
              </svg>
            </div>
            <span>Báo cáo tài chính</span>
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

          {/* Actions: Thông báo & Profile Pill */}
          <div className="acc-header-right">
            <button
              type="button"
              className="acc-notify-btn"
              title="Thông báo hệ thống"
              onClick={() => alert('Chức năng Thông báo: Hiện tại chưa có thông báo mới.')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span>Thông báo</span>
            </button>

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
