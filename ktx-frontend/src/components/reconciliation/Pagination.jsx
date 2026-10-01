/**
 * Component Phân trang (Pagination)
 */
export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 5,
  onPageChange,
}) {
  if (totalPages <= 1) return null;

  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalItems);

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  return (
    <div className="recon-pagination" aria-label="Phân trang bảng giao dịch">
      <div className="recon-pagination-info">
        Hiển thị <strong>{startIdx} - {endIdx}</strong> trên tổng số <strong>{totalItems}</strong> giao dịch
      </div>

      <div className="recon-pagination-buttons">
        {/* Nút Trước */}
        <button
          type="button"
          className="recon-page-btn recon-page-nav"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Trang trước"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Danh sách các số trang */}
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`recon-page-btn ${p === currentPage ? 'active' : ''}`}
            onClick={() => onPageChange(p)}
            aria-current={p === currentPage ? 'page' : undefined}
          >
            {p}
          </button>
        ))}

        {/* Nút Kế tiếp */}
        <button
          type="button"
          className="recon-page-btn recon-page-nav"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Trang kế tiếp"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
