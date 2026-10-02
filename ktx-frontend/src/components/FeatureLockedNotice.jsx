import React from "react";
import { Lock, ArrowRight, Clock, FileEdit, ShieldAlert } from "lucide-react";
import { STUDENT_STATUS } from "../services/studentStatusService";

/**
 * FeatureLockedNotice
 * Component Empty State / Khóa tính năng dành cho sinh viên chưa có phòng nội trú.
 *
 * @param {object} props
 * @param {string} [props.featureName] - Tên tính năng (VD: "Chuyển / trả phòng", "Gửi phản ánh")
 * @param {string} props.status - "NOT_REGISTERED" | "PENDING_APPROVAL" | "ACTIVE_RESIDENT"
 * @param {function} [props.onNavigate] - Callback chuyển trang
 * @param {function} [props.onSelectTab] - Callback chuyển tab
 */
export default function FeatureLockedNotice({
  featureName = "Tính năng nội trú",
  status = STUDENT_STATUS.NOT_REGISTERED,
  onNavigate,
  onSelectTab,
}) {
  const isPending = status === STUDENT_STATUS.PENDING_APPROVAL;

  const handleGoToRegister = () => {
    if (onNavigate) {
      onNavigate("/student/register");
    } else if (onSelectTab) {
      onSelectTab("register");
    } else {
      window.history.pushState({}, "", "/student/register");
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(
        new CustomEvent("student-navigate", {
          detail: { path: "/student/register" },
        })
      );
    }
  };

  const handleGoToHistory = () => {
    if (onNavigate) {
      onNavigate("/student/history?tab=registration");
    } else if (onSelectTab) {
      onSelectTab("history");
    } else {
      window.history.pushState({}, "", "/student/history?tab=registration");
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(
        new CustomEvent("student-navigate", {
          detail: { path: "/student/history?tab=registration" },
        })
      );
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/70 p-6 sm:p-10 text-center shadow-sm flex flex-col items-center justify-center min-h-[380px] my-4 select-none animate-in fade-in zoom-in-95 duration-200">
      {/* Icon Ổ khóa / Cảnh báo nhẹ nhàng */}
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 mb-5 shadow-xs">
        <Lock className="w-8 h-8 text-amber-600 stroke-[1.8]" />
      </div>

      {/* Tag thông tin tính năng */}
      {featureName && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 mb-3 border border-slate-200/60">
          <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
          {featureName}
        </span>
      )}

      {/* Tiêu đề chuẩn theo yêu cầu nghiệp vụ */}
      <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight mb-2.5 max-w-xl">
        Tính năng chỉ mở sau khi bạn hoàn tất đăng ký hoặc được xếp phòng KTX
      </h3>

      {/* Mô tả chi tiết phân theo trạng thái */}
      <p className="text-sm text-slate-500 max-w-lg leading-relaxed mb-7">
        {isPending
          ? "Đơn đăng ký của bạn đang chờ Ban Quản lý xét duyệt. Sau khi quản lý phê duyệt và xếp phòng chính thức, toàn bộ tiện ích nội trú sẽ được tự động kích hoạt."
          : "Bạn hiện chưa nộp đơn đăng ký phòng hoặc chưa được xếp phòng lưu trú KTX. Vui lòng hoàn tất đăng ký phòng để sử dụng tính năng này."}
      </p>

      {/* Nhóm nút hành động */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleGoToRegister}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-sm transition-all shadow-sm shadow-blue-500/25 cursor-pointer"
        >
          <FileEdit className="w-4 h-4" />
          <span>Đến trang Đăng ký phòng</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {isPending && (
          <button
            type="button"
            onClick={handleGoToHistory}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-700 font-semibold text-sm transition-all border border-slate-200 cursor-pointer"
          >
            <Clock className="w-4 h-4 text-slate-500" />
            <span>Theo dõi tiến độ đơn tại Lịch sử</span>
          </button>
        )}
      </div>
    </div>
  );
}
