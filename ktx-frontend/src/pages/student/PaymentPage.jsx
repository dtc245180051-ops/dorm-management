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
  // Yêu cầu kỹ thuật 2: Khởi tạo state an toàn
  const [invoice, setInvoice] = useState(null);
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
  const [paymentStatus, setPaymentStatus] = useState(() =>
    localStorage.getItem(PAYMENT_STATUS_STORAGE_KEY) === "pending"
      ? "pending"
      : "unpaid",
  );
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

  // Đồng bộ số phòng thực tế và hóa đơn từ thông tin sinh viên đang đăng nhập
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

      // Trích xuất số phòng và tòa nhà chính xác, không để "Chưa có" nếu đã xếp phòng
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

      // 2. Tìm hóa đơn cần thanh toán từ backend API hoặc local account
      let activeInvoice = null;

      try {
        const backendInvoices = await invoiceService.getMyInvoices(currentCode);
        if (Array.isArray(backendInvoices) && backendInvoices.length > 0) {
          // Lọc các hóa đơn chưa thanh toán hoặc quá hạn
          const unpaid = backendInvoices.find(
            (inv) =>
              inv.trang_thai === "CHUA_THANH_TOAN" ||
              inv.trang_thai === "QUA_HAN" ||
              inv.trang_thai === "CHUYEN_THIEU" ||
              inv.status === "UNPAID",
          );
          if (unpaid && Number(unpaid.so_tien || unpaid.amount || 0) > 0) {
            activeInvoice = unpaid;
          }
        }
      } catch (err) {
        console.warn("Lỗi tải hóa đơn từ backend:", err);
      }

      // Fallback tìm trong account bills nếu chưa có từ API
      if (!activeInvoice) {
        const unpaidBill = acc.bills?.find(
          (b) => b.status === "UNPAID" || b.trang_thai === "CHUA_THANH_TOAN",
        );
        if (unpaidBill && Number(unpaidBill.amount || unpaidBill.so_tien || 0) > 0) {
          activeInvoice = unpaidBill;
        }
      }

      if (isMounted) {
        setInvoice(activeInvoice);
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

  // Kiểm tra điều kiện dữ liệu: TRƯỜNG HỢP 1 vs TRƯỜNG HỢP 2
  const currentInvoice = invoice;
  const totalAmount = currentInvoice
    ? Number(currentInvoice.so_tien || currentInvoice.amount || 0)
    : 0;
  const feeItems = getFeeItems(currentInvoice);

  // Điều kiện kiểm tra TRƯỜNG HỢP 2: Có hóa đơn hợp lệ chưa thanh toán và totalAmount > 0
  const hasInvoice = Boolean(currentInvoice && totalAmount > 0 && feeItems.length > 0);

  const formattedTotal = totalAmount.toLocaleString("vi-VN") + " đ";

  // Cấu hình mã VietQR cho trường hợp 2
  const invoicePeriodName = currentInvoice?.ky_thanh_toan || currentInvoice?.title || "TIEN KTX";
  const rawTransferContent = `${maSV.toUpperCase()}_${formatTransferText(invoicePeriodName)}`;
  const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png?amount=${totalAmount}&addInfo=${encodeURIComponent(
    rawTransferContent,
  )}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;

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

  const handleOpenModal = () => {
    if (timeLeft === 0) setTimeLeft(900);
    setIsModalOpen(true);
  };

  const handleConfirmPayment = () => {
    setIsModalOpen(false);
    if (currentInvoice?.id || currentInvoice?.ma_hoa_don) {
      payStudentBill(maSV, currentInvoice.id || currentInvoice.ma_hoa_don);
    }
    setPaymentStatus("pending");
    localStorage.setItem(PAYMENT_STATUS_STORAGE_KEY, "pending");
    const now = new Date();
    const paymentDate = `${String(now.getDate()).padStart(2, "0")}/${String(
      now.getMonth() + 1,
    ).padStart(2, "0")}/${now.getFullYear()}`;
    localStorage.setItem(PAYMENT_DATE_STORAGE_KEY, paymentDate);
    window.dispatchEvent(new CustomEvent("ktx-payment-updated"));
    setToastMessage(
      "Đã ghi nhận giao dịch! Ban quản lý sẽ đối soát và cập nhật gạch nợ trong thời gian sớm nhất!",
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
                      {hasInvoice
                        ? currentInvoice.ky_thanh_toan || currentInvoice.title || "Kỳ thu hiện tại"
                        : "--"}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate">
                      {hasInvoice
                        ? getBillingPeriodRange(currentInvoice.ky_thanh_toan)
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
                      {hasInvoice ? (
                        paymentStatus === "pending" ? (
                          <span className="bg-amber-100 text-amber-700 font-bold px-3 py-1 text-xs rounded-full inline-block">
                            Chờ xác nhận thanh toán
                          </span>
                        ) : currentInvoice.trang_thai === "CHUYEN_THIEU" ? (
                          <span className="bg-amber-100 text-amber-700 font-bold px-3 py-1 text-xs rounded-full inline-block">
                            Chuyển thiếu
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-700 font-bold px-3 py-1 text-xs rounded-full inline-block">
                            Chưa thanh toán
                          </span>
                        )
                      ) : (
                        <span className="bg-emerald-100 text-emerald-700 font-bold px-3 py-1 text-xs rounded-full inline-block">
                          Đã hoàn tất
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 truncate">
                      {hasInvoice
                        ? `Hạn thanh toán: ${formatDisplayDate(currentInvoice.han_thanh_toan || currentInvoice.dueDate)}`
                        : "Hạn thanh toán: --"}
                    </div>
                  </div>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* 3. KHU VỰC CHI TIẾT CÁC KHOẢN PHÍ                                         */}
              {/* ========================================================================= */}
              {!hasInvoice ? (
                /* TRƯỜNG HỢP 1: KẾ TOÁN CHƯA PHÁT HÀNH HÓA ĐƠN (HOẶC ĐÃ THANH TOÁN HẾT)  */
                <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-14 shadow-sm w-full text-center flex flex-col items-center justify-center my-2 animate-in fade-in zoom-in-95 duration-200 select-none">
                  {/* Icon chiếc ví / dấu tích xanh */}
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 mb-5 shadow-xs">
                    <Wallet className="w-8 h-8 text-emerald-600 stroke-[1.8]" />
                  </div>

                  {/* Thông báo chữ to, rõ ràng */}
                  <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight mb-2.5 max-w-xl">
                    Bạn hiện không có khoản phí nào cần thanh toán
                  </h3>

                  {/* Dòng mô tả phụ */}
                  <p className="text-sm text-slate-500 max-w-lg leading-relaxed">
                    Các khoản phí KTX (tiền phòng, điện nước) sẽ xuất hiện tại đây khi Ban Quản lý/Kế toán phát hành đợt thu mới.
                  </p>
                </div>
              ) : (
                /* TRƯỜNG HỢP 2: KHI CÓ HÓA ĐƠN ĐƯỢC PHÁT HÀNH TỪ KẾ TOÁN                 */
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm w-full animate-in fade-in duration-200">
                  <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                      Chi tiết các khoản phí
                    </h2>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          <th className="py-3 px-4">Khoản phí</th>
                          <th className="py-3 px-4">Đơn giá</th>
                          <th className="py-3 px-4">Số lượng / kỳ</th>
                          <th className="py-3 px-4 text-right">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {feeItems.map((item) => {
                          const Icon = item.icon || CircleDollarSign;
                          return (
                            <tr
                              key={item.id || item.name}
                              className="hover:bg-slate-50/70 transition-colors"
                            >
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-10 h-10 rounded-full ${item.iconBg || "bg-blue-100 text-blue-600"} flex items-center justify-center shrink-0 shadow-sm`}
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
                              <td className="py-4 px-4 text-sm font-medium text-slate-700">
                                {item.unitPrice}
                              </td>
                              <td className="py-4 px-4 text-sm font-medium text-slate-700">
                                {item.quantity}
                              </td>
                              <td className="py-4 px-4 text-sm font-bold text-blue-600 text-right whitespace-nowrap">
                                {item.total}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Thanh Footer / Bottom Bar tổng kết và nút Thanh toán ngay */}
                  <div className="bg-[#f0f6ff] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between border border-blue-100/60 mt-6 gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-700 font-medium text-base">
                        Tổng tiền phải thanh toán:
                      </span>
                      <span className="text-xl sm:text-2xl font-bold text-blue-700 tracking-tight">
                        {formattedTotal}
                      </span>
                    </div>

                    {paymentStatus === "pending" ? (
                      <span className="text-xs font-semibold text-amber-700 bg-amber-100/80 px-4 py-2.5 rounded-xl inline-flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                        Đang chờ Ban Quản lý đối soát và gạch nợ
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleOpenModal}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 select-none"
                      >
                        <span>Thanh toán ngay</span>
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 4. MODAL QUÉT MÃ QR VIETQR CHUYỂN KHOẢN (KHI BẤM "THANH TOÁN NGAY")        */}
        {/* ========================================================================= */}
        {isModalOpen && (
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
                  <span>VietQR Nhanh 24/7</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800">
                  Quét mã để thanh toán
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Mở ứng dụng ngân hàng hoặc ví điện tử để quét mã QR
                </p>
              </div>

              {/* Khung QR Code */}
              <div className="relative mt-5 p-3 bg-white border border-slate-200 rounded-2xl shadow-xs">
                <img
                  src={qrUrl}
                  alt="VietQR Code"
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
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Chủ tài khoản:</span>
                  <span className="font-bold text-slate-800">
                    {ACCOUNT_NAME}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Số tiền:</span>
                  <span className="font-bold text-blue-600">
                    {formattedTotal}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Nội dung CK:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800 font-mono">
                      {rawTransferContent}
                    </span>

                  </div>
                </div>
              </div>

              {/* Nút xác nhận */}
              <div className="w-full mt-5">
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Xác nhận đã chuyển khoản</span>
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
