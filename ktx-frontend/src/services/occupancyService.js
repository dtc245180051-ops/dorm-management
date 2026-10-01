import api, { dormService } from './api';

const STORAGE_KEY = 'dorm_registration_requests';

// Dữ liệu mẫu ban đầu để luôn có sẵn dữ liệu chuẩn bị kiểm thử
const DEFAULT_REQUESTS = [
  {
    id: 'DK2026-0148',
    ma_yeu_cau: '#DK2026-0148',
    msv: 'DTCxxxxxxxx',
    ho_ten: 'Nguyễn Văn A',
    gioi_tinh: 'Nữ',
    ngay_sinh: '21/01/2006',
    cccd: '01xxxxxxxxxx',
    so_dien_thoai: '09xxxxxxxx',
    email: 'DTCxxxxxxxx',
    khoa: 'CNTT',
    lop: 'CNTT K23A',
    dia_chi: 'Xã A - Tỉnh Hải Dương',
    doi_tuong_uu_tien: 'Không thuộc diện ưu tiên',
    nguoi_giam_ho: 'Nguyễn Văn B',
    moi_quan_he: 'Bố',
    sdt_nguoi_giam_ho: '09xxxxxxxx',
    nguyen_vong: 'Em có nguyện vọng ở tòa A2, em xin cảm ơn',
    nguyen_vong_phong: 'P36',
    nguyen_vong_label: 'P36 - Tầng 3 - Tòa A2',
    loai_phong: 'Phòng tiêu chuẩn',
    tang_mong_muon: 'Tầng 3',
    muc_gia_mong_muon: '12.000.000 đ/năm',
    nam_hoc: '2026-2027',
    ngay_dang_ky: '25/08/2026',
    ngay_gui: '25/08/2026 09:12',
    ngay_tiep_nhan: '26/08/2026 14:30',
    ngay_du_kien: '05/09/2026',
    trang_thai: 'CHO_DUYET',
    trang_thai_label: 'Đang xét duyệt',
    goi_y: {
      ma_toa: 'A2',
      ma_phong: 'P36',
      ma_giuong: 'G07',
    },
  },
];

// Helper lấy danh sách đơn từ LocalStorage
function getLocalRequests() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_REQUESTS));
      return DEFAULT_REQUESTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_REQUESTS;
  } catch (e) {
    return DEFAULT_REQUESTS;
  }
}

// Helper lưu danh sách đơn vào LocalStorage
function saveLocalRequests(requests) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

const TRANSFER_CHECKOUT_STORAGE_KEY = 'dorm_transfer_checkout_requests';
const CURRENT_ROOM_STORAGE_KEY = 'dorm_current_room_info';
const STAY_CONTRACTS_STORAGE_KEY = 'dorm_stay_contracts';
const STUDENT_PROFILE_STORAGE_KEY = 'dorm_student_profile';

const DEFAULT_STUDENT_PROFILE = {
  ho_ten: 'Nguyễn Văn A',
  vai_tro: 'Sinh viên',
  msv: 'DTCxxxxxxxxx',
  lop: 'CNTT K23A',
  so_dien_thoai: '09xxxxxxxx',
  email: 'DTCxxxxxxxxx@ictu.edu.vn',
  ngay_sinh: '12/07/2007',
  gioi_tinh: 'Nữ',
  dan_toc: 'Kinh',
  que_quan: 'Xã A - Tỉnh Bắc Ninh',
  khoa: 'CNTT',
  avatar_url: '/avatar.png',
};

const DEFAULT_CURRENT_ROOM_INFO = {
  phong_hien_tai: 'P36 – Tòa A2 – Tầng 3',
  thanh_vien: '6/8 người',
  thoi_gian_luu_tru: '09/2025 – Nay',
  so_phong: '36',
  toa: 'A2',
  tang: '3',
  giuong: '4',
  ngay_nhan_phong: '01/09/2024',
  so_thanh_vien: 6,
  suc_chua: 8,
  vi_tri_hien_tai: 'Phòng 36 - Giường 4',
  cong_no: 'Đã hoàn thành toàn bộ phí',
  trang_thai: 'DANG_O',
};

const DEFAULT_STAY_CONTRACTS = [
  {
    id: 'HD26-A2P36-G07',
    ma_hop_dong: 'HD26-A2P36-G07',
    phong: 'P36',
    toa: 'A2',
    tang: '3',
    giuong: 'G7',
    thoi_gian_o: '2026-2027',
    nam_hoc: '2026-2027',
    trang_thai: 'DANG_O',
    trang_thai_label: 'Đang ở',
  },
];

const DEFAULT_TRANSFER_CHECKOUT_REQUESTS = [
  {
    id: 'YC-0231',
    ma_yeu_cau: '#YC-0231',
    loai_yeu_cau: 'Chuyển phòng',
    loai_don: 'CHUYEN_PHONG',
    msv: 'DTC245180051',
    ho_ten: 'Nguyễn Quốc Huy',
    gioi_tinh: 'Nam',
    khoa: 'Công nghệ thông tin',
    lop: 'DTC-K20',
    vi_tri_hien_tai: 'Phòng A102 - Giường G01',
    cong_no: 'Đã hoàn thành toàn bộ phí',
    ngay_gui: '25/11/2025',
    phong_lien_quan: 'P12 → P36',
    phong_hien_tai: 'P12',
    phong_dich: 'P36',
    ly_do: 'Phòng hiện tại quá tải',
    ngay_mong_muon: '01/12/2025',
    mo_ta: 'Em muốn chuyển sang phòng A305 để cùng phòng với các bạn cùng nhóm đồ án môn học...',
    trang_thai: 'DA_DUYET',
    trang_thai_label: 'Đã duyệt',
  },
  {
    id: 'YC-0232',
    ma_yeu_cau: '#YC-0232',
    loai_yeu_cau: 'Trả phòng',
    loai_don: 'TRA_PHONG',
    msv: 'DTC245180051',
    ho_ten: 'Nguyễn Quốc Huy',
    gioi_tinh: 'Nam',
    khoa: 'Công nghệ thông tin',
    lop: 'DTC-K20',
    vi_tri_hien_tai: 'Phòng A102 - Giường G01',
    cong_no: 'Đã hoàn thành toàn bộ phí',
    ngay_gui: '25/08/2026',
    phong_lien_quan: 'P36',
    phong_hien_tai: 'P36',
    ly_do: 'Đã tốt nghiệp',
    ngay_mong_muon: '01/09/2026',
    dia_chi_sau_tra: 'Số 123 Đường Cầu Giấy, Quận Cầu Giấy, Hà Nội',
    dia_chi_chi_tiet: {
      tinh: 'Hà Nội',
      huyen: 'Quận Cầu Giấy',
      so_nha: 'Số 123 Đường Cầu Giấy',
    },
    mo_ta: 'Em muốn chuyển sang phòng A305 để cùng phòng với các bạn cùng nhóm đồ án môn học...',
    trang_thai: 'CHO_DUYET',
    trang_thai_label: 'Chờ duyệt',
  },
];

function getLocalTransferCheckoutRequests() {
  try {
    const raw = localStorage.getItem(TRANSFER_CHECKOUT_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(TRANSFER_CHECKOUT_STORAGE_KEY, JSON.stringify(DEFAULT_TRANSFER_CHECKOUT_REQUESTS));
      return DEFAULT_TRANSFER_CHECKOUT_REQUESTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TRANSFER_CHECKOUT_REQUESTS;
  } catch (e) {
    return DEFAULT_TRANSFER_CHECKOUT_REQUESTS;
  }
}

function saveLocalTransferCheckoutRequests(reqs) {
  try {
    localStorage.setItem(TRANSFER_CHECKOUT_STORAGE_KEY, JSON.stringify(reqs));
  } catch (e) {
    console.error('Failed to save transfer/checkout to localStorage:', e);
  }
}

function getLocalCurrentRoomInfo() {
  try {
    const raw = localStorage.getItem(CURRENT_ROOM_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CURRENT_ROOM_STORAGE_KEY, JSON.stringify(DEFAULT_CURRENT_ROOM_INFO));
      return DEFAULT_CURRENT_ROOM_INFO;
    }
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_CURRENT_ROOM_INFO;
  }
}

