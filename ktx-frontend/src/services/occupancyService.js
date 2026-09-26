import api, { dormService } from './api';

const STORAGE_KEY = 'dorm_registration_requests';

// Dữ liệu mẫu ban đầu để luôn có sẵn dữ liệu chuẩn bị kiểm thử
const DEFAULT_REQUESTS = [
  {
    id: 'DK-001',
    ma_yeu_cau: 'DK-001',
    msv: 'B21DCCN001',
    ho_ten: 'Nguyễn Văn A',
    gioi_tinh: 'Nam',
    ngay_sinh: '2003-05-15',
    cccd: '001203004567',
    so_dien_thoai: '0987654321',
    email: 'nguyenvana@ictu.edu.vn',
    khoa: 'Công nghệ thông tin',
    lop: 'D21CQCN01-B',
    dia_chi: 'Số 123 Đường Cầu Giấy, Hà Nội',
    doi_tuong_uu_tien: 'Không thuộc diện ưu tiên',
    nguoi_giam_ho: 'Nguyễn Văn B',
    moi_quan_he: 'Bố',
    sdt_nguoi_giam_ho: '0912345678',
    nguyen_vong: 'Xin hãy xếp cho em 1 phòng nào đó ở tòa A với ạ 🥹',
    nguyen_vong_phong: 'P36',
    nguyen_vong_label: 'P36 - Tầng 3 - Tòa A2',
    ngay_gui: '2026-09-26T15:00:00',
    trang_thai: 'CHO_DUYET',
    goi_y: {
      ma_toa: 'A',
      ma_phong: 'A203',
      ma_giuong: 'G04',
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
   * Quản lý lấy danh sách TẤT CẢ các đơn đăng ký đang chờ xử lý
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

    // Kết hợp thông minh giữa API và LocalStorage
    const localRequests = getLocalRequests();
    const combinedMap = new Map();

    // Đưa đơn từ API vào trước
    apiRequests.forEach((req) => {
      const key = req.id || req.ma_yeu_cau || req.msv;
      combinedMap.set(key, req);
    });

    // Đưa đơn từ LocalStorage vào (ưu tiên các đơn sinh viên vừa tạo trên client)
    localRequests.forEach((req) => {
      const key = req.id || req.ma_yeu_cau || req.msv;
      combinedMap.set(key, { ...(combinedMap.get(key) || {}), ...req });
    });

    const results = Array.from(combinedMap.values());
    return results.length > 0 ? results : DEFAULT_REQUESTS;
  },

  /**
   * Quản lý lấy chi tiết một đơn đăng ký theo ID hoặc MSV
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

    // 2. Tìm trong danh sách LocalStorage
    const all = getLocalRequests();
    const found = all.find(
      (r) =>
        r.id?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.toLowerCase() === cleanId.toLowerCase() ||
        r.msv?.toLowerCase() === cleanId.toLowerCase()
    );

    if (found) {
      return found;
    }

    // 3. Fallback trả về đơn mẫu
    return DEFAULT_REQUESTS[0];
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
   * =========================================================================
   * YÊU CẦU CHUYỂN PHÒNG & TRẢ PHÒNG (SINH VIÊN)
   * =========================================================================
   */

  /**
   * Sinh viên gửi yêu cầu chuyển phòng
   */
  createTransferRequest: async (payload) => {
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    const newId = `YC-${Date.now().toString().slice(-4)}`;

    const currentRoom = payload.phong_hien_tai || 'P36 – Tòa A2 – Tầng 3';
    const targetRoom = payload.phong_mong_muon || 'P36 - Tòa A3 - Tầng 3';
    
    const currentClean = currentRoom.split(' – ')[0].split(' - ')[0].trim();
    const targetClean = targetRoom.split(' – ')[0].split(' - ')[0].trim();
    const phongLienQuan = `${currentClean} → ${targetClean}`;

    const newReq = {
      id: newId,
      ma_yeu_cau: `#${newId}`,
      loai_yeu_cau: 'Chuyển phòng',
      loai_yeu_cau_code: 'CHUYEN_PHONG',
      ngay_gui: formattedDate,
      phong_hien_tai: currentRoom,
      phong_mong_muon: targetRoom,
      phong_lien_quan: phongLienQuan,
      trang_thai: 'CHO_DUYET',
      ly_do: payload.ly_do,
      ngay_mong_muon: payload.ngay_mong_muon,
      mo_ta: payload.mo_ta || '',
    };

    // 1. Lưu vào LocalStorage
    try {
      const stored = JSON.parse(localStorage.getItem('dorm_student_transfer_checkout_requests') || '[]');
      const updated = [newReq, ...stored];
      localStorage.setItem('dorm_student_transfer_checkout_requests', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    // 2. Gửi API backend
    try {
      const res = await api.post('/student/requests/transfer', payload);
      if (res.data) return res.data;
    } catch (err) {
      console.warn('POST /student/requests/transfer offline, using local:', err);
    }

    return {
      status: 'success',
      message: 'Gửi yêu cầu chuyển phòng thành công',
      data: newReq,
    };
  },

  /**
   * Sinh viên gửi yêu cầu trả phòng
   */
  createCheckoutRequest: async (payload) => {
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    const newId = `YC-${Date.now().toString().slice(-4)}`;

    const currentRoom = payload.phong_hien_tai || 'P36 – Tòa A2 – Tầng 3';
    const currentClean = currentRoom.split(' – ')[0].split(' - ')[0].trim();

    const newReq = {
      id: newId,
      ma_yeu_cau: `#${newId}`,
      loai_yeu_cau: 'Trả phòng',
      loai_yeu_cau_code: 'TRA_PHONG',
      ngay_gui: formattedDate,
      phong_hien_tai: currentRoom,
      phong_lien_quan: currentClean,
      trang_thai: 'CHO_DUYET',
      ly_do: payload.ly_do,
      ngay_mong_muon: payload.ngay_mong_muon,
      dia_chi_sau_tra: payload.dia_chi_sau_tra || '',
      mo_ta: payload.mo_ta || '',
    };

    // 1. Lưu vào LocalStorage
    try {
      const stored = JSON.parse(localStorage.getItem('dorm_student_transfer_checkout_requests') || '[]');
      const updated = [newReq, ...stored];
      localStorage.setItem('dorm_student_transfer_checkout_requests', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }

    // 2. Gửi API backend
    try {
      const res = await api.post('/student/requests/checkout', payload);
      if (res.data) return res.data;
    } catch (err) {
      console.warn('POST /student/requests/checkout offline, using local:', err);
    }

    return {
      status: 'success',
      message: 'Gửi yêu cầu trả phòng thành công',
      data: newReq,
    };
  },

  /**
   * Lấy lịch sử yêu cầu chuyển / trả phòng của sinh viên
   */
  getMyRequests: async (msv) => {
    let apiData = [];
    try {
      const res = await api.get('/student/requests/my-requests', { params: { msv } });
      if (res.data?.data && Array.isArray(res.data.data)) {
        apiData = res.data.data;
      }
    } catch (err) {
      console.warn('GET /student/requests/my-requests offline, using local store:', err);
    }

    // Dữ liệu mẫu chuẩn Figma
    const defaultData = [
      {
        id: 'YC-0231',
        ma_yeu_cau: '#YC-0231',
        loai_yeu_cau: 'Chuyển phòng',
        loai_yeu_cau_code: 'CHUYEN_PHONG',
        ngay_gui: '25/11/2025',
        phong_lien_quan: 'P12 → P36',
        trang_thai: 'DA_DUYET',
        ly_do: 'Phòng hiện tại quá tải',
        ngay_mong_muon: '01/12/2025',
        mo_ta: 'Nguyện vọng chuyển sang phòng 6 người',
      },
      {
        id: 'YC-0232',
        ma_yeu_cau: '#YC-0232',
        loai_yeu_cau: 'Trả phòng',
        loai_yeu_cau_code: 'TRA_PHONG',
        ngay_gui: '25/08/2026',
        phong_lien_quan: 'P36',
        trang_thai: 'CHO_DUYET',
        ly_do: 'Đã tốt nghiệp',
        ngay_mong_muon: '01/09/2026',
        mo_ta: 'Em đã hoàn thành khóa luận tốt nghiệp',
      },
    ];

    let localData = [];
    try {
      const raw = localStorage.getItem('dorm_student_transfer_checkout_requests');
      if (raw) {
        localData = JSON.parse(raw);
      } else {
        localStorage.setItem('dorm_student_transfer_checkout_requests', JSON.stringify(defaultData));
        localData = defaultData;
      }
    } catch (e) {
      localData = defaultData;
    }

    // Kết hợp dữ liệu (loại bỏ trùng lặp theo ID)
    const map = new Map();
    [...apiData, ...localData, ...defaultData].forEach((item) => {
      const key = item.id || item.ma_yeu_cau;
      if (key && !map.has(key)) {
        map.set(key, item);
      }
    });

    return Array.from(map.values());
  },
};

export default occupancyService;
