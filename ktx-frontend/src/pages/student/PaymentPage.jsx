import React, { useState, useEffect } from "react";
import StudentLayout from "../../layouts/Student";
import FeatureLockedNotice from "../../components/FeatureLockedNotice";
import { resolveStudentStatus, STUDENT_STATUS } from "../../services/studentStatusService";
import { getStudentAccount, payStudentBill } from "../../services/studentAccountService";
import { invoiceService } from "../../services/invoiceService";
import occupancyService from "../../services/occupancyService";
import {
  CreditCard,
  Home,
  Calendar,
  CheckCircle2,
  Check,
  Copy,
  RotateCw,
  ArrowRight,
  Zap,
  Droplets,
  X,
  QrCode,
  AlertCircle,
  CircleDollarSign,
  Wallet,
} from "lucide-react";

/**
 * Cấu hình tài khoản ngân hàng & Thông tin thanh toán KTX ICTU
 */
const BANK_ID = "tpbank";
const ACCOUNT_NO = "20020813520";
const ACCOUNT_NAME = "BAN QUAN LY KTX ICTU";
const PAYMENT_STATUS_STORAGE_KEY = "ktx_payment_2026_09_status";
const PAYMENT_DATE_STORAGE_KEY = "ktx_payment_2026_09_date";

/**
 * Hàm chuẩn hóa bỏ dấu tiếng Việt và viết hoa cho nội dung chuyển khoản
 */
const formatTransferText = (str) =>
  String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .trim();

/**
 * Định dạng ngày hiển thị DD/MM/YYYY
 */
const formatDisplayDate = (dateVal) => {
  if (!dateVal) return "--";
  const s = String(dateVal).trim();
  if (s.includes("/")) return s;
  const parts = s.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return s;
};

/**
 * Lấy khoảng thời gian áp dụng từ tên kỳ thanh toán
 */
const getBillingPeriodRange = (kyThanhToan) => {
  if (!kyThanhToan) return "Không có kỳ thu đang mở";
  const ky = String(kyThanhToan).toLowerCase();

  const monthMatch = ky.match(/tháng\s*0?(\d{1,2})[\/\-](\d{4})/i);
  if (monthMatch) {
    const m = parseInt(monthMatch[1], 10);
    const y = parseInt(monthMatch[2], 10);
    const lastDay = new Date(y, m, 0).getDate();
    return `01/${String(m).padStart(2, "0")}/${y} - ${lastDay}/${String(m).padStart(2, "0")}/${y}`;
  }

  if (ky.includes("học kỳ i") || ky.includes("hk1")) {
    return "01/09/2026 - 31/01/2027";
  }
  if (ky.includes("học kỳ ii") || ky.includes("hk2")) {
    return "01/02/2027 - 30/06/2027";
  }
  if (ky.includes("năm học")) {
    return "01/09/2026 - 30/06/2027";
  }

  return "Áp dụng cho kỳ hiện tại";
};

/**
 * Tạo danh sách các dòng chi tiết khoản phí từ hóa đơn thực tế
 */
const getFeeItems = (inv) => {
  if (!inv) return [];
  if (Array.isArray(inv.items) && inv.items.length > 0) {
    return inv.items;
  }
  if (Array.isArray(inv.fees) && inv.fees.length > 0) {
    return inv.fees;
  }

  const amount = Number(inv.so_tien || inv.amount || 0);
  const ky = inv.ky_thanh_toan || inv.title || "Kỳ thu hiện tại";
  const loai = String(inv.loai_hoa_don || "").toUpperCase();

  if (loai === "TIEN_PHONG" || loai.includes("PHONG")) {
    return [
      {
        id: "room_fee",
        name: "Tiền phòng KTX",
        subtext: "Chi phí lưu trú ký túc xá định kỳ",
        icon: Home,
        iconBg: "bg-blue-100 text-blue-600",
        unitPrice: `${amount.toLocaleString("vi-VN")} đ`,
        quantity: `1 kỳ (${ky})`,
        total: `${amount.toLocaleString("vi-VN")} đ`,
      },
    ];
  }

  if (loai === "DIEN_NUOC" || loai.includes("DIEN") || loai.includes("NUOC")) {
    return [
      {
        id: "utility_fee",
        name: "Tiền điện nước sinh hoạt",
        subtext: "Chỉ số điện nước tiêu thụ trong kỳ",
        icon: Zap,
        iconBg: "bg-amber-100 text-amber-600",
        unitPrice: `${amount.toLocaleString("vi-VN")} đ`,
        quantity: `1 kỳ (${ky})`,
        total: `${amount.toLocaleString("vi-VN")} đ`,
      },
    ];
  }

  return [
    {
      id: "general_fee",
      name: inv.title || "Phí KTX kỳ này",
      subtext: "Chi phí ký túc xá theo quy định",
      icon: CircleDollarSign,
      iconBg: "bg-emerald-100 text-emerald-600",
      unitPrice: `${amount.toLocaleString("vi-VN")} đ`,
      quantity: `1 kỳ (${ky})`,
      total: `${amount.toLocaleString("vi-VN")} đ`,
    },
  ];
};

