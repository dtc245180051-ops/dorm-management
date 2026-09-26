import { useState, useCallback, useRef } from 'react';
import './TransactionReconciliation.css';
import { reconciliationService } from '../../services/reconciliationService';
import QuickActionsBar from '../../components/reconciliation/QuickActionsBar';
import ReconciliationStats from '../../components/reconciliation/ReconciliationStats';
import ReconciliationFilters from '../../components/reconciliation/ReconciliationFilters';
import TransactionTable from '../../components/reconciliation/TransactionTable';
import ManualMatchModal from '../../components/reconciliation/ManualMatchModal';
import TransactionDetailModal from '../../components/reconciliation/TransactionDetailModal';
import Pagination from '../../components/reconciliation/Pagination';

/**
 * Trang "ĐỐI SOÁT GIAO DỊCH" (Dành cho Kế toán iDORM)
 * Luồng Upload file sao kê ngân hàng:
 * 1. Trạng thái ban đầu:
 *    - Bảng trống với Empty State: "Vui lòng tải lên file sao kê ngân hàng để bắt đầu đối soát"
 *    - Các card thống kê = 0
 * 2. Khi tải lên file sao kê:
 *    - Trích xuất metadata (Tên file, Ngân hàng, Kỳ sao kê)
 *    - Parse từng dòng và chạy quy tắc đối soát tự động từ backend
 *    - Cập nhật số liệu thống kê (Tổng giao dịch, Khớp tự động, Cần xử lý tay)
 * 3. Khớp tay:
 *    - Mở popup chọn sinh viên & hóa đơn gạch nợ thủ công
 *    - Cập nhật dòng thành "Đã khớp" (xanh lá), thao tác "Xem"
 */
