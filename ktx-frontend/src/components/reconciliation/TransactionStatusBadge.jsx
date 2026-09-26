import { RECONCILIATION_STATUS } from '../../data/mockReconciliationData';

/**
 * Component hiển thị Badge Trạng thái giao dịch đối soát
 * - AUTO_MATCHED: Đã khớp (Màu xanh lá)
 * - MATCHED_MANUALLY: Khớp thủ công (Màu xanh dương)
 * - MANUAL_REQUIRED: Sai cú pháp / Cần xử lý (Màu đỏ/cam)
 * - ERROR: Lỗi đối soát (Màu đỏ đậm)
 */
export default function TransactionStatusBadge({ status, customLabel }) {
  const config = RECONCILIATION_STATUS[status] || {
    label: status,
    badgeLabel: status,
    badgeClass: 'badge-default',
    color: '#64748b',
  };

  const displayText = customLabel || config.badgeLabel || config.label;

  return (
    <span className={`recon-status-badge ${config.badgeClass}`} title={config.label}>
      <span className="recon-status-dot" />
      <span>{displayText}</span>
    </span>
  );
}
