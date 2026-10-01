import { useEffect, useState } from "react";
import StudentLayout from "../../layouts/Student";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Printer,
  X,
} from "lucide-react";

const PAYMENT_STATUS_STORAGE_KEY = "ktx_payment_2026_09_status";
const PAYMENT_DATE_STORAGE_KEY = "ktx_payment_2026_09_date";

const invoiceRows = [
  {
    period: "Tháng 09/2026",
    paymentDate: "---",
    method: "QR code",
    amount: 592500,
    status: "waiting",
    invoiceNumber: "HD-2026-0901",
    fees: [
      { label: "Tiền phòng", amount: 350000 },
      { label: "Tiền điện", amount: 157500 },
      { label: "Tiền nước", amount: 75000 },
      { label: "Phí gửi xe / dịch vụ khác", amount: 10000 },
    ],
  },
  {
    period: "Tháng 08/2026",
    paymentDate: "---",
    method: "QR code",
    amount: 692500,
    status: "overdue",
  },
  {
    period: "Tháng 07/2026",
    paymentDate: "07/07/2026",
    method: "QR code",
    amount: 552300,
    status: "paid",
    invoiceNumber: "HD-2026-0701",
    fees: [
      { label: "Tiền phòng", amount: 350000 },
      { label: "Tiền điện", amount: 117500 },
      { label: "Tiền nước", amount: 74800 },
      { label: "Phí gửi xe / dịch vụ khác", amount: 10000 },
    ],
  },
  {
    period: "Tháng 06/2026",
    paymentDate: "11/06/2026",
    method: "QR code",
    amount: 792500,
    status: "paid",
    invoiceNumber: "HD-2026-0601",
    fees: [
      { label: "Tiền phòng", amount: 600000 },
      { label: "Tiền điện", amount: 112500 },
      { label: "Tiền nước", amount: 70000 },
      { label: "Phí gửi xe / dịch vụ khác", amount: 10000 },
    ],
  },
  {
    period: "Tháng 05/2026",
    paymentDate: "03/05/2026",
    method: "QR code",
    amount: 492500,
    status: "paid",
    invoiceNumber: "HD-2026-0501",
    fees: [
      { label: "Tiền phòng", amount: 350000 },
      { label: "Tiền điện", amount: 87500 },
      { label: "Tiền nước", amount: 45000 },
      { label: "Phí gửi xe / dịch vụ khác", amount: 10000 },
    ],
  },
];

const formatMoney = (amount) => `${amount.toLocaleString("vi-VN")} đ`;

const statusLabels = {
  waiting: "Chờ thanh toán",
  pending: "Chờ xác nhận",
  overdue: "Quá hạn",
  paid: "Đã thanh toán",
};

const statusStyles = {
  waiting: "bg-amber-100 text-amber-700",
  pending: "bg-amber-100 text-amber-700",
  overdue: "bg-rose-100 text-rose-700",
  paid: "bg-emerald-100 text-emerald-700",
};

