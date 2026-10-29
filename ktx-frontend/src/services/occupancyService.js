import api, { dormService } from "./api";
import { getStudentAccount, saveStudentAccount } from "./studentAccountService";
import studentNotificationService from "./studentNotificationService";

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
    const studentMsv = (localStorage.getItem("ktx_username") || "").trim().toUpperCase();
    const trans = getLocalTransferCheckoutRequests();
    
    // Kiểm tra nếu có đơn trả phòng đã duyệt
    const approvedCheckout = trans.find(
      (t) =>
        (!studentMsv || (t.msv || "").trim().toUpperCase() === studentMsv) &&
        (t.trang_thai === "DA_DUYET" || t.trang_thai === "APPROVED" || t.trang_thai_label === "Đã duyệt") &&
        t.loai_don === "TRA_PHONG"
    );
    if (approvedCheckout) {
      return null;
    }

    // Kiểm tra nếu có đơn chuyển phòng đã duyệt
    const approvedTransfer = trans.find(
      (t) =>
        (!studentMsv || (t.msv || "").trim().toUpperCase() === studentMsv) &&
        (t.trang_thai === "DA_DUYET" || t.trang_thai === "APPROVED" || t.trang_thai_label === "Đã duyệt") &&
        t.loai_don === "CHUYEN_PHONG"
    );
    if (approvedTransfer && approvedTransfer.xep_phong) {
      const xp = approvedTransfer.xep_phong;
      const rawPhong = String(xp.phong_id || "203");
      const matchNum = rawPhong.match(/\d+/);
      const roomClean = matchNum ? matchNum[0] : "203";
      const rawToa = String(xp.ma_toa || "A1").replace("TOA_", "").replace("Tòa ", "").replace("Tòa", "").trim() || "A1";
      const toaLabel = `Tòa ${rawToa}`;
      const giuongClean = String(xp.giuong_id || "G01").split("_").pop() || "G01";
      const tangVal = roomClean[0] || "2";
      return {
        phong_hien_tai: `${roomClean} – ${toaLabel}`,
        so_phong: roomClean,
        phong: `P${roomClean}`,
        toa: toaLabel,
        tang: tangVal,
        giuong: giuongClean,
        so_giuong: giuongClean,
        so_thanh_vien: 1,
        suc_chua: "4 người",
        thanh_vien: "1/4 người",
        thoi_gian_luu_tru: `${approvedTransfer.ngay_gui || "19/10/2026"} – Nay`,
        ngay_nhan_phong: approvedTransfer.ngay_gui || "19/10/2026",
        ngay_bat_dau: approvedTransfer.ngay_gui || "19/10/2026",
        loai_phong: "Phòng tiêu chuẩn",
        billing: {
          amount: "4.800.000 đ",
          period: "/năm",
          status: "Đã thanh toán",
        },
        danh_sach_thanh_vien: [
          {
            msv: studentMsv || localStorage.getItem("ktx_username") || "",
            ho_ten: localStorage.getItem("ktx_fullname") || "Sinh viên",
            giuong: giuongClean,
            so_giuong: giuongClean,
            lop: localStorage.getItem("ktx_lop") || "",
            khoa: localStorage.getItem("ktx_khoa") || "",
            so_dien_thoai: localStorage.getItem("ktx_phone") || "",
            vai_tro: "Bạn (Trưởng phòng)",
            ngay_vao: approvedTransfer.ngay_gui || "19/10/2026",
            trang_thai: "DANG_O",
            trang_thai_label: "Đang ở",
            is_current_user: true,
          },
        ],
      };
    }

    const raw = localStorage.getItem(CURRENT_ROOM_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.so_phong) return parsed;
    }

    const acc = getStudentAccount();
    if (acc?.currentResidence?.isActive && acc.currentResidence.contractStatus === "ACTIVE") {
      const cr = acc.currentResidence;
      const roomNum = String(cr.roomNumber || "").replace(/^P/i, "");
      if (roomNum) {
        const bld = cr.building || "";
        const floor = cr.floor || (roomNum.startsWith("5") ? "5" : (roomNum[0] || "1"));
        return {
          phong_hien_tai: bld ? `${roomNum} - ${bld}` : roomNum,
          so_phong: roomNum,
          phong: roomNum,
          toa: bld,
          tang: floor,
          giuong: cr.bed || "",
          so_giuong: cr.bed || "",
          so_thanh_vien: 4,
          suc_chua: "4 người",
          thanh_vien: cr.members || "4/4 người",
          thoi_gian_luu_tru: cr.startDate ? `${cr.startDate} – Nay` : "",
          ngay_nhan_phong: cr.startDate || "",
          ngay_bat_dau: cr.startDate || "",
          loai_phong: cr.roomType || "Phòng tiêu chuẩn",
          billing: null,
        };
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

function saveLocalCurrentRoomInfo(info) {
  try {
    const newJson = JSON.stringify(info || null);
    const oldJson = localStorage.getItem(CURRENT_ROOM_STORAGE_KEY);
    if (newJson === oldJson) return; // Không thay đổi thì không làm gì để tránh vòng lặp re-render

    localStorage.setItem(CURRENT_ROOM_STORAGE_KEY, newJson);
    if (info && info.so_phong) {
      try {
        const raw = localStorage.getItem("ktx_student_account");
        if (raw) {
          const acc = JSON.parse(raw);
          if (acc && typeof acc === "object") {
            acc.currentResidence = {
              ...(acc.currentResidence || {}),
              isActive: true,
              building: info.toa || acc.currentResidence?.building || "Tòa A1",
              roomNumber: String(info.so_phong || "203"),
              floor: info.tang || (String(info.so_phong)[0] || "2"),
              bed: info.giuong || info.so_giuong || "G01",
              roomType: info.loai_phong || info.roomType || "Phòng dịch vụ",
              loai_phong: info.loai_phong || info.roomType || "Phòng dịch vụ",
              contractStatus: "ACTIVE",
              startDate: info.ngay_bat_dau || "19/10/2026",
              endDate: info.ngay_ket_thuc || "",
            };
            localStorage.setItem("ktx_student_account", JSON.stringify(acc));
          }
        }
      } catch (_) {}
    }
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
              gioi_tinh: room.gioi_tinh || building.gioi_tinh || 'Nam & Nữ',
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
    const today = new Date();
    const dateFormatted = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
    const timeFormatted = `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;

    const wishParts = [
      registrationData.loai_phong,
      registrationData.tang_mong_muon,
      registrationData.muc_gia_mong_muon,
    ].filter(Boolean);

    const wishSummary =
      registrationData.nguyen_vong ||
      registrationData.nguyen_vong_label ||
      (wishParts.length > 0 ? wishParts.join(" - ") : "");

    const payload = {
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
      nam_hoc: "2026-2027",
      trang_thai: "PENDING",
      trang_thai_label: "Đang xét duyệt",
      loai_don: "DANG_KY",
      loai_yeu_cau: "Đăng ký phòng",
      xac_nhan: true,
    };

    try {
      const res = await api.post("/student/requests/register", payload);
      window.dispatchEvent(new Event("occupancy-updated"));
      return res.data;
    } catch (err) {
      console.error("Backend POST /student/requests/register failed:", err);
      const detail =
        err.response?.data?.detail ||
        err.message ||
        "Không thể gửi đơn đăng ký phòng. Vui lòng kiểm tra lại kết nối mạng và thử lại sau.";
      const errorToThrow = new Error(detail);
      errorToThrow.response = err.response;
      throw errorToThrow;
    }
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
    try {
      const res = await api.get("/admin/occupancy/requests");
      if (Array.isArray(res.data)) {
        return res.data;
      }
      return [];
    } catch (err) {
      console.error("Backend GET /admin/occupancy/requests failed:", err);
      throw err;
    }
  },

  /**
   * Quản lý lấy chi tiết một đơn theo ID hoặc MSV
   */
  getRequestDetail: async (id) => {
    const cleanId = (id || "").trim();
    try {
      const res = await api.get(
        `/admin/occupancy/requests/${encodeURIComponent(cleanId)}`,
      );
      return res.data;
    } catch (err) {
      console.error(
        `Backend GET /admin/occupancy/requests/${cleanId} failed:`,
        err,
      );
      throw err;
    }
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

    return [
      {
        ma_toa: "TOA_A1",
        ten_toa: "Tòa A1",
        gioi_tinh: "Nam & Nữ",
        rooms: [
          {
            ma_phong: "P101_A1",
            so_phong: "101",
            loai_phong: "Phòng tiêu chuẩn",
            so_tang: 1,
            suc_chua: 4,
            gioi_tinh: "Nam & Nữ",
            thanh_vien_hien_tai: 2,
            gia_tien_nam: 4800000,
            label: "Phòng 101 (2 chỗ trống)",
            beds: [
              { ma_giuong: "P101_A1_G03", label: "Giường G03" },
              { ma_giuong: "P101_A1_G04", label: "Giường G04" },
            ],
          },
          {
            ma_phong: "A1_P201",
            so_phong: "201",
            loai_phong: "Phòng tiêu chuẩn",
            so_tang: 2,
            suc_chua: 4,
            gioi_tinh: "Nam & Nữ",
            thanh_vien_hien_tai: 1,
            gia_tien_nam: 4800000,
            label: "Phòng 201 (3 chỗ trống)",
            beds: [
              { ma_giuong: "A1_P201_G02", label: "Giường G02" },
              { ma_giuong: "A1_P201_G03", label: "Giường G03" },
              { ma_giuong: "A1_P201_G04", label: "Giường G04" },
            ],
          },
          {
            ma_phong: "A203",
            so_phong: "203",
            loai_phong: "Phòng dịch vụ",
            so_tang: 2,
            suc_chua: 4,
            gioi_tinh: "Nam & Nữ",
            thanh_vien_hien_tai: 1,
            gia_tien_nam: 8200000,
            label: "Phòng 203 (3 chỗ trống)",
            beds: [
              { ma_giuong: "A203_G01", label: "Giường G01" },
              { ma_giuong: "A203_G02", label: "Giường G02" },
              { ma_giuong: "A203_G03", label: "Giường G03" },
            ],
          },
          {
            ma_phong: "A1_P501",
            so_phong: "501",
            loai_phong: "Phòng dịch vụ",
            so_tang: 5,
            suc_chua: 4,
            gioi_tinh: "Nam & Nữ",
            thanh_vien_hien_tai: 0,
            gia_tien_nam: 8200000,
            label: "Phòng 501 (4 chỗ trống)",
            beds: [
              { ma_giuong: "A1_P501_G01", label: "Giường G01" },
              { ma_giuong: "A1_P501_G02", label: "Giường G02" },
              { ma_giuong: "A1_P501_G03", label: "Giường G03" },
              { ma_giuong: "A1_P501_G04", label: "Giường G04" },
            ],
          },
        ],
      },
      {
        ma_toa: "B",
        ten_toa: "Tòa B",
        gioi_tinh: "Nữ",
        rooms: [
          {
            ma_phong: "B101",
            so_phong: "101",
            loai_phong: "Phòng tiêu chuẩn",
            so_tang: 1,
            suc_chua: 4,
            gioi_tinh: "Nữ",
            thanh_vien_hien_tai: 1,
            gia_tien_nam: 4800000,
            label: "Phòng 101 (3 chỗ trống)",
            beds: [
              { ma_giuong: "B101_G02", label: "Giường G02" },
              { ma_giuong: "B101_G03", label: "Giường G03" },
              { ma_giuong: "B101_G04", label: "Giường G04" },
            ],
          },
          {
            ma_phong: "B202",
            so_phong: "202",
            loai_phong: "Phòng dịch vụ",
            so_tang: 2,
            suc_chua: 4,
            gioi_tinh: "Nữ",
            thanh_vien_hien_tai: 0,
            gia_tien_nam: 8200000,
            label: "Phòng 202 (4 chỗ trống)",
            beds: [
              { ma_giuong: "B202_G01", label: "Giường G01" },
              { ma_giuong: "B202_G02", label: "Giường G02" },
              { ma_giuong: "B202_G03", label: "Giường G03" },
              { ma_giuong: "B202_G04", label: "Giường G04" },
            ],
          },
          {
            ma_phong: "B501",
            so_phong: "501",
            loai_phong: "Phòng dịch vụ",
            so_tang: 5,
            suc_chua: 4,
            gioi_tinh: "Nữ",
            thanh_vien_hien_tai: 0,
            gia_tien_nam: 8200000,
            label: "Phòng 501 (4 chỗ trống)",
            beds: [
              { ma_giuong: "B501_G01", label: "Giường G01" },
              { ma_giuong: "B501_G02", label: "Giường G02" },
              { ma_giuong: "B501_G03", label: "Giường G03" },
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
    if (!payload.ma_toa || !payload.phong_id || !payload.giuong_id) {
      throw new Error("Vui lòng chọn tòa, phòng và giường trước khi duyệt.");
    }
    const cleanId = String(id).replace(/^#/, "").trim();
    try {
      const result = await api.put(
        `/admin/occupancy/requests/${encodeURIComponent(cleanId)}/approve`,
        payload,
      );
      window.dispatchEvent(new Event("occupancy-updated"));
      return result.data;
    } catch (err) {
      console.error("Backend PUT approve failed:", err);
      const detail =
        err.response?.data?.detail ||
        err.message ||
        "Không thể phê duyệt và xếp phòng. Vui lòng thử lại!";
      const errorToThrow = new Error(detail);
      errorToThrow.response = err.response;
      throw errorToThrow;
    }
  },

  /**
   * Quản lý từ chối đơn đăng ký
   */
  rejectRequest: async (id, payload) => {
    const cleanId = String(id).replace(/^#/, "").trim();
    try {
      const result = await api.put(
        `/admin/occupancy/requests/${encodeURIComponent(cleanId)}/reject`,
        payload,
      );
      window.dispatchEvent(new Event("occupancy-updated"));
      return result.data;
    } catch (err) {
      console.error("Backend PUT reject failed:", err);
      const detail =
        err.response?.data?.detail ||
        err.message ||
        "Không thể từ chối đơn đăng ký. Vui lòng thử lại!";
      const errorToThrow = new Error(detail);
      errorToThrow.response = err.response;
      throw errorToThrow;
    }
  },

  getCurrentStudentInfo: async () => {
    return null;
  },



  /**
   * Sinh viên gửi đơn xin chuyển phòng
   */
  submitTransferRequest: async (data) => {
    try {
      const response = await api.post("/student/requests/transfer", data);
      window.dispatchEvent(new Event("occupancy-updated"));
      return response.data;
    } catch (err) {
      console.error("Backend POST /student/requests/transfer failed:", err);
      const detail =
        err.response?.data?.detail ||
        err.message ||
        "Không thể gửi yêu cầu chuyển phòng. Vui lòng kiểm tra lại kết nối và thử lại.";
      const errorToThrow = new Error(detail);
      errorToThrow.response = err.response;
      throw errorToThrow;
    }
  },

  /**
   * Sinh viên gửi đơn xin trả phòng
   */
  submitCheckoutRequest: async (data) => {
    try {
      const response = await api.post("/student/requests/checkout", data);
      window.dispatchEvent(new Event("occupancy-updated"));
      return response.data;
    } catch (err) {
      console.error("Backend POST /student/requests/checkout failed:", err);
      const detail =
        err.response?.data?.detail ||
        err.message ||
        "Không thể gửi yêu cầu trả phòng. Vui lòng kiểm tra lại kết nối và thử lại.";
      const errorToThrow = new Error(detail);
      errorToThrow.response = err.response;
      throw errorToThrow;
    }
  },

  /**
   * Lấy danh sách lịch sử yêu cầu chuyển / trả phòng từ CSDL backend
   */
  getTransferCheckoutRequests: async () => {
    try {
      const res = await api.get("/student/requests/transfer-checkout-history");
      return Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      console.error(
        "Backend GET /student/requests/transfer-checkout-history failed:",
        err,
      );
      return [];
    }
  },

  getMyRequests: async (msv) => {
    try {
      const res = await api.get("/student/requests/my-requests", {
        params: msv ? { msv } : {},
      });
      return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
      console.error("Backend GET /student/requests/my-requests failed:", e);
      return [];
    }
  },

  getMyContracts: async (studentMsv) => {
    const currentCode = (
      studentMsv ||
      localStorage.getItem("ktx_username") ||
      localStorage.getItem("ktx_email")?.split("@")[0] ||
      ""
    ).trim().toUpperCase();

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

    // Tích hợp từ chuẩn hóa studentAccountService nếu có
    const account = getStudentAccount(currentCode);
    const accResidenceHistory = Array.isArray(account.residenceHistory) ? account.residenceHistory : [];

    if (accResidenceHistory.length > 0) {
      return accResidenceHistory.map((item, idx) => {
        const isActive = item.status === "ACTIVE" && !item.endDate;
        const roomNum = String(item.roomNumber || "").replace(/^P/i, "");
        const buildingStr = item.building || "";
        const floorStr = item.floor || (roomNum.startsWith("5") ? "5" : (roomNum[0] || "1"));
        const sDate = item.startDate || "";
        const eDate = item.endDate || "";
        const sucChua = item.suc_chua || "4 người";
        const shortBed = (item.bed || item.ma_giuong || "").split("_").pop() || "";

        return {
          id: item.id || `RES-${String(idx + 1).padStart(2, "0")}`,
          ma_hop_dong: item.ma_hop_dong || `HD26-${buildingStr.replace(/[^A-Za-z0-9]/g, "")}${roomNum}-${shortBed}`,
          msv: (account.studentId || currentCode).toUpperCase(),
          phong: roomNum ? `P${roomNum}` : "",
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
          thoi_han_hop_dong: sDate && eDate ? `${sDate} - ${eDate}` : "",
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

    return [];
  },

  getCurrentRoomInfo: async (studentMsv) => {
    const msv = (studentMsv || localStorage.getItem("ktx_username") || "").trim();
    if (!msv) return null;
    try {
      const res = await api.get('/student/requests/current-room', {
        params: { msv },
      });
      const data = res.data?.data || null;
      if (data && data.so_phong) {
        saveLocalCurrentRoomInfo(data);
        return data;
      }
      localStorage.removeItem(CURRENT_ROOM_STORAGE_KEY);
      return null;
    } catch (err) {
      console.warn('GET /student/requests/current-room failed, trying local cache:', err);
      return getLocalCurrentRoomInfo();
    }
  },

  getStudentProfile: async (studentMsv) => {
    const msv = (
      studentMsv ||
      localStorage.getItem("ktx_username") ||
      ""
    ).trim();

    if (msv) {
      try {
        const res = await api.get(`/students/${encodeURIComponent(msv)}`);
        if (res.data) {
          const sv = res.data;
          const u = sv.nguoi_dung || {};
          const profile = {
            ho_ten: sv.ho_ten || u.ho_ten || localStorage.getItem("ktx_fullname") || "",
            vai_tro: "Sinh viên",
            msv: sv.msv || msv,
            lop: sv.lop || "",
            so_dien_thoai: sv.so_dien_thoai || u.so_dien_thoai || "",
            email: sv.email || u.email || localStorage.getItem("ktx_email") || "",
            ngay_sinh: sv.ngay_sinh || "",
            gioi_tinh: sv.gioi_tinh || "",
            dan_toc: sv.dan_toc || "Kinh",
            que_quan: sv.que_quan || sv.dia_chi || "",
            dia_chi: sv.dia_chi || sv.que_quan || "",
            khoa: sv.khoa || "",
            cccd: sv.cccd || "",
            doi_tuong_uu_tien: sv.doi_tuong_uu_tien || "",
            nguoi_giam_ho: sv.nguoi_giam_ho || "",
            moi_quan_he: sv.moi_quan_he || "",
            sdt_nguoi_giam_ho: sv.sdt_nguoi_giam_ho || "",
            avatar_url: sv.anh_dai_dien || localStorage.getItem("ktx_student_avatar") || "/avatar.png",
          };
          saveLocalStudentProfile(profile);
          return profile;
        }
      } catch (err) {
        console.warn(`GET /students/${msv} failed, falling back to local profile:`, err);
      }
    }
    return getLocalStudentProfile();
  },

  uploadStudentAvatar: async (msv, file) => {
    const cleanMsv = (
      msv ||
      localStorage.getItem("ktx_username") ||
      localStorage.getItem("ktx_email")?.split("@")[0] ||
      ""
    ).trim();

    if (!cleanMsv || !file) {
      throw new Error("Thiếu mã sinh viên hoặc tệp ảnh hợp lệ.");
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post(
        `/students/${encodeURIComponent(cleanMsv)}/avatar`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      const sv = res.data;
      const avatarUrl = sv.anh_dai_dien;
      if (avatarUrl) {
        localStorage.setItem("ktx_student_avatar", avatarUrl);
        const current = getLocalStudentProfile();
        saveLocalStudentProfile({ ...current, avatar_url: avatarUrl });
        window.dispatchEvent(
          new CustomEvent("student-avatar-updated", {
            detail: { avatarUrl },
          }),
        );
      }
      return sv;
    } catch (err) {
      console.error(`POST /students/${cleanMsv}/avatar failed:`, err);
      const detail =
        err.userFriendlyMessage ||
        err.response?.data?.detail ||
        err.message ||
        "Không thể tải lên ảnh đại diện. Vui lòng kiểm tra lại kết nối mạng và thử lại sau.";
      const errorToThrow = new Error(detail);
      errorToThrow.response = err.response;
      throw errorToThrow;
    }
  },

  updateStudentProfile: async (updatedData) => {
    const msv = (
      updatedData.msv ||
      localStorage.getItem("ktx_username") ||
      ""
    ).trim();

    if (!msv) {
      throw new Error("Không xác định được mã sinh viên để cập nhật hồ sơ.");
    }

    const payload = {
      lop: updatedData.lop,
      gioi_tinh: updatedData.gioi_tinh,
      khoa: updatedData.khoa,
      dia_chi: updatedData.dia_chi || updatedData.que_quan,
      cccd: updatedData.cccd,
      ngay_sinh: updatedData.ngay_sinh,
      doi_tuong_uu_tien: updatedData.doi_tuong_uu_tien,
      nguoi_giam_ho: updatedData.nguoi_giam_ho,
      moi_quan_he: updatedData.moi_quan_he,
      sdt_nguoi_giam_ho: updatedData.sdt_nguoi_giam_ho,
      ho_ten: updatedData.ho_ten,
      email: updatedData.email,
      so_dien_thoai: updatedData.so_dien_thoai,
    };
    if (
      updatedData.avatar_url &&
      !updatedData.avatar_url.startsWith("data:")
    ) {
      payload.anh_dai_dien = updatedData.avatar_url;
    }

    try {
      const res = await api.put(`/students/${encodeURIComponent(msv)}`, payload);

      // Chỉ cập nhật bộ nhớ client khi backend đã phản hồi thành công (2xx)
      const current = getLocalStudentProfile();
      const merged = { ...current, ...updatedData };
      saveLocalStudentProfile(merged);
      window.dispatchEvent(new Event("occupancy-updated"));
      return {
        status: "success",
        message: "Cập nhật thông tin thành công!",
        data: res.data || merged,
      };
    } catch (err) {
      console.error(`PUT /students/${msv} failed:`, err);
      const detail =
        err.userFriendlyMessage ||
        err.response?.data?.detail ||
        err.message ||
        "Không thể kết nối tới máy chủ để lưu thông tin. Vui lòng thử lại sau.";
      const errorToThrow = new Error(detail);
      errorToThrow.response = err.response;
      throw errorToThrow;
    }
  },

  /**
   * Quản lý phê duyệt Yêu cầu chuyển phòng & Xếp chỗ mới
   */
  approveTransferRequest: async (id, payload) => {
    const cleanId = (id || "").trim();
    try {
      const result = await api.put(
        `/admin/occupancy/requests/transfer/${encodeURIComponent(cleanId)}/approve`,
        payload,
      );
      window.dispatchEvent(new Event("occupancy-updated"));
      return result.data;
    } catch (err) {
      console.error("Backend PUT transfer approve failed:", err);
      const detail =
        err.response?.data?.detail ||
        err.message ||
        "Không thể phê duyệt chuyển phòng. Vui lòng thử lại!";
      const errorToThrow = new Error(detail);
      errorToThrow.response = err.response;
      throw errorToThrow;
    }
  },

  /**
   * Quản lý từ chối Yêu cầu chuyển phòng
   */
  rejectTransferRequest: async (id, payload = {}) => {
    const cleanId = (id || "").trim();
    try {
      const result = await api.put(
        `/admin/occupancy/requests/transfer/${encodeURIComponent(cleanId)}/reject`,
        payload,
      );
      window.dispatchEvent(new Event("occupancy-updated"));
      return result.data;
    } catch (err) {
      console.error("Backend PUT transfer reject failed:", err);
      const detail =
        err.response?.data?.detail ||
        err.message ||
        "Không thể từ chối chuyển phòng. Vui lòng thử lại!";
      const errorToThrow = new Error(detail);
      errorToThrow.response = err.response;
      throw errorToThrow;
    }
  },

  /**
   * Quản lý phê duyệt Yêu cầu trả phòng
   */
  approveCheckoutRequest: async (id, payload = {}) => {
    const cleanId = (id || "").trim();
    try {
      const result = await api.put(
        `/admin/occupancy/requests/checkout/${encodeURIComponent(cleanId)}/approve`,
        payload,
      );
      window.dispatchEvent(new Event("occupancy-updated"));
      return result.data;
    } catch (err) {
      console.error("Backend PUT checkout approve failed:", err);
      const detail =
        err.response?.data?.detail ||
        err.message ||
        "Không thể phê duyệt trả phòng. Vui lòng thử lại!";
      const errorToThrow = new Error(detail);
      errorToThrow.response = err.response;
      throw errorToThrow;
    }
  },

  /**
   * Quản lý từ chối Yêu cầu trả phòng
   */
  rejectCheckoutRequest: async (id, payload = {}) => {
    const cleanId = (id || "").trim();
    try {
      const result = await api.put(
        `/admin/occupancy/requests/checkout/${encodeURIComponent(cleanId)}/reject`,
        payload,
      );
      window.dispatchEvent(new Event("occupancy-updated"));
      return result.data;
    } catch (err) {
      console.error("Backend PUT checkout reject failed:", err);
      const detail =
        err.response?.data?.detail ||
        err.message ||
        "Không thể từ chối trả phòng. Vui lòng thử lại!";
      const errorToThrow = new Error(detail);
      errorToThrow.response = err.response;
      throw errorToThrow;
    }
  },
};

export default occupancyService;
