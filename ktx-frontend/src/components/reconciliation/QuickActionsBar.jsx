import { useRef } from 'react';

/**
 * Component "Thao tác nhanh" (Quick Actions Bar) bám sát UI Mockup & Luồng Upload file sao kê:
 * - Tải lên sao kê excel/csv [Tên file / Nút chọn file]
 * - Kỳ [Tháng 09/2026]
 */
export default function QuickActionsBar({
  statementFile = '',
  onFileUpload,
  period = 'Tháng 09/2026',
  onPeriodChange,
  isUploading = false,
}) {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="recon-quick-actions-card">
      <h3 className="recon-section-heading">Thao tác nhanh</h3>

      <div className="recon-quick-rows">
        {/* Row 1: Tải lên sao kê excel/csv */}
        <div className="recon-quick-row">
          <span className="recon-quick-label">Tải lên sao kê excel/csv</span>
          <div className="recon-quick-action" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".csv, .xlsx, .xls"
              onChange={handleFileSelect}
            />

            {statementFile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="recon-file-link-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Nhấn để chọn file sao kê khác"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span>{statementFile}</span>
                </button>
                <button
                  type="button"
                  style={{
                    fontSize: '12px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    color: '#475569',
                    fontWeight: 500,
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  title="Chọn file sao kê khác"
                >
                  Đổi file
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    backgroundColor: '#eff6ff',
                    border: '1.5px dashed #3b82f6',
                    borderRadius: '8px',
                    color: '#1d4ed8',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>{isUploading ? 'Đang xử lý...' : 'Chọn file sao kê (.xlsx, .csv)'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Kỳ */}
        <div className="recon-quick-row">
          <span className="recon-quick-label">Kỳ</span>
          <div className="recon-quick-action recon-period-picker">
            <span
              style={{
                fontSize: '13.5px',
                fontWeight: 600,
                color: period && period !== '--' ? '#0f172a' : '#94a3b8',
                paddingRight: '6px',
              }}
            >
              {period && period !== '--' ? period : '--'}
            </span>
            <span className="recon-calendar-icon" title="Kỳ đối soát tự động theo file sao kê">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
