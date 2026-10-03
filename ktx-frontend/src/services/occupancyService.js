import api, { dormService } from "./api";
import { getStudentAccount, saveStudentAccount } from "./studentAccountService";

const STORAGE_KEY = "dorm_registration_requests";

// Dữ liệu mẫu ban đầu để luôn có sẵn dữ liệu chuẩn bị kiểm thử
const DEFAULT_REQUESTS = [];

// Helper lấy danh sách đơn từ LocalStorage
function getLocalRequests() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const requests = Array.isArray(parsed) ? parsed : [];
    const cleaned = requests.filter((request) => request?.id !== "DK2026-0148");
    if (cleaned.length !== requests.length) saveLocalRequests(cleaned);
    return cleaned;
  } catch (e) {
    return [];
  }
}

// Helper lưu danh sách đơn vào LocalStorage
function saveLocalRequests(requests) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
  }
}

const TRANSFER_CHECKOUT_STORAGE_KEY = "dorm_transfer_checkout_requests";
const CURRENT_ROOM_STORAGE_KEY = "dorm_current_room_info";
const STAY_CONTRACTS_STORAGE_KEY = "dorm_stay_contracts";
const STUDENT_PROFILE_STORAGE_KEY = "dorm_student_profile";
const STUDENT_PROFILE_MIGRATION_KEY = "dorm_student_profile_migrated";

const DEFAULT_STUDENT_PROFILE = {
  ho_ten: "",
  vai_tro: "Sinh viên",
  msv: "",
  lop: "",
  so_dien_thoai: "",
  email: "",
  ngay_sinh: "",
  gioi_tinh: "",
  dan_toc: "",
  que_quan: "",
  khoa: "",
  avatar_url: "/avatar.png",
};

const DEFAULT_CURRENT_ROOM_INFO = null;

const DEFAULT_STAY_CONTRACTS = [];

const DEFAULT_TRANSFER_CHECKOUT_REQUESTS = [];