function saveLocalCurrentRoomInfo(info) {
  try {
    localStorage.setItem(CURRENT_ROOM_STORAGE_KEY, JSON.stringify(info));
  } catch (e) {
    console.error('Failed to save current room info:', e);
  }
}

function getLocalStudentProfile() {
  try {
    const raw = localStorage.getItem(STUDENT_PROFILE_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STUDENT_PROFILE_STORAGE_KEY, JSON.stringify(DEFAULT_STUDENT_PROFILE));
      return DEFAULT_STUDENT_PROFILE;
    }
    return { ...DEFAULT_STUDENT_PROFILE, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_STUDENT_PROFILE;
  }
}

function saveLocalStudentProfile(profile) {
  try {
    localStorage.setItem(STUDENT_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save student profile to localStorage:', e);
  }
}

function getLocalStayContracts() {
  try {
    const raw = localStorage.getItem(STAY_CONTRACTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STAY_CONTRACTS_STORAGE_KEY, JSON.stringify(DEFAULT_STAY_CONTRACTS));
      return DEFAULT_STAY_CONTRACTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_STAY_CONTRACTS;
  } catch (e) {
    return DEFAULT_STAY_CONTRACTS;
  }
}

function saveLocalStayContracts(contracts) {
  try {
    localStorage.setItem(STAY_CONTRACTS_STORAGE_KEY, JSON.stringify(contracts));
  } catch (e) {
    console.error('Failed to save stay contracts:', e);
  }
}



export const occupancyService = {
  /**
   * Lấy danh sách các lựa chọn phòng/giường trống cho sinh viên đăng ký
   */
  getAvailableOptions: async () => {
    try {
      const res = await api.get('/student/requests/available-options');
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch (err) {
      console.warn('GET /student/requests/available-options failed, trying /rooms/available:', err);
      try {
        const fallbackRes = await api.get('/rooms/available');
        if (Array.isArray(fallbackRes.data) && fallbackRes.data.length > 0) {
          return fallbackRes.data.map((r) => {
            const emptyBeds = (r.giuongs || []).filter((g) => g.trang_thai === 'TRONG').length;
            const bldName = r.ten_toa || (r.ma_toa ? `Tòa ${r.ma_toa}` : 'KTX');
            return {
              ma_phong: r.ma_phong,
              so_phong: r.so_phong,
              ma_tang: r.ma_tang,
              so_tang: r.so_tang,
              ma_toa: r.ma_toa,
              ten_toa: bldName,
              label: `P${r.so_phong} - Tầng ${r.so_tang || 1} - ${bldName} (${emptyBeds || r.so_giuong_trong || 0} chỗ trống)`,
              so_cho_trong: emptyBeds || r.so_giuong_trong || 0,
            };
          });
        }
      } catch (e2) {
        console.warn('Fallback /rooms/available also failed:', e2);
      }
    }

    return [
      {
        ma_phong: 'A1_P101',
        so_phong: '101',
        so_tang: 1,
        ma_toa: 'A1',
        ten_toa: 'Tòa A1',
        label: 'P101 - Tầng 1 - Tòa A1 (4 chỗ trống)',
        so_cho_trong: 4,
      },
      {
        ma_phong: 'A1_P102',
        so_phong: '102',
        so_tang: 1,
        ma_toa: 'A1',
        ten_toa: 'Tòa A1',
        label: 'P102 - Tầng 1 - Tòa A1 (1 chỗ trống)',
        so_cho_trong: 1,
      },
      {
        ma_phong: 'A1_P103',
        so_phong: '103',
        so_tang: 1,
        ma_toa: 'A1',
        ten_toa: 'Tòa A1',
        label: 'P103 - Tầng 1 - Tòa A1 (2 chỗ trống)',
        so_cho_trong: 2,
      },
      {
        ma_phong: 'A1_T1_P104',
        so_phong: '104',
        so_tang: 1,
        ma_toa: 'A1',
        ten_toa: 'Tòa A1',
        label: 'P104 - Tầng 1 - Tòa A1 (4 chỗ trống)',
        so_cho_trong: 4,
      },
      {
        ma_phong: 'A1_T2_P201',
        so_phong: '201',
        so_tang: 2,
        ma_toa: 'A1',
        ten_toa: 'Tòa A1',
        label: 'P201 - Tầng 2 - Tòa A1 (4 chỗ trống)',
        so_cho_trong: 4,
      },
      {
        ma_phong: 'A2_T1_P101',
        so_phong: '101',
        so_tang: 1,
        ma_toa: 'A2',
        ten_toa: 'Tòa A2',
        label: 'P101 - Tầng 1 - Tòa A2 (3 chỗ trống)',
        so_cho_trong: 3,
      },
      {
        ma_phong: 'B1_T1_P101',
        so_phong: '101',
        so_tang: 1,
        ma_toa: 'B1',
        ten_toa: 'Tòa B1',
        label: 'P101 - Tầng 1 - Tòa B1 (2 chỗ trống)',
        so_cho_trong: 2,
      },
    ];
  },

  /**
   * Lấy danh sách các mức giá phòng/năm hiện có từ CSDL KTX
   */
  getPriceOptions: async () => {
    try {
      const res = await api.get('/student/requests/price-options');
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch (err) {
      console.warn('GET /student/requests/price-options failed, using fallback:', err);
    }

    return [
      { gia_tien: 4800000, label: '4.800.000 đ/năm' },
      { gia_tien: 7200000, label: '7.200.000 đ/năm' },
      { gia_tien: 9600000, label: '9.600.000 đ/năm' },
      { gia_tien: 12000000, label: '12.000.000 đ/năm' },
    ];
  },

  /**
   * Lấy danh sách toàn bộ phòng phục vụ tính năng Tra cứu phòng (Student Room Lookup)
   * Trả về bộ dữ liệu chuẩn 100% theo giao diện Figma Tra cứu phòng (P36, P26, P106, P11, P54, P86, P16, P51,...)
   */
  getRooms: async (params = {}) => {
    // Bộ dữ liệu chuẩn 100% theo giao diện Figma Tra cứu phòng (Phân hệ Sinh viên)
    return [
      // Hàng 1 (4 card đầu chuẩn theo ảnh Figma)
      {
        id: 'P36',
        ma_phong: 'P36',
        so_phong: 'P36',
        ten_phong: 'P36',
        toa: 'Tòa A2',
        ma_toa: 'A2',
        tang: 'Tầng 3',
        so_tang: 3,
        loai_phong: 'Phòng tiêu chuẩn',
        suc_chua: 8,
        da_o: 6,
        si_so: '6/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '2.750.000 đ / năm',
        gia_so: 2750000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: [
          '/images/phong_thuc_te.jpg',
          '/images/rooms/phong-tieu-chuan.jpg',
          '/images/rooms/phong-tieu-chuan-2.jpg',
        ],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công', 'Wifi tốc độ cao'],
        giuong_trong: ['G03', 'G07'],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G03', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G04', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G05', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G06', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G07', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G08', trang_thai: 'DA_O', tang: 2 },
        ],
      },
      {
        id: 'P26',
        ma_phong: 'P26',
        so_phong: 'P26',
        ten_phong: 'P26',
        toa: 'Tòa A2',
        ma_toa: 'A2',
        tang: 'Tầng 2',
        so_tang: 2,
        loai_phong: 'Phòng tiêu chuẩn',
        suc_chua: 8,
        da_o: 5,
        si_so: '5/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '1.760.000 đ / năm',
        gia_so: 1760000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: [
          '/images/phong_thuc_te.jpg',
          '/images/rooms/phong-tieu-chuan.jpg',
        ],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công'],
        giuong_trong: ['G02', 'G05', 'G08'],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G03', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G04', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G05', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G06', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G07', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G08', trang_thai: 'TRONG', tang: 2 },
        ],
      },
      {
        id: 'P106',
        ma_phong: 'P106',
        so_phong: 'P106',
        ten_phong: 'P106',
        toa: 'Tòa A19',
        ma_toa: 'A19',
        tang: 'Tầng 1',
        so_tang: 1,
        loai_phong: 'Phòng tiêu chuẩn',
        suc_chua: 8,
        da_o: 5,
        si_so: '5/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '1.760.000 đ / năm',
        gia_so: 1760000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: [
          '/images/phong_thuc_te.jpg',
          '/images/rooms/phong-tieu-chuan-2.jpg',
        ],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Wifi tốc độ cao'],
        giuong_trong: ['G01', 'G04', 'G06'],
        giuongs: [
          { ma: 'G01', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G02', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G03', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G04', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G05', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G06', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G07', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G08', trang_thai: 'DA_O', tang: 2 },
        ],
      },
      {
        id: 'P11',
        ma_phong: 'P11',
        so_phong: 'P11',
        ten_phong: 'P11',
        toa: 'Tòa A1',
        ma_toa: 'A1',
        tang: 'Tầng 3',
        so_tang: 3,
        loai_phong: 'Phòng dịch vụ',
        suc_chua: 8,
        da_o: 8,
        si_so: '8/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '1.930.000 đ / năm',
        gia_so: 1930000,
        trang_thai: 'DA_DAY',
        trang_thai_label: 'Đã đầy',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: [
          '/images/phong_thuc_te.jpg',
          '/images/rooms/phong-dich-vu.jpg',
        ],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công', 'Tủ lạnh mini'],
        giuong_trong: [],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G03', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G04', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G05', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G06', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G07', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G08', trang_thai: 'DA_O', tang: 2 },
        ],
      },
      // Hàng 2 (4 card tiếp theo chuẩn theo ảnh Figma)
      {
        id: 'P54',
        ma_phong: 'P54',
        so_phong: 'P54',
        ten_phong: 'P54',
        toa: 'Tòa A4',
        ma_toa: 'A4',
        tang: 'Tầng 2',
        so_tang: 2,
        loai_phong: 'Phòng tiêu chuẩn',
        suc_chua: 8,
        da_o: 5,
        si_so: '5/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '1.760.000 đ / năm',
        gia_so: 1760000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: [
          '/images/phong_thuc_te.jpg',
          '/images/rooms/phong-tieu-chuan.jpg',
        ],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công'],
        giuong_trong: ['G03', 'G06', 'G07'],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G03', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G04', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G05', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G06', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G07', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G08', trang_thai: 'DA_O', tang: 2 },
        ],
      },
      {
        id: 'P86',
        ma_phong: 'P86',
        so_phong: 'P86',
        ten_phong: 'P86',
        toa: 'Tòa A7',
        ma_toa: 'A7',
        tang: 'Tầng 2',
        so_tang: 2,
        loai_phong: 'Phòng dịch vụ',
        suc_chua: 8,
        da_o: 5,
        si_so: '5/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '2.750.000 đ / năm',
        gia_so: 2750000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: [
          '/images/phong_thuc_te.jpg',
          '/images/rooms/phong-dich-vu.jpg',
        ],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công', 'Tủ lạnh mini'],
        giuong_trong: ['G02', 'G05', 'G08'],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G03', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G04', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G05', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G06', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G07', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G08', trang_thai: 'TRONG', tang: 2 },
        ],
      },
      {
        id: 'P16',
        ma_phong: 'P16',
        so_phong: 'P16',
        ten_phong: 'P16',
        toa: 'Tòa A1',
        ma_toa: 'A1',
        tang: 'Tầng 3',
        so_tang: 3,
        loai_phong: 'Phòng dịch vụ',
        suc_chua: 8,
        da_o: 5,
        si_so: '5/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '1.930.000 đ / năm',
        gia_so: 1930000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: [
          '/images/phong_thuc_te.jpg',
          '/images/rooms/phong-dich-vu.jpg',
        ],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công'],
        giuong_trong: ['G01', 'G04', 'G07'],
        giuongs: [
          { ma: 'G01', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G02', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G03', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G04', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G05', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G06', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G07', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G08', trang_thai: 'DA_O', tang: 2 },
        ],
      },
      {
        id: 'P51',
        ma_phong: 'P51',
        so_phong: 'P51',
        ten_phong: 'P51',
        toa: 'Tòa A5',
        ma_toa: 'A5',
        tang: 'Tầng 2',
        so_tang: 2,
        loai_phong: 'Phòng dịch vụ',
        suc_chua: 8,
        da_o: 5,
        si_so: '5/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '1.930.000 đ / năm',
        gia_so: 1930000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: [
          '/images/phong_thuc_te.jpg',
          '/images/rooms/phong-dich-vu.jpg',
        ],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công'],
        giuong_trong: ['G02', 'G04', 'G06'],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G03', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G04', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G05', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G06', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G07', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G08', trang_thai: 'DA_O', tang: 2 },
        ],
      },
      // Trang 2: Dữ liệu phong phú cho phân trang & bộ lọc
      {
        id: 'P12',
        ma_phong: 'P12',
        so_phong: 'P12',
        ten_phong: 'P12',
        toa: 'Tòa A1',
        ma_toa: 'A1',
        tang: 'Tầng 1',
        so_tang: 1,
        loai_phong: 'Phòng tiêu chuẩn',
        suc_chua: 8,
        da_o: 4,
        si_so: '4/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '1.760.000 đ / năm',
        gia_so: 1760000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: ['/images/phong_thuc_te.jpg', '/images/rooms/phong-tieu-chuan.jpg'],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công'],
        giuong_trong: ['G01', 'G03', 'G05', 'G07'],
        giuongs: [
          { ma: 'G01', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G02', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G03', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G04', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G05', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G06', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G07', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G08', trang_thai: 'DA_O', tang: 2 },
        ],
      },
      {
        id: 'P22',
        ma_phong: 'P22',
        so_phong: 'P22',
        ten_phong: 'P22',
        toa: 'Tòa A2',
        ma_toa: 'A2',
        tang: 'Tầng 2',
        so_tang: 2,
        loai_phong: 'Phòng dịch vụ',
        suc_chua: 6,
        da_o: 6,
        si_so: '6/6 người',
        so_nguoi_display: '6 người',
        gia_thue: '2.500.000 đ / năm',
        gia_so: 2500000,
        trang_thai: 'DA_DAY',
        trang_thai_label: 'Đã đầy',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: ['/images/phong_thuc_te.jpg', '/images/rooms/phong-dich-vu.jpg'],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công'],
        giuong_trong: [],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G03', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G04', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G05', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G06', trang_thai: 'DA_O', tang: 2 },
        ],
      },
      {
        id: 'P31',
        ma_phong: 'P31',
        so_phong: 'P31',
        ten_phong: 'P31',
        toa: 'Tòa A4',
        ma_toa: 'A4',
        tang: 'Tầng 3',
        so_tang: 3,
        loai_phong: 'Phòng dịch vụ',
        suc_chua: 4,
        da_o: 3,
        si_so: '3/4 người',
        so_nguoi_display: '4 người',
        gia_thue: '3.200.000 đ / năm',
        gia_so: 3200000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: ['/images/phong_thuc_te.jpg', '/images/rooms/phong-dich-vu.jpg'],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công', 'Tủ lạnh mini'],
        giuong_trong: ['G04'],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G03', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G04', trang_thai: 'TRONG', tang: 2 },
        ],
      },
      {
        id: 'P45',
        ma_phong: 'P45',
        so_phong: 'P45',
        ten_phong: 'P45',
        toa: 'Tòa A7',
        ma_toa: 'A7',
        tang: 'Tầng 4',
        so_tang: 4,
        loai_phong: 'Phòng tiêu chuẩn',
        suc_chua: 8,
        da_o: 7,
        si_so: '7/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '1.760.000 đ / năm',
        gia_so: 1760000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: ['/images/phong_thuc_te.jpg', '/images/rooms/phong-tieu-chuan.jpg'],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công'],
        giuong_trong: ['G05'],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G03', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G04', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G05', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G06', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G07', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G08', trang_thai: 'DA_O', tang: 2 },
        ],
      },
      {
        id: 'P62',
        ma_phong: 'P62',
        so_phong: 'P62',
        ten_phong: 'P62',
        toa: 'Tòa A19',
        ma_toa: 'A19',
        tang: 'Tầng 2',
        so_tang: 2,
        loai_phong: 'Phòng tiêu chuẩn',
        suc_chua: 8,
        da_o: 4,
        si_so: '4/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '1.760.000 đ / năm',
        gia_so: 1760000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: ['/images/phong_thuc_te.jpg', '/images/rooms/phong-tieu-chuan-2.jpg'],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Wifi tốc độ cao'],
        giuong_trong: ['G02', 'G04', 'G06', 'G08'],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G03', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G04', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G05', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G06', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G07', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G08', trang_thai: 'TRONG', tang: 2 },
        ],
      },
      {
        id: 'P73',
        ma_phong: 'P73',
        so_phong: 'P73',
        ten_phong: 'P73',
        toa: 'Tòa A5',
        ma_toa: 'A5',
        tang: 'Tầng 3',
        so_tang: 3,
        loai_phong: 'Phòng dịch vụ',
        suc_chua: 8,
        da_o: 6,
        si_so: '6/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '2.100.000 đ / năm',
        gia_so: 2100000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: ['/images/phong_thuc_te.jpg', '/images/rooms/phong-dich-vu.jpg'],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công'],
        giuong_trong: ['G03', 'G07'],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G03', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G04', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G05', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G06', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G07', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G08', trang_thai: 'DA_O', tang: 2 },
        ],
      },
      {
        id: 'P88',
        ma_phong: 'P88',
        so_phong: 'P88',
        ten_phong: 'P88',
        toa: 'Tòa A2',
        ma_toa: 'A2',
        tang: 'Tầng 4',
        so_tang: 4,
        loai_phong: 'Phòng tiêu chuẩn',
        suc_chua: 8,
        da_o: 8,
        si_so: '8/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '1.760.000 đ / năm',
        gia_so: 1760000,
        trang_thai: 'DA_DAY',
        trang_thai_label: 'Đã đầy',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: ['/images/phong_thuc_te.jpg', '/images/rooms/phong-tieu-chuan.jpg'],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công'],
        giuong_trong: [],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G03', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G04', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G05', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G06', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G07', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G08', trang_thai: 'DA_O', tang: 2 },
        ],
      },
      {
        id: 'P95',
        ma_phong: 'P95',
        so_phong: 'P95',
        ten_phong: 'P95',
        toa: 'Tòa A1',
        ma_toa: 'A1',
        tang: 'Tầng 2',
        so_tang: 2,
        loai_phong: 'Phòng dịch vụ',
        suc_chua: 8,
        da_o: 5,
        si_so: '5/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '1.930.000 đ / năm',
        gia_so: 1930000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: ['/images/phong_thuc_te.jpg', '/images/rooms/phong-dich-vu.jpg'],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công'],
        giuong_trong: ['G02', 'G04', 'G08'],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G03', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G04', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G05', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G06', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G07', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G08', trang_thai: 'TRONG', tang: 2 },
        ],
      },
      // Trang 3:
      {
        id: 'P102',
        ma_phong: 'P102',
        so_phong: 'P102',
        ten_phong: 'P102',
        toa: 'Tòa A19',
        ma_toa: 'A19',
        tang: 'Tầng 1',
        so_tang: 1,
        loai_phong: 'Phòng tiêu chuẩn',
        suc_chua: 8,
        da_o: 6,
        si_so: '6/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '1.760.000 đ / năm',
        gia_so: 1760000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: ['/images/phong_thuc_te.jpg', '/images/rooms/phong-tieu-chuan-2.jpg'],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học'],
        giuong_trong: ['G03', 'G06'],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G03', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G04', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G05', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G06', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G07', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G08', trang_thai: 'DA_O', tang: 2 },
        ],
      },
      {
        id: 'P115',
        ma_phong: 'P115',
        so_phong: 'P115',
        ten_phong: 'P115',
        toa: 'Tòa A4',
        ma_toa: 'A4',
        tang: 'Tầng 1',
        so_tang: 1,
        loai_phong: 'Phòng dịch vụ',
        suc_chua: 6,
        da_o: 4,
        si_so: '4/6 người',
        so_nguoi_display: '6 người',
        gia_thue: '2.400.000 đ / năm',
        gia_so: 2400000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: ['/images/phong_thuc_te.jpg', '/images/rooms/phong-dich-vu.jpg'],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công'],
        giuong_trong: ['G02', 'G05'],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G03', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G04', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G05', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G06', trang_thai: 'DA_O', tang: 2 },
        ],
      },
      {
        id: 'P120',
        ma_phong: 'P120',
        so_phong: 'P120',
        ten_phong: 'P120',
        toa: 'Tòa A7',
        ma_toa: 'A7',
        tang: 'Tầng 3',
        so_tang: 3,
        loai_phong: 'Phòng tiêu chuẩn',
        suc_chua: 8,
        da_o: 8,
        si_so: '8/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '1.760.000 đ / năm',
        gia_so: 1760000,
        trang_thai: 'DA_DAY',
        trang_thai_label: 'Đã đầy',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: ['/images/phong_thuc_te.jpg', '/images/rooms/phong-tieu-chuan.jpg'],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công'],
        giuong_trong: [],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G03', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G04', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G05', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G06', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G07', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G08', trang_thai: 'DA_O', tang: 2 },
        ],
      },
      {
        id: 'P135',
        ma_phong: 'P135',
        so_phong: 'P135',
        ten_phong: 'P135',
        toa: 'Tòa A5',
        ma_toa: 'A5',
        tang: 'Tầng 1',
        so_tang: 1,
        loai_phong: 'Phòng dịch vụ',
        suc_chua: 6,
        da_o: 3,
        si_so: '3/6 người',
        so_nguoi_display: '6 người',
        gia_thue: '2.200.000 đ / năm',
        gia_so: 2200000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: ['/images/phong_thuc_te.jpg', '/images/rooms/phong-dich-vu.jpg'],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công'],
        giuong_trong: ['G01', 'G03', 'G06'],
        giuongs: [
          { ma: 'G01', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G02', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G03', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G04', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G05', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G06', trang_thai: 'TRONG', tang: 2 },
        ],
      },
      {
        id: 'P142',
        ma_phong: 'P142',
        so_phong: 'P142',
        ten_phong: 'P142',
        toa: 'Tòa A2',
        ma_toa: 'A2',
        tang: 'Tầng 1',
        so_tang: 1,
        loai_phong: 'Phòng tiêu chuẩn',
        suc_chua: 8,
        da_o: 5,
        si_so: '5/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '1.760.000 đ / năm',
        gia_so: 1760000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: ['/images/phong_thuc_te.jpg', '/images/rooms/phong-tieu-chuan.jpg'],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công'],
        giuong_trong: ['G02', 'G05', 'G08'],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G03', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G04', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G05', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G06', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G07', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G08', trang_thai: 'TRONG', tang: 2 },
        ],
      },
      {
        id: 'P156',
        ma_phong: 'P156',
        so_phong: 'P156',
        ten_phong: 'P156',
        toa: 'Tòa A1',
        ma_toa: 'A1',
        tang: 'Tầng 4',
        so_tang: 4,
        loai_phong: 'Phòng dịch vụ',
        suc_chua: 4,
        da_o: 4,
        si_so: '4/4 người',
        so_nguoi_display: '4 người',
        gia_thue: '3.500.000 đ / năm',
        gia_so: 3500000,
        trang_thai: 'DA_DAY',
        trang_thai_label: 'Đã đầy',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: ['/images/phong_thuc_te.jpg', '/images/rooms/phong-dich-vu.jpg'],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công', 'Tủ lạnh mini'],
        giuong_trong: [],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G03', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G04', trang_thai: 'DA_O', tang: 2 },
        ],
      },
      {
        id: 'P168',
        ma_phong: 'P168',
        so_phong: 'P168',
        ten_phong: 'P168',
        toa: 'Tòa A19',
        ma_toa: 'A19',
        tang: 'Tầng 3',
        so_tang: 3,
        loai_phong: 'Phòng tiêu chuẩn',
        suc_chua: 8,
        da_o: 6,
        si_so: '6/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '1.760.000 đ / năm',
        gia_so: 1760000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: ['/images/phong_thuc_te.jpg', '/images/rooms/phong-tieu-chuan-2.jpg'],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Wifi tốc độ cao'],
        giuong_trong: ['G01', 'G04'],
        giuongs: [
          { ma: 'G01', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G02', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G03', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G04', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G05', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G06', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G07', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G08', trang_thai: 'DA_O', tang: 2 },
        ],
      },
      {
        id: 'P175',
        ma_phong: 'P175',
        so_phong: 'P175',
        ten_phong: 'P175',
        toa: 'Tòa A7',
        ma_toa: 'A7',
        tang: 'Tầng 1',
        so_tang: 1,
        loai_phong: 'Phòng dịch vụ',
        suc_chua: 8,
        da_o: 4,
        si_so: '4/8 người',
        so_nguoi_display: '8 người',
        gia_thue: '2.750.000 đ / năm',
        gia_so: 2750000,
        trang_thai: 'CON_CHO',
        trang_thai_label: 'Còn chỗ',
        hinh_anh: '/images/phong_thuc_te.jpg',
        images: ['/images/phong_thuc_te.jpg', '/images/rooms/phong-dich-vu.jpg'],
        tien_ich: ['Điều hòa', 'Nóng lạnh', 'Tủ đồ cá nhân', 'Bàn học', 'Ban công', 'Tủ lạnh mini'],
        giuong_trong: ['G03', 'G05', 'G07', 'G08'],
        giuongs: [
          { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
          { ma: 'G02', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G03', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G04', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G05', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G06', trang_thai: 'DA_O', tang: 2 },
          { ma: 'G07', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G08', trang_thai: 'TRONG', tang: 2 },
        ],
      },
    ];
  },

  /**
   * Sinh viên gửi đơn đăng ký chỗ ở
   * -> Lưu trực tiếp vào kho lưu trữ để Quản lý tiếp nhận ngay lập tức!
   */
  registerRoom: async (registrationData) => {
    const newId = `DK-${Date.now().toString().slice(-4)}`;

    // Xác định gợi ý phòng/giường chuẩn theo nguyện vọng phòng từ CSDL
    const buildingKey = registrationData.ma_toa || (registrationData.nguyen_vong_phong?.startsWith('B') ? 'B1' : 'A1');
    const roomKey = registrationData.nguyen_vong_phong || 'A1_P101';

    // Chuẩn bị nguyện vọng hiển thị
    const wishParts = [
      registrationData.loai_phong,
      registrationData.tang_mong_muon,
      registrationData.muc_gia_mong_muon,
    ].filter(Boolean);

    const wishSummary =
      registrationData.nguyen_vong ||
      (wishParts.length > 0 ? wishParts.join(' - ') : 'Phòng tiêu chuẩn');

    // Chuẩn bị bản ghi đơn hoàn chỉnh
    const newRequest = {
      id: newId,
      ma_yeu_cau: newId,
      msv: registrationData.msv || 'B21DCCN001',
      ho_ten: registrationData.ho_ten || 'Sinh viên',
      gioi_tinh: registrationData.gioi_tinh || 'Nam',
      ngay_sinh: registrationData.ngay_sinh || '',
      cccd: registrationData.cccd || '',
      so_dien_thoai: registrationData.so_dien_thoai || '',
      email: registrationData.email || `${(registrationData.msv || 'sv').toLowerCase()}@ictu.edu.vn`,
      khoa: registrationData.khoa || '',
      lop: registrationData.lop || '',
      dia_chi: registrationData.dia_chi || '',
      doi_tuong_uu_tien: registrationData.doi_tuong_uu_tien || 'Không thuộc diện ưu tiên',
      nguoi_giam_ho: registrationData.nguoi_giam_ho || '',
      moi_quan_he: registrationData.moi_quan_he || '',
      sdt_nguoi_giam_ho: registrationData.sdt_nguoi_giam_ho || '',
      loai_phong: registrationData.loai_phong || '',
      tang_mong_muon: registrationData.tang_mong_muon || '',
      muc_gia_mong_muon: registrationData.muc_gia_mong_muon || '',
      nguyen_vong: wishSummary,
      nguyen_vong_label: wishSummary,
      nguyen_vong_phong: registrationData.nguyen_vong_phong || '',
      ngay_gui: new Date().toISOString(),
      trang_thai: 'CHO_DUYET',
      goi_y: {
        ma_toa: buildingKey,
        ma_phong: roomKey,
        ma_giuong: 'G01',
      },
    };

    // 1. Lưu ngay vào LocalStorage (Đưa lên đầu danh sách để Quản lý thấy ngay lập tức)
    const currentList = getLocalRequests();
    const updatedList = [newRequest, ...currentList.filter((r) => r.id !== newId && r.msv !== newRequest.msv)];
    saveLocalRequests(updatedList);

    // 2. Gửi lên backend API nếu backend đang online
    try {
      const res = await api.post('/student/requests/register', {
        ...newRequest,
        xac_nhan: true,
      });
      if (res.data?.data) {
        return res.data;
      }
    } catch (err) {
      console.warn('Backend POST /student/requests/register offline, using local response:', err);
    }

    return {
      status: 'success',
      message: 'Gửi yêu cầu đăng ký phòng thành công',
      data: newRequest,
    };
  },

  /**
   * Hủy yêu cầu đăng ký phòng
   */
  cancelRegistrationRequest: async (id) => {
    const cleanId = (id || '').trim();
    const all = getLocalRequests();
    const updated = all.map((r) => {
      if (
        r.id?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.replace('#', '').toLowerCase() === cleanId.replace('#', '').toLowerCase()
      ) {
        return {
          ...r,
          trang_thai: 'DA_HUY',
          trang_thai_label: 'Đã hủy',
        };
      }
      return r;
    });
    saveLocalRequests(updated);
    window.dispatchEvent(new Event('occupancy-updated'));
    return { status: 'success', message: 'Hủy đơn thành công' };
  },

  /**
   * Cập nhật thông tin nguyện vọng phòng
   */
  updateRegistrationWish: async (id, updatedWish) => {
    const cleanId = (id || '').trim();
    const all = getLocalRequests();
    const updated = all.map((r) => {
      if (
        r.id?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.replace('#', '').toLowerCase() === cleanId.replace('#', '').toLowerCase()
      ) {
        return {
          ...r,
          ...updatedWish,
        };
      }
      return r;
    });
    saveLocalRequests(updated);
    window.dispatchEvent(new Event('occupancy-updated'));
    return { status: 'success', message: 'Cập nhật nguyện vọng thành công' };
  },

  /**
   * Quản lý lấy danh sách TẤT CẢ các đơn đăng ký, chuyển phòng và trả phòng đang chờ xử lý
   */
  getAllRequests: async () => {
    let apiRequests = [];
    try {
      const res = await api.get('/admin/occupancy/requests');
      if (Array.isArray(res.data)) {
        apiRequests = res.data;
      }
    } catch (err) {
      console.warn('Backend GET /admin/occupancy/requests offline, using local store:', err);
    }

    const localRegistration = getLocalRequests();
    const localTransferCheckout = getLocalTransferCheckoutRequests();
    const combinedMap = new Map();

    // 1. Đưa đơn từ API vào trước
    apiRequests.forEach((req) => {
      const key = req.id || req.ma_yeu_cau || req.msv;
      combinedMap.set(key, req);
    });

    // 2. Đưa đơn đăng ký từ LocalStorage vào
    localRegistration.forEach((req) => {
      const key = req.id || req.ma_yeu_cau || req.msv;
      combinedMap.set(key, {
        loai_don: 'DANG_KY',
        loai_yeu_cau: 'Đăng ký phòng',
        ...(combinedMap.get(key) || {}),
        ...req,
      });
    });

    // 3. Đưa đơn chuyển phòng và trả phòng từ LocalStorage vào
    localTransferCheckout.forEach((req) => {
      const key = req.id || req.ma_yeu_cau;
      combinedMap.set(key, {
        loai_don: req.loai_don || (req.loai_yeu_cau === 'Trả phòng' ? 'TRA_PHONG' : 'CHUYEN_PHONG'),
        ...(combinedMap.get(key) || {}),
        ...req,
      });
    });

    const results = Array.from(combinedMap.values());
    return results.length > 0 ? results : DEFAULT_REQUESTS;
  },

  /**
   * Quản lý lấy chi tiết một đơn theo ID hoặc MSV (hỗ trợ cả Đăng ký, Chuyển phòng & Trả phòng)
   */
  getRequestDetail: async (id) => {
    const cleanId = (id || '').trim();

    // 1. Thử gọi backend API
    try {
      const res = await api.get(`/admin/occupancy/requests/${encodeURIComponent(cleanId)}`);
      if (res.data) {
        return res.data;
      }
    } catch (err) {
      console.warn(`Backend GET /admin/occupancy/requests/${cleanId} offline:`, err);
    }

    // 2. Tìm trong danh sách chuyển phòng & trả phòng trước
    const transferReqs = getLocalTransferCheckoutRequests();
    const foundTransfer = transferReqs.find(
      (r) =>
        r.id?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.replace('#', '').toLowerCase() === cleanId.replace('#', '').toLowerCase() ||
        r.msv?.toLowerCase() === cleanId.toLowerCase()
    );
    if (foundTransfer) {
      return foundTransfer;
    }

    // 3. Tìm trong danh sách đăng ký phòng
    const allReg = getLocalRequests();
    const foundReg = allReg.find(
      (r) =>
        r.id?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.toLowerCase() === cleanId.toLowerCase() ||
        r.msv?.toLowerCase() === cleanId.toLowerCase()
    );
    if (foundReg) {
      return foundReg;
    }

    // 4. Fallback dữ liệu chuẩn theo thiết kế Figma
    return {
      id: cleanId,
      ma_yeu_cau: cleanId.startsWith('#') ? cleanId : `#${cleanId}`,
      msv: 'DTC245180051',
      ho_ten: 'Nguyễn Quốc Huy',
      gioi_tinh: 'Nam',
      khoa: 'Công nghệ thông tin',
      lop: 'DTC-K20',
      vi_tri_hien_tai: 'Phòng A102 - Giường G01',
      cong_no: 'Đã hoàn thành toàn bộ phí',
      ly_do: 'Em muốn chuyển sang phòng A305 để cùng phòng với các bạn cùng nhóm đồ án môn học...',
      mo_ta: 'Em muốn chuyển sang phòng A305 để cùng phòng với các bạn cùng nhóm đồ án môn học...',
      phong_mong_muon: 'P203 - Tòa A - Tầng 2',
      dia_chi_sau_tra: 'Số 123 Đường Cầu Giấy, Quận Cầu Giấy, Hà Nội',
      dia_chi_chi_tiet: {
        tinh: 'Hà Nội',
        huyen: 'Quận Cầu Giấy',
        so_nha: 'Số 123 Đường Cầu Giấy',
      },
      trang_thai: 'CHO_DUYET',
      trang_thai_label: 'Chờ duyệt',
      goi_y: {
        ma_toa: 'A',
        ma_phong: 'A203',
        ma_giuong: 'G04',
      },
    };
  },


  /**
   * Lấy danh sách cây Tòa -> Phòng -> Giường trống cho 3 dropdown
   */
  getAvailableBeds: async (params = {}) => {
    try {
      const res = await api.get('/admin/occupancy/available-beds', { params });
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch (err) {
      console.warn('GET /admin/occupancy/available-beds failed, using default tree:', err);
    }

    return [
      {
        ma_toa: 'A1',
        ten_toa: 'Tòa A1',
        gioi_tinh: 'Nam & Nữ',
        rooms: [
          {
            ma_phong: 'A1_P101',
            so_phong: '101',
            label: 'Phòng 101 (4 chỗ trống)',
            beds: [
              { ma_giuong: 'A1_P101_G01', label: 'Giường 01' },
              { ma_giuong: 'A1_P101_G02', label: 'Giường 02' },
              { ma_giuong: 'A1_P101_G03', label: 'Giường 03' },
              { ma_giuong: 'A1_P101_G04', label: 'Giường 04' },
            ],
          },
          {
            ma_phong: 'A1_P102',
            so_phong: '102',
            label: 'Phòng 102 (1 chỗ trống)',
            beds: [
              { ma_giuong: 'A1_P102_G04', label: 'Giường 04' },
            ],
          },
          {
            ma_phong: 'A1_P103',
            so_phong: '103',
            label: 'Phòng 103 (2 chỗ trống)',
            beds: [
              { ma_giuong: 'A1_P103_G01', label: 'Giường 01' },
              { ma_giuong: 'A1_P103_G02', label: 'Giường 02' },
            ],
          },
          {
            ma_phong: 'A1_T1_P104',
            so_phong: '104',
            label: 'Phòng 104 (4 chỗ trống)',
            beds: [
              { ma_giuong: 'A1_T1_P104_G01', label: 'Giường 01' },
              { ma_giuong: 'A1_T1_P104_G02', label: 'Giường 02' },
            ],
          },
          {
            ma_phong: 'A1_T2_P201',
            so_phong: '201',
            label: 'Phòng 201 (4 chỗ trống)',
            beds: [
              { ma_giuong: 'A1_T2_P201_G01', label: 'Giường 01' },
              { ma_giuong: 'A1_T2_P201_G02', label: 'Giường 02' },
            ],
          },
        ],
      },
      {
        ma_toa: 'A2',
        ten_toa: 'Tòa A2',
        gioi_tinh: 'Nam & Nữ',
        rooms: [
          {
            ma_phong: 'A2_T1_P101',
            so_phong: '101',
            label: 'Phòng 101 (3 chỗ trống)',
            beds: [
              { ma_giuong: 'A2_T1_P101_G01', label: 'Giường 01' },
              { ma_giuong: 'A2_T1_P101_G02', label: 'Giường 02' },
            ],
          },
        ],
      },
      {
        ma_toa: 'B1',
        ten_toa: 'Tòa B1',
        gioi_tinh: 'Nam & Nữ',
        rooms: [
          {
            ma_phong: 'B1_T1_P101',
            so_phong: '101',
            label: 'Phòng 101 (2 chỗ trống)',
            beds: [
              { ma_giuong: 'B1_T1_P101_G01', label: 'Giường 01' },
              { ma_giuong: 'B1_T1_P101_G02', label: 'Giường 02' },
            ],
          },
        ],
      },
    ];
  },

  /**
   * Quản lý phê duyệt đơn đăng ký & xếp phòng
   */
  approveRequest: async (id, payload) => {
    const yy = new Date().getFullYear().toString().slice(-2);
    const toa = payload.ma_toa || 'A';
    const phong = (payload.phong_id || 'A203').replace('Phòng ', '').replace('P', '');
    const giuong = (payload.giuong_id || 'G04').replace('Giường ', '');
    const contractCode = `HD${yy}-${toa}${phong}-G${giuong}`;

    // Cập nhật trạng thái trong LocalStorage
    const all = getLocalRequests();
    const updated = all.map((r) => {
      if (r.id === id || r.ma_yeu_cau === id || r.msv === id) {
        return {
          ...r,
          trang_thai: 'DA_DUYET',
          ma_hop_dong: contractCode,
          xep_phong: {
            ma_toa: toa,
            ma_phong: payload.phong_id,
            ma_giuong: payload.giuong_id,
          },
        };
      }
      return r;
    });
    saveLocalRequests(updated);

    // Gửi lên backend
    try {
      const res = await api.put(`/admin/occupancy/requests/${encodeURIComponent(id)}/approve`, payload);
      if (res.data) return res.data;
    } catch (err) {
      console.warn('Backend PUT approve offline, using local updated response:', err);
    }

    return {
      status: 'success',
      message: 'Phê duyệt và xếp phòng thành công',
      data: {
        ma_hop_dong: contractCode,
        request_id: id,
        trang_thai: 'DA_DUYET',
        ...payload,
      },
    };
  },

  /**
   * Quản lý từ chối đơn đăng ký
   */
  rejectRequest: async (id, payload) => {
    // Cập nhật trạng thái trong LocalStorage
    const all = getLocalRequests();
    const updated = all.map((r) => {
      if (r.id === id || r.ma_yeu_cau === id || r.msv === id) {
        return {
          ...r,
          trang_thai: 'TU_CHOI',
          ly_do_tu_choi: payload.ly_do_tu_choi,
        };
      }
      return r;
    });
    saveLocalRequests(updated);

    // Gửi lên backend
    try {
      const res = await api.put(`/admin/occupancy/requests/${encodeURIComponent(id)}/reject`, payload);
      if (res.data) return res.data;
    } catch (err) {
      console.warn('Backend PUT reject offline, using local updated response:', err);
    }

    return {
      status: 'success',
      message: 'Đã từ chối đơn đăng ký thành công',
      data: {
        request_id: id,
        trang_thai: 'TU_CHOI',
        ...payload,
      },
    };
  },

  getCurrentStudentInfo: async () => {
    return null;
  },

  /**
   * Lấy thông tin phòng hiện tại của sinh viên
   */
  getCurrentRoomInfo: async () => {
    return getLocalCurrentRoomInfo();
  },

  /**
   * Sinh viên gửi đơn xin chuyển phòng
   */
  submitTransferRequest: async (data) => {
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    const all = getLocalTransferCheckoutRequests();
    const nextNum = all.length + 231;
    const reqId = `YC-${String(nextNum).padStart(4, '0')}`;

    const targetRoom = data.phong_mong_muon || 'P36 - Tòa A3 - Tầng 3';
    const targetShort = targetRoom.includes(' - ') ? targetRoom.split(' - ')[0] : targetRoom;
    const currentShort = data.phong_hien_tai || 'P36';

    const newReq = {
      id: reqId,
      ma_yeu_cau: `#${reqId}`,
      loai_yeu_cau: 'Chuyển phòng',
      loai_don: 'CHUYEN_PHONG',
      msv: data.msv || 'DTC245180051',
      ho_ten: data.ho_ten || 'Nguyễn Quốc Huy',
      gioi_tinh: data.gioi_tinh || 'Nam',
      khoa: 'Công nghệ thông tin',
      lop: 'DTC-K20',
      vi_tri_hien_tai: data.vi_tri_hien_tai || 'Phòng A102 - Giường G01',
      cong_no: 'Đã hoàn thành toàn bộ phí',
      ngay_gui: dateStr,
      phong_lien_quan: `${currentShort} → ${targetShort}`,
      phong_hien_tai: currentShort,
      phong_dich: targetRoom,
      ly_do: data.ly_do || 'Phòng hiện tại quá tải',
      ngay_mong_muon: data.ngay_mong_muon || '',
      mo_ta: data.mo_ta_chi_tiet || data.mo_ta || 'Em muốn chuyển sang phòng A305 để cùng phòng với các bạn cùng nhóm đồ án môn học...',
      trang_thai: 'CHO_DUYET',
      trang_thai_label: 'Chờ duyệt',
      goi_y: {
        ma_toa: 'A',
        ma_phong: 'A203',
        ma_giuong: 'G04',
      },
      created_at: new Date().toISOString(),
    };

    // Lưu ngay vào LocalStorage
    const updated = [newReq, ...all];
    saveLocalTransferCheckoutRequests(updated);

    // Kích hoạt event cập nhật
    window.dispatchEvent(new Event('occupancy-updated'));

    // Gửi lên Backend nếu backend online
    try {
      const res = await api.post('/student/requests/transfer', {
        msv: newReq.msv,
        ho_ten: newReq.ho_ten,
        phong_hien_tai: currentShort,
        ly_do: data.ly_do,
        ngay_mong_muon: data.ngay_mong_muon,
        phong_mong_muon: targetRoom,
        mo_ta_chi_tiet: newReq.mo_ta,
      });
      if (res.data?.data) {
        return res.data;
      }
    } catch (err) {
      console.warn('Backend POST /student/requests/transfer offline, using local response:', err);
    }

    return {
      status: 'success',
      message: 'Gửi yêu cầu chuyển phòng thành công',
      data: newReq,
    };
  },

  /**
   * Sinh viên gửi đơn xin trả phòng
   */
  submitCheckoutRequest: async (data) => {
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    const all = getLocalTransferCheckoutRequests();
    const nextNum = all.length + 231;
    const reqId = `YC-${String(nextNum).padStart(4, '0')}`;
    const currentShort = data.phong_hien_tai || 'P36';

    const newReq = {
      id: reqId,
      ma_yeu_cau: `#${reqId}`,
      loai_yeu_cau: 'Trả phòng',
      loai_don: 'TRA_PHONG',
      msv: data.msv || 'DTC245180051',
      ho_ten: data.ho_ten || 'Nguyễn Quốc Huy',
      gioi_tinh: data.gioi_tinh || 'Nam',
      khoa: 'Công nghệ thông tin',
      lop: 'DTC-K20',
      vi_tri_hien_tai: data.vi_tri_hien_tai || 'Phòng A102 - Giường G01',
      cong_no: 'Đã hoàn thành toàn bộ phí',
      ngay_gui: dateStr,
      phong_lien_quan: currentShort,
      phong_hien_tai: currentShort,
      ly_do: data.ly_do || 'Đã tốt nghiệp',
      ngay_mong_muon: data.ngay_mong_muon || '',
      dia_chi_sau_tra: data.dia_chi_lien_he || 'Số 123 Đường Cầu Giấy, Quận Cầu Giấy, Hà Nội',
      dia_chi_chi_tiet: data.dia_chi_chi_tiet || {
        tinh: 'Hà Nội',
        huyen: 'Quận Cầu Giấy',
        so_nha: 'Số 123 Đường Cầu Giấy',
      },
      mo_ta: data.mo_ta_chi_tiet || data.mo_ta || 'Em muốn chuyển sang phòng A305 để cùng phòng với các bạn cùng nhóm đồ án môn học...',
      trang_thai: 'CHO_DUYET',
      trang_thai_label: 'Chờ duyệt',
      created_at: new Date().toISOString(),
    };

    // Lưu ngay vào LocalStorage
    const updated = [newReq, ...all];
    saveLocalTransferCheckoutRequests(updated);

    // Kích hoạt event cập nhật
    window.dispatchEvent(new Event('occupancy-updated'));

    // Gửi lên Backend nếu backend online
    try {
      const res = await api.post('/student/requests/checkout', {
        msv: newReq.msv,
        ho_ten: newReq.ho_ten,
        phong_hien_tai: currentShort,
        ly_do: data.ly_do,
        ngay_mong_muon: data.ngay_mong_muon,
        dia_chi_lien_he: data.dia_chi_lien_he,
        mo_ta_chi_tiet: newReq.mo_ta,
      });
      if (res.data?.data) {
        return res.data;
      }
    } catch (err) {
      console.warn('Backend POST /student/requests/checkout offline, using local response:', err);
    }

    return {
      status: 'success',
      message: 'Gửi yêu cầu trả phòng thành công',
      data: newReq,
    };
  },

  /**
   * Lấy danh sách lịch sử yêu cầu chuyển / trả phòng
   */
  getTransferCheckoutRequests: async () => {
    try {
      const res = await api.get('/student/requests/transfer-checkout-history');
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch (err) {
      console.warn('Backend GET /student/requests/transfer-checkout-history offline, using local store:', err);
    }

    return getLocalTransferCheckoutRequests();
  },

  getMyRequests: async () => {
    return getLocalRequests();
  },

  getMyContracts: async () => {
    return getLocalStayContracts();
  },

  getCurrentRoomInfo: async () => {
    return getLocalCurrentRoomInfo();
  },

  getStudentProfile: async () => {
    return getLocalStudentProfile();
  },

  updateStudentProfile: async (updatedData) => {
    const current = getLocalStudentProfile();
    const merged = { ...current, ...updatedData };
    saveLocalStudentProfile(merged);
    window.dispatchEvent(new Event('occupancy-updated'));
    return {
      status: 'success',
      message: 'Cập nhật thông tin thành công!',
      data: merged,
    };
  },

  /**
   * Quản lý phê duyệt Yêu cầu chuyển phòng & Xếp chỗ mới
   */
  approveTransferRequest: async (id, payload) => {
    const cleanId = (id || '').trim();
    const toa = payload.ma_toa || 'A';
    const toaLabel = toa.startsWith('Tòa') ? toa : `Tòa ${toa}`;
    const phong = payload.phong_id || 'A203';
    const phongClean = phong.replace('Phòng ', '');
    const phongLabel = phongClean.startsWith('P') ? phongClean : `P${phongClean}`;
    const giuong = payload.giuong_id || 'G04';
    const giuongClean = giuong.replace('Giường ', '');
    const contractCode = `HD26-${toa.replace(/\D/g, '') || toa}${phongClean}-G${giuongClean}`;

    // 1. Cập nhật trạng thái đơn trong danh sách chuyển/trả phòng
    const all = getLocalTransferCheckoutRequests();
    const updated = all.map((r) => {
      if (
        r.id?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.replace('#', '').toLowerCase() === cleanId.replace('#', '').toLowerCase()
      ) {
        return {
          ...r,
          trang_thai: 'DA_DUYET',
          trang_thai_label: 'Đã duyệt',
          xep_phong: {
            ma_toa: toa,
            ma_phong: phong,
            ma_giuong: giuong,
          },
        };
      }
      return r;
    });
    saveLocalTransferCheckoutRequests(updated);

    // 2. CẬP NHẬT BANNER PHÒNG HIỆN TẠI (Tự động chuyển sang phòng mới P203 - Tòa A - Tầng 2)
    const newRoomInfo = {
      phong_hien_tai: `${phongLabel} – ${toaLabel} – Tầng 2`,
      thanh_vien: '4/8 người',
      thoi_gian_luu_tru: '09/2026 – Nay',
      so_phong: phongLabel,
      toa: toaLabel,
      tang: '2',
      so_thanh_vien: 4,
      suc_chua: 8,
      vi_tri_hien_tai: `Phòng ${phongClean} - Giường ${giuongClean}`,
      trang_thai: 'DANG_O',
    };
    saveLocalCurrentRoomInfo(newRoomInfo);

    // 3. CẬP NHẬT BẢNG LỊCH SỬ Ở (Thêm hợp đồng/dòng lưu trú mới Đang ở)
    const contracts = getLocalStayContracts();
    const closedContracts = contracts.map((c) => ({
      ...c,
      trang_thai: 'DA_CHUYEN',
      trang_thai_label: 'Đã chuyển phòng',
    }));
    const newContract = {
      id: contractCode,
      ma_hop_dong: contractCode,
      phong: phongLabel,
      toa: toaLabel.replace('Tòa ', ''),
      tang: '2',
      giuong: giuongClean,
      thoi_gian_o: '2026-2027',
      nam_hoc: '2026-2027',
      trang_thai: 'DANG_O',
      trang_thai_label: 'Đang ở',
    };
    saveLocalStayContracts([newContract, ...closedContracts]);

    // Bắn sự kiện cập nhật thời gian thực
    window.dispatchEvent(new Event('occupancy-updated'));

    // Gửi lên backend nếu online
    try {
      await api.put(`/admin/occupancy/requests/transfer/${encodeURIComponent(cleanId)}/approve`, payload);
    } catch (err) {
      console.warn('Backend PUT transfer approve offline, using local store:', err);
    }

    return {
      status: 'success',
      message: 'Phê duyệt chuyển phòng và xếp chỗ thành công!',
      data: {
        id: cleanId,
        trang_thai: 'DA_DUYET',
        room: newRoomInfo,
      },
    };
  },

  /**
   * Quản lý từ chối Yêu cầu chuyển phòng
   */
  rejectTransferRequest: async (id, payload = {}) => {
    const cleanId = (id || '').trim();
    const all = getLocalTransferCheckoutRequests();
    const updated = all.map((r) => {
      if (
        r.id?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.replace('#', '').toLowerCase() === cleanId.replace('#', '').toLowerCase()
      ) {
        return {
          ...r,
          trang_thai: 'TU_CHOI',
          trang_thai_label: 'Từ chối',
          ly_do_tu_choi: payload.ly_do_tu_choi || 'Không đáp ứng điều kiện chuyển phòng',
        };
      }
      return r;
    });
    saveLocalTransferCheckoutRequests(updated);

    window.dispatchEvent(new Event('occupancy-updated'));

    try {
      await api.put(`/admin/occupancy/requests/transfer/${encodeURIComponent(cleanId)}/reject`, payload);
    } catch (err) {
      console.warn('Backend PUT transfer reject offline, using local store:', err);
    }

    return {
      status: 'success',
      message: 'Đã từ chối yêu cầu chuyển phòng.',
    };
  },

  /**
   * Quản lý phê duyệt Yêu cầu trả phòng
   */
  approveCheckoutRequest: async (id, payload = {}) => {
    const cleanId = (id || '').trim();

    // 1. Cập nhật trạng thái đơn thành DA_DUYET
    const all = getLocalTransferCheckoutRequests();
    const updated = all.map((r) => {
      if (
        r.id?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.replace('#', '').toLowerCase() === cleanId.replace('#', '').toLowerCase()
      ) {
        return {
          ...r,
          trang_thai: 'DA_DUYET',
          trang_thai_label: 'Đã duyệt',
        };
      }
      return r;
    });
    saveLocalTransferCheckoutRequests(updated);

    // 2. CẬP NHẬT BANNER PHÒNG HIỆN TẠI (Chuyển về trạng thái Đã kết thúc lưu trú / Chưa có phòng)
    const checkoutRoomInfo = {
      phong_hien_tai: 'Đã kết thúc lưu trú / Chưa có phòng',
      thanh_vien: '0 người',
      thoi_gian_luu_tru: 'Đã hoàn tất trả phòng',
      so_phong: 'Chưa có phòng',
      toa: '--',
      tang: '--',
      so_thanh_vien: 0,
      suc_chua: 0,
      vi_tri_hien_tai: 'Đã hoàn tất thủ tục trả phòng',
      trang_thai: 'DA_TRA_PHONG',
    };
    saveLocalCurrentRoomInfo(checkoutRoomInfo);

    // 3. CẬP NHẬT BẢNG LỊCH SỬ Ở: Toàn bộ dòng lưu trú chuyển trạng thái thành "Đã trả phòng / Đã rời KTX"
    const contracts = getLocalStayContracts();
    const updatedContracts = contracts.map((c) => ({
      ...c,
      trang_thai: 'DA_TRA_PHONG',
      trang_thai_label: 'Đã trả phòng / Đã rời KTX',
    }));
    saveLocalStayContracts(updatedContracts);

    window.dispatchEvent(new Event('occupancy-updated'));

    try {
      await api.put(`/admin/occupancy/requests/checkout/${encodeURIComponent(cleanId)}/approve`, payload);
    } catch (err) {
      console.warn('Backend PUT checkout approve offline, using local store:', err);
    }

    return {
      status: 'success',
      message: 'Phê duyệt yêu cầu trả phòng thành công!',
    };
  },

  /**
   * Quản lý từ chối Yêu cầu trả phòng
   */
  rejectCheckoutRequest: async (id, payload = {}) => {
    const cleanId = (id || '').trim();
    const all = getLocalTransferCheckoutRequests();
    const updated = all.map((r) => {
      if (
        r.id?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.replace('#', '').toLowerCase() === cleanId.replace('#', '').toLowerCase()
      ) {
        return {
          ...r,
          trang_thai: 'TU_CHOI',
          trang_thai_label: 'Từ chối',
          ly_do_tu_choi: payload.ly_do_tu_choi || 'Chưa hoàn tất công nợ hoặc thủ tục bàn giao tài sản',
        };
      }
      return r;
    });
    saveLocalTransferCheckoutRequests(updated);

    window.dispatchEvent(new Event('occupancy-updated'));

    try {
      await api.put(`/admin/occupancy/requests/checkout/${encodeURIComponent(cleanId)}/reject`, payload);
    } catch (err) {
      console.warn('Backend PUT checkout reject offline, using local store:', err);
    }

    return {
      status: 'success',
      message: 'Đã từ chối yêu cầu trả phòng.',
    };
  },
};

export default occupancyService;


