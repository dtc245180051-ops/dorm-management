import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeftRight,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import StudentLayout from '../../layouts/Student';
import occupancyService from '../../services/occupancyService';
import { VIETNAM_PROVINCES } from '../../data/vietnamAddressData';

export default function RoomTransferPage({
  onSelectTab,
  currentRoomInfo = {
    phong: 'P36 – Tòa A2 – Tầng 3',
    thanh_vien: '6/8 người',
    thoi_gian: '09/2025 - Nay',
  },
}) {
  // 1. Quản lý tab Form: 'transfer' (Chuyển phòng) hoặc 'checkout' (Trả phòng)
  const [activeFormTab, setActiveFormTab] = useState('transfer');

  // 2. Danh sách phòng khả dụng cho dropdown "Phòng mong muốn"
  const [availableOptions, setAvailableOptions] = useState([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  // 3. Danh sách lịch sử yêu cầu của sinh viên
  const [historyRequests, setHistoryRequests] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // 4. Form state cho Tab Chuyển phòng
  const [transferForm, setTransferForm] = useState({
    ly_do: 'Phòng hiện tại quá tải',
    ngay_mong_muon: '',
    phong_mong_muon: '',
    mo_ta: '',
  });

  // 5. Form state cho Tab Trả phòng
  const [checkoutForm, setCheckoutForm] = useState({
    ly_do: 'Đã tốt nghiệp',
    ngay_mong_muon: '',
    dia_chi_sau_tra: '',
    mo_ta: '',
  });

  // State cho địa chỉ liên hệ sau trả phòng (Tỉnh/Thành, Quận/Huyện, Chi tiết theo đơn vị hành chính mới sau sáp nhập)
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [detailStreet, setDetailStreet] = useState('');

  // Lọc danh sách Quận/Huyện theo Tỉnh/Thành đã chọn
  const availableDistricts = useMemo(() => {
    if (!selectedProvince) return [];
    const found = VIETNAM_PROVINCES.find((p) => p.name === selectedProvince);
    return found ? found.districts : [];
  }, [selectedProvince]);

  // Tự động kết hợp địa chỉ 3 phần thành chuỗi địa chỉ hoàn chỉnh
  useEffect(() => {
    const parts = [detailStreet, selectedDistrict, selectedProvince].filter(Boolean);
    const combined = parts.join(', ');
    setCheckoutForm((prev) => ({
      ...prev,
      dia_chi_sau_tra: combined,
    }));
  }, [detailStreet, selectedDistrict, selectedProvince]);

  // 6. Trạng thái gửi yêu cầu & thông báo Toast
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Tải danh sách phòng trống và lịch sử khi mở trang
  useEffect(() => {
    loadAvailableRooms();
    loadHistoryRequests();
  }, []);

  const loadAvailableRooms = async () => {
    setIsLoadingOptions(true);
    try {
      const options = await occupancyService.getAvailableOptions();
      setAvailableOptions(options || []);
      if (options && options.length > 0 && !transferForm.phong_mong_muon) {
        setTransferForm((prev) => ({
          ...prev,
          phong_mong_muon: options[0].label || options[0].ma_phong,
        }));
      }
    } catch (err) {
      console.error('Error loading available options:', err);
    } finally {
      setIsLoadingOptions(false);
    }
  };

  const loadHistoryRequests = async () => {
    setIsLoadingHistory(true);
    try {
      const items = await occupancyService.getMyRequests();
      setHistoryRequests(items || []);
    } catch (err) {
      console.error('Error loading my requests:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Hiển thị Toast thông báo tự ẩn
  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Xử lý gửi yêu cầu Chuyển phòng
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferForm.ly_do) {
      showToast('Vui lòng chọn lý do chuyển phòng', 'error');
      return;
    }
    if (!transferForm.ngay_mong_muon) {
      showToast('Vui lòng chọn ngày mong muốn chuyển', 'error');
      return;
    }
    if (!transferForm.phong_mong_muon) {
      showToast('Vui lòng chọn phòng mong muốn', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await occupancyService.createTransferRequest({
        ...transferForm,
        phong_hien_tai: currentRoomInfo.phong,
        msv: 'B21DCCN001',
      });

      showToast('Gửi yêu cầu chuyển phòng thành công! Ban quản lý sẽ xem xét.', 'success');
      // Reset form
      setTransferForm({
        ly_do: 'Phòng hiện tại quá tải',
        ngay_mong_muon: '',
        phong_mong_muon: availableOptions[0]?.label || '',
        mo_ta: '',
      });
      // Tải lại bảng lịch sử
      await loadHistoryRequests();
    } catch (err) {
      console.error('Transfer submit error:', err);
      showToast('Có lỗi xảy ra khi gửi yêu cầu chuyển phòng.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý gửi yêu cầu Trả phòng
  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (!checkoutForm.ly_do) {
      showToast('Vui lòng chọn lý do trả phòng', 'error');
      return;
    }
    if (!checkoutForm.ngay_mong_muon) {
      showToast('Vui lòng chọn ngày mong muốn trả phòng', 'error');
      return;
    }
    if (!selectedProvince) {
      showToast('Vui lòng chọn Tỉnh / Thành phố cho địa chỉ liên hệ sau khi trả phòng', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await occupancyService.createCheckoutRequest({
        ...checkoutForm,
        phong_hien_tai: currentRoomInfo.phong,
        msv: 'B21DCCN001',
      });

      showToast('Gửi yêu cầu trả phòng thành công! Ban quản lý sẽ tiếp nhận.', 'success');
      // Reset form
      setCheckoutForm({
        ly_do: 'Đã tốt nghiệp',
        ngay_mong_muon: '',
        dia_chi_sau_tra: '',
        mo_ta: '',
      });
      setSelectedProvince('');
      setSelectedDistrict('');
      setDetailStreet('');
      // Tải lại bảng lịch sử
      await loadHistoryRequests();
    } catch (err) {
      console.error('Checkout submit error:', err);
      showToast('Có lỗi xảy ra khi gửi yêu cầu trả phòng.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <StudentLayout
      activeTab="transfer"
      onSelectTab={onSelectTab}
      userName="Nguyễn Văn A"
      userRole="Sinh viên"
    >
      <div className="flex flex-col gap-6">
        {/* Toast thông báo nổi */}
        {toastMessage && (
          <div
            className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl border text-sm font-medium animate-in fade-in slide-in-from-top-4 duration-300 ${toastMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.message}</span>
          </div>
        )}

        {/* 1. Tiêu đề trang chuẩn Figma */}
        <div className="flex items-center gap-3 select-none">
          <div className="w-10 h-10 rounded-xl bg-blue-100/60 text-blue-700 flex items-center justify-center shrink-0">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1e3a8a] tracking-tight">
            Chuyển / trả phòng
          </h1>
        </div>

        {/* 2. Banner thông tin phòng hiện tại (Màu xanh dương trên cùng chuẩn Figma) */}
        <div className="bg-[#3b82f6] rounded-2xl p-6 sm:px-8 sm:py-6 shadow-sm text-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cột 1: Phòng hiện tại */}
            <div>
              <span className="text-xs font-medium text-blue-100 block mb-1">
                Phòng hiện tại
              </span>
              <div className="text-lg sm:text-xl font-bold tracking-tight">
                {currentRoomInfo.phong}
              </div>
            </div>

            {/* Cột 2: Thành viên */}
            <div>
              <span className="text-xs font-medium text-blue-100 block mb-1">
                Thành viên
              </span>
              <div className="text-lg sm:text-xl font-bold tracking-tight">
                {currentRoomInfo.thanh_vien}
              </div>
            </div>

            {/* Cột 3: Thời gian lưu trú */}
            <div>
              <span className="text-xs font-medium text-blue-100 block mb-1">
                Thời gian lưu trú
              </span>
              <div className="text-lg sm:text-xl font-bold tracking-tight">
                {currentRoomInfo.thoi_gian}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Khối Form thao tác và Cột Lưu ý hướng dẫn bên phải */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 lg:p-8 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Cột trái: Form thao tác (Chiếm 8/12 phần) */}
            <div className="lg:col-span-8 flex flex-col justify-between">
              <div>
                {/* Tab Switcher: 2 tab chuyển đổi mượt mà */}
                <div className="bg-[#f1f5f9] p-1.5 rounded-xl inline-flex gap-1.5 mb-6 border border-slate-200/60 select-none">
                  <button
                    type="button"
                    onClick={() => setActiveFormTab('transfer')}
                    className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${activeFormTab === 'transfer'
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 font-medium'
                      }`}
                  >
                    Chuyển phòng
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFormTab('checkout')}
                    className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${activeFormTab === 'checkout'
                        ? 'bg-white text-blue-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 font-medium'
                      }`}
                  >
                    Trả phòng
                  </button>
                </div>

                {/* FORM TAB 1: CHUYỂN PHÒNG */}
                {activeFormTab === 'transfer' && (
                  <form onSubmit={handleTransferSubmit} className="space-y-5">
                    {/* Hàng 1: Lý do chuyển phòng (Dropdown) | Ngày mong muốn chuyển (Date picker) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Lý do chuyển phòng */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Lý do chuyển phòng
                        </label>
                        <div className="relative">
                          <select
                            value={transferForm.ly_do}
                            onChange={(e) =>
                              setTransferForm({ ...transferForm, ly_do: e.target.value })
                            }
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition appearance-none cursor-pointer pr-10"
                          >
                            <option value="Phòng hiện tại quá tải">
                              Phòng hiện tại quá tải
                            </option>
                            <option value="Muốn ở cùng bạn bè / người quen">
                              Muốn ở cùng bạn bè / người quen
                            </option>
                            <option value="Chuyển sang loại phòng dịch vụ / chất lượng cao">
                              Chuyển sang loại phòng dịch vụ / chất lượng cao
                            </option>
                            <option value="Lý do sức khỏe / cá nhân">
                              Lý do sức khỏe / cá nhân
                            </option>
                            <option value="Khác">Khác</option>
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>

                      {/* Ngày mong muốn chuyển */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Ngày mong muốn chuyển
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            value={transferForm.ngay_mong_muon}
                            onChange={(e) =>
                              setTransferForm({
                                ...transferForm,
                                ngay_mong_muon: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition cursor-pointer"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Hàng 2: Phòng mong muốn (Dropdown lấy danh sách phòng còn trống từ API) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Phòng mong muốn
                      </label>
                      <div className="relative">
                        <select
                          value={transferForm.phong_mong_muon}
                          onChange={(e) =>
                            setTransferForm({
                              ...transferForm,
                              phong_mong_muon: e.target.value,
                            })
                          }
                          disabled={isLoadingOptions}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition appearance-none cursor-pointer pr-10 disabled:bg-slate-50"
                        >
                          {availableOptions.map((opt, idx) => (
                            <option
                              key={idx}
                              value={opt.label || opt.ma_phong}
                            >
                              {opt.label || opt.ma_phong}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Hàng 3: Mô tả chi tiết */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Mô tả chi tiết
                      </label>
                      <textarea
                        rows={4}
                        value={transferForm.mo_ta}
                        onChange={(e) =>
                          setTransferForm({ ...transferForm, mo_ta: e.target.value })
                        }
                        placeholder="Mô tả rõ nguyện vọng của bạn để ban quản lý ktx xét duyệt nhanh hơn..."
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition resize-none"
                      />
                    </div>

                    {/* Nút gửi yêu cầu chuyển phòng */}
                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Đang gửi yêu cầu...</span>
                          </>
                        ) : (
                          <span>Gửi yêu cầu chuyển phòng</span>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {/* FORM TAB 2: TRẢ PHÒNG */}
                {activeFormTab === 'checkout' && (
                  <form onSubmit={handleCheckoutSubmit} className="space-y-5">
                    {/* Hàng 1: Lý do trả phòng (Dropdown) | Ngày mong muốn chuyển (Date picker) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Lý do trả phòng */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Lý do trả phòng
                        </label>
                        <div className="relative">
                          <select
                            value={checkoutForm.ly_do}
                            onChange={(e) =>
                              setCheckoutForm({ ...checkoutForm, ly_do: e.target.value })
                            }
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition appearance-none cursor-pointer pr-10"
                          >
                            <option value="Đã tốt nghiệp">Đã tốt nghiệp</option>
                            <option value="Đi thực tập / trao đổi">
                              Đi thực tập / trao đổi
                            </option>
                            <option value="Chuyển ra ngoài ở cùng gia đình">
                              Chuyển ra ngoài ở cùng gia đình
                            </option>
                            <option value="Bảo lưu kết quả học tập">
                              Bảo lưu kết quả học tập
                            </option>
                            <option value="Khác">Khác</option>
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>

                      {/* Ngày mong muốn chuyển (rời phòng) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Ngày mong muốn chuyển
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            value={checkoutForm.ngay_mong_muon}
                            onChange={(e) =>
                              setCheckoutForm({
                                ...checkoutForm,
                                ngay_mong_muon: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition cursor-pointer"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Hàng 2: Địa chỉ liên hệ sau khi trả phòng (Cho phép chọn địa chỉ chuẩn hóa mới sau sáp nhập) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Địa chỉ liên hệ sau khi trả phòng
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Ô 1: Chọn Tỉnh / Thành phố */}
                        <div className="relative">
                          <select
                            value={selectedProvince}
                            onChange={(e) => {
                              setSelectedProvince(e.target.value);
                              setSelectedDistrict('');
                            }}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition appearance-none cursor-pointer pr-9"
                          >
                            <option value="">-- Tỉnh / Thành phố --</option>
                            {VIETNAM_PROVINCES.map((p) => (
                              <option key={p.name} value={p.name}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {/* Ô 2: Chọn Quận / Huyện / Thị xã */}
                        <div className="relative">
                          <select
                            value={selectedDistrict}
                            onChange={(e) => setSelectedDistrict(e.target.value)}
                            disabled={!selectedProvince}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition appearance-none cursor-pointer pr-9 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          >
                            <option value="">-- Quận / Huyện --</option>
                            {availableDistricts.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {/* Ô 3: Số nhà, tên đường, phường/xã */}
                        <div>
                          <input
                            type="text"
                            value={detailStreet}
                            onChange={(e) => setDetailStreet(e.target.value)}
                            placeholder="Số nhà, đường, xã/phường..."
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Hàng 3: Mô tả chi tiết */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Mô tả chi tiết
                      </label>
                      <textarea
                        rows={4}
                        value={checkoutForm.mo_ta}
                        onChange={(e) =>
                          setCheckoutForm({ ...checkoutForm, mo_ta: e.target.value })
                        }
                        placeholder="Ghi chú thêm cho ban quản lý ktx (nếu có)"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition resize-none"
                      />
                    </div>

                    {/* Nút gửi yêu cầu trả phòng */}
                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Đang gửi yêu cầu...</span>
                          </>
                        ) : (
                          <span>Gửi yêu cầu trả phòng</span>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Cột phải: Hướng dẫn / Lưu ý (Cột màu xanh nhạt chuẩn Figma) */}
            <div className="lg:col-span-4 bg-[#f0f6ff] border border-blue-100/70 rounded-2xl p-6 sm:p-7 flex flex-col justify-start space-y-6">
              {/* Tiêu đề Lưu ý quan trọng */}
              <h3 className="text-xl font-bold text-slate-900 tracking-tight text-center">
                Lưu ý quan trọng
              </h3>

              {/* Bước 1 */}
              <div className="flex items-start gap-3.5">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-2xs">
                  1
                </div>
                <p className="text-xs sm:text-[13px] text-slate-700 font-medium leading-relaxed">
                  Yêu cầu chuyển phòng được xử lý trong 3–5 ngày làm việc kể từ khi gửi.
                </p>
              </div>

              {/* Bước 2 */}
              <div className="flex items-start gap-3.5">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-2xs">
                  2
                </div>
                <p className="text-xs sm:text-[13px] text-slate-700 font-medium leading-relaxed">
                  Yêu cầu trả phòng cần gửi trước tối thiểu 7 ngày so với ngày dự kiến rời phòng.
                </p>
              </div>

              {/* Bước 3 */}
              <div className="flex items-start gap-3.5">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-2xs">
                  3
                </div>
                <p className="text-xs sm:text-[13px] text-slate-700 font-medium leading-relaxed">
                  Sinh viên cần hoàn thành đầy đủ các khoản phí dịch vụ và bàn giao tài sản trước khi rời phòng.
                </p>
              </div>

              {/* Bước 4 */}
              <div className="flex items-start gap-3.5">
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-2xs">
                  4
                </div>
                <p className="text-xs sm:text-[13px] text-slate-700 font-medium leading-relaxed">
                  Sau khi được duyệt, hãy liên hệ trực tiếp ban quản lý KTX để nhận chìa khóa và kiểm kê đồ đạc.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Bảng "Lịch sử yêu cầu" (Phía dưới cùng chuẩn Figma) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 lg:p-8 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Lịch sử yêu cầu
            </h2>
            {isLoadingHistory && (
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Mã yêu cầu</th>
                  <th className="py-3 px-4">Loại yêu cầu</th>
                  <th className="py-3 px-4">Ngày gửi</th>
                  <th className="py-3 px-4">Phòng liên quan</th>
                  <th className="py-3 px-4 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {historyRequests.length > 0 ? (
                  historyRequests.map((req, idx) => {
                    const isApproved = req.trang_thai === 'DA_DUYET';
                    const isRejected = req.trang_thai === 'TU_CHOI';
                    const isPending = !isApproved && !isRejected;

                    return (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* Mã yêu cầu */}
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-800 text-xs">
                          {req.ma_yeu_cau || req.id}
                        </td>

                        {/* Loại yêu cầu */}
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {req.loai_yeu_cau}
                        </td>

                        {/* Ngày gửi */}
                        <td className="py-3.5 px-4 text-slate-600 text-xs">
                          {req.ngay_gui}
                        </td>

                        {/* Phòng liên quan */}
                        <td className="py-3.5 px-4 font-medium text-slate-800">
                          {req.phong_lien_quan || req.phong_hien_tai}
                        </td>

                        {/* Trạng thái */}
                        <td className="py-3.5 px-4 text-right">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Đã duyệt
                            </span>
                          ) : isRejected ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              Từ chối
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Chờ duyệt
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-slate-400 text-xs"
                    >
                      Chưa có yêu cầu chuyển / trả phòng nào được ghi nhận.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
