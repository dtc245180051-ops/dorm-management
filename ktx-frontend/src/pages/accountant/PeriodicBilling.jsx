import { useState, useMemo, useEffect, useCallback } from 'react';
import './PeriodicBilling.css';
import { invoiceService } from '../../services/invoiceService';

/**
 * Danh sách năm học
 */
const ACADEMIC_YEAR_OPTIONS = [
  'Năm học 2026 – 2027',
  'Năm học 2025 – 2026',
  'Năm học 2024 – 2025',
  'Năm học 2027 – 2028',
];

/**
 * Danh sách phạm vi áp dụng (Tất cả hoặc theo từng tòa từ A1 đến A11)
 */
const APPLIED_TARGET_OPTIONS = [
  'Tất cả sinh viên còn hạn hợp đồng',
  'Sinh viên tòa A1',
  'Sinh viên tòa A2',
  'Sinh viên tòa A3',
  'Sinh viên tòa A4',
  'Sinh viên tòa A5',
  'Sinh viên tòa A6',
  'Sinh viên tòa A7',
  'Sinh viên tòa A8',
  'Sinh viên tòa A9',
  'Sinh viên tòa A10',
  'Sinh viên tòa A11',
];

/**
 * Cấu hình đơn giá theo năm theo loại phòng:
 * - Phòng thường: 6.600.000 VNĐ/năm (600.000 VNĐ/tháng x 11 tháng)
 * - Phòng tiêu chuẩn: 8.800.000 VNĐ/năm (800.000 VNĐ/tháng x 11 tháng)
 */
const ROOM_PRICE_CONFIG = {
  thuong: {
    key: 'thuong',
    name: 'Phòng thường',
    monthlyPrice: 600000,
    yearlyPrice: 6600000,
    label: 'Đơn giá : Phòng thường (6.600.000 VNĐ/năm)',
  },
  tieu_chuan: {
    key: 'tieu_chuan',
    name: 'Phòng tiêu chuẩn',
    monthlyPrice: 800000,
    yearlyPrice: 8800000,
    label: 'Đơn giá : Phòng tiêu chuẩn (8.800.000 VNĐ/năm)',
  },
};

/**
 * Thời gian ở cố định 11 tháng theo năm học
 */
const FIXED_STAY_DURATION_MONTHS = 11;

/**
 * Danh sách sinh viên mẫu theo năm học (bám sát ảnh Figma, đủ các tòa A1 - A11 và 11 tháng)
 */
const MOCK_ROOM_BILLING_STUDENTS = [
  {
    id: 'DTC245180037',
    name: 'Ngô Phương Mai',
    room: 'P101 - Tòa A1',
    building: 'A1',
    roomType: 'thuong',
    contractTerm: '01/09/2026 - 31/07/2027',
  },
  {
    id: 'DTC245180051',
    name: 'Phan Vũ Hoàng Long',
    room: 'P102 - Tòa A1',
    building: 'A1',
    roomType: 'tieu_chuan',
    contractTerm: '01/09/2026 - 31/07/2027',
  },
  {
    id: 'DTC245180088',
    name: 'Lê Thị Thu Thảo',
    room: 'P205 - Tòa A2',
    building: 'A2',
    roomType: 'thuong',
    contractTerm: '01/09/2026 - 31/07/2027',
  },
  {
    id: 'DTC245180120',
    name: 'Nguyễn Tiến Dũng',
    room: 'P301 - Tòa A3',
    building: 'A3',
    roomType: 'tieu_chuan',
    contractTerm: '01/09/2026 - 31/07/2027',
  },
  {
    id: 'DTC245180145',
    name: 'Trần Hải Yến',
    room: 'P402 - Tòa A4',
    building: 'A4',
    roomType: 'thuong',
    contractTerm: '01/09/2026 - 31/07/2027',
  },
  {
    id: 'DTC245180162',
    name: 'Đỗ Quang Huy',
    room: 'P503 - Tòa A5',
    building: 'A5',
    roomType: 'tieu_chuan',
    contractTerm: '01/09/2026 - 31/07/2027',
  },
  {
    id: 'DTC245180189',
    name: 'Vũ Minh Anh',
    room: 'P602 - Tòa A6',
    building: 'A6',
    roomType: 'thuong',
    contractTerm: '01/09/2026 - 31/07/2027',
  },
  {
    id: 'DTC245180210',
    name: 'Bùi Tuấn Kiệt',
    room: 'P701 - Tòa A7',
    building: 'A7',
    roomType: 'tieu_chuan',
    contractTerm: '01/09/2026 - 31/07/2027',
  },
  {
    id: 'DTC245180235',
    name: 'Hoàng Bảo Ngọc',
    room: 'P804 - Tòa A8',
    building: 'A8',
    roomType: 'thuong',
    contractTerm: '01/09/2026 - 31/07/2027',
  },
  {
    id: 'DTC245180258',
    name: 'Đinh Gia Bảo',
    room: 'P902 - Tòa A9',
    building: 'A9',
    roomType: 'tieu_chuan',
    contractTerm: '01/09/2026 - 31/07/2027',
  },
  {
    id: 'DTC245180280',
    name: 'Phạm Quỳnh Nga',
    room: 'P1001 - Tòa A10',
    building: 'A10',
    roomType: 'thuong',
    contractTerm: '01/09/2026 - 31/07/2027',
  },
  {
    id: 'DTC245180305',
    name: 'Lý Quốc Trung',
    room: 'P1102 - Tòa A11',
    building: 'A11',
    roomType: 'tieu_chuan',
    contractTerm: '01/09/2026 - 31/07/2027',
  },
];

