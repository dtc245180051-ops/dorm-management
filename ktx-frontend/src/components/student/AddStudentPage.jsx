import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  RotateCcw,
  Save,
  AlertCircle,
  MapPin,
  Calendar,
} from 'lucide-react';
import studentService from '../../services/studentService';
import { dormService } from '../../services/api';
import { VIETNAM_PROVINCES } from '../../data/vietnamAddressData';

export default function AddStudentPage({ onBack, onStudentAdded }) {
  // Address selection states
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [detailStreet, setDetailStreet] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    // Thông tin sinh viên
    msv: '',
    ho_ten: '',
    gioi_tinh: 'Nam',
    ngay_sinh: '',
    cccd: '',
    so_dien_thoai: '',
    email: '',
    khoa: '',
    lop: '',
    dia_chi: '',
    doi_tuong_uu_tien: '',

    // Thông tin liên hệ khẩn cấp
    nguoi_giam_ho: '',
    moi_quan_he: '',
    sdt_nguoi_giam_ho: '',

    // Chỉ định vị trí lưu trú
    ma_toa: '',
    so_tang: '',
    ma_phong: '',
    ma_giuong: '',

    // Thiết lập hợp đồng lưu trú & nghĩa vụ tài chính
    ma_hop_dong: '',
    thoi_han_luu_tru: '',
    ngay_bat_dau: '',
    ngay_ket_thuc: '',
    don_gia_dinh_ky: '',
    tong_tien_thue: '',
  });

  const [buildings, setBuildings] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Danh sách quận/huyện tương ứng với Tỉnh/Thành đang chọn
  const provinceObj = useMemo(() => {
    if (!selectedProvince) return null;
    return VIETNAM_PROVINCES.find((p) => p.name === selectedProvince) || null;
  }, [selectedProvince]);

  const availableDistricts = useMemo(() => {
    return provinceObj?.districts || [];
  }, [provinceObj]);

  // Cập nhật lại quận/huyện khi đổi tỉnh/thành
  useEffect(() => {
    if (!selectedProvince) {
      setSelectedDistrict('');
    } else if (availableDistricts.length > 0 && !availableDistricts.includes(selectedDistrict)) {
      setSelectedDistrict('');
    }
  }, [selectedProvince, availableDistricts]);

  // Tự động ghép chuỗi địa chỉ đầy đủ khi chọn Tỉnh, Huyện hoặc nhập số nhà
  useEffect(() => {
    const parts = [];
    if (detailStreet.trim()) parts.push(detailStreet.trim());
    if (selectedDistrict) parts.push(selectedDistrict);
    if (selectedProvince) parts.push(selectedProvince);
    const fullAddress = parts.join(', ');
    setFormData((prev) => ({
      ...prev,
      dia_chi: fullAddress,
    }));
  }, [selectedProvince, selectedDistrict, detailStreet]);

  // Lấy danh sách tòa nhà và phòng từ API (không tự động chọn trước)
  useEffect(() => {
    const fetchBuildings = async () => {
      try {
        const data = await dormService.getBuildings();
        if (Array.isArray(data) && data.length > 0) {
          setBuildings(data);
        }
      } catch (err) {
        console.error('Error fetching buildings:', err);
      }
    };
    fetchBuildings();
  }, []);

  // Danh sách tầng của tòa nhà đang chọn
  const availableFloors = useMemo(() => {
    if (!formData.ma_toa) return [];
    const bld = buildings.find((b) => b.ma_toa === formData.ma_toa);
    if (!bld || !bld.tangs) return [];
    return bld.tangs.map((t) => t.so_tang).sort((a, b) => a - b);
  }, [buildings, formData.ma_toa]);

  // Danh sách các phòng trống của tòa và tầng đang chọn
  const availableRooms = useMemo(() => {
    if (!formData.ma_toa) return [];
    const bld = buildings.find((b) => b.ma_toa === formData.ma_toa);
    if (!bld || !bld.tangs) return [];

    let targetRooms = [];
    if (formData.so_tang) {
      const floor = bld.tangs.find((t) => Number(t.so_tang) === Number(formData.so_tang));
      if (floor && floor.phongs) {
        targetRooms = floor.phongs;
      }
    } else {
      bld.tangs.forEach((t) => {
        if (t.phongs) targetRooms.push(...t.phongs);
      });
    }

    return targetRooms.filter((p) => {
      const freeBeds = p.giuongs?.filter((g) => g.trang_thai === 'TRONG') || [];
      return freeBeds.length > 0;
    });
  }, [buildings, formData.ma_toa, formData.so_tang]);

  // Danh sách giường trống của phòng đang chọn
  const availableBeds = useMemo(() => {
    if (!formData.ma_phong || !formData.ma_toa) return [];
    const bld = buildings.find((b) => b.ma_toa === formData.ma_toa);
    if (!bld || !bld.tangs) return [];

    for (const t of bld.tangs) {
      if (t.phongs) {
        const found = t.phongs.find((p) => p.ma_phong === formData.ma_phong);
        if (found && found.giuongs) {
          return found.giuongs.filter((g) => g.trang_thai === 'TRONG');
        }
      }
    }
    return [];
  }, [buildings, formData.ma_toa, formData.ma_phong]);

  // 1. TỰ ĐỘNG TÍNH THỜI HẠN LƯU TRÚ DỰA VÀO NGÀY BẮT ĐẦU VÀ KẾT THÚC
  const calculatedDurationMonths = useMemo(() => {
    if (!formData.ngay_bat_dau || !formData.ngay_ket_thuc) return null;
    const start = new Date(formData.ngay_bat_dau);
    const end = new Date(formData.ngay_ket_thuc);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;

    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (end.getDate() - start.getDate() >= 20) {
      months += 1;
    } else if (end.getDate() - start.getDate() < -10) {
      months = Math.max(1, months - 1);
    }
    return Math.max(1, months);
  }, [formData.ngay_bat_dau, formData.ngay_ket_thuc]);

  // Cập nhật chuỗi thời hạn lưu trú hiển thị
  useEffect(() => {
    if (calculatedDurationMonths === null) {
      setFormData((prev) => ({
        ...prev,
        thoi_han_luu_tru: '',
      }));
      return;
    }

    const durationText =
      calculatedDurationMonths === 12
        ? '1 năm (12 tháng)'
        : `${calculatedDurationMonths} tháng`;

    setFormData((prev) => ({
      ...prev,
      thoi_han_luu_tru: durationText,
    }));
  }, [calculatedDurationMonths]);

  // 2. TỰ ĐỘNG CẬP NHẬT ĐƠN GIÁ ĐỊNH KỲ THEO VỊ TRÍ PHÒNG LƯU TRÚ ĐÃ CHỌN
  useEffect(() => {
    if (!formData.ma_phong) {
      setFormData((prev) => ({
        ...prev,
        don_gia_dinh_ky: '',
        tong_tien_thue: '',
      }));
      return;
    }

    // Tìm thông tin phòng đang chọn
    const roomObj = availableRooms.find((r) => r.ma_phong === formData.ma_phong);
    let unitPrice = 800000;

    if (roomObj) {
      if (roomObj.gia_tien_nam) {
        unitPrice = Math.round(Number(roomObj.gia_tien_nam) / 12);
      } else {
        const isService =
          (roomObj.loai_phong || '').toLowerCase().includes('dịch vụ') ||
          (roomObj.loai_phong || '').toLowerCase().includes('dich vu');
        unitPrice = isService ? 800000 : 400000;
      }
    }

    const total = calculatedDurationMonths ? unitPrice * calculatedDurationMonths : '';

    setFormData((prev) => ({
      ...prev,
      don_gia_dinh_ky: String(unitPrice),
      tong_tien_thue: total ? String(total) : '',
    }));
  }, [formData.ma_phong, calculatedDurationMonths, availableRooms]);

  // 3. TỰ ĐỘNG SINH MÃ HỢP ĐỒNG CHUẨN KHI ĐÃ CHỌN PHÒNG & GIƯỜNG: HD{YY}-{toa}{phong}-G{giuong}
  useEffect(() => {
    if (!formData.ma_phong || !formData.ma_giuong) {
      setFormData((prev) => ({
        ...prev,
        ma_hop_dong: '',
      }));
      return;
    }

    const cleanToa = formData.ma_toa || 'A1';
    let roomNum = '101';
    if (formData.ma_phong) {
      const parts = formData.ma_phong.split('_P');
      if (parts.length > 1) roomNum = parts[1];
      else roomNum = formData.ma_phong;
    }

    let bedNum = '1';
    if (formData.ma_giuong) {
      const parts = formData.ma_giuong.split('_G');
      if (parts.length > 1) {
        try {
          bedNum = String(parseInt(parts[1], 10));
        } catch {
          bedNum = parts[1];
        }
      }
    }

    const yearYY = formData.ngay_bat_dau
      ? formData.ngay_bat_dau.slice(2, 4)
      : '26';

    const generatedCode = `HD${yearYY}-${cleanToa}${roomNum}-G${bedNum}`;
    setFormData((prev) => ({
      ...prev,
      ma_hop_dong: generatedCode,
    }));
  }, [formData.ma_toa, formData.ma_phong, formData.ma_giuong, formData.ngay_bat_dau]);

  // Xử lý thay đổi input thông thường
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      if (name === 'ma_toa') {
        updated.so_tang = '';
        updated.ma_phong = '';
        updated.ma_giuong = '';
      } else if (name === 'so_tang') {
        updated.ma_phong = '';
        updated.ma_giuong = '';
      } else if (name === 'ma_phong') {
        updated.ma_giuong = '';
      }

      // Tự động gợi ý email theo MSV nếu chưa nhập
      if (name === 'msv' && (!prev.email || prev.email.includes('@ictu.edu.vn'))) {
        updated.email = value.trim() ? `${value.trim().toLowerCase()}@ictu.edu.vn` : '';
      }

      return updated;
    });
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.msv.trim()) {
      setErrorMsg('Vui lòng nhập Mã sinh viên.');
      return;
    }
    if (!formData.ho_ten.trim()) {
      setErrorMsg('Vui lòng nhập Họ và tên sinh viên.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      const payload = {
        msv: formData.msv.trim().toUpperCase(),
        ho_ten: formData.ho_ten.trim(),
        gioi_tinh: formData.gioi_tinh,
        ngay_sinh: formData.ngay_sinh || null,
        cccd: formData.cccd || null,
        so_dien_thoai: formData.so_dien_thoai || null,
        email: formData.email || `${formData.msv.trim().toLowerCase()}@ictu.edu.vn`,
        khoa: formData.khoa || null,
        lop: formData.lop || 'CNTTK24M',
        dia_chi: formData.dia_chi || null,
        doi_tuong_uu_tien: formData.doi_tuong_uu_tien || null,
        que_quan: selectedProvince || null,

        nguoi_giam_ho: formData.nguoi_giam_ho || null,
        moi_quan_he: formData.moi_quan_he || null,
        sdt_nguoi_giam_ho: formData.sdt_nguoi_giam_ho || null,

        // Phòng & Hợp đồng (chỉ gửi nếu có chọn giường)
        ma_toa: formData.ma_toa || null,
        so_tang: formData.so_tang ? Number(formData.so_tang) : null,
        ma_phong: formData.ma_phong || null,
        ma_giuong: formData.ma_giuong || null,
        ma_hop_dong: formData.ma_giuong ? formData.ma_hop_dong : null,
        thoi_han_luu_tru: formData.thoi_han_luu_tru || null,
        ngay_bat_dau: formData.ngay_bat_dau || null,
        ngay_ket_thuc: formData.ngay_ket_thuc || null,
        don_gia_dinh_ky: formData.don_gia_dinh_ky ? parseFloat(formData.don_gia_dinh_ky) : null,
        tong_tien_thue: formData.tong_tien_thue ? parseFloat(formData.tong_tien_thue) : null,
      };

      const result = await studentService.createStudent(payload);
      if (onStudentAdded) {
        onStudentAdded(result);
      }
      onBack();
    } catch (err) {
      console.error('Error creating student:', err);
      const detail = err.response?.data?.detail;
      setErrorMsg(
        typeof detail === 'string'
          ? detail
          : 'Không thể thêm hồ sơ sinh viên. Vui lòng kiểm tra lại thông tin.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 bg-[#f4f5f7] rounded-2xl border border-slate-200/60 p-7 min-h-0 relative overflow-y-auto flex flex-col animate-in fade-in duration-150">
      {/* Top Header: Back button */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-800 hover:text-blue-600 transition cursor-pointer group"
        >
          <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
          <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
            Thêm sinh viên
          </h1>
        </button>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-3.5 mb-6 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6 w-full pb-12">
        {/* Section 1: Thông tin sinh viên */}
        <div>
          <h2 className="text-base font-bold text-slate-900 mb-2.5">
            Thông tin sinh viên
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
            {/* Cột trái */}
            <div className="space-y-2.5">
              <div>
                <input
                  type="text"
                  name="msv"
                  value={formData.msv}
                  onChange={handleChange}
                  placeholder="Mã sinh viên"
                  required
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] placeholder-slate-400 focus:outline-none focus:border-blue-500 transition shadow-2xs"
                />
              </div>

              <div>
                <input
                  type="text"
                  name="ho_ten"
                  value={formData.ho_ten}
                  onChange={handleChange}
                  placeholder="Họ và tên"
                  required
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] placeholder-slate-400 focus:outline-none focus:border-blue-500 transition shadow-2xs"
                />
              </div>

              <div>
                <select
                  name="gioi_tinh"
                  value={formData.gioi_tinh}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] text-slate-700 focus:outline-none focus:border-blue-500 transition shadow-2xs cursor-pointer"
                >
                  <option value="Nam">Giới tính: Nam</option>
                  <option value="Nữ">Giới tính: Nữ</option>
                </select>
              </div>

              {/* Yêu cầu: Cho phép chọn ngày sinh trong lịch */}
              <div>
                <div className="relative">
                  <input
                    type="date"
                    name="ngay_sinh"
                    value={formData.ngay_sinh}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] text-slate-700 focus:outline-none focus:border-blue-500 transition shadow-2xs cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <input
                  type="text"
                  name="cccd"
                  value={formData.cccd}
                  onChange={handleChange}
                  placeholder="Số CCCD/Định danh"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] placeholder-slate-400 focus:outline-none focus:border-blue-500 transition shadow-2xs"
                />
              </div>
            </div>

            {/* Cột phải */}
            <div className="space-y-2.5">
              <div>
                <input
                  type="text"
                  name="so_dien_thoai"
                  value={formData.so_dien_thoai}
                  onChange={handleChange}
                  placeholder="Số điện thoại"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] placeholder-slate-400 focus:outline-none focus:border-blue-500 transition shadow-2xs"
                />
              </div>

              <div>
                <input
                  type="text"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email (@ictu.edu.vn)"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] placeholder-slate-400 focus:outline-none focus:border-blue-500 transition shadow-2xs"
                />
              </div>

              <div>
                <input
                  type="text"
                  name="khoa"
                  value={formData.khoa}
                  onChange={handleChange}
                  placeholder="Khoa / Viện"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] placeholder-slate-400 focus:outline-none focus:border-blue-500 transition shadow-2xs"
                />
              </div>

              <div>
                <input
                  type="text"
                  name="lop"
                  value={formData.lop}
                  onChange={handleChange}
                  placeholder="Lớp chuyên ngành"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] placeholder-slate-400 focus:outline-none focus:border-blue-500 transition shadow-2xs"
                />
              </div>

              <div>
                <select
                  name="doi_tuong_uu_tien"
                  value={formData.doi_tuong_uu_tien}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] text-slate-700 focus:outline-none focus:border-blue-500 transition shadow-2xs cursor-pointer"
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
            </div>
          </div>

          {/* Yêu cầu 2: Dòng riêng cho Địa chỉ thường trú sắp xếp đều cho 3 ô địa chỉ */}
          <div className="mt-2.5">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Địa chỉ thường trú
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2.5">
              <div>
                <select
                  value={selectedProvince}
                  onChange={(e) => setSelectedProvince(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] text-slate-700 focus:outline-none focus:border-blue-500 transition shadow-2xs cursor-pointer"
                  title="Chọn Tỉnh / Thành phố"
                >
                  <option value="">-- Chọn Tỉnh / Thành phố --</option>
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
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] text-slate-700 focus:outline-none focus:border-blue-500 transition shadow-2xs cursor-pointer"
                  title="Chọn Quận / Huyện"
                  disabled={!selectedProvince}
                >
                  <option value="">-- Chọn Quận / Huyện --</option>
                  {availableDistricts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  type="text"
                  value={detailStreet}
                  onChange={(e) => setDetailStreet(e.target.value)}
                  placeholder="Số nhà, tên đường, xã/phường..."
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] placeholder-slate-400 focus:outline-none focus:border-blue-500 transition shadow-2xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Thông tin liên hệ khẩn cấp */}
        <div>
          <h2 className="text-base font-bold text-slate-900 mb-2.5">
            Thông tin liên hệ khẩn cấp
          </h2>
          <div className="space-y-2.5">
            <div>
              <input
                type="text"
                name="nguoi_giam_ho"
                value={formData.nguoi_giam_ho}
                onChange={handleChange}
                placeholder="Họ và tên người giám hộ"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] placeholder-slate-400 focus:outline-none focus:border-blue-500 transition shadow-2xs"
              />
            </div>

            <div>
              <input
                type="text"
                name="moi_quan_he"
                value={formData.moi_quan_he}
                onChange={handleChange}
                placeholder="Mối quan hệ"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] placeholder-slate-400 focus:outline-none focus:border-blue-500 transition shadow-2xs"
              />
            </div>

            <div>
              <input
                type="text"
                name="sdt_nguoi_giam_ho"
                value={formData.sdt_nguoi_giam_ho}
                onChange={handleChange}
                placeholder="Số điện thoại liên hệ"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] placeholder-slate-400 focus:outline-none focus:border-blue-500 transition shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Chỉ định vị trí lưu trú */}
        <div>
          <h2 className="text-base font-bold text-slate-900 mb-2.5">
            Chỉ định vị trí lưu trú
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
            {/* Chọn tòa */}
            <div>
              <select
                name="ma_toa"
                value={formData.ma_toa}
                onChange={handleChange}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] text-slate-700 focus:outline-none focus:border-blue-500 transition shadow-2xs cursor-pointer"
              >
                <option value="">-- Chọn tòa --</option>
                {buildings.map((b) => (
                  <option key={b.ma_toa} value={b.ma_toa}>
                    {b.ten_toa || `Tòa ${b.ma_toa}`} ({b.gioi_tinh || 'Nam/Nữ'})
                  </option>
                ))}
              </select>
            </div>

            {/* Chọn phòng trống */}
            <div>
              <select
                name="ma_phong"
                value={formData.ma_phong}
                onChange={handleChange}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] text-slate-700 focus:outline-none focus:border-blue-500 transition shadow-2xs cursor-pointer"
              >
                <option value="">-- Chọn phòng trống --</option>
                {availableRooms.map((p) => {
                  const freeCount = p.giuongs?.filter((g) => g.trang_thai === 'TRONG').length || 0;
                  return (
                    <option key={p.ma_phong} value={p.ma_phong}>
                      Phòng {p.so_phong} ({p.loai_phong || 'Tiêu chuẩn'} - Còn {freeCount} giường trống)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Chọn tầng */}
            <div>
              <select
                name="so_tang"
                value={formData.so_tang}
                onChange={handleChange}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] text-slate-700 focus:outline-none focus:border-blue-500 transition shadow-2xs cursor-pointer"
              >
                <option value="">-- Chọn tầng --</option>
                {availableFloors.map((floorNum) => (
                  <option key={floorNum} value={floorNum}>
                    Tầng {floorNum}
                  </option>
                ))}
              </select>
            </div>

            {/* Chọn vị trí giường */}
            <div>
              <select
                name="ma_giuong"
                value={formData.ma_giuong}
                onChange={handleChange}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] text-slate-700 focus:outline-none focus:border-blue-500 transition shadow-2xs cursor-pointer"
              >
                <option value="">-- Chọn vị trí giường --</option>
                {availableBeds.map((g, idx) => {
                  const num = g.ma_giuong.includes('_G')
                    ? g.ma_giuong.split('_G')[1]
                    : idx + 1;
                  return (
                    <option key={g.ma_giuong} value={g.ma_giuong}>
                      Giường số {parseInt(num, 10) || num} (Còn trống)
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Thiết lập hợp đồng lưu trú & nghĩa vụ tài chính */}
        {/* Yêu cầu 5:
            - Mã hợp đồng tự động tạo & không cho chỉnh sửa (readOnly)
            - Chọn ngày bắt đầu, kết thúc rồi tự động tính thời hạn lưu trú & không cho chỉnh sửa (readOnly)
            - Sau khi chọn phòng xong thì đơn giá tự động cập nhật & không cho chỉnh sửa (readOnly)
            - Bỏ phần hình ảnh bản scan hợp đồng */}
        <div>
          <h2 className="text-base font-bold text-slate-900 mb-2.5">
            Thiết lập hợp đồng lưu trú & nghĩa vụ tài chính
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
            {/* Cột trái: Mã HĐ, Ngày bắt đầu, Ngày kết thúc (khớp ảnh) */}
            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Mã hợp đồng
                </label>
                <input
                  type="text"
                  name="ma_hop_dong"
                  value={formData.ma_hop_dong}
                  readOnly
                  placeholder="Mã hợp đồng"
                  title="Mã hợp đồng tự động tạo, không thể chỉnh sửa"
                  className="w-full px-3.5 py-2 text-sm bg-slate-100 text-slate-600 border border-slate-300 rounded-[5px] font-medium cursor-not-allowed select-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Ngày bắt đầu
                </label>
                <input
                  type="date"
                  name="ngay_bat_dau"
                  value={formData.ngay_bat_dau}
                  onChange={handleChange}
                  placeholder="Ngày bắt đầu"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] text-slate-700 focus:outline-none focus:border-blue-500 transition shadow-2xs cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Ngày kết thúc
                </label>
                <input
                  type="date"
                  name="ngay_ket_thuc"
                  value={formData.ngay_ket_thuc}
                  onChange={handleChange}
                  placeholder="Ngày kết thúc"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-[5px] text-slate-700 focus:outline-none focus:border-blue-500 transition shadow-2xs cursor-pointer"
                />
              </div>
            </div>

            {/* Cột phải: Thời hạn lưu trú, Tiền thuê cả năm, Đơn giá định kỳ (khớp ảnh) */}
            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Thời hạn lưu trú
                </label>
                <input
                  type="text"
                  name="thoi_han_luu_tru"
                  value={formData.thoi_han_luu_tru}
                  readOnly
                  placeholder="Thời hạn lưu trú"
                  title="Thời hạn lưu trú được tính tự động từ ngày bắt đầu đến ngày kết thúc, không thể chỉnh sửa"
                  className="w-full px-3.5 py-2 text-sm bg-white text-slate-700 border border-slate-300 rounded-[5px] font-medium cursor-default select-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Tiền thuê cả năm
                </label>
                <input
                  type="text"
                  name="tong_tien_thue"
                  value={
                    formData.tong_tien_thue
                      ? `${Number(formData.tong_tien_thue).toLocaleString('vi-VN')} đ`
                      : ''
                  }
                  readOnly
                  placeholder="Tiền thuê cả năm"
                  title="Tiền thuê cả năm được tính tự động theo đơn giá và thời hạn, không thể chỉnh sửa"
                  className="w-full px-3.5 py-2 text-sm bg-white text-slate-700 border border-slate-300 rounded-[5px] font-medium cursor-default select-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Đơn giá định kỳ
                </label>
                <input
                  type="text"
                  name="don_gia_dinh_ky"
                  value={
                    formData.don_gia_dinh_ky
                      ? `${Number(formData.don_gia_dinh_ky).toLocaleString('vi-VN')} đ/tháng`
                      : ''
                  }
                  readOnly
                  placeholder="Đơn giá định kỳ"
                  title="Đơn giá định kỳ tự động cập nhật theo phòng đã chọn, không thể chỉnh sửa"
                  className="w-full px-3.5 py-2 text-sm bg-white text-slate-700 border border-slate-300 rounded-[5px] font-medium cursor-default select-none shadow-2xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions Right Aligned (Khớp hoàn toàn Figma Image 3) */}
        <div className="flex items-center justify-end gap-3 pt-6 select-none">
          {/* Nút Hủy thao tác (Nút xanh dương đặc có icon) */}
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-5 py-2 bg-[#007aff] hover:bg-blue-600 text-white rounded-full text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Hủy thao tác</span>
          </button>

          {/* Nút Lưu hồ sơ (Nút viền xanh nền trắng có icon đĩa mềm) */}
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 bg-white hover:bg-sky-50 text-sky-600 border border-sky-400 rounded-full text-xs font-semibold transition cursor-pointer shadow-2xs disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5 text-sky-600" />
            <span>{submitting ? 'Đang lưu...' : 'Lưu hồ sơ'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
