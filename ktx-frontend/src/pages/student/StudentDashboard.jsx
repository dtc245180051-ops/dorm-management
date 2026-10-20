import { useState, useEffect } from "react";
import "./StudentDashboard.css";
import campusBanner from "../../assets/image.png";
import occupancyService from "../../services/occupancyService";
import feedbackService from "../../services/feedbackService";

// Dữ liệu tĩnh cho danh sách chức năng (không phải dữ liệu người dùng)
const SERVICE_LIST = [
  {
    id: "reg-room",
    title: "Đăng ký phòng",
    desc: "Đăng ký ở KTX theo kỳ hoặc theo nhu cầu.",
    cardClass: "card-blue", // Ô 1: Xanh dương
    iconType: "calendar",
  },
  {
    id: "move-room",
    title: "Chuyển / trả phòng",
    desc: "Thực hiện chuyển phòng hoặc trả phòng khi cần thiết.",
    cardClass: "card-green", // Ô 2: Xanh lá cây
    iconType: "exchange",
  },
  {
    id: "search-room",
    title: "Tra cứu phòng trống",
    desc: "Xem danh sách phòng trống hiện có tại các khu",
    cardClass: "card-purple", // Ô 3: Tím hồng
    iconType: "search",
  },
  {
    id: "history-room",
    title: "Lịch sử phòng",
    desc: "Xem lịch sử phòng ở và quá trình lưu trú của bạn.",
    cardClass: "card-orange", // Ô 4: Nâu cam
    iconType: "clock",
  },
  {
    id: "payment",
    title: "Thanh toán phí KTX",
    desc: "Tra cứu và thanh toán các khoản phí ký túc xá",
    cardClass: "card-teal", // Ô 5: Xanh ngọc mint
    iconType: "card",
  },
  {
    id: "feedback",
    title: "Gửi phản ánh",
    desc: "Gửi yêu cầu hỗ trợ, phản ánh các vấn đề trong KTX",
    cardClass: "card-slate", // Ô 6: Xám xanh
    iconType: "message",
  },
];

// Thông báo tĩnh mẫu (không phải dữ liệu cá nhân sinh viên)
const STATIC_NOTIFICATIONS = [
  { id: 1, title: "Thông báo đăng ký ở (2026-2027)", date: "01/08/2026" },
  { id: 2, title: "Danh sách phòng trống", date: "25/08/2026" },
  { id: 3, title: "Kiểm tra phòng định kỳ", date: "15/09/2026" },
];