/**
 * Dữ liệu mẫu hóa đơn điện nước theo tháng
 */
const MOCK_UTILITY_BILLING_ROOMS = [
  {
    room: 'P102 - A1',
    elecMeter: '1240 - 1340',
    elecUsage: '100 kWh',
    waterMeter: '450 - 460',
    waterUsage: '10 m³',
    totalAmount: '450.000 VND',
  },
  {
    room: 'P103 - A1',
    elecMeter: '2100 - 2215',
    elecUsage: '115 kWh',
    waterMeter: '610 - 622',
    waterUsage: '12 m³',
    totalAmount: '525.000 VND',
  },
  {
    room: 'P201 - A2',
    elecMeter: '0890 - 0985',
    elecUsage: '95 kWh',
    waterMeter: '320 - 328',
    waterUsage: '8 m³',
    totalAmount: '405.000 VND',
  },
  {
    room: 'P205 - A2',
    elecMeter: '1540 - 1670',
    elecUsage: '130 kWh',
    waterMeter: '540 - 554',
    waterUsage: '14 m³',
    totalAmount: '600.000 VND',
  },
];

/**
 * Trang "LẬP HÓA ĐƠN ĐỊNH KỲ" (Dành riêng cho Kế Toán)
 * Khớp 100% bản thiết kế Figma với các quy tắc:
 * - Chọn năm học thay vì chọn kỳ
 * - Thời gian ở cố định 11 tháng
 * - Áp dụng: Tất cả SV còn hạn hợp đồng, Sinh viên tòa A1 đến A11
 * - Đơn giá theo năm gồm các phòng: Thường, Tiêu chuẩn
 */
