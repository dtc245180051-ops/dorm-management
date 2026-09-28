
import React, { useState, useEffect, useCallback } from 'react';
import Login from './pages/Login';
import LandingPage from './pages/public/LandingPage';
import AdminLayout from './layouts/Admin';
import StudentLayout from './layouts/Student';
import RoomManagement from './pages/admin/RoomManagement';
import StudentManagement from './pages/admin/StudentManagement';
import ProcessRegistrationPage from './pages/admin/ProcessRegistrationPage';
import ProcessTransferPage from './pages/admin/ProcessTransferPage';
import ProcessCheckoutPage from './pages/admin/ProcessCheckoutPage';
import RoomRegistrationPage from './pages/student/RoomRegistrationPage';
import RoomTransferPage from './pages/student/RoomTransferPage';
import RequestHistoryPage from './pages/student/RequestHistoryPage';
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
} from 'lucide-react';

export default function App() {
  const [currentPath, setCurrentPath] = useState(
    window.location.pathname || '/'
  );

  const [adminActiveTab, setAdminActiveTab] = useState('dashboard');
  const [adminSearchTerm, setAdminSearchTerm] = useState('');

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
      default:
        break;
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
          onLoginSuccess={() => navigateTo('/student/dashboard')}
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

  // 1. Phân hệ Admin: Xử lý yêu cầu đăng ký
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
          onSwitchRole={(r) => navigateTo(r === 'admin' ? '/admin' : '/student/dashboard')}
        />
      </div>
    );
  }

  // 1b. Phân hệ Admin: Xử lý yêu cầu chuyển phòng (Ảnh 1 Figma)
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
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(r === 'admin' ? '/admin' : '/student/dashboard');
          }}
        />
      </div>
    );
  }

  // 1c. Phân hệ Admin: Xử lý yêu cầu trả phòng (Ảnh 2 Figma)
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
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(r === 'admin' ? '/admin' : '/student/dashboard');
          }}
        />
      </div>
    );
  }

  // 2. Phân hệ Sinh viên: Đăng ký ở mới
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
            navigateTo(r === 'admin' ? '/admin' : '/student/dashboard');
          }}
        />
      </div>
    );
  }

  // 3. Phân hệ Sinh viên: Chuyển / Trả phòng
  if (currentPath === '/student/transfer-room' || currentPath === '/student/transfer') {
    return (
      <div className="relative">
        <RoomTransferPage />
        <RoleSwitcher
          currentRole="student"
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(r === 'admin' ? '/admin' : '/student/dashboard');
          }}
        />
      </div>
    );
  }

  // 4. Phân hệ Sinh viên: Lịch sử (gồm cả Lịch sử đăng ký & Lịch sử ở)
  if (currentPath === '/student/history') {
    return (
      <div className="relative">
        <RequestHistoryPage />
        <RoleSwitcher
          currentRole="student"
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(r === 'admin' ? '/admin' : '/student/dashboard');
          }}
        />
      </div>
    );
  }

  // 5. Phân hệ Sinh viên: Trang chủ Dashboard
  if (currentPath === '/student/dashboard') {
    return (
      <div className="relative">
        <StudentLayout
          activeTab="home"
          onSelectTab={handleStudentTabSelect}
          userName="Nguyễn Văn A"
          userRole="Sinh viên"
        >
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 lg:p-8 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-slate-100 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    Trang chủ Sinh viên KTX
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Chào mừng bạn đến với Cổng thông tin Ký túc xá trực tuyến
                  </p>
                </div>
              </div>

              {/* Banner thông tin phòng ở hiện tại (Cực kỳ quan trọng, tự động đồng bộ theo End-to-End Occupancy Lifecycle) */}
              <div className="rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 text-white p-5 sm:p-6 shadow-sm mb-6 select-none">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4 items-center">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-white/90 mb-1">
                      Phòng hiện tại
                    </p>
                    <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white drop-shadow-2xs">
                      {currentRoomInfo.phong_hien_tai}
                    </h3>
                  </div>
                  <div className="sm:border-l sm:border-white/20 sm:pl-6">
                    <p className="text-xs sm:text-sm font-medium text-white/90 mb-1">
                      Thành viên
                    </p>
                    <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white drop-shadow-2xs">
                      {currentRoomInfo.thanh_vien}
                    </h3>
                  </div>
                  <div className="sm:border-l sm:border-white/20 sm:pl-6">
                    <p className="text-xs sm:text-sm font-medium text-white/90 mb-1">
                      Thời gian lưu trú
                    </p>
                    <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white drop-shadow-2xs">
                      {currentRoomInfo.thoi_gian_luu_tru}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Lối tắt nhanh */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                <div
                  onClick={() => navigateTo('/student/register')}
                  className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200/80 hover:shadow-md transition cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">Đăng ký ở KTX</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Gửi yêu cầu đăng ký phòng/giường trống cho học kỳ mới
                  </p>
                  <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
                    Đăng ký ngay <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>

                <div
                  onClick={() => navigateTo('/student/transfer-room')}
                  className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200/80 hover:shadow-md transition cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">Chuyển / Trả phòng</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Gửi nguyện vọng chuyển phòng hoặc làm thủ tục trả phòng KTX
                  </p>
                  <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                    Làm đơn ngay <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>

                <div
                  onClick={() => navigateTo('/student/history')}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:shadow-md transition cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">Lịch sử đăng ký & ở</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Theo dõi tiến độ xét duyệt đơn và quá trình lưu trú tại KTX
                  </p>
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    Xem lịch sử <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </StudentLayout>
        <RoleSwitcher
          currentRole="student"
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(r === 'admin' ? '/admin' : '/student/dashboard');
          }}
        />
      </div>
    );
  }

  // 6. Phân hệ Ban Quản lý (Admin)
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
                    Danh sách yêu cầu phòng đang chờ xử lý
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Tiếp nhận các đơn đăng ký, chuyển phòng và trả phòng trực tuyến từ sinh viên, đối chiếu thông tin và phê duyệt
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

        {adminActiveTab !== 'dashboard' &&
          adminActiveTab !== 'rooms' &&
          adminActiveTab !== 'students' && (
            <div className="p-8 text-center text-slate-400 mt-20">
              <h2 className="text-xl font-bold text-slate-600 mb-2">
                Trang đang được xây dựng
              </h2>
              <p className="text-sm">
                Vui lòng chọn tab "Dashboard", "Hồ sơ sinh viên" hoặc "Quản lý phòng ở".
              </p>
            </div>
          )}
      </AdminLayout>
      <RoleSwitcher
        currentRole="admin"
        onSwitchRole={(r) => {
          loadRequests();
          navigateTo(r === 'admin' ? '/admin' : '/student/dashboard');
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
    if (onSwitchRole) onSwitchRole(r);
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
        className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 cursor-pointer ${currentRole === 'admin'
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
        className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 cursor-pointer ${currentRole === 'student'
          ? 'bg-blue-600 text-white shadow-xs'
          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
      >
        <UserCheck className="w-3.5 h-3.5" />
        <span>Sinh viên</span>
      </button>
    </div>
  );
}

