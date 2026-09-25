import React, { useState } from 'react';
import AdminLayout from './layouts/Admin';
import RoomManagement from './pages/admin/RoomManagement';

export default function App() {
  const [activeTab, setActiveTab] = useState('rooms');
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

      {activeTab !== 'rooms' && (
        <div className="p-8 text-center text-slate-400 mt-20">
          <h2 className="text-xl font-bold text-slate-600 mb-2">
            Trang đang được xây dựng
          </h2>
          <p className="text-sm">
            Vui lòng quay lại tab "Quản lý phòng ở".
          </p>
          <button
            type="button"
            onClick={() => setActiveTab('rooms')}
            className="mt-4 px-5 py-2 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition cursor-pointer"
          >
            Về Quản lý phòng ở
          </button>
        </div>
      )}
    </AdminLayout>
  );
}
