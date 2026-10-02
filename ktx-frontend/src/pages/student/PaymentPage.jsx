import React, { useState, useEffect } from "react";
import StudentLayout from "../../layouts/Student";
import FeatureLockedNotice from "../../components/FeatureLockedNotice";
import { resolveStudentStatus, STUDENT_STATUS } from "../../services/studentStatusService";
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
  MoreHorizontal,
  X,
  QrCode,
  AlertCircle,
  CircleDollarSign,
} from "lucide-react";

/**
 * Cấu hình tài khoản ngân hàng & Thông tin thanh toán KTX
 */
const BANK_ID = "tpbank";
const ACCOUNT_NO = "20020813520";
const ACCOUNT_NAME = "NGUYEN THI ANH";
const PAYMENT_STATUS_STORAGE_KEY = "ktx_payment_2026_09_status";
const PAYMENT_DATE_STORAGE_KEY = "ktx_payment_2026_09_date";

/**
 * Hàm chuẩn hóa bỏ dấu tiếng Việt và viết hoa
 */
const formatText = (str) =>
  str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toUpperCase()
    .trim();

export default function PaymentPage({ onSelectTab, onNavigate }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [studentStatus, setStudentStatus] = useState(STUDENT_STATUS.NOT_REGISTERED);
  const [paymentStatus, setPaymentStatus] = useState(() =>
    localStorage.getItem(PAYMENT_STATUS_STORAGE_KEY) === "pending"
      ? "pending"
      : "unpaid",
  ); // 'unpaid' | 'pending'
  const [toastMessage, setToastMessage] = useState("");
  const [copiedField, setCopiedField] = useState(null); // 'stk' | 'content' | null
  const [timeLeft, setTimeLeft] = useState(900); // 15 phút đếm ngược (900s)

  const studentName =
    localStorage.getItem("ktx_fullname") ||
    localStorage.getItem("ktx_username") ||
    "Nguyễn Văn A";

  const maSV = localStorage.getItem("ktx_username") || "DTC123";
  const loaiTienNop = "TIEN DIEN NUOC T09";

  // Tự động tạo chuỗi nội dung chuyển khoản theo cấu trúc: <MASV_LOAI NOP TIEN>
  const rawContent = `${maSV}_${formatText(loaiTienNop)}`;

  // Danh sách các khoản phí
  const feeItems = [
    {
      id: "room",
      name: "Phí phòng",
      subtext: "Tiền thuê phòng ở",
      unitPrice: "350.000đ",
      quantity: "1 tháng",
      total: "350.000đ",
      amount: 350000,
      icon: CircleDollarSign,
      iconBg: "bg-purple-100 text-purple-600",
    },
    {
      id: "electric",
      name: "Điện",
      subtext: "Theo đồng hồ điện",
      unitPrice: "3.500đ/kWh",
      quantity: "45kWh",
      total: "157.500 đ",
      amount: 157500,
      icon: Zap,
      iconBg: "bg-amber-100 text-amber-500",
    },
    {
      id: "water",
      name: "Nước",
      subtext: "Theo đồng hồ nước",
      unitPrice: "15.000đ/m³",
      quantity: "5m³",
      total: "75.000 đ",
      amount: 75000,
      icon: Droplets,
      iconBg: "bg-sky-100 text-sky-500",
    },
    {
      id: "other",
      name: "Dịch vụ khác",
      subtext: "nước uống,...",
      unitPrice: "10.000đ",
      quantity: "1 tháng",
      total: "10.000đ",
      amount: 10000,
      icon: MoreHorizontal,
      iconBg: "bg-blue-100 text-blue-500",
    },
  ];

  // Tính tổng tiền động
  const totalAmount = feeItems.reduce((acc, item) => acc + item.amount, 0);
  const formattedTotal = totalAmount.toLocaleString("vi-VN") + "đ";

  // URL VietQR động theo chuẩn VietQR API
  const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png?amount=${totalAmount}&addInfo=${encodeURIComponent(
    rawContent,
  )}&accountName=${encodeURIComponent(ACCOUNT_NAME)}`;

  // Đếm ngược 15 phút (Countdown Timer)
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

  useEffect(() => {
    resolveStudentStatus(maSV).then((res) => {
      setStudentStatus(res.status);
    });
  }, [maSV]);

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
    if (timeLeft === 0) {
      setTimeLeft(900);
    }
    setIsModalOpen(true);
  };

  const handleRefreshQr = () => {
    setTimeLeft(900);
  };

  const handleConfirmPayment = () => {
    setIsModalOpen(false);
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
          {/* 1. HEADER TRANG: Icon thẻ ngân hàng CreditCard xanh cyan + Tiêu đề        */}
          {/* ========================================================================= */}
          <div className="flex items-center gap-3 select-none">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 text-cyan-600">
              <CreditCard className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">
              Thanh toán phí KTX
            </h1>
          </div>

          {studentStatus !== STUDENT_STATUS.ACTIVE_RESIDENT ? (
            <FeatureLockedNotice
              featureName="Thanh toán phí KTX"
              status={studentStatus}
              onNavigate={onNavigate}
              onSelectTab={onSelectTab}
            />
          ) : (
            <>
              {/* ========================================================================= */}
              {/* 2. 3 CARD TÓM TẮT TRÊN CÙNG (Grid 3 cột)                                  */}
              {/* ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Phòng hiện tại */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center gap-4 transition hover:shadow-sm">
              <div className="w-12 h-12 rounded-full bg-[#dbeafe] text-blue-600 flex items-center justify-center shrink-0">
                <Home className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-slate-500 font-medium">
                  Phòng hiện tại
                </div>
                <div className="text-xl font-bold text-slate-900 mt-0.5 truncate">
                  P36
                </div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">
                  Tòa A2 – Tầng 2 – Phòng 10
                </div>
              </div>
            </div>

            {/* Card 2: Kỳ thanh toán */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center gap-4 transition hover:shadow-sm">
              <div className="w-12 h-12 rounded-full bg-[#dbeafe] text-blue-600 flex items-center justify-center shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-slate-500 font-medium">
                  Kỳ thanh toán
                </div>
                <div className="text-xl font-bold text-slate-900 mt-0.5 truncate">
                  Tháng 09/2026
                </div>
                <div className="text-xs text-slate-400 mt-0.5 truncate">
                  01/09/2026 - 30/09/2026
                </div>
              </div>
            </div>

            {/* Card 3: Trạng thái thanh toán */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center gap-4 transition hover:shadow-sm">
              <div className="w-12 h-12 rounded-full bg-[#dbeafe] text-blue-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-slate-500 font-medium">
                  Trạng thái thanh toán
                </div>
                <div className="mt-1">
                  {paymentStatus === "unpaid" ? (
                    <span className="bg-rose-100 text-rose-700 font-bold px-3 py-1 text-xs rounded-full inline-block">
                      Chưa thanh toán
                    </span>
                  ) : (
                    <span className="bg-amber-100 text-amber-700 font-bold px-3 py-1 text-xs rounded-full inline-block">
                      Chờ xác nhận thanh toán
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-1 truncate">
                  Hạn thanh toán: 15/09/2026
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. BẢNG CHI TIẾT CÁC KHOẢN PHÍ (FULL-WIDTH 100%)                          */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm w-full">
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
                    const Icon = item.icon;
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full ${item.iconBg} flex items-center justify-center shrink-0 shadow-sm`}
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

            {/* Thanh Footer / Bottom Bar tổng kết */}
            {paymentStatus === "unpaid" && (
              <div className="bg-[#f0f6ff] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between border border-blue-100/60 mt-6 gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-slate-700 font-medium text-base">
                    Tổng tiền phải thanh toán:
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-blue-700 tracking-tight">
                    {formattedTotal}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenModal}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 select-none"
                >
                  <span>Thanh toán ngay</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL OVERLAY XÁC NHẬN THANH TOÁN (VIETQR ĐỘNG)                        */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 relative max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Nút đóng modal */}
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Tiêu đề Modal: Icon check tròn xanh mint + Tiêu đề Xác nhận thanh toán */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                Xác nhận thanh toán
              </h2>
            </div>

            {/* Bố cục 2 cột cân đối */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* ==================== CỘT TRÁI ==================== */}
              <div className="space-y-4">
                {/* Khung thông báo nhỏ: Icon check xanh + chữ */}
                <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3.5 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 leading-snug">
                      Vui lòng kiểm tra thông tin trước khi thanh toán
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Kỳ thanh toán Tháng 09/2026
                    </div>
                  </div>
                </div>

                {/* Danh sách thông tin kiểm tra & đối chiếu */}
                <div className="space-y-2.5 py-2.5 border-b border-slate-100 text-xs">
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-slate-400 font-medium">
                      Phòng hiện tại:
                    </span>
                    <span className="font-semibold text-slate-800">
                      P36 – Tòa A2 – Tầng 3
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-slate-400 font-medium">
                      Kỳ thanh toán:
                    </span>
                    <span className="font-semibold text-slate-800">
                      Tháng 09/2026
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-slate-400 font-medium">
                      Hạn thanh toán:
                    </span>
                    <span className="font-semibold text-slate-800">
                      15/09/2026
                    </span>
                  </div>
                </div>

                {/* Chi tiết rút gọn các khoản phí */}
                <div className="py-2.5 border-b border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Chi tiết các khoản phí
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {feeItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center text-slate-600"
                      >
                        <span>{item.name}:</span>
                        <span className="font-semibold text-slate-800">
                          {item.amount.toLocaleString("vi-VN")}đ
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Khung highlight tổng tiền: Nền vàng nhạt bg-[#fef9c3] */}
                <div className="bg-[#fef9c3] rounded-xl p-3 flex justify-between items-center font-bold text-slate-800 border border-yellow-200/60">
                  <span className="text-xs sm:text-sm">
                    Tổng tiền phải thanh toán:
                  </span>
                  <span className="text-base sm:text-lg text-blue-700 font-extrabold">
                    {formattedTotal}
                  </span>
                </div>
              </div>

              {/* ==================== CỘT PHẢI ==================== */}
              <div className="flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Phương thức thanh toán
                  </div>

                  {/* Tab phương thức thanh toán: Khối viền xanh border-2 border-blue-500 */}
                  <div className="border-2 border-blue-500 bg-blue-50/40 rounded-2xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <QrCode className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm leading-tight">
                          QR code
                        </div>
                        <div className="text-xs text-slate-500">
                          Quét mã để thanh toán
                        </div>
                      </div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-blue-600 fill-blue-600 text-white" />
                  </div>

                  {/* Mã VietQR động tạo qua URL API */}
                  <div className="my-4 text-center">
                    <div className="inline-block relative">
                      <img
                        src={qrUrl}
                        alt="VietQR KTX"
                        className="w-60 h-65 mx-auto object-contain rounded-xl shadow-sm border border-slate-100 bg-white p-2"
                      />
                    </div>

                    {/* Đồng hồ đếm ngược 15 phút */}
                    <div className="mt-3">
                      {timeLeft > 0 ? (
                        <p className="text-xs text-slate-500">
                          Mã QR có hiệu lực trong{" "}
                          <span className="font-bold text-blue-600 font-mono">
                            {formattedTime}
                          </span>{" "}
                          phút
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          <p className="text-xs text-rose-500 font-semibold flex items-center justify-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Mã QR đã hết
                            hạn hiệu lực
                          </p>
                          <button
                            type="button"
                            onClick={handleRefreshQr}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            <RotateCw className="w-3.5 h-3.5" /> Làm mới mã QR
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2 Nút bấm hành động */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="bg-slate-100 text-slate-600 hover:bg-slate-200 font-semibold py-2.5 px-6 rounded-xl flex-1 cursor-pointer transition text-center text-sm"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPayment}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl flex-1 shadow-sm cursor-pointer transition text-center text-sm"
                  >
                    Tôi đã thanh toán
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TOAST THÔNG BÁO THÀNH CÔNG                                             */}
      {/* ========================================================================= */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 max-w-md bg-white border border-emerald-200 rounded-2xl p-4 shadow-xl flex items-start gap-3 animate-in slide-in-from-top-4 duration-300">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-slate-900">
              Ghi nhận giao dịch thành công
            </div>
            <div className="text-xs text-slate-600 mt-1 leading-relaxed">
              {toastMessage}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage("")}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </StudentLayout>
  );
}
