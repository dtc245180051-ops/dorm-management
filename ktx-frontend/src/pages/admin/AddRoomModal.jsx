import React, { useState } from 'react';
import { X, Plus, AlertCircle, Building2, Image as ImageIcon } from 'lucide-react';
import { dormService } from '../../services/api';

export default function AddRoomModal({
  isOpen,
  onClose,
  buildings = [],
  activeBuildingId = 'A1',
  onRoomAdded,
}) {
  const [formData, setFormData] = useState({
    ma_toa: activeBuildingId || (buildings[0]?.ma_toa || 'A1'),
    so_tang: 1,
    so_phong: '',
    suc_chua: 4,
    loai_phong: 'Phòng tiêu chuẩn',
    hinh_anh: '/images/rooms/phong-tieu-chuan.jpg',
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleTypeChange = (newType) => {
    const defaultImg =
      newType === 'Phòng dịch vụ'
        ? '/images/rooms/phong-dich-vu.jpg'
        : '/images/rooms/phong-tieu-chuan.jpg';
    setFormData((prev) => ({
      ...prev,
      loai_phong: newType,
      hinh_anh: defaultImg,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.so_phong.trim()) {
      setErrorMsg('Vui lòng nhập số phòng.');
      return;
    }

    setLoading(true);
    try {
      // 1. Đảm bảo tầng tồn tại, nếu chưa có thì tự động tạo tầng
      const ma_tang = `${formData.ma_toa}_T${formData.so_tang}`;
      try {
        await dormService.createFloor({
          ma_tang: ma_tang,
          so_tang: Number(formData.so_tang),
          ma_toa: formData.ma_toa,
        });
      } catch (floorErr) {
        // Tầng đã tồn tại là bình thường, tiếp tục
      }

      // 2. Tạo phòng mới và tự động sinh danh sách giường đúng bằng sức chứa
      await dormService.createRoom({
        so_phong: formData.so_phong.trim(),
        suc_chua: Number(formData.suc_chua),
        loai_phong: formData.loai_phong,
        hinh_anh: formData.hinh_anh,
        ma_tang: ma_tang,
      });

      if (onRoomAdded) onRoomAdded();
      onClose();
    } catch (err) {
      console.error('Error adding room:', err);
      const detail = err.response?.data?.detail;
      setErrorMsg(
        typeof detail === 'string'
          ? detail
          : 'Không thể thêm phòng. Vui lòng kiểm tra lại thông tin.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-sky-100 flex items-center justify-center text-blue-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Thêm phòng mới</h3>
              <p className="text-xs text-slate-500">Tự động sinh số lượng giường theo đúng sức chứa</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tòa nhà
            </label>
            <select
              value={formData.ma_toa}
              onChange={(e) => setFormData({ ...formData, ma_toa: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-sky-400 focus:bg-white"
            >
              {buildings.map((b) => (
                <option key={b.ma_toa} value={b.ma_toa}>
                  {b.ten_toa} ({b.ma_toa})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tầng
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={formData.so_tang}
                onChange={(e) => setFormData({ ...formData, so_tang: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-sky-400 focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số phòng
              </label>
              <input
                type="text"
                placeholder="VD: 105, 201"
                value={formData.so_phong}
                onChange={(e) => setFormData({ ...formData, so_phong: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-sky-400 focus:bg-white"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sức chứa (người / giường)
              </label>
              <select
                value={formData.suc_chua}
                onChange={(e) => setFormData({ ...formData, suc_chua: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-sky-400 focus:bg-white font-medium"
              >
                <option value={2}>2 người (2 giường)</option>
                <option value={4}>4 người (4 giường)</option>
                <option value={6}>6 người (6 giường)</option>
                <option value={8}>8 người (8 giường)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Loại phòng
              </label>
              <select
                value={formData.loai_phong}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-sky-400 focus:bg-white font-medium"
              >
                <option value="Phòng tiêu chuẩn">Phòng tiêu chuẩn</option>
                <option value="Phòng dịch vụ">Phòng dịch vụ</option>
              </select>
            </div>
          </div>

          {/* Chọn hình ảnh phòng */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Hình ảnh đại diện phòng</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setFormData({ ...formData, hinh_anh: '/images/rooms/phong-tieu-chuan.jpg' })}
                className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition ${
                  formData.hinh_anh === '/images/rooms/phong-tieu-chuan.jpg'
                    ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-400/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <img
                  src="/images/rooms/phong-tieu-chuan.jpg"
                  alt="Tiêu chuẩn"
                  className="w-12 h-10 rounded-lg object-cover"
                />
                <div className="text-xs">
                  <div className="font-semibold text-slate-800">Ảnh Tiêu chuẩn</div>
                  <div className="text-[11px] text-slate-400">Giường tầng gỗ</div>
                </div>
              </div>

              <div
                onClick={() => setFormData({ ...formData, hinh_anh: '/images/rooms/phong-dich-vu.jpg' })}
                className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition ${
                  formData.hinh_anh === '/images/rooms/phong-dich-vu.jpg'
                    ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-400/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <img
                  src="/images/rooms/phong-dich-vu.jpg"
                  alt="Dịch vụ"
                  className="w-12 h-10 rounded-lg object-cover"
                />
                <div className="text-xs">
                  <div className="font-semibold text-slate-800">Ảnh Dịch vụ</div>
                  <div className="text-[11px] text-slate-400">Cao cấp điều hòa</div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-full transition shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Đang tạo...</span>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Xác nhận thêm</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
