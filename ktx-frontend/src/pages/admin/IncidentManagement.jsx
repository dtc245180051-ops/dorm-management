import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  Wrench,
  XCircle,
  Filter,
  Eye,
  MessageSquare,
  Check,
  X,
  FileText,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import feedbackService from '../../services/feedbackService';
import IncidentSummaryCard from '../../components/IncidentSummaryCard';

export default function IncidentManagement({ searchTerm = '' }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [localSearch, setLocalSearch] = useState('');

  // Process Modal Form
  const [newStatus, setNewStatus] = useState('DANG_XU_LY');
  const [processNote, setProcessNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState(null);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const data = await feedbackService.getAllIncidents();
      setIncidents(data || []);
    } catch (err) {
      console.error('Lỗi khi tải danh sách phản ánh:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const handleOpenProcessModal = (item) => {
    setSelectedIncident(item);
    setNewStatus(item.trang_thai === 'CHO_XU_LY' ? 'DANG_XU_LY' : item.trang_thai);
    setProcessNote(item.ghi_chu_xu_ly || '');
  };

  const handleSaveStatus = async (e) => {
    e.preventDefault();
    if (!selectedIncident) return;

    setIsProcessing(true);
    try {
      const updated = await feedbackService.updateIncidentStatus(
        selectedIncident.ma_phan_anh || selectedIncident.id,
        newStatus,
        processNote.trim()
      );

      setNotification({
        type: 'success',
        message: `Đã cập nhật trạng thái phản ánh ${selectedIncident.ma_phan_anh || selectedIncident.id} thành công!`,
      });

      setSelectedIncident(null);
      await fetchIncidents();
    } catch (err) {
      console.error('Lỗi cập nhật trạng thái:', err);
      setNotification({
        type: 'error',
        message: 'Có lỗi xảy ra khi cập nhật trạng thái. Vui lòng thử lại.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Lọc dữ liệu
  const effectiveSearch = (searchTerm || localSearch).trim().toLowerCase();
  const filteredIncidents = incidents.filter((item) => {
    // 1. Lọc theo trạng thái
    if (statusFilter !== 'ALL' && item.trang_thai !== statusFilter) {
      return false;
    }
    // 2. Lọc theo danh mục
    const itemCat = item.phan_loai || item.loai_phan_anh || 'Khác';
    if (categoryFilter !== 'ALL' && itemCat !== categoryFilter) {
      return false;
    }
    // 3. Lọc theo từ khóa tìm kiếm
    if (effectiveSearch) {
      const targetText = `${item.ma_phan_anh || ''} ${item.msv || ''} ${item.ho_ten || ''} ${item.phong || ''} ${item.tieu_de || ''} ${item.mo_ta || ''}`.toLowerCase();
      if (!targetText.includes(effectiveSearch)) {
        return false;
      }
    }
    return true;
  });

  // Thống kê nhanh
  const countPending = incidents.filter((i) => i.trang_thai === 'CHO_XU_LY').length;
  const countProcessing = incidents.filter((i) => i.trang_thai === 'DANG_XU_LY').length;
  const countResolved = incidents.filter((i) => i.trang_thai === 'DA_XU_LY').length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-800">
            TIẾP NHẬN PHẢN ÁNH & SỰ CỐ
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Trung tâm điều phối sự cố KTX tích hợp AI tự động phân tích và trích xuất dữ liệu
          </p>
        </div>
      </div>

      {/* Thông báo cập nhật */}
      {notification && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between shadow-2xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CARD AI TÓM TẮT SỰ CỐ TRONG NGÀY (IncidentSummaryCard) */}
      <IncidentSummaryCard
        refreshTrigger={incidents.length}
        onRefresh={fetchIncidents}
      />

      {/* 4 thẻ thống kê */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tổng số */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Tổng số phản ánh
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {incidents.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Từ sinh viên lưu trú</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>

        {/* Chờ xử lý */}
        <div className="bg-white rounded-2xl border border-amber-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-amber-600 uppercase tracking-wider">
              Chờ tiếp nhận
            </div>
            <div className="text-2xl font-black text-amber-700 mt-1">
              {countPending}
            </div>
            <div className="text-[11px] text-amber-600 mt-0.5">Cần cán bộ kiểm tra</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Đang xử lý */}
        <div className="bg-white rounded-2xl border border-blue-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              Đang xử lý
            </div>
            <div className="text-2xl font-black text-blue-700 mt-1">
              {countProcessing}
            </div>
            <div className="text-[11px] text-blue-600 mt-0.5">Đã cử kỹ thuật/thợ</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Wrench className="w-6 h-6" />
          </div>
        </div>

        {/* Đã hoàn thành */}
        <div className="bg-white rounded-2xl border border-emerald-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
              Đã giải quyết
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-1">
              {countResolved}
            </div>
            <div className="text-[11px] text-emerald-600 mt-0.5">Đã khắc phục sự cố</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Bảng danh sách tiếp nhận phản ánh & Báo hỏng KTX */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        {/* Toolbar lọc và tìm kiếm */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-blue-600" />
              Danh sách tiếp nhận phản ánh & Báo hỏng KTX
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Tiếp nhận trực tiếp phản ánh từ sinh viên về cơ sở vật chất, điện nước và điều phối kỹ thuật xử lý
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Lọc danh mục */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
            >
              <option value="ALL">Tất cả phân loại</option>
              <option value="Điện nước">Điện nước</option>
              <option value="Cơ sở vật chất">Cơ sở vật chất</option>
              <option value="An ninh trật tự">An ninh trật tự</option>
              <option value="Vệ sinh">Vệ sinh</option>
              <option value="Khác">Khác</option>
            </select>

            {/* Nút làm mới */}
            <button
              type="button"
              onClick={fetchIncidents}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition cursor-pointer border border-slate-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Tab lọc trạng thái */}
        <div className="flex items-center gap-2 pt-4 pb-2 border-b border-slate-100 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'ALL', label: 'Tất cả' },
            { id: 'CHO_XU_LY', label: 'Chờ tiếp nhận' },
            { id: 'DANG_XU_LY', label: 'Đang xử lý' },
            { id: 'DA_XU_LY', label: 'Đã giải quyết' },
            { id: 'TU_CHOI', label: 'Từ chối' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${
                statusFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Bảng dữ liệu */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 rounded-l-lg">Mã đơn</th>
                <th className="py-3 px-4">Sinh viên</th>
                <th className="py-3 px-4">Phòng</th>
                <th className="py-3 px-4">Phân loại</th>
                <th className="py-3 px-4">Tiêu đề & Nội dung</th>
                <th className="py-3 px-4">Ảnh đính kèm</th>
                <th className="py-3 px-4">Ngày gửi</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right rounded-r-lg">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredIncidents.length > 0 ? (
                filteredIncidents.map((item, idx) => {
                  const targetId = item.ma_phan_anh || item.id;
                  const isPending = item.trang_thai === 'CHO_XU_LY';
                  const isProcessing = item.trang_thai === 'DANG_XU_LY';
                  const isResolved = item.trang_thai === 'DA_XU_LY';
                  const isRejected = item.trang_thai === 'TU_CHOI';
                  const isUrgent = item.muc_do_uu_tien === 'Khẩn cấp';
                  const categoryName = item.phan_loai || item.loai_phan_anh || 'Cơ sở vật chất';

                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-mono font-semibold text-blue-600">
                        {targetId}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{item.ho_ten || 'Sinh viên'}</div>
                        <div className="text-xs font-mono text-slate-500">{item.msv}</div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {item.phong || '---'}
                      </td>
                      {/* Cột Phân loại: Hiển thị nhãn do AI tự gắn */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                            categoryName === 'Điện nước'
                              ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                              : categoryName === 'An ninh trật tự'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : categoryName === 'Vệ sinh'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : categoryName === 'Cơ sở vật chất'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {categoryName}
                        </span>
                      </td>
                      {/* Cột Tiêu đề & Nội dung: Dòng trên in đậm Tiêu đề ngắn do AI sinh ra, dòng dưới hiển thị Mô tả chi tiết của sinh viên */}
                      <td className="py-3.5 px-4 max-w-sm">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 leading-snug" title={item.tieu_de}>
                            {item.tieu_de || 'Sự cố phòng'}
                          </span>
                          {isUrgent && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded bg-rose-100 text-rose-700 border border-rose-200">
                              <ShieldAlert className="w-3 h-3" />
                              Khẩn cấp
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed" title={item.mo_ta}>
                          {item.mo_ta}
                        </div>
                        {item.ghi_chu_xu_ly && (
                          <div className="text-[11px] text-blue-600 mt-1 truncate" title={item.ghi_chu_xu_ly}>
                            <span className="font-semibold">Ghi chú:</span> {item.ghi_chu_xu_ly}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {item.hinh_anh ? (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(item.hinh_anh)}
                            className="group relative inline-block cursor-pointer"
                            title="Bấm để xem ảnh phóng to"
                          >
                            <img
                              src={item.hinh_anh}
                              alt="Ảnh đính kèm"
                              className="w-10 h-10 object-cover rounded-lg border border-slate-200 group-hover:opacity-80 transition"
                            />
                            <div className="absolute inset-0 bg-black/30 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white">
                              <Eye className="w-3.5 h-3.5" />
                            </div>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Không có</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500">
                        {item.ngay_gui
                          ? new Date(item.ngay_gui).toLocaleDateString('vi-VN')
                          : 'Hôm nay'}
                      </td>
                      {/* Cột Trạng thái: Mặc định là "Chờ tiếp nhận" */}
                      <td className="py-3.5 px-4">
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Đã giải quyết
                          </span>
                        ) : isProcessing ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            Đang xử lý
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Từ chối
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Chờ tiếp nhận
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenProcessModal(item)}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs ${
                            isPending
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {isPending ? 'Tiếp nhận xử lý' : 'Cập nhật'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Không có phản ánh nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Cập nhật / Xử lý phản ánh */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-lg text-slate-900">
                  Xử lý phản ánh {selectedIncident.ma_phan_anh || selectedIncident.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chi tiết phản ánh tóm tắt */}
            <div className="my-4 p-3.5 bg-slate-50 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Sinh viên:</span>
                <span className="font-semibold text-slate-800">
                  {selectedIncident.ho_ten} ({selectedIncident.msv})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phòng:</span>
                <span className="font-semibold text-slate-800">{selectedIncident.phong || 'Chưa xếp'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Phân loại AI:</span>
                <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  {selectedIncident.phan_loai || selectedIncident.loai_phan_anh}
                </span>
              </div>
              {selectedIncident.muc_do_uu_tien === 'Khẩn cấp' && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Mức độ ưu tiên:</span>
                  <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    Khẩn cấp
                  </span>
                </div>
              )}
              <div className="pt-1 border-t border-slate-200">
                <span className="font-semibold text-slate-700 block mb-0.5">Tiêu đề:</span>
                <span className="text-slate-800 font-bold">{selectedIncident.tieu_de}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-700 block mb-0.5">Mô tả sự cố:</span>
                <span className="text-slate-600 leading-relaxed">{selectedIncident.mo_ta}</span>
              </div>
            </div>

            {/* Form chọn trạng thái & ghi chú */}
            <form onSubmit={handleSaveStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Cập nhật trạng thái
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewStatus('DANG_XU_LY')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      newStatus === 'DANG_XU_LY'
                        ? 'bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-100'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Đang xử lý
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStatus('DA_XU_LY')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      newStatus === 'DA_XU_LY'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-100'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Đã giải quyết
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStatus('TU_CHOI')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      newStatus === 'TU_CHOI'
                        ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-100'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Từ chối
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Ghi chú kết quả xử lý (Gửi đến sinh viên)
                </label>
                <textarea
                  rows={3}
                  value={processNote}
                  onChange={(e) => setProcessNote(e.target.value)}
                  placeholder="VD: Cán bộ kỹ thuật đã thay bóng đèn hành lang và kiểm tra đường dây."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedIncident(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-70"
                >
                  {isProcessing ? 'Đang lưu...' : 'Lưu cập nhật'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal xem ảnh phóng to */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl max-h-[85vh] bg-white rounded-2xl overflow-hidden p-2"
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 bg-slate-900/60 hover:bg-slate-900 text-white p-1.5 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage}
              alt="Ảnh chi tiết"
              className="max-h-[80vh] w-auto mx-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
