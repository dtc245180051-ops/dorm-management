import React, { useState } from 'react';
import {
  LayoutGrid,
  Building2,
  Users,
  AlertCircle,
  Scale,
  FileText,
  LogOut,
} from 'lucide-react';
import LogoutModal from './LogoutModal';

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'rooms', label: 'Quản lý phòng ở', icon: Building2, active: true },
  { id: 'students', label: 'Hồ sơ sinh viên', icon: Users },
  { id: 'incidents', label: 'Phản ánh sự cố', icon: AlertCircle },
  { id: 'violations', label: 'Quản lý vi phạm', icon: Scale },
  { id: 'reports', label: 'Báo cáo', icon: FileText },
];

export default function Sidebar({ activeTab = 'rooms', onSelectTab }) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleConfirmLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <aside className="w-64 min-h-[calc(100vh-1.75rem)] bg-[#f4f5f7] rounded-2xl border border-slate-200/60 p-6 select-none shrink-0 flex flex-col">
      {/* Logo iDORM */}
      <div className="mb-8 px-2 flex items-center">
        <div className="flex items-baseline tracking-tight">
          <span className="text-3xl font-black text-blue-600 font-sans">i</span>
          <span className="text-3xl font-black text-slate-900 tracking-normal">DORM</span>
        </div>
      </div>

      {/* Menu Section */}
      <div>
        <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-3 px-2">
          MENU
        </div>
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab && onSelectTab(item.id)}
                type="button"
                className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-[8px] text-sm transition-all duration-150 text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#dbeafe] text-blue-600 font-bold'
                    : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 font-medium'
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 ${
                    isActive ? 'text-blue-600' : 'text-slate-500'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Section - Cách phần menu khoảng 50px theo yêu cầu */}
      <div className="mt-[50px]">
        <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-3 px-2">
          HỆ THỐNG
        </div>
        <button
          type="button"
          onClick={() => setShowLogoutModal(true)}
          className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-[8px] text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors text-left cursor-pointer"
        >
          <LogOut className="w-5 h-5 text-slate-500 hover:text-red-500" />
          <span>Đăng xuất</span>
        </button>
      </div>

      {/* Modal xác nhận đăng xuất đẹp */}
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
        userName={localStorage.getItem('ktx_fullname') || localStorage.getItem('ktx_username') || 'Cán bộ'}
        userRole="Ban Quản lý"
      />
    </aside>
  );
}
