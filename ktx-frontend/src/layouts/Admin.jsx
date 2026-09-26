import React from 'react';
import {
  LayoutGrid,
  Building2,
  Users,
  AlertCircle,
  Scale,
  FileText,
  LogOut,
  Search,
  Bell,
  User,
} from 'lucide-react';

const ADMIN_MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'rooms', label: 'Quản lý phòng ở', icon: Building2 },
  { id: 'students', label: 'Hồ sơ sinh viên', icon: Users },
  { id: 'incidents', label: 'Phản ánh sự cố', icon: AlertCircle },
  { id: 'violations', label: 'Quản lý vi phạm', icon: Scale },
  { id: 'reports', label: 'Báo cáo', icon: FileText },
];

export default function AdminLayout({
  children,
  activeTab = 'rooms',
  onSelectTab,
  searchTerm = '',
  onSearchChange,
  userName = 'QL_Minh',
}) {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 antialiased p-3.5 flex gap-3.5 box-border">
      {/* 1. Sidebar Admin (Bo tròn, nền xám iDoRM) */}
      <aside className="w-64 min-h-[calc(100vh-1.75rem)] bg-[#f4f5f7] rounded-2xl border border-slate-200/60 p-6 select-none shrink-0 flex flex-col justify-between">
        <div>
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
              {ADMIN_MENU_ITEMS.map((item) => {
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
        </div>

        {/* Hệ thống Section */}
        <div className="mt-[50px]">
          <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase mb-3 px-2">
            HỆ THỐNG
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Bạn có chắc chắn muốn đăng xuất không?')) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-[8px] text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors text-left cursor-pointer"
          >
            <LogOut className="w-5 h-5 text-slate-500 hover:text-red-500" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Cột bên phải chứa Header và Main Content */}
      <div className="flex-1 flex flex-col gap-3.5 min-w-0">
        {/* 2. Header Admin */}
        <header className="bg-[#f4f5f7] rounded-2xl border border-slate-200/60 px-8 py-3 flex items-center justify-between gap-6 shrink-0">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1 max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              placeholder="Tra cứu phòng, sinh viên,..."
              className="block w-full pl-11 pr-4 py-2.5 bg-white hover:bg-slate-50 focus:bg-white text-sm text-slate-800 placeholder-slate-400 rounded-full border border-slate-200/90 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 transition-all duration-150 shadow-2xs"
            />
          </div>

          {/* User & Actions bên phải */}
          <div className="flex items-center gap-3">
            {/* Nút chuông thông báo */}
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-sky-50 text-sky-600 border border-sky-400 rounded-full text-sm font-medium transition-colors shadow-2xs cursor-pointer"
            >
              <Bell className="w-4 h-4 text-sky-500" />
              <span>Thông báo</span>
            </button>

            {/* Pill User profile */}
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-semibold transition-colors shadow-xs cursor-pointer select-none">
              <User className="w-4 h-4 fill-white/20" />
              <span>{userName}</span>
            </div>
          </div>
        </header>

        {/* 3. Khung nội dung chính */}
        <main className="flex-1 flex flex-col min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
