import React, { useState } from 'react';
import { Building2, X, Plus, RefreshCw, AlertCircle, Layers, Users } from 'lucide-react';
import { dormService } from '../../services/api';

export default function AddBuildingModal({ isOpen, onClose, onBuildingCreated }) {
  const [buildingName, setBuildingName] = useState('');
  const [gender, setGender] = useState('Nam');
  const [totalFloors, setTotalFloors] = useState(5);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const resetForm = () => {
    setBuildingName('');
    setGender('Nam');
    setTotalFloors(5);
    setErrorMsg('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const raw = buildingName.trim();
    if (!raw) {
      setErrorMsg('Vui lòng nhập tên tòa nhà (ví dụ: A7, B3, C1).');
      return;
    }

    const floors = parseInt(totalFloors, 10);
    if (!floors || floors <= 0 || floors > 50) {
      setErrorMsg('Số tầng phải là số nguyên từ 1 đến 50.');
      return;
    }

    // Chuẩn hóa tên và mã tòa
    const cleanCode = raw.replace(/^tòa\s+/i, '').replace(/^toa\s+/i, '').trim().toUpperCase();
    const cleanName = `Tòa ${cleanCode}`;

    setLoading(true);
    setErrorMsg('');

    try {
      const created = await dormService.createBuilding({
        ma_toa: cleanCode,
        ten_toa: cleanName,
        gioi_tinh: gender,
        so_tang: floors,
      });

      resetForm();
      if (onBuildingCreated) {
        onBuildingCreated(created);
      }
      onClose();
    } catch (err) {
      console.error('Error creating building:', err);
      const detail = err?.response?.data?.detail;
      setErrorMsg(
        typeof detail === 'string'
          ? detail
          : 'Không thể thêm tòa nhà mới. Vui lòng kiểm tra lại thông tin.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Thêm tòa nhà mới
              </h3>
              <p className="text-xs text-slate-500">
                Khởi tạo tòa nhà ký túc xá và tự động sinh các tầng
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Tên tòa nhà <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">
                Tòa
              </span>
              <input
                type="text"
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
                placeholder="A7, B3, C1..."
                className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-semibold text-slate-800 placeholder:text-slate-400"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Hệ thống sẽ tự chuẩn hóa thành tên đầy đủ (ví dụ: Tòa A7) và mã tòa (A7).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Dành cho
              </label>
              <div className="relative">
                <Users className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-semibold text-slate-800 bg-white cursor-pointer"
                >
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Nam & Nữ">Nam & Nữ</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Số tầng quy mô
              </label>
              <div className="relative">
                <Layers className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={totalFloors}
                  onChange={(e) => setTotalFloors(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-semibold text-slate-800"
                />
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-slate-600 text-xs flex items-start gap-2">
            <Layers className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              Sau khi tạo tòa nhà, hệ thống sẽ tự động khởi tạo danh sách <b>{totalFloors || 5} tầng</b>.
              Bạn có thể bắt đầu tạo thêm phòng trực tiếp theo từng tầng ngay trong giao diện chi tiết tòa.
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang tạo...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Thêm tòa</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
