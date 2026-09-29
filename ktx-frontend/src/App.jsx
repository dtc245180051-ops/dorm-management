import React, { useState, useEffect, useCallback } from 'react';
import Login from './pages/Login';
import LandingPage from './pages/public/LandingPage';
import AdminLayout from './layouts/Admin';
import StudentLayout from './layouts/Student';
import AccountantLayout from './layouts/Accountant';
import RoomManagement from './pages/admin/RoomManagement';
import StudentManagement from './pages/admin/StudentManagement';
import IncidentManagement from './pages/admin/IncidentManagement';
import ProcessRegistrationPage from './pages/admin/ProcessRegistrationPage';
import ProcessTransferPage from './pages/admin/ProcessTransferPage';
import ProcessCheckoutPage from './pages/admin/ProcessCheckoutPage';
import RoomRegistrationPage from './pages/student/RoomRegistrationPage';
import RoomTransferPage from './pages/student/RoomTransferPage';
import RequestHistoryPage from './pages/student/RequestHistoryPage';
import FeedbackPage from './pages/student/FeedbackPage';
import StudentDashboard from './pages/student/StudentDashboard';
import TransactionReconciliation from './pages/accountant/TransactionReconciliation';
import PeriodicBilling from './pages/accountant/PeriodicBilling';
import DebtLedger from './pages/accountant/DebtLedger';
import occupancyService from './services/occupancyService';
import {
  Clock,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Plus,
  FileCheck,
  RefreshCw,
  Home,
  Calculator,
} from 'lucide-react';

