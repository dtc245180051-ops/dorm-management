import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Eye,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  User,
  FileText,
  X,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { dormService } from '../../services/api';
import EditRoomModal from './EditRoomModal';

export default function RoomDetailPage({
  room: initialRoom,
  roomId,
  onBack,
  onRoomDeleted,
  onRoomUpdated,
}) {
  const [room, setRoom] = useState(initialRoom || null);
  const [loading, setLoading] = useState(!initialRoom);
  const [errorMsg, setErrorMsg] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const currentRoomId = initialRoom?.ma_phong || roomId;

  // Lấy dữ liệu chi tiết phòng từ backend
  const fetchRoomDetail = async () => {
    if (!currentRoomId) return;
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await dormService.getRoomDetail(currentRoomId);
      if (data) {
        setRoom(data);
      }
    } catch (err) {
      console.error('Error fetching room detail:', err);
      // Nếu initialRoom đã có thì vẫn dùng initialRoom
      if (!initialRoom) {
        setErrorMsg('Không thể tải thông tin phòng. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomDetail();
  }, [currentRoomId]);

  if (loading && !room) {
    return (
      <div className="flex-1 bg-[#f4f5f7] rounded-2xl border border-slate-200/60 p-12 text-center min-h-0">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-500">Đang tải thông tin chi tiết phòng...</p>
      </div>
    );
  }

  if (errorMsg && !room) {
    return (
      <div className="flex-1 bg-[#f4f5f7] rounded-2xl border border-slate-200/60 p-10 text-center min-h-0">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-800 mb-4">{errorMsg}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2 bg-blue-600 text-white rounded-full text-xs font-semibold hover:bg-blue-700 transition cursor-pointer"
        >
          Quay lại danh sách phòng
        </button>
      </div>
    );
  }

  if (!room) return null;

  // Các thông tin chuẩn hóa
  const capacity = Number(room.suc_chua) || (room.giuongs?.length || 4);
  const beds = room.giuongs || [];

  // Tạo danh sách hiển thị giường
  const displayBeds = Array.from({ length: capacity }, (_, idx) => {
    if (beds[idx]) return beds[idx];
    return {
      ma_giuong: `${room.ma_phong}_G${String(idx + 1).padStart(2, '0')}`,
      trang_thai: 'TRONG',
    };
  });

  const isService =
    (room.loai_phong || '').toLowerCase().includes('dịch vụ') ||
    (room.loai_phong || '').toLowerCase().includes('dich vu');

  // Đếm số giường đã ở
  const occupiedCount = displayBeds.filter((b) => b.trang_thai !== 'TRONG').length;
  const isFull = occupiedCount >= capacity;

  // Tòa nhà và tầng
  const buildingName = room.ten_toa
    ? (room.ten_toa.startsWith('Tòa ') ? room.ten_toa : `Tòa ${room.ten_toa}`)
    : (room.ma_toa ? `Tòa ${room.ma_toa}` : 'Tòa KTX');

  const floorNumber = room.so_tang || (room.ma_tang?.split('_T')[1] || 1);

  // Phân loại giới tính phòng / tòa
  const genderType = room.gioi_tinh || 'Nam';
  const isMale = genderType.toLowerCase().includes('nam') && !genderType.toLowerCase().includes('nữ');

  // Giá phòng
  const roomPrice = Number(room.gia_tien_nam) || (isService ? 9600000 : 4800000);

  // Hình ảnh phòng
  const roomImage =
    room.hinh_anh ||
    (isService ? '/images/rooms/phong-dich-vu.jpg' : '/images/rooms/phong-tieu-chuan.jpg');

  // Xử lý xác nhận xóa phòng (chỉ cho phép khi phòng trống 0 người)
  const handleConfirmDelete = async () => {
    if (occupiedCount > 0) return;

    setDeleting(true);
    try {
      await dormService.deleteRoom(room.ma_phong);
      setIsDeleteModalOpen(false);
      if (onRoomDeleted) {
        onRoomDeleted(room.ma_phong);
      } else if (onBack) {
        onBack();
      }
    } catch (err) {
      console.error('Error deleting room:', err);
      const detail = err.response?.data?.detail;
      alert(
        typeof detail === 'string'
          ? detail
          : 'Không thể xóa phòng. Phòng có thể đang có sinh viên hoặc hợp đồng hiệu lực.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex-1 bg-[#f4f5f7] rounded-2xl border border-slate-200/60 p-7 min-h-0 relative overflow-y-auto flex flex-col animate-in fade-in duration-150">
      {/* Top Header: Nút back và Tiêu đề phòng */}
      <div className="flex items-start gap-3.5 mb-8">
        <button
          type="button"
          onClick={onBack}
          title="Quay lại danh sách phòng"
          className="mt-1 w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700 transition cursor-pointer shrink-0"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
            Phòng {room.so_phong} – {buildingName} – Tầng {floorNumber}
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            {room.loai_phong || 'Phòng tiêu chuẩn'} – {capacity} giường
          </p>
        </div>
      </div>

      {/* Grid danh sách các giường (Mỗi giường là một thẻ viền xanh bo góc theo thiết kế) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
        {displayBeds.map((bed, idx) => {
          const isOccupied = bed.trang_thai !== 'TRONG';
          const student = bed.sinh_vien;

          return (
            <div
              key={bed.ma_giuong || idx}
              className="bg-white rounded-2xl border border-sky-400 p-5 shadow-xs transition hover:shadow-md flex flex-col justify-between"
            >
              {/* Header của thẻ giường: Tên giường và Huy hiệu trạng thái */}
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">
                    Giường {idx + 1}
                  </h3>
                  {isOccupied ? (
                    <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-[#fee2e2] text-[#dc2626] border border-red-200/60">
                      Đã ở
                    </span>
                  ) : (
                    <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-[#d1fae5] text-[#059669] border border-emerald-200/60">
                      Còn trống
                    </span>
                  )}
                </div>

                {/* Thông tin người ở hoặc trạng thái trống */}
                {isOccupied ? (
                  <div className="mt-3.5">
                    <div className="text-sm font-bold text-slate-800">
                      {student?.ho_ten || 'Sinh viên đang ở'}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 font-medium">
                      MSV: {student?.msv || 'Đang cập nhật'}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-xs text-slate-400 italic font-medium">
                    Chưa có sinh viên đăng ký
                  </div>
                )}
              </div>

              {/* Link Xem hợp đồng hoặc thao tác */}
              <div className="mt-4 pt-2">
                {isOccupied ? (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedContract({
                        bedNumber: idx + 1,
                        bedId: bed.ma_giuong,
                        studentName: student?.ho_ten || 'Sinh viên',
                        msv: student?.msv || 'N/A',
                        contractId: student?.ma_hop_dong || `HD-${bed.ma_giuong}`,
                        roomNumber: room.so_phong,
                        buildingName: buildingName,
                      })
                    }
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-semibold transition cursor-pointer"
                  >
                    Xem hợp đồng
                  </button>
                ) : (
                  <span className="text-xs text-emerald-600 font-medium">
                    Sẵn sàng tiếp nhận sinh viên
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mục Thông tin phòng */}
      <div className="mb-8">
        <h2 className="text-base font-bold text-slate-900 mb-3">
          Thông tin phòng
        </h2>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 text-sm">
          {/* Mã phòng */}
          <div className="flex items-center justify-between px-6 py-3.5">
            <span className="text-slate-600 font-medium">Mã phòng</span>
            <span className="text-slate-800 font-bold font-mono">
              {room.ma_phong}
            </span>
          </div>

          {/* Hình ảnh */}
          <div className="flex items-center justify-between px-6 py-3.5">
            <span className="text-slate-600 font-medium">Hình ảnh</span>
            <button
              type="button"
              onClick={() => setPreviewImage(roomImage)}
              className="text-blue-600 font-semibold hover:underline cursor-pointer flex items-center gap-1.5"
            >
              <span>Xem hình ảnh</span>
              <Eye className="w-3.5 h-3.5 text-blue-500" />
            </button>
          </div>

          {/* Sức chứa */}
          <div className="flex items-center justify-between px-6 py-3.5">
            <span className="text-slate-600 font-medium">Sức chứa</span>
            <span className="text-slate-800 font-semibold">
              {occupiedCount}/{capacity} giường
            </span>
          </div>

          {/* Trạng thái */}
          <div className="flex items-center justify-between px-6 py-3.5">
            <span className="text-slate-600 font-medium">Trạng thái</span>
            <span className={`font-bold ${isFull ? 'text-rose-600' : 'text-emerald-600'}`}>
              {isFull ? 'Đã đầy' : `Còn trống ${capacity - occupiedCount} chỗ`}
            </span>
          </div>

          {/* Loại phòng */}
          <div className="flex items-center justify-between px-6 py-3.5">
            <span className="text-slate-600 font-medium">Loại phòng</span>
            <span
              className={`font-semibold ${isService ? 'text-amber-700' : 'text-amber-600'
                }`}
            >
              {room.loai_phong || 'Phòng tiêu chuẩn'}
            </span>
          </div>

          {/* Bổ sung: Dành cho (Nam/Nữ) */}
          <div className="flex items-center justify-between px-6 py-3.5">
            <span className="text-slate-600 font-medium">Dành cho sinh viên</span>
            <span
              className={`font-semibold px-2.5 py-0.5 rounded-full text-xs ${isMale
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
            >
              {isMale ? 'Tòa Nam' : 'Tòa Nữ'}
            </span>
          </div>

          {/* Bổ sung: Giá phòng */}
          <div className="flex items-center justify-between px-6 py-3.5">
            <span className="text-slate-600 font-medium">Giá phòng / năm</span>
            <div className="text-right">
              <span className="font-bold text-slate-900 text-sm">
                {roomPrice.toLocaleString('vi-VN')} đ/năm
              </span>
              <span className="text-xs text-slate-400 font-medium ml-1.5">
                (~{Math.round(roomPrice / 12).toLocaleString('vi-VN')} đ/tháng)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hai nút hành động dưới đáy */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nút Sửa thông tin phòng (xanh nhạt) */}
        <button
          type="button"
          onClick={() => setIsEditModalOpen(true)}
          className="py-3 px-6 bg-[#dbeafe] hover:bg-[#bfdbfe] text-[#2563eb] rounded-xl font-bold text-sm transition-all duration-150 text-center cursor-pointer shadow-2xs hover:shadow flex items-center justify-center gap-2"
        >
          <Edit3 className="w-4 h-4" />
          <span>Sửa thông tin phòng</span>
        </button>

        {/* Nút Xóa phòng (đỏ nhạt) - Luôn có phản hồi khi người dùng nhấp vào */}
        <button
          type="button"
          onClick={() => setIsDeleteModalOpen(true)}
          className="py-3 px-6 bg-[#fca5a5]/80 hover:bg-[#f87171] text-[#b91c1c] hover:text-white rounded-xl font-bold text-sm transition-all duration-150 text-center cursor-pointer shadow-2xs hover:shadow flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          <span>Xóa phòng</span>
        </button>
      </div>

      {/* Modal chỉnh sửa phòng */}
      {isEditModalOpen && (
        <EditRoomModal
          isOpen={isEditModalOpen}
          room={room}
          onClose={() => setIsEditModalOpen(false)}
          onUpdated={(updatedRoom) => {
            setRoom(updatedRoom);
            setIsEditModalOpen(false);
            if (onRoomUpdated) onRoomUpdated(updatedRoom);
          }}
        />
      )}

      {/* Lightbox xem ảnh to */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-2xl w-full p-4 overflow-hidden shadow-2xl relative"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-bold text-slate-800 text-sm">
                Ảnh Phòng {room.so_phong} – {buildingName}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewImage}
              alt={`Phòng ${room.so_phong}`}
              className="w-full h-80 object-cover rounded-2xl"
            />
          </div>
        </div>
      )}

      {/* Modal Xem hợp đồng mẫu khi bấm "Xem hợp đồng" */}
      {selectedContract && (
        <div
          onClick={() => setSelectedContract(null)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Chi tiết hợp đồng</h3>
                  <p className="text-xs text-slate-400">Giường {selectedContract.bedNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedContract(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Mã hợp đồng:</span>
                <span className="font-mono font-bold text-blue-600">{selectedContract.contractId}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Họ tên sinh viên:</span>
                <span className="font-bold text-slate-800">{selectedContract.studentName}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Mã sinh viên (MSV):</span>
                <span className="font-semibold text-slate-700">{selectedContract.msv}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Vị trí giường:</span>
                <span className="font-semibold text-slate-800">
                  Phòng {selectedContract.roomNumber} ({selectedContract.buildingName})
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Thời hạn hợp đồng:</span>
                <span className="font-semibold text-slate-700">01/09/2026 - 30/06/2027</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500 font-medium">Trạng thái:</span>
                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Hiệu lực (ACTIVE)
                </span>
              </div>
            </div>

            <div className="mt-6 pt-3 text-right">
              <button
                type="button"
                onClick={() => setSelectedContract(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-semibold text-xs transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận hoặc cảnh báo khi xóa phòng */}
      {isDeleteModalOpen && (
        <div
          onClick={() => setIsDeleteModalOpen(false)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150"
          >
            {occupiedCount > 0 ? (
              // TH1: Phòng có người ở -> Hiển thị cảnh báo giải thích rõ ràng và cách xử lý
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  Không thể xóa phòng này
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Phòng <span className="font-bold text-slate-800">{room.so_phong}</span> hiện đang có{' '}
                  <span className="font-bold text-rose-600">{occupiedCount} sinh viên</span> đang lưu trú hoặc có hợp đồng còn hiệu lực.
                </p>
                <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed mb-6">
                  💡 <strong>Hướng dẫn:</strong> Để xóa phòng, vui lòng điều chuyển sinh viên sang phòng khác hoặc thanh lý hợp đồng thuê phòng trước.
                </div>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition cursor-pointer"
                >
                  Đã hiểu
                </button>
              </div>
            ) : (
              // TH2: Phòng trống -> Hiển thị hộp thoại xác nhận xóa an toàn
              <div>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  Xác nhận xóa phòng?
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Bạn có chắc chắn muốn xóa <span className="font-bold text-slate-800">Phòng {room.so_phong}</span> ({buildingName} – Tầng {floorNumber}) không?
                </p>
                <div className="p-3 bg-rose-50/70 border border-rose-200/80 rounded-xl text-xs text-rose-800 leading-relaxed mb-6">
                  ⚠️ Thao tác này sẽ xóa vĩnh viễn dữ liệu phòng cùng danh sách {capacity} giường thuộc phòng khỏi hệ thống.
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition cursor-pointer disabled:opacity-50"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={handleConfirmDelete}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-sm transition cursor-pointer shadow-sm hover:shadow flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{deleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