function StatCard({ icon: Icon, label, value, iconStyle }) {
  return (
    <div className="flex min-w-0 items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className={`shrink-0 rounded-xl p-3 ${iconStyle}`}>
        <Icon className="h-7 w-7" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function InvoiceModal({ invoice, studentName, studentId, room, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-receipt, #invoice-receipt * { visibility: visible !important; }
          #invoice-receipt { position: absolute !important; inset: 0 !important; width: 100% !important; max-width: none !important; max-height: none !important; overflow: visible !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
          .receipt-print-hidden { display: none !important; }
        }
      `}</style>
      <section
        id="invoice-receipt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-title"
        className="relative max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng hóa đơn"
          className="receipt-print-hidden absolute right-4 top-4 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-dashed border-slate-300 pb-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Ban Quản lý KTX ICTU
          </p>
          <h2
            id="invoice-title"
            className="mt-1 text-2xl font-bold text-slate-900"
          >
            Phiếu thu điện tử
          </h2>
          <p className="mt-2 font-mono text-sm text-slate-500">
            Mã hóa đơn: {invoice.invoiceNumber}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-3 border-b border-slate-100 py-5 text-sm sm:grid-cols-2">
          <div>
            <span className="text-slate-500">Sinh viên</span>
            <p className="mt-0.5 font-semibold text-slate-900">{studentName}</p>
          </div>
          <div>
            <span className="text-slate-500">Mã sinh viên</span>
            <p className="mt-0.5 font-semibold text-slate-900">{studentId}</p>
          </div>
          <div>
            <span className="text-slate-500">Phòng ở</span>
            <p className="mt-0.5 font-semibold text-slate-900">{room}</p>
          </div>
          <div>
            <span className="text-slate-500">Kỳ thanh toán</span>
            <p className="mt-0.5 font-semibold text-slate-900">
              {invoice.period}
            </p>
          </div>
        </div>

        <div className="py-5">
          <h3 className="mb-3 text-sm font-bold text-slate-800">
            Chi tiết khoản thu
          </h3>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {invoice.fees.map((fee) => (
              <div
                key={fee.label}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <span className="text-slate-600">{fee.label}</span>
                <span className="shrink-0 font-semibold text-slate-800">
                  {formatMoney(fee.amount)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 bg-slate-50 px-4 py-3.5 text-sm">
              <span className="font-bold text-slate-800">Tổng cộng</span>
              <span className="shrink-0 text-base font-bold text-blue-700">
                {formatMoney(invoice.amount)}
              </span>
            </div>
          </div>
        </div>

        <div
          className={`rounded-xl border p-4 text-center ${
            invoice.status === "pending"
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
          }`}
        >
          <p
            className={`font-semibold ${
              invoice.status === "pending"
                ? "text-amber-800"
                : "text-emerald-800"
            }`}
          >
            {invoice.status === "pending"
              ? `Đã gửi yêu cầu thanh toán qua ${invoice.method} vào ngày ${invoice.paymentDate}`
              : `Đã thanh toán thành công qua ${invoice.method} vào ngày ${invoice.paymentDate}`}
          </p>
          <p
            className={`mt-1 text-xs ${
              invoice.status === "pending"
                ? "text-amber-700"
                : "text-emerald-700"
            }`}
          >
            {invoice.status === "pending"
              ? "Giao dịch đang chờ Ban Quản lý KTX ICTU đối soát."
              : "Hóa đơn điện tử được xác nhận bởi Ban Quản lý KTX ICTU."}
          </p>
        </div>

        <div className="receipt-print-hidden mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            title="In hóa đơn hoặc lưu thành file PDF"
          >
            <Printer className="h-4 w-4" />
            In / Tải PDF
            <Download className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}

export default function PaymentHistoryPage({ onSelectTab, onNavigate }) {
  const [paymentStatus, setPaymentStatus] = useState(() =>
    localStorage.getItem(PAYMENT_STATUS_STORAGE_KEY) === "pending"
      ? "pending"
      : "unpaid",
  );
  const [paymentDate, setPaymentDate] = useState(
    () => localStorage.getItem(PAYMENT_DATE_STORAGE_KEY) || "---",
  );
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const studentName =
    localStorage.getItem("ktx_fullname") ||
    localStorage.getItem("ktx_username") ||
    "Nguyễn Văn A";
  const studentId = localStorage.getItem("ktx_username") || "DTC123";
  const room = localStorage.getItem("ktx_room") || "P36 - Tòa A2";

  useEffect(() => {
    const syncPaymentStatus = () => {
      setPaymentStatus(
        localStorage.getItem(PAYMENT_STATUS_STORAGE_KEY) === "pending"
          ? "pending"
          : "unpaid",
      );
      setPaymentDate(localStorage.getItem(PAYMENT_DATE_STORAGE_KEY) || "---");
    };
    window.addEventListener("storage", syncPaymentStatus);
    window.addEventListener("ktx-payment-updated", syncPaymentStatus);
    return () => {
      window.removeEventListener("storage", syncPaymentStatus);
      window.removeEventListener("ktx-payment-updated", syncPaymentStatus);
    };
  }, []);

  const rows = invoiceRows.map((invoice, index) =>
    index === 0 && paymentStatus === "pending"
      ? { ...invoice, paymentDate, status: "pending" }
      : invoice,
  );

  const navigateToPayment = () => {
    if (onNavigate) {
      onNavigate("/student/payment");
      return;
    }
    window.dispatchEvent(
      new CustomEvent("student-navigate", {
        detail: { path: "/student/payment" },
      }),
    );
  };

  return (
    <StudentLayout
      activeTab="payment_history"
      onSelectTab={onSelectTab}
      userName={studentName}
      userRole="Sinh viên"
    >
      <div className="flex-1 space-y-6">
        <header className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl font-bold text-[#0f3b79] sm:text-3xl">
            Lịch sử thanh toán
          </h1>
        </header>

        <section
          aria-label="Thống kê thanh toán"
          className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5"
        >
          <StatCard
            icon={CheckCircle2}
            label="Đã thanh toán (2026)"
            value="4.520.000 đ"
            iconStyle="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            icon={Clock}
            label="Đang chờ thanh toán"
            value="592.500 đ"
            iconStyle="bg-amber-50 text-amber-600"
          />
          <StatCard
            icon={AlertTriangle}
            label="Quá hạn"
            value="692.500 đ"
            iconStyle="bg-rose-50 text-rose-600"
          />
          <StatCard
            icon={FileText}
            label="Tổng số kỳ đã đóng"
            value="3 kỳ"
            iconStyle="bg-blue-50 text-blue-600"
          />
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 text-sm font-medium text-slate-500">
                  <th scope="col" className="px-3 py-4 sm:px-4">
                    Kỳ thanh toán
                  </th>
                  <th scope="col" className="px-3 py-4 sm:px-4">
                    Ngày thanh toán
                  </th>
                  <th scope="col" className="px-3 py-4 sm:px-4">
                    Phương thức
                  </th>
                  <th scope="col" className="px-3 py-4 sm:px-4">
                    Số tiền
                  </th>
                  <th scope="col" className="px-3 py-4 sm:px-4">
                    Trạng thái
                  </th>
                  <th scope="col" className="px-3 py-4 text-right sm:px-4">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((invoice) => (
                  <tr
                    key={invoice.period}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-slate-800 sm:px-4">
                      {invoice.period}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-center text-sm text-slate-700 sm:px-4">
                      {invoice.paymentDate}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-700 sm:px-4">
                      {invoice.method}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-slate-800 sm:px-4">
                      {formatMoney(invoice.amount)}
                    </td>
                    <td className="px-3 py-4 sm:px-4">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${statusStyles[invoice.status]}`}
                      >
                        {statusLabels[invoice.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-right sm:px-4">
                      {invoice.status === "waiting" ||
                      invoice.status === "overdue" ? (
                        <button
                          type="button"
                          onClick={navigateToPayment}
                          className="text-sm font-medium text-blue-600 transition hover:text-blue-800 hover:underline"
                        >
                          Thanh toán
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(invoice)}
                          className="text-sm font-medium text-blue-600 transition hover:text-blue-800 hover:underline"
                        >
                          Xem hóa đơn
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex items-center justify-end gap-1">
            <button
              type="button"
              aria-label="Trang trước"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-current="page"
              className="h-8 min-w-8 rounded-lg bg-blue-600 px-2 text-sm font-semibold text-white"
            >
              {currentPage}
            </button>
            <button
              type="button"
              aria-label="Trang sau"
              disabled
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>

      {selectedInvoice && (
        <InvoiceModal
          invoice={selectedInvoice}
          studentName={studentName}
          studentId={studentId}
          room={room}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </StudentLayout>
  );
}