export default function PeriodicBilling({ searchTerm = '' }) {
  // Tab hiện tại: 'room' | 'utility'
  const [activeTab, setActiveTab] = useState('room');

  // Form tiền phòng
  const [academicYear, setAcademicYear] = useState('Năm học 2026 – 2027');
  const [appliedTarget, setAppliedTarget] = useState('Tất cả sinh viên còn hạn hợp đồng');
  const [deadline, setDeadline] = useState('2026-09-15');
  const [selectedRoomTypeKey, setSelectedRoomTypeKey] = useState('thuong'); // 'thuong' | 'tieu_chuan'

  // Thời gian ở cố định 11 tháng
  const currentDuration = FIXED_STAY_DURATION_MONTHS;

  // Cấu hình đơn giá theo năm đang chọn
  const currentPriceConfig = ROOM_PRICE_CONFIG[selectedRoomTypeKey] || ROOM_PRICE_CONFIG.thuong;
  const currentPrice = currentPriceConfig.monthlyPrice; // Đơn giá tháng (600.000 hoặc 800.000)
  const totalAmountPerStudent = currentPriceConfig.yearlyPrice; // Đơn giá cả năm (6.600.000 hoặc 8.800.000)

  // Form điện nước
  const [utilityMonth, setUtilityMonth] = useState('Tháng 09/2026');
  const [utilityTarget, setUtilityTarget] = useState('Tất cả các phòng đang có sinh viên');
  const [utilityDeadline, setUtilityDeadline] = useState('2026-09-20');
  const [elecRate] = useState('3.000 VND/kWh');
  const [waterRate] = useState('15.000 VND/m³');

  // State dữ liệu danh sách sinh viên & phòng
  const [roomStudents, setRoomStudents] = useState([]);
  const [utilityRooms, setUtilityRooms] = useState(MOCK_UTILITY_BILLING_ROOMS);

  // Trạng thái hiển thị tất cả
  const [showAll, setShowAll] = useState(false);

  // Modal xác nhận phát hành
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // 1. Tải danh sách ứng viên tiền phòng từ Backend API khi thay đổi tham số (năm học, đơn giá, tòa nhà áp dụng)
  const loadRoomCandidates = useCallback(async () => {
    const data = await invoiceService.getRoomCandidates(academicYear, currentDuration, currentPrice, appliedTarget);
    if (data && Array.isArray(data) && data.length > 0) {
      setRoomStudents(
        data.map((c) => ({
          id: c.msv,
          name: c.ho_ten,
          room: c.phong,
          contractTerm: c.thoi_han_hop_dong || '01/09/2026 - 31/07/2027',
          termAmount: `${(c.so_tien ?? totalAmountPerStudent).toLocaleString('vi-VN')} VND`,
          daLapHoaDon: c.da_lap_hoa_don,
        }))
      );
    } else {
      // Fallback dữ liệu mẫu phong phú các tòa A1 - A11
      setRoomStudents(
        MOCK_ROOM_BILLING_STUDENTS.map((s) => ({
          ...s,
          termAmount: `${totalAmountPerStudent.toLocaleString('vi-VN')} VND`,
        }))
      );
    }
  }, [academicYear, currentDuration, currentPrice, appliedTarget, totalAmountPerStudent]);

  // 2. Tải danh sách phòng điện nước từ Backend API
  const loadUtilityCandidates = useCallback(async () => {
    const data = await invoiceService.getUtilityCandidates(utilityMonth);
    if (data && Array.isArray(data) && data.length > 0) {
      setUtilityRooms(
        data.map((r) => ({
          room: `P${r.so_phong} - ${r.toa_nha}`,
          elecMeter: r.chi_so_dien_cu_moi,
          elecUsage: `${r.so_dien_kwh} kWh`,
          waterMeter: r.chi_so_nuoc_cu_moi,
          waterUsage: `${r.so_nuoc_m3} m³`,
          totalAmount: `${r.tong_tien.toLocaleString('vi-VN')} VND`,
        }))
      );
    }
  }, [utilityMonth]);

  useEffect(() => {
    loadRoomCandidates();
  }, [loadRoomCandidates]);

  useEffect(() => {
    loadUtilityCandidates();
  }, [loadUtilityCandidates]);

  // 3. Lọc dữ liệu sinh viên theo tòa áp dụng (A1 đến A11) và từ khóa tìm kiếm
  const filteredRoomStudents = useMemo(() => {
    let list = roomStudents;

    // Lọc theo phạm vi áp dụng (ví dụ: "Sinh viên tòa A1", "Sinh viên tòa A2", ...)
    if (appliedTarget && appliedTarget !== 'Tất cả sinh viên còn hạn hợp đồng') {
      const match = appliedTarget.match(/A\d+/i);
      if (match) {
        const buildingCode = match[0].toUpperCase();
        list = list.filter((s) => {
          if (s.building) return s.building.toUpperCase() === buildingCode;
          return s.room && s.room.toUpperCase().includes(buildingCode);
        });
      }
    }

    // Lọc theo từ khóa tìm kiếm
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (s) =>
          s.id.toLowerCase().includes(term) ||
          s.name.toLowerCase().includes(term) ||
          s.room.toLowerCase().includes(term)
      );
    }

    // Mặc định hiển thị 3 hàng đầu tiên như ảnh Figma trừ khi bấm "Xem tất cả" hoặc đang tìm kiếm
    return showAll || searchTerm.trim() ? list : list.slice(0, 3);
  }, [searchTerm, showAll, roomStudents, appliedTarget]);

  const filteredUtilityRooms = useMemo(() => {
    let list = utilityRooms;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((r) => r.room.toLowerCase().includes(term));
    }
    return showAll || searchTerm.trim() ? list : list.slice(0, 3);
  }, [searchTerm, showAll, utilityRooms]);

  // 4. Xử lý xác nhận phát hành hóa đơn (gọi API Backend)
  const handleConfirmPublish = async () => {
    setShowConfirmModal(false);

    if (activeTab === 'room') {
      const payload = {
        ky_thanh_toan: academicYear,
        ap_dung: appliedTarget,
        thoi_gian_o_thang: currentDuration,
        don_gia_thang: currentPrice,
        han_thanh_toan: deadline,
        ghi_chu: `Phát hành hóa đơn tiền phòng ${academicYear} (${currentPriceConfig.name})`,
      };

      const result = await invoiceService.publishRoomInvoices(payload);
      if (result.success) {
        setToastMessage(result.data?.message || `Đã phát hành thành công hóa đơn tiền phòng ${academicYear}!`);
        loadRoomCandidates();
      } else {
        setToastMessage(`Lỗi: ${result.message}`);
      }
    } else {
      const payload = {
        thang: utilityMonth,
        han_thanh_toan: utilityDeadline,
        don_gia_dien: 3000.0,
        don_gia_nuoc: 15000.0,
        ghi_chu: `Phát hành hóa đơn điện nước ${utilityMonth}`,
      };

      const result = await invoiceService.publishUtilityInvoices(payload);
      if (result.success) {
        setToastMessage(result.data?.message || `Đã phát hành thành công hóa đơn điện nước ${utilityMonth}!`);
        loadUtilityCandidates();
      } else {
        setToastMessage(`Lỗi: ${result.message}`);
      }
    }

    setTimeout(() => {
      setToastMessage('');
    }, 5500);
  };

  // Xử lý khi nhấn nút Áp dụng trong tab Hóa đơn tiền điện nước theo tháng
  const handleApplyUtility = () => {
    loadUtilityCandidates();
    setToastMessage(`Đã áp dụng cấu hình cho ${utilityMonth}!`);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };




  return (
    <div className="billing-card">
      {/* Tiêu đề trang chuẩn Figma */}
      <h1 className="billing-title">LẬP HÓA ĐƠN ĐỊNH KỲ</h1>

      {/* ================= TABS ================= */}
      <div className="billing-tabs-container">
        {/* Tab 1: HÓA ĐƠN TIỀN PHÒNG THEO NĂM HỌC */}
        <button
          type="button"
          className={`billing-tab-btn ${activeTab === 'room' ? 'active' : 'inactive'}`}
          onClick={() => setActiveTab('room')}
        >
          HÓA ĐƠN TIỀN PHÒNG THEO NĂM HỌC
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
        /* Cấu hình tiền phòng theo năm học */
        <div className="billing-form-grid">
          {/* Cột trái */}
          <div className="billing-form-col">
            {/* Chọn năm học (thay cho chọn kỳ) */}
            <div className="billing-control-box">
              <select
                className="billing-select"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
              >
                {ACADEMIC_YEAR_OPTIONS.map((year) => (
                  <option key={year} value={year}>
                    Chọn năm học: {year.replace('Năm học ', '')}
                  </option>
                ))}
              </select>
              <span className="billing-box-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>

            {/* Áp dụng: Tất cả SV còn hạn hợp đồng, Sinh viên tòa A1 đến A11 */}
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
                value={deadline}
                onChange={(e) => e.target.value && setDeadline(e.target.value)}
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

          {/* Cột phải */}
          <div className="billing-form-col">
            {/* Thời gian ở : Cố định 11 tháng */}
            <div className="billing-control-box readonly-box">
              <span className="billing-static-text">Thời gian ở : 11 tháng</span>
              <span className="billing-box-icon" title="Cố định 11 tháng theo năm học">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
            </div>

            {/* Đơn giá theo năm gồm các phòng: Thường, Tiêu chuẩn */}
            <div className="billing-control-box">
              <select
                className="billing-select"
                value={selectedRoomTypeKey}
                onChange={(e) => setSelectedRoomTypeKey(e.target.value)}
              >
                <option value="thuong">Đơn giá : Phòng thường (6.600.000 VNĐ/năm)</option>
                <option value="tieu_chuan">Đơn giá : Phòng tiêu chuẩn (8.800.000 VNĐ/năm)</option>
              </select>
              <span className="billing-box-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>

            {/* Tổng phải nộp Badge chuẩn Figma */}
            <div className="billing-total-row">
              <div className="billing-total-badge">
                Tổng phải nộp: {totalAmountPerStudent.toLocaleString('vi-VN')} VND
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
              >
                <option value="Tháng 09/2026">Chọn tháng: Tháng 09/2026</option>
                <option value="Tháng 10/2026">Chọn tháng: Tháng 10/2026</option>
                <option value="Tháng 11/2026">Chọn tháng: Tháng 11/2026</option>
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
                value={utilityDeadline}
                onChange={(e) => e.target.value && setUtilityDeadline(e.target.value)}
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
              <button
                type="button"
                className="billing-apply-btn"
                onClick={handleApplyUtility}
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= BẢNG DỮ LIỆU ================= */}
      <div className="billing-table-wrapper">
        {activeTab === 'room' ? (
          /* Bảng Hóa đơn tiền phòng theo kỳ */
          <table className="billing-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Mã SV</th>
                <th style={{ width: '28%' }}>Họ và tên</th>
                <th style={{ width: '18%' }}>Phòng</th>
                <th style={{ width: '20%' }}>Thời hạn hợp đồng</th>
                <th style={{ width: '12%' }}>Số tiền năm học</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoomStudents.length > 0 ? (
                filteredRoomStudents.map((item, index) => (
                  <tr key={`${item.id}-${index}`}>
                    <td className="col-student-id">{item.id}</td>
                    <td className="col-student-name">{item.name}</td>
                    <td className="col-room">{item.room}</td>
                    <td className="col-term">{item.contractTerm}</td>
                    <td className="col-amount">{item.termAmount}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="billing-empty-state">
                    {searchTerm.trim()
                      ? `Không tìm thấy sinh viên nào phù hợp với từ khóa "${searchTerm}".`
                      : `Không có sinh viên nào thuộc ${appliedTarget} cần lập hóa đơn tiền phòng cho ${academicYear}.`}
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
                <th style={{ width: '20%' }}>Chỉ số điện (cũ - mới)</th>
                <th style={{ width: '15%' }}>Tiêu thụ (kWh)</th>
                <th style={{ width: '20%' }}>Chỉ số nước (cũ - mới)</th>
                <th style={{ width: '15%' }}>Tiêu thụ (m³)</th>
                <th style={{ width: '15%' }}>Tổng tiền</th>
              </tr>
            </thead>
            <tbody>
              {filteredUtilityRooms.length > 0 ? (
                filteredUtilityRooms.map((item, index) => (
                  <tr key={`${item.room}-${index}`}>
                    <td className="col-student-id">{item.room}</td>
                    <td className="col-student-name">{item.elecMeter}</td>
                    <td className="col-room">{item.elecUsage}</td>
                    <td className="col-term">{item.waterMeter}</td>
                    <td className="col-room">{item.waterUsage}</td>
                    <td className="col-amount" style={{ fontWeight: 600, color: '#0084ff' }}>{item.totalAmount}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="billing-empty-state">
                    Không tìm thấy phòng nào phù hợp với từ khóa "{searchTerm}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ================= ACTIONS DƯỚI BẢNG ================= */}
      <div className="billing-footer-actions">
        {/* Link Xem tất cả */}
        <button
          type="button"
          className="billing-view-all-link"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Thu gọn danh sách' : 'Xem tất cả'}
        </button>

        {/* Button Phát hành hóa đơn */}
        <button
          type="button"
          className="billing-publish-btn"
          onClick={() => setShowConfirmModal(true)}
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
                  ? 'Xác nhận phát hành hóa đơn tiền phòng'
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
                      <span className="value">{academicYear}</span>
                    </div>
                    <div className="billing-summary-row">
                      <span className="label">Đối tượng áp dụng:</span>
                      <span className="value">{appliedTarget}</span>
                    </div>
                    <div className="billing-summary-row">
                      <span className="label">Loại phòng & Đơn giá:</span>
                      <span className="value">{currentPriceConfig.name} ({totalAmountPerStudent.toLocaleString('vi-VN')} VND / 11 tháng)</span>
                    </div>
                    <div className="billing-summary-row">
                      <span className="label">Số sinh viên áp dụng:</span>
                      <span className="value">{filteredRoomStudents.length} sinh viên</span>
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
                      <span className="value">{filteredUtilityRooms.length} phòng</span>
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
