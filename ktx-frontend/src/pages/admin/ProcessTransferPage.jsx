import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  Bot,
  Wand2,
} from 'lucide-react';
import AdminLayout from '../../layouts/Admin';
import occupancyService from '../../services/occupancyService';
import { matchRoomWithGemini } from '../../services/geminiService';
import ProcessCheckoutPage from './ProcessCheckoutPage';

export default function ProcessTransferPage({
  requestId = 'YC-0231',
  onBack,
  onProcessed,
}) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestData, setRequestData] = useState(null);

  // Dữ liệu Tòa - Phòng - Giường cho 3 dropdown
  const [buildingTree, setBuildingTree] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState('A');
  const [selectedRoom, setSelectedRoom] = useState('A203');
  const [selectedBed, setSelectedBed] = useState('G04');

  // Trạng thái AI gợi ý xếp phòng
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [isAiMatching, setIsAiMatching] = useState(false);

  // Modal từ chối
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  // Toast thông báo
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  // Hàm chạy AI gợi ý xếp phòng thông minh
  const runAiSuggestion = useCallback(async (detail, tree) => {
    if (!detail || !tree || tree.length === 0) return;

    setIsAiMatching(true);
    try {
      const rawTarget =
        detail?.phong_dich ||
        detail?.phong_mong_muon ||
        (detail?.phong_lien_quan && detail.phong_lien_quan.includes('→')
          ? detail.phong_lien_quan.split('→')[1]
          : '') ||
        '';

      const candidateRooms = tree.flatMap((building) =>
        (building.rooms || [])
          .filter((room) => (room.beds || []).length > 0)
          .map((room) => {
            const beds = room.beds || [];
            const roomGender = String(room.gioi_tinh || building.gioi_tinh || '');
            return {
              ...room,
              ten_phong: `Phòng ${room.so_phong || room.ma_phong}`,
              toa: building.ten_toa || `Tòa ${building.ma_toa}`,
              gioi_tinh: roomGender,
              loai_phong: room.loai_phong || 'Phòng tiêu chuẩn',
              so_tang: room.so_tang || 1,
              danh_sach_giuong: beds.map((bed) => ({
                ...bed,
                da_co_nguoi: false,
              })),
            };
          })
      );

      const studentPayload = {
        ...detail,
        gioi_tinh: detail?.gioi_tinh || 'Nữ',
        phong_mong_muon: rawTarget,
        nguyen_vong: rawTarget,
        noi_dung_nguyen_vong: rawTarget,
        mo_ta: detail?.mo_ta || detail?.ly_do || '',
      };

      const result = await matchRoomWithGemini(studentPayload, candidateRooms);
      setAiRecommendation(result);

      // Tự động chọn Tòa, Phòng, Giường theo kết quả AI
      if (result?.suggestion || result?.best_room_id) {
        const recToa = String(result?.toa || result?.suggestion?.ma_toa || '').trim().toLowerCase();
        const recRoom = String(result?.best_room_id || result?.suggestion?.ma_phong || '').trim().toLowerCase();
        const recBed = String(result?.giuong || result?.suggestion?.ma_giuong || '').trim().toLowerCase();

        // 1. Tìm Tòa
        const matchedBld =
          tree.find((b) => {
            const bMa = String(b.ma_toa || '').toLowerCase();
            const bTen = String(b.ten_toa || '').toLowerCase();
            return (
              recToa === bMa ||
              recToa === bTen ||
              recToa.includes(bMa) ||
              bTen.includes(recToa) ||
              (recToa.includes('a1') && (bMa.includes('a1') || bTen.includes('a1'))) ||
              (recToa.includes('b') && (bMa.includes('b') || bTen.includes('b')))
            );
          }) || tree[0];

        if (matchedBld) {
          setSelectedBuilding(matchedBld.ma_toa);
          const bldRooms = matchedBld.rooms || [];

          // 2. Tìm Phòng
          const roomToken = recRoom.replace(/^phòng\s*/i, '').replace(/^p/i, '').trim();
          const matchedRm =
            bldRooms.find((r) => {
              const rMa = String(r.ma_phong || '').toLowerCase();
              const rSo = String(r.so_phong || '').toLowerCase();
              return (
                rMa === recRoom ||
                rSo === roomToken ||
                rMa.includes(roomToken) ||
                recRoom.includes(rSo)
              );
            }) || bldRooms[0];

          if (matchedRm) {
            setSelectedRoom(matchedRm.ma_phong);
            const rmBeds = matchedRm.beds || [];

            // 3. Tìm Giường
            const bedToken = recBed.split('_').pop().replace(/^giường\s*/i, '').trim();
            const matchedB =
              rmBeds.find((b) => {
                const bMa = String(b.ma_giuong || '').toLowerCase();
                return bMa === recBed || bMa.includes(bedToken);
              }) || rmBeds[0];

            if (matchedB) {
              setSelectedBed(matchedB.ma_giuong);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Lỗi chạy AI xếp phòng chuyển đổi:', err);
    } finally {
      setIsAiMatching(false);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [detail, bedsData] = await Promise.all([
          occupancyService.getRequestDetail(requestId),
          occupancyService.getAvailableBeds(),
        ]);

        // Luôn đồng bộ phòng hiện tại từ API thực tế nếu có
        try {
          const msv = detail?.msv || detail?.ma_sinh_vien;
          if (msv) {
            const currentRoomRes = await occupancyService.getCurrentRoomInfo(msv);
            if (currentRoomRes?.data) {
              const p = currentRoomRes.data.phong || `Phòng P${currentRoomRes.data.so_phong}`;
              const t = currentRoomRes.data.toa || '';
              const g = currentRoomRes.data.giuong || currentRoomRes.data.so_giuong || '';
              detail.vi_tri_hien_tai = `${p} - ${t} - Giường ${g}`;
              detail.phong_hien_tai = `${p} (${t})`;
            }
          }
        } catch (syncErr) {
          console.warn('Không thể đồng bộ phòng hiện tại realtime:', syncErr);
        }

        setRequestData(detail);

        const tree = Array.isArray(bedsData) && bedsData.length > 0 ? bedsData : [];
        setBuildingTree(tree);

        // Khởi động AI gợi ý xếp phòng ngay khi tải dữ liệu
        if (tree.length > 0) {
          await runAiSuggestion(detail, tree);
        }
      } catch (err) {
        console.error('Error fetching transfer request detail:', err);
        showToast('Không thể tải chi tiết đơn chuyển phòng.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [requestId, runAiSuggestion]);

  // Cập nhật khi chọn Tòa khác
  const handleBuildingChange = (toaCode) => {
    setSelectedBuilding(toaCode);
    const bld = buildingTree.find((b) => b.ma_toa === toaCode);
    if (bld && bld.rooms && bld.rooms.length > 0) {
      setSelectedRoom(bld.rooms[0].ma_phong);
      if (bld.rooms[0].beds && bld.rooms[0].beds.length > 0) {
        setSelectedBed(bld.rooms[0].beds[0].ma_giuong);
      } else {
        setSelectedBed('');
      }
    } else {
      setSelectedRoom('');
      setSelectedBed('');
    }
  };

  // Cập nhật khi chọn Phòng khác
  const handleRoomChange = (roomCode) => {
    setSelectedRoom(roomCode);
    const bld = buildingTree.find((b) => b.ma_toa === selectedBuilding);
    const rm = bld?.rooms?.find((r) => r.ma_phong === roomCode);
    if (rm && rm.beds && rm.beds.length > 0) {
      setSelectedBed(rm.beds[0].ma_giuong);
    } else {
      setSelectedBed('');
    }
  };

  // Danh sách phòng thuộc Tòa đang chọn
  const currentBuildingObj = buildingTree.find((b) => b.ma_toa === selectedBuilding);
  const availableRooms = currentBuildingObj?.rooms || [];

  // Danh sách giường thuộc Phòng đang chọn
  const currentRoomObj = availableRooms.find((r) => r.ma_phong === selectedRoom);
  const availableBeds = currentRoomObj?.beds || [];

  // Xử lý Phê duyệt & xếp phòng
  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const payload = {
        ma_toa: selectedBuilding,
        phong_id: selectedRoom,
        giuong_id: selectedBed,
        msv: requestData?.msv || requestData?.ma_sinh_vien || "",
      };

      const result = await occupancyService.approveTransferRequest(requestId, payload);
      showToast(result.message || 'Phê duyệt chuyển phòng thành công!', 'success');

      setTimeout(() => {
        if (onProcessed) {
          onProcessed('approved', result);
        } else if (onBack) {
          onBack();
        }
      }, 1500);
    } catch (err) {
      console.error('Error approving transfer request:', err);
      showToast('Có lỗi xảy ra khi phê duyệt. Vui lòng thử lại!', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Xử lý Từ chối yêu cầu
  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      setRejectError('Vui lòng nhập lý do từ chối yêu cầu chuyển phòng.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ly_do_tu_choi: rejectReason.trim(),
        msv: requestData?.msv || requestData?.ma_sinh_vien || "DTC245180037",
      };
      await occupancyService.rejectTransferRequest(requestId, payload);

      setIsRejectModalOpen(false);
      showToast('Đã từ chối yêu cầu chuyển phòng thành công.', 'success');

      setTimeout(() => {
        if (onProcessed) {
          onProcessed('rejected');
        } else if (onBack) {
          onBack();
        }
      }, 1500);
    } catch (err) {
      console.error('Error rejecting transfer request:', err);
      setRejectError('Không thể từ chối yêu cầu. Vui lòng thử lại!');
    } finally {
      setSubmitting(false);
    }
  };

  const reqType = String(
    requestData?.loai_don || requestData?.loai_yeu_cau || "",
  ).toLowerCase();
  if (
    requestData &&
    (reqType.includes("trả") ||
      reqType.includes("tra") ||
      reqType.includes("checkout"))
  ) {
    return (
      <ProcessCheckoutPage
        requestId={requestId}
        onBack={onBack}
        onProcessed={onProcessed}
      />
    );
  }

  return (
    <AdminLayout activeTab="dashboard" userName="QL_Minh">
      {/* Toast thông báo */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border bg-white text-slate-800 animate-in fade-in slide-in-from-top-4 duration-200">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Khung Card chính màu trắng bo góc */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs flex-1 flex flex-col justify-between">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-sm">Đang tải thông tin yêu cầu chuyển phòng...</span>
          </div>
        ) : (
          <div>
            {/* Header: Nút quay lại + Tiêu đề */}
            <div className="flex items-center gap-3 pb-6 border-b border-slate-100 mb-6">
              <button
                type="button"
                onClick={onBack}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-700 transition cursor-pointer"
                title="Quay lại danh sách"
              >
                <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Yêu cầu chuyển phòng
              </h1>
            </div>

            {/* 1. THÔNG TIN SINH VIÊN */}
            <div className="mb-6">
              <h3 className="text-base font-bold text-slate-900 mb-3 select-none">
                Thông tin sinh viên
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                {/* Cột trái */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                    <span className="text-slate-600 font-medium">Mã sinh viên</span>
                    <span className="font-semibold text-slate-900">
                      {requestData?.msv || ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                    <span className="text-slate-600 font-medium">Họ và tên</span>
                    <span className="font-bold text-slate-900">
                      {requestData?.ho_ten || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                    <span className="text-slate-600 font-medium">Giới tính</span>
                    <span className="text-slate-900 font-medium">
                      {requestData?.gioi_tinh || '—'}
                    </span>
                  </div>
                </div>

                {/* Cột phải */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                    <span className="text-slate-600 font-medium">Vị trí hiện tại</span>
                    <span className="font-semibold text-slate-900">
                      {requestData?.vi_tri_hien_tai || (requestData?.phong_hien_tai ? `Phòng ${requestData.phong_hien_tai}` : 'Chưa xếp phòng')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                    <span className="text-slate-600 font-medium">Nguyện vọng chuyển tới</span>
                    <span className="font-bold text-blue-600">
                      {requestData?.phong_dich ? `Phòng ${requestData.phong_dich.replace(/^P/i, '')}` : (requestData?.phong_lien_quan || '—')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                    <span className="text-slate-600 font-medium">Công nợ</span>
                    {requestData?.cong_no &&
                    (requestData.cong_no.toLowerCase().includes('nợ') ||
                      requestData.cong_no.toLowerCase().includes('chưa') ||
                      requestData.cong_no.toLowerCase().includes('thiếu')) &&
                    !requestData.cong_no.toLowerCase().includes('không có') ? (
                      <span className="font-bold text-rose-600">
                        {requestData.cong_no}
                      </span>
                    ) : (
                      <span className="font-bold text-emerald-600">
                        {requestData?.cong_no || 'Chưa thanh toán (Chưa phát hành hóa đơn)'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. LÝ DO XIN CHUYỂN */}
            <div className="mb-6">
              <h3 className="text-base font-bold text-slate-900 mb-3 select-none">
                Lý do xin chuyển
              </h3>
              <div className="border border-slate-200 rounded-lg p-4 text-sm text-slate-800 bg-white shadow-2xs leading-relaxed">
                "{requestData?.mo_ta || requestData?.ly_do || 'Không có mô tả chi tiết'}"
              </div>
            </div>

            {/* 3. CHUYỂN TỚI */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-bold text-slate-900 select-none">
                    Chuyển tới
                  </h3>
                  {aiRecommendation && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100/80 text-blue-700 border border-blue-200">
                      <Sparkles className="w-3 h-3 text-blue-600" />
                      AI Đề xuất {aiRecommendation.match_score ? `(${aiRecommendation.match_score}% phù hợp)` : ''}
                    </span>
                  )}
                </div>

                {/* Nút AI gợi ý xếp phòng */}
                <button
                  type="button"
                  onClick={() => runAiSuggestion(requestData, buildingTree)}
                  disabled={isAiMatching || buildingTree.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-xs hover:shadow transition disabled:opacity-50 cursor-pointer"
                  title="Nhờ AI tự động phân tích nguyện vọng và xếp phòng tối ưu"
                >
                  {isAiMatching ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang phân tích...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                      <span>AI gợi ý xếp phòng</span>
                    </>
                  )}
                </button>
              </div>

              {/* Banner hiển thị lý do & gợi ý của AI */}
              {aiRecommendation?.ai_reason && (
                <div className="mb-4 p-3.5 rounded-xl bg-linear-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/90 border border-blue-200/90 shadow-2xs animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-2xs shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4 text-yellow-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                          AI Gợi ý xếp phòng thông minh
                        </span>
                        {aiRecommendation?.match_score && (
                          <span className="text-[11px] font-semibold text-blue-700 bg-white/90 px-2 py-0.5 rounded-md border border-blue-200 shadow-2xs">
                            Độ phù hợp: {aiRecommendation.match_score}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-blue-900 mt-1 leading-relaxed">
                        {aiRecommendation.ai_reason}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Dropdown Tòa */}
                <div className="relative flex items-center bg-white border border-slate-200 rounded-lg px-4 py-2.5 shadow-2xs">
                  <span className="text-sm font-medium text-slate-700 w-16 shrink-0">
                    Tòa
                  </span>
                  <select
                    value={selectedBuilding}
                    onChange={(e) => handleBuildingChange(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-slate-900 font-medium focus:outline-none cursor-pointer pr-6 appearance-none"
                  >
                    {buildingTree.map((b) => (
                      <option key={b.ma_toa} value={b.ma_toa}>
                        {b.ten_toa}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                </div>

                {/* Dropdown Phòng */}
                <div className="relative flex items-center bg-white border border-slate-200 rounded-lg px-4 py-2.5 shadow-2xs">
                  <span className="text-sm font-medium text-slate-700 w-16 shrink-0">
                    Phòng
                  </span>
                  <select
                    value={selectedRoom}
                    onChange={(e) => handleRoomChange(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-slate-900 font-medium focus:outline-none cursor-pointer pr-6 appearance-none"
                  >
                    {availableRooms.map((r) => (
                      <option key={r.ma_phong} value={r.ma_phong}>
                        {r.label || `Phòng ${r.so_phong || r.ma_phong}`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                </div>

                {/* Dropdown Giường */}
                <div className="relative flex items-center bg-white border border-slate-200 rounded-lg px-4 py-2.5 shadow-2xs">
                  <span className="text-sm font-medium text-slate-700 w-16 shrink-0">
                    Giường
                  </span>
                  <select
                    value={selectedBed}
                    onChange={(e) => setSelectedBed(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-slate-900 font-medium focus:outline-none cursor-pointer pr-6 appearance-none"
                  >
                    {availableBeds.map((bed) => (
                      <option key={bed.ma_giuong} value={bed.ma_giuong}>
                        {bed.label || `Giường ${bed.ma_giuong}`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* 4. HAI NÚT HÀNH ĐỘNG DƯỚI CÙNG (SIDE BY SIDE) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setRejectReason('');
                  setRejectError('');
                  setIsRejectModalOpen(true);
                }}
                className="py-3 px-6 rounded-lg bg-rose-200 hover:bg-rose-300 text-rose-700 font-semibold text-center transition cursor-pointer"
              >
                Từ chối yêu cầu
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting}
                className="py-3 px-6 rounded-lg bg-[#cce2fc] hover:bg-[#b8d8fa] text-blue-600 font-bold text-center transition cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Phê duyệt & xếp phòng</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal xác nhận từ chối */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                Từ chối yêu cầu chuyển phòng
              </h3>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-3">
              Vui lòng nhập lý do từ chối yêu cầu chuyển phòng của sinh viên:
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                setRejectError('');
              }}
              placeholder="VD: Phòng đích đã đủ số lượng sinh viên, không thể xếp thêm..."
              className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 mb-2"
            ></textarea>

            {rejectError && (
              <p className="text-xs text-rose-600 font-medium mb-4">{rejectError}</p>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={submitting}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Xác nhận từ chối</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