export default function PaymentPage({ onSelectTab, onNavigate }) {
  // Quản lý danh sách các khoản phí và khoản phí đang chọn thanh toán
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [accountData, setAccountData] = useState(() => getStudentAccount());
  const [studentStatus, setStudentStatus] = useState(() =>
    getStudentAccount()?.currentResidence?.isActive
      ? STUDENT_STATUS.ACTIVE_RESIDENT
      : STUDENT_STATUS.NOT_REGISTERED,
  );
  const [roomInfo, setRoomInfo] = useState({
    roomNumber: "",
    building: "",
    fullDisplay: "Đang tải...",
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingInvoiceIds, setPendingInvoiceIds] = useState(() => {
    try {
      const stored = localStorage.getItem("ktx_pending_invoices");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [toastMessage, setToastMessage] = useState("");
  const [copiedField, setCopiedField] = useState(null);
  const [timeLeft, setTimeLeft] = useState(900); // 15 phút đếm ngược (900s)

  const studentName =
    accountData.fullName ||
    localStorage.getItem("ktx_fullname") ||
    "Sinh viên";

  const maSV = (
    accountData.studentId ||
    localStorage.getItem("ktx_username") ||
    ""
  ).trim();

  // Đếm ngược 15 phút cho modal thanh toán
  useEffect(() => {
    let timer;
    if (isModalOpen && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isModalOpen, timeLeft]);

  // Tự đóng toast sau 6 giây
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(""), 6000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // Đồng bộ số phòng thực tế và danh sách hóa đơn từ thông tin sinh viên đang đăng nhập
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      const currentCode = (
        maSV ||
        localStorage.getItem("ktx_username") ||
        ""
      ).trim();

      // 1. Đồng bộ trạng thái và phòng thực tế
      const acc = getStudentAccount(currentCode);
      if (isMounted) setAccountData(acc);

      const statusRes = await resolveStudentStatus(currentCode);
      if (!isMounted) return;
      setStudentStatus(statusRes.status);

      let roomStr = "";
      let bldStr = "";

      if (statusRes.activeRoom) {
        const rawNum = String(
          statusRes.activeRoom.so_phong ||
          statusRes.activeRoom.phong ||
          "",
        ).replace(/^P/i, "").trim();
        const rawBld = (
          statusRes.activeRoom.toa ||
          statusRes.activeRoom.building ||
          ""
        ).trim();
        if (rawNum) {
          roomStr = `P${rawNum}`;
          bldStr = rawBld;
        }
      }

      if (!roomStr) {
        try {
          const contracts = await occupancyService.getMyContracts(currentCode);
          const activeC = Array.isArray(contracts)
            ? contracts.find(
              (c) =>
                c.trang_thai === "DANG_O" ||
                c.trang_thai === "ACTIVE" ||
                c.status === "ACTIVE",
            )
            : null;
          if (activeC) {
            const rawNum = String(
              activeC.so_phong || activeC.phong || "",
            ).replace(/^P/i, "").trim();
            const rawBld = (activeC.toa || activeC.building || "").trim();
            if (rawNum) {
              roomStr = `P${rawNum}`;
              bldStr = rawBld;
            }
          }
        } catch (_) { }
      }

      if (!roomStr && acc?.currentResidence?.isActive && acc.currentResidence.roomNumber) {
        const rawNum = String(acc.currentResidence.roomNumber).replace(/^P/i, "").trim();
        const rawBld = (acc.currentResidence.building || "").trim();
        roomStr = `P${rawNum}`;
        bldStr = rawBld;
      }

      const fullDisplay =
        roomStr && bldStr
          ? `${roomStr} - ${bldStr}`
          : roomStr || (statusRes.status === STUDENT_STATUS.ACTIVE_RESIDENT ? "Phòng KTX" : "Chưa xếp phòng");

      if (isMounted) {
        setRoomInfo({
          roomNumber: roomStr,
          building: bldStr,
          fullDisplay: fullDisplay,
        });
      }

      // 2. Tải danh sách hóa đơn từ backend API hoặc fallback local account
      let fetchedInvoices = [];

      try {
        const backendInvoices = await invoiceService.getMyInvoices(currentCode);
        if (Array.isArray(backendInvoices) && backendInvoices.length > 0) {
          fetchedInvoices = backendInvoices;
        }
      } catch (err) {
        console.warn("Lỗi tải hóa đơn từ backend:", err);
      }

      // Fallback tìm trong account bills nếu chưa có từ API
      if (fetchedInvoices.length === 0 && Array.isArray(acc?.bills) && acc.bills.length > 0) {
        fetchedInvoices = acc.bills;
      }

      if (isMounted) {
        setInvoices(fetchedInvoices);
      }
    };

    loadData();

    window.addEventListener("student-account-updated", loadData);
    window.addEventListener("occupancy-updated", loadData);
    window.addEventListener("ktx-payment-updated", loadData);
    window.addEventListener("storage", loadData);

    return () => {
      isMounted = false;
      window.removeEventListener("student-account-updated", loadData);
      window.removeEventListener("occupancy-updated", loadData);
      window.removeEventListener("ktx-payment-updated", loadData);
      window.removeEventListener("storage", loadData);
    };
  }, [maSV]);

  // Chuyển đổi danh sách hóa đơn thành danh sách từng khoản phí hiển thị riêng biệt
  const feeItems = invoices.map((inv, index) => {
    const invId = String(inv.ma_hoa_don || inv.id || `inv_${index}`);
    const amount = Number(inv.so_tien || inv.amount || 0);
    const loai = String(inv.loai_hoa_don || "").toUpperCase();
    const isUtil =
      loai === "DIEN_NUOC" ||
      loai.includes("DIEN") ||
      loai.includes("NUOC") ||
      String(inv.title || "").toLowerCase().includes("điện");
    const isRoom =
      loai === "TIEN_PHONG" ||
      loai.includes("PHONG") ||
      String(inv.title || "").toLowerCase().includes("tiền phòng") ||
      String(inv.title || "").toLowerCase().includes("phòng ktx");

    const type = isUtil ? "DIEN_NUOC" : isRoom ? "TIEN_PHONG" : "OTHER";

    const isMarkedPending = pendingInvoiceIds.includes(invId);
    const rawStatus = String(inv.trang_thai || inv.status || "").toUpperCase();

    let status = "unpaid";
    if (rawStatus === "DA_THANH_TOAN" || rawStatus === "PAID") {
      status = "paid";
    } else if (isMarkedPending || rawStatus === "CHO_DOI_SOAT" || rawStatus === "PENDING") {
      status = "pending";
    } else if (rawStatus === "CHUYEN_THIEU") {
      status = "underpaid";
    } else if (rawStatus === "QUA_HAN") {
      status = "overdue";
    } else {
      status = "unpaid";
    }

    const name = isRoom
      ? "Tiền phòng KTX"
      : isUtil
      ? "Tiền điện nước sinh hoạt"
      : inv.title || "Khoản phí KTX";

    const subtext = isRoom
      ? "Chi phí lưu trú ký túc xá định kỳ"
      : isUtil
      ? "Chỉ số điện nước tiêu thụ trong kỳ (phần cá nhân)"
      : inv.ghi_chu || "Chi phí ký túc xá theo quy định";

    const icon = isRoom ? Home : isUtil ? Zap : CircleDollarSign;
    const iconBg = isRoom
      ? "bg-blue-100 text-blue-600"
      : isUtil
      ? "bg-amber-100 text-amber-600"
      : "bg-emerald-100 text-emerald-600";
    const ky = inv.ky_thanh_toan || inv.title || "Kỳ thu hiện tại";

    return {
      id: invId,
      rawInvoice: inv,
      type,
      name,
      subtext,
      icon,
      iconBg,
      period: ky,
      dueDate: inv.han_thanh_toan || inv.dueDate,
      amount,
      amountDisplay: `${amount.toLocaleString("vi-VN")} đ`,
      status,
    };
  });

  const hasInvoices = feeItems.length > 0;
  const unpaidItems = feeItems.filter((item) => item.status !== "paid");
  const totalUnpaidAmount = unpaidItems.reduce((sum, item) => sum + item.amount, 0);
  const formattedUnpaidTotal = `${totalUnpaidAmount.toLocaleString("vi-VN")} đ`;

  // Kỳ thanh toán hiển thị chung trên thẻ
  const currentPeriod = feeItems[0]?.period || "Kỳ thu hiện tại";
  const earliestDueDate =
    unpaidItems.find((i) => i.dueDate)?.dueDate || feeItems[0]?.dueDate;

  // Cấu hình nội dung chuyển khoản cho khoản phí đang chọn thanh toán
  const cleanRoomNumber = String(
    roomInfo.roomNumber ||
    selectedInvoice?.rawInvoice?.so_phong ||
    selectedInvoice?.rawInvoice?.ma_phong ||
    accountData?.currentResidence?.roomNumber ||
    ""
  ).replace(/[^0-9]/g, "");

  const rawTransferContent = selectedInvoice
    ? selectedInvoice.type === "DIEN_NUOC"
      ? `DN ${cleanRoomNumber || "101"} ${maSV.toUpperCase()}`
      : selectedInvoice.type === "TIEN_PHONG"
      ? `TP ${maSV.toUpperCase()}`
      : `KTX ${maSV.toUpperCase()}`
    : "";

  const qrUrl = selectedInvoice
    ? `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png?amount=${selectedInvoice.amount}&addInfo=${encodeURIComponent(
        rawTransferContent,
      )}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`
    : "";

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const handleCopy = (text, fieldName) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleOpenModal = (item) => {
    setSelectedInvoice(item);
    setTimeLeft(900);
    setIsModalOpen(true);
  };

  const handleConfirmPayment = () => {
    if (!selectedInvoice) return;
    setIsModalOpen(false);

    const invId = selectedInvoice.id;
    const newPending = Array.from(new Set([...pendingInvoiceIds, invId]));
    setPendingInvoiceIds(newPending);
    localStorage.setItem("ktx_pending_invoices", JSON.stringify(newPending));

    payStudentBill(maSV, invId);

    const now = new Date();
    const paymentDate = `${String(now.getDate()).padStart(2, "0")}/${String(
      now.getMonth() + 1,
    ).padStart(2, "0")}/${now.getFullYear()}`;
    localStorage.setItem(PAYMENT_DATE_STORAGE_KEY, paymentDate);

    window.dispatchEvent(new CustomEvent("ktx-payment-updated"));
    setToastMessage(
      `Đã ghi nhận giao dịch cho ${selectedInvoice.name}! Ban Quản lý sẽ đối soát và gạch nợ tự động trong 1-3 phút.`,
    );
  };

  return (
    <StudentLayout
      activeTab="payment"
      onSelectTab={onSelectTab}
      userName={studentName}
      userRole="Sinh viên"
    >
      <div className="flex-1 flex flex-col justify-between">
        <div className="space-y-6">
          {/* ========================================================================= */}
          {/* 1. HEADER TRANG: Icon thẻ ngân hàng CreditCard cyan + Tiêu đề             */}
          {/* ========================================================================= */}
          <div className="flex items-center gap-3 select-none">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 text-cyan-600">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                Thanh toán phí KTX
              </h1>
              <p className="text-xs text-slate-500">
                Tra cứu và thực hiện nghĩa vụ tài chính lưu trú KTX
              </p>
            </div>
          </div>

          {/* Nếu sinh viên chưa được duyệt phòng / chưa đăng ký phòng -> Empty state chặn tính năng */}
          {studentStatus !== STUDENT_STATUS.ACTIVE_RESIDENT ? (
            <FeatureLockedNotice
              featureName="Thanh toán phí KTX"
              title="Tính năng tài chính chỉ mở sau khi bạn hoàn tất đăng ký và được duyệt phòng KTX"
              status={studentStatus}
              onNavigate={onNavigate}
              onSelectTab={onSelectTab}
            />
          ) : (
            <>
              {/* ========================================================================= */}
              {/* 2. 3 CARD THỐNG KÊ PHÍA TRÊN (Grid 3 cột)                                 */}
              {/* ========================================================================= */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Thẻ 1: Phòng hiện tại (Đồng bộ từ thông tin sinh viên đang đăng nhập) */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center gap-4 transition hover:shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-[#dbeafe] text-blue-600 flex items-center justify-center shrink-0">
                    <Home className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500 font-medium">
                      Phòng hiện tại
                    </div>
                    <div className="text-xl font-bold text-slate-900 mt-0.5 truncate">
                      {roomInfo.fullDisplay}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate">
                      {roomInfo.building ? `Khu nội trú ${roomInfo.building}` : "Khu nội trú KTX"}
                    </div>
                  </div>
                </div>

                {/* Thẻ 2: Kỳ thanh toán */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center gap-4 transition hover:shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-[#dbeafe] text-blue-600 flex items-center justify-center shrink-0">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500 font-medium">
                      Kỳ thanh toán
                    </div>
                    <div className="text-xl font-bold text-slate-900 mt-0.5 truncate">
                      {hasInvoices ? currentPeriod : "--"}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate">
                      {hasInvoices
                        ? getBillingPeriodRange(currentPeriod)
                        : "Không có kỳ thu đang mở"}
                    </div>
                  </div>
                </div>

                {/* Thẻ 3: Trạng thái thanh toán */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center gap-4 transition hover:shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-[#dbeafe] text-blue-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-slate-500 font-medium">
                      Trạng thái thanh toán
                    </div>
                    <div className="mt-1">
                      {!hasInvoices || unpaidItems.length === 0 ? (
                        <span className="bg-emerald-100 text-emerald-700 font-bold px-3 py-1 text-xs rounded-full inline-block">
                          Đã hoàn tất
                        </span>
                      ) : unpaidItems.every((i) => i.status === "pending") ? (
                        <span className="bg-amber-100 text-amber-700 font-bold px-3 py-1 text-xs rounded-full inline-block">
                          Chờ xác nhận thanh toán
                        </span>
                      ) : (
                        <span className="bg-rose-100 text-rose-700 font-bold px-3 py-1 text-xs rounded-full inline-block">
                          Còn {unpaidItems.filter((i) => i.status !== "pending").length} khoản chưa nộp
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 truncate">
                      {hasInvoices && earliestDueDate
                        ? `Hạn thanh toán: ${formatDisplayDate(earliestDueDate)}`
                        : "Hạn thanh toán: --"}
                    </div>
                  </div>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* 3. KHU VỰC CHI TIẾT CÁC KHOẢN PHÍ                                         */}
              {/* ========================================================================= */}
              {!hasInvoices ? (
                /* TRƯỜNG HỢP 1: KẾ TOÁN CHƯA PHÁT HÀNH HÓA ĐƠN                           */
                <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-14 shadow-sm w-full text-center flex flex-col items-center justify-center my-2 animate-in fade-in zoom-in-95 duration-200 select-none">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 mb-5 shadow-xs">
                    <Wallet className="w-8 h-8 text-emerald-600 stroke-[1.8]" />
                  </div>

                  <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight mb-2.5 max-w-xl">
                    Bạn hiện không có khoản phí nào cần thanh toán
                  </h3>

                  <p className="text-sm text-slate-500 max-w-lg leading-relaxed">
                    Các khoản phí KTX (tiền phòng, điện nước) sẽ xuất hiện tại đây khi Ban Quản lý/Kế toán phát hành đợt thu mới.
                  </p>
                </div>
              ) : (
                /* TRƯỜNG HỢP 2: HIỂN THỊ CHI TIẾT TỪNG KHOẢN PHÍ VÀ CHO PHÉP CHỌN THANH TOÁN */
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm w-full animate-in fade-in duration-200">
                  <div className="flex items-center justify-between pb-3 mb-5 border-b border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                          Chi tiết các khoản phí
                        </h2>
                        <p className="text-xs text-slate-400">
                          Bạn có thể chọn thanh toán từng khoản phí trước hoặc sau tùy theo nhu cầu
                        </p>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                      Tổng số khoản phí: <span className="font-bold text-slate-800">{feeItems.length}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          <th className="py-3 px-4">Khoản phí</th>
                          <th className="py-3 px-4">Đơn giá</th>
                          <th className="py-3 px-4">Kỳ thanh toán</th>
                          <th className="py-3 px-4 text-right">Thành tiền</th>
                          <th className="py-3 px-4 text-center">Trạng thái</th>
                          <th className="py-3 px-4 text-center">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {feeItems.map((item) => {
                          const Icon = item.icon || CircleDollarSign;
                          const isPaid = item.status === "paid";
                          const isPending = item.status === "pending";

                          return (
                            <tr
                              key={item.id}
                              className="hover:bg-slate-50/70 transition-colors"
                            >
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-10 h-10 rounded-2xl ${item.iconBg || "bg-blue-100 text-blue-600"} flex items-center justify-center shrink-0 shadow-xs`}
                                  >
                                    <Icon className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <div className="font-semibold text-slate-800 text-sm">
                                      {item.name}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5">
                                      {item.subtext}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-4 px-4 text-sm font-medium text-slate-700 whitespace-nowrap">
                                {item.amountDisplay}
                              </td>

                              <td className="py-4 px-4 text-sm font-medium text-slate-600 whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-700">
                                  {item.period}
                                </span>
                              </td>

                              <td className="py-4 px-4 text-sm font-bold text-blue-600 text-right whitespace-nowrap">
                                {item.amountDisplay}
                              </td>

                              <td className="py-4 px-4 text-center whitespace-nowrap">
                                {isPaid ? (
                                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold px-3 py-1 text-xs rounded-full">
                                    <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                                    Đã thanh toán
                                  </span>
                                ) : isPending ? (
                                  <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200/80 font-bold px-3 py-1 text-xs rounded-full">
                                    <RotateCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                                    Chờ đối soát
                                  </span>
                                ) : item.status === "underpaid" ? (
                                  <span className="bg-amber-100 text-amber-700 font-bold px-3 py-1 text-xs rounded-full inline-block">
                                    Chuyển thiếu
                                  </span>
                                ) : item.status === "overdue" ? (
                                  <span className="bg-rose-100 text-rose-700 font-bold px-3 py-1 text-xs rounded-full inline-block">
                                    Quá hạn
                                  </span>
                                ) : (
                                  <span className="bg-rose-50 text-rose-700 border border-rose-200/80 font-bold px-3 py-1 text-xs rounded-full inline-block">
                                    Chưa thanh toán
                                  </span>
                                )}
                              </td>

                              <td className="py-4 px-4 text-center whitespace-nowrap">
                                {isPaid ? (
                                  <span className="text-xs font-semibold text-emerald-600 inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Hoàn tất</span>
                                  </span>
                                ) : isPending ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenModal(item)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold transition cursor-pointer active:scale-95"
                                  >
                                    <QrCode className="w-3.5 h-3.5" />
                                    <span>Xem lại QR</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenModal(item)}
                                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs hover:shadow transition cursor-pointer active:scale-95"
                                  >
                                    <CreditCard className="w-3.5 h-3.5" />
                                    <span>Thanh toán</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Thanh Footer / Bottom Bar tổng kết và nút Thanh toán */}
                  <div className="bg-[#f0f6ff] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between border border-blue-100/60 mt-6 gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-700 font-medium text-base">
                          Tổng tiền chưa thanh toán:
                        </span>
                        <span className="text-xl sm:text-2xl font-bold text-blue-700 tracking-tight">
                          {formattedUnpaidTotal}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {unpaidItems.length > 0
                          ? `Bấm nút "Thanh toán" tại từng dòng ở bảng trên để quét mã QR cho khoản phí tương ứng.`
                          : `Tất cả các khoản phí ký túc xá trong kỳ này đã hoàn tất thanh toán.`}
                      </p>
                    </div>

                    {unpaidItems.length === 0 ? (
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-4 py-2.5 rounded-xl inline-flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                        Đã hoàn tất thanh toán toàn bộ chi phí
                      </span>
                    ) : unpaidItems.some((i) => i.status !== "pending") ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenModal(
                            unpaidItems.find((i) => i.status !== "pending") ||
                              unpaidItems[0],
                          )
                        }
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 select-none"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>
                          Thanh toán ngay (
                          {
                            (
                              unpaidItems.find((i) => i.status !== "pending") ||
                              unpaidItems[0]
                            ).name
                          }
                          )
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-amber-700 bg-amber-100/80 px-4 py-2.5 rounded-xl inline-flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                        Đang chờ Ban Quản lý đối soát và gạch nợ
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 4. MODAL QUÉT MÃ QR VIETQR CHUYỂN KHOẢN (KHI BẤM "THANH TOÁN")              */}
        {/* ========================================================================= */}
        {isModalOpen && selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs select-none">
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 flex flex-col items-center">
              {/* Nút đóng modal */}
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-full text-center mt-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-2">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>VietQR Nhanh 24/7 • {selectedInvoice.name}</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800">
                  Thanh toán {selectedInvoice.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Mở ứng dụng ngân hàng hoặc ví điện tử để quét mã QR
                </p>
              </div>

              {/* Khung QR Code */}
              <div className="relative mt-5 p-3 bg-white border border-slate-200 rounded-2xl shadow-xs">
                <img
                  src={qrUrl}
                  alt={`VietQR ${selectedInvoice.name}`}
                  className="w-56 h-56 object-contain"
                />
                {timeLeft === 0 && (
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center p-4">
                    <p className="text-xs font-semibold text-rose-600 mb-2">
                      Mã QR đã hết hiệu lực
                    </p>
                    <button
                      type="button"
                      onClick={() => setTimeLeft(900)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-xl transition cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Làm mới mã QR
                    </button>
                  </div>
                )}
              </div>

              {/* Đồng hồ đếm ngược */}
              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                <span>Hết hạn trong:</span>
                <span className="font-bold text-rose-600 font-mono">
                  {formattedTime}
                </span>
              </div>

              {/* Thông tin chuyển khoản chi tiết */}
              <div className="w-full bg-slate-50 rounded-2xl p-4 mt-4 space-y-2.5 border border-slate-200/70 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Ngân hàng:</span>
                  <span className="font-bold text-slate-800">TPBank</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Số tài khoản:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800 font-mono">
                      {ACCOUNT_NO}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(ACCOUNT_NO, "accountNo")}
                      className="text-blue-600 hover:text-blue-700 p-1 hover:bg-blue-50 rounded transition cursor-pointer"
                      title="Sao chép số tài khoản"
                    >
                      {copiedField === "accountNo" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Chủ tài khoản:</span>
                  <span className="font-bold text-slate-800">
                    {ACCOUNT_NAME}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Khoản thanh toán:</span>
                  <span className="font-bold text-slate-800">
                    {selectedInvoice.name} ({selectedInvoice.period})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Số tiền:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-blue-600 text-sm">
                      {selectedInvoice.amountDisplay}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(String(selectedInvoice.amount), "amount")
                      }
                      className="text-blue-600 hover:text-blue-700 p-1 hover:bg-blue-50 rounded transition cursor-pointer"
                      title="Sao chép số tiền"
                    >
                      {copiedField === "amount" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-semibold">Nội dung CK:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-blue-700 font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {rawTransferContent}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(rawTransferContent, "content")
                      }
                      className="text-blue-600 hover:text-blue-700 p-1 hover:bg-blue-50 rounded transition cursor-pointer"
                      title="Sao chép nội dung chuyển khoản"
                    >
                      {copiedField === "content" ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-2 w-full text-center">
                <p className="text-[11px] text-amber-700 bg-amber-50 rounded-xl p-2 border border-amber-200/80">
                  Lưu ý: Giữ nguyên nội dung <strong>{rawTransferContent}</strong> để hệ thống đối soát gạch nợ tự động.
                </p>
              </div>

              {/* Nút xác nhận */}
              <div className="w-full mt-4">
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác nhận đã chuyển khoản ({selectedInvoice.name})</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast thông báo */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}