export default function TransactionReconciliation({ searchTerm = '' }) {
  // 1. Trạng thái Upload file sao kê
  const [isUploaded, setIsUploaded] = useState(false);
  const [statementFile, setStatementFile] = useState('');
  const [quickBank, setQuickBank] = useState('TP Bank - TK 20020813520');
  const [quickPeriod, setQuickPeriod] = useState('--');

  // 2. Danh sách giao dịch thật & Phân trang
  const [transactions, setTransactions] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  // 3. Thống kê (Mặc định = 0 khi chưa upload)
  const [stats, setStats] = useState({
    totalTransactions: 0,
    autoMatched: 0,
    manualRequired: 0,
  });

  // 4. Bộ lọc (Filters)
  const [filters, setFilters] = useState({
    search: searchTerm || '',
    status: 'ALL',
    fromDate: '',
    toDate: '',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // 5. Modal Gán giao dịch thủ công & Modal Xem chi tiết
  const [selectedTx, setSelectedTx] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [selectedDetailTx, setSelectedDetailTx] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // 6. Toast thông báo
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3500);
  };

  // Ref file input dùng chung
  const fileInputRef = useRef(null);

  // 7. Xử lý tải danh sách giao dịch từ Backend API khi đã upload file
  const loadTransactions = useCallback(
    async (customParams = {}) => {
      // Nếu chưa upload file sao kê và không ép buộc thì giữ nguyên state ban đầu
      if (!isUploaded && customParams.force !== true && customParams.hasUploaded !== true) {
        return;
      }

      setIsLoading(true);
      setApiError('');

      const activeSearch =
        customParams.search !== undefined
          ? customParams.search
          : (filters.search || searchTerm);

      const queryParams = {
        dateFrom:
          customParams.fromDate !== undefined ? customParams.fromDate : filters.fromDate,
        dateTo:
          customParams.toDate !== undefined ? customParams.toDate : filters.toDate,
        bank:
          customParams.bank !== undefined ? customParams.bank : filters.bank,
        status:
          customParams.status !== undefined ? customParams.status : filters.status,
        keyword: activeSearch,
        page: customParams.page !== undefined ? customParams.page : currentPage,
        pageSize,
        hasUploaded: true,
      };

      const result = await reconciliationService.getReconciliations(queryParams);
      setIsLoading(false);

      if (result.success && result.data) {
        setTransactions(result.data.items || []);
        setTotalItems(result.data.total || 0);

        if (result.data.statistics) {
          setStats({
            totalTransactions: result.data.statistics.totalTransactions,
            autoMatched: result.data.statistics.autoMatched,
            manualRequired: result.data.statistics.manualRequired,
          });
        }
      } else {
        if (result.status === 401) {
          setApiError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        } else if (result.status === 403) {
          setApiError('Bạn không có quyền thực hiện thao tác này.');
        } else if (result.status === 404) {
          setApiError('Dữ liệu không tồn tại.');
        } else if (result.status === 409) {
          setApiError(result.message || 'Xung đột dữ liệu đối soát.');
        } else if (result.status === 400) {
          setApiError(result.message || 'Dữ liệu yêu cầu không hợp lệ.');
        } else {
          setApiError('Có lỗi xảy ra, vui lòng thử lại.');
        }
      }
    },
    [isUploaded, filters, searchTerm, currentPage, pageSize]
  );

  // 8. Xử lý Upload file sao kê ngân hàng (Excel/CSV)
  const handleFileUpload = async (file) => {
    if (!file) return;

    setIsLoading(true);
    setApiError('');

    try {
      const res = await reconciliationService.uploadStatement(file, quickBank, quickPeriod);
      setIsLoading(false);

      if (res.success && res.data) {
        setIsUploaded(true);
        setStatementFile(res.data.fileName || file.name);
        if (res.data.bankName) setQuickBank(res.data.bankName);
        if (res.data.period) setQuickPeriod(res.data.period);

        setTransactions(res.data.items || []);
        setTotalItems(res.data.totalTransactions || (res.data.items ? res.data.items.length : 0));

        if (res.data.statistics) {
          setStats({
            totalTransactions: res.data.statistics.totalTransactions,
            autoMatched: res.data.statistics.autoMatched,
            manualRequired: res.data.statistics.manualRequired,
          });
        }

        showToast(res.message || `Đã tải lên và đối soát thành công file ${file.name}`);
      } else {
        setApiError(res.message || 'Không thể xử lý file sao kê tải lên');
      }
    } catch (err) {
      setIsLoading(false);
      setApiError('Lỗi kết nối khi tải file sao kê: ' + err.message);
    }
  };

  // 9. Xử lý thay đổi bộ lọc
  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  // Áp dụng bộ lọc
  const handleApplyFilter = () => {
    if (!isUploaded) {
      showToast('Vui lòng tải lên file sao kê trước khi lọc giao dịch');
      return;
    }
    setCurrentPage(1);
    loadTransactions({ page: 1, ...filters, hasUploaded: true });
  };

  // Đặt lại / Xóa bộ lọc
  const handleResetFilter = () => {
    const defaultFilters = {
      search: '',
      status: 'ALL',
      fromDate: '',
      toDate: '',
    };
    setFilters(defaultFilters);
    setCurrentPage(1);
    if (isUploaded) {
      loadTransactions({ page: 1, ...defaultFilters, hasUploaded: true });
    }
    showToast('Đã xóa bộ lọc tìm kiếm');
  };

  // 11. Chuyển trang
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    if (isUploaded) {
      loadTransactions({ page: newPage, hasUploaded: true });
    }
  };

  // 12. Xử lý mở Modal gán thủ công
  const handleOpenManualMatch = (tx) => {
    setSelectedTx(tx);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTx(null);
  };

  // 13. Xử lý khi gán thủ công thành công qua API
  const handleSuccessMatch = (successMsg, matchedData) => {
    showToast(successMsg || 'Gán giao dịch thủ công thành công!');

    // 13.1. Cập nhật ngay trên bảng (Optimistic UI Update)
    if (selectedTx) {
      setTransactions((prev) =>
        prev.map((item) => {
          if (item.id === selectedTx.id || item.bankTransactionCode === selectedTx.bankTransactionCode) {
            const matchedCode = matchedData?.invoiceCode || matchedData?.transaction?.invoiceCode || 'HDTP-20260926-5A08F4';
            return {
              ...item,
              status: 'MATCHED',
              statusText: 'Đã khớp',
              action: 'VIEW',
              invoiceCode: matchedCode,
              matched_invoice: matchedCode,
              invoiceDisplay: matchedCode,
            };
          }
          return item;
        })
      );

      // Cập nhật card thống kê: Khớp tự động/đã khớp tăng 1, Cần xử lý tay giảm 1
      setStats((prev) => ({
        ...prev,
        autoMatched: prev.autoMatched + 1,
        manualRequired: Math.max(0, prev.manualRequired - 1),
      }));
    }

    // 13.2. Đồng bộ lại dữ liệu mới nhất từ CSDL backend
    loadTransactions({ hasUploaded: true });
  };

  // 14. Xem chi tiết giao dịch qua Modal đẹp mắt
  const handleViewDetail = async (tx) => {
    setSelectedDetailTx(tx);
    setDetailData(null);
    setIsDetailOpen(true);
    setIsLoadingDetail(true);

    const res = await reconciliationService.getTransactionDetail(tx.id || tx.bankTransactionCode);
    setIsLoadingDetail(false);
    if (res.success && res.data) {
      setDetailData(res.data);
    }
  };

  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  return (
    <div className="recon-container">
      {/* Input file ẩn hỗ trợ kích hoạt từ nhiều vị trí */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".csv, .xlsx, .xls"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />

      {/* Tiêu đề trang */}
      <div className="recon-page-header">
        <div>
          <h1 className="recon-title">ĐỐI SOÁT GIAO DỊCH</h1>
          <p className="recon-subtitle">Theo dõi và xử lý các giao dịch thanh toán</p>
        </div>

        {/* Trạng thái đồng bộ bên phải */}
        <div
          className="recon-header-badge"
          style={{
            backgroundColor: isUploaded ? '#ecfdf5' : '#f8fafc',
            color: isUploaded ? '#059669' : '#64748b',
            borderColor: isUploaded ? '#a7f3d0' : '#e2e8f0',
          }}
          title={isUploaded ? 'Dữ liệu sao kê ngân hàng đã sẵn sàng' : 'Chờ tải lên file sao kê'}
        >
          <span
            className="badge-dot"
            style={{ backgroundColor: isUploaded ? '#10b981' : '#94a3b8' }}
          />
          <span>{isUploaded ? 'Đã đồng bộ ngân hàng' : 'Chờ tải lên sao kê'}</span>
        </div>
      </div>

      {/* Thông báo lỗi API nếu có */}
      {apiError && (
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: '#fef2f2',
            border: '1.5px solid #f87171',
            borderRadius: '10px',
            color: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '14px',
            fontWeight: 500,
          }}
          role="alert"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{apiError}</span>
          </div>
          <button
            type="button"
            className="recon-btn recon-btn-outline"
            style={{ height: '32px', padding: '0 12px', fontSize: '13px' }}
            onClick={() => loadTransactions()}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Thao tác nhanh (Chuẩn Screenshot & Luồng Upload) */}
      <QuickActionsBar
        statementFile={statementFile}
        onFileUpload={handleFileUpload}
        period={quickPeriod}
        onPeriodChange={setQuickPeriod}
        isUploading={isLoading}
      />

      {/* 3 Card Thống kê (Mặc định = 0 khi chưa upload) */}
      <ReconciliationStats
        totalCount={stats.totalTransactions}
        autoMatchedCount={stats.autoMatched}
        manualRequiredCount={stats.manualRequired}
      />

      {/* Bộ lọc (Filters) */}
      <ReconciliationFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onApplyFilter={handleApplyFilter}
        onResetFilter={handleResetFilter}
      />

      {/* Bảng giao dịch: Hiển thị Empty state chuẩn khi chưa upload */}
      <TransactionTable
        isUploaded={isUploaded}
        transactions={transactions}
        isLoading={isLoading}
        onOpenManualMatch={handleOpenManualMatch}
        onViewDetail={handleViewDetail}
        onResetFilter={handleResetFilter}
        onTriggerUpload={() => fileInputRef.current?.click()}
      />

      {/* Phân trang (Chỉ hiển thị khi có dữ liệu) */}
      {isUploaded && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={handlePageChange}
        />
      )}

      {/* Modal gán giao dịch thủ công */}
      {isModalOpen && selectedTx && (
        <ManualMatchModal
          key={selectedTx.id}
          isOpen={isModalOpen}
          transaction={selectedTx}
          onClose={handleCloseModal}
          onSuccessMatch={handleSuccessMatch}
        />
      )}

      {/* Modal xem chi tiết giao dịch đối soát */}
      {isDetailOpen && (
        <TransactionDetailModal
          isOpen={isDetailOpen}
          transaction={selectedDetailTx}
          detailData={detailData}
          isLoading={isLoadingDetail}
          onClose={() => {
            setIsDetailOpen(false);
            setSelectedDetailTx(null);
            setDetailData(null);
          }}
          onOpenManualMatch={(tx) => {
            setIsDetailOpen(false);
            handleOpenManualMatch(tx || selectedDetailTx);
          }}
        />
      )}

      {/* Toast thông báo phản hồi thao tác */}
      {toastMessage && (
        <div className="recon-toast recon-toast-success" role="alert">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
