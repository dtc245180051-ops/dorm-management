/**
 * Component hiển thị 3 Card Thống kê đối soát (Chuẩn 100% Screenshot Figma)
 * - TỔNG GIAO DỊCH NHẬN (Xanh dương)
 * - KHỚP TỰ ĐỘNG (Xanh lá)
 * - CẦN XỬ LÝ TAY (Đỏ) - Mặc định là 0
 */
export default function ReconciliationStats({
  totalCount = 0,
  autoMatchedCount = 0,
  manualRequiredCount = 0,
}) {
  return (
    <div className="recon-stats-grid" aria-label="Thống kê đối soát giao dịch">
      {/* CARD 1: TỔNG GIAO DỊCH NHẬN */}
      <div className="recon-stat-card">
        <div className="recon-stat-label">TỔNG GIAO DỊCH NHẬN</div>
        <div className="recon-stat-value text-blue">{totalCount}</div>
      </div>

      {/* CARD 2: KHỚP TỰ ĐỘNG */}
      <div className="recon-stat-card">
        <div className="recon-stat-label">KHỚP TỰ ĐỘNG</div>
        <div className="recon-stat-value text-green">{autoMatchedCount}</div>
      </div>

      {/* CARD 3: CẦN XỬ LÝ TAY */}
      <div className="recon-stat-card">
        <div className="recon-stat-label">CẦN XỬ LÝ TAY</div>
        <div className="recon-stat-value text-red">{manualRequiredCount}</div>
      </div>
    </div>
  );
}
