/**
 * Component Bộ lọc (Filters) cho trang Đối soát giao dịch:
 * - Từ ngày
 * - Đến ngày
 * - Ngân hàng
 * - Trạng thái
 * - Ô tìm kiếm ("Tìm mã giao dịch hoặc nội dung chuyển khoản")
 * - Nút "Lọc" và "Đặt lại"
 */
export default function ReconciliationFilters({
  filters,
  onFilterChange,
  onApplyFilter,
  onResetFilter,
}) {
  const handleChange = (field, value) => {
    onFilterChange(field, value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onApplyFilter();
    }
  };

  return (
    <div className="recon-filter-card" role="search" aria-label="Bộ lọc đối soát">
      <div className="recon-filter-grid">
        {/* Ô tìm kiếm */}
        <div className="recon-filter-item recon-filter-search">
          <label htmlFor="recon-search" className="recon-filter-label">Tìm kiếm</label>
          <div className="recon-input-wrapper">
            <span className="recon-input-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              id="recon-search"
              type="text"
              className="recon-input recon-search-input"
              placeholder="Tìm mã giao dịch hoặc nội dung chuyển khoản"
              value={filters.search}
              onChange={(e) => handleChange('search', e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>

        {/* Trạng thái */}
        <div className="recon-filter-item">
          <label htmlFor="recon-status" className="recon-filter-label">Trạng thái</label>
          <select
            id="recon-status"
            className="recon-select"
            value={filters.status}
            onChange={(e) => handleChange('status', e.target.value)}
          >
            <option value="ALL">Tất cả</option>
            <option value="MATCHED">Đã khớp</option>
            <option value="INVALID_SYNTAX">Sai cú pháp</option>
            <option value="PARTIAL">Chuyển thiếu</option>
          </select>
        </div>

        {/* Từ ngày */}
        <div className="recon-filter-item">
          <label htmlFor="recon-from-date" className="recon-filter-label">Từ ngày</label>
          <input
            id="recon-from-date"
            type="date"
            className="recon-input"
            value={filters.fromDate}
            onChange={(e) => handleChange('fromDate', e.target.value)}
          />
        </div>

        {/* Đến ngày */}
        <div className="recon-filter-item">
          <label htmlFor="recon-to-date" className="recon-filter-label">Đến ngày</label>
          <input
            id="recon-to-date"
            type="date"
            className="recon-input"
            value={filters.toDate}
            onChange={(e) => handleChange('toDate', e.target.value)}
          />
        </div>
      </div>

      {/* Action Buttons: Lọc & Đặt lại */}
      <div className="recon-filter-actions">
        <button
          type="button"
          className="recon-btn recon-btn-primary"
          onClick={onApplyFilter}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span>Lọc</span>
        </button>

        <button
          type="button"
          className="recon-btn recon-btn-outline"
          onClick={onResetFilter}
          title="Xóa toàn bộ điều kiện tìm kiếm để hiển thị lại danh sách ban đầu"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          <span>Xóa bộ lọc</span>
        </button>
      </div>
    </div>
  );
}
