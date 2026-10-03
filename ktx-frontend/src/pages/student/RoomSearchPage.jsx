import React, { useState, useEffect, useMemo } from 'react';
import {
  SquarePen,
  LayoutGrid,
  ChevronDown,
  Home,
  Layers,
  Users,
  Tag,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import StudentLayout from '../../layouts/Student';
import StudentRoomDetailModal from '../../components/room/StudentRoomDetailModal';
import occupancyService from '../../services/occupancyService';

export default function RoomSearchPage({
  onSelectTab,
  onNavigate,
}) {
  // Dữ liệu danh sách phòng
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Bộ lọc tìm kiếm
  const [buildingFilter, setBuildingFilter] = useState('ALL');
  const [floorFilter, setFloorFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [capacityFilter, setCapacityFilter] = useState('ALL');

  // Điều kiện lọc đã áp dụng sau khi nhấn nút "Tìm phòng"
  const [appliedFilters, setAppliedFilters] = useState({
    building: 'ALL',
    floor: 'ALL',
    type: 'ALL',
    capacity: 'ALL',
  });

  // Modal xem chi tiết phòng
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // 8 card / trang (2 hàng x 4 cột theo đúng Figma)

  // Tải danh sách phòng từ Service
  useEffect(() => {
    const fetchRooms = async () => {
      setIsLoading(true);
      try {
        const data = await occupancyService.getRooms();
        setRooms(data || []);
      } catch (err) {
        console.error('Lỗi khi tải danh sách phòng:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRooms();
  }, []);

  // Xử lý khi bấm nút "Tìm phòng"
  const handleSearch = () => {
    setAppliedFilters({
      building: buildingFilter,
      floor: floorFilter,
      type: typeFilter,
      capacity: capacityFilter,
    });
    setCurrentPage(1);
  };

  // Logic lọc phòng theo tiêu chí đã chọn
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      // 1. Lọc theo Tòa nhà
      if (appliedFilters.building !== 'ALL') {
        const roomBuilding = (room.toa || room.ma_toa || '').toLowerCase();
        const targetBuilding = appliedFilters.building.toLowerCase();
        if (!roomBuilding.includes(targetBuilding.replace('tòa ', ''))) {
          return false;
        }
      }

      // 2. Lọc theo Tầng
      if (appliedFilters.floor !== 'ALL') {
        const targetFloorNum = appliedFilters.floor.replace('Tầng ', '').trim();
        const roomFloorNum = String(room.so_tang || (room.tang || '').replace(/\D/g, ''));
        if (roomFloorNum !== targetFloorNum) {
          return false;
        }
      }

      // 3. Lọc theo Loại phòng
      if (appliedFilters.type !== 'ALL') {
        const roomType = (room.loai_phong || '').toLowerCase();
        const targetType = appliedFilters.type.toLowerCase();
        if (!roomType.includes(targetType.replace('phòng ', ''))) {
          return false;
        }
      }

      // 4. Lọc theo Số người/phòng
      if (appliedFilters.capacity !== 'ALL') {
        const targetCap = parseInt(appliedFilters.capacity.replace(/\D/g, ''), 10);
        const roomCap = parseInt(room.suc_chua || (room.so_nguoi_display || '').replace(/\D/g, ''), 10);
        if (roomCap !== targetCap) {
          return false;
        }
      }

      return true;
    });
  }, [rooms, appliedFilters]);

  // Tính toán phân trang
  const totalPages = Math.max(1, Math.ceil((filteredRooms || []).length / itemsPerPage));
  const paginatedRooms = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRooms.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRooms, currentPage, itemsPerPage]);

  // Xử lý mở modal chi tiết phòng
  const handleOpenDetail = (room) => {
    setSelectedRoom(room);
    setIsModalOpen(true);
  };

  // Xử lý chuyển sang trang Đăng ký phòng và tự điền mã phòng vào Nguyện vọng
  const handleRegisterRoom = (room) => {
    try {
      const preferredData = {
        ma_phong: room.so_phong || room.ma_phong,
        so_phong: room.so_phong || room.ma_phong,
        toa: room.toa,
        ma_toa: room.ma_toa,
        tang: room.tang,
        loai_phong: room.loai_phong,
        gia_thue: room.gia_thue,
      };
      sessionStorage.setItem('preferred_room_registration', JSON.stringify(preferredData));
    } catch (e) {
      console.warn('Không thể lưu preferred room vào sessionStorage:', e);
    }

    setIsModalOpen(false);
    if (onNavigate) {
      onNavigate('/student/register');
    } else if (onSelectTab) {
      onSelectTab('register');
    } else {
      window.history.pushState({}, '', '/student/register');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const studentName =
    localStorage.getItem('ktx_fullname') ||
    localStorage.getItem('ktx_username') ||
    '';
  const buildingOptions = [...new Set((rooms || []).map((room) => room.toa || room.ma_toa).filter(Boolean))];
  const floorOptions = [...new Set((rooms || []).map((room) => Number(room.so_tang)).filter((floor) => floor > 0))].sort((a, b) => a - b);
  const typeOptions = [...new Set((rooms || []).map((room) => room.loai_phong).filter(Boolean))];
  const capacityOptions = [...new Set((rooms || []).map((room) => Number(room.suc_chua)).filter((capacity) => capacity > 0))].sort((a, b) => a - b);

  return (
    <StudentLayout
      activeTab="lookup"
      onSelectTab={onSelectTab}
      userName={studentName}
      userRole="Sinh viên"
    >
      {/* Khung nội dung chính bo góc mềm mại */}
      <div className="flex flex-1 flex-col justify-between self-stretch">
      <div className="space-y-6">
          {/* ========================================================================= */}
          {/* 1. TIÊU ĐỀ TRANG: ICON Ô VUÔNG CÂY BÚT + CHỮ TRA CỨU PHÒNG               */}
          {/* ========================================================================= */}
          <div className="flex items-center gap-3 select-none">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600">
              <SquarePen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                Tra cứu phòng
              </h1>
              <p className="text-sm text-slate-500">
                Tìm phòng trống theo tòa nhà, tầng và loại phòng.
              </p>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 2. THANH BỘ LỌC TÌM KIẾM PHÒNG (TOP FILTER CARD)                          */}
          {/* ========================================================================= */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              {/* Dropdown 1: Tòa nhà */}
              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-800 mb-2 block">
                  Tòa nhà
                </label>
                <div className="relative">
                  <select
                    value={buildingFilter}
                    onChange={(e) => setBuildingFilter(e.target.value)}
                    className="w-full bg-white border border-slate-200/90 rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none pr-10 cursor-pointer transition"
                  >
                    <option value="ALL">Tất cả khu</option>
                    <option value="Tòa A1">Tòa A1</option>
                    <option value="Tòa A2">Tòa A2</option>
                    <option value="Tòa A4">Tòa A4</option>
                    <option value="Tòa A5">Tòa A5</option>
                    <option value="Tòa A7">Tòa A7</option>
                    <option value="Tòa A19">Tòa A19</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Dropdown 2: Tầng */}
              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-800 mb-2 block">
                  Tầng
                </label>
                <div className="relative">
                  <select
                    value={floorFilter}
                    onChange={(e) => setFloorFilter(e.target.value)}
                    className="w-full bg-white border border-slate-200/90 rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none pr-10 cursor-pointer transition"
                  >
                    <option value="ALL">Tất cả tầng</option>
                    <option value="Tầng 1">Tầng 1</option>
                    <option value="Tầng 2">Tầng 2</option>
                    <option value="Tầng 3">Tầng 3</option>
                    <option value="Tầng 4">Tầng 4</option>
                    <option value="Tầng 5">Tầng 5</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Dropdown 3: Loại phòng */}
              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-800 mb-2 block">
                  Loại phòng
                </label>
                <div className="relative">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full bg-white border border-slate-200/90 rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none pr-10 cursor-pointer transition"
                  >
                    <option value="ALL">Tất cả loại</option>
                    <option value="Phòng tiêu chuẩn">Phòng tiêu chuẩn</option>
                    <option value="Phòng dịch vụ">Phòng dịch vụ</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Dropdown 4: Số người/phòng */}
              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-800 mb-2 block">
                  Số người/phòng
                </label>
                <div className="relative">
                  <select
                    value={capacityFilter}
                    onChange={(e) => setCapacityFilter(e.target.value)}
                    className="w-full bg-white border border-slate-200/90 rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none pr-10 cursor-pointer transition"
                  >
                    <option value="ALL">Tất cả</option>
                    <option value="4 người">4 người</option>
                    <option value="6 người">6 người</option>
                    <option value="8 người">8 người</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Nút Tìm phòng */}
              <div>
                <button
                  type="button"
                  onClick={handleSearch}
                  className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold py-2.5 px-6 rounded-2xl shadow-sm transition flex items-center justify-center cursor-pointer h-[42px]"
                >
                  Tìm phòng
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. DANH SÁCH PHÒNG (GRID CARDS 4 CỘT)                                     */}
          {/* ========================================================================= */}
          <div>
            {/* Tiêu đề danh sách */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 text-xl font-bold text-slate-900 select-none">
                <LayoutGrid className="w-5 h-5 text-blue-600" />
                <span>Danh sách phòng</span>
              </div>
            </div>

            {/* Trạng thái Loading */}
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <span className="text-sm font-semibold">Đang tải danh sách phòng...</span>
              </div>
            ) : paginatedRooms.length === 0 ? (
              /* Trạng thái không có kết quả */
              <div className="py-16 bg-white rounded-2xl border border-slate-200/80 text-center flex flex-col items-center justify-center gap-3 shadow-2xs">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center">
                  <LayoutGrid className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  Không tìm thấy phòng phù hợp
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Vui lòng chọn lại các tiêu chí tìm kiếm hoặc đặt lại bộ lọc để xem toàn bộ danh sách phòng.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setBuildingFilter('ALL');
                    setFloorFilter('ALL');
                    setTypeFilter('ALL');
                    setCapacityFilter('ALL');
                    setAppliedFilters({ building: 'ALL', floor: 'ALL', type: 'ALL', capacity: 'ALL' });
                    setCurrentPage(1);
                  }}
                  className="mt-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-xs hover:bg-blue-100 transition cursor-pointer"
                >
                  Xem tất cả phòng
                </button>
              </div>
            ) : (
              /* Lưới 4 cột trên Desktop */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {paginatedRooms?.map((room) => {
                  const isFull = room.trang_thai === 'DA_DAY';
                  const roomTang = room.tang
                    ? String(room.tang).replace(/t\?ng/gi, 'Tầng').replace(/^(\d+)$/, 'Tầng $1')
                    : (room.so_tang ? `Tầng ${room.so_tang}` : '');
                  const roomSiSo = room.si_so
                    ? String(room.si_so).replace(/ng\?\?i/gi, 'người')
                    : `${room.da_o ?? 0}/${room.suc_chua ?? 0} người`;
                  const roomGiaThue = room.gia_thue
                    ? String(room.gia_thue).replace(/\?\s*\/\s*n\?m/gi, 'đ / năm').replace(/\?/g, 'đ')
                    : (room.gia_tien_nam != null ? `${Number(room.gia_tien_nam).toLocaleString('vi-VN')} đ / năm` : '');

                  return (
                    <div
                      key={room.id}
                      className={`bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group ${isFull ? 'opacity-80' : ''
                        }`}
                    >
                      {/* Phần trên gồm 2 cột: Cột trái (ảnh) & Cột phải (thông tin) */}
                      <div className="flex gap-3.5 items-start">
                        {/* Cột trái: Ảnh phòng dáng đứng tỉ lệ cân đối bo góc w-24 h-28 */}
                        <div className="w-24 h-28 rounded-xl overflow-hidden shrink-0 bg-slate-100 shadow-2xs">
                          <img
                            src={room.hinh_anh || '/images/phong_thuc_te.jpg'}
                            alt={`Phòng ${room.so_phong}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              e.currentTarget.src = '/images/phong_thuc_te.jpg';
                            }}
                          />
                        </div>

                        {/* Cột phải: Thông tin phòng */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between h-28 py-0.5">
                          {/* Hàng đầu: Tên phòng + Pill Badge trạng thái */}
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-base font-black text-slate-900 tracking-tight truncate">
                              {room.so_phong}
                            </span>
                            {isFull ? (
                              <span className="bg-[#e2e8f0] text-slate-500 font-bold text-[11px] px-2.5 py-0.5 rounded-full shrink-0">
                                Đã đầy
                              </span>
                            ) : (
                              <span className="bg-[#dcfce7] text-[#15803d] font-bold text-[11px] px-2.5 py-0.5 rounded-full shrink-0">
                                Còn chỗ
                              </span>
                            )}
                          </div>

                          {/* Dòng 1: Tòa (Icon Home) */}
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 truncate">
                            <Home className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{room.toa}</span>
                          </div>

                          {/* Dòng 2: Tầng (Icon Layers) */}
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 truncate">
                            <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{roomTang}</span>
                          </div>

                          {/* Dòng 3: Sĩ số hiện tại (Icon Users) */}
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 truncate">
                            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{roomSiSo}</span>
                          </div>

                          {/* Dòng 4: Loại phòng (Icon Tag) */}
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 truncate">
                            <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{room.loai_phong}</span>
                          </div>
                        </div>
                      </div>

                      {/* Phần dưới: Mức giá & Nút Xem chi tiết */}
                      <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex flex-col">
                        {/* Giá thuê hiển thị màu xanh dương đậm hoặc xám mờ nếu đã đầy */}
                        <div
                          className={`font-black text-xs sm:text-sm tracking-tight ${isFull ? 'text-slate-400' : 'text-[#0f3b79]'
                            }`}
                        >
                          {roomGiaThue}
                        </div>

                        {/* Nút Xem chi tiết */}
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(room)}
                          className={`w-full py-1.5 rounded-xl font-bold text-xs mt-2.5 text-center transition cursor-pointer ${isFull
                            ? 'border border-slate-200 text-slate-400 hover:bg-slate-50'
                            : 'border border-blue-500 text-blue-600 hover:bg-blue-50'
                            }`}
                        >
                          Xem chi tiết
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. THANH PHÂN TRANG (PAGINATION) Ở GIỮA PHÍA DƯỚI                         */}
        {/* ========================================================================= */}
        {totalPages > 1 && (
          <div className="pt-8 pb-4 flex items-center justify-center gap-2 select-none">
            {/* Nút Trước */}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
              title="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Các số trang */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              const isActive = currentPage === pageNum;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-sm font-bold transition cursor-pointer flex items-center justify-center ${isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-2xs'
                    }`}
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Nút Sau */}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
              title="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. MODAL CHI TIẾT PHÒNG                                                   */}
      {/* ========================================================================= */}
      <StudentRoomDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        room={selectedRoom}
        onRegisterRoom={handleRegisterRoom}
      />
    </StudentLayout>
  );
}
