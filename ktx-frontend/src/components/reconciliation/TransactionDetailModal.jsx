import { useState } from 'react';
import './TransactionDetailModal.css';

/**
 * Modal "Xem chi tiết giao dịch đối soát"
 * Thiết kế giao diện hiện đại, chuyên nghiệp, thông tin chi tiết:
 * - Thông tin giao dịch ngân hàng (Mã GD, số tiền, ngày giờ, ngân hàng, TK, nội dung CK)
 * - Thông tin đối soát & Hóa đơn liên kết (Mã hóa đơn, SV, loại hóa đơn, kỳ thanh toán, người xử lý...)
 * - Hỗ trợ sao chép mã GD, chuyển nhanh sang Khớp tay nếu chưa đối soát
 */
export default function TransactionDetailModal({
  isOpen,
  transaction,
  detailData,
  isLoading,
  onClose,
  onOpenManualMatch,
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Dữ liệu hợp nhất từ detailData (API) và transaction (dòng được chọn)
  const tx = detailData?.transaction || transaction || {};
  const student = detailData?.student;
  const invoice = detailData?.invoice;

  const isMatched =
    tx.status === 'MATCHED' ||
    tx.status === 'AUTO_MATCHED' ||
    tx.status === 'MATCHED_MANUALLY' ||
    tx.statusText === 'Đã khớp';

  const isPartial =
    tx.status === 'PARTIAL' ||
    tx.statusText === 'Chuyển thiếu';

  const isInvalidSyntax =
    tx.status === 'INVALID_SYNTAX' ||
    tx.status === 'MANUAL_REQUIRED' ||
    tx.statusText === 'Sai cú pháp';

  const isNotFound =
    tx.status === 'STUDENT_NOT_FOUND' || tx.statusText === 'Không tìm thấy SV';

  const isError =
    tx.status === 'ERROR' || tx.statusText === 'Lỗi đối soát';

  // Format tiền tệ Việt Nam
  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '0 ₫';
    return `${Number(val).toLocaleString('vi-VN')} ₫`;
  };

  // Sao chép mã GD
  const handleCopyCode = () => {
    const code = tx.bankTransactionCode || tx.id;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="tx-detail-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="tx-detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tx-detail-header">
          <div className="tx-detail-header-left">
            <div className={`tx-detail-header-icon ${isMatched ? 'icon-success' : isPartial ? 'icon-warning' : 'icon-warning'}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <div className="tx-detail-header-title-row">
                <h3 className="tx-detail-title">Chi tiết giao dịch đối soát</h3>
                <span className={`tx-status-pill ${isMatched ? 'pill-success' : isPartial ? 'pill-orange' : isInvalidSyntax ? 'pill-warning' : isNotFound ? 'pill-orange' : 'pill-error'}`}>
                  <span className="tx-status-dot" />
                  {tx.statusText || (isMatched ? 'Đã khớp' : isPartial ? 'Chuyển thiếu' : 'Sai cú pháp')}
                </span>
              </div>
              <p className="tx-detail-subtitle">
                Mã GD: <strong className="tx-code-highlight">{tx.bankTransactionCode || tx.id}</strong> • Thời gian: {tx.transactionDate || '--'}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="tx-detail-close-btn"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="tx-detail-loading">
            <div className="tx-detail-spinner" />
            <p>Đang tải thông tin chi tiết giao dịch...</p>
          </div>
        ) : (
          /* Body */
          <div className="tx-detail-body">
            {/* Banner tóm tắt trạng thái */}
            <div className={`tx-summary-banner ${isMatched ? 'banner-success' : isPartial ? 'banner-orange' : isInvalidSyntax ? 'banner-warning' : isNotFound ? 'banner-orange' : 'banner-error'}`}>
              <div className="tx-banner-icon">
                {isMatched ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                ) : isPartial ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
              </div>
              <div className="tx-banner-content">
                <strong>
                  {isMatched
                    ? 'Giao dịch đã khớp thành công với hóa đơn sinh viên'
                    : isPartial
                    ? 'Giao dịch chuyển thiếu tiền cho hóa đơn - Đã ghi nhận Sổ công nợ'
                    : isInvalidSyntax
                    ? 'Nội dung giao dịch sai cú pháp / thiếu mã sinh viên'
                    : isNotFound
                    ? 'Không tìm thấy sinh viên trong hệ thống'
                    : 'Giao dịch có lỗi lệch số tiền'}
                </strong>
                <p>
                  {isMatched
                    ? `Hệ thống đã tự động gạch nợ cho hóa đơn ${tx.invoiceCode || tx.matched_invoice || 'tương ứng'}. Trạng thái thanh toán đã được cập nhật hoàn tất.`
                    : isPartial
                    ? `Sinh viên đã chuyển một phần tiền cho hóa đơn ${invoice?.invoiceCode || tx.invoiceCode || ''}. Số tiền còn thiếu đã được tự động ghi nhận vào Sổ công nợ sinh viên.`
                    : isInvalidSyntax
                    ? 'Nội dung chuyển khoản chưa đúng định dạng chuẩn (thiếu mã sinh viên). Kế toán cần thực hiện gán sinh viên thủ công.'
                    : isNotFound
                    ? 'Mã sinh viên được ghi nhận trong nội dung không tồn tại trên hệ thống dữ liệu ký túc xá.'
                    : 'Số tiền chuyển khoản không trùng khớp chính xác với số tiền phải thanh toán trên hóa đơn.'}
                </p>
              </div>
            </div>

            {/* Grid 2 phần: Thông tin ngân hàng & Thông tin đối soát */}
            <div className="tx-detail-grid">
              {/* Card 1: Giao dịch ngân hàng */}
              <div className="tx-card">
                <div className="tx-card-header">
                  <div className="tx-card-icon-box">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  </div>
                  <h4 className="tx-card-title">Thông tin giao dịch ngân hàng</h4>
                </div>

                <div className="tx-amount-display">
                  <span className="tx-amount-label">Số tiền ghi có</span>
                  <span className="tx-amount-number">{formatCurrency(tx.amount)}</span>
                </div>

                <div className="tx-info-list">
                  <div className="tx-info-row">
                    <span className="tx-info-label">Mã giao dịch:</span>
                    <span className="tx-info-val tx-code-val">
                      {tx.bankTransactionCode || tx.id}
                      <button
                        type="button"
                        className="tx-copy-btn"
                        onClick={handleCopyCode}
                        title="Sao chép mã giao dịch"
                      >
                        {copied ? (
                          <span style={{ color: '#16a34a', fontSize: '11px', fontWeight: 600 }}>Đã chép!</span>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        )}
                      </button>
                    </span>
                  </div>

                  <div className="tx-info-row">
                    <span className="tx-info-label">Thời gian GD:</span>
                    <span className="tx-info-val">{tx.transactionDate || '--'}</span>
                  </div>

                  <div className="tx-info-row">
                    <span className="tx-info-label">Ngân hàng nhận:</span>
                    <span className="tx-info-val">{tx.bankName || 'TP Bank'}</span>
                  </div>

                  <div className="tx-info-row">
                    <span className="tx-info-label">Số tài khoản KTX:</span>
                    <span className="tx-info-val">{tx.so_tai_khoan || '20020813520'}</span>
                  </div>

                  {tx.bankAccount && tx.bankAccount !== '20020813520' && (
                    <div className="tx-info-row">
                      <span className="tx-info-label">TK đối ứng:</span>
                      <span className="tx-info-val">{tx.bankAccount}</span>
                    </div>
                  )}

                  <div className="tx-info-row full-width">
                    <span className="tx-info-label">Nội dung chuyển khoản:</span>
                    <div className="tx-content-box">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      <span>{tx.transferContent || '--'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Thông tin đối soát & Hóa đơn */}
              <div className="tx-card">
                <div className="tx-card-header">
                  <div className="tx-card-icon-box">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7.5" r="4" />
                      <polyline points="17 11 19 13 23 9" />
                    </svg>
                  </div>
                  <h4 className="tx-card-title">Kết quả đối soát & Hóa đơn</h4>
                </div>

                {isMatched ? (
                  <div className="tx-info-list">
                    <div className="tx-info-row">
                      <span className="tx-info-label">Mã hóa đơn:</span>
                      <span className="tx-info-val">
                        <span className="tx-invoice-badge">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M7 7h10M7 12h10M7 17h6" />
                          </svg>
                          {tx.invoiceCode || tx.matched_invoice || invoice?.invoiceCode || '--'}
                        </span>
                      </span>
                    </div>

                    <div className="tx-info-row">
                      <span className="tx-info-label">Sinh viên:</span>
                      <span className="tx-info-val">
                        <strong>{tx.studentName || student?.studentName || 'Ngô Phương Mai'}</strong>
                        <span style={{ color: '#64748b', marginLeft: '6px', fontSize: '12.5px' }}>
                          ({tx.studentCode || student?.studentCode || 'DTC245180037'})
                        </span>
                      </span>
                    </div>

                    {student?.lop && (
                      <div className="tx-info-row">
                        <span className="tx-info-label">Lớp:</span>
                        <span className="tx-info-val">{student.lop}</span>
                      </div>
                    )}

                    <div className="tx-info-row">
                      <span className="tx-info-label">Khoản thu / Kỳ:</span>
                      <span className="tx-info-val">
                        {invoice?.loaiHoaDon === 'TIEN_PHONG' ? 'Tiền phòng KTX' : invoice?.loaiHoaDon || 'Tiền phòng'} 
                        {invoice?.kyThanhToan ? ` • ${invoice.kyThanhToan}` : ''}
                      </span>
                    </div>

                    <div className="tx-info-row">
                      <span className="tx-info-label">Số tiền hóa đơn:</span>
                      <span className="tx-info-val" style={{ fontWeight: 600, color: '#0f172a' }}>
                        {formatCurrency(invoice?.soTien || tx.amount)}
                      </span>
                    </div>

                    <div className="tx-info-row">
                      <span className="tx-info-label">Phương thức:</span>
                      <span className="tx-info-val">
                        <span className="tx-method-badge">
                          {tx.status === 'MATCHED_MANUALLY' ? 'Khớp thủ công' : 'Khớp tự động (Hệ thống)'}
                        </span>
                      </span>
                    </div>

                    <div className="tx-info-row">
                      <span className="tx-info-label">Trạng thái gạch nợ:</span>
                      <span className="tx-info-val" style={{ color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Đã thanh toán (Hoàn tất)
                      </span>
                    </div>

                    <div className="tx-info-row full-width">
                      <span className="tx-info-label">Ghi chú đối soát:</span>
                      <div className="tx-note-box">
                        {tx.matchNote || tx.displayMessage || 'Khớp tự động thành công theo mã sinh viên và số tiền hóa đơn.'}
                      </div>
                    </div>
                  </div>
                ) : isPartial ? (
                  <div className="tx-info-list">
                    <div className="tx-info-row">
                      <span className="tx-info-label">Mã hóa đơn:</span>
                      <span className="tx-info-val">
                        <span className="tx-invoice-badge" style={{ background: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M7 7h10M7 12h10M7 17h6" />
                          </svg>
                          {tx.invoiceCode || tx.matched_invoice || invoice?.invoiceCode || '--'}
                        </span>
                      </span>
                    </div>

                    <div className="tx-info-row">
                      <span className="tx-info-label">Sinh viên:</span>
                      <span className="tx-info-val">
                        <strong>{tx.studentName || student?.studentName || 'Sinh viên KTX'}</strong>
                        <span style={{ color: '#64748b', marginLeft: '6px', fontSize: '12.5px' }}>
                          ({tx.studentCode || student?.studentCode || tx.msv || '--'})
                        </span>
                      </span>
                    </div>

                    <div className="tx-info-row">
                      <span className="tx-info-label">Khoản thu / Kỳ:</span>
                      <span className="tx-info-val">
                        {invoice?.loaiHoaDon === 'TIEN_PHONG' ? 'Tiền phòng KTX' : invoice?.loaiHoaDon || 'Tiền phòng'} 
                        {invoice?.kyThanhToan ? ` • ${invoice.kyThanhToan}` : ''}
                      </span>
                    </div>

                    <div className="tx-info-row">
                      <span className="tx-info-label">Tổng hóa đơn:</span>
                      <span className="tx-info-val" style={{ fontWeight: 600, color: '#0f172a' }}>
                        {formatCurrency(invoice?.soTien || tx.amount)}
                      </span>
                    </div>

                    <div className="tx-info-row">
                      <span className="tx-info-label">Đã nộp (GD này):</span>
                      <span className="tx-info-val" style={{ fontWeight: 600, color: '#16a34a' }}>
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>

                    <div className="tx-info-row">
                      <span className="tx-info-label">Còn thiếu (Ghi nợ):</span>
                      <span className="tx-info-val" style={{ fontWeight: 700, color: '#dc2626' }}>
                        {formatCurrency(invoice?.conLai || ((invoice?.soTien || 0) > tx.amount ? invoice.soTien - tx.amount : 0))}
                      </span>
                    </div>

                    <div className="tx-info-row">
                      <span className="tx-info-label">Trạng thái đối soát:</span>
                      <span className="tx-info-val" style={{ color: '#ea580c', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} />
                        Chuyển thiếu (Đã ghi nhận Sổ công nợ)
                      </span>
                    </div>

                    <div className="tx-info-row full-width">
                      <span className="tx-info-label">Ghi chú đối soát:</span>
                      <div className="tx-note-box" style={{ background: '#fff7ed', borderColor: '#fed7aa', color: '#9a3412' }}>
                        {tx.matchNote || tx.displayMessage || 'Chuyển thiếu tiền hóa đơn. Phần tiền còn lại đã được tự động đưa vào Sổ công nợ sinh viên.'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="tx-unmatched-box">
                    <div className="tx-unmatched-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <h5 className="tx-unmatched-title">Chưa liên kết với hóa đơn</h5>
                    <p className="tx-unmatched-desc">
                      Giao dịch này chưa được gạch nợ vào hóa đơn nào do nội dung chuyển khoản chưa đủ thông tin hoặc không khớp số tiền.
                    </p>
                    {onOpenManualMatch && (
                      <button
                        type="button"
                        className="tx-btn-match-now"
                        onClick={() => {
                          onClose();
                          onOpenManualMatch(transaction);
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>Gán hóa đơn (Khớp tay ngay)</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="tx-detail-footer">
          <button
            type="button"
            className="tx-detail-btn tx-detail-btn-secondary"
            onClick={onClose}
          >
            Đóng
          </button>

          {!isMatched && onOpenManualMatch && (
            <button
              type="button"
              className="tx-detail-btn tx-detail-btn-primary"
              onClick={() => {
                onClose();
                onOpenManualMatch(transaction);
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span>Thực hiện khớp tay</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
