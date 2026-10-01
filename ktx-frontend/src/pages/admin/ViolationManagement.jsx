import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit3,
  Image as ImageIcon,
  CheckCircle2,
  X,
  RotateCcw,
  Save,
} from 'lucide-react';

// Dữ liệu mẫu chuẩn theo các ảnh chụp thực tế từ hệ thống
const INITIAL_VIOLATIONS = [
  {
    id: '#BB-2026-083',
    ma_bb: '#BB-2026-083',
    msv: 'DTC2051012',
    ho_ten: 'Nguyễn Hoàng Long',
    phong: 'A105 - Tòa A',
    phong_ngan: 'A105 (Tòa A)',
    sdt: '0987 654 321',
    nhom_vi_pham: 'Mất an ninh trật tự',
    hanh_vi: 'Tập trung đông người, mở loa gây ồn sau 23h',
    thoi_diem: '07/09/2026 lúc 23:30',
    dia_diem: 'Hành lang Tầng 1 Tòa A',
    so_lan_luy_ke: 'Lần 2',
    ngay_lap: '08/09/2026',
    nguoi_lap: 'QL_Nguyễn Văn A',
    hinh_thuc_xu_ly: 'Cảnh cáo cấp KTX & Mời phụ huynh làm việc',
    trang_thai: 'CHO_XU_LY', // 'CHO_XU_LY' | 'DA_XU_LY' | 'KHAN_CAP'
    sub_status: 'CHO_GIAI_TRINH', // 'CHO_GIAI_TRINH' | 'DA_XU_LY_DUT_DIEM' | 'HOI_DONG_KY_LUAT'
    mo_ta:
      'Tập trung đông người sau giờ giới nghiêm (23h), sử dụng bia rượu và mở loa gây ồn, làm ảnh hưởng các phòng xung quanh dù bảo vệ đã nhắc nhở lần 1.',
    bang_chung: ['Anh_hien_truong_2.jpg', 'Anh_hien_truong_2.jpg'],
    quyet_dinh: 'Cảnh cáo cấp KTX & Mời phụ huynh làm việc',
    ghi_chu:
      'Yêu cầu sinh viên nộp bản tự kiểm điểm trước ngày 15/09/2026. Phụ huynh đã xác nhận qua điện thoại.',
  },
  {
    id: '#BB-2026-081',
    ma_bb: '#BB-2026-081',
    msv: 'DTC245080050',
    ho_ten: 'Nguyễn Văn A',
    phong: 'P102 - A1',
    phong_ngan: 'P102 (Tòa A1)',
    sdt: '0912 345 678',
    nhom_vi_pham: 'Nấu ăn trong phòng',
    hanh_vi: 'Nấu ăn trong phòng (Dùng bếp điện mini)',
    thoi_diem: '06/09/2026 lúc 18:45',
    dia_diem: 'P102 - A1',
    so_lan_luy_ke: 'Lần 1',
    ngay_lap: '07/09/2026',
    nguoi_lap: 'QL_Trần Thị B',
    hinh_thuc_xu_ly: 'Khiển trách + Trừ 2đ rèn luyện',
    trang_thai: 'DA_XU_LY',
    sub_status: 'DA_XU_LY_DUT_DIEM',
    mo_ta: 'Sử dụng bếp từ mini để nấu ăn trong phòng ngủ ký túc xá vi phạm quy định PCCC.',
    bang_chung: ['Anh_hien_truong_2.jpg'],
    quyet_dinh: 'Khiển trách + Trừ 2đ rèn luyện',
    ghi_chu: 'Sinh viên đã ký cam kết không tái phạm và nộp lại bếp.',
  },
  {
    id: '#BB-2026-082',
    ma_bb: '#BB-2026-081',
    msv: 'DTC245080050',
    ho_ten: 'Nguyễn Văn A',
    phong: 'P102 - A1',
    phong_ngan: 'P102 (Tòa A1)',
    sdt: '0912 345 678',
    nhom_vi_pham: 'Nấu ăn trong phòng',
    hanh_vi: 'Nấu ăn trong phòng (Dùng bếp điện mini)',
    thoi_diem: '05/09/2026 lúc 12:15',
    dia_diem: 'P102 - A1',
    so_lan_luy_ke: 'Lần 1',
    ngay_lap: '05/09/2026',
    nguoi_lap: 'QL_Minh',
    hinh_thuc_xu_ly: 'Khiển trách + Trừ 2đ rèn luyện',
    trang_thai: 'DA_XU_LY',
    sub_status: 'DA_XU_LY_DUT_DIEM',
    mo_ta: 'Tự ý đun nấu trong phòng ký túc xá gây khói nhẹ lan ra hành lang.',
    bang_chung: ['Anh_hien_truong_2.jpg'],
    quyet_dinh: 'Khiển trách + Trừ 2đ rèn luyện',
    ghi_chu: 'Đã hoàn tất xử lý vi phạm.',
  },
  {
    id: '#BB-2026-080',
    ma_bb: '#BB-2026-081',
    msv: 'DTC245080050',
    ho_ten: 'Nguyễn Văn A',
    phong: 'P102 - A1',
    phong_ngan: 'P102 (Tòa A1)',
    sdt: '0912 345 678',
    nhom_vi_pham: 'Nấu ăn trong phòng',
    hanh_vi: 'Nấu ăn trong phòng (Dùng bếp điện mini)',
    thoi_diem: '04/09/2026 lúc 21:00',
    dia_diem: 'P102 - A1',
    so_lan_luy_ke: 'Lần 1',
    ngay_lap: '05/09/2026',
    nguoi_lap: 'QL_Minh',
    hinh_thuc_xu_ly: 'Khiển trách + Trừ 2đ rèn luyện',
    trang_thai: 'CHO_XU_LY',
    sub_status: 'CHO_GIAI_TRINH',
    mo_ta: 'Cắm nồi cơm điện và chảo mini nấu ăn sai quy định.',
    bang_chung: ['Anh_hien_truong_2.jpg'],
    quyet_dinh: 'Khiển trách + Trừ 2đ rèn luyện',
    ghi_chu: 'Hẹn sinh viên lên văn phòng BQL KTX.',
  },
  {
    id: '#BB-2026-079',
    ma_bb: '#BB-2026-081',
    msv: 'DTC245080050',
    ho_ten: 'Nguyễn Văn A',
    phong: 'P102 - A1',
    phong_ngan: 'P102 (Tòa A1)',
    sdt: '0912 345 678',
    nhom_vi_pham: 'Nấu ăn trong phòng',
    hanh_vi: 'Nấu ăn trong phòng (Dùng bếp điện mini)',
    thoi_diem: '03/09/2026 lúc 23:45',
    dia_diem: 'P102 - A1',
    so_lan_luy_ke: 'Lần 2',
    ngay_lap: '04/09/2026',
    nguoi_lap: 'QL_Nguyễn Văn A',
    hinh_thuc_xu_ly: 'Khiển trách + Trừ 2đ rèn luyện',
    trang_thai: 'KHAN_CAP',
    sub_status: 'HOI_DONG_KY_LUAT',
    mo_ta: 'Tiếp tục sử dụng thiết bị điện có công suất lớn gây quá tải đường dây điện tầng 1.',
    bang_chung: ['Anh_hien_truong_2.jpg'],
    quyet_dinh: 'Khiển trách + Trừ 2đ rèn luyện',
    ghi_chu: 'Cần xử lý khẩn cấp trước ngày 10/09/2026.',
  },
];

