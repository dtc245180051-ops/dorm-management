import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  RefreshCw,
  Users,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import studentService from '../../services/studentService';
import { dormService } from '../../services/api';
import StudentDetailPage from '../../components/student/StudentDetailPage';
import AddStudentPage from '../../components/student/AddStudentPage';

export default function StudentManagement({ searchTerm = '' }) {
  // Navigation / Views
  const [viewingStudent, setViewingStudent] = useState(null);
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  // Data States
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState({ total: 0, dang_o: 0, chua_xep: 0 });
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Filter States
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'dang_o', 'chua_xep'
  const [selectedBuilding, setSelectedBuilding] = useState('all');
  const [selectedRoom, setSelectedRoom] = useState('all');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // 1. Tải danh sách tòa nhà
  const fetchBuildings = async () => {
    try {
      const bldData = await dormService.getBuildings();
      if (Array.isArray(bldData)) {
        setBuildings(bldData);
      }
    } catch (err) {
      console.error('Error fetching buildings:', err);
    }
  };

  // 2. Tải thống kê số lượng sinh viên
  const fetchStats = async () => {
    try {
      const statsData = await studentService.getStudentStats();
      if (statsData) {
        setStats(statsData);
      }
    } catch (err) {
      console.error('Error fetching student stats:', err);
    }
  };

  // 3. Tải danh sách sinh viên theo bộ lọc và phân trang
  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = {
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
        search: searchTerm.trim() || undefined,
        status: activeTab,
        ma_toa: selectedBuilding !== 'all' ? selectedBuilding : undefined,
        so_phong: selectedRoom !== 'all' ? selectedRoom : undefined,
      };

      const result = await studentService.getStudents(params);
      setStudents(result.data || []);
      setTotalRecords(result.total || (result.data || []).length);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchBuildings();
    fetchStats();
  }, []);

  // Reload when filters or search change
  useEffect(() => {
    fetchStudents();
  }, [activeTab, selectedBuilding, selectedRoom, searchTerm, currentPage]);

  // Danh sách các phòng thuộc tòa đang chọn
  const currentBuildingRooms = useMemo(() => {
    if (selectedBuilding === 'all') {
      const allRooms = [];
      buildings.forEach((b) => {
        b.tangs?.forEach((t) => {
          t.phongs?.forEach((p) => {
            if (!allRooms.includes(p.so_phong)) allRooms.push(p.so_phong);
          });
        });
      });
      return allRooms.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }

    const bld = buildings.find((b) => b.ma_toa === selectedBuilding);
    if (!bld || !bld.tangs) return [];

    const roomNums = [];
    bld.tangs.forEach((t) => {
      t.phongs?.forEach((p) => {
        if (!roomNums.includes(p.so_phong)) roomNums.push(p.so_phong);
      });
    });

    return roomNums.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [buildings, selectedBuilding]);

  // Tính toán số trang
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  // Tòa nhà hiển thị
  const displayedBuildings = useMemo(() => {
    if (buildings.length > 0) return buildings;
    return [
      { ma_toa: 'A1', ten_toa: 'Tòa A1' },
      { ma_toa: 'A2', ten_toa: 'Tòa A2' },
      { ma_toa: 'A3', ten_toa: 'Tòa A3' },
      { ma_toa: 'A4', ten_toa: 'Tòa A4' },
      { ma_toa: 'A5', ten_toa: 'Tòa A5' },
      { ma_toa: 'A6', ten_toa: 'Tòa A6' },
    ];
  }, [buildings]);

  // Nếu đang xem chi tiết sinh viên (Figma Image 2)
  if (viewingStudent) {
    return (
      <StudentDetailPage
        student={viewingStudent}
        msv={viewingStudent.msv}
        onBack={() => {
          setViewingStudent(null);
          fetchStudents();
          fetchStats();
        }}
        onStudentUpdated={(updatedStudent) => {
          setViewingStudent(updatedStudent);
          fetchStudents();
          fetchStats();
          showToast(`Đã cập nhật hồ sơ sinh viên ${updatedStudent.ho_ten}`);
        }}
        onStudentDeleted={(deletedMsv) => {
          setViewingStudent(null);
          fetchStudents();
          fetchStats();
          showToast(`Đã xóa hồ sơ sinh viên ${deletedMsv} thành công`);
        }}
      />
    );
  }

  // Nếu đang xem màn hình thêm sinh viên (Figma Image 3)
  if (isAddingStudent) {
    return (
      <AddStudentPage
        onBack={() => {
          setIsAddingStudent(false);
          fetchStudents();
          fetchStats();
        }}
        onStudentAdded={(newStudent) => {
          setIsAddingStudent(false);
          fetchStudents();
          fetchStats();
          showToast(`Đã thêm thành công hồ sơ sinh viên ${newStudent.ho_ten}!`);
        }}
      />
    );
  }

  return (
    <div className="flex-1 bg-[#f4f5f7] rounded-2xl border border-slate-200/60 p-7 min-h-0 relative overflow-y-auto flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-2xl shadow-xl animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header: Tiêu đề HỒ SƠ SINH VIÊN */}
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight mb-4">
          HỒ SƠ SINH VIÊN
        </h1>

        {/* Filter Tabs & Nút Thêm sinh viên (Khớp hoàn toàn Figma Image 1) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* 3 Thẻ Tab: Tất cả, Đang ở, Đã trả phòng */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {/* Tab: Tất cả */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('all');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-[5px] transition cursor-pointer whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-[#dbeafe] text-blue-600 border border-blue-400 font-semibold'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              Tất cả ({stats.total || totalRecords})
            </button>

            {/* Tab: Đang ở */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('dang_o');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-[5px] transition cursor-pointer whitespace-nowrap ${
                activeTab === 'dang_o'
                  ? 'bg-[#dbeafe] text-blue-600 border border-blue-400 font-semibold'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              Đang ở ({stats.dang_o || 0})
            </button>

            {/* Tab: Đã trả phòng */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('da_tra_phong');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-[5px] transition cursor-pointer whitespace-nowrap ${
                activeTab === 'da_tra_phong'
                  ? 'bg-[#dbeafe] text-blue-600 border border-blue-400 font-semibold'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              Đã trả phòng ({stats.da_tra_phong || 0})
            </button>
          </div>

          {/* Nút + Thêm sinh viên (Viền xanh bo góc tròn theo Figma Image 1) */}
          <button
            type="button"
            onClick={() => setIsAddingStudent(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-white hover:bg-sky-50 text-sky-600 border border-sky-400 rounded-full text-xs font-medium transition cursor-pointer shadow-2xs shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5 text-sky-600" />
            <span>Thêm sinh viên</span>
          </button>
        </div>
      </div>

      {/* Synchronized Filter Bar: Đồng bộ phong cách trang Quản lý phòng */}
      <div className="space-y-3 mb-6">
        {/* Row 1: Building Pills (Tất cả tòa, Tòa A1, Tòa A2...) */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
          <button
            type="button"
            onClick={() => {
              setSelectedBuilding('all');
              setSelectedRoom('all');
              setCurrentPage(1);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap cursor-pointer shadow-2xs ${
              selectedBuilding === 'all'
                ? 'bg-sky-200 text-sky-900 border border-sky-300 font-bold'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
            }`}
          >
            Tất cả tòa
          </button>

          {displayedBuildings.map((b) => {
            const isActive = selectedBuilding === b.ma_toa;
            const displayName = b.ten_toa?.startsWith('Tòa') ? b.ten_toa : `Tòa ${b.ten_toa || b.ma_toa}`;
            return (
              <button
                key={b.ma_toa}
                type="button"
                onClick={() => {
                  setSelectedBuilding(b.ma_toa);
                  setSelectedRoom('all');
                  setCurrentPage(1);
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap cursor-pointer shadow-2xs ${
                  isActive
                    ? 'bg-sky-200 text-sky-900 border border-sky-300 font-bold'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                }`}
              >
                {displayName}
              </button>
            );
          })}
        </div>

        {/* Row 2: Room Pills (Tất cả phòng, Phòng 101, Phòng 102...) */}
        {currentBuildingRooms.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
            <button
              type="button"
              onClick={() => {
                setSelectedRoom('all');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1 rounded-full text-[11px] font-semibold transition whitespace-nowrap cursor-pointer shadow-2xs ${
                selectedRoom === 'all'
                  ? 'bg-sky-200 text-sky-900 border border-sky-300'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
              }`}
            >
              Tất cả phòng
            </button>

            {currentBuildingRooms.map((roomNum) => {
              const isActive = selectedRoom === roomNum;
              return (
                <button
                  key={roomNum}
                  type="button"
                  onClick={() => {
                    setSelectedRoom(roomNum);
                    setCurrentPage(1);
                  }}
                  className={`px-3.5 py-1 rounded-full text-[11px] font-semibold transition whitespace-nowrap cursor-pointer shadow-2xs ${
                    isActive
                      ? 'bg-sky-200 text-sky-900 border border-sky-300'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
                  }`}
                >
                  Phòng {roomNum}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Student Table Card (Co dãn độ cao theo số lượng sinh viên) */}
      <div className="bg-white rounded-[5px] border border-slate-200/80 shadow-2xs overflow-hidden w-full">
        {/* Table Header (Khớp hoàn toàn Figma Image 1) */}
        <div className="bg-[#dbeafe]/80 border-b border-sky-200/60 px-8 py-3.5 grid grid-cols-12 items-center text-slate-900 font-bold text-sm select-none gap-4">
          <div className="col-span-4">Họ tên</div>
          <div className="col-span-4">Mã sinh viên</div>
          <div className="col-span-3">Phòng</div>
          <div className="col-span-1 text-right"></div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-sm">Đang tải danh sách sinh viên...</span>
          </div>
        ) : students.length === 0 ? (
          /* Empty State */
          <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Users className="w-10 h-10 text-slate-300" />
            <span className="text-sm font-medium">
              Không tìm thấy hồ sơ sinh viên nào phù hợp.
            </span>
            <button
              type="button"
              onClick={() => setIsAddingStudent(true)}
              className="mt-1 text-xs text-blue-600 font-semibold underline hover:text-blue-800 cursor-pointer"
            >
              Thêm sinh viên mới ngay
            </button>
          </div>
        ) : (
          /* Table Rows - Chiều cao co dãn vừa đúng với số hàng */
          <div className="divide-y divide-slate-100">
            {students.map((sv) => {
              const isAssigned = sv.trang_thai_o === 'DANG_O' && sv.thong_tin_phong_hien_tai;
              const isTerminated = sv.trang_thai_o === 'DA_TRA_PHONG';
              const roomInfo = sv.thong_tin_phong_hien_tai;

              // Định dạng hiển thị phòng: e.g. "P102 - A1"
              let roomDisplay = 'Chưa xếp';
              if (isAssigned && roomInfo) {
                const bld = roomInfo.ten_toa
                  ? roomInfo.ten_toa.replace(/tòa/gi, '').trim()
                  : 'A1';
                roomDisplay = `P${roomInfo.so_phong || '102'} – ${bld}`;
              }

              return (
                <div
                  key={sv.msv}
                  className="px-8 py-3.5 grid grid-cols-12 items-center hover:bg-slate-50/70 transition-colors gap-4 text-sm"
                >
                  {/* Cột 1: Họ tên */}
                  <div className="col-span-4 font-bold text-slate-900 truncate">
                    <button
                      type="button"
                      onClick={() => setViewingStudent(sv)}
                      className="hover:text-blue-600 transition cursor-pointer text-left font-bold truncate"
                      title="Xem chi tiết hồ sơ"
                    >
                      {sv.ho_ten}
                    </button>
                  </div>

                  {/* Cột 2: Mã sinh viên */}
                  <div className="col-span-4 font-medium text-slate-600">
                    {sv.msv}
                  </div>

                  {/* Cột 3: Phòng (P102 - A1, Đã trả phòng hoặc màu cam Chưa xếp) */}
                  <div className="col-span-3 font-medium">
                    {isAssigned ? (
                      <span className="text-slate-700">{roomDisplay}</span>
                    ) : isTerminated ? (
                      <span className="text-slate-500 font-medium">Đã trả phòng</span>
                    ) : (
                      <span className="text-amber-500 font-medium">Chưa xếp</span>
                    )}
                  </div>

                  {/* Cột 4: Hành động xem chi tiết (Khớp Figma: chữ xanh gạch chân) */}
                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => setViewingStudent(sv)}
                      className="text-sky-600 underline font-medium hover:text-sky-800 text-xs transition cursor-pointer whitespace-nowrap"
                    >
                      xem chi tiết
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination Footer (Khớp hoàn toàn Figma Image 1: < [1] [2] ... [15] >) */}
      <div className="flex items-center justify-center gap-1.5 mt-6 select-none">
        {/* Nút Prev < */}
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          className="w-7 h-7 rounded-[5px] border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Trang 1 */}
        <button
          type="button"
          onClick={() => setCurrentPage(1)}
          className={`w-7 h-7 rounded-[5px] text-xs font-semibold flex items-center justify-center transition cursor-pointer ${
            currentPage === 1
              ? 'bg-[#dbeafe] text-blue-600 border border-blue-400'
              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
          }`}
        >
          1
        </button>

        {/* Trang 2 */}
        {totalPages >= 2 && (
          <button
            type="button"
            onClick={() => setCurrentPage(2)}
            className={`w-7 h-7 rounded-[5px] text-xs font-semibold flex items-center justify-center transition cursor-pointer ${
              currentPage === 2
                ? 'bg-[#dbeafe] text-blue-600 border border-blue-400'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            2
          </button>
        )}

        {/* Dấu ... */}
        {totalPages > 3 && (
          <span className="px-1 text-slate-500 text-xs font-bold">...</span>
        )}

        {/* Trang cuối nếu > 2 */}
        {totalPages > 2 && (
          <button
            type="button"
            onClick={() => setCurrentPage(totalPages)}
            className={`w-7 h-7 rounded-[5px] text-xs font-semibold flex items-center justify-center transition cursor-pointer ${
              currentPage === totalPages
                ? 'bg-[#dbeafe] text-blue-600 border border-blue-400'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            {totalPages}
          </button>
        )}

        {/* Nút Next > */}
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          className="w-7 h-7 rounded-[5px] border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
