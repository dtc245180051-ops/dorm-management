import React, { useEffect } from 'react';
import { LogOut, X, AlertTriangle } from 'lucide-react';

export default function LogoutModal({
  isOpen,
  onClose,
  onConfirm,
  userName = 'Sinh viên',
  userRole = 'Sinh viên',
}) {
  // Lắng nghe phím ESC để đóng modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[999] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 transition-all duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-sm sm:max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 flex flex-col items-center text-center relative overflow-hidden animate-in fade-in zoom-in-95 duration-200 select-none"
      >
        {/* Nút X đóng góc trên bên phải */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Khối Icon Đăng xuất nổi bật */}
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-4 text-rose-500 shadow-md shadow-rose-500/10">
          <LogOut className="w-8 h-8 stroke-[2.2] translate-x-0.5" />
        </div>

        {/* Tiêu đề & Nội dung */}
        <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
          Xác nhận đăng xuất
        </h3>
        <p className="text-sm text-slate-500 leading-relaxed max-w-xs mb-5">
          Bạn có chắc chắn muốn đăng xuất khỏi hệ thống ký túc xá không?
        </p>

        {/* Huy hiệu thông tin người dùng đang đăng xuất */}
        {userName && (
          <div className="flex items-center gap-2.5 px-3.5 py-2 bg-slate-50 border border-slate-200/80 rounded-xl mb-6 w-full justify-center text-xs">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[11px]">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-slate-800">{userName}</span>
            {userRole && <span className="text-slate-400 font-normal">• {userRole}</span>}
          </div>
        )}

        {/* Các nút hành động */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onConfirm();
            }}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm shadow-md shadow-rose-500/20 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    </div>
  );
}
