import React from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

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
      {/* Khối 1: Sidebar Admin (Bo tròn, nền xám) */}
      <Sidebar activeTab={activeTab} onSelectTab={onSelectTab} />

      {/* Cột bên phải chứa Khối 2 và Khối 3 */}
      <div className="flex-1 flex flex-col gap-3.5 min-w-0">
        {/* Khối 2: Header Admin (Bo tròn, nền xám) */}
        <Header
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          userName={userName}
        />

        {/* Khối 3: Khung nội dung chính (Bo tròn, nền xám) */}
        <main className="flex-1 flex flex-col min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
