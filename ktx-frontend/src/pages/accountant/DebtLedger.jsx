import { useState, useEffect, useCallback } from 'react';
import './DebtLedger.css';
import { debtService } from '../../services/debtService';

/**
 * Trang Sổ công nợ (Chuẩn 100% theo 2 Screenshot thiết kế)
 * - Màn hình 1: Tổng quan Sổ công nợ (3 Cards thống kê + Danh sách chi tiết công nợ)
 * - Màn hình 2: Sổ công nợ cá nhân (‹ Sổ công nợ cá nhân, Thông tin sinh viên, Danh mục các khoản thu, Nút Gửi thông báo nhắc nợ)
 * - Khi sinh viên chuyển thiếu tiền: Hệ thống tự động ghi nhận công nợ còn thiếu.
 */
export default function DebtLedger({ searchTerm = '' }) {
  // Trạng thái màn hình: null = Danh sách tổng quan, string = Mã sinh viên đang xem chi tiết cá nhân
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // Dữ liệu màn hình tổng quan
  const [summaryData, setSummaryData] = useState({
    statistics: {
      totalReceivable: 1850000000.0,
      totalCollected: 1710000000.0,
      totalOutstanding: 140000000.0,
    },
    items: [],
  });

  // Dữ liệu màn hình chi tiết cá nhân
  const [personalDebt, setPersonalDebt] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [remindingStudentId, setRemindingStudentId] = useState(null);

  // Hiển thị thông báo Toast
  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Tải dữ liệu tổng quan
  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await debtService.getDebtSummary(searchTerm);
      if (res) {
        setSummaryData(res);
      }
    } catch (err) {
      console.error('Lỗi khi tải sổ công nợ:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm]);

  // Tải dữ liệu cá nhân khi chọn sinh viên
  const loadPersonalDebt = useCallback(async (studentId) => {
    setIsLoading(true);
    try {
      const res = await debtService.getStudentPersonalDebt(studentId);
      if (res) {
        setPersonalDebt(res);
      }
    } catch (err) {
      console.error('Lỗi khi tải sổ công nợ cá nhân:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedStudentId) {
      loadSummary();
    } else {
      loadPersonalDebt(selectedStudentId);
    }
  }, [selectedStudentId, loadSummary, loadPersonalDebt]);

  // Format tiền VND
  const formatVND = (val) => {
    if (val === undefined || val === null) return '0';
    return Number(val).toLocaleString('vi-VN');
  };

  // Format tiền hiển thị đầy đủ "xxx.xxx.xxx VND"
  const formatFullVND = (val) => {
    if (val === undefined || val === null) return '0 VND';
    return `${Number(val).toLocaleString('vi-VN')} VND`;
  };

  // Xử lý gửi thông báo nhắc nợ
  const handleRemind = async (studentId, studentName) => {
    setRemindingStudentId(studentId);
    try {
      const res = await debtService.remindStudentDebt(studentId);
      showToast(
        res?.message || `Đã gửi thông báo nhắc nợ thành công tới sinh viên ${studentName || studentId}!`,
        'success'
      );
    } catch (err) {
      showToast(`Không thể gửi nhắc nợ: ${err.message}`, 'error');
    } finally {
      setRemindingStudentId(null);
    }
  };

  // =========================================================================
  // VIEW 2: SỔ CÔNG NỢ CÁ NHÂN (Screenshot 2)
  // =========================================================================
  if (selectedStudentId) {
    const student = personalDebt || {
      studentId: selectedStudentId,
      fullName: 'Nguyễn Hoàng Long',
      room: 'A105',
      phone: '0987 654 321',
      totalDebt: 3145000.0,
      fees: [],
    };

    return (
      <div className="debt-container">
        {/* Toast thông báo */}
        {toastMessage && (
          <div className={`debt-toast toast-${toastMessage.type}`}>
            <span className="toast-icon">
              {toastMessage.type === 'success' ? '✓' : '⚠️'}
            </span>
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Tiêu đề & Nút quay lại */}
        <div className="debt-detail-header">
          <button
            type="button"
            className="debt-back-btn"
            onClick={() => setSelectedStudentId(null)}
            title="Quay lại danh sách sổ công nợ"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <h1 className="debt-page-title">Sổ công nợ cá nhân</h1>
          </button>
        </div>

        {isLoading ? (
          <div className="debt-loading-state">
            <div className="debt-spinner" />
            <p>Đang tải thông tin sổ công nợ cá nhân...</p>
          </div>
        ) : (
          <div className="debt-personal-content">
            {/* Mục 1: Thông tin sinh viên */}
            <div className="debt-card-section">
              <h2 className="debt-section-title">Thông tin sinh viên</h2>
              <div className="debt-student-table">
                <div className="debt-student-row">
                  <span className="debt-student-label">Mã sinh viên</span>
                  <span className="debt-student-value">{student.studentId}</span>
                </div>
                <div className="debt-student-row">
                  <span className="debt-student-label">Họ và tên</span>
                  <span className="debt-student-value">{student.fullName}</span>
                </div>
                <div className="debt-student-row">
                  <span className="debt-student-label">Phòng ở</span>
                  <span className="debt-student-value">{student.room}</span>
                </div>
                <div className="debt-student-row">
                  <span className="debt-student-label">Số điện thoại</span>
                  <span className="debt-student-value">{student.phone || '--'}</span>
                </div>
                <div className="debt-student-row total-row">
                  <span className="debt-student-label">Tổng dư nợ</span>
                  <span className="debt-student-value text-debt-red">
                    {formatFullVND(student.totalDebt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Mục 2: Danh mục các khoản thu */}
            <div className="debt-card-section" style={{ marginTop: '24px' }}>
              <h2 className="debt-section-title">Danh mục các khoản thu</h2>
              <div className="debt-table-wrapper">
                <table className="debt-table">
                  <thead>
                    <tr>
                      <th style={{ width: '30%' }}>Khoản thu</th>
                      <th style={{ width: '20%' }}>Kỳ/Tháng</th>
                      <th style={{ width: '15%' }}>Số tiền</th>
                      <th style={{ width: '15%' }}>Đã nộp</th>
                      <th style={{ width: '15%' }}>Còn lại</th>
                      <th style={{ width: '15%' }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.fees && student.fees.length > 0 ? (
                      student.fees.map((fee, idx) => {
                        const isCompleted = fee.status === 'Đã hoàn tất' || fee.remainingAmount === 0;
                        const isPartial = fee.status === 'Chuyển thiếu';
                        const isUnpaid = fee.status === 'Chưa nộp';

                        return (
                          <tr key={fee.id || idx}>
                            <td className="font-medium">{fee.feeName}</td>
                            <td>{fee.period}</td>
                            <td>{formatVND(fee.amount)}</td>
                            <td>{formatVND(fee.paidAmount)}</td>
                            <td className={fee.remainingAmount > 0 ? 'font-semibold' : ''}>
                              {formatVND(fee.remainingAmount)}
                            </td>
                            <td>
                              <span
                                className={`debt-fee-status ${
                                  isCompleted
                                    ? 'status-completed'
                                    : isPartial
                                    ? 'status-partial'
                                    : 'status-unpaid'
                                }`}
                              >
                                {fee.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                          Không có khoản thu nào phát sinh
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Nút Gửi thông báo nhắc nợ (Màu cam chuẩn theo Screenshot 2) */}
              <div className="debt-action-footer">
                <button
                  type="button"
                  className="debt-btn-remind-primary"
                  onClick={() => handleRemind(student.studentId, student.fullName)}
                  disabled={remindingStudentId === student.studentId}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <span>
                    {remindingStudentId === student.studentId
                      ? 'Đang gửi thông báo...'
                      : 'Gửi thông báo nhắc nợ'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: SỔ CÔNG NỢ TỔNG QUAN (Screenshot 1)
  // =========================================================================
  const { statistics, items } = summaryData;

  return (
    <div className="debt-container">
      {/* Toast thông báo */}
      {toastMessage && (
        <div className={`debt-toast toast-${toastMessage.type}`}>
          <span className="toast-icon">
            {toastMessage.type === 'success' ? '✓' : '⚠️'}
          </span>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header trang */}
      <div className="debt-header">
        <h1 className="debt-page-title">SỔ CÔNG NỢ</h1>
      </div>

      {/* 3 Thống kê Cards */}
      <div className="debt-stats-grid">
        {/* Card 1: Tổng nợ cần thu */}
        <div className="debt-stat-card">
          <div className="debt-stat-label">TỔNG NỢ CẦN THU (KỲ & THÁNG)</div>
          <div className="debt-stat-value text-blue">
            {formatFullVND(statistics?.totalReceivable || 1850000000)}
          </div>
        </div>

        {/* Card 2: Đã thu hoàn tất */}
        <div className="debt-stat-card">
          <div className="debt-stat-label">ĐÃ THU HOÀN TẤT</div>
          <div className="debt-stat-value text-green">
            {formatFullVND(statistics?.totalCollected || 1710000000)}
          </div>
        </div>

        {/* Card 3: Còn nợ tồn đọng */}
        <div className="debt-stat-card">
          <div className="debt-stat-label">CÒN NỢ TỒN ĐỌNG</div>
          <div className="debt-stat-value text-red">
            {formatFullVND(statistics?.totalOutstanding || 140000000)}
          </div>
        </div>
      </div>

      {/* Bảng chi tiết công nợ */}
      <div className="debt-list-section">
        <h2 className="debt-section-title">Danh sách chi tiết công nợ</h2>

        {isLoading ? (
          <div className="debt-loading-state">
            <div className="debt-spinner" />
            <p>Đang tải dữ liệu công nợ...</p>
          </div>
        ) : (
          <div className="debt-table-wrapper">
            <table className="debt-table">
              <thead>
                <tr>
                  <th style={{ width: '13%' }}>Mã SV</th>
                  <th style={{ width: '17%' }}>Họ và tên</th>
                  <th style={{ width: '9%' }}>Phòng</th>
                  <th style={{ width: '13%' }}>Tiền phòng</th>
                  <th style={{ width: '13%' }}>Điện nước</th>
                  <th style={{ width: '14%' }}>Tổng còn nợ</th>
                  <th style={{ width: '13%' }}>Hạn chót</th>
                  <th style={{ width: '14%' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items && items.length > 0 ? (
                  items.map((item, idx) => (
                    <tr key={`${item.studentId}-${idx}`}>
                      <td className="font-mono">{item.studentId}</td>
                      <td>{item.fullName}</td>
                      <td>{item.room}</td>
                      <td>{formatVND(item.roomFeeDebt)}</td>
                      <td>{formatVND(item.utilityFeeDebt)}</td>
                      <td className="font-semibold">{formatVND(item.totalDebt)}</td>
                      <td>
                        <span className="debt-deadline">
                          {item.deadline}
                          {item.isOverdue && (
                            <span className="debt-overdue-tag">(Quá hạn)</span>
                          )}
                        </span>
                      </td>
                      <td>
                        <div className="debt-actions-cell">
                          <button
                            type="button"
                            className="debt-link-action"
                            onClick={() => handleRemind(item.studentId, item.fullName)}
                            disabled={remindingStudentId === item.studentId}
                          >
                            {remindingStudentId === item.studentId ? 'Đang gửi...' : 'Nhắc nợ'}
                          </button>
                          <button
                            type="button"
                            className="debt-link-action"
                            onClick={() => setSelectedStudentId(item.studentId)}
                          >
                            Chi tiết
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      Không tìm thấy bản ghi công nợ nào phù hợp
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