export default function App() {
  const [currentPath, setCurrentPath] = useState(
    window.location.pathname || '/'
  );

  const [adminActiveTab, setAdminActiveTab] = useState('dashboard');
  const [adminSearchTerm, setAdminSearchTerm] = useState('');

  const [accountantActiveMenu, setAccountantActiveMenu] = useState('reconciliation');
  const [accountantSearchTerm, setAccountantSearchTerm] = useState('');

  const [requestsList, setRequestsList] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  // Thông tin phòng hiện tại cho Student
  const [currentRoomInfo, setCurrentRoomInfo] = useState({
    phong_hien_tai: 'P36 – Tòa A2 – Tầng 3',
    thanh_vien: '6/8 người',
    thoi_gian_luu_tru: '09/2025 – Nay',
    so_phong: 'P36',
  });

  const loadRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    try {
      if (occupancyService?.getAllRequests) {
        const data = await occupancyService.getAllRequests();
        setRequestsList(data || []);
      }
    } catch (err) {
      console.error('Error loading requests:', err);
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  const loadRoomInfo = useCallback(async () => {
    try {
      if (occupancyService?.getCurrentRoomInfo) {
        const info = await occupancyService.getCurrentRoomInfo();
        if (info) setCurrentRoomInfo(info);
      }
    } catch (e) {
      console.error('Error loading current room info:', e);
    }
  }, []);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  useEffect(() => {
    loadRequests();
    loadRoomInfo();

    const handleUpdate = () => {
      loadRequests();
      loadRoomInfo();
    };
    window.addEventListener('occupancy-updated', handleUpdate);
    return () => {
      window.removeEventListener('occupancy-updated', handleUpdate);
    };
  }, [currentPath, adminActiveTab, loadRequests, loadRoomInfo]);

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const handleStudentTabSelect = (tabId) => {
    switch (tabId) {
      case 'home':
      case 'dashboard':
        navigateTo('/student/dashboard');
        break;
      case 'register':
      case 'dang-ky':
        navigateTo('/student/register');
        break;
      case 'transfer':
      case 'chuyen-phong':
        navigateTo('/student/transfer-room');
        break;
      case 'history':
      case 'lich-su':
        navigateTo('/student/history');
        break;
      case 'feedback':
      case 'phan-anh':
        navigateTo('/student/feedback');
        break;
      default:
        break;
    }
  };

  const handleAccountantMenuChange = (menuKey) => {
    setAccountantActiveMenu(menuKey);
    if (menuKey === 'reconciliation') {
      navigateTo('/doi-soat');
    } else if (menuKey === 'billing') {
      navigateTo('/lap-hoa-don');
    } else if (menuKey === 'debt-book') {
      navigateTo('/so-cong-no');
    }
  };

  // 0a. Trang chủ công khai (Landing Page theo Figma)
  if (currentPath === '/' || currentPath === '/home' || currentPath === '/landing') {
    return <LandingPage onNavigate={navigateTo} />;
  }

  // 0b. Trang đăng nhập
  if (currentPath === '/login' || currentPath === '/auth') {
    return (
      <main className="w-full min-h-screen flex items-center justify-center bg-slate-100">
        <Login
          initialTab="login"
          onTabChange={(tab) => {
            window.history.replaceState({}, '', tab === 'register' ? '/register' : '/login');
          }}
          onLoginSuccess={(role) => {
            if (role === 'KeToan') {
              navigateTo('/doi-soat');
            } else if (role === 'Admin') {
              navigateTo('/admin');
            } else {
              navigateTo('/student/dashboard');
            }
          }}
        />
      </main>
    );
  }

  // 0c. Trang đăng ký tài khoản
  if (currentPath === '/register' || currentPath === '/signup') {
    return (
      <main className="w-full min-h-screen flex items-center justify-center bg-slate-100">
        <Login
          initialTab="register"
          onTabChange={(tab) => {
            window.history.replaceState({}, '', tab === 'register' ? '/register' : '/login');
          }}
          onLoginSuccess={() => navigateTo('/student/dashboard')}
        />
      </main>
    );
  }

  // =========================================================================
  // PHÂN HỆ KẾ TOÁN (Accountant)
  // =========================================================================
  if (
    currentPath === '/doi-soat' ||
    currentPath === '/accountant/reconciliation' ||
    currentPath === '/reconciliation'
  ) {
    return (
      <div className="relative">
        <AccountantLayout
          user={{ username: 'KT_Hoa', role: 'KeToan' }}
          onLogout={() => navigateTo('/login')}
          activeMenu="reconciliation"
          onMenuChange={handleAccountantMenuChange}
          searchTerm={accountantSearchTerm}
          onSearchChange={setAccountantSearchTerm}
        >
          <TransactionReconciliation searchTerm={accountantSearchTerm} />
        </AccountantLayout>
        <RoleSwitcher currentRole="accountant" onSwitchRole={navigateTo} />
      </div>
    );
  }

  if (
    currentPath === '/lap-hoa-don' ||
    currentPath === '/accountant/billing' ||
    currentPath === '/billing'
  ) {
    return (
      <div className="relative">
        <AccountantLayout
          user={{ username: 'KT_Hoa', role: 'KeToan' }}
          onLogout={() => navigateTo('/login')}
          activeMenu="billing"
          onMenuChange={handleAccountantMenuChange}
          searchTerm={accountantSearchTerm}
          onSearchChange={setAccountantSearchTerm}
        >
          <PeriodicBilling searchTerm={accountantSearchTerm} />
        </AccountantLayout>
        <RoleSwitcher currentRole="accountant" onSwitchRole={navigateTo} />
      </div>
    );
  }

  if (
    currentPath === '/so-cong-no' ||
    currentPath === '/accountant/debt' ||
    currentPath === '/debt'
  ) {
    return (
      <div className="relative">
        <AccountantLayout
          user={{ username: 'KT_Hoa', role: 'KeToan' }}
          onLogout={() => navigateTo('/login')}
          activeMenu="debt-book"
          onMenuChange={handleAccountantMenuChange}
          searchTerm={accountantSearchTerm}
          onSearchChange={setAccountantSearchTerm}
        >
          <DebtLedger searchTerm={accountantSearchTerm} />
        </AccountantLayout>
        <RoleSwitcher currentRole="accountant" onSwitchRole={navigateTo} />
      </div>
    );
  }

  // =========================================================================
  // PHÂN HỆ ADMIN: XỬ LÝ CHI TIẾT ĐƠN YÊU CẦU
  // =========================================================================

  // 1a. Xử lý yêu cầu đăng ký phòng
  if (currentPath.startsWith('/admin/requests/registration')) {
    const match = currentPath.match(/\/admin\/requests\/registration\/?(.*)/);
    const requestId = match && match[1] ? match[1] : 'DK-001';

    return (
      <div className="relative">
        <ProcessRegistrationPage
          requestId={requestId}
          onBack={() => {
            loadRequests();
            navigateTo('/admin');
          }}
          onProcessed={() => {
            loadRequests();
            navigateTo('/admin');
          }}
        />
        <RoleSwitcher
          currentRole="admin"
          onSwitchRole={(r) => navigateTo(r === 'admin' ? '/admin' : r === 'student' ? '/student/dashboard' : '/doi-soat')}
        />
      </div>
    );
  }

  // 1b. Xử lý yêu cầu chuyển phòng
  if (currentPath.startsWith('/admin/requests/transfer')) {
    const match = currentPath.match(/\/admin\/requests\/transfer\/?(.*)/);
    const requestId = match && match[1] ? match[1] : 'YC-0231';

    return (
      <div className="relative">
        <ProcessTransferPage
          requestId={requestId}
          onBack={() => {
            loadRequests();
            navigateTo('/admin');
          }}
          onProcessed={() => {
            loadRequests();
            navigateTo('/admin');
          }}
        />
        <RoleSwitcher
          currentRole="admin"
          onSwitchRole={(r) => navigateTo(r === 'admin' ? '/admin' : r === 'student' ? '/student/dashboard' : '/doi-soat')}
        />
      </div>
    );
  }

  // 1c. Xử lý yêu cầu trả phòng
  if (currentPath.startsWith('/admin/requests/checkout')) {
    const match = currentPath.match(/\/admin\/requests\/checkout\/?(.*)/);
    const requestId = match && match[1] ? match[1] : 'YC-0232';

    return (
      <div className="relative">
        <ProcessCheckoutPage
          requestId={requestId}
          onBack={() => {
            loadRequests();
            navigateTo('/admin');
          }}
          onProcessed={() => {
            loadRequests();
            navigateTo('/admin');
          }}
        />
        <RoleSwitcher
          currentRole="admin"
          onSwitchRole={(r) => navigateTo(r === 'admin' ? '/admin' : r === 'student' ? '/student/dashboard' : '/doi-soat')}
        />
      </div>
    );
  }

  // =========================================================================
  // PHÂN HỆ SINH VIÊN (Student)
  // =========================================================================

  // 2. Đăng ký ở mới
  if (
    currentPath === '/student/register' ||
    currentPath === '/student/register-room' ||
    currentPath === '/student'
  ) {
    return (
      <div className="relative">
        <RoomRegistrationPage
          onNavigateHistory={() => {
            loadRequests();
            navigateTo('/student/history');
          }}
          onNavigateDashboard={() => navigateTo('/student/dashboard')}
        />
        <RoleSwitcher
          currentRole="student"
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(r === 'admin' ? '/admin' : r === 'student' ? '/student/dashboard' : '/doi-soat');
          }}
        />
      </div>
    );
  }

  // 3. Chuyển / Trả phòng
  if (currentPath === '/student/transfer-room' || currentPath === '/student/transfer') {
    return (
      <div className="relative">
        <RoomTransferPage />
        <RoleSwitcher
          currentRole="student"
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(r === 'admin' ? '/admin' : r === 'student' ? '/student/dashboard' : '/doi-soat');
          }}
        />
      </div>
    );
  }

  // 4. Lịch sử đăng ký & ở
  if (currentPath === '/student/history') {
    return (
      <div className="relative">
        <RequestHistoryPage />
        <RoleSwitcher
          currentRole="student"
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(r === 'admin' ? '/admin' : r === 'student' ? '/student/dashboard' : '/doi-soat');
          }}
        />
      </div>
    );
  }

  // 5. Gửi phản ánh / Báo hỏng sự cố
  if (currentPath === '/student/feedback') {
    return (
      <div className="relative">
        <FeedbackPage
          userName="Nguyễn Văn A"
          onNavigateDashboard={() => navigateTo('/student/dashboard')}
          onNavigateRegister={() => navigateTo('/student/register')}
          onNavigateHistory={() => navigateTo('/student/history')}
          onLogout={() => navigateTo('/login')}
        />
        <RoleSwitcher
          currentRole="student"
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(r === 'admin' ? '/admin' : r === 'student' ? '/student/dashboard' : '/doi-soat');
          }}
        />
      </div>
    );
  }

  // 6. Trang chủ Sinh viên (Dashboard)
  if (currentPath === '/student/dashboard') {
    const studentName =
      localStorage.getItem('ktx_fullname') ||
      localStorage.getItem('ktx_username') ||
      'Nguyễn Văn A';

    return (
      <div className="relative">
        <StudentLayout
          activeTab="dashboard"
          onSelectTab={handleStudentTabSelect}
          userName={studentName}
          userRole="Sinh viên"
        >
          <StudentDashboard
            user={{
              ho_ten: studentName,
              username: localStorage.getItem('ktx_username') || 'DTC245180051',
            }}
            onNavigate={navigateTo}
          />
        </StudentLayout>
        <RoleSwitcher
          currentRole="student"
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(r === 'admin' ? '/admin' : r === 'student' ? '/student/dashboard' : '/doi-soat');
          }}
        />
      </div>
    );
  }

  // =========================================================================
  // PHÂN HỆ BAN QUẢN LÝ (Admin)
  // =========================================================================
  return (
    <div className="relative">
      <AdminLayout
        activeTab={adminActiveTab}
        onSelectTab={setAdminActiveTab}
        searchTerm={adminSearchTerm}
        onSearchChange={setAdminSearchTerm}
        userName="QL_Minh"
      >
        {adminActiveTab === 'dashboard' && (
          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <FileCheck className="w-6 h-6 text-blue-600" />
                    Danh sách yêu cầu đăng ký phòng đang chờ xử lý
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Tiếp nhận các đơn đăng ký trực tuyến từ sinh viên, đối chiếu thông tin và phê duyệt xếp chỗ
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={loadRequests}
                    className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition cursor-pointer border border-slate-200"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRequests ? 'animate-spin' : ''}`} />
                    <span>Làm mới danh sách</span>
                  </button>
                </div>
              </div>

              {/* Bảng danh sách yêu cầu Admin */}
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4 rounded-l-lg">Mã đơn</th>
                      <th className="py-3 px-4">Mã SV</th>
                      <th className="py-3 px-4">Họ và tên</th>
                      <th className="py-3 px-4">Khoa / Lớp</th>
                      <th className="py-3 px-4">Nguyện vọng</th>
                      <th className="py-3 px-4">Ngày gửi</th>
                      <th className="py-3 px-4">Trạng thái</th>
                      <th className="py-3 px-4 text-right rounded-r-lg">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {requestsList.length > 0 ? (
                      requestsList.map((req, idx) => {
                        const targetId = req.id || req.ma_yeu_cau || req.msv;
                        const isPending = req.trang_thai === 'CHO_DUYET';
                        const isApproved = req.trang_thai === 'DA_DUYET';

                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition">
                            <td className="py-3.5 px-4 font-mono font-semibold text-blue-600">
                              {targetId}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-700">
                              {req.msv}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-900">
                              {req.ho_ten}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              <div>{req.khoa || 'Chưa cập nhật'}</div>
                              <div className="text-xs text-slate-400">{req.lop}</div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-700 max-w-xs truncate" title={req.nguyen_vong || req.noi_dung_nguyen_vong || req.phong_lien_quan}>
                              {req.loai_yeu_cau ? `${req.loai_yeu_cau}: ${req.phong_lien_quan || req.phong_mong_muon || req.ly_do || ''}` : (req.nguyen_vong || req.noi_dung_nguyen_vong || req.nguyen_vong_label || 'Xin xếp phòng')}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-500">
                              {req.ngay_gui ? (req.ngay_gui.includes('/') ? req.ngay_gui : new Date(req.ngay_gui).toLocaleDateString('vi-VN')) : 'Hôm nay'}
                            </td>
                            <td className="py-3.5 px-4">
                              {isApproved ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  Đã duyệt
                                </span>
                              ) : req.trang_thai === 'TU_CHOI' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                  Từ chối
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  Chờ duyệt
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  const cleanId = String(targetId).replace('#', '');
                                  const loai = req.loai_don || req.loai_yeu_cau;
                                  if (
                                    loai === 'CHUYEN_PHONG' ||
                                    loai === 'Chuyển phòng' ||
                                    (cleanId.startsWith('YC-') && (req.phong_mong_muon || req.nguyen_vong?.includes('chuyển') || req.mo_ta?.includes('chuyển') || req.phong_lien_quan?.includes('→')))
                                  ) {
                                    navigateTo(`/admin/requests/transfer/${cleanId}`);
                                  } else if (
                                    loai === 'TRA_PHONG' ||
                                    loai === 'Trả phòng' ||
                                    (cleanId.startsWith('YC-') && (req.dia_chi_sau_tra || req.nguyen_vong?.includes('trả') || req.mo_ta?.includes('trả')))
                                  ) {
                                    navigateTo(`/admin/requests/checkout/${cleanId}`);
                                  } else {
                                    navigateTo(`/admin/requests/registration/${cleanId}`);
                                  }
                                }}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs ${
                                  isPending
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                {isPending ? 'Xử lý đơn' : 'Xem chi tiết'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          Chưa có đơn đăng ký nào cần xử lý.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {adminActiveTab === 'rooms' && (
          <RoomManagement searchTerm={adminSearchTerm} />
        )}

        {adminActiveTab === 'students' && (
          <StudentManagement searchTerm={adminSearchTerm} />
        )}

        {adminActiveTab === 'incidents' && (
          <IncidentManagement searchTerm={adminSearchTerm} />
        )}

        {adminActiveTab !== 'dashboard' &&
          adminActiveTab !== 'rooms' &&
          adminActiveTab !== 'students' &&
          adminActiveTab !== 'incidents' && (
            <div className="p-8 text-center text-slate-400 mt-20">
              <h2 className="text-xl font-bold text-slate-600 mb-2">
                Trang đang được xây dựng
              </h2>
              <p className="text-sm">
                Vui lòng chọn tab "Dashboard", "Hồ sơ sinh viên", "Quản lý phòng ở" hoặc "Báo hỏng & sự cố".
              </p>
            </div>
          )}
      </AdminLayout>
      <RoleSwitcher
        currentRole="admin"
        onSwitchRole={(r) => {
          loadRequests();
          navigateTo(r === 'admin' ? '/admin' : r === 'student' ? '/student/dashboard' : '/doi-soat');
        }}
      />
    </div>
  );
}

function RoleSwitcher({ currentRole, onSwitchRole }) {
  const handleRoleClick = (r) => {
    if (r === 'home') {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }
    if (onSwitchRole) {
      if (r === 'admin') onSwitchRole('/admin');
      else if (r === 'student') onSwitchRole('/student/dashboard');
      else if (r === 'accountant') onSwitchRole('/doi-soat');
      else onSwitchRole(r);
    }
  };

  return (
    <div className="fixed top-3 right-64 z-50 flex items-center bg-white/90 backdrop-blur-md border border-slate-200 p-1 rounded-full shadow-lg text-xs font-semibold gap-1">
      <button
        type="button"
        onClick={() => handleRoleClick('home')}
        className="px-3 py-1.5 rounded-full transition flex items-center gap-1.5 cursor-pointer text-slate-600 hover:text-blue-600 hover:bg-slate-100"
        title="Về Trang chủ công khai"
      >
        <Home className="w-3.5 h-3.5" />
        <span>Trang chủ</span>
      </button>

      <button
        type="button"
        onClick={() => handleRoleClick('admin')}
        className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 cursor-pointer ${
          currentRole === 'admin'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Admin</span>
      </button>

      <button
        type="button"
        onClick={() => handleRoleClick('student')}
        className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 cursor-pointer ${
          currentRole === 'student'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
      >
        <UserCheck className="w-3.5 h-3.5" />
        <span>Sinh viên</span>
      </button>

      <button
        type="button"
        onClick={() => handleRoleClick('accountant')}
        className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 cursor-pointer ${
          currentRole === 'accountant'
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
      >
        <Calculator className="w-3.5 h-3.5" />
        <span>Kế toán</span>
      </button>
    </div>
  );
}
