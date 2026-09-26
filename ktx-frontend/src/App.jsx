import { useState, useEffect, useCallback } from 'react';
import Login from './pages/auth/Login';
import StudentLayout from './layouts/Student';
import StudentDashboard from './pages/student/StudentDashboard';
import AccountantLayout from './layouts/Accountant';
import PeriodicBilling from './pages/accountant/PeriodicBilling';
import TransactionReconciliation from './pages/accountant/TransactionReconciliation';
import DebtLedger from './pages/accountant/DebtLedger';
import './pages/accountant/PeriodicBilling.css';
import { authService } from './services/authService';

function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [currentHash, setCurrentHash] = useState(window.location.hash);
  const [accSearchTerm, setAccSearchTerm] = useState('');
  const [accActiveMenu, setAccActiveMenu] = useState(() => {
    const path = window.location.pathname;
    const hash = window.location.hash;
    if (
      path.includes('doi-soat') ||
      path.includes('reconciliation') ||
      hash.includes('doi-soat') ||
      hash.includes('reconciliation')
    ) {
      return 'reconciliation';
    }
    if (
      path.includes('so-cong-no') ||
      path.includes('debt-book') ||
      hash.includes('so-cong-no') ||
      hash.includes('debt-book')
    ) {
      return 'debt-book';
    }
    return 'billing';
  });

  // Lắng nghe thay đổi URL (hỗ trợ cả pathname và hash navigation)
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      setCurrentPath(path);
      setCurrentHash(hash);

      if (
        path.includes('doi-soat') ||
        path.includes('reconciliation') ||
        hash.includes('doi-soat') ||
        hash.includes('reconciliation')
      ) {
        setAccActiveMenu('reconciliation');
      } else if (
        path.includes('so-cong-no') ||
        path.includes('debt-book') ||
        hash.includes('so-cong-no') ||
        hash.includes('debt-book')
      ) {
        setAccActiveMenu('debt-book');
      } else if (
        path.includes('lap-hoa-don') ||
        path.includes('hoa-don') ||
        hash.includes('lap-hoa-don') ||
        hash.includes('hoa-don')
      ) {
        setAccActiveMenu('billing');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Kiểm tra phiên đăng nhập hiện tại từ localStorage và API
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('ktx_token');
    const role = localStorage.getItem('ktx_user_role');
    const username = localStorage.getItem('ktx_username');

    if (!token) {
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    // Cho phép vai trò "SinhVien" hoặc "KeToan" truy cập hệ thống
    if (role === 'SinhVien' || role === 'KeToan') {
      setIsAuthenticated(true);
      try {
        const fullProfile = await authService.getCurrentUser();
        if (fullProfile) {
          setUser(fullProfile);
        } else {
          setUser({ username, role });
        }
      } catch {
        setUser({ username, role });
      }
    } else {
      setIsAuthenticated(false);
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkAuth();

    // Lắng nghe sự kiện login từ authService mà không cần sửa code của Login.jsx
    const originalLogin = authService.login;
    authService.login = async (...args) => {
      const result = await originalLogin.apply(authService, args);
      if (result && result.success) {
        // Đợi 500ms để người dùng kịp nhìn thấy thông báo đăng nhập thành công
        setTimeout(() => {
          checkAuth();
        }, 500);
      }
      return result;
    };

    return () => {
      authService.login = originalLogin;
    };
  }, [checkAuth]);

  // Xử lý đăng xuất
  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
    window.history.pushState({}, '', '/');
    setCurrentPath('/');
    setCurrentHash('');
  };

  // Điều hướng nội bộ an toàn
  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#1d70f5', fontWeight: 600, fontSize: '15px' }}>Đang tải...</div>
      </div>
    );
  }

  // Xác định vai trò hiện tại
  const currentRole = user?.role || user?.vai_tro || localStorage.getItem('ktx_user_role');

  // Kiểm tra xem URL hiện tại có đang yêu cầu trang Lập hóa đơn định kỳ hay không
  const isRequestingBillingPage =
    currentPath.includes('lap-hoa-don') ||
    currentPath.includes('hoa-don') ||
    currentHash.includes('lap-hoa-don') ||
    currentHash.includes('hoa-don');

  // Kiểm tra xem URL hiện tại có đang yêu cầu trang Đối soát giao dịch hay không
  const isRequestingReconciliation =
    currentPath.includes('doi-soat') ||
    currentPath.includes('reconciliation') ||
    currentHash.includes('doi-soat') ||
    currentHash.includes('reconciliation');

  // Kiểm tra xem URL hiện tại có đang yêu cầu trang Sổ công nợ hay không
  const isRequestingDebtLedger =
    currentPath.includes('so-cong-no') ||
    currentPath.includes('debt-book') ||
    currentHash.includes('so-cong-no') ||
    currentHash.includes('debt-book');

  // Xử lý chuyển đổi menu kế toán
  const handleAccountantMenuChange = (menuKey) => {
    setAccActiveMenu(menuKey);
    if (menuKey === 'reconciliation') {
      navigateTo('/doi-soat');
    } else if (menuKey === 'billing') {
      navigateTo('/lap-hoa-don');
    } else if (menuKey === 'debt-book') {
      navigateTo('/so-cong-no');
    }
  };

  // =========================================================================
  // PHÂN QUYỀN VÀ ĐIỀU HƯỚNG HIỂN THỊ
  // =========================================================================

  // 1. Nếu chưa đăng nhập:
  // Cho phép xem trước giao diện Đối soát / Sổ công nợ khi truy cập URL trực tiếp
  if (!isAuthenticated) {
    if (isRequestingReconciliation) {
      return (
        <AccountantLayout
          user={{ username: 'KT_Hoa', role: 'KeToan' }}
          onLogout={handleLogout}
          activeMenu="reconciliation"
          onMenuChange={handleAccountantMenuChange}
          searchTerm={accSearchTerm}
          onSearchChange={setAccSearchTerm}
        >
          <TransactionReconciliation searchTerm={accSearchTerm} />
        </AccountantLayout>
      );
    }

    if (isRequestingDebtLedger) {
      return (
        <AccountantLayout
          user={{ username: 'KT_Hoa', role: 'KeToan' }}
          onLogout={handleLogout}
          activeMenu="debt-book"
          onMenuChange={handleAccountantMenuChange}
          searchTerm={accSearchTerm}
          onSearchChange={setAccSearchTerm}
        >
          <DebtLedger searchTerm={accSearchTerm} />
        </AccountantLayout>
      );
    }

    if (isRequestingBillingPage) {
      return (
        <AccountantLayout
          user={{ username: 'KT_Hoa', role: 'KeToan' }}
          onLogout={handleLogout}
          activeMenu="billing"
          onMenuChange={handleAccountantMenuChange}
          searchTerm={accSearchTerm}
          onSearchChange={setAccSearchTerm}
        >
          <PeriodicBilling searchTerm={accSearchTerm} />
        </AccountantLayout>
      );
    }

    return (
      <main
        style={{
          width: '100%',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
        }}
      >
        <Login />
      </main>
    );
  }

  // 2. Nếu đăng nhập với vai trò "KeToan":
  if (currentRole === 'KeToan') {
    return (
      <AccountantLayout
        user={user}
        onLogout={handleLogout}
        activeMenu={accActiveMenu}
        onMenuChange={handleAccountantMenuChange}
        searchTerm={accSearchTerm}
        onSearchChange={setAccSearchTerm}
      >
        {accActiveMenu === 'reconciliation' ? (
          <TransactionReconciliation searchTerm={accSearchTerm} />
        ) : accActiveMenu === 'debt-book' ? (
          <DebtLedger searchTerm={accSearchTerm} />
        ) : (
          <PeriodicBilling searchTerm={accSearchTerm} />
        )}
      </AccountantLayout>
    );
  }

  // 3. Nếu đăng nhập với vai trò "SinhVien":
  if (currentRole === 'SinhVien') {
    // Chặn truy cập nếu sinh viên cố tình vào trang của Kế toán
    if (isRequestingBillingPage || isRequestingReconciliation) {
      return (
        <div className="access-denied-container">
          <div className="access-denied-card">
            <div className="access-denied-icon">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 className="access-denied-title">403 - KHÔNG CÓ QUYỀN TRUY CẬP</h2>
            <p className="access-denied-text">
              Chức năng <strong>"Đối soát giao dịch"</strong> và <strong>"Lập hóa đơn"</strong> chỉ dành riêng cho tài khoản Kế toán (KeToan).
              Tài khoản hiện tại của bạn là Sinh viên và không có quyền truy cập trang này.
            </p>
            <button
              type="button"
              className="access-denied-btn"
              onClick={() => navigateTo('/')}
            >
              Quay về trang dành cho sinh viên
            </button>
          </div>
        </div>
      );
    }

    // Luồng mặc định cho Sinh viên: Hiển thị Student Dashboard bình thường (không có menu Lập hóa đơn)
    return (
      <StudentLayout user={user} onLogout={handleLogout}>
        <StudentDashboard user={user} onLogout={handleLogout} />
      </StudentLayout>
    );
  }

  // 4. Fallback cho các trường hợp khác
  return (
    <main
      style={{
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <Login />
    </main>
  );
}

export default App;
