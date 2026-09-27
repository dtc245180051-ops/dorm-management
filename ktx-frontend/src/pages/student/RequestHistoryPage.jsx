import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Calendar,
  Search,
  AlertCircle,
  ChevronDown,
  X,
  FileText,
  Building2,
  CheckCircle2,
  Loader2,
  Home,
} from 'lucide-react';
import StudentLayout from '../../layouts/Student';
import occupancyService from '../../services/occupancyService';

export default function RequestHistoryPage({ onSelectTab }) {
  // 1. Quản lý tab hiển thị: 'registration' (Lịch sử đăng ký) hoặc 'stay' (Lịch sử ở)
  const [activeTab, setActiveTab] = useState('stay');

  // 2. State dữ liệu
  const [registrationRequests, setRegistrationRequests] = useState([]);
  const [stayContracts, setStayContracts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // 3. State Bộ lọc tìm kiếm
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('Tất cả');
  const [selectedStatus, setSelectedStatus] = useState('Tất cả');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // 4. State Modal xem chi tiết
  const [detailModalItem, setDetailModalItem] = useState(null);
  const [modalType, setModalType] = useState(null); // 'registration' | 'stay'

  // Tải dữ liệu ban đầu
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [reqs, contracts] = await Promise.all([
        occupancyService.getMyRequests(),
        occupancyService.getMyContracts(),
      ]);

      // Chuẩn hóa dữ liệu đơn đăng ký nếu chưa có
      if (reqs && reqs.length > 0) {
        setRegistrationRequests(reqs);
      } else {
        setRegistrationRequests([
          {
            id: 'DK-001',
            ma_yeu_cau: 'DK-001',
            ngay_dang_ky: '25/08/2026',
            loai_phong: 'Phòng tiêu chuẩn',
            tang_mong_muon: 'Tầng 3',
            muc_gia_mong_muon: '12.000.000 đ/năm',
            nam_hoc: '2026-2027',
            trang_thai: 'CHO_DUYET',
            trang_thai_label: 'Đang xét duyệt',
          },
        ]);
      }

      // Chuẩn hóa dữ liệu lịch sử ở nếu chưa có
      if (contracts && contracts.length > 0) {
        setStayContracts(contracts);
      } else {
        setStayContracts([
          {
            id: 'HD26-A2P36-G07',
            ma_hop_dong: 'HD26-A2P36-G07',
            phong: 'P36',
            toa: 'A2',
            tang: '3',
            giuong: 'G7',
            thoi_gian_o: '2026-2027',
            nam_hoc: '2026-2027',
            trang_thai: 'DANG_O',
            trang_thai_label: 'Đang ở',
          },
        ]);
      }
    } catch (err) {
      console.error('Error loading history data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper trích xuất 3 thông tin nguyện vọng cho từng dòng đăng ký
  const getRegistrationPreferences = (req) => {
    // 1. Loại phòng
    let loaiPhong = req.loai_phong;
    if (!loaiPhong) {
      if (req.nguyen_vong?.includes('dịch vụ')) {
        loaiPhong = 'Phòng dịch vụ';
      } else {
        loaiPhong = 'Phòng tiêu chuẩn';
      }
    }

    // 2. Tầng mong muốn
    let tangMongMuon = req.tang_mong_muon;
    if (!tangMongMuon) {
      const match = req.nguyen_vong?.match(/tầng\s*(\d+)/i) || req.nguyen_vong_label?.match(/tầng\s*(\d+)/i);
      if (match) {
        tangMongMuon = `Tầng ${match[1]}`;
      } else {
        tangMongMuon = 'Tầng 3';
      }
    }

    // 3. Phòng theo ngân sách
    let nganSach = req.muc_gia_mong_muon || req.ngan_sach;
    if (!nganSach) {
      nganSach = '12.000.000 đ/năm';
    }

    return { loaiPhong, tangMongMuon, nganSach };
  };

  // Lọc dữ liệu Lịch sử đăng ký
  const filteredRegistrationList = useMemo(() => {
    return registrationRequests.filter((item) => {
      // Lọc theo năm học
      if (selectedSchoolYear !== 'Tất cả') {
        const itemYear = item.nam_hoc || '2026-2027';
        if (!itemYear.includes(selectedSchoolYear)) return false;
      }

      // Lọc theo trạng thái
      if (selectedStatus !== 'Tất cả') {
        const itemStatus = item.trang_thai_label || item.trang_thai || '';
        if (
          selectedStatus === 'Đang xét duyệt' &&
          !itemStatus.includes('xét duyệt') &&
          !itemStatus.includes('CHO_DUYET')
        ) {
          return false;
        }
        if (
          selectedStatus === 'Đã duyệt' &&
          !itemStatus.includes('Đã duyệt') &&
          !itemStatus.includes('DA_DUYET')
        ) {
          return false;
        }
        if (
          selectedStatus === 'Từ chối' &&
          !itemStatus.includes('Từ chối') &&
          !itemStatus.includes('TU_CHOI')
        ) {
          return false;
        }
      }

      return true;
    });
  }, [registrationRequests, selectedSchoolYear, selectedStatus]);

  // Lọc dữ liệu Lịch sử ở
  const filteredStayList = useMemo(() => {
    return stayContracts.filter((item) => {
      // Lọc theo năm học
      if (selectedSchoolYear !== 'Tất cả') {
        const itemYear = item.nam_hoc || item.thoi_gian_o || '2026-2027';
        if (!itemYear.includes(selectedSchoolYear)) return false;
      }

      // Lọc theo trạng thái
      if (selectedStatus !== 'Tất cả') {
        const itemStatus = item.trang_thai_label || item.trang_thai || '';
        if (selectedStatus === 'Đang ở' && !itemStatus.includes('Đang ở') && !itemStatus.includes('DANG_O')) {
          return false;
        }
        if (selectedStatus === 'Đã kết thúc' && !itemStatus.includes('Đã kết thúc') && !itemStatus.includes('KET_THUC')) {
          return false;
        }
      }

      return true;
    });
  }, [stayContracts, selectedSchoolYear, selectedStatus]);

  return (
    <StudentLayout
      activeTab="history"
      onSelectTab={onSelectTab}
      userName="Nguyễn Văn A"
      userRole="Sinh viên"
    >
      {/* Khung nền trắng bo góc lớn đồng bộ toàn hệ thống */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 lg:p-8 flex flex-col gap-6">
        {/* 1. Header tiêu đề trang chuẩn Figma */}
        <div className="flex items-center gap-3 select-none">
          <div className="w-10 h-10 rounded-full border-2 border-blue-600 flex items-center justify-center text-blue-600 shrink-0">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1e3a8a] tracking-tight">
              Lịch sử
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Theo dõi các yêu cầu đăng ký và quá trình ở KTX của bạn
            </p>
          </div>
        </div>

        {/* 2. Tab Switcher: Lịch sử đăng ký | Lịch sử ở (Chuẩn Figma với viền bo tròn) */}
        <div className="inline-flex items-center p-1 rounded-2xl border border-blue-200/80 bg-white shadow-2xs select-none w-fit">
          <button
            type="button"
            onClick={() => {
              setActiveTab('registration');
              setSelectedStatus('Tất cả');
            }}
            className={`px-7 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeTab === 'registration'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-blue-600 hover:bg-blue-50/50'
              }`}
          >
            Lịch sử đăng ký
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('stay');
              setSelectedStatus('Tất cả');
            }}
            className={`px-7 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${activeTab === 'stay'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-blue-600 hover:bg-blue-50/50'
              }`}
          >
            Lịch sử ở
          </button>
        </div>

        {/* 3. Thanh Bộ lọc tìm kiếm (Khối bo góc nền xanh nhạt bg-blue-50/50 chuẩn Figma) */}
        <div className="bg-[#edf5fe] border border-blue-100 rounded-2xl p-5 sm:p-6 shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            {/* Trường 1: Năm học */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Năm học
              </label>
              <div className="relative">
                <select
                  value={selectedSchoolYear}
                  onChange={(e) => setSelectedSchoolYear(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition appearance-none cursor-pointer pr-10 shadow-2xs"
                >
                  <option value="Tất cả">Tất cả</option>
                  <option value="2026-2027">2026–2027</option>
                  <option value="2025-2026">2025–2026</option>
                  <option value="2024-2025">2024–2025</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Trường 2: Trạng thái */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Trạng thái
              </label>
              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition appearance-none cursor-pointer pr-10 shadow-2xs"
                >
                  <option value="Tất cả">Tất cả</option>
                  {activeTab === 'registration' ? (
                    <>
                      <option value="Đang xét duyệt">Đang xét duyệt</option>
                      <option value="Đã duyệt">Đã duyệt</option>
                      <option value="Từ chối">Từ chối</option>
                    </>
                  ) : (
                    <>
                      <option value="Đang ở">Đang ở</option>
                      <option value="Đã kết thúc">Đã kết thúc</option>
                    </>
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Trường 3: Từ ngày */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Từ ngày
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  placeholder="dd/mm/yyyy"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition cursor-pointer shadow-2xs"
                />
              </div>
            </div>

            {/* Trường 4: Đến ngày */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Đến ngày
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  placeholder="dd/mm/yyyy"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition cursor-pointer shadow-2xs"
                />
              </div>
            </div>

            {/* Nút Tìm kiếm */}
            <div>
              <button
                type="button"
                onClick={loadData}
                className="w-full px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Tìm kiếm</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 4. Khối Bảng Dữ liệu chính: Tiêu đề xanh, các hàng màu trắng, không khoảng cách giữa các hàng */}
        <div className="border border-blue-100 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            {/* ================================================================= */}
            {/* TAB 1: LỊCH SỬ ĐĂNG KÝ (Sửa cột nguyện vọng thành 3 thông tin)    */}
            {/* ================================================================= */}
            {activeTab === 'registration' && (
              <table className="w-full text-left border-collapse min-w-[840px]">
                <thead className="bg-[#edf5fe]">
                  <tr className="text-sm font-semibold text-slate-600 select-none">
                    <th className="py-3.5 px-5 w-16">STT</th>
                    <th className="py-3.5 px-4">Ngày đăng ký</th>
                    <th className="py-3.5 px-4">Loại phòng</th>
                    <th className="py-3.5 px-4">Tầng mong muốn</th>
                    <th className="py-3.5 px-4">Phòng theo ngân sách</th>
                    <th className="py-3.5 px-4">Năm học</th>
                    <th className="py-3.5 px-4">Trạng thái</th>
                    <th className="py-3.5 px-5 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100 text-sm">
                  {filteredRegistrationList.length > 0 ? (
                    filteredRegistrationList.map((req, idx) => {
                      const rowKey = req.id || idx;
                      const { loaiPhong, tangMongMuon, nganSach } = getRegistrationPreferences(req);
                      const isApproved =
                        req.trang_thai === 'DA_DUYET' ||
                        req.trang_thai_label === 'Đã duyệt';
                      const isRejected =
                        req.trang_thai === 'TU_CHOI' ||
                        req.trang_thai_label === 'Từ chối';

                      return (
                        <tr
                          key={rowKey}
                          className="hover:bg-[#f8faff] transition-colors duration-150"
                        >
                          {/* STT */}
                          <td className="py-3.5 px-5 font-semibold text-slate-800">
                            {idx + 1}
                          </td>

                          {/* Ngày đăng ký */}
                          <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                            {req.ngay_dang_ky || '25/08/2026'}
                          </td>

                          {/* Loại phòng (Thông tin 1) */}
                          <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                            {loaiPhong}
                          </td>

                          {/* Tầng mong muốn (Thông tin 2) */}
                          <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                            {tangMongMuon}
                          </td>

                          {/* Phòng theo ngân sách (Thông tin 3) */}
                          <td className="py-3.5 px-4 font-semibold text-blue-700 whitespace-nowrap">
                            {nganSach}
                          </td>

                          {/* Năm học */}
                          <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                            {req.nam_hoc || '2026–2027'}
                          </td>

                          {/* Trạng thái (Pill badge bo tròn) */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isApproved ? (
                              <span className="inline-block px-4 py-1 rounded-full text-xs font-bold bg-[#bbf7d0] text-[#15803d]">
                                Đã duyệt
                              </span>
                            ) : isRejected ? (
                              <span className="inline-block px-4 py-1 rounded-full text-xs font-bold bg-[#ffe4e6] text-[#e11d48]">
                                Từ chối
                              </span>
                            ) : (
                              <span className="inline-block px-4 py-1 rounded-full text-xs font-bold bg-[#fef3c7] text-[#d97706]">
                                {req.trang_thai_label || 'Đang xét duyệt'}
                              </span>
                            )}
                          </td>

                          {/* Thao tác (Nút Xem viền xanh) */}
                          <td className="py-3.5 px-5 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setDetailModalItem({
                                  ...req,
                                  loai_phong: loaiPhong,
                                  tang_mong_muon: tangMongMuon,
                                  muc_gia_mong_muon: nganSach,
                                });
                                setModalType('registration');
                              }}
                              className="px-5 py-1.5 border border-blue-500 text-blue-500 hover:bg-white text-sm font-semibold rounded-xl transition cursor-pointer"
                            >
                              Xem
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-10 text-center text-slate-400 text-sm"
                      >
                        Không tìm thấy yêu cầu đăng ký nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* ================================================================= */}
            {/* TAB 2: LỊCH SỬ Ở (Hàng tiêu đề xanh, hàng dữ liệu trắng)        */}
            {/* ================================================================= */}
            {activeTab === 'stay' && (
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead className="bg-[#edf5fe]">
                  <tr className="text-sm font-semibold text-slate-600 select-none">
                    <th className="py-3.5 px-5 w-16">STT</th>
                    <th className="py-3.5 px-4">Phòng</th>
                    <th className="py-3.5 px-4">Tòa</th>
                    <th className="py-3.5 px-4">Tầng</th>
                    <th className="py-3.5 px-4">Giường</th>
                    <th className="py-3.5 px-4">thời gian ở</th>
                    <th className="py-3.5 px-4">Trạng thái</th>
                    <th className="py-3.5 px-5 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100 text-sm">
                  {filteredStayList.length > 0 ? (
                    filteredStayList.map((stay, idx) => (
                      <tr
                        key={stay.id || idx}
                        className="hover:bg-[#f8faff] transition-colors duration-150"
                      >
                        {/* STT */}
                        <td className="py-3.5 px-5 font-semibold text-slate-800">
                          {idx + 1}
                        </td>

                        {/* Phòng */}
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {stay.phong || 'P36'}
                        </td>

                        {/* Tòa */}
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {stay.toa || 'A2'}
                        </td>

                        {/* Tầng */}
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {stay.tang || '3'}
                        </td>

                        {/* Giường */}
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {stay.giuong || 'G7'}
                        </td>

                        {/* thời gian ở */}
                        <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                          {stay.thoi_gian_o || stay.nam_hoc || '2026-2027'}
                        </td>

                        {/* Trạng thái (Pill badge Đang ở màu xanh ngọc chuẩn Figma) */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="inline-block px-4 py-1 rounded-full text-xs font-bold bg-[#bbf7d0] text-[#15803d]">
                            {stay.trang_thai_label || 'Đang ở'}
                          </span>
                        </td>

                        {/* Thao tác (Nút Xem viền xanh) */}
                        <td className="py-3.5 px-5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setDetailModalItem(stay);
                              setModalType('stay');
                            }}
                            className="px-5 py-1.5 border border-blue-500 text-blue-500 hover:bg-blue-50 text-sm font-semibold rounded-xl transition cursor-pointer"
                          >
                            Xem
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-10 text-center text-slate-400 text-sm"
                      >
                        Không tìm thấy thông tin lịch sử ở nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 5. Khối Banner "Lưu ý" (Dưới cùng chuẩn Figma với Icon Chatbot bên phải) */}
        <div className="bg-[#edf5fe] border border-blue-100 rounded-2xl p-5 sm:p-6 flex items-center justify-between shadow-2xs relative overflow-hidden pr-20 md:pr-24">
          <div className="flex items-start gap-4">
            <div className="text-blue-600 shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div className="space-y-1 text-xs sm:text-[13px] leading-relaxed text-slate-700">
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                Lưu ý:
              </h4>
              <p>
                Trạng thái "Chờ xác nhận" nghĩa là yêu cầu của bạn đã được gửi đến quản lý KTX và đang được xem xét
              </p>
              <p>
                Khi được xác nhận, bạn sẽ nhận được thông báo trên hệ thống.
              </p>
              <p>
                Nếu bị từ chối, bạn có thể đăng ký phòng khác.
              </p>
            </div>
          </div>

          {/* Icon Chatbot minh họa góc phải banner chuẩn thiết kế */}
          <div className="hidden md:flex items-center justify-center shrink-0 pr-2">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-400 to-blue-500 p-1 flex items-center justify-center shadow-md relative">
              <img
                src="/chatbot.png"
                alt="AI Chatbot"
                className="w-12 h-12 object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <span className="w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full absolute bottom-0.5 right-0.5" />
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL XEM CHI TIẾT ĐƠN ĐĂNG KÝ (Đầy đủ 3 thông tin nguyện vọng)       */}
      {/* ===================================================================== */}
      {detailModalItem && modalType === 'registration' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-lg text-slate-900">
                  Chi tiết đơn đăng ký ở
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3.5 text-xs sm:text-sm">
              <div className="flex justify-between p-3 rounded-xl bg-slate-50">
                <span className="text-slate-500">Mã đơn:</span>
                <span className="font-mono font-bold text-blue-600">
                  {detailModalItem.ma_yeu_cau || detailModalItem.id}
                </span>
              </div>

              <div className="flex justify-between p-3 rounded-xl bg-slate-50">
                <span className="text-slate-500">Ngày nộp:</span>
                <span className="font-semibold text-slate-800">
                  {detailModalItem.ngay_dang_ky}
                </span>
              </div>

              <div className="flex justify-between p-3 rounded-xl bg-slate-50">
                <span className="text-slate-500">Năm học:</span>
                <span className="font-semibold text-slate-800">
                  {detailModalItem.nam_hoc || '2026–2027'}
                </span>
              </div>

              <div className="flex justify-between p-3 rounded-xl bg-slate-50">
                <span className="text-slate-500">Trạng thái xét duyệt:</span>
                <span className="font-bold text-amber-700 bg-amber-100 px-3 py-0.5 rounded-full">
                  {detailModalItem.trang_thai_label || 'Đang xét duyệt'}
                </span>
              </div>

              {/* Khối 3 thông tin nguyện vọng đã đăng ký */}
              <div className="p-4 rounded-xl bg-[#f0f7ff] border border-blue-100 space-y-2">
                <span className="text-xs font-bold text-blue-800 block uppercase tracking-wider mb-2">
                  Thông tin nguyện vọng phòng:
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">Loại phòng:</span>
                    <span className="font-semibold text-slate-800">
                      {detailModalItem.loai_phong || 'Phòng tiêu chuẩn'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Tầng mong muốn:</span>
                    <span className="font-semibold text-slate-800">
                      {detailModalItem.tang_mong_muon || 'Tầng 3'}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-blue-100/80">
                  <span className="text-slate-500 block text-xs">Phòng theo ngân sách (giá/năm):</span>
                  <span className="font-bold text-blue-700 text-sm">
                    {detailModalItem.muc_gia_mong_muon || '12.000.000 đ/năm'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL XEM CHI TIẾT QUÁ TRÌNH Ở / HỢP ĐỒNG                            */}
      {/* ===================================================================== */}
      {detailModalItem && modalType === 'stay' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Home className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-lg text-slate-900">
                  Thông tin phòng ở KTX
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3.5 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50">
                  <span className="text-slate-400 block text-xs">Phòng:</span>
                  <span className="font-bold text-base text-slate-900">
                    {detailModalItem.phong || 'P36'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50">
                  <span className="text-slate-400 block text-xs">Vị trí:</span>
                  <span className="font-bold text-base text-slate-900">
                    Tòa {detailModalItem.toa} – Tầng {detailModalItem.tang}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50">
                  <span className="text-slate-400 block text-xs">Giường số:</span>
                  <span className="font-bold text-blue-600">
                    {detailModalItem.giuong || 'G7'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50">
                  <span className="text-slate-400 block text-xs">Năm học:</span>
                  <span className="font-semibold text-slate-800">
                    {detailModalItem.nam_hoc || detailModalItem.thoi_gian_o || '2026–2027'}
                  </span>
                </div>
              </div>

              <div className="flex justify-between p-3 rounded-xl bg-slate-50">
                <span className="text-slate-500">Mã hợp đồng:</span>
                <span className="font-mono font-bold text-blue-600">
                  {detailModalItem.ma_hop_dong || detailModalItem.id}
                </span>
              </div>

              <div className="flex justify-between p-3 rounded-xl bg-slate-50">
                <span className="text-slate-500">Trạng thái lưu trú:</span>
                <span className="font-bold text-[#15803d] bg-[#bbf7d0] px-3.5 py-0.5 rounded-full">
                  {detailModalItem.trang_thai_label || 'Đang ở'}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
