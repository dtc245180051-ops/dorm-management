import { useState } from 'react';
import '../pages/student/StudentDashboard.css';
import { authService } from '../services/authService';

/**
 * Layout chính phân hệ Sinh Viên (Chuẩn theo ảnh mẫu tham khảo)
 * - Header compact (52px), logo nhỏ, search bar pill
 * - Sidebar width 135px, menu active #DBEBFD, text #007FFF
 */
export default function StudentLayout({ user, onLogout, children }) {
  const [activeMenu, setActiveMenu] = useState('home');
  const [searchKeyword, setSearchKeyword] = useState('');

  // Lấy tên hiển thị của sinh viên: ưu tiên dữ liệu đăng nhập, fallback 'Nguyễn Văn A' như ảnh mẫu
  const displayName =
    user?.nguoi_dung?.ho_ten ||
    user?.ho_ten ||
    user?.username ||
    localStorage.getItem('ktx_username') ||
    'Nguyễn Văn A';

  const handleLogoutClick = () => {
    authService.logout();
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <div className="student-shell">
      {/* ================= HEADER (52px) ================= */}
      <header className="student-header">
        {/* Logo KTX */}
        <div className="student-header-left">
          {/* Icon ngôi nhà nguyên khối theo Figma */}
          <div className="student-logo-icon-figma">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="#2563EB">
              <path d="M12 2.1L1 12h3v9h6v-6h4v6h6v-9h3L12 2.1z" />
            </svg>
          </div>
          <div className="student-logo-text">
            <span className="student-logo-title">KTX</span>
            <span className="student-logo-subtitle">Hệ thống ký túc xá</span>
          </div>
        </div>

        {/* Thanh tìm kiếm Pill shape */}
        <div className="student-search-box">
          <input
            type="text"
            className="student-search-input"
            placeholder="Tìm kiếm..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
          <div className="student-search-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7.5" />
              <line x1="21" y1="21" x2="16.5" y2="16.5" />
            </svg>
          </div>
        </div>

        {/* Chuông thông báo & Hồ sơ sinh viên */}
        <div className="student-header-right">
          <button className="student-notify-btn" title="Thông báo mới">
            {/* Simple Line Bell Icon */}
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="student-notify-badge" />
          </button>

          <div className="student-profile-pill">
            <div className="student-avatar">
              {/* User Icon Outline */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="student-profile-info">
              <span className="student-profile-name">{displayName}</span>
              <span className="student-profile-role">Sinh viên</span>
            </div>
          </div>
        </div>
      </header>

      {/* ================= BODY (SIDEBAR 135px + CONTENT) ================= */}
      <div className="student-body">
        {/* Sidebar */}
        <aside className="student-sidebar">
          {/* Menu Trang chủ (Active) */}
          <button
            className={`student-nav-item ${activeMenu === 'home' ? 'active' : ''}`}
            onClick={() => setActiveMenu('home')}
          >
            <div className="student-nav-icon-box">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20V9.5z" />
                <polyline points="9 21 9 12 15 12 15 21" />
              </svg>
            </div>
            <span>Trang chủ</span>
          </button>

          {/* Section: CÁ NHÂN */}
          <div className="student-sidebar-section">CÁ NHÂN</div>

          <button
            className={`student-nav-item ${activeMenu === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveMenu('profile')}
          >
            <div className="student-nav-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span>Thông tin cá nhân</span>
          </button>

          {/* Section: HỆ THỐNG */}
          <div className="student-sidebar-section">HỆ THỐNG</div>

          <button
            className={`student-nav-item ${activeMenu === 'help' ? 'active' : ''}`}
            onClick={() => setActiveMenu('help')}
          >
            <div className="student-nav-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <span>Trợ giúp và hỗ trợ</span>
          </button>

          <button
            className="student-nav-item student-logout-item"
            onClick={handleLogoutClick}
            title="Đăng xuất"
          >
            <div className="student-nav-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            <span>Đăng xuất</span>
          </button>
        </aside>

        {/* Nội dung chính */}
        <main className="student-main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
