import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { reconciliationService } from '../../services/reconciliationService';

/**
 * Modal "Khớp tay giao dịch ngân hàng"
 * Hỗ trợ kế toán xử lý mọi giao dịch Sai cú pháp:
 * 1. Cho phép gán trực tiếp vào Hóa đơn Tiền phòng (theo SV) HOẶC Hóa đơn Điện nước (theo Phòng).
 * 2. Tìm kiếm thông minh theo Số phòng (P203), Mã SV (DTC...), Tên SV, Mã hóa đơn.
 * 3. Tự động ưu tiên và gắn nhãn các hóa đơn trùng khớp số tiền.
 * 4. Không ép buộc quy trình ngược và không tự động điền sẵn sinh viên gượng ép.
 */
export default function ManualMatchModal({
  isOpen,
  transaction,
  onClose,
  onSuccessMatch,
}) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState('ALL'); // 'ALL' | 'TIEN_PHONG' | 'DIEN_NUOC'
  const [invoicesList, setInvoicesList] = useState([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const searchTimerRef = useRef(null);

  // Format tiền tệ Việt Nam
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '0 VND';
    return `${Number(amount).toLocaleString('vi-VN')} VND`;
  };

  // Hàm tải danh sách hóa đơn theo từ khóa & loại (dùng cho user thao tác: gõ tìm kiếm hoặc đổi tab)
  const loadInvoices = async (keyword, type) => {
    setIsLoadingInvoices(true);
    setErrorMessage('');
    try {
      const res = await reconciliationService.getUnpaidInvoices({
        keyword,
        invoiceType: type,
        amount: transaction?.amount,
      });
      setIsLoadingInvoices(false);
      if (res.success && Array.isArray(res.data)) {
        setInvoicesList(res.data);
      } else {
        setInvoicesList([]);
      }
    } catch {
      setIsLoadingInvoices(false);
      setInvoicesList([]);
    }
  };

  // Khởi tạo một lần duy nhất khi mở modal cho giao dịch
  useEffect(() => {
    if (!isOpen || !transaction) return;

    setErrorMessage('');
    setSelectedInvoice(null);

    const content = transaction.transferContent || '';
    let initialKw = '';
    let detectedType = 'ALL';

    // 1. Nhận diện phòng hoặc điện nước từ cú pháp (VD: DN P203, P203, dien, nuoc)
    const roomMatch = content.match(/\b(P\d{3}|\d{3})\b/i);
    const isUtilityKeyword = /\b(dn|dien|nuoc|electric|water)\b/i.test(content);

    // 2. Nhận diện mã sinh viên (VD: TP DTC245180037, DTC245..., SV...)
    const studentMatch = content.match(/\b(DTC\d+|SV\d+)\b/i);

    if (isUtilityKeyword || (roomMatch && !studentMatch)) {
      detectedType = 'DIEN_NUOC';
      if (roomMatch) initialKw = roomMatch[1].toUpperCase();
    } else if (studentMatch) {
      detectedType = 'TIEN_PHONG';
      initialKw = studentMatch[1].toUpperCase();
    } else if (roomMatch) {
      initialKw = roomMatch[1].toUpperCase();
    }

    setInvoiceTypeFilter(detectedType);
    setSearchKeyword(initialKw);

    let isMounted = true;
    setIsLoadingInvoices(true);

    reconciliationService.getUnpaidInvoices({
      keyword: initialKw,
      invoiceType: detectedType,
      amount: transaction.amount,
    }).then((res) => {
      if (!isMounted) return;
      setIsLoadingInvoices(false);
      if (res.success && Array.isArray(res.data)) {
        setInvoicesList(res.data);
        // Tự động chọn hóa đơn nếu có hóa đơn trùng khớp cả số tiền
        if (res.data.length > 0) {
          const exactMatch = res.data.find(
            (inv) => Math.abs(inv.amount - (transaction.amount || 0)) < 1
          );
          if (exactMatch) {
            setSelectedInvoice(exactMatch);
          }
        }
      } else {
        setInvoicesList([]);
      }
    }).catch(() => {
      if (!isMounted) return;
      setIsLoadingInvoices(false);
      setInvoicesList([]);
    });

    return () => {
      isMounted = false;
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [isOpen, transaction?.id]);

  // Xử lý khi người dùng gõ từ khóa tìm kiếm (Debounce 300ms)
  const handleKeywordChange = (value) => {
    setSearchKeyword(value);
    setErrorMessage('');

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = setTimeout(() => {
      loadInvoices(value, invoiceTypeFilter);
    }, 300);
  };

  // Xử lý khi chuyển tab lọc loại hóa đơn
  const handleTypeTabChange = (type) => {
    setInvoiceTypeFilter(type);
    setErrorMessage('');
    loadInvoices(searchKeyword, type);
  };

  // Tính chênh lệch số tiền giao dịch và hóa đơn đã chọn
  const transactionAmount = transaction?.amount || 0;
  const invoiceAmount = selectedInvoice?.amount || 0;
  const diffAmount = transactionAmount - invoiceAmount;
  const isAmountMatched = selectedInvoice ? Math.abs(diffAmount) < 1 : false;

  // Xác nhận gán thủ công qua API
  const handleConfirm = async () => {
    if (!selectedInvoice || !transaction) return;

    setIsSubmitting(true);
    setErrorMessage('');

    const result = await reconciliationService.manualMatch(transaction.id, {
      invoiceId: selectedInvoice.invoiceCode || selectedInvoice.id,
      studentId: selectedInvoice.msv || undefined,
    });

    setIsSubmitting(false);

    if (result.success) {
      if (onSuccessMatch) {
        onSuccessMatch(result.message, result.data);
      }
      onClose();
    } else {
      setErrorMessage(result.message || 'Lỗi khi gán hóa đơn thủ công');
    }
  };

  if (!isOpen || !transaction) return null;

  return (
    <div className="recon-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="recon-modal-dialog recon-modal-dialog-large" onClick={(e) => e.stopPropagation()}>
        {/* Header Modal */}
        <div className="recon-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 className="recon-modal-title">Khớp tay giao dịch ngân hàng</h2>
            <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
              Chọn hóa đơn chờ thanh toán (Tiền phòng hoặc Tiền điện nước) để gán vào giao dịch
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              fontSize: '20px',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
            title="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Thông tin giao dịch đang xử lý */}
        <div className="recon-modal-info-box">
          <div className="recon-info-line">
            <span className="recon-info-bullet">•</span>
            <span>
              Mã GD: <strong>{transaction.bankTransactionCode || transaction.id}</strong> &nbsp;–&nbsp; Số tiền nhận:{' '}
              <strong style={{ color: '#ff7700', fontSize: '15px' }}>{formatCurrency(transaction.amount)}</strong>
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
          <div
            style={{
              margin: '12px 24px 0 24px',
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#b91c1c',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            role="alert"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="recon-modal-body" style={{ gap: '14px' }}>
          {/* Tabs chuyển loại: Tất cả / Tiền phòng / Tiền điện nước */}
          <div className="recon-tabs-bar">
            <button
              type="button"
              className={`recon-tab-pill ${invoiceTypeFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => handleTypeTabChange('ALL')}
            >
              Tất cả hóa đơn
            </button>
            <button
              type="button"
              className={`recon-tab-pill ${invoiceTypeFilter === 'TIEN_PHONG' ? 'active' : ''}`}
              onClick={() => handleTypeTabChange('TIEN_PHONG')}
            >
              Tiền phòng (theo SV)
            </button>
            <button
              type="button"
              className={`recon-tab-pill ${invoiceTypeFilter === 'DIEN_NUOC' ? 'active' : ''}`}
              onClick={() => handleTypeTabChange('DIEN_NUOC')}
            >
              Tiền điện nước (theo Phòng)
            </button>
          </div>

          {/* Ô tìm kiếm thông minh */}
          <div className="recon-combobox-wrapper">
            <input
              type="text"
              className="recon-form-input"
              placeholder="Tìm theo Số phòng (P203), Mã SV (DTC...), Tên SV, Mã hóa đơn..."
              value={searchKeyword}
              onChange={(e) => handleKeywordChange(e.target.value)}
            />
            <span className="recon-input-icon-right">
              {isLoadingInvoices ? (
                <span className="recon-spinner-small" style={{ width: '16px', height: '16px' }} />
              ) : searchKeyword ? (
                <button
                  type="button"
                  onClick={() => handleKeywordChange('')}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  ✕
                </button>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              )}
            </span>
          </div>

          {/* Danh sách hóa đơn chưa thanh toán */}
          <div className="recon-form-group">
            <label className="recon-form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Danh sách hóa đơn chưa thanh toán ({invoicesList.length})</span>
              {selectedInvoice && (
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#0284c7' }}>
                  Đã chọn: {selectedInvoice.invoiceCode}
                </span>
              )}
            </label>

            {isLoadingInvoices ? (
              <div className="recon-invoice-empty-notice">
                <span className="recon-spinner-small" style={{ width: '16px', height: '16px', display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} />
                Đang tìm hóa đơn phù hợp...
              </div>
            ) : invoicesList.length === 0 ? (
              <div className="recon-invoice-empty-notice">
                Không tìm thấy hóa đơn chưa thanh toán nào phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              <div className="recon-invoice-radio-group" style={{ maxHeight: '230px' }}>
                {invoicesList.map((inv) => {
                  const isSelected = selectedInvoice?.invoiceCode === inv.invoiceCode;
                  const isExactAmount = Math.abs(inv.amount - transactionAmount) < 1;
                  const isRoomBill = inv.invoiceType === 'TIEN_PHONG';

                  return (
                    <div
                      key={inv.invoiceCode}
                      className={`recon-invoice-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setErrorMessage('');
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <input
                        type="radio"
                        name="selected-invoice-radio"
                        checked={isSelected}
                        readOnly
                        className="recon-invoice-radio"
                      />

                      <div className="recon-invoice-card-content">
                        <div className="recon-invoice-card-top">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className={`recon-type-badge ${isRoomBill ? 'room' : 'utility'}`}>
                              {isRoomBill ? 'Tiền phòng' : 'Điện nước'}
                            </span>
                            <span className="recon-invoice-code-badge">{inv.invoiceCode}</span>
                          </div>
                          <span className="recon-invoice-amount-tag">{formatCurrency(inv.amount)}</span>
                        </div>

                        <div className="recon-invoice-card-desc" style={{ marginTop: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="recon-target-highlight">
                            {inv.targetName} {inv.room && isRoomBill ? `(${inv.room})` : ''}
                          </span>
                          <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                            {inv.period}
                          </span>
                        </div>
                      </div>

                      {isExactAmount && (
                        <span className="recon-match-pill" title="Số tiền hóa đơn trùng khớp 100% với giao dịch">
                          ✓ Khớp số tiền
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Phần đối chiếu kiểm tra số tiền */}
          {selectedInvoice && (
            <div className={`recon-match-check-box ${isAmountMatched ? 'check-matched' : 'check-mismatch'}`}>
              <div className="recon-check-row">
                <span>Số tiền giao dịch nhận:</span>
                <strong>{formatCurrency(transactionAmount)}</strong>
              </div>
              <div className="recon-check-row">
                <span>Số tiền hóa đơn cần thu:</span>
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
                    <span>Số tiền trùng khớp 100% – Sẵn sàng gạch nợ hóa đơn</span>
                  </div>
                ) : (
                  <div className="recon-check-msg mismatch">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>Số tiền giao dịch và hóa đơn có chênh lệch ({formatCurrency(Math.abs(diffAmount))})</span>
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
            Đóng
          </button>

          <button
            type="button"
            className="recon-modal-btn recon-btn-confirm"
            disabled={!selectedInvoice || isSubmitting}
            onClick={handleConfirm}
            style={{
              backgroundColor: selectedInvoice ? '#0084ff' : '#ffffff',
              color: selectedInvoice ? '#ffffff' : '#94a3b8',
              borderColor: selectedInvoice ? '#0084ff' : '#cbd5e1',
            }}
          >
            {isSubmitting ? (
              <span>Đang xử lý...</span>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Xác nhận khớp tay</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
