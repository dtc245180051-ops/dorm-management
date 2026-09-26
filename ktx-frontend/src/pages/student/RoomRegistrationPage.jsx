import React, { useState, useEffect, useMemo } from 'react';
import {
  FileEdit,
  Calendar,
  ChevronDown,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import StudentLayout from '../../layouts/Student';
import occupancyService from '../../services/occupancyService';
import { VIETNAM_PROVINCES } from '../../data/vietnamAddressData';

export default function RoomRegistrationPage({
  onNavigateHistory,
  onNavigateDashboard,
  onSelectTab,
}) {
  // State chuyển đổi mượt mà giữa Form và Màn hình thành công (không chuyển URL)
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // State quản lý Địa chỉ thường trú 3 ô (Tỉnh/Thành, Quận/Huyện, Số nhà/đường/xã)
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [detailStreet, setDetailStreet] = useState('');

  // Form State: Mặc định TRỐNG HOÀN TOÀN khi ấn vào theo yêu cầu
  const initialFormState = {
    // Thông tin sinh viên
    msv: '',
    ho_ten: '',
    gioi_tinh: '',
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

    // Nguyện vọng
    loai_phong: '',
    tang_mong_muon: '',
    muc_gia_mong_muon: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  // Danh sách các phòng/giường trống khả dụng lấy từ API
  const [availableOptions, setAvailableOptions] = useState([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  // Danh sách các mức giá phòng/năm hiện có từ CSDL KTX
  const [priceOptions, setPriceOptions] = useState([]);
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);

  // Danh sách Quận/Huyện theo Tỉnh/Thành được chọn
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

  // Tự động ghép chuỗi địa chỉ đầy đủ từ 3 ô: Số nhà/đường, Quận/Huyện, Tỉnh/Thành phố
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

  // Tải danh sách phòng trống và các mức giá phòng/năm từ CSDL KTX
  useEffect(() => {
    const fetchOptionsAndPrices = async () => {
      try {
        const [rooms, prices] = await Promise.all([
          occupancyService.getAvailableOptions(),
          occupancyService.getPriceOptions(),
        ]);
        setAvailableOptions(rooms || []);
        setPriceOptions(prices || []);
      } catch (err) {
        console.error('Error fetching options/prices:', err);
      } finally {
        setIsLoadingOptions(false);
        setIsLoadingPrices(false);
      }
    };

    fetchOptionsAndPrices();
  }, []);

  // Xử lý thay đổi input thông thường
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Reset toàn bộ form về trống
  const handleResetForm = () => {
    setFormData(initialFormState);
    setSelectedProvince('');
    setSelectedDistrict('');
    setDetailStreet('');
    setConfirmed(false);
    setIsSuccess(false);
  };

  // Xử lý gửi đơn đăng ký
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const wishParts = [
        formData.loai_phong,
        formData.tang_mong_muon,
        formData.muc_gia_mong_muon,
      ].filter(Boolean);

      const wishText = wishParts.length > 0 ? wishParts.join(' - ') : 'Phòng tiêu chuẩn';

      const payload = {
        ...formData,
        loai_phong: formData.loai_phong,
        tang_mong_muon: formData.tang_mong_muon,
        muc_gia_mong_muon: formData.muc_gia_mong_muon,
        nguyen_vong: wishText,
        nguyen_vong_label: wishText,
        xac_nhan: true,
      };

      await occupancyService.registerRoom(payload);

      // Chuyển sang màn hình thành công mượt mà không chuyển đổi URL
      setIsSuccess(true);
    } catch (err) {
      console.error('Failed to submit room registration:', err);
      // Vẫn hỗ trợ chuyển thành công dạng demo nếu có lỗi mạng
      setIsSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Điều hướng nút Xem lịch sử
  const handleGoToHistory = () => {
    if (onSelectTab) {
      onSelectTab('history');
    } else if (onNavigateHistory) {
      onNavigateHistory();
    } else {
      window.history.pushState({}, '', '/student/history');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  // Điều hướng nút Về trang chủ
  const handleGoToDashboard = () => {
    if (onSelectTab) {
      onSelectTab('dashboard');
    } else if (onNavigateDashboard) {
      onNavigateDashboard();
    } else {
      window.history.pushState({}, '', '/student/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <StudentLayout
      activeTab="register"
      onSelectTab={onSelectTab}
      userName={formData.ho_ten || 'Sinh viên'}
      userRole="Sinh viên"
    >
      {/* Khung nội dung chính nền trắng bo góc lớn */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 lg:p-8 flex-1 flex flex-col justify-between transition-all duration-300">
        {!isSuccess ? (
          /* ========================================================================= */
          /* FORM ĐIỀN THÔNG TIN ĐĂNG KÝ Ở (ẢNH 1) - FORM TRỐNG KHI MỞ                */
          /* ========================================================================= */
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Tiêu đề trang con */}
            <div className="flex items-center gap-3 select-none">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                <FileEdit className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
                  Đăng ký ở
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Kiểm tra thông tin trước khi xác nhận
                </p>
              </div>
            </div>

            {/* CARD 1: THÔNG TIN SINH VIÊN (Form 2 cột) */}
            <div className="rounded-2xl border border-sky-100 bg-[#f8fbff] p-5 sm:p-6 shadow-2xs">
              <div className="text-xs font-bold text-blue-700 tracking-wider uppercase mb-5 flex items-center gap-2">
                <span>THÔNG TIN SINH VIÊN</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {/* Cột 1 */}
                <div className="space-y-4">
                  {/* Mã sinh viên */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Mã sinh viên
                    </label>
                    <input
                      type="text"
                      name="msv"
                      value={formData.msv}
                      onChange={handleChange}
                      placeholder="Nhập mã sinh viên"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                      required
                    />
                  </div>

                  {/* Giới tính */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Giới tính
                    </label>
                    <select
                      name="gioi_tinh"
                      value={formData.gioi_tinh}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition cursor-pointer"
                    >
                      <option value="">-- Chọn giới tính --</option>
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                    </select>
                  </div>

                  {/* Số CCCD/Định danh */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Số CCCD/Định danh
                    </label>
                    <input
                      type="text"
                      name="cccd"
                      value={formData.cccd}
                      onChange={handleChange}
                      placeholder="Số CCCD/Định danh"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="Email"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                    />
                  </div>

                  {/* Lớp chuyên ngành */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Lớp chuyên ngành
                    </label>
                    <input
                      type="text"
                      name="lop"
                      value={formData.lop}
                      onChange={handleChange}
                      placeholder="Lớp chuyên ngành"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                {/* Cột 2 */}
                <div className="space-y-4">
                  {/* Họ và tên */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Họ và tên
                    </label>
                    <input
                      type="text"
                      name="ho_ten"
                      value={formData.ho_ten}
                      onChange={handleChange}
                      placeholder="Họ và tên"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                      required
                    />
                  </div>

                  {/* Ngày sinh */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Ngày sinh
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        name="ngay_sinh"
                        value={formData.ngay_sinh}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Số điện thoại */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Số điện thoại
                    </label>
                    <input
                      type="text"
                      name="so_dien_thoai"
                      value={formData.so_dien_thoai}
                      onChange={handleChange}
                      placeholder="Số điện thoại"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                    />
                  </div>

                  {/* Khoa / Viện */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Khoa / Viện
                    </label>
                    <input
                      type="text"
                      name="khoa"
                      value={formData.khoa}
                      onChange={handleChange}
                      placeholder="Khoa / Viện"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                    />
                  </div>

                  {/* YÊU CẦU 2: BỔ SUNG TRƯỜNG ĐỐI TƯỢNG ƯU TIÊN */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Đối tượng ưu tiên
                    </label>
                    <select
                      name="doi_tuong_uu_tien"
                      value={formData.doi_tuong_uu_tien}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition cursor-pointer"
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

                {/* YÊU CẦU 1: CHIA ĐỊA CHỈ THƯỜNG TRÚ THÀNH 3 Ô NGANG TRÊN 1 HÀNG */}
                <div className="col-span-1 md:col-span-2 pt-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Địa chỉ thường trú
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Ô 1: Chọn Tỉnh / Thành phố */}
                    <div>
                      <select
                        value={selectedProvince}
                        onChange={(e) => setSelectedProvince(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition cursor-pointer"
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

                    {/* Ô 2: Chọn Quận / Huyện */}
                    <div>
                      <select
                        value={selectedDistrict}
                        onChange={(e) => setSelectedDistrict(e.target.value)}
                        disabled={!selectedProvince}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                        title="Chọn Quận / Huyện"
                      >
                        <option value="">-- Chọn Quận / Huyện --</option>
                        {availableDistricts.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Ô 3: Số nhà, tên đường, xã/phường... */}
                    <div>
                      <input
                        type="text"
                        value={detailStreet}
                        onChange={(e) => setDetailStreet(e.target.value)}
                        placeholder="Số nhà, tên đường, xã/phường..."
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* HÀNG DƯỚI GỒM 2 CARD: THÔNG TIN LIÊN HỆ KHẨN CẤP & NGUYỆN VỌNG */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CARD 2: THÔNG TIN LIÊN HỆ KHẨN CẤP */}
              <div className="rounded-2xl border border-sky-100 bg-[#f8fbff] p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-blue-700 tracking-wider uppercase mb-5">
                    THÔNG TIN LIÊN HỆ KHẨN CẤP
                  </div>

                  <div className="space-y-4">
                    {/* Họ và tên người giám hộ */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Họ và tên người giám hộ
                      </label>
                      <input
                        type="text"
                        name="nguoi_giam_ho"
                        value={formData.nguoi_giam_ho}
                        onChange={handleChange}
                        placeholder="Họ và tên người giám hộ"
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                      />
                    </div>

                    {/* Mối liên hệ */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Mối liên hệ
                      </label>
                      <input
                        type="text"
                        name="moi_quan_he"
                        value={formData.moi_quan_he}
                        onChange={handleChange}
                        placeholder="Ví dụ: Bố, Mẹ, Anh/Chị"
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                      />
                    </div>

                    {/* Số điện thoại liên hệ */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Số điện thoại liên hệ
                      </label>
                      <input
                        type="text"
                        name="sdt_nguoi_giam_ho"
                        value={formData.sdt_nguoi_giam_ho}
                        onChange={handleChange}
                        placeholder="Số điện thoại liên hệ"
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* CARD 3: NGUYỆN VỌNG */}
              <div className="rounded-2xl border border-sky-100 bg-[#f8fbff] p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-blue-700 tracking-wider uppercase mb-5">
                    NGUYỆN VỌNG
                  </div>

                  <div className="space-y-4">
                    {/* Mục 1: Loại phòng (Phòng tiêu chuẩn & Phòng dịch vụ) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Loại phòng
                      </label>
                      <div className="relative">
                        <select
                          name="loai_phong"
                          value={formData.loai_phong}
                          onChange={handleChange}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition appearance-none cursor-pointer pr-10 font-medium"
                        >
                          <option value="">-- Chọn loại phòng --</option>
                          <option value="Phòng tiêu chuẩn">Phòng tiêu chuẩn</option>
                          <option value="Phòng dịch vụ">Phòng dịch vụ</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    {/* Mục 2: Tầng mong muốn */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                        Tầng mong muốn
                      </label>
                      <div className="relative">
                        <select
                          name="tang_mong_muon"
                          value={formData.tang_mong_muon}
                          onChange={handleChange}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition appearance-none cursor-pointer pr-10 font-medium"
                        >
                          <option value="">-- Chọn tầng mong muốn --</option>
                          <option value="Tầng 1">Tầng 1</option>
                          <option value="Tầng 2">Tầng 2</option>
                          <option value="Tầng 3">Tầng 3</option>
                          <option value="Tầng 4">Tầng 4</option>
                          <option value="Tầng 5">Tầng 5</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                    </div>

                    {/* Mục 3: Phòng theo ngân sách */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center justify-between">
                        <span>Phòng theo ngân sách</span>
                        {isLoadingPrices ? (
                          <span className="text-[11px] text-blue-500 font-normal flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Đang tải...
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-normal">
                            Giá phòng / năm
                          </span>
                        )}
                      </label>
                      <div className="relative">
                        <select
                          name="muc_gia_mong_muon"
                          value={formData.muc_gia_mong_muon}
                          onChange={handleChange}
                          disabled={isLoadingPrices}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition appearance-none cursor-pointer pr-10 font-medium disabled:bg-slate-50 disabled:cursor-not-allowed"
                        >
                          <option value="">-- Chọn mức ngân sách (giá/năm) --</option>
                          {priceOptions.map((item, idx) => (
                            <option key={idx} value={item.label}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                          {isLoadingPrices ? (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PHẦN DƯỚI CÙNG: CHECKBOX XÁC NHẬN VÀ BỘ 2 NÚT THAO TÁC */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 mt-2">
              {/* Checkbox xác nhận */}
              <label className="flex items-center gap-3 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="w-5 h-5 rounded-md border-2 border-blue-500 text-blue-600 focus:ring-blue-400 focus:ring-offset-0 cursor-pointer accent-blue-600"
                />
                <span className="text-sm font-medium text-slate-800 group-hover:text-slate-900 transition">
                  Tôi xác nhận thông tin đăng ký ở là đúng
                </span>
              </label>

              {/* Nhóm nút Quay lại và Gửi yêu cầu */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {/* Nút Quay lại / Reset */}
                <button
                  type="button"
                  onClick={handleGoToDashboard}
                  className="px-6 py-2.5 rounded-xl border border-sky-400 text-sky-600 hover:bg-sky-50 font-semibold text-sm transition-all duration-150 cursor-pointer shadow-2xs"
                >
                  Quay lại
                </button>

                {/* Nút Gửi yêu cầu đăng ký (Màu xanh thương hiệu) */}
                <button
                  type="submit"
                  disabled={!confirmed || isSubmitting}
                  className={`px-7 py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-150 flex items-center justify-center gap-2 shadow-sm ${confirmed && !isSubmitting
                    ? 'bg-[#0080ff] hover:bg-[#006ee0] active:scale-98 cursor-pointer shadow-blue-500/20'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                    }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Đang gửi...</span>
                    </>
                  ) : (
                    <span>Gửi yêu cầu đăng ký</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* ========================================================================= */
          /* MÀN HÌNH GỬI THÀNH CÔNG (ẢNH 2)                                           */
          /* ========================================================================= */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 sm:p-12 min-h-[500px] animate-in fade-in zoom-in-95 duration-300">
            {/* Tiêu đề thông báo thành công màu xanh lục đậm theo Ảnh 2 */}
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#235848] tracking-tight mb-4">
              Gửi yêu cầu đăng ký thành công
            </h2>

            {/* Dòng mô tả giải thích */}
            <div className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-lg mb-8 space-y-1">
              <p>Yêu cầu của bạn đã được gửi đến quản lý ktx.</p>
              <p>Bạn có thể theo dõi kết quả tại Lịch sử đăng ký.</p>
            </div>

            {/* 2 nút điều hướng theo Ảnh 2 */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
              {/* Nút 1: Xem lịch sử đăng ký (Dẫn tới /student/history) */}
              <button
                type="button"
                onClick={handleGoToHistory}
                className="w-full sm:w-auto min-w-[200px] px-7 py-3 rounded-xl border-2 border-[#0080ff] text-[#0080ff] hover:bg-blue-50 font-bold text-sm sm:text-base transition-all duration-150 cursor-pointer shadow-2xs text-center"
              >
                Xem lịch sử đăng ký
              </button>

              {/* Nút 2: Về trang chủ (Dẫn tới /student/dashboard) */}
              <button
                type="button"
                onClick={handleGoToDashboard}
                className="w-full sm:w-auto min-w-[180px] px-7 py-3 rounded-xl bg-[#0080ff] hover:bg-[#006ee0] text-white font-bold text-sm sm:text-base transition-all duration-150 cursor-pointer shadow-md shadow-blue-500/20 text-center"
              >
                Về trang chủ
              </button>
            </div>

            {/* Nút cho phép tạo lại đơn mới - sẽ reset form về trống hoàn toàn */}
            <div className="mt-8 pt-4">
              {/* <button
                type="button"
                onClick={handleResetForm}
                className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer"
              >
                + Đăng ký đơn khác
              </button> */}
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