export default function ViolationManagement({ searchTerm = '' }) {
  // State danh sách vi phạm (đọc từ localStorage nếu có)
  const [violations, setViolations] = useState(() => {
    try {
      const saved = localStorage.getItem('ktx_violations_data');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading saved violations:', e);
    }
    return INITIAL_VIOLATIONS;
  });

  // Chế độ xem: 'list' (danh sách) | 'detail' (chi tiết) | 'create' (lập biên bản mới)
  const [viewMode, setViewMode] = useState('list');
  const [selectedViolation, setSelectedViolation] = useState(null);

  // Bộ lọc trạng thái: 'ALL' | 'KHAN_CAP' | 'CHO_XU_LY' | 'DA_XU_LY'
  const [filterTab, setFilterTab] = useState('ALL');

  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Form Lập biên bản mới (Khớp 100% Ảnh 3)
  const [createForm, setCreateForm] = useState({
    ho_ten: '',
    msv: '',
    phong: '',
    thoi_gian: '',
    dia_diem: '',
    nhom_hanh_vi: '',
    mo_ta: '',
    dinh_kem: [],
    hinh_thuc_xu_ly: '',
  });

  // Modal cập nhật trạng thái
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [editStatusData, setEditStatusData] = useState({
    trang_thai: 'CHO_XU_LY',
    sub_status: 'CHO_GIAI_TRINH',
    quyet_dinh: '',
    ghi_chu: '',
  });

  // Modal xem ảnh bằng chứng
  const [previewImageName, setPreviewImageName] = useState(null);

  // Toast thông báo
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Lưu violations vào localStorage khi có thay đổi
  useEffect(() => {
    try {
      localStorage.setItem('ktx_violations_data', JSON.stringify(violations));
    } catch (e) {
      console.error('Error saving violations:', e);
    }
  }, [violations]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    return {
      totalDisplay: 18,
      pendingDisplay: 18,
      resolvedDisplay: 15,
      totalCount: violations.length,
    };
  }, [violations]);

  // Lọc dữ liệu danh sách theo Tab & Search Term
  const filteredViolations = useMemo(() => {
    return violations.filter((item) => {
      // 1. Lọc theo Tab
      if (filterTab === 'KHAN_CAP' && item.trang_thai !== 'KHAN_CAP') return false;
      if (filterTab === 'CHO_XU_LY' && item.trang_thai !== 'CHO_XU_LY') return false;
      if (filterTab === 'DA_XU_LY' && item.trang_thai !== 'DA_XU_LY') return false;

      // 2. Lọc theo từ khóa tìm kiếm
      const term = (searchTerm || '').trim().toLowerCase();
      if (!term) return true;

      return (
        item.ma_bb?.toLowerCase().includes(term) ||
        item.msv?.toLowerCase().includes(term) ||
        item.ho_ten?.toLowerCase().includes(term) ||
        item.phong?.toLowerCase().includes(term) ||
        item.hanh_vi?.toLowerCase().includes(term) ||
        item.nhom_vi_pham?.toLowerCase().includes(term)
      );
    });
  }, [violations, filterTab, searchTerm]);

  // Tổng số trang dựa trên dữ liệu lọc thực tế
  const totalPages = Math.ceil(filteredViolations.length / itemsPerPage) || 1;

  // Reset về trang 1 khi thay đổi bộ lọc hoặc từ khóa tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterTab]);

  // Đảm bảo currentPage không vượt quá totalPages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Tạo danh sách các số trang hiển thị linh hoạt
  const getPaginationItems = (current, total) => {
    if (total <= 1) return [];
    if (total <= 4) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 2) {
      return [1, 2, '...', total];
    }
    if (current >= total - 1) {
      return [1, '...', total - 1, total];
    }
    return [1, '...', current, '...', total];
  };

  // Tính toán phân trang
  const paginatedViolations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredViolations.slice(start, start + itemsPerPage);
  }, [filteredViolations, currentPage]);

  // Chuyển sang xem chi tiết
  const handleViewDetail = (item) => {
    setSelectedViolation(item);
    setEditStatusData({
      trang_thai: item.trang_thai,
      sub_status: item.sub_status || 'CHO_GIAI_TRINH',
      quyet_dinh: item.quyet_dinh || item.hinh_thuc_xu_ly || '',
      ghi_chu: item.ghi_chu || '',
    });
    setViewMode('detail');
  };

  // Quay lại danh sách
  const handleBackToList = () => {
    setViewMode('list');
  };

  // Cập nhật trạng thái trực tiếp từ 3 nút ở góc dưới của Chi tiết biên bản
  const handleQuickChangeSubStatus = (newSubStatus) => {
    if (!selectedViolation) return;

    let newMainStatus = 'CHO_XU_LY';
    if (newSubStatus === 'DA_XU_LY_DUT_DIEM') {
      newMainStatus = 'DA_XU_LY';
    } else if (newSubStatus === 'HOI_DONG_KY_LUAT') {
      newMainStatus = 'KHAN_CAP';
    }

    const updated = {
      ...selectedViolation,
      sub_status: newSubStatus,
      trang_thai: newMainStatus,
    };

    setViolations((prev) =>
      prev.map((v) => (v.id === selectedViolation.id ? updated : v))
    );
    setSelectedViolation(updated);
    setEditStatusData((prev) => ({
      ...prev,
      sub_status: newSubStatus,
      trang_thai: newMainStatus,
    }));

    showToast('Đã cập nhật trạng thái xử lý biên bản thành công!');
  };

  // Lưu modal Cập nhật trạng thái
  const handleSaveStatusModal = (e) => {
    e.preventDefault();
    if (!selectedViolation) return;

    const updated = {
      ...selectedViolation,
      trang_thai: editStatusData.trang_thai,
      sub_status: editStatusData.sub_status,
      quyet_dinh: editStatusData.quyet_dinh,
      ghi_chu: editStatusData.ghi_chu,
      hinh_thuc_xu_ly: editStatusData.quyet_dinh || selectedViolation.hinh_thuc_xu_ly,
    };

    setViolations((prev) =>
      prev.map((v) => (v.id === selectedViolation.id ? updated : v))
    );
    setSelectedViolation(updated);
    setIsUpdateModalOpen(false);
    showToast('Đã cập nhật biên bản thành công!');
  };

  // Xử lý lưu biên bản mới (Khớp 100% Ảnh 3)
  const handleSaveNewTicket = (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!createForm.dia_diem.trim()) {
      alert('Vui lòng nhập địa điểm xảy ra vi phạm (trường bắt buộc *).');
      return;
    }

    const nextIndex = violations.length + 84;
    const ticketId = `#BB-2026-${String(nextIndex).padStart(3, '0')}`;

    const newRecord = {
      id: ticketId,
      ma_bb: ticketId,
      msv: createForm.msv.trim().toUpperCase() || 'DTC245080050',
      ho_ten: createForm.ho_ten.trim() || 'Nguyễn Văn A',
      phong: createForm.phong.trim() || 'P102 - A1',
      phong_ngan: createForm.phong.trim() || 'P102 (Tòa A1)',
      sdt: '0987 654 321',
      nhom_vi_pham: createForm.nhom_hanh_vi.trim() || 'Nấu ăn trong phòng',
      hanh_vi: createForm.mo_ta.trim() || createForm.nhom_hanh_vi.trim() || 'Nấu ăn trong phòng (Dùng bếp điện mini)',
      thoi_diem: createForm.thoi_gian.trim() || new Date().toLocaleString('vi-VN'),
      dia_diem: createForm.dia_diem.trim(),
      so_lan_luy_ke: 'Lần 1',
      ngay_lap: new Date().toLocaleDateString('vi-VN'),
      nguoi_lap: 'QL_Minh',
      hinh_thuc_xu_ly: createForm.hinh_thuc_xu_ly.trim() || 'Khiển trách + Trừ 2đ rèn luyện',
      trang_thai: 'CHO_XU_LY',
      sub_status: 'CHO_GIAI_TRINH',
      mo_ta: createForm.mo_ta.trim() || 'Ghi nhận hành vi vi phạm nội quy KTX.',
      bang_chung: createForm.dinh_kem.length > 0 ? createForm.dinh_kem : ['Anh_hien_truong_2.jpg'],
      quyet_dinh: createForm.hinh_thuc_xu_ly.trim() || 'Khiển trách + Trừ 2đ rèn luyện',
      ghi_chu: 'Biên bản lập ngày ' + new Date().toLocaleDateString('vi-VN'),
    };

    setViolations([newRecord, ...violations]);
    setViewMode('list');
    setCreateForm({
      ho_ten: '',
      msv: '',
      phong: '',
      thoi_gian: '',
      dia_diem: '',
      nhom_hanh_vi: '',
      mo_ta: '',
      dinh_kem: [],
      hinh_thuc_xu_ly: '',
    });
    showToast(`Đã lập biên bản ${ticketId} thành công!`);
  };

  // Helper render trạng thái Badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'DA_XU_LY':
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-[6px] text-xs font-semibold bg-[#dcfce7] text-[#15803d] border border-emerald-200/60 min-w-[76px]">
            Đã xử lý
          </span>
        );
      case 'CHO_XU_LY':
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-[6px] text-xs font-semibold bg-[#fef3c7] text-[#b45309] border border-amber-200/60 min-w-[76px]">
            Chờ xử lý
          </span>
        );
      case 'KHAN_CAP':
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-[6px] text-xs font-semibold bg-[#ffe4e6] text-[#be123c] border border-rose-200/60 min-w-[76px]">
            Khẩn cấp
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-[6px] text-xs font-semibold bg-slate-100 text-slate-700 min-w-[76px]">
            {status}
          </span>
        );
    }
  };

  const getStatusText = (status) => {
    if (status === 'DA_XU_LY') return 'Đã xử lý';
    if (status === 'KHAN_CAP') return 'Khẩn cấp';
    return 'Chờ xử lý';
  };

  const getStatusColorClass = (status) => {
    if (status === 'DA_XU_LY') return 'text-emerald-600';
    if (status === 'KHAN_CAP') return 'text-rose-600';
    return 'text-amber-500';
  };

  // =========================================================================
  // VIEW 3: LẬP BIÊN BẢN MỚI (KHỚP 100% ẢNH 3 MỚI NHẤT)
  // =========================================================================
  if (viewMode === 'create') {
    return (
      <div className="w-full bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-10 flex flex-col gap-8 shadow-xs select-none">
        {/* Toast thông báo */}
        {toast && (
          <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-sm rounded-xl shadow-xl transition-all">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toast.message}</span>
          </div>
        )}

        {/* Header: Nút quay lại kèm tiêu đề "< Lập biên bản mới" */}
        <button
          type="button"
          onClick={() => setViewMode('list')}
          className="flex items-center gap-3 text-slate-900 hover:text-blue-600 transition-colors cursor-pointer text-left w-fit"
        >
          <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Lập biên bản mới
          </h1>
        </button>

        {/* Khối 1: Thông tin sinh viên */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-bold text-slate-900">Thông tin sinh viên</h2>
          <div className="flex flex-col">
            {/* Họ tên sinh viên */}
            <div className="border-b border-slate-300">
              <input
                type="text"
                placeholder="Họ tên sinh viên"
                value={createForm.ho_ten}
                onChange={(e) => setCreateForm({ ...createForm, ho_ten: e.target.value })}
                className="w-full py-2.5 px-1 text-sm text-slate-800 placeholder:text-slate-500 bg-transparent focus:outline-none"
              />
            </div>

            {/* Mã sinh viên */}
            <div className="border-b border-slate-300">
              <input
                type="text"
                placeholder="Mã sinh viên"
                value={createForm.msv}
                onChange={(e) => setCreateForm({ ...createForm, msv: e.target.value })}
                className="w-full py-2.5 px-1 text-sm text-slate-800 placeholder:text-slate-500 bg-transparent focus:outline-none"
              />
            </div>

            {/* Phòng ở hiện tại */}
            <div className="border-b border-slate-300">
              <input
                type="text"
                placeholder="Phòng ở hiện tại"
                value={createForm.phong}
                onChange={(e) => setCreateForm({ ...createForm, phong: e.target.value })}
                className="w-full py-2.5 px-1 text-sm text-slate-800 placeholder:text-slate-500 bg-transparent focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Khối 2: Nội dung vi phạm */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-bold text-slate-900">Nội dung vi phạm</h2>
          <div className="flex flex-col">
            {/* Thời gian vi phạm */}
            <div className="border-b border-slate-300">
              <input
                type="text"
                placeholder="Thời gian vi phạm"
                value={createForm.thoi_gian}
                onChange={(e) => setCreateForm({ ...createForm, thoi_gian: e.target.value })}
                className="w-full py-2.5 px-1 text-sm text-slate-800 placeholder:text-slate-500 bg-transparent focus:outline-none"
              />
            </div>

            {/* Địa điểm xảy ra * (Có dấu sao đỏ bắt buộc theo ảnh 3) */}
            <div className="relative border-b border-slate-300">
              {!createForm.dia_diem && (
                <div className="absolute inset-y-0 left-1 flex items-center pointer-events-none text-sm text-slate-500">
                  <span>Địa điểm xảy ra</span>
                  <span className="text-red-500 ml-1 font-semibold">*</span>
                </div>
              )}
              <input
                type="text"
                value={createForm.dia_diem}
                onChange={(e) => setCreateForm({ ...createForm, dia_diem: e.target.value })}
                className="w-full py-2.5 px-1 text-sm text-slate-800 bg-transparent focus:outline-none"
              />
            </div>

            {/* Nhóm hành vi vi phạm */}
            <div className="border-b border-slate-300">
              <input
                type="text"
                placeholder="Nhóm hành vi vi phạm"
                value={createForm.nhom_hanh_vi}
                onChange={(e) => setCreateForm({ ...createForm, nhom_hanh_vi: e.target.value })}
                className="w-full py-2.5 px-1 text-sm text-slate-800 placeholder:text-slate-500 bg-transparent focus:outline-none"
              />
            </div>

            {/* Mô tả chi tiết hành vi */}
            <div className="border-b border-slate-300">
              <input
                type="text"
                placeholder="Mô tả chi tiết hành vi"
                value={createForm.mo_ta}
                onChange={(e) => setCreateForm({ ...createForm, mo_ta: e.target.value })}
                className="w-full py-2.5 px-1 text-sm text-slate-800 placeholder:text-slate-500 bg-transparent focus:outline-none"
              />
            </div>

            {/* Đính kèm hình ảnh/biên bản giấy (nếu có) */}
            <div className="border-b border-slate-300 flex items-center justify-between">
              <input
                type="text"
                readOnly
                placeholder="Đính kèm hình ảnh/biên bản giấy (nếu có)"
                value={createForm.dinh_kem.length > 0 ? createForm.dinh_kem.join(', ') : ''}
                onClick={() => document.getElementById('ticket-attachment-input')?.click()}
                className="w-full py-2.5 px-1 text-sm text-slate-800 placeholder:text-slate-500 bg-transparent focus:outline-none cursor-pointer"
              />
              <input
                id="ticket-attachment-input"
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []).map((f) => f.name);
                  if (files.length > 0) {
                    setCreateForm((prev) => ({
                      ...prev,
                      dinh_kem: [...prev.dinh_kem, ...files],
                    }));
                  }
                }}
              />
              <button
                type="button"
                onClick={() => document.getElementById('ticket-attachment-input')?.click()}
                className="text-slate-400 hover:text-blue-600 p-1 cursor-pointer"
                title="Tải tệp đính kèm"
              >
                <ImageIcon className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Khối 3: Đề xuất xử lý */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-bold text-slate-900">Đề xuất xử lý</h2>
          <div className="border-b border-slate-300">
            <input
              type="text"
              placeholder="Hình thức xử lý đề xuất"
              value={createForm.hinh_thuc_xu_ly}
              onChange={(e) => setCreateForm({ ...createForm, hinh_thuc_xu_ly: e.target.value })}
              className="w-full py-2.5 px-1 text-sm text-slate-800 placeholder:text-slate-500 bg-transparent focus:outline-none"
            />
          </div>
        </div>

        {/* 2 Nút hành động góc dưới bên phải chuẩn ảnh 3 */}
        <div className="flex items-center justify-end gap-3 pt-6">
          {/* Nút 1: Hủy thao tác (Bo tròn pill nền xanh chữ trắng) */}
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-semibold transition-all shadow-xs cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Hủy thao tác</span>
          </button>

          {/* Nút 2: Lưu biên bản (Bo tròn pill nền trắng viền xanh chữ xanh) */}
          <button
            type="button"
            onClick={handleSaveNewTicket}
            className="flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-sky-50 text-sky-500 border border-sky-400 rounded-full text-sm font-semibold transition-all shadow-2xs cursor-pointer"
          >
            <Save className="w-4 h-4 text-sky-500" />
            <span>Lưu biên bản</span>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: CHI TIẾT BIÊN BẢN (KHỚP 100% ẢNH 2)
  // =========================================================================
  if (viewMode === 'detail' && selectedViolation) {
    const v = selectedViolation;

    return (
      <div className="w-full bg-[#f4f5f7] rounded-2xl border border-slate-200/60 p-6 sm:p-8 flex flex-col gap-6 select-none">
        {/* Toast thông báo */}
        {toast && (
          <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-sm rounded-xl shadow-xl transition-all">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toast.message}</span>
          </div>
        )}

        {/* Header Chi tiết biên bản */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Nút quay lại & Tiêu đề */}
          <button
            type="button"
            onClick={handleBackToList}
            className="flex items-center gap-2 text-slate-900 hover:text-blue-600 transition-colors cursor-pointer text-left"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Chi tiết biên bản {v.ma_bb}
            </h1>
          </button>

          {/* Nút Cập nhật trạng thái */}
          <button
            type="button"
            onClick={() => setIsUpdateModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-semibold transition-all shadow-xs hover:shadow-md cursor-pointer shrink-0"
          >
            <Edit3 className="w-4 h-4" />
            <span>Cập nhật trạng thái</span>
          </button>
        </div>

        {/* Hàng thông tin tóm tắt: Trạng thái, Ngày lập, Người lập */}
        <div className="flex flex-wrap items-center gap-8 text-sm sm:text-base border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-900">Trạng thái:</span>
            <span className={`font-bold ${getStatusColorClass(v.trang_thai)}`}>
              {getStatusText(v.trang_thai)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-900">Ngày lập:</span>
            <span className="text-slate-700 font-medium">{v.ngay_lap}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-900">Người lập:</span>
            <span className="text-slate-700 font-medium">{v.nguoi_lap}</span>
          </div>
        </div>

        {/* 2 Cột: Thông tin sinh viên & Nội dung vi phạm */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cột 1: Thông tin sinh viên */}
          <div className="flex flex-col gap-2.5">
            <h2 className="text-base font-bold text-slate-900">Thông tin sinh viên</h2>
            <div className="flex flex-col gap-2">
              <div className="bg-white border border-slate-200/90 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs">
                <span className="font-medium">Họ và tên: </span>
                <span className="font-semibold">{v.ho_ten}</span>
              </div>
              <div className="bg-white border border-slate-200/90 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs">
                <span className="font-medium">Mã SV: </span>
                <span className="font-semibold">{v.msv}</span>
              </div>
              <div className="bg-white border border-slate-200/90 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs">
                <span className="font-medium">Phòng ở: </span>
                <span className="font-semibold">{v.phong_ngan || v.phong}</span>
              </div>
              <div className="bg-white border border-slate-200/90 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs">
                <span className="font-medium">Số điện thoại: </span>
                <span className="font-semibold">{v.sdt}</span>
              </div>
            </div>
          </div>

          {/* Cột 2: Nội dung vi phạm */}
          <div className="flex flex-col gap-2.5">
            <h2 className="text-base font-bold text-slate-900">Nội dung vi phạm</h2>
            <div className="flex flex-col gap-2">
              <div className="bg-white border border-slate-200/90 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs">
                <span className="font-medium">Nhóm vi phạm: </span>
                <span className="font-semibold">{v.nhom_vi_pham}</span>
              </div>
              <div className="bg-white border border-slate-200/90 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs">
                <span className="font-medium">Thời điểm: </span>
                <span className="font-semibold">{v.thoi_diem}</span>
              </div>
              <div className="bg-white border border-slate-200/90 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs">
                <span className="font-medium">Địa điểm: </span>
                <span className="font-semibold">{v.dia_diem}</span>
              </div>
              <div className="bg-white border border-slate-200/90 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs">
                <span className="font-medium">Số lần vi phạm lũy kế: </span>
                <span className="font-semibold">{v.so_lan_luy_ke}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Khối: Mô tả sự việc */}
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-bold text-slate-900">Mô tả sự việc</h2>
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 text-sm text-slate-700 leading-relaxed shadow-2xs">
            {v.mo_ta}
          </div>
        </div>

        {/* Khối: Bằng chứng ghi nhận */}
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-bold text-slate-900">Bằng chứng ghi nhận</h2>
          <div className="flex flex-wrap items-center gap-4">
            {v.bang_chung && v.bang_chung.length > 0 ? (
              v.bang_chung.map((file, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPreviewImageName(file)}
                  className="text-blue-500 hover:text-blue-700 font-medium text-sm hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-blue-500" />
                  <span>{file}</span>
                </button>
              ))
            ) : (
              <span className="text-sm text-slate-400 italic">Không có tài liệu đính kèm</span>
            )}
          </div>
        </div>

        {/* Khối: Cập nhật kết quả xử lý */}
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-bold text-slate-900">Cập nhật kết quả xử lý</h2>
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 text-sm flex flex-col gap-3 shadow-2xs divide-y divide-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 pb-1">
              <span className="text-slate-800 font-medium">Quyết định kỷ luật chính thức:</span>
              <span className="text-slate-600 font-semibold">{v.quyet_dinh || v.hinh_thuc_xu_ly}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4 pt-3">
              <span className="text-slate-800 font-medium shrink-0">Ghi chú bổ sung:</span>
              <span className="text-slate-500 text-right">{v.ghi_chu || 'Chưa có ghi chú thêm.'}</span>
            </div>
          </div>
        </div>

        {/* Khối: Trạng thái xử lý (3 Nút Lựa Chọn Theo Ảnh 2) */}
        <div className="flex flex-col gap-3 pt-2">
          <h2 className="text-base font-bold text-slate-900">Trạng thái xử lý:</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1. Chờ sinh viên giải trình */}
            <button
              type="button"
              onClick={() => handleQuickChangeSubStatus('CHO_GIAI_TRINH')}
              className={`py-3.5 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer text-center border ${
                v.sub_status === 'CHO_GIAI_TRINH'
                  ? 'bg-[#fff7ed] border-[#fbbf24] text-[#b45309] shadow-xs'
                  : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Chờ sinh viên giải trình
            </button>

            {/* 2. Đã xử lý dứt điểm */}
            <button
              type="button"
              onClick={() => handleQuickChangeSubStatus('DA_XU_LY_DUT_DIEM')}
              className={`py-3.5 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer text-center border ${
                v.sub_status === 'DA_XU_LY_DUT_DIEM'
                  ? 'bg-[#ecfdf5] border-[#10b981] text-[#047857] shadow-xs'
                  : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Đã xử lý dứt điểm
            </button>

            {/* 3. Chuyển lên cho hội đồng kỷ luật */}
            <button
              type="button"
              onClick={() => handleQuickChangeSubStatus('HOI_DONG_KY_LUAT')}
              className={`py-3.5 px-4 rounded-xl text-sm font-semibold transition-all cursor-pointer text-center border ${
                v.sub_status === 'HOI_DONG_KY_LUAT'
                  ? 'bg-[#fff1f2] border-[#f43f5e] text-[#be123c] shadow-xs'
                  : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Chuyển lên cho hội đồng kỷ luật
            </button>
          </div>
        </div>

        {/* Modal Cập nhật trạng thái */}
        {isUpdateModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900">
                  Cập nhật trạng thái biên bản {v.ma_bb}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsUpdateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveStatusModal} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Trạng thái chính
                  </label>
                  <select
                    value={editStatusData.trang_thai}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditStatusData((prev) => ({
                        ...prev,
                        trang_thai: val,
                        sub_status:
                          val === 'DA_XU_LY'
                            ? 'DA_XU_LY_DUT_DIEM'
                            : val === 'KHAN_CAP'
                            ? 'HOI_DONG_KY_LUAT'
                            : 'CHO_GIAI_TRINH',
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="CHO_XU_LY">Chờ xử lý</option>
                    <option value="DA_XU_LY">Đã xử lý</option>
                    <option value="KHAN_CAP">Khẩn cấp</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Giai đoạn xử lý
                  </label>
                  <select
                    value={editStatusData.sub_status}
                    onChange={(e) =>
                      setEditStatusData({ ...editStatusData, sub_status: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="CHO_GIAI_TRINH">Chờ sinh viên giải trình</option>
                    <option value="DA_XU_LY_DUT_DIEM">Đã xử lý dứt điểm</option>
                    <option value="HOI_DONG_KY_LUAT">Chuyển lên cho hội đồng kỷ luật</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Quyết định kỷ luật chính thức
                  </label>
                  <input
                    type="text"
                    value={editStatusData.quyet_dinh}
                    onChange={(e) =>
                      setEditStatusData({ ...editStatusData, quyet_dinh: e.target.value })
                    }
                    placeholder="Nhập hình thức kỷ luật..."
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Ghi chú bổ sung
                  </label>
                  <textarea
                    rows={3}
                    value={editStatusData.ghi_chu}
                    onChange={(e) =>
                      setEditStatusData({ ...editStatusData, ghi_chu: e.target.value })
                    }
                    placeholder="Ghi chú yêu cầu nộp kiểm điểm, liên hệ phụ huynh..."
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsUpdateModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition shadow-xs cursor-pointer"
                  >
                    Lưu cập nhật
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal xem trước ảnh bằng chứng */}
        {previewImageName && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="font-bold text-slate-800 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-blue-600" />
                  {previewImageName}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewImageName(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="w-full h-64 bg-slate-100 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-6 text-center text-slate-500 gap-2">
                <ImageIcon className="w-12 h-12 text-slate-400 stroke-[1.5]" />
                <p className="text-sm font-semibold text-slate-700">
                  Hình ảnh bằng chứng hiện trường
                </p>
                <p className="text-xs text-slate-400 max-w-xs">
                  File: {previewImageName} (Ghi nhận biên bản vi phạm KTX ICTU)
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setPreviewImageName(null)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: DANH SÁCH BIÊN BẢN VI PHẠM (KHỚP 100% ẢNH 1)
  // =========================================================================
  return (
    <div className="w-full bg-[#f4f5f7] rounded-2xl border border-slate-200/60 p-6 sm:p-8 flex flex-col gap-6 select-none">
      {/* Toast thông báo */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-sm rounded-xl shadow-xl transition-all">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Tiêu đề chính */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase">
          QUẢN LÝ VI PHẠM
        </h1>
      </div>

      {/* 3 Thẻ thống kê (Khớp 100% tỷ lệ & màu sắc trong ảnh 1) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        {/* Card 1: Tổng vụ vi phạm */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div className="text-[12px] font-bold text-slate-400 tracking-wider uppercase mb-2">
            TỔNG VỤ VI PHẠM KỲ NÀY
          </div>
          <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            {stats.totalDisplay} vụ
          </div>
        </div>

        {/* Card 2: Chờ xác nhận/xử lý (Chữ màu cam chuẩn) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div className="text-[12px] font-bold text-slate-400 tracking-wider uppercase mb-2">
            CHỜ XÁC NHẬN/XỬ LÝ
          </div>
          <div className="text-3xl sm:text-4xl font-black text-amber-500 tracking-tight">
            {stats.pendingDisplay} trường hợp
          </div>
        </div>

        {/* Card 3: Đã xử lý dứt điểm (Chữ màu xanh lá chuẩn) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div className="text-[12px] font-bold text-slate-400 tracking-wider uppercase mb-2">
            ĐÃ XỬ LÝ DỨT ĐIỂM
          </div>
          <div className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight">
            {stats.resolvedDisplay} trường hợp
          </div>
        </div>
      </div>

      {/* Thanh bộ lọc tabs và nút "+ Lập biên bản mới" */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Nhóm Tabs Lọc */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {/* Tất cả (12) */}
          <button
            type="button"
            onClick={() => {
              setFilterTab('ALL');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filterTab === 'ALL'
                ? 'bg-blue-100/90 text-blue-600 border border-blue-400/80 shadow-2xs'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            Tất cả (12)
          </button>

          {/* Khẩn cấp */}
          <button
            type="button"
            onClick={() => {
              setFilterTab('KHAN_CAP');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filterTab === 'KHAN_CAP'
                ? 'bg-rose-100 text-rose-700 border border-rose-400/80 shadow-2xs'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            Khẩn cấp
          </button>

          {/* Chờ xử lý */}
          <button
            type="button"
            onClick={() => {
              setFilterTab('CHO_XU_LY');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filterTab === 'CHO_XU_LY'
                ? 'bg-amber-100 text-amber-700 border border-amber-400/80 shadow-2xs'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            Chờ xử lý
          </button>

          {/* Đã xử lý */}
          <button
            type="button"
            onClick={() => {
              setFilterTab('DA_XU_LY');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filterTab === 'DA_XU_LY'
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-400/80 shadow-2xs'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            Đã xử lý
          </button>
        </div>

        {/* Nút Lập biên bản mới (Bấm vào chuyển sang View 3 "Lập biên bản mới" chuẩn 100% Ảnh 3) */}
        <button
          type="button"
          onClick={() => setViewMode('create')}
          className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-full border border-blue-500 text-blue-600 bg-white hover:bg-blue-50/80 text-sm font-semibold transition-colors shadow-2xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Lập biên bản mới</span>
        </button>
      </div>

      {/* Bảng danh sách biên bản (Table chuẩn theo ảnh 1: Căn đều, không vỡ dòng) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1050px] table-auto">
            {/* Header bảng: Nền xanh dương nhạt chuẩn bg-[#dbeafe], tất cả tiêu đề đều 1 dòng không gãy */}
            <thead>
              <tr className="bg-[#dbeafe] text-slate-900 text-sm font-bold border-b border-blue-200/50">
                <th className="py-3.5 px-5 whitespace-nowrap w-[130px]">Mã BB</th>
                <th className="py-3.5 px-4 whitespace-nowrap w-[140px]">Mã SV</th>
                <th className="py-3.5 px-4 whitespace-nowrap w-[160px]">Họ và tên</th>
                <th className="py-3.5 px-4 whitespace-nowrap w-[120px]">Phòng</th>
                <th className="py-3.5 px-4 whitespace-nowrap min-w-[280px]">Hành vi vi phạm</th>
                <th className="py-3.5 px-4 whitespace-nowrap min-w-[240px]">Hình thức xử lý</th>
                <th className="py-3.5 px-4 whitespace-nowrap text-center w-[120px]">Trạng thái</th>
                <th className="py-3.5 px-5 whitespace-nowrap text-right w-[100px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedViolations.length > 0 ? (
                paginatedViolations.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    {/* Mã BB */}
                    <td className="py-4 px-5 font-bold text-slate-900 whitespace-nowrap">
                      {row.ma_bb}
                    </td>

                    {/* Mã SV */}
                    <td className="py-4 px-4 font-mono font-medium text-slate-600 whitespace-nowrap">
                      {row.msv}
                    </td>

                    {/* Họ và tên */}
                    <td className="py-4 px-4 font-medium text-slate-800 whitespace-nowrap">
                      {row.ho_ten}
                    </td>

                    {/* Phòng */}
                    <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
                      {row.phong}
                    </td>

                    {/* Hành vi vi phạm - Căn đều, rộng rãi, hiển thị gọn gàng 1-2 dòng không bị gãy từng từ */}
                    <td className="py-4 px-4 text-slate-600 min-w-[280px] max-w-[340px] leading-relaxed">
                      <div className="line-clamp-2" title={row.hanh_vi}>
                        {row.hanh_vi}
                      </div>
                    </td>

                    {/* Hình thức xử lý - Căn đều, thoáng đãng */}
                    <td className="py-4 px-4 text-slate-600 min-w-[240px] max-w-[300px] leading-relaxed">
                      <div className="line-clamp-2" title={row.hinh_thuc_xu_ly}>
                        {row.hinh_thuc_xu_ly}
                      </div>
                    </td>

                    {/* Trạng thái */}
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      {renderStatusBadge(row.trang_thai)}
                    </td>

                    {/* Link xem chi tiết */}
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleViewDetail(row)}
                        className="text-blue-500 hover:text-blue-700 hover:underline text-xs font-semibold cursor-pointer"
                      >
                        xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Không tìm thấy biên bản vi phạm nào phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang (Pagination) ở chân bảng (Chỉ hiển thị khi có từ 2 trang trở lên, khi chưa đầy 1 trang thì không hiện chuyển trang) */}
        {totalPages > 1 && (
          <div className="py-4 px-6 border-t border-slate-100 flex items-center justify-center gap-1.5 select-none">
            {/* Nút lùi */}
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="w-8 h-8 rounded-lg border border-slate-200/90 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
              aria-label="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Các số trang động */}
            {getPaginationItems(currentPage, totalPages).map((item, idx) => {
              if (item === '...') {
                return (
                  <span key={`dots-${idx}`} className="w-6 text-center text-slate-400 text-sm select-none">
                    ...
                  </span>
                );
              }
              const isActive = currentPage === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCurrentPage(item)}
                  className={`w-8 h-8 rounded-lg border text-sm font-semibold transition cursor-pointer ${
                    isActive
                      ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                      : 'border-slate-200/90 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item}
                </button>
              );
            })}

            {/* Nút tiến */}
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="w-8 h-8 rounded-lg border border-slate-200/90 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
              aria-label="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