export default function StudentDashboard({ user, onNavigate }) {
  const [activeModal, setActiveModal] = useState(null);
  const [currentRoomInfo, setCurrentRoomInfo] = useState(null);
  const [billing, setBilling] = useState(null);
  const [complaints, setComplaints] = useState({ total: 0, processing: 0, resolved: 0 });
  const [registrationStatus, setRegistrationStatus] = useState(null);

  const loadRoomInfo = async () => {
    try {
      const msv = user?.msv || user?.nguoi_dung?.sinh_vien?.msv || localStorage.getItem("ktx_username") || "";
      if (!msv) {
        setCurrentRoomInfo(null);
        setBilling(null);
        return;
      }
      const info = await occupancyService.getCurrentRoomInfo(msv);
      if (info && info.so_phong) {
        setCurrentRoomInfo(info);
        setBilling(info.billing || null);
      } else {
        setCurrentRoomInfo(null);
        setBilling(null);
      }
    } catch (e) {
      console.error("Error loading room info in StudentDashboard:", e);
      setCurrentRoomInfo(null);
      setBilling(null);
    }
  };

  const loadComplaints = async () => {
    try {
      const msv = user?.msv || user?.nguoi_dung?.sinh_vien?.msv || localStorage.getItem("ktx_username") || "";
      const list = await feedbackService.getStudentIncidents(msv);
      const processing = list.filter((f) => ["Chờ tiếp nhận", "Đang xử lý", "CHO_TIEP_NHAN", "CHO_XU_LY", "DANG_XU_LY"].includes(f.trang_thai || f.status)).length;
      const resolved = list.filter((f) => ["Đã giải quyết", "DA_GIAI_QUYET", "DA_XU_LY"].includes(f.trang_thai || f.status)).length;
      setComplaints({ total: list.length, processing, resolved });
    } catch (error) {
      console.warn("Không thể tải phản ánh của sinh viên:", error);
      setComplaints({ total: 0, processing: 0, resolved: 0 });
    }
  };

  const loadRegistrationStatus = async () => {
    try {
      const msv = user?.msv || user?.nguoi_dung?.sinh_vien?.msv || localStorage.getItem("ktx_username") || "";
      if (msv) {
        const reqs = await occupancyService.getMyRequests(msv);
        if (Array.isArray(reqs) && reqs.length > 0) {
          setRegistrationStatus(reqs[0]);
          return;
        }
      }
      const raw = localStorage.getItem("dorm_registration_requests");
      if (raw) {
        const list = JSON.parse(raw);
        const real = list.find(
          (r) => r.msv && !r.msv.includes("xxxxxxxx") && !r.msv.includes("XXXXXX")
        );
        setRegistrationStatus(real || null);
      } else {
        setRegistrationStatus(null);
      }
    } catch (_) {
      setRegistrationStatus(null);
    }
  };

  useEffect(() => {
    // Dọn dẹp cache cũ chứa dữ liệu mẫu (P36, 6/8...) nếu có
    const cachedRoom = localStorage.getItem("dorm_current_room_info");
    if (cachedRoom) {
      try {
        const parsed = JSON.parse(cachedRoom);
        if (parsed?.so_phong === "36" || parsed?.phong_hien_tai?.includes("P36")) {
          localStorage.removeItem("dorm_current_room_info");
        }
      } catch (_) {
        localStorage.removeItem("dorm_current_room_info");
      }
    }

    loadRoomInfo();
    loadRegistrationStatus();
    loadComplaints();

    let updateTimer = null;
    const handleUpdate = () => {
      if (updateTimer) clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        loadRoomInfo();
        loadRegistrationStatus();
        loadComplaints();
      }, 150);
    };

    window.addEventListener("occupancy-updated", handleUpdate);
    window.addEventListener("student-account-updated", handleUpdate);
    window.addEventListener("student-incidents-updated", handleUpdate);

    return () => {
      if (updateTimer) clearTimeout(updateTimer);
      window.removeEventListener("occupancy-updated", handleUpdate);
      window.removeEventListener("student-account-updated", handleUpdate);
      window.removeEventListener("student-incidents-updated", handleUpdate);
    };
  }, []);

  const displayName =
    user?.ho_ten ||
    user?.nguoi_dung?.ho_ten ||
    localStorage.getItem("ktx_fullname") ||
    user?.username ||
    localStorage.getItem("ktx_username") ||
    "Nguyễn Văn A";

  const handleCardClick = (service) => {
    if (onNavigate) {
      if (service.id === "reg-room") {
        onNavigate("/student/register");
        return;
      }
      if (service.id === "move-room") {
        onNavigate("/student/transfer-room");
        return;
      }
      if (service.id === "history-room") {
        onNavigate("/student/history");
        return;
      }
      if (service.id === "search-room" || service.id === "lookup") {
        onNavigate("/student/lookup");
        return;
      }
      if (service.id === "payment") {
        onNavigate("/student/payment");
        return;
      }
      if (service.id === "feedback") {
        onNavigate("/student/feedback");
        return;
      }
      if (service.id === "profile" || service.id === "thong-tin-ca-nhan") {
        onNavigate("/student/profile");
        return;
      }
    }
    setActiveModal({
      title: service.title,
      desc: service.desc,
      detail: `Tính năng "${service.title}" đã được thiết kế sẵn sàng kết nối API dữ liệu từ hệ thống Ký túc xá.`,
    });
  };

  const handleOpenChatbot = (topic) => {
    window.dispatchEvent(
      new CustomEvent("student-open-chatbot", {
        detail: { topic: topic === "Tư vấn tự do" ? "" : topic },
      }),
    );
  };

  const closeModal = () => setActiveModal(null);

  return (
    <div className="student-main-content min-h-full w-full">
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
            Chào mừng bạn trở lại. Đây là trang quản lý ký túc xá dành riêng cho
            sinh viên.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginTop: "10px",
            }}
          >
            <div className="student-banner-quote" style={{ marginTop: 0 }}>
              Học tập tốt - Sống khỏe - Tuổi trẻ rực rỡ
            </div>
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
              title: "Thông tin phòng hiện tại",
              desc: currentRoomInfo
                ? `Phòng ${currentRoomInfo.so_phong} - ${currentRoomInfo.toa || ""}`
                : "Chưa có phòng",
              detail: currentRoomInfo
                ? `Vị trí: Tầng ${currentRoomInfo.tang || "--"}. ${currentRoomInfo.thoi_gian_luu_tru || "Trạng thái giường đang lưu trú hiệu lực."}`
                : "Bạn chưa được xếp phòng hoặc hợp đồng lưu trú đã kết thúc. Vui lòng đăng ký phòng để được sắp xếp.",
            })
          }
        >
          <div className="student-stat-left">
            <div className="student-stat-icon-box blue">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9.5L12 3l9 6.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20V9.5z" />
                <polyline points="9 21 9 12 15 12 15 21" />
              </svg>
            </div>
            <div className="student-stat-info">
              <span className="student-stat-label">Phòng hiện tại</span>
              <span className="student-stat-value">
                {currentRoomInfo?.so_phong ? `${currentRoomInfo.so_phong} - Tòa ${(currentRoomInfo.toa || "").replace(/^Tòa\s*/i, "")}` : "Chưa có"}
              </span>
              <span className="student-stat-subtext">
                {currentRoomInfo ? "Đang lưu trú" : "Chưa được xếp phòng"}
              </span>
            </div>
          </div>
          <span className="student-stat-arrow">›</span>
        </div>

        {/* Thẻ 2: Số thành viên */}
        <div
          className="student-stat-card"
          onClick={() => {
            const rawRoom = currentRoomInfo?.so_phong || "203";
            const cleanRoom = String(rawRoom).replace(/^P/i, "");
            const rawToa = currentRoomInfo?.toa || "Tòa A1";
            const roomTitle = `P${cleanRoom} - ${rawToa.startsWith("Tòa") ? rawToa : `Tòa ${rawToa}`}`;
            
            const currentMsv = (user?.msv || user?.nguoi_dung?.sinh_vien?.msv || localStorage.getItem("ktx_username") || "").trim();
            const currentName = (user?.nguoi_dung?.ho_ten || user?.ho_ten || localStorage.getItem("ktx_fullname") || "Sinh viên").trim();

            const memberList = (currentRoomInfo?.danh_sach_thanh_vien && currentRoomInfo.danh_sach_thanh_vien.length > 0)
              ? currentRoomInfo.danh_sach_thanh_vien
              : [
                  {
                    msv: currentMsv,
                    ho_ten: currentName,
                    giuong: currentRoomInfo?.giuong || "G01",
                    so_giuong: currentRoomInfo?.giuong || "G01",
                    lop: user?.lop || localStorage.getItem("ktx_lop") || "",
                    khoa: user?.khoa || localStorage.getItem("ktx_khoa") || "",
                    so_dien_thoai: user?.so_dien_thoai || localStorage.getItem("ktx_phone") || "",
                    vai_tro: "Bạn (Trưởng phòng)",
                    ngay_vao: currentRoomInfo?.ngay_bat_dau || "01/10/2026",
                    trang_thai: "DANG_O",
                    trang_thai_label: "Đang ở",
                    is_current_user: true,
                  },
                ];

            setActiveModal({
              type: "room_members",
              title: "Danh sách thành viên phòng",
              roomTitle,
              tang: currentRoomInfo?.tang || "2",
              members: memberList,
              so_thanh_vien: currentRoomInfo?.so_thanh_vien || memberList.filter(m => !m.is_empty).length || 3,
              suc_chua: currentRoomInfo?.suc_chua || "4 người",
            });
          }}
        >
          <div className="student-stat-left">
            <div className="student-stat-icon-box cyan">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="student-stat-info">
              <span className="student-stat-label">Số thành viên</span>
              <span className="student-stat-value">
                {currentRoomInfo
                  ? (currentRoomInfo.so_thanh_vien !== undefined && currentRoomInfo.suc_chua
                      ? `${currentRoomInfo.so_thanh_vien}/${String(currentRoomInfo.suc_chua).match(/\d+/)?.[0] || 4}`
                      : (currentRoomInfo.thanh_vien?.replace(/người/i, '').trim() || "4/4"))
                  : "—"}
              </span>
              <span className="student-stat-subtext">
                {currentRoomInfo ? "Hiện tại / sức chứa" : "Chưa xếp phòng"}
              </span>
            </div>
          </div>
          <span className="student-stat-arrow">›</span>
        </div>

        {/* Thẻ 3: Phí KTX */}
        <div
          className="student-stat-card"
          onClick={() => {
            setActiveModal({
              title: "Tình trạng phí Ký túc xá",
              desc: billing ? `Số tiền: ${billing.amount}` : "Chưa có thông tin phí",
              detail: billing
                ? (billing.status === "Đã thanh toán"
                  ? "Bạn đã hoàn tất nộp phí lưu trú. Không có công nợ tồn đọng."
                  : "Bạn có khoản phí ký túc xá cần thanh toán.")
                : "Bạn chưa có hợp đồng lưu trú hoặc công nợ phí. Vui lòng kiểm tra lại sau khi được xếp phòng.",
              actionText: billing?.status !== "Đã thanh toán" ? "Thanh toán ngay" : null,
              actionPath: billing?.status !== "Đã thanh toán" ? "/student/payment" : null,
            });
          }}
        >
          <div className="student-stat-left">
            <div className="student-stat-icon-box amber">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v10" />
                <path d="M15 9.5a2.5 2.5 0 0 0-5 0c0 2.5 5 2 5 5a2.5 2.5 0 0 1-5 0" />
              </svg>
            </div>
            <div className="student-stat-info">
              <span className="student-stat-label">Phí KTX</span>
              <span className="student-stat-value">
                {billing ? (
                  <>
                    {billing.amount}{" "}
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        color: "#64748B",
                      }}
                    >
                      {billing.period?.replace("/tháng", "/năm") || "/năm"}
                    </span>
                  </>
                ) : (
                  "0 đ"
                )}
              </span>
              {billing ? (
                <span
                  className={`student-stat-badge ${
                    billing.status === "Đã thanh toán" ? "paid" : "unpaid"
                  }`}
                >
                  {billing.status}
                </span>
              ) : (
                <span className="student-stat-subtext">Chưa phát sinh</span>
              )}
            </div>
          </div>
          <span className="student-stat-arrow">›</span>
        </div>

        {/* Thẻ 4: Phản ánh */}
        <div
          className="student-stat-card"
          onClick={() => {
            if (onNavigate) {
              onNavigate("/student/feedback");
            } else {
              setActiveModal({
                title: "Phản ánh sự cố",
                desc: "Tình trạng khiếu nại & báo hỏng thiết bị",
                detail:
                  "Hiện chưa có khiếu nại hay báo hỏng thiết bị nào đang chờ xử lý.",
              });
            }
          }}
        >
          <div className="student-stat-left">
            <div className="student-stat-icon-box green">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="student-stat-info">
              <span className="student-stat-label">Phản ánh</span>
              <span className="student-stat-value">{complaints.total}</span>
              <span className="student-stat-subtext">
                {complaints.total === 0
                  ? "Chưa có phản ánh"
                  : `Đang xử lý: ${complaints.processing} | Đã xử lý: ${complaints.resolved}`}
              </span>
            </div>
          </div>
          <span className="student-stat-arrow">›</span>
        </div>
      </section>

      {/* ================= KHU VỰC CHÍNH (SPLIT GRID) ================= */}
      <section className="student-grid-split">
        {/* CỘT TRÁI: CHỨC NĂNG SINH VIÊN (3 CỘT X 2 HÀNG) */}
        <div className="student-actions-panel">
          <div className="student-actions-header">
            <div className="student-actions-title">
              <div className="student-actions-title-icon">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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
                  title: "Dịch vụ sinh viên KTX",
                  desc: "Hỗ trợ sinh viên nội trú",
                  detail:
                    "Hệ thống cung cấp trọn gói các tiện ích: Đăng ký phòng, chuyển/trả phòng, tra cứu phòng trống và thanh toán trực tuyến.",
                })
              }
            >
              Các dịch vụ hỗ trợ bạn trong quá trình ở ktx ›
            </span>
          </div>

          {/* Grid 3 Cột x 2 Hàng */}
          <div className="student-actions-grid">
            {SERVICE_LIST.map((service) => (
              <div
                key={service.id}
                className={`student-action-card ${service.cardClass}`}
                onClick={() => handleCardClick(service)}
              >
                <div className="student-action-body">
                  <div className="student-action-header-row">
                    <div className="student-action-icon-circle">
                      {/* Calendar Icon */}
                      {service.iconType === "calendar" && (
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      )}
                      {/* Arrows Icon */}
                      {service.iconType === "exchange" && (
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M7 16V4m0 0L3 8m4-4l4 4" />
                          <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                      )}
                      {/* Search Icon */}
                      {service.iconType === "search" && (
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="11" cy="11" r="7" />
                          <line x1="21" y1="21" x2="16" y2="16" />
                        </svg>
                      )}
                      {/* Clock Icon */}
                      {service.iconType === "clock" && (
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="9" />
                          <polyline points="12 7 12 12 15 14" />
                        </svg>
                      )}
                      {/* Credit Card Icon */}
                      {service.iconType === "card" && (
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="2" y="5" width="20" height="14" rx="2" />
                          <line x1="2" y1="10" x2="22" y2="10" />
                        </svg>
                      )}
                      {/* Message Icon */}
                      {service.iconType === "message" && (
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      )}
                    </div>
                    <span className="student-action-name">{service.title}</span>
                  </div>

                  <p className="student-action-desc">{service.desc}</p>
                </div>

                <div className="student-action-arrow-btn">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
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
          {/* Card 1: Chatbot KTX */}
          <div className="student-chatbot-card">
            <div className="student-chatbot-header">
              <div className="student-chatbot-identity">
                <div className="student-robot-avatar">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="4" y="8" width="16" height="12" rx="2" />
                    <line x1="12" y1="4" x2="12" y2="8" />
                    <circle cx="9" cy="13" r="1" fill="currentColor" />
                    <circle cx="15" cy="13" r="1" fill="currentColor" />
                    <path d="M10 16h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="student-chatbot-title">Chatbot KTX</h3>
                  <span className="student-chatbot-subtitle">
                    Tư vấn quy định, giờ giấc & nếp sống nội trú
                  </span>
                </div>
              </div>
              <div className="student-chatbot-bubble-icon">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="student-chatbot-chips">
              <div className="student-chatbot-chip-row">
                <button
                  className="student-chatbot-chip"
                  onClick={() => handleOpenChatbot("Giờ đóng / mở cổng")}
                >
                  Giờ đóng / mở cổng
                </button>
                <button
                  className="student-chatbot-chip"
                  onClick={() => handleOpenChatbot("Quy định nấu ăn")}
                >
                  Quy định nấu ăn
                </button>
              </div>
              <button
                className="student-chatbot-chip full-chip"
                onClick={() => handleOpenChatbot("Quy định tiếp khách & qua đêm")}
              >
                Quy định tiếp khách & qua đêm
              </button>
            </div>

            <button
              className="student-chatbot-cta-btn"
              onClick={() => handleOpenChatbot("Tư vấn tự do")}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <span>Thông báo mới nhất</span>
            </div>

            <div className="student-notif-list">
              {/* Item đầu tiên: Trạng thái đơn đăng ký — chỉ hiện khi chưa có phòng */}
              {!currentRoomInfo && (
                <div
                  className="student-notif-item"
                  onClick={() => {
                    if (registrationStatus) {
                      onNavigate && onNavigate("/student/history");
                    } else {
                      onNavigate && onNavigate("/student/register");
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <div className="student-notif-title-wrap">
                    <span
                      className="student-notif-dot"
                      style={{
                        backgroundColor: !registrationStatus
                          ? "#94A3B8"
                          : registrationStatus.trang_thai === "CHO_DUYET"
                            ? "#F59E0B"
                            : registrationStatus.trang_thai === "DA_DUYET"
                              ? "#22C55E"
                              : registrationStatus.trang_thai === "TU_CHOI"
                                ? "#EF4444"
                                : "#94A3B8",
                      }}
                    />
                    <span>
                      {!registrationStatus && "Đăng ký chỗ ở KTX"}
                      {registrationStatus?.trang_thai === "CHO_DUYET" &&
                        "Đơn đăng ký — Đang chờ duyệt"}
                      {registrationStatus?.trang_thai === "DA_DUYET" &&
                        "Đơn đăng ký — Đã được duyệt ✔"}
                      {registrationStatus?.trang_thai === "TU_CHOI" &&
                        "Đơn đăng ký — Bị từ chối"}
                      {registrationStatus?.trang_thai === "DA_HUY" &&
                        "Đơn đăng ký — Đã hủy"}
                    </span>
                  </div>
                  <span
                    className="student-notif-date"
                    style={{
                      color: !registrationStatus
                        ? "#94A3B8"
                        : registrationStatus.trang_thai === "CHO_DUYET"
                          ? "#F59E0B"
                          : registrationStatus.trang_thai === "DA_DUYET"
                            ? "#22C55E"
                            : registrationStatus.trang_thai === "TU_CHOI"
                              ? "#EF4444"
                              : "#94A3B8",
                      fontWeight: 600,
                    }}
                  >
                    {!registrationStatus && "Đăng ký ngay"}
                    {registrationStatus?.trang_thai === "CHO_DUYET" && "Chờ duyệt"}
                    {registrationStatus?.trang_thai === "DA_DUYET" && "Đã duyệt"}
                    {registrationStatus?.trang_thai === "TU_CHOI" && "Từ chối"}
                    {registrationStatus?.trang_thai === "DA_HUY" && "Đã hủy"}
                  </span>
                </div>
              )}


            </div>
          </div>
        </div>
      </section>

      {/* ================= MODAL XEM CHI TIẾT TÍNH NĂNG / THÀNH VIÊN ================= */}
      {activeModal && (
        <div className="student-modal-backdrop" onClick={closeModal}>
          <div
            className={`student-modal-card ${activeModal.type === "room_members" ? "student-modal-card-lg" : ""}`}
            onClick={(e) => e.stopPropagation()}
            style={activeModal.type === "room_members" ? { maxWidth: "600px", maxHeight: "90vh" } : {}}
          >
            <div className="student-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {activeModal.type === "room_members" && (
                  <div style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    backgroundColor: "#EFF6FF",
                    color: "#2563EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                )}
                <div>
                  <h4 className="student-modal-title">{activeModal.title}</h4>
                  {activeModal.roomTitle && (
                    <div style={{ fontSize: "12px", color: "#64748B", fontWeight: 500, marginTop: "2px" }}>
                      Phòng <strong>{activeModal.roomTitle}</strong> • Tầng {activeModal.tang || "2"}
                    </div>
                  )}
                </div>
              </div>
              <button className="student-modal-close-btn" onClick={closeModal} title="Đóng">
                ✕
              </button>
            </div>

            {activeModal.type === "room_members" ? (
              <div className="student-modal-body" style={{ padding: "16px 20px", maxHeight: "calc(90vh - 140px)", overflowY: "auto" }}>
                {/* Thanh trạng thái phòng */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "#F8FAFC",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  border: "1px solid #E2E8F0",
                  marginBottom: "14px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                      backgroundColor: "#ECFDF5",
                      color: "#059669",
                      padding: "3px 10px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      border: "1px solid #A7F3D0",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px"
                    }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#059669" }}></span>
                      {activeModal.members.filter(m => !m.is_empty).length} đang ở
                    </span>
                    <span style={{
                      backgroundColor: "#FFFBEB",
                      color: "#D97706",
                      padding: "3px 10px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      border: "1px solid #FDE68A"
                    }}>
                      {activeModal.members.filter(m => m.is_empty).length} chỗ trống
                    </span>
                  </div>
                  <span style={{ fontSize: "12.5px", color: "#475569", fontWeight: 500 }}>
                    Sức chứa: <strong>{activeModal.suc_chua || "4 người"}</strong>
                  </span>
                </div>

                {/* Danh sách thành viên / giường */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {activeModal.members.map((mem, idx) => (
                    mem.is_empty ? (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 14px",
                          borderRadius: "10px",
                          border: "1.5px dashed #CBD5E1",
                          backgroundColor: "#F8FAFC",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "50%",
                            border: "1.5px dashed #94A3B8",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#94A3B8",
                            backgroundColor: "#FFFFFF",
                            flexShrink: 0
                          }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#64748B", fontSize: "13.5px" }}>
                              {mem.giuong ? `Giường ${mem.giuong}` : `Vị trí #${idx + 1}`} — {mem.ho_ten || "Chưa có người ở"}
                            </div>
                            <div style={{ fontSize: "12px", color: "#94A3B8", marginTop: "1px" }}>
                              Chỗ trống sẵn sàng tiếp nhận sinh viên mới trong đợt tiếp theo
                            </div>
                          </div>
                        </div>
                        <span style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#64748B",
                          backgroundColor: "#E2E8F0",
                          padding: "4px 9px",
                          borderRadius: "6px",
                          whiteSpace: "nowrap"
                        }}>
                          Còn trống
                        </span>
                      </div>
                    ) : (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 14px",
                          borderRadius: "10px",
                          border: mem.is_current_user ? "1.5px solid #93C5FD" : "1px solid #E2E8F0",
                          backgroundColor: mem.is_current_user ? "#F0F7FF" : "#FFFFFF",
                          boxShadow: mem.is_current_user ? "0 2px 8px rgba(37, 99, 235, 0.08)" : "0 1px 3px rgba(0,0,0,0.02)"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                          {/* Avatar Circle */}
                          <div style={{
                            width: "42px",
                            height: "42px",
                            borderRadius: "50%",
                            background: mem.is_current_user
                              ? "linear-gradient(135deg, #2563EB, #1D4ED8)"
                              : idx === 1
                                ? "linear-gradient(135deg, #0D9488, #059669)"
                                : "linear-gradient(135deg, #7C3AED, #6D28D9)",
                            color: "#FFFFFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "13.5px",
                            flexShrink: 0,
                            boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
                          }}>
                            {mem.ho_ten ? mem.ho_ten.split(" ").slice(-2).map(n => n[0]).join("") : "SV"}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 700, color: "#0F172A", fontSize: "14px" }}>
                                {mem.ho_ten}
                              </span>
                              {mem.is_current_user ? (
                                <span style={{
                                  fontSize: "10.5px",
                                  fontWeight: 600,
                                  backgroundColor: "#DBEAFE",
                                  color: "#1D4ED8",
                                  padding: "1px 7px",
                                  borderRadius: "4px"
                                }}>
                                  {mem.vai_tro || "Bạn"}
                                </span>
                              ) : (
                                mem.vai_tro && mem.vai_tro !== "Thành viên" && (
                                  <span style={{
                                    fontSize: "10.5px",
                                    fontWeight: 600,
                                    backgroundColor: "#F1F5F9",
                                    color: "#475569",
                                    padding: "1px 6px",
                                    borderRadius: "4px"
                                  }}>
                                    {mem.vai_tro}
                                  </span>
                                )
                              )}
                            </div>

                            <div style={{ fontSize: "12px", color: "#64748B", marginTop: "2px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                              <span>MSV: <strong style={{ color: "#334155" }}>{mem.msv}</strong></span>
                              {mem.lop && <span>• Lớp: {mem.lop}</span>}
                              {mem.khoa && <span>• {mem.khoa}</span>}
                            </div>

                            {mem.so_dien_thoai && (
                              <div style={{ fontSize: "11.5px", color: "#2563EB", marginTop: "3px", display: "flex", alignItems: "center", gap: "5px" }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                </svg>
                                <span>{mem.so_dien_thoai}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "5px", flexShrink: 0, marginLeft: "10px" }}>
                          <span style={{
                            fontSize: "11.5px",
                            fontWeight: 700,
                            color: "#1E293B",
                            backgroundColor: "#F1F5F9",
                            padding: "3px 9px",
                            borderRadius: "6px",
                            border: "1px solid #E2E8F0"
                          }}>
                            {mem.giuong ? `Giường ${mem.giuong}` : `G${idx + 1}`}
                          </span>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "#059669",
                            backgroundColor: "#ECFDF5",
                            padding: "2px 7px",
                            borderRadius: "4px"
                          }}>
                            {mem.trang_thai_label || "Đang ở"}
                          </span>
                        </div>
                      </div>
                    )
                  ))}
                </div>

                <div style={{
                  fontSize: "11.5px",
                  color: "#94A3B8",
                  marginTop: "14px",
                  paddingTop: "10px",
                  borderTop: "1px dashed #E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}>
                  <span>* Dữ liệu sinh viên nội trú được xác thực từ KTX</span>
                  <span>Ngày vào: {currentRoomInfo?.ngay_bat_dau || "19/10/2026"}</span>
                </div>
              </div>
            ) : (
              <div className="student-modal-body">
                <p style={{ fontWeight: 600, color: "#1D68FE", marginBottom: 6 }}>
                  {activeModal.desc}
                </p>
                <p>{activeModal.detail}</p>
              </div>
            )}

            <div className="student-modal-footer">
              {activeModal.actionPath && onNavigate ? (
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", width: "100%" }}>
                  <button
                    className="student-modal-secondary-btn"
                    onClick={closeModal}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      backgroundColor: "#fff",
                      color: "#475569",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Đóng
                  </button>
                  <button
                    className="student-modal-primary-btn"
                    onClick={() => {
                      closeModal();
                      onNavigate(activeModal.actionPath);
                    }}
                  >
                    {activeModal.actionText || "Đến trang thanh toán"}
                  </button>
                </div>
              ) : (
                <button
                  className="student-modal-primary-btn"
                  onClick={closeModal}
                >
                  Đã hiểu
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
