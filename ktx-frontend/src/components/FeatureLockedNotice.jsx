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

  const handleAction = () => {
    if (isPending) {
      if (onNavigate) {
        onNavigate("/student/history?tab=registration");
      } else if (onSelectTab) {
        onSelectTab("history");
      } else {
        window.history.pushState({}, "", "/student/history?tab=registration");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    } else {
      if (onNavigate) {
        onNavigate("/student/register");
      } else if (onSelectTab) {
        onSelectTab("register");
      } else {
        window.history.pushState({}, "", "/student/register");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/70 p-6 sm:p-8 text-center shadow-sm flex flex-col items-center justify-center min-h-[380px] my-4 select-none animate-in fade-in zoom-in-95 duration-200">
      {/* Icon Ổ khóa / Cảnh báo nhẹ nhàng */}
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-600 mb-5 shadow-xs">
        <Lock className="w-8 h-8 text-amber-600 stroke-[1.8]" />
      </div>

      {/* Tag thông tin tính năng */}
      {featureName && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 mb-3 border border-slate-200/60">
          <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
          {featureName}
        </span>
      )}

      {/* Tiêu đề chuẩn theo yêu cầu */}
      <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight mb-2.5">
        Tính năng này chỉ dành cho sinh viên đang lưu trú nội trú
      </h3>

      {/* Mô tả chi tiết phân theo trạng thái */}
      <p className="text-sm text-slate-500 max-w-lg leading-relaxed mb-7">
        {isPending
          ? "Đơn đăng ký phòng của bạn đang được Ban Quản lý xét duyệt. Tính năng này sẽ mở sau khi bạn được xếp phòng thành công."
          : "Bạn hiện chưa có phòng tại Ký túc xá. Vui lòng hoàn tất thủ tục đăng ký ở trước khi sử dụng tính năng này."}
      </p>

      {/* Nút hành động */}
      <button
        type="button"
        onClick={handleAction}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-sm transition-all shadow-sm shadow-blue-500/25 cursor-pointer"
      >
        {isPending ? (
          <>
            <Clock className="w-4 h-4" />
            <span>Kiểm tra tiến độ đơn</span>
          </>
        ) : (
          <>
            <FileEdit className="w-4 h-4" />
            <span>Đến trang Đăng ký phòng</span>
          </>
        )}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
