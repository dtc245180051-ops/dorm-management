import React, { useState, useRef } from 'react';
import {
  X,
  Plus,
  AlertCircle,
  Building2,
  UploadCloud,
  CheckCircle2,
  Trash2,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { dormService } from '../../services/api';

// Ràng buộc khoảng giá theo loại phòng
const STANDARD_MAX_PRICE = 6000000; // Tối đa 6 triệu/năm cho phòng tiêu chuẩn
const SERVICE_MIN_PRICE = 7000000;  // Tối thiểu 7 triệu/năm cho phòng dịch vụ

const PRICE_CHIPS = [
  { label: '3.6 tr', value: 3600000, category: 'Phòng tiêu chuẩn' },
  { label: '4.8 tr (Tiêu chuẩn)', value: 4800000, category: 'Phòng tiêu chuẩn' },
  { label: '6.0 tr', value: 6000000, category: 'Phòng tiêu chuẩn' },
  { label: '7.2 tr', value: 7200000, category: 'Phòng dịch vụ' },
  { label: '9.6 tr (Dịch vụ)', value: 9600000, category: 'Phòng dịch vụ' },
  { label: '12 tr', value: 12000000, category: 'Phòng dịch vụ' },
];

export default function AddRoomModal({
  isOpen,
  onClose,
  buildings = [],
  activeBuildingId = 'A1',
  initialFloor = 1,
  onRoomAdded,
}) {
  const getInitialFormData = (buildingId, floor) => ({
    ma_toa: buildingId || (buildings[0]?.ma_toa || 'A1'),
    so_tang: floor || 1,
    so_phong: '',
    suc_chua: 4,
    loai_phong: 'Phòng tiêu chuẩn',
    gia_tien_nam: 4800000,
    hinh_anh: '',
  });

  const [formData, setFormData] = useState(() => getInitialFormData(activeBuildingId, initialFloor));

  // State thêm tòa nhà mới: nhập tên tòa, chọn nam/nữ và số tầng
  const [isAddingNewBuilding, setIsAddingNewBuilding] = useState(false);
  const [newBuilding, setNewBuilding] = useState({
    ten_toa: '',
    gioi_tinh: 'Nam',
    so_tang: 5,
  });

  // State tải lên hình ảnh từ máy
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Hàm reset form về trạng thái ban đầu sạch sẽ
  const resetForm = () => {
    setFormData(getInitialFormData(activeBuildingId, initialFloor));
    setIsAddingNewBuilding(false);
    setNewBuilding({ ten_toa: '', gioi_tinh: 'Nam', so_tang: 5 });
    setImageFile(null);
    setImagePreview('');
    setUploadingImage(false);
    setUploadSuccess(false);
    setErrorMsg('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Tự động reset form mỗi khi mở modal
  React.useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, activeBuildingId, initialFloor]);

  if (!isOpen) return null;

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Xác định số tầng tối đa của tòa nhà hiện tại
  const currentSelectedBuilding = buildings.find((b) => b.ma_toa === formData.ma_toa);
  const maxFloors = isAddingNewBuilding
    ? (Number(newBuilding.so_tang) || 5)
    : (Number(currentSelectedBuilding?.so_tang) || 5);

  // Xử lý đổi tòa nhà: nếu số tầng đang chọn vượt quá số tầng của tòa mới chọn thì tự động điều chỉnh
  const handleBuildingChange = (newBuildingId) => {
    const b = buildings.find((item) => item.ma_toa === newBuildingId);
    const buildingMax = Number(b?.so_tang) || 5;
    setFormData((prev) => ({
      ...prev,
      ma_toa: newBuildingId,
      so_tang: Number(prev.so_tang) > buildingMax ? buildingMax : prev.so_tang,
    }));
  };

  // Xử lý đổi số tầng của tòa mới
  const handleNewBuildingFloorsChange = (val) => {
    const num = Math.max(1, Math.min(30, Number(val) || 1));
    setNewBuilding((prev) => ({ ...prev, so_tang: num }));
    setFormData((prev) => ({
      ...prev,
      so_tang: Number(prev.so_tang) > num ? num : prev.so_tang,
    }));
  };

  const isService = formData.loai_phong === 'Phòng dịch vụ';
  const currentPrice = Number(formData.gia_tien_nam) || 0;

  // Kiểm tra lỗi giá tương ứng loại phòng
  let priceValidationError = '';
  if (!isService && currentPrice > STANDARD_MAX_PRICE) {
    priceValidationError = `Phòng tiêu chuẩn không được nhập giá cao hơn phòng dịch vụ (tối đa ${STANDARD_MAX_PRICE.toLocaleString('vi-VN')} đ/năm).`;
  } else if (isService && currentPrice < SERVICE_MIN_PRICE && currentPrice > 0) {
    priceValidationError = `Phòng dịch vụ không được nhập giá thấp hơn phòng tiêu chuẩn (tối thiểu ${SERVICE_MIN_PRICE.toLocaleString('vi-VN')} đ/năm).`;
  }

  // Đổi loại phòng và gợi ý giá tương ứng
  const handleRoomTypeChange = (newType) => {
    setFormData((prev) => {
      let suggestedPrice = prev.gia_tien_nam;
      if (newType === 'Phòng dịch vụ') {
        if (!suggestedPrice || Number(suggestedPrice) < SERVICE_MIN_PRICE) {
          suggestedPrice = 9600000;
        }
      } else {
        if (!suggestedPrice || Number(suggestedPrice) > STANDARD_MAX_PRICE) {
          suggestedPrice = 4800000;
        }
      }
      return {
        ...prev,
        loai_phong: newType,
        gia_tien_nam: suggestedPrice,
      };
    });
  };

  // Xử lý chọn tệp hình ảnh từ máy tính
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Kiểm tra dung lượng (tối đa 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Dung lượng hình ảnh quá lớn. Vui lòng chọn tệp dưới 10MB.');
      return;
    }

    setErrorMsg('');
    setImageFile(file);
    const localUrl = URL.createObjectURL(file);
    setImagePreview(localUrl);
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

  // Xóa ảnh đã chọn
  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    setUploadSuccess(false);
    setFormData((prev) => ({ ...prev, hinh_anh: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Dùng ảnh mặc định của loại phòng
  const handleUseDefaultImage = () => {
    const defaultUrl =
      formData.loai_phong === 'Phòng dịch vụ'
        ? '/images/rooms/phong-dich-vu.jpg'
        : '/images/rooms/phong-tieu-chuan.jpg';
    setFormData((prev) => ({ ...prev, hinh_anh: defaultUrl }));
    setImagePreview(defaultUrl);
    setImageFile(null);
    setUploadSuccess(true);
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.so_phong.trim()) {
      setErrorMsg('Vui lòng nhập số phòng.');
      return;
    }

    // Kiểm tra số tầng hợp lệ không vượt quá số tầng của tòa nhà
    const chosenFloor = Number(formData.so_tang);
    if (!chosenFloor || chosenFloor < 1 || chosenFloor > maxFloors) {
      const bName = isAddingNewBuilding
        ? `Tòa ${newBuilding.ten_toa || ''}`
        : (currentSelectedBuilding?.ten_toa || formData.ma_toa);
      setErrorMsg(
        `${bName} chỉ có ${maxFloors} tầng. Vui lòng chọn số tầng từ 1 đến ${maxFloors}.`
      );
      return;
    }

    // Kiểm tra ràng buộc khoảng giá theo loại phòng
    if (!isService && Number(formData.gia_tien_nam) > STANDARD_MAX_PRICE) {
      setErrorMsg(
        `Phòng tiêu chuẩn không được nhập giá cao hơn phòng dịch vụ (tối đa ${STANDARD_MAX_PRICE.toLocaleString('vi-VN')} đ/năm).`
      );
      return;
    }
    if (isService && Number(formData.gia_tien_nam) < SERVICE_MIN_PRICE) {
      setErrorMsg(
        `Phòng dịch vụ không được nhập giá thấp hơn phòng tiêu chuẩn (tối thiểu ${SERVICE_MIN_PRICE.toLocaleString('vi-VN')} đ/năm).`
      );
      return;
    }

    let targetBuildingId = formData.ma_toa;

    // Nếu chọn thêm tòa mới
    if (isAddingNewBuilding) {
      const rawName = (newBuilding.ten_toa || '').trim();
      if (!rawName) {
        setErrorMsg('Vui lòng nhập tên tòa nhà mới (ví dụ: A7, B2).');
        return;
      }

      // Chuẩn hóa tên và mã tòa: người dùng nhập A7 -> sinh ma_toa A7 và ten_toa "Tòa A7"
      const cleanCode = rawName.replace(/^tòa\s+/i, '').replace(/^toa\s+/i, '').trim().toUpperCase();
      const cleanName = `Tòa ${cleanCode}`;

      setLoading(true);
      try {
        await dormService.createBuilding({
          ma_toa: cleanCode,
          ten_toa: cleanName,
          gioi_tinh: newBuilding.gioi_tinh || 'Nam',
          so_tang: Number(newBuilding.so_tang) || 5,
        });
        targetBuildingId = cleanCode;
      } catch (buildErr) {
        setLoading(false);
        const detail = buildErr.response?.data?.detail;
        setErrorMsg(
          typeof detail === 'string'
            ? detail
            : 'Không thể tạo tòa nhà mới. Vui lòng kiểm tra lại tên tòa.'
        );
        return;
      }
    }

    setLoading(true);
    try {
      // 1. Đảm bảo tầng tồn tại, nếu chưa có thì tự động tạo tầng
      const ma_tang = `${targetBuildingId}_T${formData.so_tang}`;
      try {
        await dormService.createFloor({
          ma_tang: ma_tang,
          so_tang: Number(formData.so_tang),
          ma_toa: targetBuildingId,
        });
      } catch (floorErr) {
        // Tầng đã tồn tại là bình thường, tiếp tục
      }

      // Xác định ảnh phòng cuối cùng: nếu chưa có thì lấy ảnh mặc định theo loại phòng
      const finalImage =
        formData.hinh_anh ||
        (formData.loai_phong === 'Phòng dịch vụ'
          ? '/images/rooms/phong-dich-vu.jpg'
          : '/images/rooms/phong-tieu-chuan.jpg');

      // 2. Tạo phòng mới và tự động sinh danh sách giường đúng bằng sức chứa
      await dormService.createRoom({
        so_phong: formData.so_phong.trim(),
        suc_chua: Number(formData.suc_chua),
        loai_phong: formData.loai_phong,
        gia_tien_nam: formData.gia_tien_nam ? Number(formData.gia_tien_nam) : 4800000,
        hinh_anh: finalImage,
        ma_tang: ma_tang,
      });

      // Tự động reset form sạch sẽ sau khi thêm phòng thành công
      resetForm();

      if (onRoomAdded) {
        await onRoomAdded(targetBuildingId);
      }
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
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
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
            onClick={handleClose}
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Tòa nhà: Chọn có sẵn hoặc Thêm mới */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {isAddingNewBuilding ? 'Thêm tòa nhà mới' : 'Tòa nhà'}
              </label>
              {!isAddingNewBuilding ? (
                <button
                  type="button"
                  onClick={() => setIsAddingNewBuilding(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm tòa mới</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingNewBuilding(false)}
                  className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Chọn tòa có sẵn</span>
                </button>
              )}
            </div>

            {!isAddingNewBuilding ? (
              <select
                value={formData.ma_toa}
                onChange={(e) => handleBuildingChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-sky-400 focus:bg-white font-medium"
              >
                {buildings.map((b) => (
                  <option key={b.ma_toa} value={b.ma_toa}>
                    {b.ten_toa.startsWith('Tòa ') ? b.ten_toa : `Tòa ${b.ten_toa}`} {b.gioi_tinh ? `(${b.gioi_tinh})` : ''} - {b.so_tang || 5} tầng
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3.5 bg-sky-50/70 border border-sky-200/80 rounded-2xl space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-sky-900 mb-1">
                      Tên tòa mới *
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">
                        Tòa
                      </div>
                      <input
                        type="text"
                        placeholder="A7, B2, C1..."
                        value={newBuilding.ten_toa}
                        onChange={(e) => {
                          const val = e.target.value.replace(/^tòa\s+/i, '').replace(/^toa\s+/i, '').toUpperCase();
                          setNewBuilding({ ...newBuilding, ten_toa: val });
                        }}
                        className="w-full pl-11 pr-3 py-2 bg-white border border-sky-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-sky-900 mb-1">
                      Dành cho (Nam / Nữ) *
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-sky-100/70 border border-sky-200 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setNewBuilding({ ...newBuilding, gioi_tinh: 'Nam' })}
                        className={`py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${newBuilding.gioi_tinh === 'Nam'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        <span></span>
                        <span>Tòa Nam</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewBuilding({ ...newBuilding, gioi_tinh: 'Nữ' })}
                        className={`py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 cursor-pointer ${newBuilding.gioi_tinh === 'Nữ'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        <span></span>
                        <span>Tòa Nữ</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Chọn số lượng tầng của tòa mới */}
                <div className="pt-2 border-t border-sky-200/60">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-sky-900">
                      Số tầng của tòa nhà này *
                    </label>
                    <span className="text-[10px] text-sky-700 font-bold">
                      Tối đa {newBuilding.so_tang || 5} tầng
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={newBuilding.so_tang}
                      onChange={(e) => handleNewBuildingFloorsChange(e.target.value)}
                      className="w-20 px-3 py-1.5 bg-white border border-sky-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 text-center"
                      required
                    />
                    <div className="flex items-center gap-1 flex-1 flex-wrap">
                      {[3, 4, 5, 6, 7, 8].map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => handleNewBuildingFloorsChange(f)}
                          className={`text-[11px] px-2 py-1 rounded-lg border font-semibold transition cursor-pointer ${
                            Number(newBuilding.so_tang) === f
                              ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                              : 'bg-white hover:bg-slate-50 text-slate-600 border-sky-200'
                          }`}
                        >
                          {f} tầng
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Tầng
                </label>
                <span className="text-[10px] font-medium text-slate-400">
                  Tối đa: <strong className="text-blue-600">{maxFloors} tầng</strong>
                </span>
              </div>
              <input
                type="number"
                min="1"
                max={maxFloors}
                value={formData.so_tang}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : '';
                  setFormData({ ...formData, so_tang: val });
                }}
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:bg-white transition ${
                  Number(formData.so_tang) > maxFloors
                    ? 'border-red-400 focus:border-red-500 bg-red-50/30 ring-1 ring-red-300'
                    : 'border-slate-200 focus:border-sky-400'
                }`}
                required
              />
              {Number(formData.so_tang) > maxFloors && (
                <p className="text-[10px] text-rose-600 font-medium mt-1">
                  Không được vượt quá {maxFloors} tầng của tòa này.
                </p>
              )}
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
                onChange={(e) => handleRoomTypeChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-sky-400 focus:bg-white font-medium"
              >
                <option value="Phòng tiêu chuẩn">Phòng tiêu chuẩn</option>
                <option value="Phòng dịch vụ">Phòng dịch vụ</option>
              </select>
            </div>
          </div>

          {/* Mục Giá tiền / năm */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <span>Giá tiền / năm (VNĐ)</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {isService ? '(Tối thiểu 7.000.000 đ)' : '(Tối đa 6.000.000 đ)'}
                </span>
              </label>
              {currentPrice > 0 && (
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-md">
                  ~{Math.round(currentPrice / 12).toLocaleString('vi-VN')} đ/tháng
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="number"
                min={isService ? SERVICE_MIN_PRICE : 1000000}
                max={!isService ? STANDARD_MAX_PRICE : 30000000}
                step="100000"
                placeholder={isService ? 'VD: 9600000' : 'VD: 4800000'}
                value={formData.gia_tien_nam}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    gia_tien_nam: e.target.value ? Number(e.target.value) : '',
                  })
                }
                className={`w-full pl-3.5 pr-20 py-2.5 bg-slate-50 border rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:bg-white transition ${priceValidationError
                    ? 'border-red-400 focus:border-red-500 bg-red-50/30 ring-1 ring-red-300'
                    : 'border-slate-200 focus:border-sky-400'
                  }`}
                required
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                VNĐ/năm
              </div>
            </div>

            {/* Cảnh báo lỗi giá trực tiếp nếu nhập sai quy định */}
            {priceValidationError && (
              <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-1.5 font-medium animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{priceValidationError}</span>
              </div>
            )}

            {/* Khung gợi ý nhanh theo quy định loại phòng */}
            <div className="mt-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-slate-500 font-semibold">Gợi ý mức giá chuẩn:</span>
                <span className="text-[10px] text-slate-400 italic">
                  {isService
                    ? '✨ Phòng dịch vụ: từ 7.000.000 đ trở lên'
                    : '💡 Phòng tiêu chuẩn: tối đa 6.000.000 đ'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {PRICE_CHIPS.map((chip) => {
                  const isMatchingType = chip.category === formData.loai_phong;
                  const isSelected = Number(formData.gia_tien_nam) === chip.value;

                  if (!isMatchingType) {
                    // Mức giá không thuộc loại phòng hiện tại: bị khóa, không được chọn
                    return (
                      <span
                        key={chip.value}
                        title={`Không được chọn mức này cho ${formData.loai_phong}`}
                        className="text-[11px] px-2 py-0.5 rounded-lg border border-slate-200/70 bg-slate-100/80 text-slate-400 opacity-40 cursor-not-allowed select-none line-through"
                      >
                        {chip.label}
                      </span>
                    );
                  }

                  return (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, gia_tien_nam: chip.value })}
                      className={`text-[11px] px-2.5 py-0.5 rounded-lg border transition font-medium cursor-pointer ${isSelected
                          ? 'bg-blue-600 border-blue-600 text-white font-semibold shadow-2xs'
                          : 'bg-white hover:bg-blue-50 text-slate-700 border-slate-300'
                        }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tải lên hình ảnh từ máy tính */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-blue-600" />
                <span>Hình ảnh phòng (Tải từ máy tính)</span>
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

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
              onChange={handleFileChange}
              className="hidden"
            />

            {!imagePreview ? (
              /* Dropzone Chưa có ảnh */
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/40 rounded-2xl p-4 text-center cursor-pointer transition-all duration-150"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-2 transition">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-600">
                  Nhấp để tải ảnh lên từ máy tính
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Hỗ trợ định dạng: JPG, PNG, WEBP (Tối đa 10MB)
                </div>
              </div>
            ) : (
              /* Card Đã có ảnh preview */
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-16 h-12 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {imageFile ? imageFile.name : 'Ảnh phòng đã chọn'}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      {uploadingImage ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                          <span className="text-blue-600 font-medium">Đang tải ảnh lên...</span>
                        </>
                      ) : uploadSuccess ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700 font-medium">Đã tải lên máy chủ</span>
                        </>
                      ) : (
                        <span>
                          {imageFile ? `${(imageFile.size / 1024).toFixed(0)} KB` : 'Đã chọn'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition shrink-0 cursor-pointer"
                >
                  Đổi ảnh
                </button>
              </div>
            )}

            {/* Gợi ý nếu không có ảnh sẵn */}
            {!imagePreview && (
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={handleUseDefaultImage}
                  className="text-[11px] text-slate-500 hover:text-blue-600 underline cursor-pointer"
                >
                  Hoặc sử dụng ảnh mẫu có sẵn của KTX
                </button>
              </div>
            )}
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || uploadingImage}
              className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-full transition shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Đang xử lý...</span>
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
