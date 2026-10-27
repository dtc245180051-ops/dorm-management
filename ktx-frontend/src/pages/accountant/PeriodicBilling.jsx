import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import './PeriodicBilling.css';
import { invoiceService } from '../../services/invoiceService';
import { getStudentAccount } from '../../services/studentAccountService';
import studentNotificationService from '../../services/studentNotificationService';

/**
 * Danh sách phạm vi áp dụng (theo loại phòng theo yêu cầu người dùng)
 */
const APPLIED_TARGET_OPTIONS = [
  'Tất cả phòng (Tiêu chuẩn & Dịch vụ)',
  'Chỉ phòng tiêu chuẩn',
  'Chỉ phòng dịch vụ',
];

/* ================= HELPER NGÀY THÁNG ================= */
const pad = (n) => String(n).padStart(2, '0');

// yyyy-mm-dd theo giờ local (không dùng toISOString vì lệch múi giờ)
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const getTodayStr = () => toDateStr(new Date());
const getDefaultDeadline = (days = 7) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateStr(d);
};

// Format động theo dạng "Tháng MM/YYYY" của thời điểm hiện tại
const getCurrentMonthLabel = () => {
  const d = new Date();
  return `Tháng ${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/**
 * Sinh danh sách các tháng linh hoạt gần nhất quanh thời điểm hiện tại
 * (ví dụ: 3 tháng trước đến 8 tháng tiếp theo)
 */
const generateMonthOptions = (pastMonths = 3, futureMonths = 8) => {
  const options = [];
  const now = new Date();
  for (let i = -pastMonths; i <= futureMonths; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    options.push(`Tháng ${pad(d.getMonth() + 1)}/${d.getFullYear()}`);
  }
  return options;
};

// Năm học thực tế hiện tại, ví dụ hôm nay 19/10/2026 -> "2026 - 2027"
const getCurrentSchoolYear = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return month >= 8 ? `${year} - ${year + 1}` : `${year - 1} - ${year}`;
};

export default function PeriodicBilling({ searchTerm = '' }) {
  // Tab hiện tại: 'room' | 'utility'
  const [activeTab, setActiveTab] = useState('room');

  // Danh sách các tháng gần nhất sinh động theo thời gian thực
  const monthOptions = useMemo(() => generateMonthOptions(3, 8), []);

  // Form tiền phòng theo năm: Năm học thực tế hiện tại (ví dụ: 2026 - 2027)
  const schoolYear = useMemo(() => getCurrentSchoolYear(), []);
  const billingYear = useMemo(() => `Năm học ${schoolYear}`, [schoolYear]);
  const [appliedTarget, setAppliedTarget] = useState('Tất cả phòng (Tiêu chuẩn & Dịch vụ)');
  const [deadline, setDeadline] = useState(() => getDefaultDeadline());

  // Form điện nước theo tháng: Tự động lấy tháng hiện tại theo thời gian thực (new Date)
  const [utilityMonth, setUtilityMonth] = useState(() => getCurrentMonthLabel());
  const [utilityTarget, setUtilityTarget] = useState('Tất cả các phòng đang có sinh viên');
  const [utilityDeadline, setUtilityDeadline] = useState(() => getDefaultDeadline());
  const [elecRate] = useState('3.500 VND/kWh');
  const [waterRate] = useState('20.000 VND/m³');

  // Quản lý upload file chỉ số điện nước & tính toán tự động
  const [isUploadingReadings, setIsUploadingReadings] = useState(false);

  // Helper đọc cache upload điện nước theo tháng từ sessionStorage
  const getCachedUpload = useCallback((month) => {
    try {
      const raw = sessionStorage.getItem(`ktx_utility_upload_${month}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const [uploadReadingsInfo, setUploadReadingsInfo] = useState(() => getCachedUpload(utilityMonth)?.info || null);
  const [uploadedCandidates, setUploadedCandidates] = useState(() => getCachedUpload(utilityMonth)?.candidates || null);
  const [utilityRooms, setUtilityRooms] = useState(() => getCachedUpload(utilityMonth)?.rooms || []);
  const fileInputRef = useRef(null);

  // State dữ liệu danh sách sinh viên & phòng
  const [roomStudents, setRoomStudents] = useState([]);

  // Trạng thái hóa đơn điện nước của tháng đang chọn
  const [utilityCandidatesStatus, setUtilityCandidatesStatus] = useState({ total: 0, issued: 0, rooms: [] });
  const [showIssuedUtility, setShowIssuedUtility] = useState(false);

  // Trạng thái hiển thị tất cả
  const [showAll, setShowAll] = useState(false);

  // Modal xác nhận phát hành
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Chống bấm phát hành nhiều lần
  const [isPublishing, setIsPublishing] = useState(false);
  const today = getTodayStr();

  const showToast = (msg, ms = 3500) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), ms);
  };

  // Chặn chọn hạn chốt nhỏ hơn hôm nay
  const handleDeadlineChange = (value, setter) => {
    if (!value) return;
    if (value < today) {
      showToast('Hạn chốt không được nhỏ hơn ngày hôm nay!');
      return;
    }
    setter(value);
  };

  // 1. Tải danh sách ứng viên tiền phòng từ Backend API khi thay đổi tham số (năm học, phạm vi loại phòng)
  const loadRoomCandidates = useCallback(async () => {
    let list = [];
    const data = await invoiceService.getRoomCandidates(billingYear, 11, undefined, appliedTarget);
    if (data !== null && Array.isArray(data)) {
      list = data.map((c) => {
        const isService =
          String(c.loai_phong || '').toLowerCase().includes('dịch vụ') ||
          String(c.loai_phong || '').toLowerCase().includes('dich vu');
        const roomTypeLabel = c.loai_phong || (isService ? 'Phòng dịch vụ' : 'Phòng tiêu chuẩn');
        const annualPrice = isService ? 8200000 : 4800000;
        const finalAmount = Number(c.so_tien ?? annualPrice);
        return {
          id: c.msv,
          name: c.ho_ten,
          room: c.phong,
          roomType: roomTypeLabel,
          monthlyPrice: Number(c.don_gia_thang || (isService ? 745455 : 436364)),
          rawAmount: finalAmount,
          contractTerm: c.thoi_han_hop_dong || '',
          termAmount: `${finalAmount.toLocaleString('vi-VN')} VND`,
          daLapHoaDon: c.da_lap_hoa_don,
        };
      });
    }

    // Tự động đồng bộ sinh viên vừa được duyệt phòng từ tài khoản lưu trú hợp lệ
    try {
      const acc = getStudentAccount();
      if (
        acc?.currentResidence?.isActive &&
        acc.currentResidence.contractStatus === 'ACTIVE' &&
        acc.currentResidence.roomNumber
      ) {
        const studentId = acc.studentId || localStorage.getItem('ktx_username') || '';
        const alreadyExists = list.some(
          (s) => s.id?.toLowerCase() === studentId.toLowerCase()
        );
        if (!alreadyExists && studentId) {
          const rawLoai = String(acc.currentResidence.roomType || '').toLowerCase();
          const isService = rawLoai.includes('dịch vụ') || rawLoai.includes('dich vu');
          const roomTypeLabel = isService ? 'Phòng dịch vụ' : 'Phòng tiêu chuẩn';
          const annualPrice = isService ? 8200000 : 4800000;
          list.unshift({
            id: studentId.toUpperCase(),
            name: acc.fullName || localStorage.getItem('ktx_fullname') || 'Sinh viên KTX',
            room: `P${acc.currentResidence.roomNumber}`,
            roomType: roomTypeLabel,
            monthlyPrice: isService ? 745455 : 436364,
            rawAmount: annualPrice,
            contractTerm: `${acc.currentResidence.startDate || '19/10/2026'} – ${acc.currentResidence.endDate || '19/10/2027'}`,
            termAmount: `${annualPrice.toLocaleString('vi-VN')} VND`,
            daLapHoaDon: false,
          });
        }
      }
    } catch (e) {
      console.warn('Lỗi đồng bộ sinh viên hợp lệ vào PeriodicBilling:', e);
    }

    setRoomStudents(list);
  }, [billingYear, appliedTarget]);

  // Tải trạng thái các phòng điện nước của tháng được chọn
  const loadUtilityCandidatesStatus = useCallback(async (month) => {
    try {
      const data = await invoiceService.getUtilityCandidates(month);
      if (Array.isArray(data)) {
        const issued = data.filter((r) => r.da_lap_hoa_don).length;
        setUtilityCandidatesStatus({
          total: data.length,
          issued,
          rooms: data,
        });
      }
    } catch (e) {
      console.warn('Lỗi load danh sách phòng điện nước:', e);
    }
  }, []);

  useEffect(() => {
    loadUtilityCandidatesStatus(utilityMonth);
  }, [utilityMonth, loadUtilityCandidatesStatus]);

  // 2. Khi đổi tháng điện nước, khôi phục cache nếu tháng đó đã nạp file, ngược lại reset rỗng
  useEffect(() => {
    const cached = getCachedUpload(utilityMonth);
    if (cached) {
      setUtilityRooms(cached.rooms || []);
      setUploadReadingsInfo(cached.info || null);
      setUploadedCandidates(cached.candidates || null);
    } else {
      setUtilityRooms([]);
      setUploadReadingsInfo(null);
      setUploadedCandidates(null);
    }
  }, [utilityMonth, getCachedUpload]);

  useEffect(() => {
    loadRoomCandidates();

    const handleUpdate = () => {
      loadRoomCandidates();
      loadUtilityCandidatesStatus(utilityMonth);
    };

    window.addEventListener('occupancy-updated', handleUpdate);
    window.addEventListener('student-account-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      window.removeEventListener('occupancy-updated', handleUpdate);
      window.removeEventListener('student-account-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, [loadRoomCandidates, loadUtilityCandidatesStatus, utilityMonth]);

  // 3. Lọc dữ liệu sinh viên theo loại phòng áp dụng và từ khóa tìm kiếm
  const targetRoomStudents = useMemo(() => {
    // Bỏ sinh viên đã được lập hóa đơn tiền phòng của kỳ này (mỗi SV chỉ phát hành 1 lần)
    let list = roomStudents.filter((s) => !s.daLapHoaDon);

    // Lọc theo loại phòng áp dụng ("Chỉ phòng tiêu chuẩn" / "Chỉ phòng dịch vụ")
    if (appliedTarget === 'Chỉ phòng tiêu chuẩn') {
      list = list.filter((s) => s.roomType === 'Phòng tiêu chuẩn');
    } else if (appliedTarget === 'Chỉ phòng dịch vụ') {
      list = list.filter((s) => s.roomType === 'Phòng dịch vụ');
    }

    // Lọc theo từ khóa tìm kiếm
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (s) =>
          s.id.toLowerCase().includes(term) ||
          s.name.toLowerCase().includes(term) ||
          s.room.toLowerCase().includes(term) ||
          (s.roomType && s.roomType.toLowerCase().includes(term))
      );
    }

    return list;
  }, [searchTerm, roomStudents, appliedTarget]);

  const filteredRoomStudents = useMemo(() => {
    return showAll || searchTerm.trim() ? targetRoomStudents : targetRoomStudents.slice(0, 3);
  }, [showAll, searchTerm, targetRoomStudents]);

  // Tổng giá trị đợt phát hành = Tổng tiền của tất cả sinh viên trong đợt phát hành này
  const totalBatchAmount = useMemo(() => {
    return targetRoomStudents.reduce((sum, s) => {
      const amt = Number(s.rawAmount || 0);
      return sum + amt;
    }, 0);
  }, [targetRoomStudents]);

  // Danh sách phòng điện nước hiển thị (ưu tiên file vừa nạp, nếu không có file và có yêu cầu xem phòng đã phát hành thì hiển thị)
  const utilityDisplayRooms = useMemo(() => {
    if (utilityRooms.length > 0) return utilityRooms;
    if (showIssuedUtility && utilityCandidatesStatus.rooms.length > 0) {
      return utilityCandidatesStatus.rooms
        .filter((r) => r.da_lap_hoa_don)
        .map((r) => {
          const soNguoi = Number(r.so_sinh_vien ?? r.so_nguoi) || 0;
          const displaySoPhong = r.so_phong && r.so_phong.toUpperCase().startsWith('P') ? r.so_phong : `P${r.so_phong}`;
          return {
            room: `${displaySoPhong} - ${r.toa_nha}`,
            so_phong: displaySoPhong,
            toa_nha: r.toa_nha,
            elecMeter: r.chi_so_dien_cu_moi,
            elecUsage: `${r.so_dien_kwh} kWh`,
            waterMeter: r.chi_so_nuoc_cu_moi,
            waterUsage: `${r.so_nuoc_m3} m³`,
            totalAmount: `${Number(r.tong_tien || 0).toLocaleString('vi-VN')} VND`,
            rawAmount: r.tong_tien,
            soNguoi,
            perPersonAmount: soNguoi > 0 ? Math.round(r.tong_tien / soNguoi) : r.tong_tien,
            da_lap_hoa_don: true,
          };
        });
    }
    return [];
  }, [utilityRooms, showIssuedUtility, utilityCandidatesStatus]);

  // Tổng giá trị đợt phát hành tiền điện nước = Tổng tiền toàn bộ các phòng trong đợt phát hành này
  const totalUtilityBatchAmount = useMemo(() => {
    return utilityRooms.reduce((sum, r) => sum + (Number(r.rawAmount) || 0), 0);
  }, [utilityRooms]);

  const filteredUtilityRooms = useMemo(() => {
    let list = utilityDisplayRooms;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((r) => r.room.toLowerCase().includes(term));
    }
    return showAll || searchTerm.trim() ? list : list.slice(0, 3);
  }, [searchTerm, showAll, utilityDisplayRooms]);

  // 4. Xử lý upload file chỉ số điện nước (Excel/CSV) & tự động tính toán
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingReadings(true);

    try {
      // Đơn giá điện 3.500 đ/kWh, nước 20.000 đ/m³ theo cấu hình hệ thống kế toán
      const res = await invoiceService.uploadUtilityReadings(file, utilityMonth, 3500, 20000);
      if (res.success && res.data) {
        const allItems = res.data.items || [];
        // Giữ lại tất cả các phòng trong file để đối chiếu đầy đủ 100% với file Excel
        const items = allItems;
        const alreadyIssuedCount = allItems.filter((r) => r.da_lap_hoa_don).length;

        const mappedRooms = items.map((r) => {
          // API trả số người theo tên trường `so_sinh_vien`.
          const soNguoi = Number(r.so_sinh_vien ?? r.so_nguoi) || 0;
          const displaySoPhong = r.so_phong && r.so_phong.toUpperCase().startsWith('P') ? r.so_phong : `P${r.so_phong}`;
          return {
            room: `${displaySoPhong} - ${r.toa_nha}`,
            so_phong: displaySoPhong,
            toa_nha: r.toa_nha,
            elecMeter: r.chi_so_dien_cu_moi,
            elecUsage: `${r.so_dien_kwh} kWh`,
            waterMeter: r.chi_so_nuoc_cu_moi,
            waterUsage: `${r.so_nuoc_m3} m³`,
            totalAmount: `${r.tong_tien.toLocaleString('vi-VN')} VND`,
            rawAmount: r.tong_tien,
            so_dien_cu: r.so_dien_cu,
            so_dien_moi: r.so_dien_moi,
            so_nuoc_cu: r.so_nuoc_cu,
            so_nuoc_moi: r.so_nuoc_moi,
            tien_dien: r.tien_dien,
            tien_nuoc: r.tien_nuoc,
            // Chia đều cho số người trong phòng (phòng chưa có người thì giữ nguyên tổng phòng)
            soNguoi,
            perPersonAmount: soNguoi > 0 ? Math.round(r.tong_tien / soNguoi) : r.tong_tien,
            da_lap_hoa_don: r.da_lap_hoa_don,
          };
        });
        const info = {
          fileName: res.data.fileName || file.name,
          totalRooms: items.length,
          alreadyIssuedCount,
          totalAmount: mappedRooms.reduce((sum, r) => sum + Number(r.rawAmount || 0), 0),
        };

        setUploadedCandidates(items);
        setUtilityRooms(mappedRooms);
        setUploadReadingsInfo(info);

        try {
          sessionStorage.setItem(
            `ktx_utility_upload_${utilityMonth}`,
            JSON.stringify({
              rooms: mappedRooms,
              info,
              candidates: items,
            })
          );
        } catch (e) {
          console.warn('Cannot save uploaded utility cache:', e);
        }

        if (items.length === 0 && alreadyIssuedCount > 0) {
          setToastMessage(`Tất cả ${alreadyIssuedCount} phòng trong file đã được phát hành hóa đơn điện nước ${utilityMonth}!`);
        } else {
          setToastMessage(
            `Đã đọc và tính toán điện nước cho ${items.length} phòng từ file${alreadyIssuedCount ? ` (trong đó có ${alreadyIssuedCount} phòng đã lập HĐ trước đó)` : ''}!`
          );
        }
      } else {
        setToastMessage(`Lỗi tải file: ${res.message || 'Không thể xử lý file chỉ số'}`);
      }
    } catch (err) {
      setToastMessage(`Lỗi: ${err.message}`);
    } finally {
      setIsUploadingReadings(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setToastMessage(''), 5000);
    }
  };

  // 5. Xử lý xác nhận phát hành hóa đơn (gọi API Backend)
  const handleConfirmPublish = async () => {
    setShowConfirmModal(false);
    if (isPublishing) return;

    // Kiểm tra lại hạn chốt phòng trường hợp để trang mở qua đêm
    const currentDeadline = activeTab === 'room' ? deadline : utilityDeadline;
    if (currentDeadline < getTodayStr()) {
      showToast('Hạn chốt không được nhỏ hơn ngày hôm nay!');
      return;
    }
    if (activeTab === 'room' && targetRoomStudents.length === 0) {
      showToast('Không còn sinh viên nào cần phát hành hóa đơn tiền phòng kỳ này!');
      return;
    }

    setIsPublishing(true);
    try {
      if (activeTab === 'room') {
        const payload = {
          ky_thanh_toan: billingYear,
          ap_dung: appliedTarget,
          thoi_gian_o_thang: 11,
          han_thanh_toan: deadline,
          ghi_chu: `Phát hành hóa đơn tiền phòng ${billingYear} (${appliedTarget})`,
        };

        const result = await invoiceService.publishRoomInvoices(payload);
        if (result.success) {
          setToastMessage(result.data?.message || `Đã phát hành thành công hóa đơn tiền phòng ${billingYear}!`);
          const issuedRoomList = result.data?.invoices || result.data?.danh_sach_hoa_don || [];
          if (issuedRoomList.length > 0) {
            issuedRoomList.forEach((inv) => {
              studentNotificationService.notifyFromAccountant({
                title: `Thông báo hóa đơn tiền phòng ${billingYear}`,
                content: `Phòng Kế toán đã phát hành hóa đơn tiền phòng kỳ ${billingYear} cho sinh viên ${inv.ho_ten || inv.msv} (Phòng ${inv.so_phong || ""}) với số tiền là ${Number(inv.so_tien || 0).toLocaleString("vi-VN")} VND. Hạn thanh toán đến ngày ${inv.han_thanh_toan ? String(inv.han_thanh_toan).split("-").reverse().join("/") : (deadline || "").split("-").reverse().join("/")}. Vui lòng kiểm tra và thanh toán đúng hạn.`,
                type: "billing",
                actionUrl: "/student/payment",
                actionLabel: "Thanh toán ngay",
                msv: inv.msv,
              });
            });
          } else {
            studentNotificationService.notifyFromAccountant({
              title: `Thông báo hóa đơn tiền phòng ${billingYear}`,
              content: `Hóa đơn tiền phòng kỳ ${billingYear} đã được phát hành. Hạn thanh toán đến ngày ${(deadline || "").split("-").reverse().join("/")}. Vui lòng thanh toán đúng hạn để tránh phát sinh nợ phí.`,
              type: "billing",
              actionUrl: "/student/payment",
              actionLabel: "Thanh toán ngay",
            });
          }
          window.dispatchEvent(new Event("ktx-notifications-updated"));
          window.dispatchEvent(new Event("storage"));
          loadRoomCandidates();
        } else {
          setToastMessage(`Lỗi: ${result.message}`);
        }
      } else {
        if (utilityRooms.length === 0) {
          setToastMessage('Chưa có dữ liệu chỉ số điện nước. Vui lòng upload file Excel/CSV trước khi phát hành!');
          setTimeout(() => setToastMessage(''), 4000);
          return;
        }

        const payload = {
          thang: utilityMonth,
          han_thanh_toan: utilityDeadline,
          don_gia_dien: 3500.0,
          don_gia_nuoc: 20000.0,
          ghi_chu: `Phát hành hóa đơn điện nước ${utilityMonth}`,
          chi_tiet_phong: uploadedCandidates || undefined,
        };

        const result = await invoiceService.publishUtilityInvoices(payload);
        if (result.success) {
          setToastMessage(result.data?.message || `Đã phát hành thành công hóa đơn điện nước ${utilityMonth}!`);
          const issuedUtilList = result.data?.invoices || result.data?.danh_sach_hoa_don || [];
          if (issuedUtilList.length > 0) {
            issuedUtilList.forEach((inv) => {
              studentNotificationService.notifyFromAccountant({
                title: `Thông báo hóa đơn điện nước ${utilityMonth}`,
                content: `Phòng Kế toán đã phát hành hóa đơn tiền điện nước kỳ ${utilityMonth} cho sinh viên ${inv.ho_ten || inv.msv} (Phòng ${inv.so_phong || ""}) với số tiền cá nhân cần nộp là ${Number(inv.so_tien || 0).toLocaleString("vi-VN")} VND. Hạn thanh toán đến ngày ${inv.han_thanh_toan ? String(inv.han_thanh_toan).split("-").reverse().join("/") : (utilityDeadline || "").split("-").reverse().join("/")}. Vui lòng hoàn tất thanh toán đúng hạn.`,
                type: "billing",
                actionUrl: "/student/payment",
                actionLabel: "Thanh toán ngay",
                msv: inv.msv,
              });
            });
          } else {
            studentNotificationService.notifyFromAccountant({
              title: `Thông báo hóa đơn điện nước ${utilityMonth}`,
              content: `Hóa đơn tiền điện nước ${utilityMonth} đã được phát hành. Hạn thanh toán đến ngày ${(utilityDeadline || "").split("-").reverse().join("/")}. Vui lòng kiểm tra và thanh toán.`,
              type: "billing",
              actionUrl: "/student/payment",
              actionLabel: "Xem hóa đơn",
            });
          }
          window.dispatchEvent(new Event("ktx-notifications-updated"));
          window.dispatchEvent(new Event("storage"));
          // Cập nhật trạng thái sau khi phát hành thành công
          setUtilityRooms((prev) => prev.map((r) => ({ ...r, da_lap_hoa_don: true })));
          loadUtilityCandidatesStatus(utilityMonth);
          try {
            sessionStorage.removeItem(`ktx_utility_upload_${utilityMonth}`);
          } catch { }
        } else {
          setToastMessage(`Lỗi: ${result.message}`);
        }
      }
    } finally {
      setIsPublishing(false);
    }

    setTimeout(() => {
      setToastMessage('');
    }, 5500);
  };

  // Xử lý khi nhấn nút Áp dụng trong tab Hóa đơn tiền điện nước theo tháng
  const handleApplyUtility = () => {
    if (utilityRooms.length === 0) {
      setToastMessage(`Đã cập nhật cấu hình cho ${utilityMonth}. Vui lòng upload file chỉ số điện nước để tính toán!`);
    } else {
      setToastMessage(`Đã áp dụng cấu hình cho ${utilityMonth}!`);
    }
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  // Trạng thái không còn gì để phát hành
  const noRoomToIssue = activeTab === 'room' && targetRoomStudents.length === 0;
  const noUtilityToIssue =
    activeTab === 'utility' &&
    (utilityRooms.length === 0 || utilityRooms.every((r) => r.da_lap_hoa_don));

  return (
    <div className="billing-card">
      {/* Tiêu đề trang chuẩn Figma */}
      <h1 className="billing-title">LẬP HÓA ĐƠN ĐỊNH KỲ</h1>

      {/* ================= TABS ================= */}
      <div className="billing-tabs-container">
        {/* Tab 1: HÓA ĐƠN TIỀN PHÒNG THEO NĂM */}
        <button
          type="button"
          className={`billing-tab-btn ${activeTab === 'room' ? 'active' : 'inactive'}`}
          onClick={() => setActiveTab('room')}
        >
          HÓA ĐƠN TIỀN PHÒNG THEO NĂM
        </button>

        {/* Tab 2: HÓA ĐƠN TIỀN ĐIỆN NƯỚC THEO THÁNG */}
        <button
          type="button"
          className={`billing-tab-btn ${activeTab === 'utility' ? 'active' : 'inactive'}`}
          onClick={() => setActiveTab('utility')}
        >
          HÓA ĐƠN TIỀN ĐIỆN NƯỚC THEO THÁNG
        </button>
      </div>

      {/* ================= FORM CONTROLS ================= */}
      {activeTab === 'room' ? (
        /* Cấu hình tiền phòng theo năm */
        <div className="billing-form-grid">
          {/* Cột trái */}
          <div className="billing-form-col">
            {/* 1. Năm học thực tế hiện tại (fix cứng theo yêu cầu) */}
            <div className="billing-control-box readonly-box" title={`Năm học thực tế hiện tại: ${schoolYear}`}>
              <span className="billing-static-text">
                Năm học: {schoolYear}
              </span>
              <span className="billing-box-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
            </div>

            {/* Áp dụng: Chỉ áp dụng cho phòng tiêu chuẩn và phòng dịch vụ */}
            <div className="billing-control-box">
              <select
                className="billing-select"
                value={appliedTarget}
                onChange={(e) => setAppliedTarget(e.target.value)}
              >
                {APPLIED_TARGET_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    Áp dụng : {opt}
                  </option>
                ))}
              </select>
              <span className="billing-box-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>

            {/* Hạn chốt */}
            <div className="billing-control-box">
              <input
                type="text"
                className="billing-input"
                value={`Hạn chốt: ${deadline.split('-').reverse().join('/')}`}
                readOnly
                onClick={() => {
                  const input = document.getElementById('room-deadline-picker');
                  if (input) input.showPicker ? input.showPicker() : input.focus();
                }}
              />
              <input
                id="room-deadline-picker"
                type="date"
                min={today}
                value={deadline}
                onChange={(e) => handleDeadlineChange(e.target.value, setDeadline)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
              />
              <span
                className="billing-box-icon"
                style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                onClick={() => {
                  const input = document.getElementById('room-deadline-picker');
                  if (input) input.showPicker ? input.showPicker() : input.focus();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
            </div>
          </div>

          {/* Cột phải: 2 ô thông tin giá phòng cố định (fix cứng) & Tổng giá trị đợt phát hành */}
          <div className="billing-form-col">
            {/* Ô 1: Phòng tiêu chuẩn: 4.800.000 đ/năm */}
            <div className="billing-control-box readonly-box" title="Đơn giá cố định phòng tiêu chuẩn: 4.800.000 đ/năm">
              <span className="billing-static-text">
                Phòng tiêu chuẩn: 4.800.000 đ/năm
              </span>
              <span className="billing-box-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </span>
            </div>

            {/* Ô 2: Phòng dịch vụ: 8.200.000 đ/năm */}
            <div className="billing-control-box readonly-box" title="Đơn giá cố định phòng dịch vụ: 8.200.000 đ/năm">
              <span className="billing-static-text">
                Phòng dịch vụ: 8.200.000 đ/năm
              </span>
              <span className="billing-box-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </span>
            </div>

            {/* Tổng giá trị đợt phát hành */}
            <div className="billing-total-row">
              <div className="billing-total-badge" title="Tổng giá trị toàn bộ sinh viên trong đợt phát hành này">
                Tổng giá trị đợt phát hành: {totalBatchAmount.toLocaleString('vi-VN')} VND
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Cấu hình tiền điện nước theo tháng */
        <div className="billing-form-grid">
          {/* Cột trái */}
          <div className="billing-form-col">
            <div className="billing-control-box">
              <select
                className="billing-select"
                value={utilityMonth}
                onChange={(e) => setUtilityMonth(e.target.value)}
                title="Chọn kỳ lập hóa đơn tiền điện nước"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    Chọn tháng: {m.replace('Tháng ', '')}
                  </option>
                ))}
              </select>
              <span className="billing-box-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>

            <div className="billing-control-box">
              <select
                className="billing-select"
                value={utilityTarget}
                onChange={(e) => setUtilityTarget(e.target.value)}
              >
                <option value="Tất cả các phòng đang có sinh viên">Áp dụng : Tất cả phòng có sinh viên</option>
                <option value="Khu nhà A (A1, A2)">Áp dụng : Khu nhà A (A1, A2)</option>
                <option value="Khu nhà B (B1, B2)">Áp dụng : Khu nhà B (B1, B2)</option>
              </select>
              <span className="billing-box-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>

            <div className="billing-control-box">
              <input
                type="text"
                className="billing-input"
                value={`Hạn chốt: ${utilityDeadline.split('-').reverse().join('/')}`}
                readOnly
                onClick={() => {
                  const input = document.getElementById('util-deadline-picker');
                  if (input) input.showPicker ? input.showPicker() : input.focus();
                }}
              />
              <input
                id="util-deadline-picker"
                type="date"
                min={today}
                value={utilityDeadline}
                onChange={(e) => handleDeadlineChange(e.target.value, setUtilityDeadline)}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
              />
              <span
                className="billing-box-icon"
                style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                onClick={() => {
                  const input = document.getElementById('util-deadline-picker');
                  if (input) input.showPicker ? input.showPicker() : input.focus();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
            </div>
          </div>

          {/* Cột phải */}
          <div className="billing-form-col">
            <div className="billing-control-box readonly-box">
              <span className="billing-static-text">Đơn giá điện : {elecRate}</span>
            </div>

            <div className="billing-control-box readonly-box">
              <span className="billing-static-text">Đơn giá nước : {waterRate}</span>
            </div>

            <div className="billing-total-row">
              <div className="billing-total-badge" title="Tổng giá trị toàn bộ phòng trong đợt phát hành này">
                Tổng giá trị đợt phát hành: {totalUtilityBatchAmount.toLocaleString('vi-VN')} VND
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= UPLOAD FILE CHỈ SỐ ĐIỆN NƯỚC (TAB ĐIỆN NƯỚC) ================= */}
      {activeTab === 'utility' && (
        <div className="billing-upload-bar">
          <div className="billing-upload-actions">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            {uploadReadingsInfo ? (
              <button
                type="button"
                className="billing-btn-change-file"
                disabled={isUploadingReadings}
                onClick={() => fileInputRef.current?.click()}
                title="Tải lên file chỉ số khác để thay thế dữ liệu hiện tại"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6" />
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M3 22v-6h6" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                </svg>
                {isUploadingReadings ? 'Đang đọc và tính toán chỉ số...' : 'Đổi file khác'}
              </button>
            ) : (
              <button
                type="button"
                className="billing-btn-upload-readings"
                disabled={isUploadingReadings}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {isUploadingReadings ? 'Đang đọc và tính toán chỉ số...' : 'Upload file chỉ số điện nước (Excel/CSV)'}
              </button>
            )}
          </div>

          {uploadReadingsInfo && (
            <div className="billing-upload-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>
                Đã nạp file: <strong>{uploadReadingsInfo.fileName}</strong> ({uploadReadingsInfo.totalRooms} phòng)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Thông báo trạng thái kỳ điện nước nếu đã phát hành */}
      {activeTab === 'utility' && utilityRooms.length === 0 && utilityCandidatesStatus.issued > 0 && (
        <div className="billing-status-banner">
          <div className="billing-status-banner-left">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>
              Kỳ <strong>{utilityMonth}</strong>: Đã phát hành hóa đơn điện nước cho <strong>{utilityCandidatesStatus.issued}</strong>/{utilityCandidatesStatus.total} phòng.
            </span>
          </div>
          <button
            type="button"
            className="billing-toggle-btn"
            onClick={() => setShowIssuedUtility(!showIssuedUtility)}
          >
            {showIssuedUtility ? 'Ẩn danh sách đã phát hành' : `Xem ${utilityCandidatesStatus.issued} phòng đã phát hành`}
          </button>
        </div>
      )}

      {/* ================= BẢNG DỮ LIỆU ================= */}
      <div className="billing-table-wrapper">
        {activeTab === 'room' ? (
          /* Bảng Hóa đơn tiền phòng theo tháng */
          <table className="billing-table">
            <thead>
              <tr>
                <th style={{ width: '18%' }}>Mã SV</th>
                <th style={{ width: '22%' }}>Họ và tên</th>
                <th style={{ width: '15%' }}>Phòng</th>
                <th style={{ width: '17%' }}>Loại phòng</th>
                <th style={{ width: '16%' }}>Thời hạn hợp đồng</th>
                <th style={{ width: '12%' }}>Số tiền/năm</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoomStudents.length > 0 ? (
                filteredRoomStudents.map((item, index) => (
                  <tr key={`${item.id}-${index}`}>
                    <td className="col-student-id">{item.id}</td>
                    <td className="col-student-name">{item.name}</td>
                    <td className="col-room">{item.room}</td>
                    <td className="col-room-type">
                      <span className={`room-type-tag ${item.roomType === 'Phòng dịch vụ' ? 'tag-service' : 'tag-standard'}`}>
                        {item.roomType}
                      </span>
                    </td>
                    <td className="col-term">{item.contractTerm}</td>
                    <td className="col-amount">{item.termAmount}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="billing-empty-state">
                    {searchTerm.trim()
                      ? `Không tìm thấy sinh viên nào phù hợp với từ khóa "${searchTerm}".`
                      : `Không có sinh viên nào thuộc ${appliedTarget} cần lập hóa đơn tiền phòng cho ${billingYear}.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          /* Bảng Hóa đơn điện nước theo tháng */
          <table className="billing-table">
            <thead>
              <tr>
                <th style={{ width: '15%' }}>Phòng</th>
                <th style={{ width: '18%' }}>Chỉ số điện (cũ - mới)</th>
                <th style={{ width: '13%' }}>Tiêu thụ (kWh)</th>
                <th style={{ width: '18%' }}>Chỉ số nước (cũ - mới)</th>
                <th style={{ width: '13%' }}>Tiêu thụ (m³)</th>
                <th style={{ width: '23%' }}>Tổng tiền/người</th>
              </tr>
            </thead>
            <tbody>
              {filteredUtilityRooms.length === 0 ? (
                <tr>
                  <td colSpan="6" className="billing-empty-state" style={{ padding: '42px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <line x1="9" y1="15" x2="15" y2="15" />
                      </svg>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: '#334155' }}>
                        Chưa có dữ liệu chỉ số điện nước
                      </span>
                      <span style={{ fontSize: '13.5px', color: '#64748b' }}>
                        Vui lòng tải lên file chỉ số điện nước (Excel/CSV) để xem trước dữ liệu và tính tiền cho các phòng.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUtilityRooms.map((item, index) => (
                  <tr key={`${item.room}-${index}`}>
                    <td className="col-student-id">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.room}</div>
                        {item.da_lap_hoa_don && (
                          <span className="room-type-tag tag-issued" style={{ fontSize: '11px', padding: '2px 6px' }}>
                            Đã phát hành
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="col-student-name">{item.elecMeter}</td>
                    <td className="col-room">{item.elecUsage}</td>
                    <td className="col-term">{item.waterMeter}</td>
                    <td className="col-room">{item.waterUsage}</td>
                    <td className="col-amount" style={{ fontWeight: 600 }}>
                      {item.soNguoi > 0 ? (
                        <>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: '#2563eb' }}>
                            {Number(item.perPersonAmount ?? 0).toLocaleString('vi-VN')} VND / người
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginTop: '2px' }}>
                            Tổng phòng: {Number(item.rawAmount ?? 0).toLocaleString('vi-VN')} VND ({item.soNguoi} SV)
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#d97706' }}>
                            - VND / người
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 500, color: '#b45309', marginTop: '2px' }}>
                            Chưa có SV ở (Tổng phòng: {Number(item.rawAmount ?? 0).toLocaleString('vi-VN')} đ)
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ================= ACTIONS DƯỚI BẢNG ================= */}
      <div className="billing-footer-actions">
        {/* Link Xem tất cả */}
        {((activeTab === 'room' && targetRoomStudents.length > 3) || (activeTab === 'utility' && utilityRooms.length > 3)) ? (
          <button
            type="button"
            className="billing-view-all-link"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Thu gọn danh sách' : 'Xem tất cả'}
          </button>
        ) : (
          <div />
        )}

        {/* Button Phát hành hóa đơn */}
        <button
          type="button"
          className={`billing-publish-btn ${(noRoomToIssue || noUtilityToIssue) ? 'billing-btn-disabled' : ''}`}
          disabled={isPublishing || noRoomToIssue || noUtilityToIssue}
          onClick={() => setShowConfirmModal(true)}
          title={
            noUtilityToIssue
              ? 'Vui lòng upload file chỉ số trước khi phát hành'
              : noRoomToIssue
                ? 'Không còn sinh viên nào cần phát hành hóa đơn kỳ này'
                : ''
          }
        >
          {activeTab === 'room'
            ? 'Phát hành hóa đơn tiền phòng'
            : 'Phát hành hóa đơn điện nước'}
        </button>
      </div>

      {/* ================= MODAL XÁC NHẬN PHÁT HÀNH ================= */}
      {showConfirmModal && (
        <div className="billing-modal-backdrop" onClick={() => setShowConfirmModal(false)}>
          <div className="billing-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="billing-modal-header">
              <div className="billing-modal-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <h2 className="billing-modal-title">
                {activeTab === 'room'
                  ? 'Xác nhận phát hành hóa đơn tiền phòng theo năm'
                  : 'Xác nhận phát hành hóa đơn điện nước'}
              </h2>
            </div>

            <div className="billing-modal-body">
              <p>
                Bạn đang chuẩn bị phát hành đợt hóa đơn định kỳ cho toàn bộ sinh viên đủ điều kiện.
                Vui lòng kiểm tra lại các thông số trước khi gửi thông báo:
              </p>

              <div className="billing-modal-summary-box">
                {activeTab === 'room' ? (
                  <>
                    <div className="billing-summary-row">
                      <span className="label">Năm học áp dụng:</span>
                      <span className="value">{billingYear}</span>
                    </div>
                    <div className="billing-summary-row">
                      <span className="label">Đối tượng áp dụng:</span>
                      <span className="value">{appliedTarget}</span>
                    </div>
                    <div className="billing-summary-row">
                      <span className="label">Đơn giá niêm yết:</span>
                      <span className="value">Tiêu chuẩn: 4.800.000 đ/năm | Dịch vụ: 8.200.000 đ/năm</span>
                    </div>
                    <div className="billing-summary-row">
                      <span className="label">Số sinh viên áp dụng:</span>
                      <span className="value">{targetRoomStudents.length} sinh viên</span>
                    </div>
                    <div className="billing-summary-row">
                      <span className="label">Tổng giá trị đợt phát hành:</span>
                      <span className="value" style={{ color: '#ff7700', fontWeight: 700 }}>
                        {totalBatchAmount.toLocaleString('vi-VN')} VND
                      </span>
                    </div>
                    <div className="billing-summary-row">
                      <span className="label">Hạn chốt nộp tiền:</span>
                      <span className="value">{deadline.split('-').reverse().join('/')}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="billing-summary-row">
                      <span className="label">Tháng áp dụng:</span>
                      <span className="value">{utilityMonth}</span>
                    </div>
                    <div className="billing-summary-row">
                      <span className="label">Số phòng áp dụng:</span>
                      <span className="value">{utilityRooms.length} phòng</span>
                    </div>
                    <div className="billing-summary-row">
                      <span className="label">Hạn chốt nộp tiền:</span>
                      <span className="value">{utilityDeadline.split('-').reverse().join('/')}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="billing-modal-actions">
              <button
                type="button"
                className="billing-btn-cancel"
                onClick={() => setShowConfirmModal(false)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="billing-btn-confirm"
                onClick={handleConfirmPublish}
              >
                Xác nhận phát hành
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TOAST THÔNG BÁO THÀNH CÔNG ================= */}
      {toastMessage && (
        <div className="billing-toast">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
