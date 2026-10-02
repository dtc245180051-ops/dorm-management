import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeftRight,
  Calendar,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
} from "lucide-react";
import StudentLayout from "../../layouts/Student";
import occupancyService from "../../services/occupancyService";
import { VIETNAM_PROVINCES } from "../../data/vietnamAddressData";
import FeatureLockedNotice from "../../components/FeatureLockedNotice";
import { resolveStudentStatus, STUDENT_STATUS } from "../../services/studentStatusService";

export default function RoomTransferPage({ onSelectTab, onNavigate }) {
  // 1. Quản lý tab: 'transfer' (Chuyển phòng) hoặc 'checkout' (Trả phòng)
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") === "checkout" ? "checkout" : "transfer";
  });
  const [hasActiveStay, setHasActiveStay] = useState(true);
  const [studentStatus, setStudentStatus] = useState(STUDENT_STATUS.NOT_REGISTERED);

  useEffect(() => {
    const checkTabParam = () => {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "checkout" || tabParam === "transfer") {
        setActiveTab(tabParam);
      }
    };
    checkTabParam();
    window.addEventListener("popstate", checkTabParam);
    return () => window.removeEventListener("popstate", checkTabParam);
  }, []);

  // 2. Thông tin phòng hiện tại (Banner trên cùng)
  const [currentRoomInfo, setCurrentRoomInfo] = useState({
    phong_hien_tai: "Chưa có phòng",
    thanh_vien: "—",
    thoi_gian_luu_tru: "—",
    so_phong: "",
  });

  // 3. Danh sách phòng khả dụng cho dropdown chọn phòng đích
  const [roomOptions, setRoomOptions] = useState([
    { value: "P36 - Tòa A3 - Tầng 3", label: "P36 - Tòa A3 - Tầng 3" },
    { value: "P101 - Tòa A1 - Tầng 1", label: "P101 - Tòa A1 - Tầng 1" },
    { value: "P102 - Tòa A1 - Tầng 1", label: "P102 - Tòa A1 - Tầng 1" },
    { value: "P103 - Tòa A1 - Tầng 1", label: "P103 - Tòa A1 - Tầng 1" },
    { value: "P201 - Tòa A1 - Tầng 2", label: "P201 - Tòa A1 - Tầng 2" },
    { value: "P205 - Tòa A2 - Tầng 2", label: "P205 - Tòa A2 - Tầng 2" },
  ]);

  // 4. Form state Chuyển phòng (Mặc định TRỐNG HOÀN TOÀN mỗi lần ấn vào)
  const [transferForm, setTransferForm] = useState({
    ly_do: "",
    ngay_mong_muon: "",
    phong_mong_muon: "",
    mo_ta_chi_tiet: "",
  });

  // 5. Form state Trả phòng & địa chỉ chia thành các ô nhỏ (Mặc định TRỐNG HOÀN TOÀN mỗi lần ấn vào)
  const [checkoutProvince, setCheckoutProvince] = useState("");
  const [checkoutDistrict, setCheckoutDistrict] = useState("");
  const [checkoutStreet, setCheckoutStreet] = useState("");

  const [checkoutForm, setCheckoutForm] = useState({
    ly_do: "",
    ngay_mong_muon: "",
    dia_chi_lien_he: "",
    mo_ta_chi_tiet: "",
  });

  // 6. Trạng thái gửi form & phản hồi người dùng
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // 7. Danh sách lịch sử yêu cầu chuyển / trả phòng
  const [historyList, setHistoryList] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Danh sách Quận / Huyện theo Tỉnh / Thành phố được chọn
  const checkoutProvinceObj = useMemo(() => {
    if (!checkoutProvince) return null;
    return VIETNAM_PROVINCES.find((p) => p.name === checkoutProvince) || null;
  }, [checkoutProvince]);

  const availableCheckoutDistricts = useMemo(() => {
    return checkoutProvinceObj?.districts || [];
  }, [checkoutProvinceObj]);

  // Cập nhật lại quận/huyện khi đổi tỉnh/thành
  useEffect(() => {
    if (!checkoutProvince) {
      setCheckoutDistrict("");
    } else if (
      availableCheckoutDistricts.length > 0 &&
      !availableCheckoutDistricts.includes(checkoutDistrict)
    ) {
      setCheckoutDistrict("");
    }
  }, [checkoutProvince, availableCheckoutDistricts]);

  // Tự động ghép chuỗi địa chỉ đầy đủ từ 3 ô: Số nhà/đường, Quận/Huyện, Tỉnh/Thành phố
  useEffect(() => {
    const parts = [];
    if (checkoutStreet.trim()) parts.push(checkoutStreet.trim());
    if (checkoutDistrict) parts.push(checkoutDistrict);
    if (checkoutProvince) parts.push(checkoutProvince);
    const fullAddress = parts.join(", ");
    setCheckoutForm((prev) => ({
      ...prev,
      dia_chi_lien_he: fullAddress,
    }));
  }, [checkoutProvince, checkoutDistrict, checkoutStreet]);

  // Tải dữ liệu ban đầu và lắng nghe cập nhật realtime
  useEffect(() => {
    loadData();

    const handleOccupancyUpdate = () => {
      loadData();
    };
    window.addEventListener("occupancy-updated", handleOccupancyUpdate);
    return () => {
      window.removeEventListener("occupancy-updated", handleOccupancyUpdate);
    };
  }, []);

  const loadData = async () => {
    setIsLoadingHistory(true);
    try {
      const studentMsv =
        localStorage.getItem("ktx_username") ||
        localStorage.getItem("ktx_email")?.split("@")[0] ||
        "";

      const [roomData, historyData, availableOpts, statusRes] = await Promise.all([
        occupancyService.getCurrentRoomInfo?.(),
        occupancyService.getTransferCheckoutRequests?.(),
        occupancyService.getAvailableOptions?.(),
        resolveStudentStatus(studentMsv),
      ]);

      const isResident = statusRes.status === STUDENT_STATUS.ACTIVE_RESIDENT;
      setStudentStatus(statusRes.status);
      setHasActiveStay(isResident);

      if (isResident) {
        const assignedRoom = statusRes.activeRoom || roomData;
        if (assignedRoom) {
          const roomLabel = assignedRoom.phong || assignedRoom.so_phong || assignedRoom.ma_phong || "";
          setCurrentRoomInfo({
            ...assignedRoom,
            phong_hien_tai: [roomLabel, assignedRoom.toa || assignedRoom.ten_toa || assignedRoom.ma_toa]
              .filter(Boolean)
              .join(" - "),
            so_phong: roomLabel,
          });
        }
      } else {
        setCurrentRoomInfo({
          phong_hien_tai: "Chưa có phòng nội trú",
          thanh_vien: "—",
          thoi_gian_luu_tru: "Chưa ở",
          so_phong: "",
        });
      }

      if (historyData && Array.isArray(historyData) && historyData.length > 0) {
        const myRequests = historyData.filter(
          (req) => !studentMsv || !req.msv || req.msv === studentMsv,
        );
        setHistoryList(isResident ? myRequests : []);
      } else {
        setHistoryList([]);
      }

      if (
        availableOpts &&
        Array.isArray(availableOpts) &&
        availableOpts.length > 0
      ) {
        const mapped = availableOpts.map((opt) => ({
          value: opt.label || `P${opt.so_phong} - ${opt.ten_toa || "Tòa KTX"}`,
          label: opt.label || `P${opt.so_phong} - ${opt.ten_toa || "Tòa KTX"}`,
        }));
        setRoomOptions(mapped);
      }
    } catch (err) {
      console.error("Error loading transfer page data:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Format ngày dd/mm/yyyy hiển thị
  const formatInputDateToDisplay = (dateStr) => {
    if (!dateStr) return "";
    if (dateStr.includes("/")) return dateStr;
    const [year, month, day] = dateStr.split("-");
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  // Xử lý thay đổi form chuyển phòng
  const handleTransferChange = (e) => {
    const { name, value } = e.target;
    setTransferForm((prev) => ({ ...prev, [name]: value }));
  };

  // Xử lý thay đổi form trả phòng
  const handleCheckoutChange = (e) => {
    const { name, value } = e.target;
    setCheckoutForm((prev) => ({ ...prev, [name]: value }));
  };

  // Submit Yêu cầu chuyển phòng
  const handleSubmitTransfer = async (e) => {
    e.preventDefault();
    if (!hasActiveStay) {
      setFeedbackMessage({
        type: "error",
        text: "Bạn chưa có phòng nội trú tại KTX nên chưa thể gửi yêu cầu chuyển phòng. Vui lòng đăng ký ở trước!",
      });
      return;
    }

    if (!transferForm.ly_do) {
      setFeedbackMessage({
        type: "error",
        text: "Vui lòng chọn lý do chuyển phòng.",
      });
      return;
    }

    if (!transferForm.ngay_mong_muon) {
      setFeedbackMessage({
        type: "error",
        text: "Vui lòng chọn ngày mong muốn chuyển phòng.",
      });
      return;
    }

    if (!transferForm.phong_mong_muon) {
      setFeedbackMessage({
        type: "error",
        text: "Vui lòng chọn phòng mong muốn chuyển tới.",
      });
      return;
    }

    setIsSubmitting(true);
    setFeedbackMessage(null);

    try {
      const payload = {
        phong_hien_tai: currentRoomInfo.so_phong || "",
        ly_do: transferForm.ly_do,
        ngay_mong_muon: formatInputDateToDisplay(transferForm.ngay_mong_muon),
        phong_mong_muon: transferForm.phong_mong_muon,
        mo_ta_chi_tiet: transferForm.mo_ta_chi_tiet,
        msv: localStorage.getItem("ktx_username") || "",
        ho_ten: localStorage.getItem("ktx_fullname") || "",
      };

      const res = await occupancyService.submitTransferRequest(payload);
      const newReq = res.data || {
        id: `YC-${Date.now().toString().slice(-4)}`,
        ma_yeu_cau: `#YC-${Date.now().toString().slice(-4)}`,
        loai_yeu_cau: "Chuyển phòng",
        ngay_gui: new Date().toLocaleDateString("vi-VN"),
        phong_lien_quan: `${currentRoomInfo.so_phong || ""} → ${transferForm.phong_mong_muon.split(" - ")[0]}`,
        trang_thai: "CHO_DUYET",
        trang_thai_label: "Chờ duyệt",
      };

      // Đưa ngay lên đầu danh sách lịch sử
      setHistoryList((prev) => [newReq, ...prev]);

      // Reset form về dạng trống hoàn toàn
      setTransferForm({
        ly_do: "",
        ngay_mong_muon: "",
        phong_mong_muon: "",
        mo_ta_chi_tiet: "",
      });

      setFeedbackMessage({
        type: "success",
        text: `Gửi yêu cầu chuyển phòng thành công! Mã yêu cầu: ${newReq.ma_yeu_cau || newReq.id}. Ban quản lý sẽ xử lý trong 3–5 ngày làm việc.`,
      });
    } catch (err) {
      console.error("Submit transfer request failed:", err);
      setFeedbackMessage({
        type: "error",
        text: "Có lỗi xảy ra khi gửi yêu cầu chuyển phòng. Vui lòng thử lại!",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Yêu cầu trả phòng
  const handleSubmitCheckout = async (e) => {
    e.preventDefault();
    if (!hasActiveStay) {
      setFeedbackMessage({
        type: "error",
        text: "Bạn chưa có phòng nội trú tại KTX nên chưa thể gửi yêu cầu trả phòng. Vui lòng đăng ký ở trước!",
      });
      return;
    }

    if (!checkoutForm.ly_do) {
      setFeedbackMessage({
        type: "error",
        text: "Vui lòng chọn lý do trả phòng.",
      });
      return;
    }

    if (!checkoutForm.ngay_mong_muon) {
      setFeedbackMessage({
        type: "error",
        text: "Vui lòng chọn ngày mong muốn chuyển / rời KTX.",
      });
      return;
    }

    if (!checkoutForm.dia_chi_lien_he.trim()) {
      setFeedbackMessage({
        type: "error",
        text: "Vui lòng nhập địa chỉ liên hệ sau khi trả phòng.",
      });
      return;
    }

    setIsSubmitting(true);
    setFeedbackMessage(null);

    try {
      const payload = {
        phong_hien_tai: currentRoomInfo.so_phong || "",
        ly_do: checkoutForm.ly_do,
        ngay_mong_muon: formatInputDateToDisplay(checkoutForm.ngay_mong_muon),
        dia_chi_lien_he: checkoutForm.dia_chi_lien_he,
        mo_ta_chi_tiet: checkoutForm.mo_ta_chi_tiet,
        msv: localStorage.getItem("ktx_username") || "",
        ho_ten: localStorage.getItem("ktx_fullname") || "",
      };

      const res = await occupancyService.submitCheckoutRequest(payload);
      const newReq = res.data || {
        id: `YC-${Date.now().toString().slice(-4)}`,
        ma_yeu_cau: `#YC-${Date.now().toString().slice(-4)}`,
        loai_yeu_cau: "Trả phòng",
        ngay_gui: new Date().toLocaleDateString("vi-VN"),
        phong_lien_quan: currentRoomInfo.so_phong || "",
        trang_thai: "CHO_DUYET",
        trang_thai_label: "Chờ duyệt",
      };

      // Đưa ngay lên đầu danh sách lịch sử
      setHistoryList((prev) => [newReq, ...prev]);

      // Reset form về dạng trống hoàn toàn
      setCheckoutProvince("");
      setCheckoutDistrict("");
      setCheckoutStreet("");
      setCheckoutForm({
        ly_do: "",
        ngay_mong_muon: "",
        dia_chi_lien_he: "",
        mo_ta_chi_tiet: "",
      });

      setFeedbackMessage({
        type: "success",
        text: `Gửi yêu cầu trả phòng thành công! Mã yêu cầu: ${newReq.ma_yeu_cau || newReq.id}. Ban quản lý sẽ liên hệ kiểm tra tài sản trước ngày rời KTX.`,
      });
    } catch (err) {
      console.error("Submit checkout request failed:", err);
      setFeedbackMessage({
        type: "error",
        text: "Có lỗi xảy ra khi gửi yêu cầu trả phòng. Vui lòng thử lại!",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <StudentLayout
      activeTab="transfer"
      onSelectTab={onSelectTab}
      userRole="Sinh viên"
    >
      <div className="flex flex-1 flex-col gap-6 self-stretch max-w-full">
        {/* ========================================================================= */}
        {/* TIÊU ĐỀ TRANG: CHUYỂN / TRẢ PHÒNG                                       */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-3 select-none">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Chuyển / trả phòng
            </h1>
            <p className="text-sm text-slate-500">
              Gửi và theo dõi yêu cầu thay đổi chỗ lưu trú.
            </p>
          </div>
        </div>

        {studentStatus !== STUDENT_STATUS.ACTIVE_RESIDENT ? (
          <FeatureLockedNotice
            featureName="Chuyển / trả phòng"
            status={studentStatus}
            onNavigate={onNavigate}
            onSelectTab={onSelectTab}
          />
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 1. KHUNG HIỂN THỊ THÔNG TIN PHÒNG HIỆN TẠI (BANNER XANH TRÊN CÙNG)       */}
            {/* ========================================================================= */}
        <div className="rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 text-white p-5 sm:p-6 shadow-sm select-none">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4 items-center">
            {/* Cột 1: Phòng hiện tại */}
            <div>
              <p className="text-xs sm:text-sm font-medium text-white/90 mb-1">
                Phòng hiện tại
              </p>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white drop-shadow-2xs">
                {currentRoomInfo.phong_hien_tai}
              </h3>
            </div>

            {/* Cột 2: Thành viên */}
            <div className="sm:border-l sm:border-white/20 sm:pl-6">
              <p className="text-xs sm:text-sm font-medium text-white/90 mb-1">
                Thành viên
              </p>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white drop-shadow-2xs">
                {currentRoomInfo.thanh_vien}
              </h3>
            </div>

            {/* Cột 3: Thời gian lưu trú */}
            <div className="sm:border-l sm:border-white/20 sm:pl-6">
              <p className="text-xs sm:text-sm font-medium text-white/90 mb-1">
                Thời gian lưu trú
              </p>
              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white drop-shadow-2xs">
                {currentRoomInfo.thoi_gian_luu_tru}
              </h3>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* THÔNG BÁO NẾU CHƯA CÓ PHÒNG NỘI TRÚ                                     */}
        {/* ========================================================================= */}
        {!hasActiveStay && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 select-none shadow-xs">
            <div className="flex items-start gap-3.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Chưa thể sử dụng tính năng chuyển / trả phòng
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Hiện tại bạn chưa lưu trú tại phòng nào trong Ký túc xá. Vui lòng đăng ký ở trước để sử dụng tính năng này!
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onNavigate) {
                  onNavigate("/student/register");
                } else if (onSelectTab) {
                  onSelectTab("register");
                } else {
                  window.history.pushState({}, "", "/student/register");
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition shrink-0 cursor-pointer shadow-sm"
            >
              Đăng ký phòng ngay
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. KHU VỰC FORM ĐĂNG KÝ & CARD LƯU Ý QUAN TRỌNG                           */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
          {/* Tab Switcher: Chuyển đổi giữa Chuyển phòng & Trả phòng */}
          <div className="bg-slate-100 p-1 rounded-2xl inline-flex mb-6 select-none border border-slate-200/40">
            <button
              type="button"
              onClick={() => {
                setActiveTab("transfer");
                setFeedbackMessage(null);
                setTransferForm({
                  ly_do: "",
                  ngay_mong_muon: "",
                  phong_mong_muon: "",
                  mo_ta_chi_tiet: "",
                });
              }}
              className={`px-5 py-2 rounded-xl text-sm transition-all duration-150 cursor-pointer ${
                activeTab === "transfer"
                  ? "bg-white text-blue-600 font-bold shadow-xs"
                  : "text-slate-600 font-medium hover:text-slate-900"
              }`}
            >
              Chuyển phòng
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("checkout");
                setFeedbackMessage(null);
                setCheckoutProvince("");
                setCheckoutDistrict("");
                setCheckoutStreet("");
                setCheckoutForm({
                  ly_do: "",
                  ngay_mong_muon: "",
                  dia_chi_lien_he: "",
                  mo_ta_chi_tiet: "",
                });
              }}
              className={`px-5 py-2 rounded-xl text-sm transition-all duration-150 cursor-pointer ${
                activeTab === "checkout"
                  ? "bg-white text-blue-600 font-bold shadow-xs"
                  : "text-slate-600 font-medium hover:text-slate-900"
              }`}
            >
              Trả phòng
            </button>
          </div>

          {/* Thông báo kết quả gửi form */}
          {feedbackMessage && (
            <div
              className={`mb-6 p-4 rounded-2xl flex items-start gap-3 text-sm animate-in fade-in duration-200 ${
                feedbackMessage.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}
            >
              {feedbackMessage.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 font-medium">{feedbackMessage.text}</div>
            </div>
          )}

          {/* Bố cục 2 cột: Cột Form chính (2/3) và Cột Lưu ý quan trọng (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-start">
            {/* =================================================================== */}
            {/* CỘT FORM CHÍNH (2/3)                                                */}
            {/* =================================================================== */}
            <div className="lg:col-span-2">
              {activeTab === "transfer" ? (
                /* --------------------------------------------------------------- */
                /* TAB CHUYỂN PHÒNG (ẢNH 1)                                        */
                /* --------------------------------------------------------------- */
                <form onSubmit={handleSubmitTransfer} className="space-y-4">
                  {/* Hàng 1: Lý do chuyển phòng (col 1) & Ngày mong muốn chuyển (col 2) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    {/* Lý do chuyển phòng */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                        Lý do chuyển phòng
                      </label>
                      <div className="relative">
                        <select
                          name="ly_do"
                          value={transferForm.ly_do}
                          onChange={handleTransferChange}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 appearance-none pr-10 cursor-pointer shadow-2xs"
                        >
                          <option value="">
                            -- Chọn lý do chuyển phòng --
                          </option>
                          <option value="Phòng hiện tại quá tải">
                            Phòng hiện tại quá tải
                          </option>
                          <option value="Không hợp bạn cùng phòng">
                            Không hợp bạn cùng phòng
                          </option>
                          <option value="Muốn chuyển tầng khác">
                            Muốn chuyển tầng khác
                          </option>
                          <option value="Muốn chuyển sang tòa khác">
                            Muốn chuyển sang tòa khác
                          </option>
                          <option value="Cơ sở vật chất phòng hiện tại chưa phù hợp">
                            Cơ sở vật chất phòng hiện tại chưa phù hợp
                          </option>
                          <option value="Lý do cá nhân khác">
                            Lý do cá nhân khác
                          </option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Ngày mong muốn chuyển */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                        Ngày mong muốn chuyển
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          name="ngay_mong_muon"
                          value={transferForm.ngay_mong_muon}
                          onChange={handleTransferChange}
                          placeholder="dd/mm/yyyy"
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 pr-10 cursor-pointer shadow-2xs [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                          required
                        />
                        <Calendar className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Hàng 2: Phòng mong muốn */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                      Phòng mong muốn
                    </label>
                    <div className="relative">
                      <select
                        name="phong_mong_muon"
                        value={transferForm.phong_mong_muon}
                        onChange={handleTransferChange}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 appearance-none pr-10 cursor-pointer shadow-2xs"
                      >
                        <option value="">
                          -- Chọn phòng mong muốn chuyển tới --
                        </option>
                        {roomOptions.map((opt, idx) => (
                          <option key={idx} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Hàng 3: Mô tả chi tiết */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                      Mô tả chi tiết
                    </label>
                    <textarea
                      name="mo_ta_chi_tiet"
                      value={transferForm.mo_ta_chi_tiet}
                      onChange={handleTransferChange}
                      rows={4}
                      placeholder="Mô tả rõ nguyện vọng của bạn để ban quản lý ktx xét duyệt nhanh hơn..."
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 resize-none transition shadow-2xs"
                    ></textarea>
                  </div>

                  {/* Nút Submit Chuyển phòng: Căn phải */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold py-3 px-6 rounded-xl transition cursor-pointer shadow-sm shadow-blue-500/20 text-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isSubmitting && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      <span>Gửi yêu cầu chuyển phòng</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* --------------------------------------------------------------- */
                /* TAB TRẢ PHÒNG (ẢNH 2)                                           */
                /* --------------------------------------------------------------- */
                <form onSubmit={handleSubmitCheckout} className="space-y-4">
                  {/* Hàng 1: Lý do trả phòng (col 1) & Ngày mong muốn chuyển/rời KTX (col 2) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    {/* Lý do trả phòng */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                        Lý do trả phòng
                      </label>
                      <div className="relative">
                        <select
                          name="ly_do"
                          value={checkoutForm.ly_do}
                          onChange={handleCheckoutChange}
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 appearance-none pr-10 cursor-pointer shadow-2xs"
                        >
                          <option value="">-- Chọn lý do trả phòng --</option>
                          <option value="Đã tốt nghiệp">Đã tốt nghiệp</option>
                          <option value="Chuyển ra ngoài ở">
                            Chuyển ra ngoài ở
                          </option>
                          <option value="Bảo lưu việc học">
                            Bảo lưu việc học
                          </option>
                          <option value="Hoàn cảnh gia đình">
                            Hoàn cảnh gia đình
                          </option>
                          <option value="Đi thực tập / Du học">
                            Đi thực tập / Du học
                          </option>
                          <option value="Lý do khác">Lý do khác</option>
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    {/* Ngày mong muốn chuyển / rời KTX */}
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                        Ngày mong muốn chuyển
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          name="ngay_mong_muon"
                          value={checkoutForm.ngay_mong_muon}
                          onChange={handleCheckoutChange}
                          placeholder="dd/mm/yyyy"
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 pr-10 cursor-pointer shadow-2xs [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                          required
                        />
                        <Calendar className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Hàng 2: Địa chỉ liên hệ sau khi trả phòng (Chia thành các ô nhỏ cho phép chọn) */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                      Địa chỉ liên hệ sau khi trả phòng
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Ô 1: Chọn Tỉnh / Thành phố */}
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">
                          Tỉnh / Thành phố
                        </label>
                        <div className="relative">
                          <select
                            value={checkoutProvince}
                            onChange={(e) =>
                              setCheckoutProvince(e.target.value)
                            }
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 appearance-none pr-9 cursor-pointer shadow-2xs"
                          >
                            <option value="">-- Chọn Tỉnh / TP --</option>
                            {VIETNAM_PROVINCES.map((p) => (
                              <option key={p.name} value={p.name}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>

                      {/* Ô 2: Chọn Quận / Huyện */}
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">
                          Quận / Huyện
                        </label>
                        <div className="relative">
                          <select
                            value={checkoutDistrict}
                            onChange={(e) =>
                              setCheckoutDistrict(e.target.value)
                            }
                            disabled={!checkoutProvince}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 appearance-none pr-9 cursor-pointer shadow-2xs disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                          >
                            <option value="">-- Chọn Quận / Huyện --</option>
                            {availableCheckoutDistricts.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>

                      {/* Ô 3: Số nhà, tên đường, xã/phường... */}
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 mb-1">
                          Số nhà, tên đường, xã/phường...
                        </label>
                        <input
                          type="text"
                          value={checkoutStreet}
                          onChange={(e) => setCheckoutStreet(e.target.value)}
                          placeholder="VD: Số 123, Đường Giải Phóng..."
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-2xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Hàng 3: Mô tả chi tiết */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                      Mô tả chi tiết
                    </label>
                    <textarea
                      name="mo_ta_chi_tiet"
                      value={checkoutForm.mo_ta_chi_tiet}
                      onChange={handleCheckoutChange}
                      rows={4}
                      placeholder="Ghi chú thêm cho ban quản lý ktx (nếu có)"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 resize-none transition shadow-2xs"
                    ></textarea>
                  </div>

                  {/* Nút Submit Trả phòng: Căn phải */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold py-3 px-6 rounded-xl transition cursor-pointer shadow-sm shadow-blue-500/20 text-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isSubmitting && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      <span>Gửi yêu cầu trả phòng</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* =================================================================== */}
            {/* CỘT CARD "LƯU Ý QUAN TRỌNG" (1/3)                                  */}
            {/* =================================================================== */}
            <div className="lg:col-span-1">
              <div className="bg-[#f0f6ff] rounded-2xl p-5 sm:p-6 border border-blue-100/60 shadow-2xs">
                <h3 className="text-base font-bold text-slate-900 mb-4 select-none">
                  Lưu ý quan trọng
                </h3>

                <div className="space-y-4">
                  {/* Mục 1 */}
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-2xs">
                      1
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      Yêu cầu chuyển phòng được xử lý trong 3–5 ngày làm việc kể
                      từ khi gửi.
                    </p>
                  </div>

                  {/* Mục 2 */}
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-2xs">
                      2
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      Yêu cầu trả phòng cần gửi trước tối thiểu 7 ngày so với
                      ngày dự kiến rời phòng.
                    </p>
                  </div>

                  {/* Mục 3 */}
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-2xs">
                      3
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      Sinh viên cần hoàn tất mọi khoản phí KTX trước khi yêu cầu
                      được duyệt.
                    </p>
                  </div>

                  {/* Mục 4 */}
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-2xs">
                      4
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      Kiểm tra tình trạng phòng và bàn giao tài sản khi trả
                      phòng để tránh phát sinh phí.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. BẢNG "LỊCH SỬ YÊU CẦU" (KHỐI DƯỚI CÙNG)                                 */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Lịch sử yêu cầu
            </h2>
            {isLoadingHistory && (
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs font-medium text-slate-500 border-b border-slate-100 pb-3">
                  <th className="py-3 px-4 font-semibold text-slate-600">
                    Mã yêu cầu
                  </th>
                  <th className="py-3 px-4 font-semibold text-slate-600">
                    Loại yêu cầu
                  </th>
                  <th className="py-3 px-4 font-semibold text-slate-600">
                    Ngày gửi
                  </th>
                  <th className="py-3 px-4 font-semibold text-slate-600">
                    Phòng liên quan
                  </th>
                  <th className="py-3 px-4 font-semibold text-slate-600">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {historyList.length > 0 ? (
                  historyList.map((item, idx) => {
                    const isApproved =
                      item.trang_thai === "DA_DUYET" ||
                      item.trang_thai_label === "Đã duyệt";
                    const isPending =
                      item.trang_thai === "CHO_DUYET" ||
                      item.trang_thai_label === "Chờ duyệt";

                    return (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* Mã yêu cầu */}
                        <td className="py-3.5 px-4 font-bold text-slate-900 font-mono text-xs sm:text-sm">
                          {item.ma_yeu_cau || item.id}
                        </td>

                        {/* Loại yêu cầu */}
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {item.loai_yeu_cau}
                        </td>

                        {/* Ngày gửi */}
                        <td className="py-3.5 px-4 text-slate-700 text-xs sm:text-sm">
                          {item.ngay_gui}
                        </td>

                        {/* Phòng liên quan */}
                        <td className="py-3.5 px-4 text-slate-800 font-medium">
                          {item.phong_lien_quan || item.phong_hien_tai}
                        </td>

                        {/* Trạng thái badge bo tròn */}
                        <td className="py-3.5 px-4">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200/60 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Đã duyệt
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200/60 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Chờ duyệt
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200/60 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              {item.trang_thai_label || "Từ chối"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-slate-400 text-sm"
                    >
                      Chưa có yêu cầu chuyển hoặc trả phòng nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}
      </div>
    </StudentLayout>
  );
}
