import React, { useState } from 'react';
import { X, Bed, Trash2, AlertTriangle, Users, Building2, UploadCloud } from 'lucide-react';
import { dormService } from '../../services/api';

export default function RoomDetailModal({
  isOpen,
  onClose,
  room,
  onUpdateSuccess,
}) {
  const [loadingBed, setLoadingBed] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !room) return null;

  const isService =
    (room.loai_phong || '').toLowerCase().includes('dịch vụ') ||
    (room.loai_phong || '').toLowerCase().includes('dich vu');

  const roomImage =
    room.hinh_anh ||
    (isService ? '/images/rooms/phong-dich-vu.jpg' : '/images/rooms/phong-tieu-chuan.jpg');

  const capacity = Number(room.suc_chua) || (room.giuongs?.length || 4);

  const handleToggleBedStatus = async (bed) => {
    setErrorMsg('');
    const newStatus = bed.trang_thai === 'TRONG' ? 'DA_THUE' : 'TRONG';
    setLoadingBed(bed.ma_giuong);

    try {
      await dormService.updateBedStatus(bed.ma_giuong, newStatus);
      if (onUpdateSuccess) onUpdateSuccess();
    } catch (err) {
      console.error('Error updating bed:', err);
      const detail = err.response?.data?.detail;
      setErrorMsg(
        typeof detail === 'string'
          ? detail
          : 'Không thể cập nhật trạng thái giường.'
      );
    } finally {
      setLoadingBed(null);
    }
  };

  const handleDeleteRoom = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa phòng ${room.so_phong}?`)) {
      return;
    }

    setDeleting(true);
    setErrorMsg('');
    try {
      await dormService.deleteRoom(room.ma_phong);
      if (onUpdateSuccess) onUpdateSuccess();
      onClose();
    } catch (err) {
      console.error('Error deleting room:', err);
      const detail = err.response?.data?.detail;
      setErrorMsg(
        typeof detail === 'string'
          ? detail
          : 'Không thể xóa phòng. Phòng có thể đang có hợp đồng hoạt động.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl font-bold text-slate-900">
                Chi tiết Phòng {room.so_phong}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isService
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-sky-100 text-blue-700 border border-sky-200'
                }`}
              >
                {isService ? 'Phòng dịch vụ' : 'Phòng tiêu chuẩn'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                Sức chứa: {capacity} người
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                {(Number(room.gia_tien_nam) || (isService ? 9600000 : 4800000)).toLocaleString('vi-VN')} đ/năm
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Mã phòng: <span className="font-mono text-slate-700">{room.ma_phong}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Room Image Preview Card */}
        <div className="mt-4 relative rounded-2xl overflow-hidden border border-slate-200 shadow-2xs h-36 group">
          <img
            src={roomImage}
            alt={`Phòng ${room.so_phong}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = isService
                ? '/images/rooms/phong-dich-vu.jpg'
                : '/images/rooms/phong-tieu-chuan.jpg';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end justify-between p-3">
            <div className="text-white text-xs">
              <span className="font-semibold text-sm">Phòng {room.so_phong}</span> •{' '}
              <span>{isService ? 'Phòng dịch vụ cao cấp' : 'Phòng tiêu chuẩn sinh viên'}</span>
            </div>

            <label className="px-3 py-1 bg-black/50 hover:bg-black/70 text-white rounded-full text-xs font-medium cursor-pointer transition flex items-center gap-1.5 backdrop-blur-xs shadow-sm">
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Đổi ảnh phòng</span>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const res = await dormService.uploadRoomImage(file);
                    if (res?.url) {
                      await dormService.updateRoom(room.ma_phong, { hinh_anh: res.url });
                      if (onUpdateSuccess) onUpdateSuccess();
                    }
                  } catch (uploadErr) {
                    console.error('Error uploading:', uploadErr);
                    setErrorMsg('Không thể tải ảnh lên.');
                  }
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Bed list section */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Danh sách giường ({room.giuongs?.length || capacity} giường / {capacity} chỗ)
            </h4>
            <span className="text-xs text-slate-500">
              Nhấp vào nút để đổi trạng thái
            </span>
          </div>

          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {room.giuongs?.map((bed, idx) => {
              const isFree = bed.trang_thai === 'TRONG';
              return (
                <div
                  key={bed.ma_giuong}
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200/70 transition"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isFree
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      <Bed className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">
                        Giường {idx + 1}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {bed.ma_giuong}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        isFree
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-100 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {isFree ? 'Còn trống' : 'Đã có người ở'}
                    </span>

                    <button
                      type="button"
                      disabled={loadingBed === bed.ma_giuong}
                      onClick={() => handleToggleBedStatus(bed)}
                      className="px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
                    >
                      {loadingBed === bed.ma_giuong
                        ? '...'
                        : isFree
                        ? 'Đánh dấu có người'
                        : 'Đánh dấu trống'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            disabled={deleting}
            onClick={handleDeleteRoom}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>{deleting ? 'Đang xóa...' : 'Xóa phòng này'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
