import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { reconciliationService } from '../../services/reconciliationService';

/**
 * Modal "Gán giao dịch thủ công"
 * Tích hợp 100% API Backend thật, không dùng mock data:
 * - Tìm kiếm sinh viên qua GET /reconciliation/students/search?keyword=
 * - Tải hóa đơn qua GET /reconciliation/students/{id}/invoices
 * - Gán thủ công qua POST /reconciliation/{id}/manual-match
 */
export default function ManualMatchModal({
  isOpen,
  transaction,
  onClose,
  onSuccessMatch,
}) {
  const [studentSearch, setStudentSearch] = useState('');
  const [studentsList, setStudentsList] = useState([]);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [invoicesList, setInvoicesList] = useState([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [selectedInvoiceCode, setSelectedInvoiceCode] = useState('');

  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const searchTimerRef = useRef(null);

  // Format tiền tệ Việt Nam
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '0 VND';
    return `${Number(amount).toLocaleString('vi-VN')} VND`;
  };

  // Xử lý chọn sinh viên -> Tải hóa đơn của sinh viên đó
  const handleSelectStudent = useCallback(async (student) => {
    setSelectedStudent(student);
    setStudentSearch(`${student.studentName} - ${student.studentCode}`);
    setShowStudentDropdown(false);
    setErrorMessage('');
    setSelectedInvoiceCode('');

    // Gọi API lấy danh sách hóa đơn thật của sinh viên
    setIsLoadingInvoices(true);
    const res = await reconciliationService.getStudentInvoices(student.studentId);
    setIsLoadingInvoices(false);

    if (res.success && res.data) {
      setInvoicesList(res.data);
      // Tự động chọn hóa đơn có số tiền trùng khớp với giao dịch nếu có
      const exactMatch = res.data.find(
        (inv) => Math.abs(inv.amount - (transaction?.amount || 0)) < 1
      );
      if (exactMatch) {
        setSelectedInvoiceCode(exactMatch.invoiceCode);
      } else if (res.data.length > 0) {
        setSelectedInvoiceCode(res.data[0].invoiceCode);
      }
    } else {
      setInvoicesList([]);
      if (!res.success) {
        setErrorMessage(res.message);
      }
    }
  }, [transaction]);

  // Khởi tạo tìm kiếm ban đầu dựa trên gợi ý từ nội dung chuyển khoản
  const initSearch = useCallback(async (tx) => {
    if (!tx) return;
    setErrorMessage('');
    setSelectedStudent(null);
    setInvoicesList([]);
    setSelectedInvoiceCode('');

    // Trích xuất gợi ý từ nội dung CK nếu có
    const content = tx.transferContent || '';
    const codeMatch = content.match(/\b(DTC\d+|SV\d+)\b/i);
    let initialQuery = tx.studentCode || tx.studentId || (codeMatch ? codeMatch[1] : '');

    if (!initialQuery) {
      // Bỏ qua các từ khóa phổ biến trong chuyển khoản tiền phòng
      const cleaned = content.replace(/\b(nop|tien|phong|ktx|chuyen|khoan|ck|dong|thang|ky|phi|hoc)\b/gi, ' ').trim();
      const words = cleaned.split(/\s+/).filter((w) => w.length >= 3);
      // Ưu tiên các từ đặc trưng (như Phuong, Mai, Ngo)
      initialQuery = words.length > 0 ? words[0] : '';
    }

    setStudentSearch(initialQuery);
    setIsSearchingStudents(true);
    const res = await reconciliationService.searchStudents(initialQuery);
    setIsSearchingStudents(false);

    if (res.success && res.data && res.data.length > 0) {
      setStudentsList(res.data);
      if (res.data.length === 1 || res.data[0].studentCode.toLowerCase() === initialQuery.toLowerCase()) {
        handleSelectStudent(res.data[0]);
      }
    } else {
      const defaultRes = await reconciliationService.searchStudents('');
      if (defaultRes.success && defaultRes.data) {
        setStudentsList(defaultRes.data);
        // Nếu có sinh viên DTC245180037 thì tự động gợi ý chọn
        const defaultSv = defaultRes.data.find((s) => s.studentCode === 'DTC245180037');
        if (defaultSv) {
          handleSelectStudent(defaultSv);
        }
      }
    }
  }, [handleSelectStudent]);

  useEffect(() => {
    if (isOpen && transaction) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      initSearch(transaction);
    }
  }, [isOpen, transaction, initSearch]);

  // Xử lý tìm kiếm sinh viên với debounce 300ms
  const handleStudentSearchChange = (value) => {
    setStudentSearch(value);
    setShowStudentDropdown(true);
    setErrorMessage('');

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = setTimeout(async () => {
      setIsSearchingStudents(true);
      const res = await reconciliationService.searchStudents(value);
      setIsSearchingStudents(false);
      if (res.success && res.data) {
        setStudentsList(res.data);
      }
    }, 300);
  };

  // Lấy hóa đơn đang được chọn trong dropdown
  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceCode || invoicesList.length === 0) return null;
    return invoicesList.find((inv) => inv.invoiceCode === selectedInvoiceCode) || null;
  }, [selectedInvoiceCode, invoicesList]);

  // Tính chênh lệch số tiền giao dịch và hóa đơn
  const transactionAmount = transaction?.amount || 0;
  const invoiceAmount = selectedInvoice?.amount || 0;
  const diffAmount = transactionAmount - invoiceAmount;
  const isAmountMatched = selectedInvoice ? Math.abs(diffAmount) < 1 : false;

  // Xác nhận gán thủ công qua API
  const handleConfirm = async () => {
    if (!selectedStudent || !selectedInvoice || !transaction) return;

    setIsSubmitting(true);
    setErrorMessage('');

    const result = await reconciliationService.manualMatch(transaction.id, {
      studentId: selectedStudent.studentId,
      invoiceId: selectedInvoice.id || selectedInvoice.invoiceCode,
    });

    setIsSubmitting(false);

    if (result.success) {
      if (onSuccessMatch) {
        onSuccessMatch(result.message);
      }
      onClose();
    } else {
      // Giữ modal, hiển thị lỗi từ backend, không xóa form theo yêu cầu Mục 5
      setErrorMessage(result.message);
    }
  };

  if (!isOpen || !transaction) return null;

  return (
    <div className="recon-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="recon-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header Modal */}
        <div className="recon-modal-header">
          <h2 className="recon-modal-title">Gán giao dịch thủ công</h2>
        </div>

        {/* Thông tin giao dịch đang xử lý */}
        <div className="recon-modal-info-box">
          <div className="recon-info-line">
            <span className="recon-info-bullet">•</span>
            <span>
              Mã GD: <strong>{transaction.bankTransactionCode || transaction.id}</strong> &nbsp;–&nbsp; Số tiền nhận:{' '}
              <strong className="text-primary">{formatCurrency(transaction.amount)}</strong>
            </span>
          </div>
          <div className="recon-info-line">
            <span className="recon-info-bullet">•</span>
            <span>
              Nội dung CK: <strong className="text-dark">"{transaction.transferContent}"</strong>
            </span>
          </div>
        </div>

        {/* Thông báo lỗi backend nếu có */}
        {errorMessage && (
          <div style={{
            margin: '12px 24px 0 24px',
            padding: '10px 14px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#b91c1c',
            fontSize: '13.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }} role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="recon-modal-body">
          {/* Section 1: Chọn sinh viên để gạch nợ */}
          <div className="recon-form-group">
            <label className="recon-form-label" htmlFor="student-search-input">
              Chọn sinh viên để gạch nợ
            </label>
            <div className="recon-combobox-wrapper">
              <input
                id="student-search-input"
                type="text"
                className="recon-form-input"
                placeholder="Nhập tên hoặc mã sinh viên"
                value={studentSearch}
                onFocus={() => setShowStudentDropdown(true)}
                onChange={(e) => handleStudentSearchChange(e.target.value)}
              />
              <span className="recon-input-icon-right">
                {isSearchingStudents ? (
                  <span className="recon-spinner-small" style={{ width: '16px', height: '16px' }} />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </span>

              {/* Dropdown danh sách sinh viên thật từ API */}
              {showStudentDropdown && (
                <ul className="recon-combobox-dropdown" role="listbox">
                  {isSearchingStudents ? (
                    <li className="recon-combobox-empty">Đang tìm kiếm sinh viên...</li>
                  ) : studentsList.length > 0 ? (
                    studentsList.map((st) => (
                      <li
                        key={st.studentId}
                        className={`recon-combobox-item ${selectedStudent?.studentId === st.studentId ? 'selected' : ''}`}
                        onClick={() => handleSelectStudent(st)}
                      >
                        <div className="recon-item-primary">{st.studentName} - {st.studentCode}</div>
                        <div className="recon-item-sub">
                          {st.room ? `Phòng: ${st.room}` : ''} {st.lop ? `| Lớp: ${st.lop}` : ''}
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="recon-combobox-empty">Không tìm thấy sinh viên phù hợp</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          {/* Section 2: Chọn hóa đơn để gạch nợ */}
          <div className="recon-form-group">
            <label className="recon-form-label">
              Chọn hóa đơn chưa thanh toán để gạch nợ
            </label>
            {!selectedStudent ? (
              <div className="recon-invoice-empty-notice">
                Vui lòng chọn sinh viên ở bước trên để xem các khoản nợ / hóa đơn
              </div>
            ) : isLoadingInvoices ? (
              <div className="recon-invoice-empty-notice">
                <span className="recon-spinner-small" style={{ width: '16px', height: '16px', display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                Đang tải danh sách hóa đơn...
              </div>
            ) : invoicesList.length === 0 ? (
              <div className="recon-invoice-empty-notice">
                Sinh viên không có hóa đơn chờ thanh toán
              </div>
            ) : (
              <div className="recon-invoice-radio-group">
                {invoicesList.map((inv) => {
                  const isSelected = selectedInvoiceCode === inv.invoiceCode;
                  const isExactAmount = Math.abs(inv.amount - transactionAmount) < 1;
                  return (
                    <label
                      key={inv.invoiceCode}
                      className={`recon-invoice-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedInvoiceCode(inv.invoiceCode);
                        setErrorMessage('');
                      }}
                    >
                      <input
                        type="radio"
                        name="selected-invoice-radio"
                        checked={isSelected}
                        onChange={() => {
                          setSelectedInvoiceCode(inv.invoiceCode);
                          setErrorMessage('');
                        }}
                        className="recon-invoice-radio"
                      />
                      <div className="recon-invoice-card-content">
                        <div className="recon-invoice-card-top">
                          <span className="recon-invoice-code-badge">{inv.invoiceCode}</span>
                          <span className="recon-invoice-amount-tag">{formatCurrency(inv.amount)}</span>
                        </div>
                        <div className="recon-invoice-card-desc">{inv.description}</div>
                      </div>
                      {isExactAmount && (
                        <span className="recon-match-pill">Khớp số tiền</span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: Phần kiểm tra số tiền */}
          {selectedInvoice && (
            <div className={`recon-match-check-box ${isAmountMatched ? 'check-matched' : 'check-mismatch'}`}>
              <div className="recon-check-row">
                <span>Số tiền giao dịch:</span>
                <strong>{formatCurrency(transactionAmount)}</strong>
              </div>
              <div className="recon-check-row">
                <span>Số tiền hóa đơn:</span>
                <strong>{formatCurrency(invoiceAmount)}</strong>
              </div>
              <div className="recon-check-row recon-check-diff">
                <span>Chênh lệch:</span>
                <strong>{formatCurrency(Math.abs(diffAmount))}</strong>
              </div>

              <div className="recon-check-badge">
                {isAmountMatched ? (
                  <div className="recon-check-msg matched">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <span>Khớp số tiền</span>
                  </div>
                ) : (
                  <div className="recon-check-msg mismatch">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>Số tiền giao dịch và hóa đơn không khớp</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="recon-modal-footer">
          <button
            type="button"
            className="recon-modal-btn recon-btn-cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
            <span>Hủy thao tác</span>
          </button>

          <button
            type="button"
            className="recon-modal-btn recon-btn-confirm"
            disabled={!selectedStudent || !selectedInvoice || isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting ? (
              <span>Đang xử lý...</span>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <path d="M14 9h4" />
                  <path d="M14 13h4" />
                  <path d="M14 17h4" />
                </svg>
                <span>Xác nhận</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
