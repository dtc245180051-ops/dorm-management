import TransactionStatusBadge from './TransactionStatusBadge';

/**
 * Bảng giao dịch đối soát (Transaction Table)
 * Thực hiện chính xác các quy tắc:
 * 1. Khi chưa upload file: Hiển thị Empty State "Vui lòng tải lên file sao kê ngân hàng để bắt đầu đối soát".
 * 2. Khi đã upload file:
 *    - Dòng có Mã SV & khớp hóa đơn: "Khớp với hóa đơn" = Mã HĐ, "Trạng thái" = "Đã khớp" (xanh lá), "Thao tác" = "Xem".
 *    - Dòng KHÔNG chứa Mã SV: "Khớp với hóa đơn" = "Thiếu mã sinh viên", "Trạng thái" = "Sai cú pháp" (đỏ), "Thao tác" = "Khớp tay".
 */
export default function TransactionTable({
  isUploaded = false,
  transactions = [],
  isLoading = false,
  onOpenManualMatch,
  onViewDetail,
  onResetFilter,
  onTriggerUpload,
}) {
  // Format số tiền (ví dụ 120.000 đ hoặc 1.200.000 VND)
  const formatAmount = (val) => {
    if (val === undefined || val === null) return '0 đ';
    return `${Number(val).toLocaleString('vi-VN')} đ`;
  };

  if (isLoading) {
    return (
      <div className="recon-table-card">
        <div className="recon-loading-state">
          <div className="recon-spinner" />
          <p>Đang xử lý và đối soát dữ liệu sao kê...</p>
        </div>
      </div>
    );
  }

  // 1. Trạng thái ban đầu: Chưa upload file sao kê
  if (!isUploaded) {
    return (
      <div className="recon-table-card">
        <div className="recon-empty-state" style={{ padding: '60px 20px' }}>
          <div className="recon-empty-icon" style={{ color: '#0284c7', marginBottom: '16px' }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <polyline points="9 15 12 12 15 15" />
            </svg>
          </div>
          <h4 className="recon-empty-title" style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
            Chưa có dữ liệu sao kê
          </h4>
          <p className="recon-empty-desc" style={{ fontSize: '14.5px', color: '#64748b', maxWidth: '480px', marginBottom: '22px' }}>
            Vui lòng tải lên file sao kê ngân hàng để bắt đầu đối soát
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {onTriggerUpload && (
              <button
                type="button"
                className="recon-btn recon-btn-primary"
                onClick={onTriggerUpload}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Tải lên sao kê (Excel/CSV)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. Đã upload file nhưng không có kết quả phù hợp với bộ lọc
  if (transactions.length === 0) {
    return (
      <div className="recon-table-card">
        <div className="recon-empty-state">
          <div className="recon-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <h4 className="recon-empty-title">Không có giao dịch phù hợp</h4>
          <p className="recon-empty-desc">
            Không tìm thấy giao dịch nào khớp với điều kiện lọc hiện tại. Vui lòng thử tìm kiếm khác hoặc xóa bộ lọc.
          </p>
          {onResetFilter && (
            <button type="button" className="recon-btn recon-btn-primary" onClick={onResetFilter}>
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="recon-table-card">
      <div className="recon-table-responsive">
        <table className="recon-table">
          <thead>
            <tr>
              <th scope="col" className="recon-th th-code">Mã GD Ngân hàng</th>
              <th scope="col" className="recon-th th-time">Thời gian</th>
              <th scope="col" className="recon-th th-amount">Số tiền</th>
              <th scope="col" className="recon-th th-content">Nội dung chuyển khoản</th>
              <th scope="col" className="recon-th th-invoice">Khớp với hóa đơn</th>
              <th scope="col" className="recon-th th-status">Trạng thái</th>
              <th scope="col" className="recon-th th-action">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const isManualRequired =
                tx.action === 'MANUAL_MATCH' ||
                tx.status === 'INVALID_SYNTAX' ||
                tx.status === 'STUDENT_NOT_FOUND' ||
                tx.status === 'MANUAL_REQUIRED';

              const isMatched =
                !isManualRequired &&
                (tx.status === 'MATCHED' ||
                  tx.status === 'AUTO_MATCHED' ||
                  tx.status === 'MATCHED_MANUALLY' ||
                  Boolean(tx.invoiceCode));

              const matchedCode =
                tx.invoiceCode ||
                (tx.matched_invoice && !tx.matched_invoice.startsWith('Thiếu') && !tx.matched_invoice.startsWith('Không')
                  ? tx.matched_invoice
                  : null);

              const missingText =
                isMatched && matchedCode
                  ? matchedCode
                  : 'Thiếu mã sinh viên';

              return (
                <tr key={tx.id} className="recon-tr">
                  {/* Cột 1: Mã GD Ngân hàng */}
                  <td className="recon-td td-code">
                    <button
                      type="button"
                      className="recon-code-text recon-code-clickable"
                      onClick={() => onViewDetail && onViewDetail(tx)}
                      title="Nhấn để xem chi tiết giao dịch này"
                    >
                      {tx.bankTransactionCode || tx.id}
                    </button>
                  </td>

                  {/* Cột 2: Thời gian */}
                  <td className="recon-td td-time">
                    <span className="recon-time-text">{tx.transactionDate}</span>
                  </td>

                  {/* Cột 3: Số tiền */}
                  <td className="recon-td td-amount">
                    <span className="recon-amount-text">{formatAmount(tx.amount)}</span>
                  </td>

                  {/* Cột 4: Nội dung chuyển khoản */}
                  <td className="recon-td td-content">
                    <span className="recon-content-text" title={tx.transferContent}>
                      {tx.transferContent}
                    </span>
                  </td>

                  {/* Cột 5: Khớp với hóa đơn */}
                  <td className="recon-td td-invoice">
                    {isMatched && matchedCode ? (
                      <span className="recon-invoice-matched">
                        {matchedCode}
                      </span>
                    ) : (
                      <span className="recon-invoice-missing">
                        {missingText}
                      </span>
                    )}
                  </td>

                  {/* Cột 6: Trạng thái */}
                  <td className="recon-td td-status">
                    <TransactionStatusBadge
                      status={isMatched ? 'MATCHED' : 'INVALID_SYNTAX'}
                      customLabel={isMatched ? 'Đã khớp' : 'Sai cú pháp'}
                    />
                  </td>

                  {/* Cột 7: Thao tác */}
                  <td className="recon-td td-action">
                    {isManualRequired ? (
                      <button
                        type="button"
                        className="recon-action-link recon-action-match"
                        onClick={() => onOpenManualMatch(tx)}
                        title="Gán hóa đơn và xử lý giao dịch này"
                      >
                        Khớp tay
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="recon-action-link recon-action-view"
                        onClick={() => onViewDetail && onViewDetail(tx)}
                        title="Xem chi tiết giao dịch"
                      >
                        Xem
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
