import React, { useState, useRef } from 'react';
import { X, UploadCloud, CheckCircle2, Trash2, Loader2, AlertCircle, Edit3 } from 'lucide-react';
import { dormService } from '../../services/api';

const STANDARD_PRICE = 4800000; // 4.8 triệu/năm cho phòng tiêu chuẩn
const SERVICE_PRICE = 8200000;  // 8.2 triệu/năm cho phòng dịch vụ

const PRICE_CHIPS = [
  { label: '4.8 tr (Tiêu chuẩn)', value: 4800000, category: 'Phòng tiêu chuẩn' },
  { label: '8.2 tr (Dịch vụ)', value: 8200000, category: 'Phòng dịch vụ' },
];

export default function EditRoomModal({ isOpen, room, onClose, onUpdated }) {
  if (!isOpen || !room) return null;

  const roomType = room.loai_phong || 'Phòng tiêu chuẩn';
  const isTypeService = roomType === 'Phòng dịch vụ';
  // Chuẩn hóa giá: nếu chưa đúng 4.8tr hay 8.2tr (như 300.000 cũ), tự động gán giá chuẩn
  let initialPrice = Number(room.gia_tien_nam);
  if (!initialPrice || (isTypeService && initialPrice !== SERVICE_PRICE) || (!isTypeService && initialPrice !== STANDARD_PRICE)) {
    initialPrice = isTypeService ? SERVICE_PRICE : STANDARD_PRICE;
  }

  const [formData, setFormData] = useState({
    so_phong: room.so_phong || '',
    suc_chua: Number(room.suc_chua) || 4,
    loai_phong: roomType,
    gia_tien_nam: initialPrice,
    hinh_anh: room.hinh_anh || '',
  });

  // Số lượng sinh viên đang ở trong phòng
  const occupiedCount =
    room.so_giuong_da_o ??
    (room.giuongs?.filter((g) => g.trang_thai !== 'TRONG').length || 0);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(room.hinh_anh || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const isService = formData.loai_phong === 'Phòng dịch vụ';
  const currentPrice = Number(formData.gia_tien_nam) || 0;

  // Lỗi xác thực giá nếu không thuộc 2 mức chuẩn
  let priceValidationError = '';
  if (!isService && currentPrice !== STANDARD_PRICE && currentPrice > 0) {
    priceValidationError = `Phòng tiêu chuẩn có giá quy định là 4.800.000 VNĐ/năm (~${Math.round(STANDARD_PRICE / 11).toLocaleString('vi-VN')} đ/tháng x 11 tháng).`;
  } else if (isService && currentPrice !== SERVICE_PRICE && currentPrice > 0) {
    priceValidationError = `Phòng dịch vụ có giá quy định là 8.200.000 VNĐ/năm (~${Math.round(SERVICE_PRICE / 11).toLocaleString('vi-VN')} đ/tháng x 11 tháng).`;
  }

  const handleRoomTypeChange = (newType) => {
    const newPrice = newType === 'Phòng dịch vụ' ? SERVICE_PRICE : STANDARD_PRICE;
    setFormData((prev) => ({
      ...prev,
      loai_phong: newType,
      gia_tien_nam: newPrice,
    }));
  };

  const handleSelectChip = (chip) => {
    setFormData((prev) => ({
      ...prev,
      loai_phong: chip.category,
      gia_tien_nam: chip.value,
    }));
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Dung lượng hình ảnh quá lớn. Vui lòng chọn tệp dưới 10MB.');
      return;
    }

    setErrorMsg('');
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setUploadingImage(true);
    setUploadSuccess(false);

    try {
      const res = await dormService.uploadRoomImage(file);
      if (res?.url) {
        setFormData((prev) => ({ ...prev, hinh_anh: res.url }));
        setUploadSuccess(true);
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      setErrorMsg('Không thể tải ảnh lên máy chủ. Bạn vẫn có thể tiếp tục với bản xem trước.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    setUploadSuccess(false);
    setFormData((prev) => ({ ...prev, hinh_anh: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.so_phong.trim()) {
      setErrorMsg('Vui lòng nhập số phòng.');
      return;
    }

    if (Number(formData.suc_chua) < occupiedCount) {
      setErrorMsg(
        `Phòng hiện đang có ${occupiedCount} người ở. Không thể chỉnh sửa số giường về nhỏ hơn ${occupiedCount}.`
      );
      return;
    }

    if (!isService && Number(formData.gia_tien_nam) !== STANDARD_PRICE) {
      setErrorMsg(`Phòng tiêu chuẩn có giá cố định là ${STANDARD_PRICE.toLocaleString('vi-VN')} đ/năm (~${Math.round(STANDARD_PRICE / 11).toLocaleString('vi-VN')} đ/tháng x 11 tháng).`);
      return;
    }
    if (isService && Number(formData.gia_tien_nam) !== SERVICE_PRICE) {
      setErrorMsg(`Phòng dịch vụ có giá cố định là ${SERVICE_PRICE.toLocaleString('vi-VN')} đ/năm (~${Math.round(SERVICE_PRICE / 11).toLocaleString('vi-VN')} đ/tháng x 11 tháng).`);
      return;
    }

    setLoading(true);
    try {
      const updated = await dormService.updateRoom(room.ma_phong, {
        so_phong: formData.so_phong.trim(),
        suc_chua: Number(formData.suc_chua),
        loai_phong: formData.loai_phong,
        gia_tien_nam: Number(formData.gia_tien_nam),
        hinh_anh: formData.hinh_anh || room.hinh_anh,
      });

      if (onUpdated) onUpdated(updated);
      onClose();
    } catch (err) {
      console.error('Error updating room:', err);
      const detail = err.response?.data?.detail;
      setErrorMsg(typeof detail === 'string' ? detail : 'Không thể cập nhật phòng.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Sửa thông tin phòng</h3>
              <p className="text-xs text-slate-500">Mã phòng: {room.ma_phong}</p>
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
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số phòng
              </label>
              <input
                type="text"
                value={formData.so_phong}
                onChange={(e) => setFormData({ ...formData, so_phong: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-sky-400 focus:bg-white font-medium"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Sức chứa (người / giường)
                </label>
                {occupiedCount > 0 && (
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                    Đang ở: {occupiedCount}
                  </span>
                )}
              </div>
              <select
                value={formData.suc_chua}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val < occupiedCount) {
                    setErrorMsg(`Không thể chọn ${val} giường vì phòng đang có ${occupiedCount} người ở.`);
                    return;
                  }
                  setErrorMsg('');
                  setFormData({ ...formData, suc_chua: val });
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-sky-400 focus:bg-white font-medium"
              >
                <option value={2} disabled={occupiedCount > 2}>
                  2 người (2 giường) {occupiedCount > 2 ? `— Đã có ${occupiedCount} người` : ''}
                </option>
                <option value={4} disabled={occupiedCount > 4}>
                  4 người (4 giường) {occupiedCount > 4 ? `— Đã có ${occupiedCount} người` : ''}
                </option>
                <option value={6} disabled={occupiedCount > 6}>
                  6 người (6 giường) {occupiedCount > 6 ? `— Đã có ${occupiedCount} người` : ''}
                </option>
                <option value={8} disabled={occupiedCount > 8}>
                  8 người (8 giường) {occupiedCount > 8 ? `— Đã có ${occupiedCount} người` : ''}
                </option>
              </select>
              {occupiedCount > 0 && (
                <p className="text-[11px] text-amber-600 mt-1 font-medium">
                  * Tối thiểu {occupiedCount} giường do phòng đang có sinh viên ở.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Loại phòng
            </label>
            <select
              value={formData.loai_phong}
              onChange={(e) => handleRoomTypeChange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-sky-400 focus:bg-white font-medium"
            >
              <option value="Phòng tiêu chuẩn">Phòng tiêu chuẩn</option>
              <option value="Phòng dịch vụ">Phòng dịch vụ</option>
            </select>
          </div>

          {/* Giá phòng */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Giá phòng / năm (VNĐ)
              </label>
            </div>
            <div className="relative">
              <input
                type="number"
                step="100000"
                value={formData.gia_tien_nam}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    gia_tien_nam: e.target.value ? Number(e.target.value) : '',
                  })
                }
                className={`w-full pl-3.5 pr-20 py-2.5 bg-slate-50 border rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:bg-white transition ${
                  priceValidationError
                    ? 'border-red-400 focus:border-red-500 bg-red-50/30'
                    : 'border-slate-200 focus:border-sky-400'
                }`}
                required
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                VNĐ/năm
              </div>
            </div>

            {priceValidationError && (
              <p className="text-[11px] text-rose-600 font-medium mt-1">
                {priceValidationError}
              </p>
            )}

            {/* Chips chọn nhanh chỉ 2 mức giá */}
            <div className="flex items-center gap-2 mt-2">
              {PRICE_CHIPS.map((chip) => {
                const isSelected =
                  Number(formData.gia_tien_nam) === chip.value &&
                  formData.loai_phong === chip.category;
                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => handleSelectChip(chip)}
                    className={`text-xs px-3 py-1.5 rounded-xl border transition font-semibold cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                        : 'bg-white hover:bg-blue-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ảnh phòng */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-blue-600" />
                <span>Hình ảnh phòng</span>
              </span>
              {imagePreview && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa ảnh</span>
                </button>
              )}
            </label>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {imagePreview ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-16 h-12 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition shrink-0 cursor-pointer"
                >
                  Đổi ảnh
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-4 text-center cursor-pointer transition"
              >
                <UploadCloud className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                <span className="text-xs text-slate-600 font-semibold">Tải ảnh lên từ máy tính</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-3 flex items-center justify-end gap-2.5 shrink-0 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || uploadingImage}
              className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-full transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
