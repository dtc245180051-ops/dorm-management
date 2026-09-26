import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import studentService from '../../services/studentService';
import { VIETNAM_PROVINCES } from '../../data/vietnamAddressData';

// Helper chuyển chuỗi ngày dd/mm/yyyy thành yyyy-mm-dd cho input date
const toDateInputValue = (str) => {
  if (!str) return '';
  if (str.includes('-')) return str;
  const parts = str.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return '';
};

export default function EditStudentModal({ isOpen, onClose, student, onStudentUpdated }) {
  const [selectedProvince, setSelectedProvince] = useState('Thái Nguyên');
  const [selectedDistrict, setSelectedDistrict] = useState('Thành phố Thái Nguyên');
  const [detailStreet, setDetailStreet] = useState('');

  const [formData, setFormData] = useState({
    ho_ten: '',
    so_dien_thoai: '',
    email: '',
    lop: '',
    gioi_tinh: 'Nam',
    khoa: '',
    que_quan: '',
    ngay_sinh: '',
    cccd: '',
    dia_chi: '',
    doi_tuong_uu_tien: '',
    nguoi_giam_ho: '',
    moi_quan_he: '',
    sdt_nguoi_giam_ho: '',
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Tỉnh / Quận tương ứng
  const provinceObj = useMemo(() => {
    return (
      VIETNAM_PROVINCES.find((p) => p.name === selectedProvince) ||
      VIETNAM_PROVINCES[0]
    );
  }, [selectedProvince]);

  const availableDistricts = useMemo(() => {
    return provinceObj.districts || [];
  }, [provinceObj]);

  useEffect(() => {
    if (student) {
      setFormData({
        ho_ten: student.ho_ten || '',
        so_dien_thoai: student.so_dien_thoai || '',
        email: student.email || '',
        lop: student.lop || '',
        gioi_tinh: student.gioi_tinh || 'Nam',
        khoa: student.khoa || '',
        que_quan: student.que_quan || '',
        ngay_sinh: toDateInputValue(student.ngay_sinh),
        cccd: student.cccd || '',
        dia_chi: student.dia_chi || '',
        doi_tuong_uu_tien: student.doi_tuong_uu_tien || '',
        nguoi_giam_ho: student.nguoi_giam_ho || '',
        moi_quan_he: student.moi_quan_he || '',
        sdt_nguoi_giam_ho: student.sdt_nguoi_giam_ho || '',
      });

      // Tách địa chỉ sẵn có để chọn vào dropdown
      if (student.dia_chi) {
        const parts = student.dia_chi.split(',').map((s) => s.trim());
        if (parts.length >= 2) {
          const prov = parts[parts.length - 1];
          const dist = parts[parts.length - 2];
          const foundProv = VIETNAM_PROVINCES.find((p) => p.name.toLowerCase() === prov.toLowerCase());
          if (foundProv) {
            setSelectedProvince(foundProv.name);
            const foundDist = foundProv.districts.find((d) => d.toLowerCase() === dist.toLowerCase());
            if (foundDist) {
              setSelectedDistrict(foundDist);
            }
            if (parts.length >= 3) {
              setDetailStreet(parts.slice(0, parts.length - 2).join(', '));
            }
          }
        }
      }
      setErrorMsg('');
    }
  }, [student, isOpen]);

  // Cập nhật quận/huyện mặc định khi đổi tỉnh
  useEffect(() => {
    if (availableDistricts.length > 0 && !availableDistricts.includes(selectedDistrict)) {
      setSelectedDistrict(availableDistricts[0]);
    }
  }, [availableDistricts]);

  // Cập nhật lại chuỗi địa chỉ
  useEffect(() => {
    if (!isOpen) return;
    const parts = [];
    if (detailStreet.trim()) parts.push(detailStreet.trim());
    if (selectedDistrict) parts.push(selectedDistrict);
    if (selectedProvince) parts.push(selectedProvince);
    const fullAddress = parts.join(', ');
    setFormData((prev) => ({
      ...prev,
      dia_chi: fullAddress,
      que_quan: selectedProvince,
    }));
  }, [selectedProvince, selectedDistrict, detailStreet, isOpen]);

  if (!isOpen || !student) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ho_ten.trim()) {
      setErrorMsg('Vui lòng nhập họ và tên sinh viên.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');
      const updated = await studentService.updateStudent(student.msv, formData);
      if (onStudentUpdated) {
        onStudentUpdated(updated);
      }
      onClose();
    } catch (err) {
      console.error('Error updating student:', err);
      const detail = err.response?.data?.detail;
      setErrorMsg(typeof detail === 'string' ? detail : 'Không thể cập nhật thông tin sinh viên.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Chỉnh sửa thông tin sinh viên
            </h3>
            <p className="text-xs text-slate-500">
              MSV: <span className="font-semibold text-blue-600">{student.msv}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section: Thông tin sinh viên */}
          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wide">
              Thông tin cá nhân
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="ho_ten"
                  value={formData.ho_ten}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-[5px] focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Giới tính
                </label>
                <select
                  name="gioi_tinh"
                  value={formData.gioi_tinh}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-[5px] focus:outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer"
                >
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  name="so_dien_thoai"
                  value={formData.so_dien_thoai}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-[5px] focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-[5px] focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Lớp chuyên ngành
                </label>
                <input
                  type="text"
                  name="lop"
                  value={formData.lop}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-[5px] focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Khoa / Viện
                </label>
                <input
                  type="text"
                  name="khoa"
                  value={formData.khoa}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-[5px] focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              {/* Yêu cầu 2: Cho phép chọn ngày sinh trong lịch */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Ngày sinh
                </label>
                <input
                  type="date"
                  name="ngay_sinh"
                  value={formData.ngay_sinh}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-[5px] focus:outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Số CCCD / Định danh
                </label>
                <input
                  type="text"
                  name="cccd"
                  value={formData.cccd}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-[5px] focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Đối tượng ưu tiên
                </label>
                <select
                  name="doi_tuong_uu_tien"
                  value={formData.doi_tuong_uu_tien}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-[5px] focus:outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer text-slate-700"
                >
                  <option value="">-- Chọn đối tượng ưu tiên --</option>
                  <option value="Không thuộc diện ưu tiên">Không thuộc diện ưu tiên</option>
                  <option value="Con liệt sĩ / Con thương binh, bệnh binh">Con liệt sĩ / Con thương binh, bệnh binh</option>
                  <option value="Sinh viên khuyết tật">Sinh viên khuyết tật</option>
                  <option value="Hộ nghèo / Hộ cận nghèo">Hộ nghèo / Hộ cận nghèo</option>
                  <option value="Dân tộc thiểu số vùng sâu vùng xa">Dân tộc thiểu số vùng sâu vùng xa</option>
                  <option value="Mồ côi cả cha lẫn mẹ">Mồ côi cả cha lẫn mẹ</option>
                  <option value="Hoàn cảnh khó khăn đột xuất">Hoàn cảnh khó khăn đột xuất</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>

              {/* Yêu cầu 3: Địa chỉ cho chọn thay vì gõ tay */}
              <div className="md:col-span-2 space-y-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Địa chỉ thường trú (Chọn Tỉnh / Huyện)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <select
                      value={selectedProvince}
                      onChange={(e) => setSelectedProvince(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-[5px] focus:outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer"
                    >
                      {VIETNAM_PROVINCES.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <select
                      value={selectedDistrict}
                      onChange={(e) => setSelectedDistrict(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-[5px] focus:outline-none focus:border-blue-500 focus:bg-white transition cursor-pointer"
                    >
                      {availableDistricts.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <input
                  type="text"
                  value={detailStreet}
                  onChange={(e) => setDetailStreet(e.target.value)}
                  placeholder="Số nhà, tên đường, xã/phường..."
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-[5px] focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          {/* Section: Thông tin người giám hộ */}
          <div>
            <h4 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wide">
              Liên hệ khẩn cấp
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Họ tên người giám hộ
                </label>
                <input
                  type="text"
                  name="nguoi_giam_ho"
                  value={formData.nguoi_giam_ho}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-[5px] focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Mối quan hệ
                </label>
                <input
                  type="text"
                  name="moi_quan_he"
                  value={formData.moi_quan_he}
                  onChange={handleChange}
                  placeholder="Bố, Mẹ, v.v."
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-[5px] focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  SĐT người giám hộ
                </label>
                <input
                  type="text"
                  name="sdt_nguoi_giam_ho"
                  value={formData.sdt_nguoi_giam_ho}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-[5px] focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-[5px] transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[5px] text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