function getLocalTransferCheckoutRequests() {
  try {
    const raw = localStorage.getItem(TRANSFER_CHECKOUT_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveLocalTransferCheckoutRequests(reqs) {
  try {
    localStorage.setItem(TRANSFER_CHECKOUT_STORAGE_KEY, JSON.stringify(reqs));
  } catch (e) {
    console.error("Failed to save transfer/checkout to localStorage:", e);
  }
}

function getLocalCurrentRoomInfo() {
  try {
    const acc = getStudentAccount();
    if (acc?.currentResidence?.isActive && acc.currentResidence.contractStatus === "ACTIVE") {
      const cr = acc.currentResidence;
      const roomNum = String(cr.roomNumber || "101").replace(/^P/i, "");
      const bld = cr.building || "Tòa A1";
      const floor = cr.floor || (roomNum.startsWith("5") ? "5" : (roomNum[0] || "1"));
      return {
        phong_hien_tai: `${roomNum} - ${bld}`,
        so_phong: roomNum,
        phong: roomNum,
        toa: bld,
        tang: floor,
        giuong: cr.bed || "G04",
        so_giuong: cr.bed || "G04",
        so_thanh_vien: 4,
        suc_chua: "4 người",
        thanh_vien: cr.members || "4/4 người",
        thoi_gian_luu_tru: cr.startDate ? `${cr.startDate} – Nay` : "01/09/2026 – Nay",
        ngay_nhan_phong: cr.startDate || "01/09/2026",
        ngay_bat_dau: cr.startDate || "01/09/2026",
        loai_phong: cr.roomType || "Phòng tiêu chuẩn",
        billing: {
          amount: "400.000 đ",
          period: "/tháng",
          status: "Đã thanh toán",
        },
      };
    }
    const raw = localStorage.getItem(CURRENT_ROOM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.so_phong) return parsed;
    }
    // Fallback chuẩn theo hồ sơ mặc định của sinh viên Nguyễn Thị Ánh (DTC245180051)
    const currentCode = (localStorage.getItem("ktx_username") || "").trim().toUpperCase();
    if (!currentCode || currentCode === "DTC245180051" || currentCode === "ADMIN" || currentCode === "QUANLY") {
      return {
        phong_hien_tai: "101 - Tòa A1",
        so_phong: "101",
        phong: "101",
        toa: "Tòa A1",
        tang: "1",
        giuong: "G04",
        so_giuong: "G04",
        so_thanh_vien: 4,
        suc_chua: "4 người",
        thanh_vien: "4/4 người",
        thoi_gian_luu_tru: "01/09/2026 – Nay",
        ngay_nhan_phong: "01/09/2026",
        ngay_bat_dau: "01/09/2026",
        loai_phong: "Phòng tiêu chuẩn",
        billing: {
          amount: "400.000 đ",
          period: "/tháng",
          status: "Đã thanh toán",
        },
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

function saveLocalCurrentRoomInfo(info) {
  try {
    localStorage.setItem(CURRENT_ROOM_STORAGE_KEY, JSON.stringify(info));
  } catch (e) {
    console.error("Failed to save current room info:", e);
  }
}

function getLocalStudentProfile() {
  try {
    const raw = localStorage.getItem(STUDENT_PROFILE_STORAGE_KEY);
    const profile = raw
      ? { ...DEFAULT_STUDENT_PROFILE, ...JSON.parse(raw) }
      : { ...DEFAULT_STUDENT_PROFILE };

    const storedCode = (
      localStorage.getItem("ktx_username") ||
      localStorage.getItem("ktx_email")?.split("@")[0] ||
      ""
    )
      .trim()
      .toUpperCase();
    const storedName = localStorage.getItem("ktx_fullname")?.trim();
    const matchingRequest = getLocalRequests().find((request) => {
      const requestCode = (request.msv || "").trim().toUpperCase();
      return (
        (storedCode && requestCode === storedCode) ||
        (storedName && request.ho_ten?.trim() === storedName)
      );
    });

    if (matchingRequest) {
      return {
        ...profile,
        ho_ten: profile.ho_ten || matchingRequest.ho_ten,
        msv: profile.msv || matchingRequest.msv,
        gioi_tinh: profile.gioi_tinh || matchingRequest.gioi_tinh,
        ngay_sinh: profile.ngay_sinh || matchingRequest.ngay_sinh,
        so_dien_thoai: profile.so_dien_thoai || matchingRequest.so_dien_thoai,
        email: profile.email || matchingRequest.email,
        khoa: profile.khoa || matchingRequest.khoa,
        lop: profile.lop || matchingRequest.lop,
        que_quan: profile.que_quan || matchingRequest.dia_chi,
      };
    }

    if (!raw) {
      localStorage.setItem(
        STUDENT_PROFILE_STORAGE_KEY,
        JSON.stringify(DEFAULT_STUDENT_PROFILE),
      );
      return DEFAULT_STUDENT_PROFILE;
    }
    return profile;
  } catch (e) {
    return DEFAULT_STUDENT_PROFILE;
  }
}

function saveLocalStudentProfile(profile) {
  try {
    localStorage.setItem(STUDENT_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error("Failed to save student profile to localStorage:", e);
  }
}

function getLocalStayContracts() {
  try {
    const raw = localStorage.getItem(STAY_CONTRACTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (e) {
    return [];
  }
}

function saveLocalStayContracts(contracts) {
  try {
    localStorage.setItem(STAY_CONTRACTS_STORAGE_KEY, JSON.stringify(contracts));
  } catch (e) {
    console.error("Failed to save stay contracts:", e);
  }
}

export const occupancyService = {
  /**
   * Lấy danh sách các lựa chọn phòng/giường trống cho sinh viên đăng ký
   */
  getAvailableOptions: async (params = {}) => {
    try {
      const res = await api.get("/student/requests/available-options", { params });
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch (err) {
      console.warn(
        "GET /student/requests/available-options failed, trying /rooms/available:",
        err,
      );
      try {
        const fallbackRes = await api.get("/rooms/available");
        if (Array.isArray(fallbackRes.data) && fallbackRes.data.length > 0) {
          return fallbackRes.data.map((r) => {
            const emptyBeds = (r.giuongs || []).filter(
              (g) => g.trang_thai === "TRONG",
            ).length;
            const bldName = r.ten_toa || (r.ma_toa ? `Tòa ${r.ma_toa}` : "KTX");
            const isFemale = (r.ma_toa?.includes("A3") || r.ma_toa?.includes("A4") || (r.gioi_tinh && r.gioi_tinh.toLowerCase().includes("nữ")));
            return {
              ma_phong: r.ma_phong,
              so_phong: r.so_phong,
              loai_phong: r.loai_phong || "Phòng tiêu chuẩn",
              gioi_tinh: isFemale ? "Nữ" : (r.gioi_tinh || "Nam"),
              ma_tang: r.ma_tang,
              so_tang: r.so_tang || 1,
              ma_toa: r.ma_toa,
              ten_toa: bldName,
              label: `P${r.so_phong} - Tầng ${r.so_tang || 1} - ${bldName} (${emptyBeds || r.so_giuong_trong || 0} chỗ trống)`,
              so_cho_trong: emptyBeds || r.so_giuong_trong || 0,
            };
          });
        }
      } catch (e2) {
        console.warn("Fallback /rooms/available also failed:", e2);
      }
    }

    return [];
  },

  /**
   * Lấy danh sách các mức giá phòng/năm hiện có từ CSDL KTX
   */
  getPriceOptions: async () => {
    try {
      const res = await api.get("/student/requests/price-options");
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch (err) {
      console.warn(
        "GET /student/requests/price-options failed, using fallback:",
        err,
      );
    }

    return [];
  },

  /**
   * Lấy danh sách toàn bộ phòng phục vụ tính năng Tra cứu phòng (Student Room Lookup)
   * Trả về bộ dữ liệu chuẩn 100% theo giao diện Figma Tra cứu phòng (P36, P26, P106, P11, P54, P86, P16, P51,...)
   */
  getRooms: async () => {
    try {
      const response = await api.get('/rooms/buildings');
      const buildings = Array.isArray(response.data) ? response.data : [];
      return buildings.flatMap((building) =>
        (building.tangs || []).flatMap((floor) =>
          (floor.phongs || []).map((room) => {
            const beds = room.giuongs || [];
            const occupied = beds.filter((bed) => bed.trang_thai !== 'TRONG').length;
            const capacity = Number(room.suc_chua || beds.length || 0);
            return {
              ...room,
              id: room.ma_phong,
              toa: building.ten_toa,
              ma_toa: building.ma_toa,
              tang: `Tầng ${floor.so_tang}`,
              so_tang: floor.so_tang,
              da_o: occupied,
              si_so: `${occupied}/${capacity} người`,
              gia_thue: room.gia_tien_nam == null ? '' : `${Number(room.gia_tien_nam).toLocaleString('vi-VN')} đ / năm`,
              trang_thai: occupied >= capacity ? 'DA_DAY' : 'CON_CHO',
              giuongs: beds,
              giuong_trong: beds.filter((bed) => bed.trang_thai === 'TRONG').map((bed) => bed.ma_giuong),
            };
          }),
        ),
      );
    } catch (error) {
      console.error('Không thể tải danh sách phòng từ API:', error);
      return [];
    }
  },

  registerRoom: async (registrationData) => {
    const newId = `DK-${Date.now().toString().slice(-4)}`;

    // Chuẩn bị nguyện vọng hiển thị
    const wishParts = [
      registrationData.loai_phong,
      registrationData.tang_mong_muon,
      registrationData.muc_gia_mong_muon,
    ].filter(Boolean);

    const wishSummary =
      registrationData.nguyen_vong ||
      registrationData.nguyen_vong_label ||
      (wishParts.length > 0 ? wishParts.join(" - ") : "");

    const today = new Date();
    const dateFormatted = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
    const timeFormatted = `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;

    // Chuẩn bị bản ghi đơn hoàn chỉnh
    const newRequest = {
      id: newId,
      ma_yeu_cau: newId,
      msv: (registrationData.msv || "").trim().toUpperCase(),
      ho_ten: (registrationData.ho_ten || "Sinh viên").trim(),
      gioi_tinh: registrationData.gioi_tinh || "",
      ngay_sinh: registrationData.ngay_sinh || "",
      cccd: registrationData.cccd || "",
      so_dien_thoai: registrationData.so_dien_thoai || "",
      email: registrationData.email || "",
      khoa: registrationData.khoa || "",
      lop: registrationData.lop || "",
      dia_chi: registrationData.dia_chi || "",
      doi_tuong_uu_tien:
        registrationData.doi_tuong_uu_tien || "Không thuộc diện ưu tiên",
      nguoi_giam_ho: registrationData.nguoi_giam_ho || "",
      moi_quan_he: registrationData.moi_quan_he || "",
      sdt_nguoi_giam_ho: registrationData.sdt_nguoi_giam_ho || "",
      loai_phong: registrationData.loai_phong || "",
      tang_mong_muon: registrationData.tang_mong_muon || "",
      muc_gia_mong_muon: registrationData.muc_gia_mong_muon || "",
      nguyen_vong: wishSummary,
      nguyen_vong_label: wishSummary,
      nguyen_vong_phong: registrationData.nguyen_vong_phong || "",
      ma_toa_mong_muon: registrationData.ma_toa_mong_muon || "",
      ngay_dang_ky: dateFormatted,
      ngay_gui: `${dateFormatted} ${timeFormatted}`,
      ngay_gui_time: `${dateFormatted} ${timeFormatted}`,
      nam_hoc: "2026-2027",
      trang_thai: "PENDING",
      trang_thai_label: "Đang xét duyệt",
      loai_don: "DANG_KY",
      loai_yeu_cau: "Đăng ký phòng",
    };

    // 1. Gửi lên backend API trước để kiểm tra tính hợp lệ
    try {
      const res = await api.post("/student/requests/register", {
        ...newRequest,
        xac_nhan: true,
      });
      if (res.data?.data) {
        const savedReq = {
          ...newRequest,
          ...res.data.data,
          ngay_dang_ky: res.data.data.ngay_dang_ky || dateFormatted,
          nam_hoc: res.data.data.nam_hoc || "2026-2027",
          trang_thai: res.data.data.trang_thai || "PENDING",
          trang_thai_label: res.data.data.trang_thai_label || "Chờ duyệt",
        };
        const currentList = getLocalRequests();
        const updatedList = [
          savedReq,
          ...currentList.filter(
            (r) =>
              r.id !== savedReq.id &&
              r.ma_yeu_cau !== savedReq.ma_yeu_cau,
          ),
        ];
        saveLocalRequests(updatedList);

        // Đồng bộ chuẩn hóa vào studentAccount
        try {
          const studentCode = (savedReq.msv || registrationData.msv || "").trim().toLowerCase();
          if (studentCode) {
            const acc = getStudentAccount(studentCode);
            acc.registrationHistory = [
              {
                id: savedReq.id || savedReq.ma_yeu_cau,
                date: savedReq.ngay_dang_ky || dateFormatted,
                roomType: savedReq.loai_phong || "Phòng tiêu chuẩn",
                status: "PENDING",
                assignedRoom: savedReq.nguyen_vong || savedReq.nguyen_vong_label || "",
              },
              ...(acc.registrationHistory || []).filter(
                (r) => r.id !== (savedReq.id || savedReq.ma_yeu_cau)
              ),
            ];
            saveStudentAccount(acc);
          }
        } catch (syncErr) {
          console.warn("Lỗi đồng bộ registrationHistory:", syncErr);
        }

        return {
          ...res.data,
          data: savedReq,
        };
      }
    } catch (err) {
      if (err.response?.status === 400) {
        throw new Error(err.response?.data?.detail || "Không có phòng phù hợp với nguyện vọng.");
      }
      if (err.response) {
        throw new Error(err.response.data?.detail || "Không thể gửi đơn đăng ký phòng.");
      }
      console.warn(
        "Backend POST /student/requests/register offline, using local response:",
        err,
      );
    }

    // 2. Lưu vào LocalStorage khi chạy demo offline
    const currentList = getLocalRequests();
    const updatedList = [
      newRequest,
      ...currentList.filter(
        (r) => r.id !== newId && r.ma_yeu_cau !== newId,
      ),
    ];
    saveLocalRequests(updatedList);

    // Đồng bộ chuẩn hóa vào studentAccount
    try {
      const studentCode = (newRequest.msv || registrationData.msv || "").trim().toLowerCase();
      if (studentCode) {
        const acc = getStudentAccount(studentCode);
        acc.registrationHistory = [
          {
            id: newRequest.id,
            date: dateFormatted,
            roomType: newRequest.loai_phong || "Phòng tiêu chuẩn",
            status: "PENDING",
            assignedRoom: newRequest.nguyen_vong || newRequest.nguyen_vong_label || "",
          },
          ...(acc.registrationHistory || []).filter((r) => r.id !== newRequest.id),
        ];
        saveStudentAccount(acc);
      }
    } catch (syncErr) {
      console.warn("Lỗi đồng bộ registrationHistory offline:", syncErr);
    }

    return {
      status: "success",
      message: "Gửi yêu cầu đăng ký phòng thành công",
      data: newRequest,
    };
  },

  /**
   * Hủy yêu cầu đăng ký phòng
   */
  cancelRegistrationRequest: async (id) => {
    const cleanId = (id || "").trim();
    const all = getLocalRequests();
    const updated = all.map((r) => {
      if (
        r.id?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.replace("#", "").toLowerCase() ===
          cleanId.replace("#", "").toLowerCase()
      ) {
        return {
          ...r,
          trang_thai: "DA_HUY",
          trang_thai_label: "Đã hủy",
        };
      }
      return r;
    });
    saveLocalRequests(updated);
    window.dispatchEvent(new Event("occupancy-updated"));
    return { status: "success", message: "Hủy đơn thành công" };
  },

  /**
   * Cập nhật thông tin nguyện vọng phòng
   */
  updateRegistrationWish: async (id, updatedWish) => {
    const cleanId = (id || "").trim();
    const all = getLocalRequests();
    const updated = all.map((r) => {
      if (
        r.id?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.replace("#", "").toLowerCase() ===
          cleanId.replace("#", "").toLowerCase()
      ) {
        return {
          ...r,
          ...updatedWish,
        };
      }
      return r;
    });
    saveLocalRequests(updated);
    window.dispatchEvent(new Event("occupancy-updated"));
    return { status: "success", message: "Cập nhật nguyện vọng thành công" };
  },

  /**
   * Quản lý lấy danh sách TẤT CẢ các đơn đăng ký, chuyển phòng và trả phòng đang chờ xử lý
   */
  getAllRequests: async () => {
    let apiRequests = [];
    try {
      const res = await api.get("/admin/occupancy/requests");
      if (Array.isArray(res.data)) {
        apiRequests = res.data;
      }
    } catch (err) {
      console.warn(
        "Backend GET /admin/occupancy/requests offline, using local store:",
        err,
      );
    }

    const localRegistration = getLocalRequests();
    const localTransferCheckout = getLocalTransferCheckoutRequests();
    const combinedMap = new Map();

    // 1. Đưa đơn từ API vào trước
    apiRequests.forEach((req) => {
      const key = req.id || req.ma_yeu_cau || req.msv;
      combinedMap.set(key, {
        loai_don: "DANG_KY",
        loai_yeu_cau: "Đăng ký phòng",
        ...req,
      });
    });

    // 2. Đưa đơn đăng ký từ LocalStorage vào
    localRegistration.forEach((req) => {
      const key = req.id || req.ma_yeu_cau || req.msv;
      if (!combinedMap.has(key)) {
        combinedMap.set(key, {
          loai_don: "DANG_KY",
          loai_yeu_cau: "Đăng ký phòng",
          ...req,
        });
      }
    });

    // 3. Đưa đơn chuyển phòng và trả phòng từ LocalStorage vào
    localTransferCheckout.forEach((req) => {
      const key = req.id || req.ma_yeu_cau;
      if (!combinedMap.has(key)) {
        combinedMap.set(key, {
          loai_don:
            req.loai_don ||
            (req.loai_yeu_cau === "Trả phòng" ? "TRA_PHONG" : "CHUYEN_PHONG"),
          ...req,
        });
      }
    });

    const results = Array.from(combinedMap.values());
    return results;
  },

  /**
   * Quản lý lấy chi tiết một đơn theo ID hoặc MSV (hỗ trợ cả Đăng ký, Chuyển phòng & Trả phòng)
   */
  getRequestDetail: async (id) => {
    const cleanId = (id || "").trim();

    // 1. Thử gọi backend API
    try {
      const res = await api.get(
        `/admin/occupancy/requests/${encodeURIComponent(cleanId)}`,
      );
      if (res.data) {
        return res.data;
      }
    } catch (err) {
      console.warn(
        `Backend GET /admin/occupancy/requests/${cleanId} offline:`,
        err,
      );
    }

    // 2. Tìm trong danh sách chuyển phòng & trả phòng trước
    const transferReqs = getLocalTransferCheckoutRequests();
    const foundTransfer = transferReqs.find(
      (r) =>
        r.id?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.replace("#", "").toLowerCase() ===
          cleanId.replace("#", "").toLowerCase() ||
        r.msv?.toLowerCase() === cleanId.toLowerCase(),
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
        r.msv?.toLowerCase() === cleanId.toLowerCase(),
    );
    if (foundReg) {
      return foundReg;
    }

    throw new Error("Không tìm thấy đơn yêu cầu");
  },

  /**
   * Lấy danh sách cây Tòa -> Phòng -> Giường trống cho 3 dropdown
   */
  getAvailableBeds: async (params = {}) => {
    try {
      const res = await api.get("/admin/occupancy/available-beds", { params });
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch (err) {
      console.warn(
        "GET /admin/occupancy/available-beds failed, using default tree:",
        err,
      );
    }

    return [];
  },

  /**
   * Quản lý phê duyệt đơn đăng ký & xếp phòng
   */
  approveRequest: async (id, payload) => {
    if (!payload.ma_toa || !payload.phong_id || !payload.giuong_id) {
      throw new Error("Vui lòng chọn tòa, phòng và giường trước khi duyệt.");
    }
    let result;
    let isOffline = false;
    try {
      result = await api.put(
        `/admin/occupancy/requests/${encodeURIComponent(id)}/approve`,
        payload,
      );
    } catch (err) {
      if (err.response) {
        throw new Error(err.response.data?.detail || "Không thể duyệt đơn đăng ký.");
      }
      isOffline = true;
      console.warn(
        "Backend PUT approve offline, using local updated response:",
        err,
      );
    }

    const yy = new Date().getFullYear().toString().slice(-2);
    const responseData = result?.data?.data || {};
    const toa = responseData.ma_toa || payload.ma_toa;
    const roomNumber = responseData.so_phong || payload.so_phong || payload.phong_id;
    const bedNumber = responseData.so_giuong || payload.so_giuong || payload.giuong_id;
    const contractCode =
      responseData.ma_hop_dong ||
      `HD${yy}-${toa}${payload.phong_id}-G${payload.giuong_id}`;
    const roomAssignment = {
      ma_toa: toa,
      toa_nha: responseData.toa_nha || payload.ten_toa || toa,
      ma_phong: responseData.ma_phong || payload.phong_id,
      so_phong: roomNumber,
      loai_phong: responseData.loai_phong || payload.loai_phong || "",
      ma_giuong: responseData.ma_giuong || payload.giuong_id,
      so_giuong: bedNumber,
    };

    const all = getLocalRequests();
    const cleanId = String(id).replace(/^#/, "").trim().toLowerCase();
    const updated = all.map((request) => {
      const requestIds = [request.id, request.ma_yeu_cau]
        .filter(Boolean)
        .map((value) => String(value).replace(/^#/, "").trim().toLowerCase());
      if (!requestIds.includes(cleanId)) return request;

      const newContract = {
        id: contractCode,
        ma_hop_dong: contractCode,
        msv: request.msv,
        ho_ten: request.ho_ten,
        ...roomAssignment,
        phong: roomNumber,
        toa: roomAssignment.toa_nha,
        tang: responseData.so_tang || payload.so_tang || "",
        giuong: bedNumber,
        thoi_gian_o: "2026-2027",
        nam_hoc: "2026-2027",
        trang_thai: "DANG_O",
        trang_thai_label: "Đang ở",
      };
      const currentContracts = getLocalStayContracts();
      saveLocalStayContracts([
        newContract,
        ...currentContracts.filter((contract) => contract.id !== contractCode),
      ]);

      return {
        ...request,
        ...roomAssignment,
        trang_thai: "APPROVED",
        trang_thai_label: "Đã duyệt",
        ma_hop_dong: contractCode,
        xep_phong: roomAssignment,
      };
    });
    saveLocalRequests(updated);
    window.dispatchEvent(new Event("occupancy-updated"));

    return result?.data || {
      status: "success",
      message: "Phê duyệt và xếp phòng thành công",
      data: {
        ma_hop_dong: contractCode,
        request_id: id,
        trang_thai: "APPROVED",
        ...roomAssignment,
      },
      offline: isOffline,
    };
  },

  /**
   * Quản lý từ chối đơn đăng ký
   */
  rejectRequest: async (id, payload) => {
    let result;
    let isOffline = false;
    try {
      result = await api.put(
        `/admin/occupancy/requests/${encodeURIComponent(id)}/reject`,
        payload,
      );
    } catch (err) {
      if (err.response) {
        throw new Error(err.response.data?.detail || "Không thể từ chối đơn đăng ký.");
      }
      isOffline = true;
      console.warn(
        "Backend PUT reject offline, using local updated response:",
        err,
      );
    }

    const cleanId = String(id).replace(/^#/, "").trim().toLowerCase();
    const updated = getLocalRequests().map((request) => {
      const requestIds = [request.id, request.ma_yeu_cau]
        .filter(Boolean)
        .map((value) => String(value).replace(/^#/, "").trim().toLowerCase());
      if (!requestIds.includes(cleanId)) return request;
      return {
        ...request,
        trang_thai: "TU_CHOI",
        trang_thai_label: "Từ chối",
        ly_do_tu_choi: payload.ly_do_tu_choi,
      };
    });
    saveLocalRequests(updated);
    window.dispatchEvent(new Event("occupancy-updated"));

    return result?.data || {
      status: "success",
      message: "Đã từ chối đơn đăng ký thành công",
      data: {
        request_id: id,
        trang_thai: "TU_CHOI",
        ...payload,
      },
      offline: isOffline,
    };
  },

  getCurrentStudentInfo: async () => {
    return null;
  },



  /**
   * Sinh viên gửi đơn xin chuyển phòng
   */
  submitTransferRequest: async (data) => {
    const response = await api.post("/student/requests/transfer", data);
    window.dispatchEvent(new Event("occupancy-updated"));
    return response.data;
  },

  /**
   * Sinh viên gửi đơn xin trả phòng
   */
  submitCheckoutRequest: async (data) => {
    const response = await api.post("/student/requests/checkout", data);
    window.dispatchEvent(new Event("occupancy-updated"));
    return response.data;
  },

  /**
   * Lấy danh sách lịch sử yêu cầu chuyển / trả phòng
   */
  getTransferCheckoutRequests: async () => {
    try {
      const res = await api.get("/student/requests/transfer-checkout-history");
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch (err) {
      console.warn(
        "Backend GET /student/requests/transfer-checkout-history offline, using local store:",
        err,
      );
    }

    return getLocalTransferCheckoutRequests();
  },

  getMyRequests: async (msv) => {
    const local = getLocalRequests();
    try {
      const res = await api.get("/student/requests/my-requests", {
        params: msv ? { msv } : {},
      });
      if (Array.isArray(res.data) && res.data.length > 0) {
        const combinedMap = new Map();
        res.data.forEach((r) => combinedMap.set(r.id || r.ma_yeu_cau, r));
        local.forEach((r) => {
          const key = r.id || r.ma_yeu_cau;
          if (!combinedMap.has(key)) combinedMap.set(key, r);
        });
        const merged = Array.from(combinedMap.values());
        saveLocalRequests(merged);
        return merged;
      }
    } catch (e) {
      if (e.response) throw e;
      console.warn("Backend GET /student/requests/my-requests offline, using local store:", e);
    }
    return local;
  },

  getMyContracts: async (studentMsv) => {
    const currentCode = (
      studentMsv ||
      localStorage.getItem("ktx_username") ||
      localStorage.getItem("ktx_email")?.split("@")[0] ||
      "dtc245180051"
    ).trim().toUpperCase();

    // 1. Thử gọi backend API nếu có mã sinh viên để lấy dữ liệu thực tế từ CSDL MySQL
    if (currentCode) {
      try {
        const res = await api.get("/student/requests/my-contracts", {
          params: { msv: currentCode },
        });
        if (Array.isArray(res.data) && res.data.length > 0) {
          return res.data;
        }
      } catch (err) {
        console.warn("Backend GET /student/requests/my-contracts offline:", err);
      }
    }

    // 2. Tích hợp từ chuẩn hóa studentAccountService
    const account = getStudentAccount(currentCode);
    const accResidenceHistory = Array.isArray(account.residenceHistory) ? account.residenceHistory : [];

    if (accResidenceHistory.length > 0) {
      return accResidenceHistory.map((item, idx) => {
        const isActive = item.status === "ACTIVE" && !item.endDate;
        const roomNum = String(item.roomNumber || "501").replace(/^P/i, "");
        const buildingStr = item.building || "Tòa A4";
        const floorStr = roomNum.startsWith("5") ? "5" : (roomNum[0] || "5");
        const sDate = item.startDate || "02/10/2026";
        const eDate = item.endDate || "02/10/2027";
        const sucChua = item.suc_chua || (item.roomType?.includes("dịch vụ") ? "4 người" : "8 người");
        const shortBed = (item.bed || item.ma_giuong || "G01").split("_").pop() || "G01";

        return {
          id: item.id || `RES-${String(idx + 1).padStart(2, "0")}`,
          ma_hop_dong: `HD26-${buildingStr.replace(/[^A-Za-z0-9]/g, "")}${roomNum}-${shortBed}`,
          msv: (account.studentId || "dtc245180051").toUpperCase(),
          phong: `P${roomNum}`,
          so_phong: roomNum,
          roomNumber: roomNum,
          toa: buildingStr,
          building: buildingStr,
          tang: floorStr,
          giuong: shortBed,
          so_giuong: shortBed,
          ma_giuong: item.ma_giuong || item.bed || shortBed,
          loai_phong: item.roomType || "Phòng tiêu chuẩn",
          roomType: item.roomType || "Phòng tiêu chuẩn",
          suc_chua: sucChua,
          ngay_nhan_phong: sDate,
          ngay_bat_dau: sDate,
          ngay_duyet: sDate,
          ngay_ket_thuc: eDate,
          thoi_han_hop_dong: `${sDate} - ${eDate}`,
          thoi_gian_o: "2026-2027",
          nam_hoc: "2026-2027",
          trang_thai: isActive ? "DANG_O" : "DA_TRA_PHONG",
          trang_thai_label: isActive ? "Đang ở" : "Đã kết thúc",
          startDate: sDate,
          endDate: eDate,
          status: item.status,
        };
      });
    }

    // 3. Fallback sang LocalStorage (chỉ lấy hợp đồng thuộc về mã sinh viên hiện tại)
    const local = getLocalStayContracts();
    return local.filter((c) => {
      const cMsv = (c.msv || "").trim().toUpperCase();
      return !currentCode || (cMsv && cMsv === currentCode);
    });
  },

  getCurrentRoomInfo: async (studentMsv) => {
    const msv = studentMsv || localStorage.getItem("ktx_username") || "DTC245180051";
    try {
      const res = await api.get('/student/requests/current-room', {
        params: msv ? { msv } : {},
      });
      const data = res.data?.data || null;
      if (data && data.so_phong) {
        saveLocalCurrentRoomInfo(data);
        return data;
      }
      return getLocalCurrentRoomInfo();
    } catch (err) {
      console.warn('GET /student/requests/current-room failed, trying local cache:', err);
      return getLocalCurrentRoomInfo();
    }
  },

  getStudentProfile: async () => {
    return getLocalStudentProfile();
  },

  updateStudentProfile: async (updatedData) => {
    const current = getLocalStudentProfile();
    const merged = { ...current, ...updatedData };
    saveLocalStudentProfile(merged);
    window.dispatchEvent(new Event("occupancy-updated"));
    return {
      status: "success",
      message: "Cập nhật thông tin thành công!",
      data: merged,
    };
  },

  /**
   * Quản lý phê duyệt Yêu cầu chuyển phòng & Xếp chỗ mới
   */
  approveTransferRequest: async (id, payload) => {
    const cleanId = (id || "").trim();
    const toa = payload.ma_toa || "A";
    const toaLabel = toa.startsWith("Tòa") ? toa : `Tòa ${toa}`;
    const phong = payload.phong_id || "A203";
    const phongClean = phong.replace("Phòng ", "");
    const phongLabel = phongClean.startsWith("P")
      ? phongClean
      : `P${phongClean}`;
    const giuong = payload.giuong_id || "G04";
    const giuongClean = giuong.replace("Giường ", "");
    const contractCode = `HD26-${toa.replace(/\D/g, "") || toa}${phongClean}-G${giuongClean}`;

    // 1. Cập nhật trạng thái đơn trong danh sách chuyển/trả phòng
    const all = getLocalTransferCheckoutRequests();
    const updated = all.map((r) => {
      if (
        r.id?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.replace("#", "").toLowerCase() ===
          cleanId.replace("#", "").toLowerCase()
      ) {
        return {
          ...r,
          trang_thai: "DA_DUYET",
          trang_thai_label: "Đã duyệt",
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
      thanh_vien: "4/8 người",
      thoi_gian_luu_tru: "09/2026 – Nay",
      so_phong: phongLabel,
      toa: toaLabel,
      tang: "2",
      so_thanh_vien: 4,
      suc_chua: 8,
      vi_tri_hien_tai: `Phòng ${phongClean} - Giường ${giuongClean}`,
      trang_thai: "DANG_O",
    };
    saveLocalCurrentRoomInfo(newRoomInfo);

    // 3. CẬP NHẬT BẢNG LỊCH SỬ Ở (Thêm hợp đồng/dòng lưu trú mới Đang ở)
    const contracts = getLocalStayContracts();
    const closedContracts = contracts.map((c) => ({
      ...c,
      trang_thai: "DA_CHUYEN",
      trang_thai_label: "Đã chuyển phòng",
    }));
    const newContract = {
      id: contractCode,
      ma_hop_dong: contractCode,
      phong: phongLabel,
      toa: toaLabel.replace("Tòa ", ""),
      tang: "2",
      giuong: giuongClean,
      thoi_gian_o: "2026-2027",
      nam_hoc: "2026-2027",
      trang_thai: "DANG_O",
      trang_thai_label: "Đang ở",
    };
    saveLocalStayContracts([newContract, ...closedContracts]);

    // Bắn sự kiện cập nhật thời gian thực
    window.dispatchEvent(new Event("occupancy-updated"));

    // Gửi lên backend nếu online
    try {
      await api.put(
        `/admin/occupancy/requests/transfer/${encodeURIComponent(cleanId)}/approve`,
        payload,
      );
    } catch (err) {
      console.warn(
        "Backend PUT transfer approve offline, using local store:",
        err,
      );
    }

    return {
      status: "success",
      message: "Phê duyệt chuyển phòng và xếp chỗ thành công!",
      data: {
        id: cleanId,
        trang_thai: "DA_DUYET",
        room: newRoomInfo,
      },
    };
  },

  /**
   * Quản lý từ chối Yêu cầu chuyển phòng
   */
  rejectTransferRequest: async (id, payload = {}) => {
    const cleanId = (id || "").trim();
    const all = getLocalTransferCheckoutRequests();
    const updated = all.map((r) => {
      if (
        r.id?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.replace("#", "").toLowerCase() ===
          cleanId.replace("#", "").toLowerCase()
      ) {
        return {
          ...r,
          trang_thai: "TU_CHOI",
          trang_thai_label: "Từ chối",
          ly_do_tu_choi:
            payload.ly_do_tu_choi || "Không đáp ứng điều kiện chuyển phòng",
        };
      }
      return r;
    });
    saveLocalTransferCheckoutRequests(updated);

    window.dispatchEvent(new Event("occupancy-updated"));

    try {
      await api.put(
        `/admin/occupancy/requests/transfer/${encodeURIComponent(cleanId)}/reject`,
        payload,
      );
    } catch (err) {
      console.warn(
        "Backend PUT transfer reject offline, using local store:",
        err,
      );
    }

    return {
      status: "success",
      message: "Đã từ chối yêu cầu chuyển phòng.",
    };
  },

  /**
   * Quản lý phê duyệt Yêu cầu trả phòng
   */
  approveCheckoutRequest: async (id, payload = {}) => {
    const cleanId = (id || "").trim();

    // 1. Cập nhật trạng thái đơn thành DA_DUYET
    const all = getLocalTransferCheckoutRequests();
    const updated = all.map((r) => {
      if (
        r.id?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.replace("#", "").toLowerCase() ===
          cleanId.replace("#", "").toLowerCase()
      ) {
        return {
          ...r,
          trang_thai: "DA_DUYET",
          trang_thai_label: "Đã duyệt",
        };
      }
      return r;
    });
    saveLocalTransferCheckoutRequests(updated);

    // 2. CẬP NHẬT BANNER PHÒNG HIỆN TẠI (Chuyển về trạng thái Đã kết thúc lưu trú / Chưa có phòng)
    const checkoutRoomInfo = {
      phong_hien_tai: "Đã kết thúc lưu trú / Chưa có phòng",
      thanh_vien: "0 người",
      thoi_gian_luu_tru: "Đã hoàn tất trả phòng",
      so_phong: "Chưa có phòng",
      toa: "--",
      tang: "--",
      so_thanh_vien: 0,
      suc_chua: 0,
      vi_tri_hien_tai: "Đã hoàn tất thủ tục trả phòng",
      trang_thai: "DA_TRA_PHONG",
    };
    saveLocalCurrentRoomInfo(checkoutRoomInfo);

    // 3. CẬP NHẬT BẢNG LỊCH SỬ Ở: Toàn bộ dòng lưu trú chuyển trạng thái thành "Đã trả phòng / Đã rời KTX"
    const contracts = getLocalStayContracts();
    const updatedContracts = contracts.map((c) => ({
      ...c,
      trang_thai: "DA_TRA_PHONG",
      trang_thai_label: "Đã trả phòng / Đã rời KTX",
    }));
    saveLocalStayContracts(updatedContracts);

    window.dispatchEvent(new Event("occupancy-updated"));

    try {
      await api.put(
        `/admin/occupancy/requests/checkout/${encodeURIComponent(cleanId)}/approve`,
        payload,
      );
    } catch (err) {
      console.warn(
        "Backend PUT checkout approve offline, using local store:",
        err,
      );
    }

    return {
      status: "success",
      message: "Phê duyệt yêu cầu trả phòng thành công!",
    };
  },

  /**
   * Quản lý từ chối Yêu cầu trả phòng
   */
  rejectCheckoutRequest: async (id, payload = {}) => {
    const cleanId = (id || "").trim();
    const all = getLocalTransferCheckoutRequests();
    const updated = all.map((r) => {
      if (
        r.id?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.toLowerCase() === cleanId.toLowerCase() ||
        r.ma_yeu_cau?.replace("#", "").toLowerCase() ===
          cleanId.replace("#", "").toLowerCase()
      ) {
        return {
          ...r,
          trang_thai: "TU_CHOI",
          trang_thai_label: "Từ chối",
          ly_do_tu_choi:
            payload.ly_do_tu_choi ||
            "Chưa hoàn tất công nợ hoặc thủ tục bàn giao tài sản",
        };
      }
      return r;
    });
    saveLocalTransferCheckoutRequests(updated);

    window.dispatchEvent(new Event("occupancy-updated"));

    try {
      await api.put(
        `/admin/occupancy/requests/checkout/${encodeURIComponent(cleanId)}/reject`,
        payload,
      );
    } catch (err) {
      console.warn(
        "Backend PUT checkout reject offline, using local store:",
        err,
      );
    }

    return {
      status: "success",
      message: "Đã từ chối yêu cầu trả phòng.",
    };
  },
};

export default occupancyService;
