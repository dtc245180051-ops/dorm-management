import React from 'react';
import { Search, Bell, User } from 'lucide-react';

export default function Header({
  searchTerm = '',
  onSearchChange,
  userName = 'QL_Minh',
}) {
  return (
    <header className="bg-[#f4f5f7] rounded-2xl border border-slate-200/60 px-8 py-3 flex items-center justify-between gap-6 shrink-0">
      {/* Search Input Bar */}
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

      {/* Right User & Actions */}
      <div className="flex items-center gap-3">
        {/* Notifications button */}
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-sky-50 text-sky-600 border border-sky-400 rounded-full text-sm font-medium transition-colors shadow-2xs cursor-pointer"
        >
          <Bell className="w-4 h-4 text-sky-500" />
          <span>Thông báo</span>
        </button>

        {/* User profile pill */}
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-semibold transition-colors shadow-xs cursor-pointer select-none">
          <User className="w-4 h-4 fill-white/20" />
          <span>{userName}</span>
        </div>
      </div>
    </header>
  );
}
