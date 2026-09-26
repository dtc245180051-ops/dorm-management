import { useState } from 'react';
import './StudentDashboard.css';
import campusBanner from '../../assets/image.png';

/**
 * ============================================================================
 * MOCK DATA CHO PHÂN HỆ SINH VIÊN (Khớp 100% bản thiết kế Figma)
 * ============================================================================
 */
const MOCK_STUDENT_DATA = {
  room: {
    roomNumber: 'P36',
    building: 'Tòa A2',
    floor: 'Tầng 3',
    currentMembers: 6,
    maxCapacity: 8,
  },
  billing: {
    amount: '1.940.000đ',
    period: '/năm',
    status: 'Đã thanh toán',
  },
  complaints: {
    total: 0,
    processing: 0,
    resolved: 0,
  },
  notifications: [
    { id: 1, title: 'Thông báo đăng ký ở (2026-2027)', date: '01/08/2026' },
    { id: 2, title: 'Danh sách phòng trống', date: '25/08/2026' },
    { id: 3, title: 'Kiểm tra phòng định kỳ', date: '15/09/2026' },
  ],
  services: [
    {
      id: 'reg-room',
      title: 'Đăng ký phòng',
      desc: 'Đăng ký ở KTX theo kỳ hoặc theo nhu cầu.',
      cardClass: 'card-blue', // Ô 1: Xanh dương
      iconType: 'calendar',
    },
    {
      id: 'move-room',
      title: 'Chuyển / trả phòng',
      desc: 'Thực hiện chuyển phòng hoặc trả phòng khi cần thiết.',
      cardClass: 'card-green', // Ô 2: Xanh lá cây
      iconType: 'exchange',
    },
    {
      id: 'search-room',
      title: 'Tra cứu phòng trống',
      desc: 'Xem danh sách phòng trống hiện có tại các khu',
      cardClass: 'card-purple', // Ô 3: Tím hồng
      iconType: 'search',
    },
    {
      id: 'history-room',
      title: 'Lịch sử phòng',
      desc: 'Xem lịch sử phòng ở và quá trình lưu trú của bạn.',
      cardClass: 'card-orange', // Ô 4: Nâu cam
      iconType: 'clock',
    },
    {
      id: 'payment',
      title: 'Thanh toán phí KTX',
      desc: 'Tra cứu và thanh toán các khoản phí ký túc xá',
      cardClass: 'card-teal', // Ô 5: Xanh ngọc mint
      iconType: 'card',
    },
    {
      id: 'feedback',
      title: 'Gửi phản ánh',
      desc: 'Gửi yêu cầu hỗ trợ, phản ánh các vấn đề trong KTX',
      cardClass: 'card-slate', // Ô 6: Xám xanh
      iconType: 'message',
    },
  ],
};

