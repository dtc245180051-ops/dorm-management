/**
 * Danh mục cấu hình ngân hàng và trạng thái hiển thị Đối soát giao dịch
 * (Đã xóa toàn bộ mock transactions, mock students và mock invoices)
 */

/**
 * Danh sách ngân hàng hỗ trợ
 */
export const SUPPORTED_BANKS = [
  { id: 'all', name: 'Tất cả ngân hàng' },
  { id: 'tpbank', name: 'TP Bank - TK 20020813520' },
  { id: 'vcb', name: 'Vietcombank - TK 1012345678' },
  { id: 'bidv', name: 'BIDV - TK 123456789' },
];

/**
 * Cấu hình Badge và nhãn trạng thái đối soát
 */
export const RECONCILIATION_STATUS = {
  MATCHED: {
    key: 'MATCHED',
    label: 'Đã khớp',
    badgeLabel: 'Đã khớp',
    badgeClass: 'badge-matched',
    color: '#16a34a',
  },
  AUTO_MATCHED: {
    key: 'AUTO_MATCHED',
    label: 'Đã khớp',
    badgeLabel: 'Đã khớp',
    badgeClass: 'badge-matched',
    color: '#16a34a',
  },
  MATCHED_MANUALLY: {
    key: 'MATCHED_MANUALLY',
    label: 'Đã khớp',
    badgeLabel: 'Đã khớp',
    badgeClass: 'badge-matched',
    color: '#16a34a',
  },
  INVALID_SYNTAX: {
    key: 'INVALID_SYNTAX',
    label: 'Sai cú pháp',
    badgeLabel: 'Sai cú pháp',
    badgeClass: 'badge-warning',
    color: '#ef4444',
  },
  STUDENT_NOT_FOUND: {
    key: 'STUDENT_NOT_FOUND',
    label: 'Sai cú pháp',
    badgeLabel: 'Sai cú pháp',
    badgeClass: 'badge-warning',
    color: '#ef4444',
  },
  MANUAL_REQUIRED: {
    key: 'MANUAL_REQUIRED',
    label: 'Sai cú pháp',
    badgeLabel: 'Sai cú pháp',
    badgeClass: 'badge-warning',
    color: '#ef4444',
  },
  ERROR: {
    key: 'ERROR',
    label: 'Lỗi đối soát',
    badgeLabel: 'Lỗi đối soát',
    badgeClass: 'badge-error',
    color: '#dc2626',
  },
  PARTIAL: {
    key: 'PARTIAL',
    label: 'Chuyển thiếu',
    badgeLabel: 'Chuyển thiếu',
    badgeClass: 'badge-partial',
    color: '#ea580c',
  },
};
