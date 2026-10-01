import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Calendar,
  Search,
  AlertCircle,
  ChevronDown,
  X,
  FileText,
  Building2,
  CheckCircle2,
  Loader2,
  Home,
} from "lucide-react";
import StudentLayout from "../../layouts/Student";
import occupancyService from "../../services/occupancyService";

export default function RequestHistoryPage({ onSelectTab }) {
  // 1. Quản lý tab hiển thị: 'registration' (Lịch sử đăng ký) hoặc 'stay' (Lịch sử ở)
  const [activeTab, setActiveTab] = useState("stay");

  // 2. State dữ liệu
  const [registrationRequests, setRegistrationRequests] = useState([]);
  const [stayContracts, setStayContracts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // 3. State Bộ lọc tìm kiếm
  const [selectedSchoolYear, setSelectedSchoolYear] = useState("Tất cả");
  const [selectedStatus, setSelectedStatus] = useState("Tất cả");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // 4. State Modal xem chi tiết
  const [detailModalItem, setDetailModalItem] = useState(null);
  const [modalType, setModalType] = useState(null); // 'registration' | 'stay'

  // 5. State Chỉnh sửa nguyện vọng & Thông báo Toast
  const [isEditingWish, setIsEditingWish] = useState(false);
  const [editWishForm, setEditWishForm] = useState({
    nguyen_vong_label: "",
    nguyen_vong: "",
    loai_phong: "",
  });
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, type = "success") => {
    setToastMessage({ message: msg, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleCancelRegistration = async () => {
    if (!detailModalItem) return;
    const isConfirm = window.confirm(
      "Bạn có chắc chắn muốn hủy yêu cầu đăng ký ở này không?",
    );
    if (!isConfirm) return;

    const id = detailModalItem.id || detailModalItem.ma_yeu_cau;
    if (occupancyService.cancelRegistrationRequest) {
      await occupancyService.cancelRegistrationRequest(id);
    }

    setRegistrationRequests((prev) =>
      prev.map((r) =>
        r.id === id || r.ma_yeu_cau === id
          ? { ...r, trang_thai: "DA_HUY", trang_thai_label: "Đã hủy" }
          : r,
      ),
    );

    setDetailModalItem((prev) =>
      prev
        ? { ...prev, trang_thai: "DA_HUY", trang_thai_label: "Đã hủy" }
        : null,
    );

    showToast("Đã hủy yêu cầu đăng ký thành công!", "info");
  };

  const handleOpenEditWish = () => {
    if (!detailModalItem) return;
    const { loaiPhong, chiTietNguyenVong } =
      getRegistrationPreferences(detailModalItem);
    setEditWishForm({
      nguyen_vong_label:
        detailModalItem.nguyen_vong_label ||
        (detailModalItem.phong
          ? `${detailModalItem.phong} - Tầng ${detailModalItem.tang || "3"} - Tòa ${detailModalItem.toa || "A2"}`
          : "P36 - Tầng 3 - Tòa A2"),
      nguyen_vong: chiTietNguyenVong,
      loai_phong: detailModalItem.loai_phong || loaiPhong || "Phòng tiêu chuẩn",
    });
    setIsEditingWish(true);
  };

  const handleSaveWish = async () => {
    if (!detailModalItem) return;
    const id = detailModalItem.id || detailModalItem.ma_yeu_cau;
    if (occupancyService.updateRegistrationWish) {
      await occupancyService.updateRegistrationWish(id, editWishForm);
    }

    setRegistrationRequests((prev) =>
      prev.map((r) =>
        r.id === id || r.ma_yeu_cau === id ? { ...r, ...editWishForm } : r,
      ),
    );

    setDetailModalItem((prev) => (prev ? { ...prev, ...editWishForm } : null));

    setIsEditingWish(false);
    showToast("Cập nhật nguyện vọng đăng ký thành công!", "success");
  };

  // Tải dữ liệu ban đầu và lắng nghe cập nhật realtime
  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };
    window.addEventListener("occupancy-updated", handleUpdate);
    return () => {
      window.removeEventListener("occupancy-updated", handleUpdate);
    };
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [reqs, contracts, transferReqs] = await Promise.all([
        occupancyService.getMyRequests(),
        occupancyService.getMyContracts(),
        occupancyService.getTransferCheckoutRequests?.(),
      ]);

      const combinedReqs = [...(reqs || [])];
      if (transferReqs && Array.isArray(transferReqs)) {
        transferReqs.forEach((tc) => {
          if (
            !combinedReqs.some(
              (r) => r.id === tc.id || r.ma_yeu_cau === tc.ma_yeu_cau,
            )
          ) {
            combinedReqs.push({
              ...tc,
              ngay_dang_ky: tc.ngay_gui || "Hôm nay",
              loai_phong:
                tc.loai_yeu_cau ||
                (tc.loai_don === "TRA_PHONG" ? "Trả phòng" : "Chuyển phòng"),
              tang_mong_muon: tc.phong_lien_quan || "Tầng 2",
              muc_gia_mong_muon: tc.ly_do || "Phòng tiêu chuẩn",
              nam_hoc: "2026-2027",
            });
          }
        });
      }

      // Chuẩn hóa dữ liệu đơn đăng ký nếu chưa có
      if (combinedReqs.length > 0) {
        setRegistrationRequests(combinedReqs);
      } else {
        setRegistrationRequests([
          {
            id: "DK2026-0148",
            ma_yeu_cau: "#DK2026-0148",
            msv: "DTCxxxxxxxx",
            ho_ten: "Nguyễn Văn A",
            gioi_tinh: "Nữ",
            ngay_sinh: "21/01/2006",
            cccd: "01xxxxxxxxxx",
            so_dien_thoai: "09xxxxxxxx",
            email: "DTCxxxxxxxx",
            khoa: "CNTT",
            lop: "CNTT K23A",
            dia_chi: "Xã A - Tỉnh Hải Dương",
            doi_tuong_uu_tien: "Không thuộc diện ưu tiên",
            nguoi_giam_ho: "Nguyễn Văn B",
            moi_quan_he: "Bố",
            sdt_nguoi_giam_ho: "09xxxxxxxx",
            nguyen_vong: "Em có nguyện vọng ở tòa A2, em xin cảm ơn",
            nguyen_vong_phong: "P36",
            nguyen_vong_label: "P36 - Tầng 3 - Tòa A2",
            loai_phong: "Phòng tiêu chuẩn",
            tang_mong_muon: "Tầng 3",
            muc_gia_mong_muon: "12.000.000 đ/năm",
            nam_hoc: "2026-2027",
            ngay_dang_ky: "25/08/2026",
            ngay_gui: "25/08/2026 09:12",
            ngay_tiep_nhan: "26/08/2026 14:30",
            ngay_du_kien: "05/09/2026",
            trang_thai: "CHO_DUYET",
            trang_thai_label: "Đang xét duyệt",
          },
        ]);
      }

      // Chuẩn hóa dữ liệu lịch sử ở nếu chưa có
      if (contracts && contracts.length > 0) {
        setStayContracts(contracts);
      } else {
        setStayContracts([
          {
            id: "HD26-A2P36-G07",
            ma_hop_dong: "HD26-A2P36-G07",
            phong: "P36",
            toa: "A2",
            tang: "3",
            giuong: "G7",
            thoi_gian_o: "2026-2027",
            nam_hoc: "2026-2027",
            trang_thai: "DANG_O",
            trang_thai_label: "Đang ở",
          },
        ]);
      }
    } catch (err) {
      console.error("Error loading history data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Đọc nội dung mới, đồng thời gom dữ liệu tầng/ngân sách cũ thành một chuỗi.
  const getRegistrationPreferences = (req) => {
    // 1. Loại phòng
    let loaiPhong = req.loai_phong;
    if (!loaiPhong) {
      if (req.nguyen_vong?.includes("dịch vụ")) {
        loaiPhong = "Phòng dịch vụ";
      } else {
        loaiPhong = "Phòng tiêu chuẩn";
      }
    }

    const legacyWish = [
      req.nguyen_vong_label,
      req.tang_mong_muon,
      req.muc_gia_mong_muon || req.ngan_sach,
    ]
      .filter(Boolean)
      .join(" - ");
    const chiTietNguyenVong =
      req.nguyen_vong?.trim() ||
      req.noi_dung_nguyen_vong?.trim() ||
      legacyWish ||
      "Chưa có chi tiết nguyện vọng";

    return { loaiPhong, chiTietNguyenVong };
  };

  // Lọc dữ liệu Lịch sử đăng ký
  const filteredRegistrationList = useMemo(() => {
    return registrationRequests.filter((item) => {
      // Lọc theo năm học
      if (selectedSchoolYear !== "Tất cả") {
        const itemYear = item.nam_hoc || "2026-2027";
        if (!itemYear.includes(selectedSchoolYear)) return false;
      }

      // Lọc theo trạng thái
      if (selectedStatus !== "Tất cả") {
        const itemStatus = item.trang_thai_label || item.trang_thai || "";
        if (
          selectedStatus === "Đang xét duyệt" &&
          !itemStatus.includes("xét duyệt") &&
          !itemStatus.includes("CHO_DUYET")
        ) {
          return false;
        }
        if (
          selectedStatus === "Đã duyệt" &&
          !itemStatus.includes("Đã duyệt") &&
          !itemStatus.includes("DA_DUYET")
        ) {
          return false;
        }
        if (
          selectedStatus === "Từ chối" &&
          !itemStatus.includes("Từ chối") &&
          !itemStatus.includes("TU_CHOI")
        ) {
          return false;
        }
      }

      return true;
    });
  }, [registrationRequests, selectedSchoolYear, selectedStatus]);

  // Lọc dữ liệu Lịch sử ở
  const filteredStayList = useMemo(() => {
    return stayContracts.filter((item) => {
      // Lọc theo năm học
      if (selectedSchoolYear !== "Tất cả") {
        const itemYear = item.nam_hoc || item.thoi_gian_o || "2026-2027";
        if (!itemYear.includes(selectedSchoolYear)) return false;
      }

      // Lọc theo trạng thái
      if (selectedStatus !== "Tất cả") {
        const itemStatus = item.trang_thai_label || item.trang_thai || "";
        if (
          selectedStatus === "Đang ở" &&
          !itemStatus.includes("Đang ở") &&
          !itemStatus.includes("DANG_O")
        ) {
          return false;
        }
        if (
          selectedStatus === "Đã kết thúc" &&
          !itemStatus.includes("Đã kết thúc") &&
          !itemStatus.includes("KET_THUC")
        ) {
          return false;
        }
      }

      return true;
    });
  }, [stayContracts, selectedSchoolYear, selectedStatus]);

  return (
    <StudentLayout
      activeTab="history"
      onSelectTab={onSelectTab}
      userRole="Sinh viên"
    >
      {/* Khung nền trắng bo góc lớn đồng bộ toàn hệ thống */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 lg:p-8 flex flex-col gap-6">
        {/* 1. Header tiêu đề trang chuẩn Figma */}
        <div className="flex items-center gap-3 select-none">
          <div className="w-10 h-10 rounded-full border-2 border-blue-600 flex items-center justify-center text-blue-600 shrink-0">
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1e3a8a] tracking-tight">
              Lịch sử
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Theo dõi các yêu cầu đăng ký và quá trình ở KTX của bạn
            </p>
          </div>
        </div>

        {/* 2. Tab Switcher: Lịch sử đăng ký | Lịch sử ở (Chuẩn Figma với viền bo tròn) */}
        <div className="inline-flex items-center p-1 rounded-2xl border border-blue-200/80 bg-white shadow-2xs select-none w-fit">
          <button
            type="button"
            onClick={() => {
              setActiveTab("registration");
              setSelectedStatus("Tất cả");
            }}
            className={`px-7 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "registration"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-blue-600 hover:bg-blue-50/50"
            }`}
          >
            Lịch sử đăng ký
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("stay");
              setSelectedStatus("Tất cả");
            }}
            className={`px-7 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "stay"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-blue-600 hover:bg-blue-50/50"
            }`}
          >
            Lịch sử ở
          </button>
        </div>

        {/* 3. Thanh Bộ lọc tìm kiếm (Khối bo góc nền xanh nhạt bg-blue-50/50 chuẩn Figma) */}
        <div className="bg-[#edf5fe] border border-blue-100 rounded-2xl p-5 sm:p-6 shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            {/* Trường 1: Năm học */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Năm học
              </label>
              <div className="relative">
                <select
                  value={selectedSchoolYear}
                  onChange={(e) => setSelectedSchoolYear(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition appearance-none cursor-pointer pr-10 shadow-2xs"
                >
                  <option value="Tất cả">Tất cả</option>
                  <option value="2026-2027">2026–2027</option>
                  <option value="2025-2026">2025–2026</option>
                  <option value="2024-2025">2024–2025</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Trường 2: Trạng thái */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Trạng thái
              </label>
              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition appearance-none cursor-pointer pr-10 shadow-2xs"
                >
                  <option value="Tất cả">Tất cả</option>
                  {activeTab === "registration" ? (
                    <>
                      <option value="Đang xét duyệt">Đang xét duyệt</option>
                      <option value="Đã duyệt">Đã duyệt</option>
                      <option value="Từ chối">Từ chối</option>
                    </>
                  ) : (
                    <>
                      <option value="Đang ở">Đang ở</option>
                      <option value="Đã kết thúc">Đã kết thúc</option>
                    </>
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Trường 3: Từ ngày */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Từ ngày
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  placeholder="dd/mm/yyyy"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition cursor-pointer shadow-2xs"
                />
              </div>
            </div>

            {/* Trường 4: Đến ngày */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Đến ngày
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  placeholder="dd/mm/yyyy"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition cursor-pointer shadow-2xs"
                />
              </div>
            </div>

            {/* Nút Tìm kiếm */}
            <div>
              <button
                type="button"
                onClick={loadData}
                className="w-full px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Tìm kiếm</span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 4. Khối Bảng Dữ liệu chính: Tiêu đề xanh, các hàng màu trắng, không khoảng cách giữa các hàng */}
        <div className="border border-blue-100 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            {/* ================================================================= */}
            {/* TAB 1: LỊCH SỬ ĐĂNG KÝ */}
            {/* ================================================================= */}
            {activeTab === "registration" && (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="bg-[#edf5fe]">
                  <tr className="text-sm font-semibold text-slate-600 select-none">
                    <th className="py-3.5 px-5 w-16">STT</th>
                    <th className="py-3.5 px-4">Ngày đăng ký</th>
                    <th className="py-3.5 px-4">Loại phòng</th>
                    <th className="py-3.5 px-4">Chi tiết nguyện vọng</th>
                    <th className="py-3.5 px-4">Năm học</th>
                    <th className="py-3.5 px-4">Trạng thái</th>
                    <th className="py-3.5 px-5 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100 text-sm">
                  {filteredRegistrationList.length > 0 ? (
                    filteredRegistrationList.map((req, idx) => {
                      const rowKey = req.id || idx;
                      const { loaiPhong, chiTietNguyenVong } =
                        getRegistrationPreferences(req);
                      const isApproved =
                        req.trang_thai === "DA_DUYET" ||
                        req.trang_thai_label === "Đã duyệt";
                      const isRejected =
                        req.trang_thai === "TU_CHOI" ||
                        req.trang_thai_label === "Từ chối";

                      return (
                        <tr
                          key={rowKey}
                          className="hover:bg-[#f8faff] transition-colors duration-150"
                        >
                          {/* STT */}
                          <td className="py-3.5 px-5 font-semibold text-slate-800">
                            {idx + 1}
                          </td>

                          {/* Ngày đăng ký */}
                          <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                            {req.ngay_dang_ky || "25/08/2026"}
                          </td>

                          {/* Loại phòng (Thông tin 1) */}
                          <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                            {loaiPhong}
                          </td>

                          {/* Chi tiết nguyện vọng */}
                          <td className="py-3.5 px-4 text-slate-700">
                            <span
                              className="block max-w-sm truncate"
                              title={chiTietNguyenVong}
                            >
                              {chiTietNguyenVong}
                            </span>
                          </td>

                          {/* Năm học */}
                          <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                            {req.nam_hoc || "2026–2027"}
                          </td>

                          {/* Trạng thái (Pill badge bo tròn bg-emerald-50 text-emerald-600 khi Đã duyệt) */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {isApproved ? (
                              <span className="inline-block px-4 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200/60 shadow-2xs">
                                Đã duyệt
                              </span>
                            ) : isRejected ? (
                              <span className="inline-block px-4 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200/60 shadow-2xs">
                                Từ chối
                              </span>
                            ) : (
                              <span className="inline-block px-4 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200/60 shadow-2xs">
                                {req.trang_thai_label || "Chờ duyệt"}
                              </span>
                            )}
                          </td>

                          {/* Thao tác (Nút Xem viền xanh) */}
                          <td className="py-3.5 px-5 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setDetailModalItem({
                                  ...req,
                                  loai_phong: loaiPhong,
                                  nguyen_vong: chiTietNguyenVong,
                                });
                                setModalType("registration");
                              }}
                              className="px-5 py-1.5 border border-blue-500 text-blue-500 hover:bg-white text-sm font-semibold rounded-xl transition cursor-pointer"
                            >
                              Xem
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-10 text-center text-slate-400 text-sm"
                      >
                        Không tìm thấy yêu cầu đăng ký nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* ================================================================= */}
            {/* TAB 2: LỊCH SỬ Ở (Hàng tiêu đề xanh, hàng dữ liệu trắng)        */}
            {/* ================================================================= */}
            {activeTab === "stay" && (
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead className="bg-[#edf5fe]">
                  <tr className="text-sm font-semibold text-slate-600 select-none">
                    <th className="py-3.5 px-5 w-16">STT</th>
                    <th className="py-3.5 px-4">Phòng</th>
                    <th className="py-3.5 px-4">Tòa</th>
                    <th className="py-3.5 px-4">Tầng</th>
                    <th className="py-3.5 px-4">Giường</th>
                    <th className="py-3.5 px-4">thời gian ở</th>
                    <th className="py-3.5 px-4">Trạng thái</th>
                    <th className="py-3.5 px-5 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100 text-sm">
                  {filteredStayList.length > 0 ? (
                    filteredStayList.map((stay, idx) => (
                      <tr
                        key={stay.id || idx}
                        className="hover:bg-[#f8faff] transition-colors duration-150"
                      >
                        {/* STT */}
                        <td className="py-3.5 px-5 font-semibold text-slate-800">
                          {idx + 1}
                        </td>

                        {/* Phòng */}
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {stay.phong || "P36"}
                        </td>

                        {/* Tòa */}
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {stay.toa || "A2"}
                        </td>

                        {/* Tầng */}
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {stay.tang || "3"}
                        </td>

                        {/* Giường */}
                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          {stay.giuong || "G7"}
                        </td>

                        {/* thời gian ở */}
                        <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                          {stay.thoi_gian_o || stay.nam_hoc || "2026-2027"}
                        </td>

                        {/* Trạng thái (Pill badge Đang ở / Đã trả phòng / Đã chuyển) */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {stay.trang_thai === "DA_TRA_PHONG" ||
                          stay.trang_thai_label?.includes("trả") ? (
                            <span className="inline-block px-4 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {stay.trang_thai_label ||
                                "Đã trả phòng / Đã rời KTX"}
                            </span>
                          ) : stay.trang_thai === "DA_CHUYEN" ||
                            stay.trang_thai_label?.includes("chuyển") ? (
                            <span className="inline-block px-4 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              {stay.trang_thai_label || "Đã chuyển phòng"}
                            </span>
                          ) : (
                            <span className="inline-block px-4 py-1 rounded-full text-xs font-bold bg-[#bbf7d0] text-[#15803d]">
                              {stay.trang_thai_label || "Đang ở"}
                            </span>
                          )}
                        </td>

                        {/* Thao tác (Nút Xem viền xanh) */}
                        <td className="py-3.5 px-5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setDetailModalItem(stay);
                              setModalType("stay");
                            }}
                            className="px-5 py-1.5 border border-blue-500 text-blue-500 hover:bg-blue-50 text-sm font-semibold rounded-xl transition cursor-pointer"
                          >
                            Xem
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-10 text-center text-slate-400 text-sm"
                      >
                        Không tìm thấy thông tin lịch sử ở nào phù hợp với bộ
                        lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 5. Khối Banner "Lưu ý" (Dưới cùng chuẩn Figma với Icon Chatbot bên phải) */}
        <div className="bg-[#edf5fe] border border-blue-100 rounded-2xl p-5 sm:p-6 flex items-center justify-between shadow-2xs relative overflow-hidden pr-20 md:pr-24">
          <div className="flex items-start gap-4">
            <div className="text-blue-600 shrink-0 mt-0.5">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div className="space-y-1 text-xs sm:text-[13px] leading-relaxed text-slate-700">
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                Lưu ý:
              </h4>
              <p>
                Trạng thái "Chờ xác nhận" nghĩa là yêu cầu của bạn đã được gửi
                đến quản lý KTX và đang được xem xét
              </p>
              <p>
                Khi được xác nhận, bạn sẽ nhận được thông báo trên hệ thống.
              </p>
              <p>Nếu bị từ chối, bạn có thể đăng ký phòng khác.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL XEM CHI TIẾT ĐƠN ĐĂNG KÝ (Đầy đủ thông tin chuẩn giao diện)      */}
      {/* ===================================================================== */}
      {detailModalItem &&
        modalType === "registration" &&
        (() => {
          const rawCode =
            detailModalItem.ma_yeu_cau || detailModalItem.id || "DK2026-0148";
          const displayCode = rawCode.startsWith("#")
            ? rawCode.slice(1)
            : rawCode;
          const displayDate = detailModalItem.ngay_dang_ky || "25/08/2026";
          const displaySchoolYear = detailModalItem.nam_hoc || "2026-2027";

          const isApproved =
            detailModalItem.trang_thai === "DA_DUYET" ||
            detailModalItem.trang_thai_label === "Đã duyệt";
          const isRejected =
            detailModalItem.trang_thai === "TU_CHOI" ||
            detailModalItem.trang_thai_label === "Từ chối";
          const isCancelled =
            detailModalItem.trang_thai === "DA_HUY" ||
            detailModalItem.trang_thai_label === "Đã hủy";

          // 1. Thông tin sinh viên
          const studentMsv = detailModalItem.msv || "DTCxxxxxxxx";
          const studentName = detailModalItem.ho_ten || "Nguyễn Văn A";
          const studentGender = detailModalItem.gioi_tinh || "Nữ";
          const studentDob = detailModalItem.ngay_sinh || "21/01/2006";
          const studentCccd = detailModalItem.cccd || "01xxxxxxxxxx";
          const studentPhone = detailModalItem.so_dien_thoai || "09xxxxxxxx";
          const studentEmail = detailModalItem.email || "DTCxxxxxxxx";
          const studentFaculty = detailModalItem.khoa || "CNTT";
          const studentClass = detailModalItem.lop || "CNTT K23A";
          const studentAddress =
            detailModalItem.dia_chi || "Xã A - Tỉnh Hải Dương";

          // 2. Liên hệ khẩn cấp
          const guardianName = detailModalItem.nguoi_giam_ho || "Nguyễn Văn B";
          const guardianRelation = detailModalItem.moi_quan_he || "Bố";
          const guardianPhone =
            detailModalItem.sdt_nguoi_giam_ho || "09xxxxxxxx";

          // 3. Nguyện vọng đăng ký
          const { loaiPhong: wishRoomType, chiTietNguyenVong: wishContent } =
            getRegistrationPreferences(detailModalItem);

          // 4. Tiến trình xử lý
          const submissionTime =
            detailModalItem.ngay_gui_time || `${displayDate}  09:12`;
          const receivedTime =
            detailModalItem.ngay_tiep_nhan || "26/08/2026  14:30";
          const estimatedTime = detailModalItem.ngay_du_kien || "05/09/2026";

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl max-w-xl sm:max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-slate-200/80 max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
                {/* Header Modal */}
                <div className="flex items-start justify-between pb-3 select-none">
                  <div>
                    <h3 className="font-bold text-lg sm:text-xl text-slate-900 tracking-tight">
                      Yêu cầu đăng ký ở #{displayCode}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      Gửi ngày {displayDate} - Năm học {displaySchoolYear}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailModalItem(null)}
                    className="w-8 h-8 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Status pill badge */}
                <div className="mb-3.5">
                  {isApproved ? (
                    <span className="inline-block px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                      Đã duyệt
                    </span>
                  ) : isRejected ? (
                    <span className="inline-block px-3.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                      Từ chối
                    </span>
                  ) : isCancelled ? (
                    <span className="inline-block px-3.5 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                      Đã hủy
                    </span>
                  ) : (
                    <span className="inline-block px-3.5 py-1 rounded-full text-xs font-semibold bg-[#fef9c3] text-[#ca8a04]">
                      {detailModalItem.trang_thai_label || "Đang xét duyệt"}
                    </span>
                  )}
                </div>

                {/* Scrollable Modal Content */}
                <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 space-y-4 text-xs sm:text-sm">
                  {/* 1. THÔNG TIN SINH VIÊN */}
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 mb-3">
                      Thông tin sinh viên
                    </h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <div>
                        <span className="text-slate-400 text-xs block mb-0.5">
                          Mã sinh viên
                        </span>
                        <span className="font-semibold text-slate-800">
                          {studentMsv}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs block mb-0.5">
                          Họ và tên
                        </span>
                        <span className="font-semibold text-slate-800">
                          {studentName}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs block mb-0.5">
                          Giới tính
                        </span>
                        <span className="font-semibold text-slate-800">
                          {studentGender}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs block mb-0.5">
                          Ngày sinh
                        </span>
                        <span className="font-semibold text-slate-800">
                          {studentDob}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs block mb-0.5">
                          Số CCCD / Định danh
                        </span>
                        <span className="font-semibold text-slate-800">
                          {studentCccd}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs block mb-0.5">
                          Số điện thoại
                        </span>
                        <span className="font-semibold text-slate-800">
                          {studentPhone}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs block mb-0.5">
                          Email
                        </span>
                        <span className="font-semibold text-slate-800">
                          {studentEmail}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs block mb-0.5">
                          Khoa / Viện
                        </span>
                        <span className="font-semibold text-slate-800">
                          {studentFaculty}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs block mb-0.5">
                          Lớp chuyên ngành
                        </span>
                        <span className="font-semibold text-slate-800">
                          {studentClass}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs block mb-0.5">
                          Địa chỉ
                        </span>
                        <span className="font-semibold text-slate-800">
                          {studentAddress}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. LIÊN HỆ KHẨN CẤP */}
                  <div className="pt-3.5 border-t border-slate-100">
                    <h4 className="font-bold text-sm text-slate-800 mb-3">
                      Liên hệ khẩn cấp
                    </h4>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <div>
                        <span className="text-slate-400 text-xs block mb-0.5">
                          Họ và tên người giám hộ
                        </span>
                        <span className="font-semibold text-slate-800">
                          {guardianName}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs block mb-0.5">
                          Mối liên hệ
                        </span>
                        <span className="font-semibold text-slate-800">
                          {guardianRelation}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-xs block mb-0.5">
                          Số điện thoại
                        </span>
                        <span className="font-semibold text-slate-800">
                          {guardianPhone}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. NGUYỆN VỌNG ĐĂNG KÝ */}
                  <div className="pt-3.5 border-t border-slate-100 space-y-3">
                    <h4 className="font-bold text-sm text-slate-800">
                      Nguyện vọng đăng ký
                    </h4>

                    <div className="rounded-xl border border-blue-100 bg-[#f0f7ff] p-4 space-y-3">
                      <div>
                        <span className="block text-xs text-slate-500">
                          Loại phòng
                        </span>
                        <span className="font-semibold text-slate-800">
                          {detailModalItem.loai_phong || wishRoomType}
                        </span>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                        <span className="mb-1.5 block text-xs font-medium text-slate-500">
                          Chi tiết nguyện vọng
                        </span>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                          {wishContent}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 4. TIẾN TRÌNH XỬ LÝ */}
                  <div className="pt-3.5 border-t border-slate-100">
                    <h4 className="font-bold text-sm text-slate-800 mb-4">
                      Tiến trình xử lý
                    </h4>

                    <div className="space-y-1">
                      {/* Step 1: Đã gửi yêu cầu */}
                      <div className="flex items-start gap-3.5">
                        <div className="flex flex-col items-center">
                          <div className="w-5 h-5 rounded-full bg-blue-500 ring-4 ring-blue-100 flex items-center justify-center shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          </div>
                          <div className="w-0.5 h-10 bg-blue-400 my-0.5" />
                        </div>
                        <div className="-mt-0.5">
                          <h5 className="font-bold text-slate-800 text-xs sm:text-sm">
                            Đã gửi yêu cầu
                          </h5>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Sinh viên hoàn tất đăng ký
                          </p>
                          <span className="text-[11px] text-slate-400 mt-0.5 block">
                            {submissionTime}
                          </span>
                        </div>
                      </div>

                      {/* Step 2: Phòng quản lý KTX tiếp nhận */}
                      <div className="flex items-start gap-3.5">
                        <div className="flex flex-col items-center">
                          <div className="w-5 h-5 rounded-full bg-blue-500 ring-4 ring-blue-100 flex items-center justify-center shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          </div>
                          <div className="w-0.5 h-10 bg-slate-200 my-0.5" />
                        </div>
                        <div className="-mt-0.5">
                          <h5 className="font-bold text-slate-800 text-xs sm:text-sm">
                            Phòng quản lý KTX tiếp nhận
                          </h5>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Hồ sơ đã được kiểm tra hợp lệ
                          </p>
                          <span className="text-[11px] text-slate-400 mt-0.5 block">
                            {receivedTime}
                          </span>
                        </div>
                      </div>

                      {/* Step 3: Đang xét duyệt */}
                      <div className="flex items-start gap-3.5">
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-5 h-5 rounded-full shrink-0 ${
                              isApproved
                                ? "bg-emerald-500 ring-4 ring-emerald-100 flex items-center justify-center"
                                : isRejected
                                  ? "bg-rose-500 ring-4 ring-rose-100 flex items-center justify-center"
                                  : "border-2 border-slate-400 bg-white"
                            }`}
                          >
                            {(isApproved || isRejected) && (
                              <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            )}
                          </div>
                        </div>
                        <div className="-mt-0.5">
                          <h5 className="font-bold text-slate-800 text-xs sm:text-sm">
                            {isApproved
                              ? "Đã phê duyệt"
                              : isRejected
                                ? "Từ chối duyệt"
                                : "Đang xét duyệt"}
                          </h5>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {isApproved
                              ? "Phòng đã được phân bổ thành công"
                              : isRejected
                                ? detailModalItem.ly_do_tu_choi ||
                                  "Không đủ điều kiện hoặc số lượng phòng đã đầy"
                                : "Chờ bố trí phòng hợp lệ"}
                          </p>
                          <span className="text-[11px] text-slate-400 mt-0.5 block">
                            {isApproved
                              ? "Đã hoàn tất duyệt"
                              : isRejected
                                ? "Đã xử lý"
                                : `Dự kiến trước ${estimatedTime}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-end gap-3 select-none">
                  <button
                    type="button"
                    onClick={handleCancelRegistration}
                    className="px-5 py-2 border border-red-500 text-red-500 hover:bg-red-50 font-semibold text-xs sm:text-sm rounded-xl transition cursor-pointer"
                  >
                    Hủy yêu cầu
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenEditWish}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition cursor-pointer"
                  >
                    Chỉnh sửa nguyện vọng
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ===================================================================== */}
      {/* MODAL PHỤ: CHỈNH SỬA NGUYỆN VỌNG PHÒNG                                */}
      {/* ===================================================================== */}
      {isEditingWish && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="font-bold text-base text-slate-900">
                Chỉnh sửa nguyện vọng
              </h4>
              <button
                type="button"
                onClick={() => setIsEditingWish(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="mb-1.5 block font-semibold text-slate-700">
                  Loại phòng
                </label>
                <select
                  value={editWishForm.loai_phong}
                  onChange={(e) =>
                    setEditWishForm((prev) => ({
                      ...prev,
                      loai_phong: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="Phòng tiêu chuẩn">Phòng tiêu chuẩn</option>
                  <option value="Phòng dịch vụ">Phòng dịch vụ</option>
                  <option value="Phòng chất lượng cao">
                    Phòng chất lượng cao
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block font-semibold text-slate-700">
                  Chi tiết nguyện vọng
                </label>
                <textarea
                  rows={5}
                  value={editWishForm.nguyen_vong}
                  onChange={(e) =>
                    setEditWishForm((prev) => ({
                      ...prev,
                      nguyen_vong: e.target.value,
                    }))
                  }
                  className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Hãy nhập nội dung nguyện vọng của bạn..."
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsEditingWish(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveWish}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition cursor-pointer"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thông báo Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-70 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-2xl text-xs sm:text-sm animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage.message}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL XEM CHI TIẾT QUÁ TRÌNH Ở / HỢP ĐỒNG (CHUẨN 100% THEO THIẾT KẾ)   */}
      {/* ===================================================================== */}
      {detailModalItem &&
        modalType === "stay" &&
        (() => {
          const roomRaw = detailModalItem.phong || "P36";
          const cleanRoom = roomRaw.replace(/^P/i, "");
          const building = detailModalItem.toa
            ? detailModalItem.toa.startsWith("Tòa")
              ? detailModalItem.toa
              : `Tòa ${detailModalItem.toa}`
            : "Tòa A2";
          const schoolYear =
            detailModalItem.nam_hoc ||
            detailModalItem.thoi_gian_o ||
            "2026-2027";

          const roommates = detailModalItem.ban_cung_phong || [
            {
              name: "Trần Thị Ánh",
              bed: "G1",
              major: "CNTT",
              date: "03/09/2026",
            },
            {
              name: "Trịnh Thị Mai Anh",
              bed: "G2",
              major: "CNTrT",
              date: "03/09/2026",
            },
            {
              name: "Đinh Ngọc Ánh",
              bed: "G3",
              major: "KTCN",
              date: "03/09/2026",
            },
            {
              name: "Nguyễn Mai Trang",
              bed: "G4",
              major: "TTDPT",
              date: "03/09/2026",
            },
            {
              name: "Nguyễn Ngọc Lý",
              bed: "G5",
              major: "CNTT",
              date: "03/09/2026",
            },
            {
              name: "Đinh Thùy Dung",
              bed: "G6",
              major: "TKĐH",
              date: "03/09/2026",
            },
            {
              name: "Đinh Như Quỳnh",
              bed: "G8",
              major: "TKĐH",
              date: "03/09/2026",
            },
          ];

          const handleCheckout = () => {
            setDetailModalItem(null);
            window.history.pushState(
              {},
              "",
              "/student/transfer-room?tab=checkout",
            );
            window.dispatchEvent(new PopStateEvent("popstate"));
          };

          const handleTransfer = () => {
            setDetailModalItem(null);
            window.history.pushState(
              {},
              "",
              "/student/transfer-room?tab=transfer",
            );
            window.dispatchEvent(new PopStateEvent("popstate"));
          };

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                      Phòng {cleanRoom} - {building}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 font-normal mt-0.5">
                      Năm học {schoolYear}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailModalItem(null)}
                    className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5 stroke-[2.5]" />
                  </button>
                </div>

                {/* Status Badge */}
                <div className="mt-3">
                  <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold bg-[#dcfce7] text-[#16a34a]">
                    {detailModalItem.trang_thai_label || "Đang ở"}
                  </span>
                </div>

                {/* Section: Thông tin chỗ ở */}
                <div className="mt-4">
                  <div className="text-xs font-medium text-slate-400 italic mb-2.5">
                    Thông tin chỗ ở
                  </div>

                  {/* 4 Cards Grid */}
                  <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
                    <div className="bg-[#f8fafc] border border-slate-100 rounded-xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center">
                      <span className="text-base sm:text-lg font-bold text-slate-900 leading-none">
                        {detailModalItem.toa?.replace(/^Tòa\s*/i, "") || "A2"}
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1">
                        Tòa
                      </span>
                    </div>

                    <div className="bg-[#f8fafc] border border-slate-100 rounded-xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center">
                      <span className="text-base sm:text-lg font-bold text-slate-900 leading-none">
                        {detailModalItem.tang || "3"}
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1">
                        Tầng
                      </span>
                    </div>

                    <div className="bg-[#f8fafc] border border-slate-100 rounded-xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center">
                      <span className="text-base sm:text-lg font-bold text-slate-900 leading-none">
                        {detailModalItem.phong || "P36"}
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1">
                        Phòng
                      </span>
                    </div>

                    <div className="bg-[#f8fafc] border border-slate-100 rounded-xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-center">
                      <span className="text-base sm:text-lg font-bold text-slate-900 leading-none">
                        {detailModalItem.giuong || "G7"}
                      </span>
                      <span className="text-[11px] text-slate-400 mt-1">
                        Giường
                      </span>
                    </div>
                  </div>

                  {/* Chi tiết 2x2 */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4 text-xs sm:text-[13px]">
                    <div>
                      <span className="text-slate-400 block text-[11px]">
                        Loại phòng
                      </span>
                      <span className="font-semibold text-slate-900 mt-0.5 block">
                        {detailModalItem.loai_phong || "Điều hòa, nóng lạnh"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">
                        Sức chứa
                      </span>
                      <span className="font-semibold text-slate-900 mt-0.5 block">
                        {detailModalItem.suc_chua || "8 người"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">
                        Ngày nhận phòng
                      </span>
                      <span className="font-semibold text-slate-900 mt-0.5 block">
                        {detailModalItem.ngay_nhan_phong || "03/09/2026"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">
                        Thời hạn hợp đồng
                      </span>
                      <span className="font-semibold text-slate-900 mt-0.5 block">
                        {detailModalItem.thoi_han_hop_dong ||
                          "03/09/ 2026 – 03/08/ 2027"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 my-4" />

                {/* Section: Bạn cùng phòng (7) */}
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 mb-2">
                    Bạn cùng phòng ({roommates.length})
                  </h4>
                  <div className="divide-y divide-slate-100">
                    {roommates.map((rm, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-2 text-xs sm:text-[13px]"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 leading-tight">
                            {rm.name}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {rm.bed} – {rm.major}
                          </div>
                        </div>
                        <span className="text-[11px] sm:text-xs text-slate-400">
                          {rm.date}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-100 my-4" />

                {/* Section: Lịch sử chỗ ở */}
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 mb-3">
                    Lịch sử chỗ ở
                  </h4>
                  <div className="relative pl-6 space-y-4">
                    {/* Vertical connecting line */}
                    <div className="absolute left-[7px] top-[9px] bottom-[18px] w-[2px] bg-blue-400" />

                    {/* Timeline Item 1 */}
                    <div className="relative">
                      <span className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-blue-600 ring-4 ring-blue-100 z-10" />
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                          Nhận phòng
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Bàn giao phòng
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          25/08/2026 09:12
                        </div>
                      </div>
                    </div>

                    {/* Timeline Item 2 */}
                    <div className="relative">
                      <span className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-blue-600 ring-4 ring-blue-100 z-10" />
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                          Đang ở
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Hợp đồng có hiệu lực đến 03/08/2027
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-6 pt-3 flex items-center justify-end gap-3 border-t border-slate-100/50">
                  <button
                    type="button"
                    onClick={handleCheckout}
                    className="px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold border border-red-500 text-red-500 hover:bg-red-50 transition cursor-pointer"
                  >
                    Yêu cầu trả phòng
                  </button>
                  <button
                    type="button"
                    onClick={handleTransfer}
                    className="px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-[#0084ff] hover:bg-blue-600 text-white shadow-sm transition cursor-pointer"
                  >
                    Yêu cầu chuyển phòng
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </StudentLayout>
  );
}
