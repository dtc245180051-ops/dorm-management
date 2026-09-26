import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  Building2,
  Bed,
  DoorOpen,
} from 'lucide-react';
import AdminLayout from '../../layouts/Admin';
import occupancyService from '../../services/occupancyService';

export default function ProcessRegistrationPage({
  requestId = 'DK-001',
  onBack,
  onProcessed,
}) {
  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestData, setRequestData] = useState(null);

  // Dữ liệu Tòa - Phòng - Giường trống phục vụ 3 dropdown
  const [buildingTree, setBuildingTree] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState('A');
  const [selectedRoom, setSelectedRoom] = useState('A203');
  const [selectedBed, setSelectedBed] = useState('G04');

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
    }, 3500);
  };

  // 1. Tải dữ liệu chi tiết yêu cầu & cây phòng trống khi mở trang
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Lấy chi tiết đơn
        const detail = await occupancyService.getRequestDetail(requestId);
        setRequestData(detail);

        // Lấy cây tòa -> phòng -> giường trống
        const bedsData = await occupancyService.getAvailableBeds();
        const tree = bedsData || [];
        setBuildingTree(tree);

        // Khớp Tòa, Phòng, Giường với cây dữ liệu thực tế
        if (tree.length > 0) {
          // 1. Tìm tòa khớp với gợi ý hoặc lấy tòa đầu tiên
          const targetBuilding =
            tree.find((b) => b.ma_toa === detail?.goi_y?.ma_toa) ||
            tree.find((b) => detail?.goi_y?.ma_toa && (b.ma_toa.startsWith(detail.goi_y.ma_toa) || detail.goi_y.ma_toa.startsWith(b.ma_toa))) ||
            tree[0];

          setSelectedBuilding(targetBuilding.ma_toa);

          const rooms = targetBuilding.rooms || [];
          if (rooms.length > 0) {
            // 2. Tìm phòng khớp với gợi ý hoặc lấy phòng đầu tiên
            const targetRoom =
              rooms.find((r) => r.ma_phong === detail?.goi_y?.ma_phong) ||
              rooms[0];

            setSelectedRoom(targetRoom.ma_phong);

            const beds = targetRoom.beds || [];
            if (beds.length > 0) {
              // 3. Tìm giường khớp với gợi ý hoặc lấy giường đầu tiên
              const targetBed =
                beds.find((b) => b.ma_giuong === detail?.goi_y?.ma_giuong) ||
                beds[0];

              setSelectedBed(targetBed.ma_giuong);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching request detail:', err);
        showToast('Không thể tải thông tin đơn yêu cầu.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [requestId]);

  // Tự động kiểm tra và đồng bộ Phòng, Giường khi Tòa hoặc Phòng thay đổi
  useEffect(() => {
    if (!buildingTree || buildingTree.length === 0) return;

    // 1. Kiểm tra Tòa
    let currentBld = buildingTree.find((b) => b.ma_toa === selectedBuilding);
    if (!currentBld) {
      currentBld = buildingTree[0];
      setSelectedBuilding(currentBld.ma_toa);
    }

    const rooms = currentBld?.rooms || [];
    if (rooms.length === 0) {
      if (selectedRoom !== '') setSelectedRoom('');
      if (selectedBed !== '') setSelectedBed('');
      return;
    }

    // 2. Kiểm tra Phòng
    let currentRoom = rooms.find((r) => r.ma_phong === selectedRoom);
    if (!currentRoom) {
      currentRoom = rooms[0];
      setSelectedRoom(currentRoom.ma_phong);
    }

    const beds = currentRoom?.beds || [];
    if (beds.length === 0) {
      if (selectedBed !== '') setSelectedBed('');
      return;
    }

    // 3. Kiểm tra Giường
    const currentBed = beds.find((b) => b.ma_giuong === selectedBed);
    if (!currentBed) {
      setSelectedBed(beds[0].ma_giuong);
    }
  }, [buildingTree, selectedBuilding, selectedRoom, selectedBed]);

  // Danh sách phòng tương ứng với Tòa đang chọn
  const currentBuildingObj = buildingTree.find((b) => b.ma_toa === selectedBuilding);
  const availableRooms = currentBuildingObj?.rooms || [];

  // Danh sách giường tương ứng với Phòng đang chọn
  const currentRoomObj = availableRooms.find((r) => r.ma_phong === selectedRoom);
  const availableBeds = currentRoomObj?.beds || [];

  // Khi đổi Tòa -> tự động chọn phòng đầu tiên
  const handleBuildingChange = (e) => {
    const newBld = e.target.value;
    setSelectedBuilding(newBld);
    const bldObj = buildingTree.find((b) => b.ma_toa === newBld);
    if (bldObj && bldObj.rooms && bldObj.rooms.length > 0) {
      const firstRoom = bldObj.rooms[0];
      setSelectedRoom(firstRoom.ma_phong);
      if (firstRoom.beds && firstRoom.beds.length > 0) {
        setSelectedBed(firstRoom.beds[0].ma_giuong);
      } else {
        setSelectedBed('');
      }
    } else {
      setSelectedRoom('');
      setSelectedBed('');
    }
  };

  // Khi đổi Phòng -> tự động chọn giường đầu tiên
  const handleRoomChange = (e) => {
    const newRoom = e.target.value;
    setSelectedRoom(newRoom);
    const roomObj = availableRooms.find((r) => r.ma_phong === newRoom);
    if (roomObj && roomObj.beds && roomObj.beds.length > 0) {
      setSelectedBed(roomObj.beds[0].ma_giuong);
    } else {
      setSelectedBed('');
    }
  };

  // Xử lý Phê duyệt & xếp phòng
  const handleApprove = async () => {
    if (!selectedBuilding || !selectedRoom || !selectedBed) {
      showToast('Vui lòng chọn đầy đủ Tòa, Phòng và Giường trước khi duyệt.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ma_toa: selectedBuilding,
        phong_id: selectedRoom,
        giuong_id: selectedBed,
        msv: requestData?.msv,
        ho_ten: requestData?.ho_ten,
        gioi_tinh: requestData?.gioi_tinh,
        ngay_sinh: requestData?.ngay_sinh,
        cccd: requestData?.cccd,
        so_dien_thoai: requestData?.so_dien_thoai,
        email: requestData?.email,
        khoa: requestData?.khoa,
        lop: requestData?.lop,
        dia_chi: requestData?.dia_chi,
        doi_tuong_uu_tien: requestData?.doi_tuong_uu_tien,
        nguoi_giam_ho: requestData?.nguoi_giam_ho,
        moi_quan_he: requestData?.moi_quan_he,
        sdt_nguoi_giam_ho: requestData?.sdt_nguoi_giam_ho,
      };

      const result = await occupancyService.approveRequest(requestId, payload);
      const contractCode = result?.data?.ma_hop_dong || `HD26-${selectedBuilding}${selectedRoom}-G${selectedBed}`;

      showToast(`Duyệt thành công! Đã tạo hợp đồng ${contractCode}`, 'success');

      setTimeout(() => {
        if (onProcessed) {
          onProcessed('approved', result);
        } else if (onBack) {
          onBack();
        }
      }, 1500);
    } catch (err) {
      console.error('Error approving request:', err);
      showToast('Phê duyệt yêu cầu thất bại. Vui lòng thử lại!', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Xử lý Từ chối đơn
  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      setRejectError('Vui lòng nhập lý do từ chối đơn đăng ký.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { ly_do_tu_choi: rejectReason.trim() };
      await occupancyService.rejectRequest(requestId, payload);

      setIsRejectModalOpen(false);
      showToast('Đã từ chối đơn yêu cầu thành công.', 'success');

      setTimeout(() => {
        if (onProcessed) {
          onProcessed('rejected');
        } else if (onBack) {
          onBack();
        }
      }, 1500);
    } catch (err) {
      console.error('Error rejecting request:', err);
      setRejectError('Không thể từ chối đơn. Vui lòng thử lại!');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout
      activeTab="dashboard"
      userName="QL_Minh"
    >
      {/* Toast thông báo */}
      {toast.show && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all animate-in fade-in slide-in-from-top-4 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-500/20'
              : 'bg-rose-600 text-white shadow-rose-500/20'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Thẻ Card chính màu trắng bao trọn nội dung theo chuẩn Figma */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 lg:p-8 flex-1 flex flex-col justify-between">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[450px]">
            <Loader2 className="w-9 h-9 text-blue-600 animate-spin mb-3" />
            <span className="text-sm font-semibold text-slate-500">
              Đang tải dữ liệu yêu cầu đăng ký...
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Header: Nút back < và Tiêu đề */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBack}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title="Quay lại danh sách"
              >
                <ChevronLeft className="w-7 h-7 stroke-[2.5]" />
              </button>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Yêu cầu đăng ký ở
              </h1>
            </div>

            {/* 1. THÔNG TIN SINH VIÊN (2 CỘT CHỈ ĐỌC - READ ONLY) */}
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-3">
                Thông tin sinh viên
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                {/* Cột 1 */}
                <div className="space-y-3">
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={requestData?.msv || 'B21DCCN001'}
                      placeholder="Mã sinh viên"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={requestData?.ho_ten || 'Nguyễn Văn A'}
                      placeholder="Họ và tên"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={requestData?.gioi_tinh || 'Nam'}
                      placeholder="Giới tính"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={requestData?.ngay_sinh || '2003-05-15'}
                      placeholder="Ngày sinh"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={requestData?.cccd || '001203004567'}
                      placeholder="Số CCCD/Định danh"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                  </div>
                </div>

                {/* Cột 2 */}
                <div className="space-y-3">
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={requestData?.so_dien_thoai || '0987654321'}
                      placeholder="Số điện thoại"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                  </div>
                  {/* Ô Email với hậu tố @ictu.edu.vn */}
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      readOnly
                      value={
                        requestData?.email
                          ? requestData.email.replace('@ictu.edu.vn', '')
                          : 'nguyenvana'
                      }
                      placeholder="Email"
                      className="w-full pl-4 pr-28 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                    <span className="absolute right-4 text-xs font-semibold text-slate-400 pointer-events-none select-none">
                      @ictu.edu.vn
                    </span>
                  </div>
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={requestData?.khoa || 'Công nghệ thông tin'}
                      placeholder="Khoa / Viện"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={requestData?.lop || 'D21CQCN01-B'}
                      placeholder="Lớp chuyên ngành"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={requestData?.dia_chi || 'Số 123 Đường Cầu Giấy, Hà Nội'}
                      placeholder="Địa chỉ"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. THÔNG TIN LIÊN HỆ KHẨN CẤP */}
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-3">
                Thông tin liên hệ khẩn cấp
              </h2>
              <div className="space-y-3">
                <div>
                  <input
                    type="text"
                    readOnly
                    value={requestData?.nguoi_giam_ho || 'Nguyễn Văn B'}
                    placeholder="Họ và tên người giám hộ"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    readOnly
                    value={requestData?.moi_quan_he || 'Bố'}
                    placeholder="Mối quan hệ"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    readOnly
                    value={requestData?.sdt_nguoi_giam_ho || '0912345678'}
                    placeholder="Số điện thoại liên hệ"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* 3. NGUYỆN VỌNG */}
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-3">
                Nguyện vọng
              </h2>
              <div className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 shadow-2xs">
                {requestData?.loai_phong || requestData?.tang_mong_muon || requestData?.muc_gia_mong_muon ? (
                  <div className="flex flex-wrap items-center gap-2.5">
                    {requestData?.loai_phong && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold border border-blue-200 text-xs">
                        <span className="text-slate-500 font-normal">Loại phòng:</span> {requestData.loai_phong}
                      </span>
                    )}
                    {requestData?.tang_mong_muon && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200 text-xs">
                        <span className="text-slate-500 font-normal">Tầng mong muốn:</span> {requestData.tang_mong_muon}
                      </span>
                    )}
                    {requestData?.muc_gia_mong_muon && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 text-xs">
                        <span className="text-slate-500 font-normal">Ngân sách:</span> {requestData.muc_gia_mong_muon}
                      </span>
                    )}
                  </div>
                ) : (
                  <div>{requestData?.nguyen_vong || requestData?.nguyen_vong_label || '“Xin hãy xếp cho em 1 phòng nào đó ở tòa A với ạ 🥹”'}</div>
                )}
              </div>
            </div>

            {/* 4. GỢI Ý XẾP CHỖ CỦA HỆ THỐNG (3 DROPDOWN LIÊN HOÀN) */}
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-3">
                Gợi ý xếp chỗ của hệ thống
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Dropdown 1: Tòa */}
                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition">
                  <span className="text-xs font-bold text-slate-700">Tòa</span>
                  <div className="relative flex items-center">
                    <select
                      value={selectedBuilding}
                      onChange={handleBuildingChange}
                      className="appearance-none bg-transparent pr-7 pl-2 py-1 text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer"
                    >
                      {buildingTree.map((b) => (
                        <option key={b.ma_toa} value={b.ma_toa}>
                          {b.ten_toa || `Tòa ${b.ma_toa}`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-1 pointer-events-none" />
                  </div>
                </div>

                {/* Dropdown 2: Phòng */}
                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition">
                  <span className="text-xs font-bold text-slate-700">Phòng</span>
                  <div className="relative flex items-center">
                    <select
                      value={selectedRoom}
                      onChange={handleRoomChange}
                      disabled={availableRooms.length === 0}
                      className="appearance-none bg-transparent pr-7 pl-2 py-1 text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer disabled:text-slate-400"
                    >
                      {availableRooms.map((r) => (
                        <option key={r.ma_phong} value={r.ma_phong}>
                          {r.label || `Phòng ${r.so_phong}`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-1 pointer-events-none" />
                  </div>
                </div>

                {/* Dropdown 3: Giường */}
                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition">
                  <span className="text-xs font-bold text-slate-700">Giường</span>
                  <div className="relative flex items-center">
                    <select
                      value={selectedBed}
                      onChange={(e) => setSelectedBed(e.target.value)}
                      disabled={availableBeds.length === 0}
                      className="appearance-none bg-transparent pr-7 pl-2 py-1 text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer disabled:text-slate-400"
                    >
                      {availableBeds.map((bed) => (
                        <option key={bed.ma_giuong} value={bed.ma_giuong}>
                          {bed.label || `Giường ${bed.ma_giuong}`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-1 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* BỘ 2 NÚT HÀNH ĐỘNG DƯỚI CÙNG THEO CHUẨN FIGMA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 mt-2">
              {/* Nút 1: Từ chối đơn (Nút đỏ nhạt) */}
              <button
                type="button"
                onClick={() => {
                  setRejectReason('');
                  setRejectError('');
                  setIsRejectModalOpen(true);
                }}
                disabled={submitting}
                className="w-full py-3.5 px-6 rounded-xl bg-[#f8c8c8] hover:bg-[#f5b3b3] text-[#d32f2f] font-bold text-sm sm:text-base transition-colors duration-150 cursor-pointer text-center shadow-2xs disabled:opacity-50"
              >
                Từ chối đơn
              </button>

              {/* Nút 2: Phê duyệt & xếp phòng (Nút xanh nhạt / nổi bật) */}
              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting || !selectedBed}
                className="w-full py-3.5 px-6 rounded-xl bg-[#cde4fd] hover:bg-[#b9d9fc] text-[#1976d2] font-bold text-sm sm:text-base transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-[#1976d2]" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <span>Phê duyệt & xếp phòng</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* POPUP REJECT MODAL (NHẬP LÝ DO TỪ CHỐI ĐƠN) */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                Từ chối đơn đăng ký
              </h3>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Vui lòng nhập lý do từ chối đơn đăng ký của sinh viên{' '}
              <strong className="text-slate-800">{requestData?.ho_ten || 'sinh viên'}</strong>:
            </p>

            <div>
              <textarea
                rows={4}
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  setRejectError('');
                }}
                placeholder="Ví dụ: Phòng tòa A hiện đã hết giường trống hoặc không đáp ứng tiêu chuẩn ưu tiên..."
                className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500 focus:bg-white transition resize-none"
              />
              {rejectError && (
                <p className="text-xs text-rose-600 font-medium mt-1">
                  {rejectError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-sm font-semibold transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <span>Xác nhận từ chối</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
