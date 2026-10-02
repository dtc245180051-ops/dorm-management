import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Check,
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  Info,
  Sparkles,
  Zap,
} from 'lucide-react';
import StudentLayout from '../../layouts/Student';
import feedbackService from '../../services/feedbackService';
import FeatureLockedNotice from '../../components/FeatureLockedNotice';
import { resolveStudentStatus, STUDENT_STATUS } from '../../services/studentStatusService';

export default function FeedbackPage({
  userName,
  onNavigate,
  onNavigateDashboard,
  onNavigateRegister,
  onNavigateHistory,
  onNavigateProfile,
  onSelectTab,
  onLogout,
}) {
  const studentMsv = localStorage.getItem('ktx_username') || '';
  const [studentStatus, setStudentStatus] = useState(STUDENT_STATUS.NOT_REGISTERED);
  const studentName =
    userName ||
    localStorage.getItem('ktx_fullname') ||
    localStorage.getItem('ktx_username') ||
    '';

  // State form tối giản theo yêu cầu mới
  // Bỏ hoàn toàn: category (Loại phản ánh) và title (Tiêu đề)
  const [room, setRoom] = useState('');
  const [description, setDescription] = useState('');
  const [attachedImage, setAttachedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Status & feedback list
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successTicket, setSuccessTicket] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [myIncidents, setMyIncidents] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'history'

  const fileInputRef = useRef(null);

  // Tải lịch sử phản ánh của sinh viên
  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const items = await feedbackService.getStudentIncidents(studentMsv);
      setMyIncidents(items || []);
    } catch (e) {
      console.error('Failed to load incident history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
    resolveStudentStatus(studentMsv).then((res) => {
      setStudentStatus(res.status);
      if (res.activeRoom) {
        const assignedRoom =
          res.activeRoom.phong ||
          (res.activeRoom.so_phong ? `P${res.activeRoom.so_phong}` : '') ||
          '';
        setRoom(assignedRoom);
      } else {
        const fallbackRoom = localStorage.getItem('ktx_room') || 'P501';
        setRoom(fallbackRoom);
      }
    });
  }, [studentMsv]);

  // Xử lý chọn ảnh
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage('Dung lượng ảnh không được vượt quá 5MB.');
        return;
      }
      setErrorMessage('');
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target.result);
        setAttachedImage(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setAttachedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit form tối giản chỉ gửi: { phong, mo_ta, hinh_anh }
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!description.trim()) {
      setErrorMessage('Vui lòng nhập mô tả chi tiết sự cố bạn gặp phải.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        msv: studentMsv,
        ho_ten: studentName,
        phong: room.trim() || 'Chưa xếp',
        mo_ta: description.trim(),
        hinh_anh: attachedImage,
      };

      const result = await feedbackService.submitFeedback(payload);
      setSuccessTicket(result);

      // Reset form sau khi gửi thành công
      setDescription('');
      handleRemoveImage();

      // Cập nhật lại lịch sử phản ánh
      await loadHistory();
    } catch (err) {
      console.error('Lỗi khi gửi phản ánh:', err);
      setErrorMessage('Có lỗi xảy ra khi gửi phản ánh. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <StudentLayout
      activeTab="feedback"
      onSelectTab={onSelectTab || ((tabId) => {
        if (tabId === 'dashboard' && onNavigateDashboard) onNavigateDashboard();
        else if (tabId === 'register' && onNavigateRegister) onNavigateRegister();
        else if (tabId === 'history' && onNavigateHistory) onNavigateHistory();
        else if (tabId === 'profile' && onNavigateProfile) onNavigateProfile();
        else if (tabId === 'feedback') {
          // đang ở trang này
        } else {
          const pathMap = {
            dashboard: '/student/dashboard',
            register: '/student/register',
            transfer: '/student/transfer-room',
            history: '/student/history',
            feedback: '/student/feedback',
            profile: '/student/profile',
          };
          if (pathMap[tabId]) {
            window.history.pushState({}, '', pathMap[tabId]);
            window.dispatchEvent(new PopStateEvent('popstate'));
            window.dispatchEvent(new CustomEvent('student-navigate', { detail: { path: pathMap[tabId] } }));
          }
        }
      })}
      userName={studentName}
      userRole="Sinh viên"
      onLogout={onLogout}
    >
      <div className="flex-1 flex flex-col gap-5 max-w-full">
        {/* Banner thông báo thành công khi gửi phản ánh */}
        {successTicket && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-5 flex items-start justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                <Check className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-bold text-base text-emerald-900 flex items-center gap-2">
                  <span>Gửi phản ánh thành công! AI đã tiếp nhận và phân tích sự cố</span>
                  {successTicket.muc_do_uu_tien === 'Khẩn cấp' && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-rose-100 text-rose-700 rounded-md border border-rose-200">
                      Khẩn cấp
                    </span>
                  )}
                </h3>
                <div className="text-sm text-emerald-800 mt-1 space-y-1">
                  <p>
                    Mã phản ánh:{' '}
                    <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                      {successTicket.ma_phan_anh || successTicket.id}
                    </span>
                    {successTicket.phan_loai && (
                      <span className="ml-2 inline-block px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
                        AI phân loại: {successTicket.phan_loai}
                      </span>
                    )}
                  </p>
                  {successTicket.tieu_de && (
                    <p className="text-xs text-emerald-700">
                      <strong>AI tóm tắt tiêu đề:</strong> &ldquo;{successTicket.tieu_de}&rdquo;
                    </p>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="text-xs font-semibold text-emerald-800 underline hover:text-emerald-950 cursor-pointer"
                  >
                    Xem tiến trình xử lý trong lịch sử phản ánh &rarr;
                  </button>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSuccessTicket(null)}
              className="text-emerald-600 hover:text-emerald-900 p-1.5 rounded-lg hover:bg-emerald-100 transition cursor-pointer"
              title="Đóng thông báo"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Tiêu đề trang */}
        <div className="flex items-center gap-3.5 select-none">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600">
            <svg
              className="w-5 h-5 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">
              Gửi phản ánh sự cố & Báo hỏng KTX
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Tiếp nhận phản ánh tích hợp AI tự động phân loại, tóm tắt và điều phối kỹ thuật nhanh chóng
            </p>
          </div>
        </div>

        {studentStatus !== STUDENT_STATUS.ACTIVE_RESIDENT ? (
          <FeatureLockedNotice
            featureName="Gửi phản ánh & Sự cố"
            status={studentStatus}
            onNavigate={onNavigate || onNavigateRegister}
            onSelectTab={onSelectTab}
          />
        ) : (
          /* Khối chính: Card Gửi phản ánh theo chuẩn Figma */
          <div className="flex flex-1 flex-col rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
            {/* Header tiêu đề với Icon bong bóng chat màu xanh */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#0080ff] flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
                  <svg
                    className="w-6 h-6 fill-current"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 leading-tight flex items-center gap-2">
                    <span>Gửi phản ánh</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                      <Sparkles className="w-3 h-3 text-blue-500" />
                      AI Tiếp nhận tự động
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Chỉ cần nhập mô tả sự cố, hệ thống AI sẽ tự động phân loại và tóm tắt gửi tới Ban Quản lý
                  </p>
                </div>
              </div>

              {/* Chuyển đổi xem biểu mẫu hoặc lịch sử phản ánh */}
              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                    activeTab === 'create'
                      ? 'bg-white text-blue-600 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Gửi phản ánh mới
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'history'
                      ? 'bg-white text-blue-600 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Lịch sử phản ánh</span>
                  {myIncidents.length > 0 && (
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] flex items-center justify-center font-bold">
                      {myIncidents.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {activeTab === 'create' ? (
              /* Layout 2 cột: Cột trái nhập form, Cột phải Một số lưu ý */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* CỘT TRÁI: FORM THÔNG TIN PHẢN ÁNH TỐI GIẢN (8 cột) */}
                <div className="lg:col-span-8 flex flex-col">
                  <div className="text-base sm:text-lg font-bold text-[#1e40af] pb-3 border-b border-slate-200/80 mb-5 flex items-center justify-between">
                    <span>Thông tin sự cố</span>
                    <span className="text-xs font-normal text-slate-500">
                      Sinh viên: <strong>{studentName}</strong> ({studentMsv})
                    </span>
                  </div>

                  {errorMessage && (
                    <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Trường 1: Phòng đang lưu trú (Read-only / Disabled, SV không cần gõ tay) */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                        <span>Phòng lưu trú</span>
                        <span className="text-[11px] font-normal text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          Tự động điền theo phòng đang ở
                        </span>
                      </label>
                      <input
                        type="text"
                        value={room || 'Đang cập nhật...'}
                        readOnly
                        disabled
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-100 text-slate-700 font-semibold cursor-not-allowed select-none"
                      />
                    </div>

                    {/* Trường 2: Mô tả chi tiết (Textarea để sinh viên gõ tự do nội dung sự cố gặp phải) */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                        <span>Mô tả chi tiết sự cố</span>
                        <span className="text-[11px] text-blue-600 font-medium flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-blue-500" />
                          AI tự động tóm tắt & phân loại
                        </span>
                      </label>
                      <textarea
                        rows={5}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Mô tả sự cố bạn gặp phải (Ví dụ: Bóng đèn hành lang trước cửa phòng 302 bị cháy tối om; Rò rỉ nước nhà vệ sinh chảy tràn ra sàn phòng...)"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 text-slate-800 placeholder-slate-400 transition resize-y"
                      />
                    </div>

                    {/* Trường 3: Đính kèm hình ảnh (nếu có) */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                        Đính kèm hình ảnh (nếu có)
                      </label>

                      <div className="flex flex-col sm:flex-row items-start gap-4">
                        {/* Upload Box */}
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full sm:w-auto min-w-[280px] px-4 py-3 rounded-xl border border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50/50 flex items-center gap-3.5 cursor-pointer transition select-none group"
                        >
                          <div className="text-[#0080ff] group-hover:scale-105 transition shrink-0">
                            <Camera className="w-6 h-6 stroke-[1.8]" />
                          </div>
                          <div className="text-xs text-slate-500 group-hover:text-slate-700">
                            Kéo thả ảnh hoặc nhấn để chọn file (JPG, PNG)
                          </div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </div>

                        {/* Xem trước ảnh nếu có */}
                        {imagePreview && (
                          <div className="relative inline-flex items-center gap-2 p-1.5 border border-blue-200 bg-blue-50/50 rounded-xl">
                            <img
                              src={imagePreview}
                              alt="Ảnh đính kèm"
                              className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                            />
                            <div className="text-xs text-slate-700 pr-2">
                              <span className="font-semibold block text-blue-700">Đã chọn ảnh</span>
                              <span className="text-[11px] text-slate-500">Sẵn sàng gửi</span>
                            </div>
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-white transition cursor-pointer"
                              title="Xóa ảnh"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Nút gửi phản ánh */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                        <span>Hệ thống AI xử lý ngay sau khi gửi</span>
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2.5 bg-[#0080ff] hover:bg-[#0070e0] text-white font-medium text-sm rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>AI đang phân tích & gửi...</span>
                          </>
                        ) : (
                          <span>Gửi phản ánh</span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* CỘT PHẢI: MỘT SỐ LƯU Ý (4 cột) */}
                <div className="lg:col-span-4">
                  <div className="bg-[#f0f7ff] rounded-2xl p-6 sm:p-7 border border-blue-100 flex flex-col justify-start">
                    <h3 className="text-base sm:text-lg font-bold text-[#1e3a8a] text-center mb-6 flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5 text-blue-600" />
                      Cơ chế AI thông minh
                    </h3>

                    <div className="space-y-6">
                      {/* Mục 1 */}
                      <div className="flex items-start gap-3">
                        <div className="text-[#0080ff] shrink-0 mt-0.5">
                          <Check className="w-5 h-5 stroke-[2.8]" />
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                          <strong>Tối giản thao tác:</strong> Không cần chọn loại phản ánh hay nghĩ tiêu đề. Bạn chỉ cần mô tả chi tiết, AI sẽ tự động phân loại và tóm tắt.
                        </p>
                      </div>

                      {/* Mục 2 */}
                      <div className="flex items-start gap-3">
                        <div className="text-[#0080ff] shrink-0 mt-0.5">
                          <Check className="w-5 h-5 stroke-[2.8]" />
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                          <strong>Tự động nhận diện khẩn cấp:</strong> Các sự cố chập điện, cháy nổ, ngập nước được AI gắn cờ &ldquo;Khẩn cấp&rdquo; để Ban Quản lý xử lý ngay lập tức.
                        </p>
                      </div>

                      {/* Mục 3 */}
                      <div className="flex items-start gap-3">
                        <div className="text-[#0080ff] shrink-0 mt-0.5">
                          <Check className="w-5 h-5 stroke-[2.8]" />
                        </div>
                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                          <strong>Đính kèm hình ảnh:</strong> Giúp đội kỹ thuật mang đúng dụng cụ và linh kiện thay thế khi đến phòng.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* TAB LỊCH SỬ PHẢN ÁNH CỦA SINH VIÊN */
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">
                    Lịch sử các phản ánh đã gửi tới Ban Quản lý
                  </h2>
                  <button
                    type="button"
                    onClick={loadHistory}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition cursor-pointer border border-slate-200"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                    <span>Làm mới</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Mã đơn</th>
                        <th className="py-3 px-4">Phòng</th>
                        <th className="py-3 px-4">Phân loại AI</th>
                        <th className="py-3 px-4">Tiêu đề & Nội dung</th>
                        <th className="py-3 px-4">Ngày gửi</th>
                        <th className="py-3 px-4">Trạng thái xử lý</th>
                        <th className="py-3 px-4">Ghi chú từ BQL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {myIncidents.length > 0 ? (
                        myIncidents.map((pa, idx) => {
                          const isPending = pa.trang_thai === 'CHO_XU_LY';
                          const isProcessing = pa.trang_thai === 'DANG_XU_LY';
                          const isResolved = pa.trang_thai === 'DA_XU_LY';
                          const isRejected = pa.trang_thai === 'TU_CHOI';
                          const isUrgent = pa.muc_do_uu_tien === 'Khẩn cấp';

                          return (
                            <tr key={idx} className="hover:bg-slate-50/70 transition">
                              <td className="py-3.5 px-4 font-mono font-semibold text-blue-600">
                                {pa.ma_phan_anh || pa.id}
                              </td>
                              <td className="py-3.5 px-4 font-medium text-slate-800">
                                {pa.phong || '---'}
                              </td>
                              <td className="py-3.5 px-4 text-xs">
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-medium border border-blue-100">
                                  {pa.phan_loai || pa.loai_phan_anh || 'Cơ sở vật chất'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 max-w-xs">
                                <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                                  <span>{pa.tieu_de || pa.mo_ta?.slice(0, 30)}</span>
                                  {isUrgent && (
                                    <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-100 text-rose-700 border border-rose-200">
                                      Khẩn cấp
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 truncate" title={pa.mo_ta}>
                                  {pa.mo_ta}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-xs text-slate-500">
                                {pa.ngay_gui
                                  ? new Date(pa.ngay_gui).toLocaleDateString('vi-VN')
                                  : 'Hôm nay'}
                              </td>
                              <td className="py-3.5 px-4">
                                {isResolved ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    Đã xử lý xong
                                  </span>
                                ) : isProcessing ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                    Đang xử lý
                                  </span>
                                ) : isRejected ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                    Từ chối
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                    Chờ tiếp nhận
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs">
                                {pa.ghi_chu_xu_ly || (
                                  <span className="text-slate-400 italic">Chưa có ghi chú</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            Bạn chưa có phản ánh nào được gửi.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
