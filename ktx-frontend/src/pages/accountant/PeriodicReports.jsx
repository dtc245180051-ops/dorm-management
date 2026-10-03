import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText,
  BarChart3,
  Calendar,
  Filter,
  Search,
  Download,
  Printer,
  History,
  Plus,
  RefreshCw,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building,
  Zap,
  Bed,
  Check,
  X,
  Trash2,
  Eye,
  FileSpreadsheet,
  TrendingUp,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import financeService from '../../services/financeService';
import './PeriodicReports.css';

/**
 * Định dạng tiền VND đẹp
 */
const formatVND = (value) => {
  if (value === null || value === undefined) return '0 ₫';
  return Number(value).toLocaleString('vi-VN') + ' ₫';
};

/**
 * Component Quản lý & Lập Báo cáo Thống kê định kỳ dành cho Kế toán iDORM
 */
export default function PeriodicReports({ searchTerm: parentSearch = '' }) {
  const [periods, setPeriods] = useState(['Tháng 09/2026', 'Tháng 10/2026']);
  const [selectedPeriod, setSelectedPeriod] = useState('Tháng 09/2026');
  const [selectedFeeType, setSelectedFeeType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState(parentSearch || '');

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState({
    summary: {
      totalInvoiced: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      totalOverdue: 0,
      roomRevenueStandard: 0,
      roomRevenueService: 0,
      utilityRevenue: 0,
      collectionRate: 0,
      invoiceCount: 0,
      paidInvoiceCount: 0,
      unpaidStudentsCount: 0,
    },
    items: [],
  });

  // Quản lý Modal & Lịch sử báo cáo
  const [savedReports, setSavedReports] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedHistoricalReport, setSelectedHistoricalReport] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Form Lập báo cáo định kỳ
  const [formData, setFormData] = useState({
    reportCode: '',
    title: '',
    period: 'Tháng 09/2026',
    reportType: 'THANG',
    creatorName: localStorage.getItem('ktx_fullname') || localStorage.getItem('ktx_username') || 'KT_Hoa (Nguyễn Thị Hoa)',
    approverName: 'Ban Giám Đốc / Trưởng BQL KTX',
    createdDate: new Date().toISOString().split('T')[0],
    notes: '',
    recommendations: '',
  });

  // Tải danh sách kỳ từ Backend
  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        const periodList = await financeService.getPeriods();
        if (Array.isArray(periodList) && periodList.length > 0) {
          setPeriods(periodList);
          if (!periodList.includes(selectedPeriod)) {
            setSelectedPeriod(periodList[0]);
          }
        }
      } catch (err) {
        console.error('Lỗi tải danh sách kỳ:', err);
      }
    };
    fetchPeriods();
  }, []);

  // Tải dữ liệu báo cáo theo bộ lọc
  const loadReportData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeService.getFinancialReport({
        period: selectedPeriod,
        feeType: selectedFeeType,
        status: selectedStatus,
        keyword: searchTerm,
      });
      if (res && res.data) {
        setReportData(res.data);
      }
    } catch (err) {
      console.error('Lỗi tải báo cáo tài chính:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedFeeType, selectedStatus, searchTerm]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  // Tải lịch sử báo cáo đã lưu
  const loadSavedReports = async () => {
    try {
      const res = await financeService.getPeriodicReports();
      if (res && res.data) {
        setSavedReports(res.data);
      }
    } catch (err) {
      console.error('Lỗi tải lịch sử báo cáo:', err);
    }
  };

  useEffect(() => {
    loadSavedReports();
  }, []);

  // Mở modal tạo báo cáo định kỳ với dữ liệu gợi ý thông minh
  const handleOpenCreateModal = () => {
    const curYear = new Date().getFullYear();
    const curMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const autoCode = `BC-TC/${curYear}/${curMonth}-${(savedReports.length + 1).toString().padStart(2, '0')}`;
    const autoTitle = `Báo cáo thống kê quyết toán thu phí & công nợ ${selectedPeriod === 'ALL' ? 'Toàn bộ các kỳ' : selectedPeriod}`;

    // Tự sinh nội dung nhận xét & kiến nghị dựa trên số liệu thực tế
    const summary = reportData.summary;
    const rate = summary.collectionRate || 0;
    const autoNotes = `1. Trong ${selectedPeriod}, tổng kinh phí phát hành đạt ${formatVND(summary.totalInvoiced)}, đã thực thu vào quỹ ${formatVND(summary.totalCollected)}, đạt tỷ lệ hoàn thành ${rate}%.\n2. Tổng công nợ tồn đọng hiện tại là ${formatVND(summary.totalOutstanding)} với ${summary.unpaidStudentsCount} sinh viên chưa hoàn thành nghĩa vụ. Trong đó có ${formatVND(summary.totalOverdue)} nợ quá hạn cảnh báo.`;
    const autoRecs = `1. Bộ phận kế toán phối hợp cùng ban quản lý tòa nhà gửi thông báo nhắc nợ đợt 2 qua SMS & Zalo đối với các phòng chưa nộp.\n2. Tạm khóa thẻ ra vào đối với các sinh viên nợ quá hạn chưa thanh toán sau hạn chót thỏa thuận.\n3. Đẩy mạnh hướng dẫn sinh viên thanh toán quét mã QR VietQR tự động để hoàn tất đối soát 100%.`;

    setFormData({
      reportCode: autoCode,
      title: autoTitle,
      period: selectedPeriod,
      reportType: selectedPeriod.includes('Quý') ? 'QUY' : (selectedPeriod.includes('Năm') ? 'NAM' : 'THANG'),
      creatorName: localStorage.getItem('ktx_fullname') || localStorage.getItem('ktx_username') || 'KT_Hoa (Nguyễn Thị Hoa)',
      approverName: 'Ban Giám Đốc / Trưởng BQL KTX',
      createdDate: new Date().toISOString().split('T')[0],
      notes: autoNotes,
      recommendations: autoRecs,
    });
    setShowCreateModal(true);
  };

  // Lưu biên bản báo cáo
  const handleSaveReport = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        summary: reportData.summary,
        items: reportData.items.slice(0, 50),
      };
      await financeService.createPeriodicReport(payload);
      setShowCreateModal(false);
      loadSavedReports();
      alert('Đã lưu biên bản báo cáo thống kê định kỳ thành công!');
    } catch (err) {
      console.error('Lỗi khi lưu báo cáo:', err);
      alert('Có lỗi khi lưu báo cáo, vui lòng kiểm tra lại!');
    }
  };

  // Xóa báo cáo đã lưu
  const handleDeleteReport = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa bản ghi báo cáo này khỏi lịch sử?')) {
      await financeService.deletePeriodicReport(id);
      loadSavedReports();
    }
  };

  // Xuất file Excel (.csv UTF-8 BOM chuẩn tiếng Việt có dấu)
  const handleExportExcel = () => {
    const summary = reportData.summary;
    const items = reportData.items;

    let csvContent = '\uFEFF'; // UTF-8 BOM để Excel hiển thị đúng tiếng Việt

    // Tiêu đề & Thông tin chung
    csvContent += 'BÁO CÁO THỐNG KÊ QUYẾT TOÁN THU PHÍ & CÔNG NỢ KÝ TÚC XÁ iDORM\n';
    csvContent += `Kỳ báo cáo:,"${selectedPeriod}"\n`;
    csvContent += `Ngày xuất báo cáo:,"${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}"\n`;
    csvContent += `Người xuất:,"${formData.creatorName}"\n\n`;

    // Phần tổng hợp số liệu KPI
    csvContent += 'I. TỔNG HỢP SỐ LIỆU TÀI CHÍNH\n';
    csvContent += 'Chỉ tiêu,Số tiền (VNĐ),Ghi chú\n';
    csvContent += `Tổng doanh thu phát hành,${summary.totalInvoiced},Tổng tất cả hóa đơn\n`;
    csvContent += `Đã thực thu quỹ,${summary.totalCollected},Tỷ lệ đạt ${summary.collectionRate}%\n`;
    csvContent += `Công nợ tồn đọng,${summary.totalOutstanding},${summary.unpaidStudentsCount} sinh viên chưa nộp\n`;
    csvContent += `Tổng nợ quá hạn cảnh báo,${summary.totalOverdue},Cần đôn đốc khẩn cấp\n`;
    csvContent += `Thu tiền phòng tiêu chuẩn (350k),${summary.roomRevenueStandard},\n`;
    csvContent += `Thu tiền phòng dịch vụ (650k),${summary.roomRevenueService},\n`;
    csvContent += `Thu tiền điện nước sinh hoạt,${summary.utilityRevenue},\n\n`;

    // Phần bảng kê chi tiết chứng từ
    csvContent += 'II. BẢNG KÊ CHI TIẾT CHỨNG TỪ THU VÀ CÔNG NỢ\n';
    csvContent += 'STT,Mã hóa đơn,Mã sinh viên,Họ và tên,Phòng,Loại phòng,Khoản mục,Kỳ thu,Số tiền,Đã thu,Còn nợ,Trạng thái,Ngày phát hành,Hạn thanh toán\n';

    items.forEach((item, index) => {
      csvContent += `${index + 1},"${item.invoiceId}","${item.studentId || ''}","${item.studentName || ''}","${item.room || ''}","${item.roomType || ''}","${item.feeType || ''}","${item.period || ''}",${item.amount},${item.paid},${item.remaining},"${item.statusText || ''}","${item.issueDate || ''}","${item.dueDate || ''}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safePeriod = selectedPeriod.replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `BaoCao_ThongKe_KTX_${safePeriod}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // In báo cáo (Window.print)
  const handlePrint = () => {
    window.print();
  };

  // Dữ liệu phân trang bảng
  const filteredItems = useMemo(() => {
    return reportData.items || [];
  }, [reportData.items]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const currentItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  return (
    <div className="rep-container">
      {/* ========================================================================= */}
      {/* 1. HEADER CHÍNH CỦA TRANG BÁO CÁO THỐNG KÊ */}
      {/* ========================================================================= */}
      <div className="rep-header">
        <div className="rep-title-group">
          <h1>
            <BarChart3 className="w-7 h-7 text-blue-600" />
            <span>Báo cáo & Thống kê định kỳ</span>
            <span className="rep-title-badge">Phòng Kế Toán</span>
          </h1>
          <p className="rep-subtitle">
            Lập báo cáo quyết toán tài chính, công nợ sinh viên, tiến độ thu phí theo tháng / quý và xuất hồ sơ kế toán
          </p>
        </div>

        {/* Cụm nút hành động chính */}
        <div className="rep-actions-group">
          <button
            type="button"
            className="rep-btn rep-btn-primary"
            onClick={handleOpenCreateModal}
          >
            <Plus className="w-4 h-4" />
            <span>Lập báo cáo định kỳ</span>
          </button>

          <button
            type="button"
            className="rep-btn rep-btn-success"
            onClick={handleExportExcel}
            title="Xuất bảng kê chi tiết ra file Excel / CSV"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel</span>
          </button>

          <button
            type="button"
            className="rep-btn rep-btn-secondary"
            onClick={handlePrint}
            title="In văn bản báo cáo hành chính chuẩn khổ A4"
          >
            <Printer className="w-4 h-4" />
            <span>In báo cáo A4</span>
          </button>

          <button
            type="button"
            className="rep-btn rep-btn-indigo"
            onClick={() => {
              loadSavedReports();
              setShowHistoryModal(true);
            }}
            title="Xem các biên bản báo cáo đã lưu trong hệ thống"
          >
            <History className="w-4 h-4" />
            <span>Lịch sử báo cáo ({savedReports.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. THANH BỘ LỌC ĐỊNH KỲ (FILTER TOOLBAR) */}
      {/* ========================================================================= */}
      <div className="rep-toolbar">
        <div className="rep-filters-left">
          {/* Lọc theo kỳ */}
          <div className="rep-filter-group">
            <span className="rep-filter-label">
              <Calendar className="w-4 h-4 inline mr-1 text-slate-500" />
              Kỳ thu:
            </span>
            <select
              className="rep-select"
              value={selectedPeriod}
              onChange={(e) => {
                setSelectedPeriod(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">-- Tất cả các kỳ --</option>
              {periods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value="Quý 3/2026">Quý 3/2026</option>
              <option value="Năm 2026">Cả năm 2026</option>
            </select>
          </div>

          {/* Lọc theo loại phí */}
          <div className="rep-filter-group">
            <span className="rep-filter-label">Loại phí:</span>
            <select
              className="rep-select"
              value={selectedFeeType}
              onChange={(e) => {
                setSelectedFeeType(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">Tất cả khoản thu</option>
              <option value="TIEN_PHONG">Tiền phòng ở</option>
              <option value="DIEN_NUOC">Tiền điện nước</option>
            </select>
          </div>

          {/* Lọc theo trạng thái */}
          <div className="rep-filter-group">
            <span className="rep-filter-label">Trạng thái:</span>
            <select
              className="rep-select"
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PAID">Đã thu hoàn tất</option>
              <option value="UNPAID">Còn nợ / Chưa nộp</option>
              <option value="OVERDUE">Quá hạn cảnh báo</option>
            </select>
          </div>
        </div>

        {/* Tìm kiếm và nút Refresh */}
        <div className="flex items-center gap-3">
          <div className="rep-search-box">
            <Search className="w-4 h-4 rep-search-icon" />
            <input
              type="text"
              className="rep-search-input"
              placeholder="Mã SV, họ tên, phòng, mã HĐ..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <button
            type="button"
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            onClick={loadReportData}
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. 4 THẺ CHỈ SỐ THỐNG KÊ (KPI CARDS) CHO KỲ ĐƯỢC CHỌN */}
      {/* ========================================================================= */}
      <div className="rep-kpi-grid">
        {/* Thẻ 1: Doanh thu phát sinh */}
        <div className="rep-kpi-card rep-kpi-blue">
          <div className="rep-kpi-header">
            <span className="rep-kpi-title">Doanh thu phát hành</span>
            <div className="rep-kpi-icon-wrap">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="rep-kpi-value">
            {formatVND(reportData.summary.totalInvoiced)}
          </div>
          <div className="rep-kpi-sub text-slate-500">
            <span>Tổng {reportData.summary.invoiceCount} hóa đơn lập</span>
            <span className="font-semibold text-blue-600">{selectedPeriod}</span>
          </div>
        </div>

        {/* Thẻ 2: Đã thực thu */}
        <div className="rep-kpi-card rep-kpi-emerald">
          <div className="rep-kpi-header">
            <span className="rep-kpi-title">Thực thu quỹ KTX</span>
            <div className="rep-kpi-icon-wrap">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="rep-kpi-value">
            {formatVND(reportData.summary.totalCollected)}
          </div>
          <div className="rep-kpi-sub">
            <span className="text-slate-500">Tỷ lệ thu đạt:</span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {reportData.summary.collectionRate}%
            </span>
          </div>
        </div>

        {/* Thẻ 3: Công nợ tồn đọng */}
        <div className="rep-kpi-card rep-kpi-rose">
          <div className="rep-kpi-header">
            <span className="rep-kpi-title">Công nợ tồn đọng</span>
            <div className="rep-kpi-icon-wrap">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="rep-kpi-value">
            {formatVND(reportData.summary.totalOutstanding)}
          </div>
          <div className="rep-kpi-sub">
            <span className="text-slate-500">Sinh viên còn nợ:</span>
            <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
              {reportData.summary.unpaidStudentsCount} SV
            </span>
          </div>
        </div>

        {/* Thẻ 4: Cảnh báo quá hạn */}
        <div className="rep-kpi-card rep-kpi-amber">
          <div className="rep-kpi-header">
            <span className="rep-kpi-title">Nợ quá hạn</span>
            <div className="rep-kpi-icon-wrap">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="rep-kpi-value">
            {formatVND(reportData.summary.totalOverdue)}
          </div>
          <div className="rep-kpi-sub">
            <span className="text-slate-500">Cần đôn đốc:</span>
            <span className="font-semibold text-amber-700">Khẩn cấp</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. PHÂN TÍCH CƠ CẤU DOANH THU THEO KHOẢN MỤC */}
      {/* ========================================================================= */}
      <div className="rep-breakdown-card">
        <div className="rep-breakdown-header">
          <div className="rep-breakdown-title">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span>Cơ cấu doanh thu theo loại hình thu phí trong kỳ ({selectedPeriod})</span>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Tổng cộng: {formatVND(reportData.summary.totalInvoiced)}
          </span>
        </div>

        <div className="rep-breakdown-grid">
          {/* Phòng tiêu chuẩn (350k) */}
          <div className="rep-breakdown-item">
            <div className="rep-breakdown-item-label">
              <Bed className="w-4 h-4 text-blue-500" />
              <span>Tiền phòng tiêu chuẩn (350.000 đ/tháng)</span>
            </div>
            <div className="rep-breakdown-item-value">
              {formatVND(reportData.summary.roomRevenueStandard)}
            </div>
            <div className="rep-breakdown-progress-bar">
              <div
                className="rep-breakdown-progress-fill bg-blue-500"
                style={{
                  width: `${reportData.summary.totalInvoiced > 0 ? (reportData.summary.roomRevenueStandard / reportData.summary.totalInvoiced) * 100 : 0}%`,
                }}
              ></div>
            </div>
          </div>

          {/* Phòng dịch vụ (650k) */}
          <div className="rep-breakdown-item">
            <div className="rep-breakdown-item-label">
              <Building className="w-4 h-4 text-purple-500" />
              <span>Tiền phòng dịch vụ (650.000 đ/tháng)</span>
            </div>
            <div className="rep-breakdown-item-value">
              {formatVND(reportData.summary.roomRevenueService)}
            </div>
            <div className="rep-breakdown-progress-bar">
              <div
                className="rep-breakdown-progress-fill bg-purple-500"
                style={{
                  width: `${reportData.summary.totalInvoiced > 0 ? (reportData.summary.roomRevenueService / reportData.summary.totalInvoiced) * 100 : 0}%`,
                }}
              ></div>
            </div>
          </div>

          {/* Tiền điện nước */}
          <div className="rep-breakdown-item">
            <div className="rep-breakdown-item-label">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Tiền điện nước sinh hoạt</span>
            </div>
            <div className="rep-breakdown-item-value">
              {formatVND(reportData.summary.utilityRevenue)}
            </div>
            <div className="rep-breakdown-progress-bar">
              <div
                className="rep-breakdown-progress-fill bg-amber-500"
                style={{
                  width: `${reportData.summary.totalInvoiced > 0 ? (reportData.summary.utilityRevenue / reportData.summary.totalInvoiced) * 100 : 0}%`,
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. BẢNG KÊ CHI TIẾT CHỨNG TỪ THU & CÔNG NỢ */}
      {/* ========================================================================= */}
      <div className="rep-table-card">
        <div className="rep-table-header">
          <div className="flex items-center gap-3">
            <span className="rep-table-title">Bảng kê chi tiết chứng từ thu phí & công nợ</span>
            <span className="rep-table-count">{filteredItems.length} bản ghi</span>
          </div>
          <div className="text-xs text-slate-500">
            Hiển thị trang {currentPage} / {totalPages}
          </div>
        </div>

        <div className="rep-table-wrapper">
          <table className="rep-table">
            <thead>
              <tr>
                <th>Mã HĐ</th>
                <th>Sinh viên</th>
                <th>Phòng</th>
                <th>Khoản mục</th>
                <th>Kỳ thu</th>
                <th className="text-right">Số tiền</th>
                <th className="text-right">Đã thu</th>
                <th className="text-right">Còn nợ</th>
                <th className="text-center">Trạng thái</th>
                <th>Hạn nộp</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-8 text-slate-400">
                    Không tìm thấy chứng từ nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                currentItems.map((row) => (
                  <tr key={row.invoiceId}>
                    <td className="font-semibold text-blue-600">{row.invoiceId}</td>
                    <td>
                      <div className="font-medium text-slate-900">{row.studentName}</div>
                      {row.studentId && (
                        <div className="text-xs text-slate-500">{row.studentId}</div>
                      )}
                    </td>
                    <td>
                      <span className="font-semibold text-slate-800">{row.room}</span>
                      <div className="text-xs text-slate-500">{row.roomType}</div>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1">
                        {row.feeType === 'Điện nước' ? (
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <Bed className="w-3.5 h-3.5 text-blue-500" />
                        )}
                        <span>{row.feeType}</span>
                      </span>
                    </td>
                    <td className="text-slate-600 text-xs">{row.period}</td>
                    <td className="text-right font-medium text-slate-900">
                      {formatVND(row.amount)}
                    </td>
                    <td className="text-right font-semibold text-emerald-600">
                      {formatVND(row.paid)}
                    </td>
                    <td className="text-right font-bold text-rose-600">
                      {formatVND(row.remaining)}
                    </td>
                    <td className="text-center">
                      {row.status === 'PAID' && (
                        <span className="rep-badge rep-badge-paid">
                          <Check className="w-3 h-3" />
                          <span>Đã thu</span>
                        </span>
                      )}
                      {row.status === 'UNPAID' && (
                        <span className="rep-badge rep-badge-unpaid">
                          <span>Chưa nộp</span>
                        </span>
                      )}
                      {row.status === 'OVERDUE' && (
                        <span className="rep-badge rep-badge-overdue">
                          <AlertCircle className="w-3 h-3" />
                          <span>Quá hạn</span>
                        </span>
                      )}
                      {row.status === 'PARTIAL' && (
                        <span className="rep-badge rep-badge-partial">
                          <span>Thiếu tiền</span>
                        </span>
                      )}
                    </td>
                    <td className="text-xs text-slate-500">{row.dueDate || '--'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Hiển thị {(currentPage - 1) * itemsPerPage + 1} -{' '}
              {Math.min(currentPage * itemsPerPage, filteredItems.length)} trên tổng{' '}
              {filteredItems.length}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  className={`w-8 h-8 rounded-lg text-xs font-semibold cursor-pointer ${
                    currentPage === page
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. MODAL LẬP BIÊN BẢN BÁO CÁO ĐỊNH KỲ (GENERATE REPORT MODAL) */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="rep-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="rep-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rep-modal-header">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="rep-modal-title">Lập biên bản báo cáo thống kê định kỳ</h3>
              </div>
              <button
                type="button"
                className="rep-modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReport}>
              <div className="rep-modal-body">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rep-form-group">
                    <label className="rep-form-label">Mã số hiệu biên bản *</label>
                    <input
                      type="text"
                      className="rep-form-input font-semibold"
                      value={formData.reportCode}
                      onChange={(e) =>
                        setFormData({ ...formData, reportCode: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="rep-form-group">
                    <label className="rep-form-label">Kỳ báo cáo *</label>
                    <input
                      type="text"
                      className="rep-form-input"
                      value={formData.period}
                      onChange={(e) =>
                        setFormData({ ...formData, period: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                <div className="rep-form-group">
                  <label className="rep-form-label">Tiêu đề báo cáo *</label>
                  <input
                    type="text"
                    className="rep-form-input font-medium"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rep-form-group">
                    <label className="rep-form-label">Loại báo cáo</label>
                    <select
                      className="rep-form-select"
                      value={formData.reportType}
                      onChange={(e) =>
                        setFormData({ ...formData, reportType: e.target.value })
                      }
                    >
                      <option value="THANG">Báo cáo Tháng</option>
                      <option value="QUY">Báo cáo Quý</option>
                      <option value="NAM">Báo cáo Năm</option>
                      <option value="DOT_XUAT">Báo cáo Đột xuất</option>
                    </select>
                  </div>

                  <div className="rep-form-group">
                    <label className="rep-form-label">Người lập biểu</label>
                    <input
                      type="text"
                      className="rep-form-input"
                      value={formData.creatorName}
                      onChange={(e) =>
                        setFormData({ ...formData, creatorName: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="rep-form-group">
                    <label className="rep-form-label">Người duyệt</label>
                    <input
                      type="text"
                      className="rep-form-input"
                      value={formData.approverName}
                      onChange={(e) =>
                        setFormData({ ...formData, approverName: e.target.value })
                      }
                    />
                  </div>
                </div>

                {/* Bảng tóm tắt số liệu tự động nạp */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Số liệu tự động tổng hợp từ kỳ: {formData.period}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Phát hành:</span>
                      <div className="font-bold text-slate-800">
                        {formatVND(reportData.summary.totalInvoiced)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Thực thu:</span>
                      <div className="font-bold text-emerald-600">
                        {formatVND(reportData.summary.totalCollected)} ({reportData.summary.collectionRate}%)
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Còn nợ:</span>
                      <div className="font-bold text-rose-600">
                        {formatVND(reportData.summary.totalOutstanding)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">SV chưa đóng:</span>
                      <div className="font-bold text-rose-600">
                        {reportData.summary.unpaidStudentsCount} SV
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rep-form-group">
                  <label className="rep-form-label">Tình hình thực hiện & Nhận xét đánh giá</label>
                  <textarea
                    className="rep-form-textarea"
                    rows={4}
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Ghi nhận tỷ lệ thu phí, phòng còn tồn đọng nợ..."
                  />
                </div>

                <div className="rep-form-group">
                  <label className="rep-form-label">Kiến nghị & Giải pháp thu hồi công nợ</label>
                  <textarea
                    className="rep-form-textarea"
                    rows={3}
                    value={formData.recommendations}
                    onChange={(e) =>
                      setFormData({ ...formData, recommendations: e.target.value })
                    }
                    placeholder="Đề xuất gửi thông báo đôn đốc, phân công quản lý kiểm tra..."
                  />
                </div>
              </div>

              <div className="rep-modal-footer">
                <button
                  type="button"
                  className="rep-btn rep-btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="rep-btn rep-btn-primary">
                  <Check className="w-4 h-4" />
                  <span>Lưu biên bản báo cáo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL LỊCH SỬ CÁC BÁO CÁO ĐÃ LƯU */}
      {/* ========================================================================= */}
      {showHistoryModal && (
        <div className="rep-modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="rep-modal max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="rep-modal-header">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <h3 className="rep-modal-title">Danh sách biên bản báo cáo đã lưu</h3>
              </div>
              <button
                type="button"
                className="rep-modal-close"
                onClick={() => setShowHistoryModal(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rep-modal-body p-0">
              {savedReports.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  Chưa có biên bản báo cáo định kỳ nào được lưu trong hệ thống.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="rep-table">
                    <thead>
                      <tr>
                        <th>Mã biên bản</th>
                        <th>Tiêu đề báo cáo</th>
                        <th>Kỳ</th>
                        <th>Người lập</th>
                        <th className="text-right">Thực thu</th>
                        <th className="text-right">Công nợ</th>
                        <th className="text-center">SV nợ</th>
                        <th>Ngày lập</th>
                        <th className="text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {savedReports.map((r) => (
                        <tr key={r.id}>
                          <td className="font-bold text-indigo-600">{r.reportCode}</td>
                          <td className="font-medium text-slate-900">{r.title}</td>
                          <td>
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">
                              {r.period}
                            </span>
                          </td>
                          <td className="text-xs text-slate-600">{r.creatorName}</td>
                          <td className="text-right font-semibold text-emerald-600">
                            {formatVND(r.totalCollected)}
                          </td>
                          <td className="text-right font-bold text-rose-600">
                            {formatVND(r.totalOutstanding)}
                          </td>
                          <td className="text-center font-semibold text-rose-600">
                            {r.unpaidStudentsCount} SV
                          </td>
                          <td className="text-xs text-slate-500">{r.createdDate}</td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="In biên bản này"
                                onClick={() => {
                                  setSelectedPeriod(r.period);
                                  setShowHistoryModal(false);
                                  setTimeout(() => window.print(), 300);
                                }}
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded"
                                title="Xóa biên bản này"
                                onClick={() => handleDeleteReport(r.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rep-modal-footer">
              <button
                type="button"
                className="rep-btn rep-btn-secondary"
                onClick={() => setShowHistoryModal(false)}
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MẪU VĂN BẢN IN HÀNH CHÍNH KHỔ A4 (DÀNH CHO WINDOW.PRINT) */}
      {/* ========================================================================= */}
      <div className="rep-print-container">
        {/* Header hành chính chuẩn */}
        <div className="print-page-header">
          <div className="print-left-header">
            <strong>TRƯỜNG ĐẠI HỌC KỸ THUẬT</strong>
            <br />
            <strong>BAN QUẢN LÝ KÝ TÚC XÁ iDORM</strong>
            <br />
            <span>Số: {formData.reportCode || 'BC-TC/2026/09'}</span>
          </div>
          <div className="print-right-header">
            <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong>
            <br />
            <span style={{ textDecoration: 'underline' }}>Độc lập - Tự do - Hạnh phúc</span>
            <br />
            <span style={{ fontStyle: 'italic', fontSize: '11pt' }}>
              Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
            </span>
          </div>
        </div>

        <div className="print-title">
          BÁO CÁO THỐNG KÊ QUYẾT TOÁN THU PHÍ & CÔNG NỢ KÝ TÚC XÁ
        </div>
        <div className="print-subtitle">
          (Kỳ: {selectedPeriod === 'ALL' ? 'Toàn bộ năm học 2026' : selectedPeriod} - Bộ phận Kế toán tài chính)
        </div>

        {/* I. BẢNG TỔNG HỢP SỐ LIỆU TÀI CHÍNH */}
        <div style={{ fontWeight: 'bold', margin: '15px 0 6px 0' }}>
          I. TỔNG HỢP CHỈ SỐ TÀI CHÍNH TRONG KỲ
        </div>
        <table className="print-table">
          <thead>
            <tr style={{ background: '#f2f2f2' }}>
              <th style={{ width: '8%' }}>STT</th>
              <th style={{ width: '45%' }}>Chỉ tiêu tài chính</th>
              <th style={{ width: '27%', textAlign: 'right' }}>Số tiền (VNĐ)</th>
              <th style={{ width: '20%' }}>Ghi chú / Tỷ lệ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ textAlign: 'center' }}>1</td>
              <td>Tổng doanh thu phát hành theo hóa đơn</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                {formatVND(reportData.summary.totalInvoiced)}
              </td>
              <td>{reportData.summary.invoiceCount} hóa đơn</td>
            </tr>
            <tr>
              <td style={{ textAlign: 'center' }}>2</td>
              <td>Đã thực thu vào tài khoản / quỹ KTX</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                {formatVND(reportData.summary.totalCollected)}
              </td>
              <td>Tỷ lệ đạt {reportData.summary.collectionRate}%</td>
            </tr>
            <tr>
              <td style={{ textAlign: 'center' }}>3</td>
              <td>Tổng công nợ tồn đọng</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                {formatVND(reportData.summary.totalOutstanding)}
              </td>
              <td>{reportData.summary.unpaidStudentsCount} sinh viên còn nợ</td>
            </tr>
            <tr>
              <td style={{ textAlign: 'center' }}>4</td>
              <td>Trong đó: Nợ quá hạn cảnh báo</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'red' }}>
                {formatVND(reportData.summary.totalOverdue)}
              </td>
              <td>Cần đôn đốc</td>
            </tr>
            <tr>
              <td style={{ textAlign: 'center' }}>5</td>
              <td>Doanh thu Tiền phòng tiêu chuẩn (350.000 đ/tháng)</td>
              <td style={{ textAlign: 'right' }}>
                {formatVND(reportData.summary.roomRevenueStandard)}
              </td>
              <td>Phòng tiêu chuẩn</td>
            </tr>
            <tr>
              <td style={{ textAlign: 'center' }}>6</td>
              <td>Doanh thu Tiền phòng dịch vụ (650.000 đ/tháng)</td>
              <td style={{ textAlign: 'right' }}>
                {formatVND(reportData.summary.roomRevenueService)}
              </td>
              <td>Phòng dịch vụ cao cấp</td>
            </tr>
            <tr>
              <td style={{ textAlign: 'center' }}>7</td>
              <td>Doanh thu Tiền điện nước sinh hoạt</td>
              <td style={{ textAlign: 'right' }}>
                {formatVND(reportData.summary.utilityRevenue)}
              </td>
              <td>Theo chỉ số công tơ</td>
            </tr>
          </tbody>
        </table>

        {/* II. TÌNH HÌNH THỰC HIỆN VÀ NHẬN XÉT */}
        <div style={{ fontWeight: 'bold', margin: '20px 0 6px 0' }}>
          II. ĐÁNH GIÁ TÌNH HÌNH VÀ KIẾN NGHỊ THU HỒI CÔNG NỢ
        </div>
        <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6', margin: '6px 0 16px 0' }}>
          {formData.notes || `Trong kỳ ${selectedPeriod}, tiến độ thu phí đạt ${reportData.summary.collectionRate}%. Còn ${reportData.summary.unpaidStudentsCount} sinh viên chưa hoàn thành thanh toán với tổng công nợ tồn đọng là ${formatVND(reportData.summary.totalOutstanding)}.`}
        </div>

        <div style={{ fontWeight: 'bold', margin: '10px 0 4px 0' }}>Đề xuất giải pháp:</div>
        <div style={{ whiteSpace: 'pre-line', lineHeight: '1.6', margin: '4px 0 20px 0' }}>
          {formData.recommendations || 'Phối hợp các ban quản trị tòa nhà phát thông báo đôn đốc thu nợ và cập nhật hệ thống đối soát tự động.'}
        </div>

        {/* III. BẢNG KÊ CHỨNG TỪ TỒN ĐỌNG (TOP 10) */}
        <div style={{ fontWeight: 'bold', margin: '15px 0 6px 0' }}>
          III. DANH SÁCH CHỨNG TỪ TIÊU BIỂU TRONG KỲ
        </div>
        <table className="print-table">
          <thead>
            <tr style={{ background: '#f2f2f2' }}>
              <th>Mã HĐ</th>
              <th>Sinh viên</th>
              <th>Phòng</th>
              <th>Khoản thu</th>
              <th style={{ textAlign: 'right' }}>Số tiền</th>
              <th style={{ textAlign: 'right' }}>Đã nộp</th>
              <th style={{ textAlign: 'right' }}>Còn nợ</th>
              <th>Hạn nộp</th>
            </tr>
          </thead>
          <tbody>
            {reportData.items.slice(0, 10).map((row) => (
              <tr key={row.invoiceId}>
                <td>{row.invoiceId}</td>
                <td>{row.studentName} ({row.studentId || '--'})</td>
                <td>{row.room}</td>
                <td>{row.feeType}</td>
                <td style={{ textAlign: 'right' }}>{formatVND(row.amount)}</td>
                <td style={{ textAlign: 'right' }}>{formatVND(row.paid)}</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatVND(row.remaining)}</td>
                <td>{row.dueDate}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* IV. KHUNG CHỮ KÝ HÀNH CHÍNH 3 BÊN */}
        <div className="print-signatures">
          <div className="print-sig-col">
            <strong>NGƯỜI LẬP BIỂU</strong>
            <br />
            <span style={{ fontStyle: 'italic', fontSize: '11pt' }}>(Ký, ghi rõ họ tên)</span>
            <div className="print-sig-space"></div>
            <strong>{formData.creatorName}</strong>
          </div>
          <div className="print-sig-col">
            <strong>KẾ TOÁN TRƯỞNG</strong>
            <br />
            <span style={{ fontStyle: 'italic', fontSize: '11pt' }}>(Ký, ghi rõ họ tên)</span>
            <div className="print-sig-space"></div>
            <strong>Nguyễn Thị Hoa</strong>
          </div>
          <div className="print-sig-col">
            <strong>TRƯỞNG BQL KÝ TÚC XÁ</strong>
            <br />
            <span style={{ fontStyle: 'italic', fontSize: '11pt' }}>(Ký, đóng dấu)</span>
            <div className="print-sig-space"></div>
            <strong>{formData.approverName}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