export default function StudentDashboard({ user }) {
  const [activeModal, setActiveModal] = useState(null);

  // Lấy tên hiển thị của sinh viên: ưu tiên dữ liệu đăng nhập, fallback 'Nguyễn Văn A' chuẩn theo ảnh
  const displayName =
    user?.nguoi_dung?.ho_ten ||
    user?.ho_ten ||
    user?.username ||
    localStorage.getItem('ktx_username') ||
    'Nguyễn Văn A';

  const handleCardClick = (service) => {
    setActiveModal({
      title: service.title,
      desc: service.desc,
      detail: `Tính năng "${service.title}" đã được thiết kế sẵn sàng kết nối API dữ liệu từ hệ thống Ký túc xá.`,
    });
  };

  const handleOpenChatbot = (topic) => {
    setActiveModal({
      title: 'Chatbot Trợ lý ảo KTX',
      desc: topic ? `Chủ đề tư vấn: ${topic}` : 'Hỏi đáp nội quy và dịch vụ KTX 24/7',
      detail: 'Hệ thống Chatbot RAG đang sẵn sàng hỗ trợ giải đáp thắc mắc nội quy, bảng giá dịch vụ và thủ tục đăng ký phòng.',
    });
  };

  const closeModal = () => setActiveModal(null);

  return (
    <>
      {/* ================= BANNER CHÀO MỪNG ================= */}
      <section className="student-banner-card">
        <div
          className="student-banner-bg"
          style={{ backgroundImage: `url(${campusBanner})` }}
        />
        <div className="student-banner-overlay" />
        <div className="student-banner-content">
          <h1 className="student-banner-title">Xin chào, {displayName}</h1>
          <p className="student-banner-subtitle">
            Chào mừng bạn trở lại. Đây là trang quản lý ký túc xá dành riêng cho sinh viên.
          </p>
          <div className="student-banner-quote">
            Học tập tốt - Sống khỏe - Tuổi trẻ rực rỡ
          </div>
        </div>
      </section>

      {/* ================= 4 THẺ THỐNG KÊ ================= */}
      <section className="student-stats-row">
        {/* Thẻ 1: Phòng hiện tại */}
        <div
          className="student-stat-card"
          onClick={() =>
            setActiveModal({
              title: 'Thông tin phòng hiện tại',
              desc: `Phòng ${MOCK_STUDENT_DATA.room.roomNumber} - ${MOCK_STUDENT_DATA.room.building}`,
              detail: `Vị trí: ${MOCK_STUDENT_DATA.room.floor}. Trạng thái giường đang lưu trú hiệu lực.`,
            })
          }
        >
          <div className="student-stat-left">
            <div className="student-stat-icon-box blue">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20V9.5z" />
                <polyline points="9 21 9 12 15 12 15 21" />
              </svg>
            </div>
            <div className="student-stat-info">
              <span className="student-stat-label">Phòng hiện tại</span>
              <span className="student-stat-value">{MOCK_STUDENT_DATA.room.roomNumber}</span>
              <span className="student-stat-subtext">
                {MOCK_STUDENT_DATA.room.building} - {MOCK_STUDENT_DATA.room.floor}
              </span>
            </div>
          </div>
          <span className="student-stat-arrow">›</span>
        </div>

        {/* Thẻ 2: Số thành viên */}
        <div
          className="student-stat-card"
          onClick={() =>
            setActiveModal({
              title: 'Danh sách thành viên phòng',
              desc: `Hiện có ${MOCK_STUDENT_DATA.room.currentMembers} / ${MOCK_STUDENT_DATA.room.maxCapacity} sinh viên`,
              detail: 'Phòng đang còn 2 chỗ trống cho đợt tiếp nhận kỳ mới.',
            })
          }
        >
          <div className="student-stat-left">
            <div className="student-stat-icon-box cyan">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="student-stat-info">
              <span className="student-stat-label">Số thành viên</span>
              <span className="student-stat-value">
                {MOCK_STUDENT_DATA.room.currentMembers}/{MOCK_STUDENT_DATA.room.maxCapacity}
              </span>
              <span className="student-stat-subtext">Hiện tại / sức chứa</span>
            </div>
          </div>
          <span className="student-stat-arrow">›</span>
        </div>

        {/* Thẻ 3: Phí KTX */}
        <div
          className="student-stat-card"
          onClick={() =>
            setActiveModal({
              title: 'Tình trạng phí Ký túc xá',
              desc: `Số tiền: ${MOCK_STUDENT_DATA.billing.amount}`,
              detail: 'Bạn đã hoàn tất nộp phí lưu trú năm học 2026 - 2027. Không có công nợ tồn đọng.',
            })
          }
        >
          <div className="student-stat-left">
            <div className="student-stat-icon-box amber">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v10" />
                <path d="M15 9.5a2.5 2.5 0 0 0-5 0c0 2.5 5 2 5 5a2.5 2.5 0 0 1-5 0" />
              </svg>
            </div>
            <div className="student-stat-info">
              <span className="student-stat-label">Phí KTX</span>
              <span className="student-stat-value">
                {MOCK_STUDENT_DATA.billing.amount}{' '}
                <span style={{ fontSize: '11px', fontWeight: 500, color: '#64748B' }}>
                  {MOCK_STUDENT_DATA.billing.period}
                </span>
              </span>
              <span className="student-stat-badge">{MOCK_STUDENT_DATA.billing.status}</span>
            </div>
          </div>
          <span className="student-stat-arrow">›</span>
        </div>

        {/* Thẻ 4: Phản ánh */}
        <div
          className="student-stat-card"
          onClick={() =>
            setActiveModal({
              title: 'Phản ánh sự cố',
              desc: 'Tình trạng khiếu nại & báo hỏng thiết bị',
              detail: 'Hiện chưa có khiếu nại hay báo hỏng thiết bị nào đang chờ xử lý.',
            })
          }
        >
          <div className="student-stat-left">
            <div className="student-stat-icon-box green">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="student-stat-info">
              <span className="student-stat-label">Phản ánh</span>
              <span className="student-stat-value">{MOCK_STUDENT_DATA.complaints.total}</span>
              <span className="student-stat-subtext">
                Đang xử lý: {MOCK_STUDENT_DATA.complaints.processing} | Đã xử lý: {MOCK_STUDENT_DATA.complaints.resolved}
              </span>
            </div>
          </div>
          <span className="student-stat-arrow">›</span>
        </div>
      </section>

      {/* ================= KHU VỰC CHÍNH (SPLIT GRID) ================= */}
      <section className="student-grid-split">
        {/* CỘT TRÁI: CHỨC NĂNG SINH VIÊN (3 CỘT X 2 HÀNG, MIN-HEIGHT 140PX, PADDING 24PX) */}
        <div className="student-actions-panel">
          <div className="student-actions-header">
            <div className="student-actions-title">
              <div className="student-actions-title-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </div>
              <span>Chức năng sinh viên</span>
            </div>
            <span
              className="student-actions-subtitle"
              onClick={() =>
                setActiveModal({
                  title: 'Dịch vụ sinh viên KTX',
                  desc: 'Hỗ trợ sinh viên nội trú',
                  detail: 'Hệ thống cung cấp trọn gói các tiện ích: Đăng ký phòng, chuyển/trả phòng, tra cứu phòng trống và thanh toán trực tuyến.',
                })
              }
            >
              Các dịch vụ hỗ trợ bạn trong quá trình ở ktx ›
            </span>
          </div>

          {/* Grid 3 Cột x 2 Hàng */}
          <div className="student-actions-grid">
            {MOCK_STUDENT_DATA.services.map((service) => (
              <div
                key={service.id}
                className={`student-action-card ${service.cardClass}`}
                onClick={() => handleCardClick(service)}
              >
                <div className="student-action-body">
                  <div className="student-action-header-row">
                    <div className="student-action-icon-circle">
                      {/* Calendar Icon */}
                      {service.iconType === 'calendar' && (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      )}
                      {/* Arrows Icon */}
                      {service.iconType === 'exchange' && (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 16V4m0 0L3 8m4-4l4 4" />
                          <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                      )}
                      {/* Search Icon */}
                      {service.iconType === 'search' && (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="7" />
                          <line x1="21" y1="21" x2="16" y2="16" />
                        </svg>
                      )}
                      {/* Clock Icon */}
                      {service.iconType === 'clock' && (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="9" />
                          <polyline points="12 7 12 12 15 14" />
                        </svg>
                      )}
                      {/* Credit Card Icon */}
                      {service.iconType === 'card' && (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="5" width="20" height="14" rx="2" />
                          <line x1="2" y1="10" x2="22" y2="10" />
                        </svg>
                      )}
                      {/* Message Icon */}
                      {service.iconType === 'message' && (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      )}
                    </div>
                    <span className="student-action-name">{service.title}</span>
                  </div>

                  <p className="student-action-desc">{service.desc}</p>
                </div>

                {/* Nút mũi tên: width 36px, height 36px, border-radius 50%, bg #EBF3FE, icon #2563EB size 16px */}
                <div className="student-action-arrow-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CỘT PHẢI: CHATBOT KTX & THÔNG BÁO MỚI NHẤT */}
        <div className="student-side-column">
          {/* Card 1: Chatbot KTX (Nền #EDF5FF, border-radius 20px, padding 20px) */}
          <div className="student-chatbot-card">
            <div className="student-chatbot-header">
              <div className="student-chatbot-identity">
                <div className="student-robot-avatar">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="8" width="16" height="12" rx="2" />
                    <line x1="12" y1="4" x2="12" y2="8" />
                    <circle cx="9" cy="13" r="1" fill="currentColor" />
                    <circle cx="15" cy="13" r="1" fill="currentColor" />
                    <path d="M10 16h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="student-chatbot-title">Chatbot KTX</h3>
                  <span className="student-chatbot-subtitle">Luôn sẵn sàng hỗ trợ bạn</span>
                </div>
              </div>
              <div className="student-chatbot-bubble-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
            </div>

            {/* Quick Suggestion Chips (Dạng Pill: background #FFFFFF, border-radius 20px, padding 8px 16px, font-size 13px, 2 hàng) */}
            <div className="student-chatbot-chips">
              <div className="student-chatbot-chip-row">
                <button
                  className="student-chatbot-chip"
                  onClick={() => handleOpenChatbot('Hỏi về nội quy')}
                >
                  Hỏi về nội quy
                </button>
                <button
                  className="student-chatbot-chip"
                  onClick={() => handleOpenChatbot('Tra cứu phòng')}
                >
                  Tra cứu phòng
                </button>
              </div>
              <button
                className="student-chatbot-chip full-chip"
                onClick={() => handleOpenChatbot('Hỏi về đăng ký phòng')}
              >
                Hỏi về đăng ký phòng
              </button>
            </div>

            {/* Nút "Mở chatbot →": background #1D68FE, màu chữ trắng, border-radius 12px, padding 12px */}
            <button
              className="student-chatbot-cta-btn"
              onClick={() => handleOpenChatbot('Tư vấn tự do')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="8" width="16" height="12" rx="2" />
                <path d="M12 4v4" />
              </svg>
              <span>Mở chatbot →</span>
            </button>
          </div>

          {/* Card 2: Thông báo mới nhất */}
          <div className="student-notif-card">
            <div className="student-notif-header">
              <div className="student-notif-header-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <span>Thông báo mới nhất</span>
            </div>

            <div className="student-notif-list">
              {MOCK_STUDENT_DATA.notifications.map((item) => (
                <div
                  key={item.id}
                  className="student-notif-item"
                  onClick={() =>
                    setActiveModal({
                      title: item.title,
                      desc: `Ngày đăng: ${item.date}`,
                      detail: 'Chi tiết thông báo từ Ban quản lý Ký túc xá về kế hoạch công tác và thời hạn đăng ký.',
                    })
                  }
                >
                  <div className="student-notif-title-wrap">
                    <span className="student-notif-dot" />
                    <span>{item.title}</span>
                  </div>
                  <span className="student-notif-date">{item.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= MODAL XEM CHI TIẾT TÍNH NĂNG ================= */}
      {activeModal && (
        <div className="student-modal-backdrop" onClick={closeModal}>
          <div className="student-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="student-modal-header">
              <h4 className="student-modal-title">{activeModal.title}</h4>
              <button className="student-modal-close-btn" onClick={closeModal}>
                ✕
              </button>
            </div>
            <div className="student-modal-body">
              <p style={{ fontWeight: 600, color: '#1D68FE', marginBottom: 6 }}>
                {activeModal.desc}
              </p>
              <p>{activeModal.detail}</p>
            </div>
            <div className="student-modal-footer">
              <button className="student-modal-primary-btn" onClick={closeModal}>
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
