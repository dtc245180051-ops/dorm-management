import React, { useState } from 'react';
import { authService } from '../../services/authService';

/**
 * Modal Xác thực Google Account Chooser
 * Chỉ chấp nhận tài khoản Google có đuôi email @ictu.edu.vn
 */
export default function GoogleAuthModal({
  isOpen,
  onClose,
  mode = 'login', // 'login' | 'register'
  onSuccess,
}) {
  const [selectedEmail, setSelectedEmail] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [isUsingCustom, setIsUsingCustom] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Danh sách tài khoản Google ICTU mẫu hỗ trợ đăng nhập nhanh 1-chạm
  const suggestedAccounts = [
    {
      name: 'Nguyễn Thị Ánh',
      email: 'dtc245180051@ictu.edu.vn',
      avatarColor: 'bg-emerald-600',
      initials: 'Á',
    },
    {
      name: 'Nguyễn Hoàng Long',
      email: 'dtc245180099@ictu.edu.vn',
      avatarColor: 'bg-blue-600',
      initials: 'L',
    },
  ];

  const handleSelectAccount = (acc) => {
    setSelectedEmail(acc.email);
    setFullName(acc.name);
    setIsUsingCustom(false);
    setErrorMsg('');
  };

  const handleCustomToggle = () => {
    setIsUsingCustom(true);
    setSelectedEmail('');
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalEmail = (isUsingCustom ? customEmail : selectedEmail).trim().toLowerCase();

    if (!finalEmail) {
      setErrorMsg('Vui lòng chọn hoặc nhập tài khoản Google của bạn.');
      return;
    }

    // Kiểm tra nghiêm ngặt: Chỉ chấp nhận email đuôi @ictu.edu.vn
    if (!finalEmail.endsWith('@ictu.edu.vn')) {
      setErrorMsg('Tài khoản không hợp lệ! Hệ thống chỉ chấp nhận tài khoản Google có đuôi @ictu.edu.vn');
      return;
    }

    const prefix = finalEmail.split('@')[0].trim();
    if (!prefix) {
      setErrorMsg('Phần tên người dùng trước ký tự @ không hợp lệ.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await authService.loginWithGoogle({
        email: finalEmail,
        fullName: fullName.trim() || prefix.toUpperCase(),
        googleId: `google_${prefix}`,
      });

      if (res.success) {
        if (onSuccess) {
          onSuccess(res.data);
        }
        onClose();
      } else {
        setErrorMsg(res.message || 'Xác thực Google không thành công. Vui lòng thử lại.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Đã xảy ra lỗi khi kết nối máy chủ Google Auth.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-7 relative border border-slate-100 flex flex-col space-y-5"
        role="dialog"
        aria-modal="true"
      >
        {/* Nút đóng */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
          title="Đóng cửa sổ"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header Google */}
        <div className="text-center pt-2">
          {/* Logo Google đa sắc */}
          <div className="flex justify-center mb-3">
            <svg className="w-10 h-10" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">
            {mode === 'register' ? 'Đăng ký bằng Google' : 'Đăng nhập bằng Google'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            để tiếp tục đến <strong className="text-blue-600 font-semibold">iDORM - Ký túc xá ICTU</strong>
          </p>
        </div>

        {/* Thông báo bắt buộc email @ictu.edu.vn */}
        <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200/60 text-xs text-blue-800 flex items-start gap-2.5">
          <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div className="leading-relaxed">
            Quy định: Hệ thống chỉ chấp nhận tài khoản Google do trường cấp có đuôi{' '}
            <span className="font-bold underline">@ictu.edu.vn</span>.
          </div>
        </div>

        {/* Báo lỗi nếu có */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2 animate-shake">
            <svg className="w-4 h-4 text-rose-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Danh sách tài khoản gợi ý */}
        {!isUsingCustom ? (
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Chọn tài khoản Google sinh viên
            </div>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
              {suggestedAccounts.map((acc) => (
                <div
                  key={acc.email}
                  onClick={() => handleSelectAccount(acc)}
                  className={`p-3.5 flex items-center gap-3.5 cursor-pointer transition-colors ${
                    selectedEmail === acc.email ? 'bg-blue-50/70 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full ${acc.avatarColor} text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs`}
                  >
                    {acc.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-800 truncate">{acc.name}</div>
                    <div className="text-xs text-slate-500 truncate">{acc.email}</div>
                  </div>
                  {selectedEmail === acc.email && (
                    <svg className="w-5 h-5 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              ))}

              {/* Tùy chọn sử dụng tài khoản khác */}
              <button
                type="button"
                onClick={handleCustomToggle}
                className="w-full p-3.5 flex items-center gap-3.5 text-left hover:bg-slate-50 transition-colors text-slate-600 cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 border border-dashed border-slate-300">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                </div>
                <div className="text-sm font-medium text-slate-700">Sử dụng tài khoản Google khác</div>
              </button>
            </div>
          </div>
        ) : (
          /* Nhập tài khoản Google ICTU tùy chỉnh */
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Nhập email Google sinh viên</span>
              <button
                type="button"
                onClick={() => setIsUsingCustom(false)}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                &larr; Chọn từ danh sách
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Email trường (@ictu.edu.vn) <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                placeholder="Ví dụ: dtc245180001@ictu.edu.vn"
                value={customEmail}
                onChange={(e) => {
                  setCustomEmail(e.target.value);
                  setErrorMsg('');
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Họ và tên (Tùy chọn)
              </label>
              <input
                type="text"
                placeholder="Nhập họ và tên sinh viên"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        )}

        {/* Nút hành động */}
        <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Đang xác thực...</span>
              </>
            ) : (
              <span>Tiếp tục</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
