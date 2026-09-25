import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Filter,
  Plus,
  Building2,
  RefreshCw,
  CheckCircle2,
  Eye,
  X,
} from 'lucide-react';
import { dormService } from '../../services/api';
import AddRoomModal from './AddRoomModal';
import RoomDetailModal from './RoomDetailModal';

export default function RoomManagement({ searchTerm = '' }) {
  // States
  const [buildings, setBuildings] = useState([]);
  const [activeBuilding, setActiveBuilding] = useState('A1');
  const [activeRoomFilter, setActiveRoomFilter] = useState('all');
  const [filterMode, setFilterMode] = useState('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Loading & Toast
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // 1. Fetch buildings and rooms from backend API
  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await dormService.getBuildings();
      if (Array.isArray(data) && data.length > 0) {
        setBuildings(data);
        if (!activeBuilding && data[0]?.ma_toa) {
          setActiveBuilding(data[0].ma_toa);
        }
      }
    } catch (err) {
      console.error('Error fetching buildings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Danh sách tòa nhà hiển thị
  const displayedBuildings = useMemo(() => {
    if (!buildings || buildings.length === 0) {
      return [
        { ma_toa: 'A1', ten_toa: 'Tòa A1', gioi_tinh: 'Nam' },
        { ma_toa: 'A2', ten_toa: 'Tòa A2', gioi_tinh: 'Nam' },
        { ma_toa: 'A3', ten_toa: 'Tòa A3', gioi_tinh: 'Nữ' },
        { ma_toa: 'A4', ten_toa: 'Tòa A4', gioi_tinh: 'Nữ' },
        { ma_toa: 'A5', ten_toa: 'Tòa A5', gioi_tinh: 'Nam' },
        { ma_toa: 'A6', ten_toa: 'Tòa A6', gioi_tinh: 'Nữ' },
      ];
    }
    return buildings;
  }, [buildings]);

  // Extract rooms for current active building
  const currentBuildingRooms = useMemo(() => {
    const foundBuilding = buildings.find((b) => b.ma_toa === activeBuilding);
    if (!foundBuilding || !foundBuilding.tangs) return [];

    const roomsList = [];
    foundBuilding.tangs.forEach((tang) => {
      if (tang.phongs) {
        tang.phongs.forEach((p) => {
          roomsList.push({
            ...p,
            so_tang: tang.so_tang,
            ma_toa: foundBuilding.ma_toa,
            ten_toa: foundBuilding.ten_toa,
          });
        });
      }
    });

    return roomsList.sort((a, b) => a.so_phong.localeCompare(b.so_phong, undefined, { numeric: true }));
  }, [buildings, activeBuilding]);

  // Unique room numbers for second pill filter row
  const roomFilterNumbers = useMemo(() => {
    return Array.from(new Set(currentBuildingRooms.map((r) => r.so_phong)));
  }, [currentBuildingRooms]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return currentBuildingRooms.filter((room) => {
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchRoom = room.so_phong?.toLowerCase().includes(query);
        const matchType = room.loai_phong?.toLowerCase().includes(query);
        const matchCapacity = `${room.suc_chua || ''} người`.toLowerCase().includes(query);
        if (!matchRoom && !matchType && !matchCapacity) return false;
      }

      if (activeRoomFilter !== 'all' && room.so_phong !== activeRoomFilter) {
        return false;
      }

      const emptyBeds = room.giuongs?.filter((g) => g.trang_thai === 'TRONG').length || 0;

      if (filterMode === 'available') {
        return emptyBeds > 0;
      }
      if (filterMode === 'full') {
        return emptyBeds === 0;
      }

      return true;
    });
  }, [currentBuildingRooms, searchTerm, activeRoomFilter, filterMode]);

  return (
    <div className="flex-1 bg-[#f4f5f7] rounded-2xl border border-slate-200/60 p-7 min-h-0 relative overflow-y-auto flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-2xl shadow-xl animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Title & Top Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
          QUẢN LÝ PHÒNG Ở
        </h1>

        <div className="flex items-center gap-3 relative">
          {/* Nút Thêm phòng */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-semibold transition-all duration-150 shadow-sm cursor-pointer hover:shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm phòng</span>
          </button>

          {/* Nút Quản lý đăng ký */}
          <button
            type="button"
            onClick={() => showToast('Tính năng Quản lý đăng ký đang được cập nhật')}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-sky-50 text-sky-600 border border-sky-400 rounded-full text-sm font-medium transition-colors shadow-2xs cursor-pointer"
          >
            <Users className="w-4 h-4 text-sky-500" />
            <span>Quản lý đăng ký</span>
          </button>

          {/* Nút Lọc và Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-medium transition-all shadow-2xs cursor-pointer"
            >
              <Filter className="w-4 h-4" />
              <span>Lọc</span>
            </button>

            {/* Dropdown Menu theo thiết kế mockup */}
            {isFilterDropdownOpen && (
              <div className="absolute right-0 top-12 w-44 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-20 animate-in fade-in duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('all');
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition cursor-pointer ${
                    filterMode === 'all'
                      ? 'bg-sky-100 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Tất cả phòng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('available');
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition cursor-pointer ${
                    filterMode === 'available'
                      ? 'bg-sky-100 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Phòng còn trống
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('full');
                    setIsFilterDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition cursor-pointer ${
                    filterMode === 'full'
                      ? 'bg-sky-100 text-blue-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Phòng đã đầy
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 1: Building Pills (Tòa A1, Tòa A2...) */}
      <div className="flex items-center gap-3 overflow-x-auto pb-3 mb-3 scrollbar-none">
        {displayedBuildings.map((building) => {
          const isActive = activeBuilding === building.ma_toa;
          const rawName = building.ten_toa || building.ma_toa;
          const displayName = rawName.startsWith('Tòa ') ? rawName : `Tòa ${rawName}`;
          const isFemale =
            (building.gioi_tinh || '').toLowerCase().includes('nữ') ||
            (building.gioi_tinh || '').toLowerCase().includes('nu');
          const isMale =
            (building.gioi_tinh || '').toLowerCase().includes('nam') && !isFemale;

          return (
            <button
              key={building.ma_toa}
              type="button"
              onClick={() => {
                setActiveBuilding(building.ma_toa);
                setActiveRoomFilter('all');
              }}
              className={`px-5 py-2 rounded-full text-sm transition-all duration-150 whitespace-nowrap cursor-pointer shadow-2xs flex items-center gap-2 ${
                isActive
                  ? 'bg-sky-200 text-sky-900 font-bold border border-sky-300'
                  : 'bg-white text-slate-700 hover:bg-slate-100 font-medium border border-slate-300'
              }`}
            >
              <span>{displayName}</span>
              {isMale && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                    isActive
                      ? 'bg-blue-100/90 text-blue-900'
                      : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                  }`}
                >
                  Nam
                </span>
              )}
              {isFemale && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                    isActive
                      ? 'bg-rose-100/90 text-rose-900'
                      : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                  }`}
                >
                  Nữ
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Row 2: Room Pills (Phòng 101, Phòng 102...) */}
      <div className="flex items-center gap-3 overflow-x-auto pb-4 mb-6 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveRoomFilter('all')}
          className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
            activeRoomFilter === 'all'
              ? 'bg-sky-200 text-sky-900 border border-sky-300'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
          }`}
        >
          Tất cả phòng
        </button>

        {roomFilterNumbers.map((roomNumber) => {
          const isActive = activeRoomFilter === roomNumber;
          return (
            <button
              key={roomNumber}
              type="button"
              onClick={() => setActiveRoomFilter(roomNumber)}
              className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
                isActive
                  ? 'bg-sky-200 text-sky-900 border border-sky-300'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
              }`}
            >
              Phòng {roomNumber}
            </button>
          );
        })}
      </div>

      {/* Main Room Table Card (Nền trắng bo góc nổi trên khối xám) */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-xs overflow-hidden">
        {/* Table Header Row (Light Blue Header) */}
        <div className="bg-[#dbeafe]/80 border-b border-sky-200/60 px-8 py-4 grid grid-cols-12 items-center text-slate-900 font-bold text-sm select-none gap-2">
          <div className="col-span-1">Phòng</div>
          <div className="col-span-2">Hình ảnh</div>
          <div className="col-span-1">Sức chứa</div>
          <div className="col-span-2">Loại phòng</div>
          <div className="col-span-2">Giá tiền / năm</div>
          <div className="col-span-3">Giường</div>
          <div className="col-span-1 text-right"></div>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-sm">Đang tải danh sách phòng...</span>
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Building2 className="w-10 h-10 text-slate-300" />
            <span className="text-sm font-medium">
              Chưa có phòng nào tại {displayedBuildings.find((b) => b.ma_toa === activeBuilding)?.ten_toa || activeBuilding}.
            </span>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="mt-2 text-xs text-blue-600 font-semibold underline hover:text-blue-800 cursor-pointer"
            >
              Thêm phòng mới ngay
            </button>
          </div>
        ) : (
          /* Table Rows */
          <div className="divide-y divide-slate-200/70">
            {filteredRooms.map((room) => {
              // Sức chứa của phòng
              const capacity = Number(room.suc_chua) || (room.giuongs?.length || 4);
              const beds = room.giuongs || [];

              // Tạo danh sách hiển thị đúng từng đấy giường (hình vuông) tương ứng với sức chứa
              const displayBeds = Array.from({ length: capacity }, (_, idx) => {
                if (beds[idx]) return beds[idx];
                return {
                  ma_giuong: `${room.ma_phong}_G${String(idx + 1).padStart(2, '0')}`,
                  trang_thai: 'TRONG',
                };
              });

              // Phân loại phòng: tiêu chuẩn hay dịch vụ
              const isService =
                (room.loai_phong || '').toLowerCase().includes('dịch vụ') ||
                (room.loai_phong || '').toLowerCase().includes('dich vu');

              // Ảnh phòng đại diện
              const roomImage =
                room.hinh_anh ||
                (isService
                  ? '/images/rooms/phong-dich-vu.jpg'
                  : '/images/rooms/phong-tieu-chuan.jpg');

              // Giá tiền / năm
              const roomPrice = Number(room.gia_tien_nam) || (isService ? 9600000 : 4800000);

              return (
                <div
                  key={room.ma_phong}
                  className="px-8 py-4 grid grid-cols-12 items-center hover:bg-slate-50/60 transition-colors gap-2"
                >
                  {/* Cột 1: Phòng (Số phòng) */}
                  <div className="col-span-1 font-bold text-slate-800 text-base">
                    {room.so_phong}
                  </div>

                  {/* Cột 2: Hình ảnh (Bên phải của cột phòng) */}
                  <div className="col-span-2 flex items-center">
                    <div
                      onClick={() =>
                        setPreviewImage({
                          url: roomImage,
                          title: `Phòng ${room.so_phong} - ${isService ? 'Phòng dịch vụ' : 'Phòng tiêu chuẩn'}`,
                          capacity: capacity,
                          roomType: isService ? 'Phòng dịch vụ' : 'Phòng tiêu chuẩn',
                        })
                      }
                      className="relative group w-14 h-10 lg:w-16 lg:h-11 rounded-xl overflow-hidden border border-slate-200/80 bg-slate-100 cursor-pointer shadow-2xs hover:shadow-md transition-all duration-200"
                      title="Nhấp để xem ảnh phòng"
                    >
                      <img
                        src={roomImage}
                        alt={`Phòng ${room.so_phong}`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                        onError={(e) => {
                          e.target.src = isService
                            ? '/images/rooms/phong-dich-vu.jpg'
                            : '/images/rooms/phong-tieu-chuan.jpg';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="w-3.5 h-3.5 text-white drop-shadow" />
                      </div>
                    </div>
                  </div>

                  {/* Cột 3: Sức chứa (Sửa từ cột Loại phòng cũ) */}
                  <div className="col-span-1 font-semibold text-slate-800 text-sm">
                    {capacity} người
                  </div>

                  {/* Cột 4: Loại phòng (Phòng tiêu chuẩn / Phòng dịch vụ) */}
                  <div className="col-span-2">
                    {isService ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Phòng dịch vụ
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200/80 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                        Phòng tiêu chuẩn
                      </span>
                    )}
                  </div>

                  {/* Cột 5: Giá tiền / năm */}
                  <div className="col-span-2">
                    <div className="text-slate-900 font-bold text-sm tracking-tight">
                      {roomPrice.toLocaleString('vi-VN')} đ
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium">
                      ~{Math.round(roomPrice / 12).toLocaleString('vi-VN')} đ/tháng
                    </div>
                  </div>

                  {/* Cột 6: Giường (Số lượng ô vuông đúng bằng sức chứa của phòng) */}
                  <div className="col-span-3 flex items-center gap-1.5 flex-wrap">
                    {displayBeds.map((bed, idx) => {
                      const isFree = bed.trang_thai === 'TRONG';
                      return (
                        <div
                          key={bed.ma_giuong || idx}
                          title={`Giường ${idx + 1}: ${isFree ? 'Còn trống' : 'Đã có người ở'}`}
                          onClick={() => {
                            setSelectedRoom(room);
                            setIsDetailModalOpen(true);
                          }}
                          className={`w-7 h-7 lg:w-8 lg:h-8 rounded-lg cursor-pointer transition-all duration-150 transform hover:scale-110 shadow-2xs ${
                            isFree
                              ? 'bg-[#79d78e] hover:bg-[#68c87e]' // Green
                              : 'bg-[#f09898] hover:bg-[#e48383]' // Pink / Red
                          }`}
                        />
                      );
                    })}
                  </div>

                  {/* Cột 7: Hành động */}
                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoom(room);
                        setIsDetailModalOpen(true);
                      }}
                      className="text-sky-600 underline font-semibold hover:text-sky-800 text-xs transition cursor-pointer whitespace-nowrap"
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

      {/* Bottom Legend (Chú thích) */}
      <div className="flex items-center gap-6 mt-6 px-2 select-none">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-[#79d78e]" />
          <span className="text-xs font-medium text-slate-600">Còn trống</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-[#f09898]" />
          <span className="text-xs font-medium text-slate-600">Đã có người ở</span>
        </div>
      </div>

      {/* Modal phóng to ảnh phòng */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="w-full h-72 object-cover"
              />
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900">{previewImage.title}</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sức chứa: {previewImage.capacity} người • {previewImage.roomType}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal thêm phòng */}
      <AddRoomModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        buildings={displayedBuildings}
        activeBuildingId={activeBuilding}
        onRoomAdded={(newBuildingId) => {
          fetchData();
          if (newBuildingId) {
            setActiveBuilding(newBuildingId);
          }
          showToast('Đã thêm phòng mới thành công!');
        }}
      />

      {/* Modal xem chi tiết phòng */}
      <RoomDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedRoom(null);
        }}
        room={selectedRoom}
        onUpdateSuccess={() => {
          fetchData();
          showToast('Cập nhật dữ liệu phòng thành công!');
        }}
      />
    </div>
  );
}
