import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from './layouts/Admin';
import StudentLayout from './layouts/Student';
import AccountantLayout from './layouts/Accountant';
import RoomManagement from './pages/admin/RoomManagement';
import StudentManagement from './pages/admin/StudentManagement';
import ProcessRegistrationPage from './pages/admin/ProcessRegistrationPage';
import IncidentManagement from './pages/admin/IncidentManagement';
import RoomRegistrationPage from './pages/student/RoomRegistrationPage';
import StudentDashboard from './pages/student/StudentDashboard';
import FeedbackPage from './pages/student/FeedbackPage';
import PeriodicBilling from './pages/accountant/PeriodicBilling';
import TransactionReconciliation from './pages/accountant/TransactionReconciliation';
import DebtLedger from './pages/accountant/DebtLedger';
import Login from './pages/auth/Login';
import occupancyService from './services/occupancyService';
import { authService } from './services/authService';
import {
  Clock,
  Plus,
  FileCheck,
  RefreshCw,
} from 'lucide-react';

export default function App() {
  // Họ và tên người dùng (ưu tiên họ tên đầy đủ từ đăng ký / hồ sơ)
  const [userFullName, setUserFullName] = useState(() => {
    return localStorage.getItem('ktx_fullname') || '';
  });

  // Tự động đồng bộ họ tên thật từ /auth/me nếu chưa có hoặc khi khởi động
  useEffect(() => {
    const token = localStorage.getItem('ktx_token');
    if (token) {
      authService.getCurrentUser().then((userData) => {
        if (userData?.nguoi_dung?.ho_ten) {
          localStorage.setItem('ktx_fullname', userData.nguoi_dung.ho_ten);
          setUserFullName(userData.nguoi_dung.ho_ten);
        }
      });
    }
  }, []);

  // Lấy đường dẫn ban đầu từ URL, đồng bộ chặt chẽ theo vai trò người dùng đã đăng nhập
  const [currentPath, setCurrentPath] = useState(() => {
    const path = window.location.pathname;
    const token = localStorage.getItem('ktx_token');
    const role = localStorage.getItem('ktx_user_role');

    if (!token) {
      if (path === '/register') return '/register';
      return '/login';
    }

    if (role === 'KeToan') {
      const isAcc =
        path.startsWith('/lap-hoa-don') ||
        path.startsWith('/doi-soat') ||
        path.startsWith('/so-cong-no') ||
        path.startsWith('/hoa-don') ||
        path.startsWith('/reconciliation') ||
        path.startsWith('/debt-book');
      return isAcc ? path : '/lap-hoa-don';
    }

    if (role === 'CanBo' || role === 'Admin' || role === 'QuanLy') {
      return path.startsWith('/admin') ? path : '/admin';
    }

    // Sinh viên
    return path.startsWith('/student') ? path : '/student/dashboard';
  });

  // State dành cho Admin
  const [adminActiveTab, setAdminActiveTab] = useState('dashboard');
  const [adminSearchTerm, setAdminSearchTerm] = useState('');

  // State dành cho Kế toán
  const [accSearchTerm, setAccSearchTerm] = useState('');

  // Danh sách các đơn đăng ký lưu trú được chia sẻ liên thông giữa Sinh viên và Quản lý
  const [requestsList, setRequestsList] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  // Tải danh sách đơn đăng ký
  const loadRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    try {
      const data = await occupancyService.getAllRequests();
      setRequestsList(data || []);
    } catch (err) {
      console.error('Error loading registration requests:', err);
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  // Lắng nghe thay đổi URL (Back / Forward trình duyệt)
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // Tải lại danh sách đơn mỗi khi đường dẫn thay đổi hoặc chuyển tab
  useEffect(() => {
    loadRequests();
  }, [currentPath, adminActiveTab, loadRequests]);

  // Hàm chuyển đổi đường dẫn điều hướng
  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Xử lý đăng xuất toàn diện
  const handleLogout = () => {
    localStorage.clear();
    navigateTo('/login');
  };

  // Rào chắn bảo vệ phân quyền: Tài khoản ai thì chỉ được phép xem trang của người đó
  useEffect(() => {
    const token = localStorage.getItem('ktx_token');
    const role = localStorage.getItem('ktx_user_role');

    if (!token) {
      if (
        currentPath !== '/login' &&
        currentPath !== '/register' &&
        currentPath !== '/dang-nhap'
      ) {
        navigateTo('/login');
      }
      return;
    }

    if (role === 'KeToan') {
      const isAcc =
        currentPath.startsWith('/lap-hoa-don') ||
        currentPath.startsWith('/doi-soat') ||
        currentPath.startsWith('/so-cong-no') ||
        currentPath.startsWith('/hoa-don') ||
        currentPath.startsWith('/reconciliation') ||
        currentPath.startsWith('/debt-book');
      if (!isAcc) {
        navigateTo('/lap-hoa-don');
      }
    } else if (role === 'CanBo' || role === 'Admin' || role === 'QuanLy') {
      if (!currentPath.startsWith('/admin')) {
        navigateTo('/admin');
      }
    } else {
      // Sinh viên
      if (!currentPath.startsWith('/student')) {
        navigateTo('/student/dashboard');
      }
    }
  }, [currentPath]);

  const token = localStorage.getItem('ktx_token');
  const userRole = localStorage.getItem('ktx_user_role');

  // =========================================================================
  // 0. Chưa đăng nhập: Chỉ hiển thị trang Đăng nhập / Đăng ký
  // =========================================================================
  if (
    !token ||
    currentPath === '/login' ||
    currentPath === '/register' ||
    currentPath === '/dang-nhap'
  ) {
    return (
      <main className="w-full min-h-screen bg-[#f0f4f9] flex items-center justify-center p-4 sm:p-6">
        <Login
          initialTab={currentPath === '/register' ? 'register' : 'login'}
          onLoginSuccess={(userData) => {
            const role = userData?.role || localStorage.getItem('ktx_user_role');
            const name = userData?.full_name || userData?.nguoi_dung?.ho_ten;
            if (name) {
              localStorage.setItem('ktx_fullname', name);
              setUserFullName(name);
            }
            if (role === 'KeToan') {
              navigateTo('/lap-hoa-don');
            } else if (role === 'CanBo' || role === 'Admin' || role === 'QuanLy') {
              navigateTo('/admin');
            } else {
              navigateTo('/student/dashboard');
            }
          }}
        />
      </main>
    );
  }

  // =========================================================================
  // 1. Phân hệ Kế toán (Chỉ dành cho tài khoản vai trò KeToan)
  // =========================================================================
  if (userRole === 'KeToan') {
    let activeMenu = 'billing';
    if (
      currentPath.startsWith('/doi-soat') ||
      currentPath.startsWith('/reconciliation')
    ) {
      activeMenu = 'reconciliation';
    } else if (
      currentPath.startsWith('/so-cong-no') ||
      currentPath.startsWith('/debt-book')
    ) {
      activeMenu = 'debt-book';
    }

    return (
      <AccountantLayout
        user={{
          username: localStorage.getItem('ktx_username') || 'KT_Hoa',
          role: 'KeToan',
        }}
        onLogout={handleLogout}
        activeMenu={activeMenu}
        onMenuChange={(menuKey) => {
          if (menuKey === 'reconciliation') navigateTo('/doi-soat');
          else if (menuKey === 'debt-book') navigateTo('/so-cong-no');
          else navigateTo('/lap-hoa-don');
        }}
        searchTerm={accSearchTerm}
        onSearchChange={setAccSearchTerm}
      >
        {activeMenu === 'reconciliation' ? (
          <TransactionReconciliation searchTerm={accSearchTerm} />
        ) : activeMenu === 'debt-book' ? (
          <DebtLedger searchTerm={accSearchTerm} />
        ) : (
          <PeriodicBilling searchTerm={accSearchTerm} />
        )}
      </AccountantLayout>
    );
  }

  // =========================================================================
  // 2. Phân hệ Ban Quản lý / Cán bộ / Admin (Chỉ dành cho QuanLy, CanBo, Admin)
  // =========================================================================
  if (userRole === 'CanBo' || userRole === 'Admin' || userRole === 'QuanLy') {
    // Trang Xử lý yêu cầu đăng ký ở
    if (currentPath.startsWith('/admin/requests/registration')) {
      const match = currentPath.match(/\/admin\/requests\/registration\/?(.*)/);
      const requestId = match && match[1] ? match[1] : 'DK-001';

      return (
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
      );
    }

    // Dashboard quản trị chung
    return (
      <AdminLayout
        activeTab={adminActiveTab}
        onSelectTab={setAdminActiveTab}
        searchTerm={adminSearchTerm}
        onSearchChange={setAdminSearchTerm}
        userName={localStorage.getItem('ktx_username') || 'QL_Minh'}
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
                            <td className="py-3.5 px-4 text-slate-700 max-w-xs truncate" title={req.nguyen_vong || req.noi_dung_nguyen_vong}>
                              {req.nguyen_vong || req.noi_dung_nguyen_vong || req.nguyen_vong_label || 'Xin xếp phòng'}
                            </td>
                            <td className="py-3.5 px-4 text-xs text-slate-500">
                              {req.ngay_gui ? new Date(req.ngay_gui).toLocaleDateString('vi-VN') : 'Hôm nay'}
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
                                onClick={() => navigateTo(`/admin/requests/registration/${targetId}`)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs ${isPending
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
                Vui lòng chọn tab "Dashboard", "Hồ sơ sinh viên", "Quản lý phòng ở" hoặc "Phản ánh sự cố".
              </p>
            </div>
          )}
      </AdminLayout>
    );
  }

  // =========================================================================
  // 3. Phân hệ Sinh viên (Dành riêng cho vai trò SinhVien)
  // =========================================================================

  const studentDisplayName =
    userFullName ||
    localStorage.getItem('ktx_fullname') ||
    localStorage.getItem('ktx_username') ||
    'Sinh viên';

  // Trang Đăng ký phòng
  if (
    currentPath === '/student/register' ||
    currentPath === '/student/register-room'
  ) {
    return (
      <RoomRegistrationPage
        userName={studentDisplayName}
        onNavigateHistory={() => {
          loadRequests();
          navigateTo('/student/history');
        }}
        onNavigateDashboard={() => navigateTo('/student/dashboard')}
        onLogout={handleLogout}
      />
    );
  }

  // Trang Gửi phản ánh (Incident / Feedback reporting)
  if (currentPath === '/student/feedback') {
    return (
      <FeedbackPage
        userName={studentDisplayName}
        onNavigateDashboard={() => navigateTo('/student/dashboard')}
        onNavigateRegister={() => navigateTo('/student/register')}
        onNavigateHistory={() => {
          loadRequests();
          navigateTo('/student/history');
        }}
        onLogout={handleLogout}
      />
    );
  }

  // Trang Lịch sử đăng ký phòng
  if (currentPath === '/student/history') {
    return (
      <StudentLayout
        activeTab="history"
        onSelectTab={(tabId) => {
          if (tabId === 'register') navigateTo('/student/register');
          if (tabId === 'feedback') navigateTo('/student/feedback');
          if (tabId === 'history') navigateTo('/student/history');
          if (tabId === 'dashboard') navigateTo('/student/dashboard');
        }}
        userName={studentDisplayName}
        userRole="Sinh viên"
        onLogout={handleLogout}
      >
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 lg:p-8 flex-1 flex flex-col">
          <div className="flex items-center justify-between pb-6 border-b border-slate-100 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Clock className="w-6 h-6 text-blue-600" />
                Lịch sử đăng ký chỗ ở
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Theo dõi trạng thái các đơn yêu cầu đăng ký phòng của bạn
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={loadRequests}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Làm mới"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingRequests ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => navigateTo('/student/register')}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Đăng ký phòng mới
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 rounded-l-lg">Mã đơn</th>
                  <th className="py-3 px-4">Nguyện vọng phòng</th>
                  <th className="py-3 px-4">Nội dung ghi chú</th>
                  <th className="py-3 px-4">Ngày gửi</th>
                  <th className="py-3 px-4 rounded-r-lg">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {requestsList.length > 0 ? (
                  requestsList.map((req, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-semibold text-blue-600">
                        {req.id || req.ma_yeu_cau || `DK-00${idx + 1}`}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {req.nguyen_vong_label || req.nguyen_vong_phong || 'P36 - Tầng 3 - Tòa A2'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                        {req.noi_dung_nguyen_vong || req.nguyen_vong || 'Nguyện vọng ở cùng bạn cùng lớp'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {req.ngay_gui ? new Date(req.ngay_gui).toLocaleDateString('vi-VN') : '26/09/2026'}
                      </td>
                      <td className="py-3.5 px-4">
                        {req.trang_thai === 'DA_DUYET' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Đã duyệt ({req.ma_hop_dong || 'Đã có phòng'})
                          </span>
                        ) : req.trang_thai === 'TU_CHOI' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Từ chối
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Chờ duyệt
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Chưa có đơn đăng ký nào. Bấm "Đăng ký phòng mới" để gửi đơn.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Mặc định cho Sinh viên: Trang Chủ Sinh viên (/student/dashboard hoặc /student)
  return (
    <StudentLayout
      activeTab="dashboard"
      onSelectTab={(tabId) => {
        if (tabId === 'register') navigateTo('/student/register');
        if (tabId === 'history') navigateTo('/student/history');
        if (tabId === 'feedback') navigateTo('/student/feedback');
        if (tabId === 'dashboard') navigateTo('/student/dashboard');
      }}
      userName={studentDisplayName}
      userRole="Sinh viên"
      onLogout={handleLogout}
    >
      <StudentDashboard
        user={{ ho_ten: studentDisplayName }}
        onNavigateRegister={() => navigateTo('/student/register')}
        onNavigateHistory={() => {
          loadRequests();
          navigateTo('/student/history');
        }}
      />
    </StudentLayout>
  );
}
