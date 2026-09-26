import React, { useState } from 'react';
import AdminLayout from './layouts/Admin';
import RoomManagement from './pages/admin/RoomManagement';
import StudentManagement from './pages/admin/StudentManagement';

export default function App() {
  const [activeTab, setActiveTab] = useState('students'); // Mặc định mở tab Hồ sơ sinh viên theo yêu cầu
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <AdminLayout
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      userName="QL_Minh"
    >
      {activeTab === 'rooms' && (
        <RoomManagement searchTerm={searchTerm} />
      )}

      {activeTab === 'students' && (
        <StudentManagement searchTerm={searchTerm} />
      )}

      {activeTab !== 'rooms' && activeTab !== 'students' && (
        <div className="p-8 text-center text-slate-400 mt-20">
          <h2 className="text-xl font-bold text-slate-600 mb-2">
            Trang đang được xây dựng
          </h2>
          <p className="text-sm">
            Vui lòng chọn tab "Hồ sơ sinh viên" hoặc "Quản lý phòng ở".
          </p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              type="button"
              onClick={() => setActiveTab('students')}
              className="px-5 py-2 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition cursor-pointer"
            >
              Xem Hồ sơ sinh viên
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rooms')}
              className="px-5 py-2 bg-slate-200 text-slate-700 rounded-full text-sm font-semibold hover:bg-slate-300 transition cursor-pointer"
            >
              Về Quản lý phòng ở
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
