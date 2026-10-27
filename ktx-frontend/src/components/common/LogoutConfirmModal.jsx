import React, { useEffect } from 'react';
import { LogOut, X, Loader2 } from 'lucide-react';

/**
 * Modal Xác nhận Đăng xuất (Logout Confirmation Modal) dùng chung cho cả 3 phân hệ:
 * - Sinh viên (Student)
 * - Kế toán (Accountant)
 * - Quản lý / Ban quản lý (Manager/Admin)
 *
 * @param {boolean} isOpen - Trạng thái hiển thị modal
 * @param {function} onClose - Hàm đóng modal khi nhấn Hủy / Ở lại hoặc click backdrop
 * @param {function} onConfirm - Hàm thực thi đăng xuất khi người dùng bấm xác nhận
 * @param {boolean} isLoading - Trạng thái đang đăng xuất (spinner hiển thị trên nút)
 * @param {string} [userName] - Tên người dùng hiển thị trên badge (tùy chọn)
 * @param {string} [userRole] - Vai trò người dùng hiển thị trên badge (tùy chọn)
 * @param {string} [title] - Tiêu đề modal (mặc định: "Xác nhận đăng xuất")
 * @param {string} [message] - Nội dung mô tả xác nhận
 */
export default function LogoutConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  userName,
  userRole,
  title = 'Xác nhận đăng xuất',
  message = 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống iDORM không?',
}) {
  // Lắng nghe phím ESC để đóng modal khi không ở trạng thái loading
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={() => {
        if (!isLoading) onClose();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in"
      aria-modal="true"
      role="dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm sm:max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 sm:p-7 text-center overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95 select-none"
      >
        {/* Nút X đóng góc trên bên phải */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon cảnh báo đăng xuất được bọc trong vòng tròn nền đỏ/cam nhạt */}
        <div className="mx-auto w-14 h-14 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mb-4 text-rose-500 shadow-sm shadow-rose-200/50">
          <LogOut className="w-7 h-7 stroke-[2.2] translate-x-0.5" />
        </div>

        {/* Tiêu đề & Nội dung mô tả */}
        <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
          {title}
        </h3>
        <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto mb-5">
          {message}
        </p>

        {/* Huy hiệu thông tin người dùng (nếu có) */}
        {userName && (
          <div className="flex items-center justify-center gap-2.5 px-3.5 py-2 bg-slate-50 border border-slate-200/80 rounded-xl mb-6 w-full text-xs">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-slate-800 truncate max-w-[180px]">
              {userName}
            </span>
            {userRole && (
              <span className="text-slate-400 font-normal shrink-0">
                • {userRole}
              </span>
            )}
          </div>
        )}

        {/* Các nút hành động: Ở lại (Ghost) / Đăng xuất (Rose) */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Ở lại
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-semibold text-sm shadow-md shadow-rose-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang đăng xuất...</span>
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
