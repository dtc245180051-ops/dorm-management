import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from './layouts/Admin';
import StudentLayout from './layouts/Student';
import RoomManagement from './pages/admin/RoomManagement';
import StudentManagement from './pages/admin/StudentManagement';
import ProcessRegistrationPage from './pages/admin/ProcessRegistrationPage';
import RoomRegistrationPage from './pages/student/RoomRegistrationPage';
import occupancyService from './services/occupancyService';
import {
  Clock,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Plus,
  FileCheck,
  AlertCircle,
  Eye,
  RefreshCw,
} from 'lucide-react';

export default function App() {
  // Lấy đường dẫn ban đầu từ URL
  const [currentPath, setCurrentPath] = useState(
    window.location.pathname || '/student/register'
  );

  // State dành cho Admin
  const [adminActiveTab, setAdminActiveTab] = useState('dashboard');
  const [adminSearchTerm, setAdminSearchTerm] = useState('');

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

  // Lắng nghe thay đổi URL
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

  // 1. Phân hệ Admin: Trang Xử lý yêu cầu đăng ký ở (/admin/requests/registration/:id)
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
          onSwitchRole={(r) => navigateTo(r === 'admin' ? '/admin' : '/student/register')}
        />
      </div>
    );
  }

  // 2. Phân hệ Sinh viên: Trang Đăng ký ở (/student/register)
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
            navigateTo(r === 'admin' ? '/admin' : '/student/register');
          }}
        />
      </div>
    );
  }

  // 3. Phân hệ Sinh viên: Trang Lịch sử đăng ký (/student/history)
  if (currentPath === '/student/history') {
    return (
      <div className="relative">
        <StudentLayout
          activeTab="history"
          onSelectTab={(tabId) => {
            if (tabId === 'register') navigateTo('/student/register');
            if (tabId === 'dashboard') navigateTo('/student/dashboard');
          }}
          userName="Nguyễn Văn A"
          userRole="Sinh viên"
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
        <RoleSwitcher
          currentRole="student"
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(r === 'admin' ? '/admin' : '/student/register');
          }}
        />
      </div>
    );
  }

  // 4. Phân hệ Sinh viên: Trang Chủ Sinh viên (/student/dashboard)
  if (currentPath === '/student/dashboard') {
    return (
      <div className="relative">
        <StudentLayout
          activeTab="dashboard"
          onSelectTab={(tabId) => {
            if (tabId === 'register') navigateTo('/student/register');
            if (tabId === 'history') navigateTo('/student/history');
          }}
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
                  onClick={() => {
                    loadRequests();
                    navigateTo('/student/history');
                  }}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:shadow-md transition cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-700 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition">
                    <Clock className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">Lịch sử đăng ký</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Kiểm tra tiến độ xét duyệt và kết quả đăng ký phòng
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
            navigateTo(r === 'admin' ? '/admin' : '/student/register');
          }}
        />
      </div>
    );
  }

  // 5. Mặc định hoặc Phân hệ Ban Quản lý (Admin)
  return (
    <div className="relative">
      <AdminLayout
        activeTab={adminActiveTab}
        onSelectTab={setAdminActiveTab}
        searchTerm={adminSearchTerm}
        onSearchChange={setAdminSearchTerm}
        userName="QL_Minh"
      >
        {/* Tab Dashboard Admin hiển thị danh sách các đơn đăng ký đang chờ xử lý thực tế */}
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

              {/* Bảng danh sách yêu cầu đăng ký liên thông trực tiếp */}
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
          navigateTo(r === 'admin' ? '/admin' : '/student/register');
        }}
      />
    </div>
  );
}

// Thanh Switcher chuyển đổi nhanh giữa Phân hệ Admin và Phân hệ Sinh viên
function RoleSwitcher({ currentRole, onSwitchRole }) {
  return (
    <div className="fixed top-3 right-64 z-50 flex items-center bg-white/90 backdrop-blur-md border border-slate-200 p-1 rounded-full shadow-lg text-xs font-semibold">
      <button
        type="button"
        onClick={() => onSwitchRole('admin')}
        className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 cursor-pointer ${
          currentRole === 'admin'
            ? 'bg-slate-900 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Admin</span>
      </button>

      <button
        type="button"
        onClick={() => onSwitchRole('student')}
        className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 cursor-pointer ${
          currentRole === 'student'
            ? 'bg-blue-600 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        <UserCheck className="w-3.5 h-3.5" />
        <span>Sinh viên</span>
      </button>
    </div>
  );
}
