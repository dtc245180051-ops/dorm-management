import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Layers,
  Users,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  Edit3,
  Trash2,
  Plus,
  X,
  DoorClosed,
  Bed,
  Percent,
  RefreshCw,
  AlertCircle,
  Eye,
} from 'lucide-react';
import AddRoomModal from './AddRoomModal';
import EditRoomModal from './EditRoomModal';
import AddBuildingModal from './AddBuildingModal';
import { dormService } from '../../services/api';

export default function BuildingDetailPage({
  building: initialBuilding,
  buildingId,
  onBack,
  onBuildingUpdated,
  onBuildingDeleted,
  onSelectRoom,
}) {
  const targetBuildingId = initialBuilding?.ma_toa || buildingId || 'A1';

  // State dữ liệu tòa nhà
  const [building, setBuilding] = useState(initialBuilding || null);
  const [allBuildings, setAllBuildings] = useState([]);
  const [loading, setLoading] = useState(!initialBuilding);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  // Lọc tầng đang xem: 'all' hoặc số tầng (1, 2, 3...)
  const [selectedFloorTab, setSelectedFloorTab] = useState('all');

  // Modals cho tòa nhà
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddBuildingModalOpen, setIsAddBuildingModalOpen] = useState(false);

  // Modals cho thêm phòng / sửa phòng ngay trong trang chi tiết tòa
  const [isAddRoomModalOpen, setIsAddRoomModalOpen] = useState(false);
  const [addRoomFloor, setAddRoomFloor] = useState(1);
  const [editingRoom, setEditingRoom] = useState(null);

  // States form chỉnh sửa tòa
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState('Nam');
  const [editTotalFloors, setEditTotalFloors] = useState(5);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // States xóa tòa
  const [submittingDelete, setSubmittingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Fetch chi tiết tòa từ backend
  const fetchBuildingDetail = async (overrideId) => {
    const idToFetch = overrideId || targetBuildingId;
    if (!idToFetch) return null;
    try {
      setLoading(true);
      const data = await dormService.getBuildingDetail(idToFetch);
      if (data) {
        setBuilding(data);
        return data;
      }
    } catch (err) {
      console.error('Error fetching building detail:', err);
      if (!building && initialBuilding) {
        setBuilding(initialBuilding);
      }
    } finally {
      setLoading(false);
    }
    return null;
  };

  // Fetch danh sách tất cả các tòa để phục vụ AddRoomModal
  const fetchAllBuildings = async () => {
    try {
      const data = await dormService.getBuildings();
      if (Array.isArray(data) && data.length > 0) {
        setAllBuildings(data);
      }
    } catch (err) {
      console.error('Error fetching all buildings:', err);
    }
  };

  useEffect(() => {
    fetchBuildingDetail();
    fetchAllBuildings();
  }, [targetBuildingId]);

  // Cập nhật giá trị ban đầu cho form chỉnh sửa khi mở modal
  const handleOpenEditModal = () => {
    if (!building) return;
    const rawName = building.ten_toa || building.ma_toa;
    const cleanName = rawName.replace(/^Tòa\s*/i, '').trim();
    setEditName(cleanName);
    setEditGender(building.gioi_tinh || 'Nam');
    setEditTotalFloors(building.so_tang || 5);
    setEditError('');
    setIsEditModalOpen(true);
  };

  // Mở modal thêm phòng ngay trong trang chi tiết tòa
  const handleOpenAddRoomModal = (floorNumber = 1) => {
    setAddRoomFloor(Number(floorNumber) || 1);
    setIsAddRoomModalOpen(true);
  };

  // Xử lý gửi cập nhật tòa nhà
  const handleSaveEditBuilding = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      setEditError('Vui lòng nhập tên tòa nhà.');
      return;
    }
    const numFloors = parseInt(editTotalFloors, 10);
    if (!numFloors || numFloors <= 0) {
      setEditError('Số tầng phải là số nguyên dương lớn hơn 0.');
      return;
    }

    setSubmittingEdit(true);
    setEditError('');

    try {
      const updated = await dormService.updateBuilding(building.ma_toa, {
        ten_toa: editName.trim(),
        gioi_tinh: editGender,
        so_tang: numFloors,
      });

      setIsEditModalOpen(false);
      showToast(`Đã cập nhật thông tin tòa ${updated.ten_toa} thành công!`);
      await fetchBuildingDetail();
      await fetchAllBuildings();
      if (onBuildingUpdated) onBuildingUpdated(updated);
    } catch (err) {
      console.error('Error updating building:', err);
      const detail = err?.response?.data?.detail;
      setEditError(typeof detail === 'string' ? detail : 'Có lỗi xảy ra khi cập nhật tòa nhà.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Xử lý xóa tòa nhà
  const handleConfirmDeleteBuilding = async () => {
    setSubmittingDelete(true);
    setDeleteError('');

    try {
      await dormService.deleteBuilding(building.ma_toa);
      setIsDeleteModalOpen(false);
      showToast(`Đã xóa tòa nhà ${building.ten_toa || building.ma_toa} thành công!`);
      if (onBuildingDeleted) {
        onBuildingDeleted(building.ma_toa);
      } else if (onBack) {
        onBack();
      }
    } catch (err) {
      console.error('Error deleting building:', err);
      const detail = err?.response?.data?.detail;
      setDeleteError(
        typeof detail === 'string'
          ? detail
          : 'Không thể xóa tòa nhà. Vui lòng kiểm tra lại phòng và sinh viên đang ở.'
      );
    } finally {
      setSubmittingDelete(false);
    }
  };

  // Tính toán số liệu thống kê tổng hợp của tòa
  const stats = useMemo(() => {
    if (!building) {
      return {
        totalFloors: 5,
        totalRooms: 0,
        totalCapacity: 0,
        totalOccupied: 0,
        totalVacant: 0,
        occupancyRate: 0,
        hasOccupants: false,
      };
    }

    const tangs = building.tangs || [];
    let roomCount = 0;
    let capacity = 0;
    let occupied = 0;

    tangs.forEach((t) => {
      (t.phongs || []).forEach((p) => {
        roomCount += 1;
        const cap = Number(p.suc_chua) || (p.giuongs?.length || 4);
        capacity += cap;
        const beds = p.giuongs || [];
        const occBeds = beds.filter((b) => b.trang_thai !== 'TRONG').length;
        occupied += occBeds;
      });
    });

    const vacant = Math.max(0, capacity - occupied);
    const rate = capacity > 0 ? Math.round((occupied / capacity) * 100) : 0;

    return {
      totalFloors: building.so_tang || (tangs.length || 5),
      totalRooms: roomCount,
      totalCapacity: capacity,
      totalOccupied: occupied,
      totalVacant: vacant,
      occupancyRate: rate,
      hasOccupants: occupied > 0,
    };
  }, [building]);

  // Tạo danh sách đầy đủ tất cả các tầng
  const fullFloorList = useMemo(() => {
    if (!building) return [];
    const maxFloor = Math.max(building.so_tang || 5, (building.tangs || []).length);
    const tangMap = new Map();

    (building.tangs || []).forEach((t) => {
      tangMap.set(t.so_tang, t);
    });

    const list = [];
    for (let f = 1; f <= maxFloor; f++) {
      const existing = tangMap.get(f);
      const phongs = existing?.phongs || [];

      // Thống kê từng tầng
      let floorCap = 0;
      let floorOcc = 0;
      phongs.forEach((p) => {
        const cap = Number(p.suc_chua) || (p.giuongs?.length || 4);
        floorCap += cap;
        const occ = (p.giuongs || []).filter((b) => b.trang_thai !== 'TRONG').length;
        floorOcc += occ;
      });

      list.push({
        so_tang: f,
        ma_tang: existing?.ma_tang || `${building.ma_toa}_T${f}`,
        phongs: phongs.sort((a, b) => a.so_phong.localeCompare(b.so_phong, undefined, { numeric: true })),
        totalRooms: phongs.length,
        capacity: floorCap,
        occupied: floorOcc,
        vacant: Math.max(0, floorCap - floorOcc),
        occupancyRate: floorCap > 0 ? Math.round((floorOcc / floorCap) * 100) : 0,
      });
    }

    return list;
  }, [building]);

  // Lọc tầng theo tab được chọn
  const displayedFloors = useMemo(() => {
    if (selectedFloorTab === 'all') {
      return fullFloorList;
    }
    const num = parseInt(selectedFloorTab, 10);
    return fullFloorList.filter((f) => f.so_tang === num);
  }, [fullFloorList, selectedFloorTab]);

  if (loading && !building) {
    return (
      <div className="flex-1 bg-[#f4f5f7] rounded-2xl border border-slate-200/60 p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-600">Đang tải thông tin tòa nhà...</p>
      </div>
    );
  }

  if (!building) {
    return (
      <div className="flex-1 bg-[#f4f5f7] rounded-2xl border border-slate-200/60 p-12 text-center min-h-[400px] flex flex-col items-center justify-center">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-lg font-bold text-slate-800 mb-2">Không tìm thấy thông tin tòa nhà</h2>
        <p className="text-sm text-slate-500 mb-6">Tòa nhà có thể đã bị xóa hoặc không tồn tại.</p>
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-xs cursor-pointer"
        >
          Quay lại danh sách phòng
        </button>
      </div>
    );
  }

  const rawBuildingName = building.ten_toa || building.ma_toa;
  const displayName = rawBuildingName.startsWith('Tòa ') ? rawBuildingName : `Tòa ${rawBuildingName}`;
  const genderType = building.gioi_tinh || 'Nam';
  const isFemale = genderType.toLowerCase().includes('nữ') || genderType.toLowerCase().includes('nu');
  const isMale = genderType.toLowerCase().includes('nam') && !isFemale;

  return (
    <div className="flex-1 bg-[#f4f5f7] rounded-2xl border border-slate-200/60 p-7 min-h-0 relative overflow-y-auto flex flex-col animate-in fade-in duration-150">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 text-white text-sm font-semibold rounded-2xl shadow-xl animate-in slide-in-from-top-4 duration-200 ${
            toastType === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
          }`}
        >
          {toastType === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-200" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          )}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header: Nút Quay lại + Tiêu đề tòa + Các nút thao tác */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
        <div className="flex items-start gap-3.5">
          <button
            type="button"
            onClick={onBack}
            title="Quay lại danh sách phòng"
            className="mt-1 w-9 h-9 rounded-full hover:bg-slate-200/80 flex items-center justify-center text-slate-700 transition cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                {displayName}
              </h1>

              {/* Huy hiệu phân loại giới tính */}
              {isMale && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200/80 shadow-2xs">
                  Tòa Nam
                </span>
              )}
              {isFemale && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200/80 shadow-2xs">
                  Tòa Nữ
                </span>
              )}
              {!isMale && !isFemale && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200/80 shadow-2xs">
                  Nam & Nữ
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
              Hệ thống Ký túc xá – Quản lý cơ sở vật chất, các tầng và từng phòng
            </p>
          </div>
        </div>

        {/* Action Buttons: Thêm phòng, Chỉnh sửa tòa, Xóa tòa */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => handleOpenAddRoomModal(1)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm phòng</span>
          </button>

          <button
            type="button"
            onClick={handleOpenEditModal}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-4 h-4 text-blue-600" />
            <span>Chỉnh sửa</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDeleteError('');
              setIsDeleteModalOpen(true);
            }}
            className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Xóa tòa</span>
          </button>
        </div>
      </div>

      {/* Thẻ số liệu thống kê tổng quan (Grid 5 cột nổi bật) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-8">
        {/* Card 1: Số tầng */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Quy mô
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              {stats.totalFloors} <span className="text-xs font-normal text-slate-500">tầng</span>
            </div>
          </div>
        </div>

        {/* Card 2: Tổng số phòng */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <DoorClosed className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Tổng phòng
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              {stats.totalRooms} <span className="text-xs font-normal text-slate-500">phòng</span>
            </div>
          </div>
        </div>

        {/* Card 3: Tổng sức chứa */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
            <Bed className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Sức chứa
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">
              {stats.totalCapacity} <span className="text-xs font-normal text-slate-500">chỗ</span>
            </div>
          </div>
        </div>

        {/* Card 4: Đã ở / Còn trống */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Còn trống
            </div>
            <div className="text-xl font-extrabold text-emerald-600 mt-0.5">
              {stats.totalVacant}{' '}
              <span className="text-xs font-medium text-slate-400">/ {stats.totalCapacity}</span>
            </div>
          </div>
        </div>

        {/* Card 5: Tỷ lệ lấp đầy */}
        <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Lấp đầy
            </span>
            <span className="text-xs font-bold text-slate-700">{stats.occupancyRate}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                stats.occupancyRate >= 90
                  ? 'bg-rose-500'
                  : stats.occupancyRate >= 60
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, stats.occupancyRate)}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            Đang ở: {stats.totalOccupied} sinh viên
          </div>
        </div>
      </div>

      {/* Mục Tích hợp xem thông tin từng tầng */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <span>Thông tin chi tiết các tầng ({fullFloorList.length} tầng)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Nhấp chọn tầng để xem danh sách phòng, trạng thái từng giường và người ở
          </p>
        </div>

        {/* Bộ lọc Pills chọn tầng */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedFloorTab('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedFloorTab === 'all'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
            }`}
          >
            Tất cả tầng
          </button>
          {fullFloorList.map((f) => (
            <button
              key={f.so_tang}
              type="button"
              onClick={() => setSelectedFloorTab(String(f.so_tang))}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                selectedFloorTab === String(f.so_tang)
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
              }`}
            >
              <span>Tầng {f.so_tang}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md font-semibold ${
                  selectedFloorTab === String(f.so_tang)
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {f.totalRooms}p
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Danh sách các tầng được hiển thị */}
      <div className="space-y-6">
        {displayedFloors.map((floor) => {
          return (
            <div
              key={floor.so_tang}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition hover:border-slate-300"
            >
              {/* Header của thẻ tầng */}
              <div className="bg-slate-50/80 border-b border-slate-200/70 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100/70 text-blue-800 font-extrabold flex items-center justify-center text-sm shadow-2xs">
                    T{floor.so_tang}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">
                        Tầng {floor.so_tang} – {displayName}
                      </h3>
                      <span className="text-xs text-slate-400 font-medium">({floor.ma_tang})</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 font-medium">
                      <span>{floor.totalRooms} phòng</span>
                      <span>•</span>
                      <span>Sức chứa: {floor.capacity} chỗ</span>
                      <span>•</span>
                      <span className="text-emerald-600 font-semibold">
                        Trống: {floor.vacant} chỗ
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tỷ lệ lấp đầy tầng & nút thêm phòng */}
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-bold text-slate-700">
                      Lấp đầy: {floor.occupancyRate}%
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {floor.occupied} / {floor.capacity} chỗ
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenAddRoomModal(floor.so_tang)}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm phòng tầng {floor.so_tang}</span>
                  </button>
                </div>
              </div>

              {/* Danh sách phòng trong tầng */}
              {floor.phongs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center justify-center">
                  <DoorClosed className="w-9 h-9 text-slate-300 mb-2" />
                  <p className="text-sm font-medium text-slate-600">
                    Tầng {floor.so_tang} hiện chưa có phòng nào.
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 mb-3">
                    Bạn có thể bấm thêm phòng để tạo phòng mới cho tầng này.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenAddRoomModal(floor.so_tang)}
                    className="text-xs text-blue-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm phòng vào Tầng {floor.so_tang} ngay</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {/* Table Header trong tầng */}
                  <div className="bg-slate-100/50 px-6 py-2.5 grid grid-cols-12 items-center text-xs font-bold text-slate-600 select-none">
                    <div className="col-span-2">Số phòng</div>
                    <div className="col-span-3">Loại phòng & Giá tiền</div>
                    <div className="col-span-2">Sức chứa</div>
                    <div className="col-span-4">Trạng thái giường</div>
                    <div className="col-span-1 text-right">Thao tác</div>
                  </div>

                  {floor.phongs.map((phong) => {
                    const capacity = Number(phong.suc_chua) || (phong.giuongs?.length || 4);
                    const beds = phong.giuongs || [];

                    const displayBeds = Array.from({ length: capacity }, (_, idx) => {
                      if (beds[idx]) return beds[idx];
                      return {
                        ma_giuong: `${phong.ma_phong}_G${String(idx + 1).padStart(2, '0')}`,
                        trang_thai: 'TRONG',
                      };
                    });

                    const isService =
                      (phong.loai_phong || '').toLowerCase().includes('dịch vụ') ||
                      (phong.loai_phong || '').toLowerCase().includes('dich vu');

                    const roomPrice = Number(phong.gia_tien_nam) || (isService ? 9600000 : 4800000);
                    const occupiedBeds = displayBeds.filter((b) => b.trang_thai !== 'TRONG').length;
                    const isRoomFull = occupiedBeds >= capacity;

                    return (
                      <div
                        key={phong.ma_phong}
                        className="px-6 py-3.5 grid grid-cols-12 items-center hover:bg-slate-50/70 transition"
                      >
                        {/* Cột 1: Số phòng */}
                        <div className="col-span-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectRoom) {
                                onSelectRoom({
                                  ...phong,
                                  ma_toa: building.ma_toa,
                                  ten_toa: building.ten_toa,
                                  so_tang: floor.so_tang,
                                });
                              }
                            }}
                            className="font-bold text-slate-900 text-sm hover:text-blue-600 transition cursor-pointer flex items-center gap-1.5"
                          >
                            <span>Phòng {phong.so_phong}</span>
                            <Eye className="w-3.5 h-3.5 text-slate-400 hover:text-blue-600" />
                          </button>
                        </div>

                        {/* Cột 2: Loại phòng & Giá */}
                        <div className="col-span-3">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              isService
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-sky-50 text-sky-800 border-sky-200'
                            }`}
                          >
                            {phong.loai_phong || 'Phòng tiêu chuẩn'}
                          </span>
                          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {roomPrice.toLocaleString('vi-VN')} đ/năm
                          </div>
                        </div>

                        {/* Cột 3: Sức chứa */}
                        <div className="col-span-2 text-xs font-semibold text-slate-700">
                          {occupiedBeds}/{capacity} chỗ
                          {isRoomFull ? (
                            <span className="block text-[10px] text-red-600 font-bold mt-0.5">
                              Đã đầy
                            </span>
                          ) : (
                            <span className="block text-[10px] text-emerald-600 font-bold mt-0.5">
                              Còn {capacity - occupiedBeds} chỗ trống
                            </span>
                          )}
                        </div>

                        {/* Cột 4: Trạng thái các giường */}
                        <div className="col-span-4 flex items-center gap-1.5 flex-wrap">
                          {displayBeds.map((bed, bIdx) => {
                            const isFree = bed.trang_thai === 'TRONG';
                            return (
                              <div
                                key={bed.ma_giuong || bIdx}
                                title={`Giường ${bIdx + 1}: ${isFree ? 'Còn trống' : 'Đã có người ở'}`}
                                onClick={() => {
                                  if (onSelectRoom) {
                                    onSelectRoom({
                                      ...phong,
                                      ma_toa: building.ma_toa,
                                      ten_toa: building.ten_toa,
                                      so_tang: floor.so_tang,
                                    });
                                  }
                                }}
                                className={`w-6 h-6 rounded-md cursor-pointer transition transform hover:scale-110 shadow-2xs ${
                                  isFree
                                    ? 'bg-[#79d78e] hover:bg-[#68c87e]'
                                    : 'bg-[#f09898] hover:bg-[#e48383]'
                                }`}
                              />
                            );
                          })}
                        </div>

                        {/* Cột 5: Xem & Sửa phòng */}
                        <div className="col-span-1 text-right flex items-center justify-end gap-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (onSelectRoom) {
                                onSelectRoom({
                                  ...phong,
                                  ma_toa: building.ma_toa,
                                  ten_toa: building.ten_toa,
                                  so_tang: floor.so_tang,
                                });
                              }
                            }}
                            className="text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                            title="Xem chi tiết phòng & hợp đồng"
                          >
                            Xem
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRoom({
                                ...phong,
                                ma_toa: building.ma_toa,
                                ten_toa: building.ten_toa,
                                so_tang: floor.so_tang,
                              });
                            }}
                            className="text-xs text-slate-500 font-semibold hover:text-blue-600 cursor-pointer"
                            title="Chỉnh sửa thông tin phòng"
                          >
                            Sửa
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ============================================================================== */}
      {/* MODAL 1: CHỈNH SỬA THÔNG TIN TÒA NHÀ (NGAY TRONG TRANG CHI TIẾT TÒA) */}
      {/* ============================================================================== */}
      {isEditModalOpen && (
        <div
          onClick={() => setIsEditModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Chỉnh sửa thông tin tòa nhà
                  </h3>
                  <p className="text-xs text-slate-400">Mã tòa: {building.ma_toa}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditBuilding} className="space-y-4">
              {/* Tên tòa nhà */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tên tòa nhà <span className="text-rose-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-sm font-semibold text-slate-400 select-none">
                    Tòa
                  </span>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="ví dụ: A1, A2, B9..."
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Chỉ cần nhập A1, B2... hệ thống sẽ tự động hiển thị "Tòa {editName || '...'}"
                </p>
              </div>

              {/* Phân loại tòa (Nam, Nữ, Nam & Nữ) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Phân loại đối tượng ở
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Nam', label: 'Tòa Nam' },
                    { id: 'Nữ', label: 'Tòa Nữ' },
                    { id: 'Nam & Nữ', label: 'Nam & Nữ' },
                  ].map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setEditGender(g.id)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        editGender === g.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Số tầng của tòa */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tổng số tầng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={editTotalFloors}
                  onChange={(e) => setEditTotalFloors(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Ràng buộc: Không được nhỏ hơn tầng cao nhất hiện đang có phòng trong tòa.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 mt-5">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={submittingEdit}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
                >
                  {submittingEdit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Lưu thay đổi</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL 2: XÓA TÒA NHÀ */}
      {/* ============================================================================== */}
      {isDeleteModalOpen && (
        <div
          onClick={() => setIsDeleteModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Xóa tòa nhà {displayName}?
                </h3>
                <p className="text-xs text-slate-500">Mã tòa: {building.ma_toa}</p>
              </div>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            {stats.hasOccupants ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 text-amber-900 text-xs">
                <div className="font-bold flex items-center gap-1.5 mb-1 text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Không thể xóa tòa nhà lúc này</span>
                </div>
                <p className="text-slate-600">
                  Tòa <b>{displayName}</b> hiện đang có <b>{stats.totalOccupied} sinh viên</b> đang
                  ở với hợp đồng còn hiệu lực. Vui lòng chuyển hoặc kết thúc hợp đồng của sinh viên
                  trước khi xóa tòa.
                </p>
              </div>
            ) : stats.totalRooms > 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5 text-slate-700 text-xs">
                <p className="mb-1 font-semibold text-slate-800">
                  Tòa hiện có <b>{stats.totalRooms} phòng</b> (Tất cả đều đang trống 0 người).
                </p>
                <p className="text-slate-500">
                  Thao tác xóa sẽ xóa toàn bộ các tầng và phòng trực thuộc tòa này. Bạn có chắc
                  chắn muốn tiếp tục?
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                Tòa nhà này hiện chưa có phòng nào. Thao tác xóa sẽ loại bỏ hoàn toàn tòa nhà{' '}
                <b>{displayName}</b> khỏi hệ thống.
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={submittingDelete}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteBuilding}
                disabled={submittingDelete || stats.hasOccupants}
                className={`px-6 py-2.5 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shadow-xs ${
                  stats.hasOccupants
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                }`}
              >
                {submittingDelete ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <span>Xác nhận xóa tòa</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL 3: THÊM PHÒNG MỚI (MỞ TRỰC TIẾP NGAY TRONG TRANG CHI TIẾT TÒA) */}
      {/* ============================================================================== */}
      <AddRoomModal
        isOpen={isAddRoomModalOpen}
        onClose={() => setIsAddRoomModalOpen(false)}
        buildings={allBuildings.length > 0 ? allBuildings : (building ? [building] : [])}
        activeBuildingId={building?.ma_toa || targetBuildingId}
        initialFloor={addRoomFloor}
        onRoomAdded={async (addedBuildingId) => {
          setIsAddRoomModalOpen(false);
          const freshData = await fetchBuildingDetail(addedBuildingId || targetBuildingId);
          await fetchAllBuildings();
          if (onBuildingUpdated && freshData) {
            onBuildingUpdated(freshData);
          }
          showToast('Đã thêm phòng mới thành công!');
        }}
      />

      {/* ============================================================================== */}
      {/* MODAL 4: CHỈNH SỬA PHÒNG (MỞ TRỰC TIẾP NGAY TRONG TRANG CHI TIẾT TÒA) */}
      {/* ============================================================================== */}
      {editingRoom && (
        <EditRoomModal
          isOpen={!!editingRoom}
          room={editingRoom}
          onClose={() => setEditingRoom(null)}
          onUpdated={async () => {
            setEditingRoom(null);
            const freshData = await fetchBuildingDetail();
            await fetchAllBuildings();
            if (onBuildingUpdated && freshData) {
              onBuildingUpdated(freshData);
            }
            showToast('Cập nhật thông tin phòng thành công!');
          }}
        />
      )}

      {/* ============================================================================== */}
      {/* MODAL 5: THÊM TÒA NHÀ MỚI (MỞ TRỰC TIẾP NGAY TRONG TRANG CHI TIẾT TÒA) */}
      {/* ============================================================================== */}
      <AddBuildingModal
        isOpen={isAddBuildingModalOpen}
        onClose={() => setIsAddBuildingModalOpen(false)}
        onBuildingCreated={async (newBuilding) => {
          setIsAddBuildingModalOpen(false);
          await fetchAllBuildings();
          showToast(`Đã thêm tòa nhà ${newBuilding.ten_toa || newBuilding.ma_toa} thành công!`);
          if (onBuildingUpdated) onBuildingUpdated(newBuilding);
        }}
      />
    </div>
  );
}
