import React, { useState, useEffect, useMemo } from "react";
import api from "../../services/api";
import studentNotificationService from "../../services/studentNotificationService";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit3,
  Image as ImageIcon,
  CheckCircle2,
  X,
  RotateCcw,
  Save,
  Calendar,
  Clock,
  MapPin,
  Users,
  FileText,
  Upload,
  AlertTriangle,
  Scale,
  Paperclip,
  Building2,
  Check,
} from "lucide-react";

// Chuyển đổi định dạng ngày giữa input date (YYYY-MM-DD) và hiển thị (DD/MM/YYYY)
function toDateInputValue(dStr) {
  if (!dStr) return "2026-10-22";
  const s = String(dStr).trim();
  if (s.includes("-") && s.length === 10) return s;
  if (s.includes("/")) {
    const p = s.split("/");
    if (p.length === 3) {
      return `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
    }
  }
  return "2026-10-22";
}

function toDisplayDate(dStr) {
  if (!dStr) return "22/10/2026";
  const s = String(dStr).trim();
  if (s.includes("/")) return s;
  if (s.includes("-")) {
    const p = s.split("-");
    if (p.length === 3) {
      return `${p[2]}/${p[1]}/${p[0]}`;
    }
  }
  return s;
}

// Bóc tách thông tin triệu tập Hội đồng từ JSON hoặc chuỗi text tự do
function parseSummonData(raw) {
  if (!raw) return null;
  // 1. Trường hợp lưu dạng JSON
  if (typeof raw === "string" && raw.trim().startsWith("{")) {
    try {
      const obj = JSON.parse(raw);
      if (
        obj.thoi_gian ||
        obj.dia_diem ||
        obj.type === "SUMMON" ||
        obj.is_summon ||
        obj.gio
      ) {
        return {
          thoi_gian:
            obj.thoi_gian ||
            (obj.gio && obj.ngay ? `${obj.gio} - ${obj.ngay}` : ""),
          ngay: obj.ngay || "",
          gio: obj.gio || "",
          dia_diem: obj.dia_diem || "Văn phòng Ban quản lý KTX",
          thanh_phan: obj.thanh_phan || "",
          yeu_cau: obj.yeu_cau || "",
          raw_text: obj.raw_text || "",
        };
      }
    } catch (_) {}
  }

  // 2. Trường hợp là chuỗi text tự do
  if (typeof raw === "string") {
    const isSummonText =
      raw.includes("Lịch triệu tập") ||
      raw.includes("triệu tập") ||
      raw.includes("Thành phần") ||
      raw.includes("Yêu cầu");

    if (isSummonText) {
      let thoi_gian = "";
      let dia_diem = "";
      let thanh_phan = "";
      let yeu_cau = "";

      const timeMatch = raw.match(
        /Lịch triệu tập:\s*([^.\n]+?)(?:\s+tại|\.|\n|$)/i,
      );
      if (timeMatch) thoi_gian = timeMatch[1].trim();

      const locMatch = raw.match(
        /tại\s+([^.\n]+?)(?:\.\s*Thành phần|\.\s*Yêu cầu|\.|\n|$)/i,
      );
      if (locMatch) dia_diem = locMatch[1].trim();

      const partMatch = raw.match(
        /Thành phần:\s*([^.\n]+(?:\.[^.\n]+)*?)(?:\.\s*Yêu cầu|\n|$)/i,
      );
      if (partMatch) thanh_phan = partMatch[1].trim();

      const reqMatch = raw.match(/Yêu cầu:\s*(.+)$/i);
      if (reqMatch) yeu_cau = reqMatch[1].trim();

      let ngay = "";
      let gio = "";
      if (thoi_gian) {
        const dMatch = thoi_gian.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
        if (dMatch) ngay = dMatch[1];
        const tMatch = thoi_gian.match(/\b(\d{1,2}:\d{2})\b/);
        if (tMatch) gio = tMatch[1];
      }

      return {
        thoi_gian,
        ngay,
        gio,
        dia_diem: dia_diem || "Văn phòng Ban quản lý KTX",
        thanh_phan,
        yeu_cau,
        raw_text: raw,
      };
    }
  }

  return null;
}

// Bóc tách thông tin chốt xử lý dứt điểm từ JSON hoặc chuỗi text
function parseResolutionData(raw, defaultQuyetDinh) {
  if (!raw)
    return { quyet_dinh: defaultQuyetDinh || "", ket_luan: "", file: null };
  if (typeof raw === "string" && raw.trim().startsWith("{")) {
    try {
      const obj = JSON.parse(raw);
      if (obj.type === "RESOLUTION" || obj.quyet_dinh || obj.ket_luan) {
        return {
          quyet_dinh: obj.quyet_dinh || defaultQuyetDinh || "",
          ket_luan: obj.ket_luan || obj.ghi_chu || "",
          file: obj.file || obj.attached_file || null,
        };
      }
    } catch (_) {}
  }
  return {
    quyet_dinh: defaultQuyetDinh || "",
    ket_luan: raw && !raw.includes("Lịch triệu tập") ? raw : "",
    file: null,
  };
}

export default function ViolationManagement({ searchTerm = "" }) {
  // State danh sách vi phạm đọc từ API
  const [violations, setViolations] = useState([]);

  // Chế độ xem: 'list' (danh sách) | 'detail' (chi tiết) | 'create' (lập biên bản mới)
  const [viewMode, setViewMode] = useState("list");
  const [selectedViolation, setSelectedViolation] = useState(null);

  // Bộ lọc trạng thái: 'ALL' | 'KHAN_CAP' | 'CHO_XU_LY' | 'DA_XU_LY'
  const [filterTab, setFilterTab] = useState("ALL");

  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Form Lập biên bản mới
  const [createForm, setCreateForm] = useState({
    ho_ten: "",
    msv: "",
    phong: "",
    thoi_gian: "",
    dia_diem: "",
    nhom_hanh_vi: "",
    mo_ta: "",
    dinh_kem: [],
    hinh_thuc_xu_ly: "",
  });

  // Modal cập nhật trạng thái chung
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [editStatusData, setEditStatusData] = useState({
    trang_thai: "CHO_XU_LY",
    sub_status: "CHO_GIAI_TRINH",
    quyet_dinh: "",
    ghi_chu: "",
  });

  // Modal Lên lịch triệu tập Hội đồng kỷ luật
  const [isSummonModalOpen, setIsSummonModalOpen] = useState(false);
  const [summonForm, setSummonForm] = useState({
    ngay: "2026-10-22",
    gio: "08:30",
    dia_diem: "Văn phòng Ban quản lý KTX",
    yeu_cau:
      "Mang theo Thẻ sinh viên, bản tự kiểm điểm và các tài liệu giải trình liên quan.",
    thanh_phan: "",
  });

  // Modal Chốt kết quả xử lý vi phạm
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [resolveForm, setResolveForm] = useState({
    hinh_thuc: "Cảnh cáo toàn KTX",
    ket_luan: "",
    attachedFileName: "",
  });

  // Modal xem ảnh bằng chứng
  const [previewImageName, setPreviewImageName] = useState(null);

  // Toast thông báo
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Đồng bộ ý kiến phản hồi / bản giải trình của sinh viên theo mã biên bản
  const [studentExplanation, setStudentExplanation] = useState("");
  const [studentExplanationAt, setStudentExplanationAt] = useState("");

  useEffect(() => {
    if (selectedViolation?.ma_bb) {
      const stored = localStorage.getItem(
        `ktx_violation_explanation_${selectedViolation.ma_bb}`,
      );
      const storedAt = localStorage.getItem(
        `ktx_violation_explanation_at_${selectedViolation.ma_bb}`,
      );
      setStudentExplanation(stored || selectedViolation.giai_trinh || "");
      setStudentExplanationAt(storedAt || selectedViolation.giai_trinh_at || "");
    } else {
      setStudentExplanation("");
      setStudentExplanationAt("");
    }
  }, [selectedViolation]);

  useEffect(() => {
    const handleExpUpdated = (e) => {
      if (e.detail?.ma_bb && selectedViolation?.ma_bb === e.detail.ma_bb) {
        setStudentExplanation(e.detail.explanation || "");
        setStudentExplanationAt(
          e.detail.at ||
            new Date().toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            }) +
              " - " +
              new Date().toLocaleDateString("vi-VN"),
        );
      }
    };

    const handleStorage = (e) => {
      if (selectedViolation?.ma_bb) {
        if (e.key === `ktx_violation_explanation_${selectedViolation.ma_bb}`) {
          setStudentExplanation(e.newValue || "");
        }
        if (e.key === `ktx_violation_explanation_at_${selectedViolation.ma_bb}`) {
          setStudentExplanationAt(e.newValue || "");
        }
      }
    };

    window.addEventListener(
      "ktx-violation-explanation-updated",
      handleExpUpdated,
    );
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        "ktx-violation-explanation-updated",
        handleExpUpdated,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, [selectedViolation]);

  useEffect(() => {
    const fetchViolations = () => {
      api
        .get("/incidents/violations")
        .then(({ data }) => {
          if (Array.isArray(data)) {
            setViolations(data);
            setSelectedViolation((prev) => {
              if (!prev) return prev;
              const found = data.find(
                (x) => x.id === prev.id || x.ma_bb === prev.ma_bb,
              );
              return found ? { ...prev, ...found } : prev;
            });
          }
        })
        .catch((error) => {
          console.error("Không thể tải biên bản vi phạm:", error);
        });
    };

    fetchViolations();
    const interval = setInterval(fetchViolations, 30000);
    return () => clearInterval(interval);
  }, []);

  // Thống kê nhanh
  const stats = useMemo(() => {
    return {
      totalDisplay: violations.length,
      pendingDisplay: (violations || []).filter(
        (item) => item.trang_thai === "CHO_XU_LY",
      ).length,
      resolvedDisplay: (violations || []).filter(
        (item) => item.trang_thai === "DA_XU_LY",
      ).length,
      totalCount: violations?.length || 0,
    };
  }, [violations]);

  // Lọc dữ liệu danh sách theo Tab & Search Term
  const filteredViolations = useMemo(() => {
    return (violations || []).filter((item) => {
      // 1. Lọc theo Tab
      if (filterTab === "KHAN_CAP" && item.trang_thai !== "KHAN_CAP")
        return false;
      if (filterTab === "CHO_XU_LY" && item.trang_thai !== "CHO_XU_LY")
        return false;
      if (filterTab === "DA_XU_LY" && item.trang_thai !== "DA_XU_LY")
        return false;

      // 2. Lọc theo từ khóa tìm kiếm
      const term = (searchTerm || "").trim().toLowerCase();
      if (!term) return true;

      return (
        item.ma_bb?.toLowerCase().includes(term) ||
        item.msv?.toLowerCase().includes(term) ||
        item.ho_ten?.toLowerCase().includes(term) ||
        item.phong?.toLowerCase().includes(term) ||
        item.hanh_vi?.toLowerCase().includes(term) ||
        item.nhom_vi_pham?.toLowerCase().includes(term)
      );
    });
  }, [violations, filterTab, searchTerm]);

  // Tổng số trang dựa trên dữ liệu lọc thực tế
  const totalPages = Math.ceil(filteredViolations.length / itemsPerPage) || 1;

  // Reset về trang 1 khi thay đổi bộ lọc hoặc từ khóa tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterTab]);

  // Đảm bảo currentPage không vượt quá totalPages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Tạo danh sách các số trang hiển thị linh hoạt
  const getPaginationItems = (current, total) => {
    if (total <= 1) return [];
    if (total <= 4) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 2) {
      return [1, 2, "...", total];
    }
    if (current >= total - 1) {
      return [1, "...", total - 1, total];
    }
    return [1, "...", current, "...", total];
  };

  // Tính toán phân trang
  const paginatedViolations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredViolations.slice(start, start + itemsPerPage);
  }, [filteredViolations, currentPage]);

  // Chuyển sang xem chi tiết
  const handleViewDetail = (item) => {
    setSelectedViolation(item);
    setEditStatusData({
      trang_thai: item.trang_thai,
      sub_status: item.sub_status || "CHO_GIAI_TRINH",
      quyet_dinh: item.quyet_dinh || item.hinh_thuc_xu_ly || "",
      ghi_chu: item.ghi_chu || "",
    });
    setViewMode("detail");
  };

  // Quay lại danh sách
  const handleBackToList = () => {
    setViewMode("list");
  };

  // Cập nhật trạng thái trực tiếp
  const handleQuickChangeSubStatus = async (newSubStatus) => {
    if (!selectedViolation) return;

    if (newSubStatus === "HOI_DONG_KY_LUAT") {
      handleOpenSummonModal(selectedViolation);
      return;
    }

    if (newSubStatus === "DA_XU_LY_DUT_DIEM") {
      handleOpenResolveModal(selectedViolation);
      return;
    }

    let newMainStatus = "CHO_XU_LY";
    let newGhiChu = selectedViolation.ghi_chu;
    if (
      newSubStatus === "CHO_GIAI_TRINH" &&
      typeof newGhiChu === "string" &&
      (newGhiChu.includes("SUMMON") ||
        newGhiChu.includes("Lịch triệu tập") ||
        newGhiChu.includes("RESOLUTION"))
    ) {
      newGhiChu = "";
    }
    const updated = {
      ...selectedViolation,
      sub_status: newSubStatus,
      trang_thai: newMainStatus,
      ghi_chu: newGhiChu,
    };

    setViolations((prev) =>
      prev.map((v) => (v.id === selectedViolation.id ? updated : v)),
    );
    setSelectedViolation(updated);
    setEditStatusData((prev) => ({
      ...prev,
      sub_status: newSubStatus,
      trang_thai: newMainStatus,
      ghi_chu: newGhiChu,
    }));

    try {
      await api.put(`/incidents/violations/${selectedViolation.id}`, {
        trang_thai: newMainStatus,
        sub_status: newSubStatus,
        ghi_chu: newGhiChu,
      });
    } catch (err) {
      console.warn("Không thể lưu trạng thái vi phạm vào CSDL:", err);
    }

    // Kịch bản 1: Nếu chuyển về Chờ giải trình, gửi/cập nhật thông báo giải trình cho sinh viên
    if (newSubStatus === "CHO_GIAI_TRINH") {
      try {
        const hanhViName =
          selectedViolation.nhom_vi_pham ||
          selectedViolation.hanh_vi ||
          selectedViolation.mo_ta ||
          "Dùng đồ có công suất lớn trong phòng";
        const thoiGianStr =
          selectedViolation.thoi_gian ||
          selectedViolation.thoi_diem ||
          new Date().toLocaleDateString("vi-VN");
        const diaDiemStr =
          selectedViolation.dia_diem ||
          selectedViolation.phong ||
          "Phòng KTX";

        studentNotificationService.notifyFromManagement({
          id: `notif-violation-${selectedViolation.ma_bb}`,
          title: "Thông báo ghi nhận vi phạm nội quy KTX",
          content: `Ban quản lý KTX ghi nhận biên bản ${selectedViolation.ma_bb} về hành vi "${hanhViName}" vào ngày ${thoiGianStr}. Vui lòng kiểm tra và gửi bản giải trình trước thời hạn quy định.`,
          type: "violation_warning",
          msv: selectedViolation.msv,
          actionUrl: "/student/notifications",
          actionLabel: "Xem chi tiết biên bản",
          meta: {
            scenario: 1,
            ma_bb: selectedViolation.ma_bb,
            hanh_vi: hanhViName,
            ngay: thoiGianStr,
            dia_diem: diaDiemStr,
            msv: selectedViolation.msv,
            mo_ta: selectedViolation.mo_ta,
          },
        });
      } catch (notifErr) {
        console.warn("Lỗi gửi thông báo cho sinh viên:", notifErr);
      }
    }

    showToast("Đã chuyển biên bản sang trạng thái Chờ sinh viên giải trình!");
  };

  // Mở modal Triệu tập Hội đồng kỷ luật
  const handleOpenSummonModal = (violation = selectedViolation) => {
    if (!violation) return;
    const parsed = parseSummonData(violation.ghi_chu);
    let ngayVal = "2026-10-22";
    let gioVal = "08:30";
    if (parsed?.ngay) {
      ngayVal = toDateInputValue(parsed.ngay);
    } else if (parsed?.thoi_gian) {
      const dateMatch = parsed.thoi_gian.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
      if (dateMatch) ngayVal = toDateInputValue(dateMatch[1]);
      const timeMatch = parsed.thoi_gian.match(/\b(\d{1,2}:\d{2})\b/);
      if (timeMatch) gioVal = timeMatch[1];
    }

    setSummonForm({
      ngay: ngayVal,
      gio: gioVal,
      dia_diem: parsed?.dia_diem || "Văn phòng Ban quản lý KTX",
      yeu_cau:
        parsed?.yeu_cau ||
        "Mang theo Thẻ sinh viên, bản tự kiểm điểm và các tài liệu giải trình liên quan.",
      thanh_phan:
        parsed?.thanh_phan ||
        `Ban quản lý KTX, Quản trị tòa ${violation.phong_ngan || violation.phong || "KTX"}, Sinh viên ${violation.ho_ten || ""}`,
    });
    setIsSummonModalOpen(true);
  };

  // Mở modal Chốt kết quả xử lý
  const handleOpenResolveModal = (violation = selectedViolation) => {
    if (!violation) return;
    const parsed = parseResolutionData(
      violation.ghi_chu,
      violation.quyet_dinh || violation.hinh_thuc_xu_ly,
    );
    setResolveForm({
      hinh_thuc:
        parsed.quyet_dinh ||
        violation.quyet_dinh ||
        violation.hinh_thuc_xu_ly ||
        "Cảnh cáo toàn KTX",
      ket_luan: parsed.ket_luan || "",
      attachedFileName: parsed.file || "",
    });
    setIsResolveModalOpen(true);
  };

  // Xác nhận lên lịch triệu tập Hội đồng kỷ luật
  const handleConfirmSummon = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!selectedViolation) return;

    const displayDate = toDisplayDate(summonForm.ngay);
    const timeFormatted = `${displayDate} - ${summonForm.gio}`;

    const structuredData = {
      type: "SUMMON",
      thoi_gian: timeFormatted,
      ngay: displayDate,
      gio: summonForm.gio,
      dia_diem: summonForm.dia_diem.trim() || "Văn phòng Ban quản lý KTX",
      yeu_cau:
        summonForm.yeu_cau.trim() ||
        "Mang theo Thẻ sinh viên, bản tự kiểm điểm và các tài liệu giải trình liên quan.",
      thanh_phan:
        summonForm.thanh_phan.trim() ||
        `Ban quản lý KTX, Quản trị tòa ${selectedViolation.phong || ""}, Sinh viên ${selectedViolation.ho_ten}`,
      raw_text: `Lịch triệu tập: ${summonForm.gio} - ${displayDate} tại ${summonForm.dia_diem.trim()}. Thành phần: ${summonForm.thanh_phan.trim()}. Yêu cầu: ${summonForm.yeu_cau.trim()}`,
    };

    const jsonStr = JSON.stringify(structuredData);
    const newMainStatus = "KHAN_CAP";
    const newSubStatus = "HOI_DONG_KY_LUAT";

    const updated = {
      ...selectedViolation,
      trang_thai: newMainStatus,
      sub_status: newSubStatus,
      ghi_chu: jsonStr,
    };

    setViolations((prev) =>
      prev.map((v) => (v.id === selectedViolation.id ? updated : v)),
    );
    setSelectedViolation(updated);
    setEditStatusData((prev) => ({
      ...prev,
      trang_thai: newMainStatus,
      sub_status: newSubStatus,
      ghi_chu: jsonStr,
    }));
    setIsSummonModalOpen(false);

    // Lưu API backend
    try {
      await api.put(`/incidents/violations/${selectedViolation.id}`, {
        trang_thai: newMainStatus,
        sub_status: newSubStatus,
        ghi_chu: jsonStr,
      });
    } catch (err) {
      console.warn("Lỗi lưu backend:", err);
    }

    // Kịch bản 2: Phát thông báo triệu tập Hội đồng kỷ luật (Icon đỏ / Khẩn cấp)
    try {
      const hanhViName =
        selectedViolation.nhom_vi_pham ||
        selectedViolation.hanh_vi ||
        selectedViolation.mo_ta ||
        "Dùng đồ có công suất lớn trong phòng";

      studentNotificationService.notifyFromManagement({
        id: `notif-violation-${selectedViolation.ma_bb}`,
        title: "Thông báo triệu tập Hội đồng kỷ luật KTX",
        content: `Bạn được triệu tập tham dự cuộc họp Hội đồng kỷ luật KTX liên quan đến vụ việc ${selectedViolation.ma_bb} (${hanhViName}). Thời gian: ${summonForm.gio} - ${displayDate}, Địa điểm: ${structuredData.dia_diem}.`,
        type: "violation_summon",
        msv: selectedViolation.msv,
        actionUrl: "/student/notifications",
        actionLabel: "Xem chi tiết biên bản",
        meta: {
          scenario: 2,
          ma_bb: selectedViolation.ma_bb,
          hanh_vi: hanhViName,
          thoi_gian: `${summonForm.gio} - ${displayDate}`,
          dia_diem: structuredData.dia_diem,
          thanh_phan: structuredData.thanh_phan,
          yeu_cau: structuredData.yeu_cau,
          ngay: displayDate,
          gio: summonForm.gio,
        },
      });
    } catch (notifErr) {
      console.warn("Lỗi gửi thông báo cho sinh viên:", notifErr);
    }

    showToast(
      `Đã lên lịch triệu tập Hội đồng kỷ luật (${displayDate}) và gửi thông báo tới sinh viên ${selectedViolation.ho_ten || selectedViolation.msv}!`,
    );
  };

  // Xác nhận chốt kết quả xử lý vi phạm
  const handleConfirmResolve = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!selectedViolation) return;

    const structuredData = {
      type: "RESOLUTION",
      quyet_dinh: resolveForm.hinh_thuc,
      ket_luan:
        resolveForm.ket_luan.trim() ||
        `Hội đồng kỷ luật KTX thống nhất áp dụng hình thức kỷ luật: ${resolveForm.hinh_thuc}.`,
      file: resolveForm.attachedFileName || null,
      ngay_chot: new Date().toLocaleDateString("vi-VN"),
    };

    const jsonStr = JSON.stringify(structuredData);
    const newMainStatus = "DA_XU_LY";
    const newSubStatus = "DA_XU_LY_DUT_DIEM";

    const updated = {
      ...selectedViolation,
      trang_thai: newMainStatus,
      sub_status: newSubStatus,
      quyet_dinh: resolveForm.hinh_thuc,
      hinh_thuc_xu_ly: resolveForm.hinh_thuc,
      ghi_chu: jsonStr,
    };

    setViolations((prev) =>
      prev.map((v) => (v.id === selectedViolation.id ? updated : v)),
    );
    setSelectedViolation(updated);
    setEditStatusData((prev) => ({
      ...prev,
      trang_thai: newMainStatus,
      sub_status: newSubStatus,
      quyet_dinh: resolveForm.hinh_thuc,
      ghi_chu: jsonStr,
    }));
    setIsResolveModalOpen(false);

    // Lưu API backend
    try {
      await api.put(`/incidents/violations/${selectedViolation.id}`, {
        trang_thai: newMainStatus,
        sub_status: newSubStatus,
        quyet_dinh: resolveForm.hinh_thuc,
        hinh_thuc_xu_ly: resolveForm.hinh_thuc,
        ghi_chu: jsonStr,
      });
    } catch (err) {
      console.warn("Lỗi lưu backend:", err);
    }

    // Kịch bản 3: Phát thông báo kết quả xử lý vi phạm (Icon xanh lá / Thành công)
    try {
      const hanhViName =
        selectedViolation.nhom_vi_pham ||
        selectedViolation.hanh_vi ||
        selectedViolation.mo_ta ||
        "Dùng đồ có công suất lớn trong phòng";

      studentNotificationService.notifyFromManagement({
        id: `notif-violation-${selectedViolation.ma_bb}`,
        title: "Kết quả xử lý vi phạm nội quy KTX",
        content: `Vụ việc vi phạm ${selectedViolation.ma_bb} đã được xử lý hoàn tất. Hình thức xử lý: ${resolveForm.hinh_thuc}. Hồ sơ vi phạm đã được đóng.`,
        type: "violation_resolved",
        msv: selectedViolation.msv,
        actionUrl: "/student/notifications",
        actionLabel: "Xem kết quả",
        meta: {
          scenario: 3,
          ma_bb: selectedViolation.ma_bb,
          hanh_vi: hanhViName,
          hinh_thuc: resolveForm.hinh_thuc,
          ket_luan: structuredData.ket_luan,
          file: structuredData.file,
          ngay_chot: structuredData.ngay_chot,
        },
      });
    } catch (notifErr) {
      console.warn("Lỗi gửi thông báo cho sinh viên:", notifErr);
    }

    showToast(
      `Đã chốt kết quả xử lý (${resolveForm.hinh_thuc}), đóng hồ sơ và gửi thông báo tới sinh viên thành công!`,
    );
  };

  // Lưu modal Cập nhật trạng thái
  const handleSaveStatusModal = async (e) => {
    e.preventDefault();
    if (!selectedViolation) return;

    const updated = {
      ...selectedViolation,
      trang_thai: editStatusData.trang_thai,
      sub_status: editStatusData.sub_status,
      quyet_dinh: editStatusData.quyet_dinh,
      ghi_chu: editStatusData.ghi_chu,
      hinh_thuc_xu_ly:
        editStatusData.quyet_dinh || selectedViolation.hinh_thuc_xu_ly,
    };

    setViolations((prev) =>
      prev.map((v) => (v.id === selectedViolation.id ? updated : v)),
    );
    setSelectedViolation(updated);
    setIsUpdateModalOpen(false);

    try {
      await api.put(`/incidents/violations/${selectedViolation.id}`, {
        trang_thai: editStatusData.trang_thai,
        sub_status: editStatusData.sub_status,
        quyet_dinh: editStatusData.quyet_dinh,
        ghi_chu: editStatusData.ghi_chu,
      });
    } catch (err) {
      console.warn("Không thể lưu trạng thái vi phạm vào CSDL:", err);
    }

    try {
      const hanhViName =
        selectedViolation.nhom_vi_pham ||
        selectedViolation.hanh_vi ||
        selectedViolation.mo_ta ||
        "Dùng đồ có công suất lớn trong phòng";
      const thoiGianStr =
        selectedViolation.thoi_gian ||
        selectedViolation.thoi_diem ||
        new Date().toLocaleDateString("vi-VN");
      const diaDiemStr =
        selectedViolation.dia_diem || selectedViolation.phong || "Phòng KTX";

      if (
        editStatusData.sub_status === "DA_XU_LY_DUT_DIEM" ||
        editStatusData.trang_thai === "DA_XU_LY"
      ) {
        studentNotificationService.notifyFromManagement({
          id: `notif-violation-${selectedViolation.ma_bb}`,
          title: "Kết quả xử lý vi phạm nội quy KTX",
          content: `Vụ việc vi phạm ${selectedViolation.ma_bb} đã được xử lý hoàn tất. Hình thức xử lý: ${editStatusData.quyet_dinh || "Đã xử lý dứt điểm"}. Hồ sơ vi phạm đã được đóng.`,
          type: "violation_resolved",
          msv: selectedViolation.msv,
          actionUrl: "/student/notifications",
          actionLabel: "Xem kết quả",
          meta: {
            scenario: 3,
            ma_bb: selectedViolation.ma_bb,
            hanh_vi: hanhViName,
            hinh_thuc: editStatusData.quyet_dinh || "Đã xử lý dứt điểm",
            ket_luan:
              editStatusData.ghi_chu ||
              "Đã đóng hồ sơ vụ việc và thực hiện theo đúng quyết định kỷ luật.",
            ngay_chot: new Date().toLocaleDateString("vi-VN"),
          },
        });
      } else if (
        editStatusData.sub_status === "CHO_GIAI_TRINH" ||
        editStatusData.trang_thai === "CHO_XU_LY"
      ) {
        studentNotificationService.notifyFromManagement({
          id: `notif-violation-${selectedViolation.ma_bb}`,
          title: "Thông báo ghi nhận vi phạm nội quy KTX",
          content: `Ban quản lý KTX ghi nhận biên bản ${selectedViolation.ma_bb} về hành vi "${hanhViName}" vào ngày ${thoiGianStr}. Vui lòng kiểm tra và gửi bản giải trình trước thời hạn quy định.`,
          type: "violation_warning",
          msv: selectedViolation.msv,
          actionUrl: "/student/notifications",
          actionLabel: "Gửi giải trình",
          meta: {
            scenario: 1,
            ma_bb: selectedViolation.ma_bb,
            hanh_vi: hanhViName,
            ngay: thoiGianStr,
            dia_diem: diaDiemStr,
            msv: selectedViolation.msv,
            mo_ta: selectedViolation.mo_ta,
          },
        });
      } else if (
        editStatusData.sub_status === "HOI_DONG_KY_LUAT" ||
        editStatusData.trang_thai === "DANG_XU_LY"
      ) {
        studentNotificationService.notifyFromManagement({
          id: `notif-violation-${selectedViolation.ma_bb}`,
          title: "Thông báo triệu tập Hội đồng kỷ luật KTX",
          content: `Bạn được triệu tập tham dự cuộc họp Hội đồng kỷ luật KTX liên quan đến vụ việc ${selectedViolation.ma_bb} (${hanhViName}). Vui lòng có mặt đúng thời gian và địa điểm theo thông báo để giải trình.`,
          type: "violation_summon",
          msv: selectedViolation.msv,
          actionUrl: "/student/notifications",
          actionLabel: "Xem chi tiết biên bản",
          meta: {
            scenario: 2,
            ma_bb: selectedViolation.ma_bb,
            hanh_vi: hanhViName,
            dia_diem: diaDiemStr,
            msv: selectedViolation.msv,
            mo_ta: selectedViolation.mo_ta,
          },
        });
      }

      try {
        localStorage.setItem("ktx_notif_tick", Date.now().toString());
        window.dispatchEvent(new Event("ktx-notifications-updated"));
        window.dispatchEvent(new Event("storage"));
      } catch (_) {}
    } catch (e) {
      console.warn("Lỗi gửi thông báo cho sinh viên từ modal:", e);
    }

    showToast("Đã cập nhật biên bản thành công!");
  };

  // Tự động điền họ tên và phòng ở khi nhập Mã sinh viên
  const handleMsvBlur = async () => {
    const rawMsv = createForm.msv.trim().toUpperCase();
    if (!rawMsv) return;
    try {
      const res = await api.get(`/students/${rawMsv}`);
      if (res.data) {
        setCreateForm((prev) => ({
          ...prev,
          msv: rawMsv,
          ho_ten: prev.ho_ten || res.data.ho_ten || "",
          phong: prev.phong || (res.data.phong ? `P${res.data.phong}` : ""),
        }));
      }
    } catch {
      // Bỏ qua nếu chưa tìm thấy sinh viên
    }
  };

  // Xử lý lưu biên bản mới (Đồng bộ đầy đủ tất cả các trường thông tin sang chi tiết)
  const handleSaveNewTicket = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!createForm.msv.trim() || !createForm.mo_ta.trim()) {
      alert("Vui lòng nhập mã sinh viên và mô tả vi phạm.");
      return;
    }
    try {
      const createdRes = await api.post("/incidents/violations", {
        msv: createForm.msv.trim().toUpperCase(),
        ho_ten: createForm.ho_ten.trim(),
        phong: createForm.phong.trim(),
        thoi_gian: createForm.thoi_gian.trim(),
        thoi_diem: createForm.thoi_gian.trim(),
        dia_diem: createForm.dia_diem.trim(),
        nhom_hanh_vi: createForm.nhom_hanh_vi.trim(),
        nhom_vi_pham: createForm.nhom_hanh_vi.trim(),
        mo_ta: createForm.mo_ta.trim(),
        dinh_kem: createForm.dinh_kem,
        bang_chung: createForm.dinh_kem,
        hinh_thuc_xu_ly: createForm.hinh_thuc_xu_ly.trim() || "Đang xem xét",
        trang_thai: "CHO_XU_LY",
        sub_status: "CHO_GIAI_TRINH",
      });
      const { data } = await api.get("/incidents/violations");
      const list = Array.isArray(data) ? data : [];
      setViolations(list);

      // Kịch bản 1: Mặc định khi mới lập biên bản -> Gửi thông báo cảnh báo / nhắc nhở gửi bản giải trình
      const createdTicket = createdRes?.data;
      const maBb =
        createdTicket?.ma_bb ||
        (list.length > 0 ? list[0].ma_bb : `VP-${Date.now().toString(16).toUpperCase()}`);
      const hanhViName =
        createForm.nhom_hanh_vi.trim() ||
        createForm.mo_ta.trim() ||
        "Dùng đồ có công suất lớn trong phòng";
      const thoiGianStr =
        createForm.thoi_gian.trim() ||
        new Date().toLocaleDateString("vi-VN");
      const diaDiemStr =
        createForm.dia_diem.trim() ||
        createForm.phong.trim() ||
        "Phòng KTX";

      try {
        studentNotificationService.notifyFromManagement({
          id: `notif-violation-${maBb}`,
          title: "Thông báo ghi nhận vi phạm nội quy KTX",
          content: `Ban quản lý KTX ghi nhận biên bản ${maBb} về hành vi "${hanhViName}" vào ngày ${thoiGianStr}. Vui lòng kiểm tra và gửi bản giải trình trước thời hạn quy định.`,
          type: "violation_warning",
          msv: createForm.msv.trim().toUpperCase(),
          actionUrl: "/student/notifications",
          actionLabel: "Gửi giải trình",
          meta: {
            scenario: 1,
            ma_bb: maBb,
            hanh_vi: hanhViName,
            ngay: thoiGianStr,
            dia_diem: diaDiemStr,
            msv: createForm.msv.trim().toUpperCase(),
            mo_ta: createForm.mo_ta.trim(),
          },
        });
      } catch (notifErr) {
        console.warn("Lỗi gửi thông báo cho sinh viên:", notifErr);
      }

      setViewMode("list");
      setCreateForm({
        ho_ten: "",
        msv: "",
        phong: "",
        thoi_gian: "",
        dia_diem: "",
        nhom_hanh_vi: "",
        mo_ta: "",
        dinh_kem: [],
        hinh_thuc_xu_ly: "",
      });
      showToast(
        "Đã lập biên bản vi phạm thành công (Trạng thái: Chờ sinh viên giải trình)!",
      );
    } catch (error) {
      showToast(
        error.response?.data?.detail || "Không thể lưu biên bản vi phạm.",
        "error",
      );
    }
  };

  // Helper render trạng thái Badge
  const renderStatusBadge = (status) => {
    switch (status) {
      case "DA_XU_LY":
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-[6px] text-xs font-semibold bg-[#dcfce7] text-[#15803d] border border-emerald-200/60 min-w-[76px]">
            Đã xử lý
          </span>
        );
      case "CHO_XU_LY":
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-[6px] text-xs font-semibold bg-[#fef3c7] text-[#b45309] border border-amber-200/60 min-w-[76px]">
            Chờ xử lý
          </span>
        );
      case "KHAN_CAP":
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-[6px] text-xs font-semibold bg-[#ffe4e6] text-[#be123c] border border-rose-200/60 min-w-[76px]">
            Khẩn cấp
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center justify-center px-3 py-1 rounded-[6px] text-xs font-semibold bg-slate-100 text-slate-700 min-w-[76px]">
            {status}
          </span>
        );
    }
  };

  const getStatusText = (status) => {
    if (status === "DA_XU_LY") return "Đã xử lý";
    if (status === "KHAN_CAP") return "Khẩn cấp";
    return "Chờ xử lý";
  };

  const getStatusColorClass = (status) => {
    if (status === "DA_XU_LY") return "text-emerald-600";
    if (status === "KHAN_CAP") return "text-rose-600";
    return "text-amber-500";
  };

  // =========================================================================
  // VIEW 3: LẬP BIÊN BẢN MỚI
  // =========================================================================
  if (viewMode === "create") {
    return (
      <div className="w-full bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-10 flex flex-col gap-8 shadow-xs select-none">
        {/* Toast thông báo */}
        {toast && (
          <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-sm rounded-xl shadow-xl transition-all">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toast.message}</span>
          </div>
        )}

        {/* Header: Nút quay lại kèm tiêu đề */}
        <button
          type="button"
          onClick={() => setViewMode("list")}
          className="flex items-center gap-3 text-slate-900 hover:text-blue-600 transition-colors cursor-pointer text-left w-fit"
        >
          <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Lập biên bản mới
          </h1>
        </button>

        {/* Khối 1: Thông tin sinh viên */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-bold text-slate-900">
            Thông tin sinh viên
          </h2>
          <div className="flex flex-col">
            <div className="border-b border-slate-300">
              <input
                type="text"
                placeholder="Họ tên sinh viên"
                value={createForm.ho_ten}
                onChange={(e) =>
                  setCreateForm({ ...createForm, ho_ten: e.target.value })
                }
                className="w-full py-2.5 px-1 text-sm text-slate-800 placeholder:text-slate-500 bg-transparent focus:outline-none"
              />
            </div>

            <div className="border-b border-slate-300">
              <input
                type="text"
                placeholder="Mã sinh viên"
                value={createForm.msv}
                onBlur={handleMsvBlur}
                onChange={(e) =>
                  setCreateForm({ ...createForm, msv: e.target.value })
                }
                className="w-full py-2.5 px-1 text-sm text-slate-800 placeholder:text-slate-500 bg-transparent focus:outline-none"
              />
            </div>

            <div className="border-b border-slate-300">
              <input
                type="text"
                placeholder="Phòng ở hiện tại"
                value={createForm.phong}
                onChange={(e) =>
                  setCreateForm({ ...createForm, phong: e.target.value })
                }
                className="w-full py-2.5 px-1 text-sm text-slate-800 placeholder:text-slate-500 bg-transparent focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Khối 2: Nội dung vi phạm */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-bold text-slate-900">
            Nội dung vi phạm
          </h2>
          <div className="flex flex-col">
            <div className="border-b border-slate-300">
              <input
                type="text"
                placeholder="Thời gian vi phạm"
                value={createForm.thoi_gian}
                onChange={(e) =>
                  setCreateForm({ ...createForm, thoi_gian: e.target.value })
                }
                className="w-full py-2.5 px-1 text-sm text-slate-800 placeholder:text-slate-500 bg-transparent focus:outline-none"
              />
            </div>

            <div className="relative border-b border-slate-300">
              {!createForm.dia_diem && (
                <div className="absolute inset-y-0 left-1 flex items-center pointer-events-none text-sm text-slate-500">
                  <span>Địa điểm xảy ra</span>
                  <span className="text-red-500 ml-1 font-semibold">*</span>
                </div>
              )}
              <input
                type="text"
                value={createForm.dia_diem}
                onChange={(e) =>
                  setCreateForm({ ...createForm, dia_diem: e.target.value })
                }
                className="w-full py-2.5 px-1 text-sm text-slate-800 bg-transparent focus:outline-none"
              />
            </div>

            <div className="border-b border-slate-300">
              <input
                type="text"
                placeholder="Nhóm hành vi vi phạm"
                value={createForm.nhom_hanh_vi}
                onChange={(e) =>
                  setCreateForm({ ...createForm, nhom_hanh_vi: e.target.value })
                }
                className="w-full py-2.5 px-1 text-sm text-slate-800 placeholder:text-slate-500 bg-transparent focus:outline-none"
              />
            </div>

            <div className="border-b border-slate-300">
              <input
                type="text"
                placeholder="Mô tả chi tiết hành vi"
                value={createForm.mo_ta}
                onChange={(e) =>
                  setCreateForm({ ...createForm, mo_ta: e.target.value })
                }
                className="w-full py-2.5 px-1 text-sm text-slate-800 placeholder:text-slate-500 bg-transparent focus:outline-none"
              />
            </div>

            <div className="border-b border-slate-300 flex items-center justify-between">
              <input
                type="text"
                readOnly
                placeholder="Đính kèm hình ảnh/biên bản giấy (nếu có)"
                value={
                  createForm.dinh_kem.length > 0
                    ? createForm.dinh_kem.join(", ")
                    : ""
                }
                onClick={() =>
                  document.getElementById("ticket-attachment-input")?.click()
                }
                className="w-full py-2.5 px-1 text-sm text-slate-800 placeholder:text-slate-500 bg-transparent focus:outline-none cursor-pointer"
              />
              <input
                id="ticket-attachment-input"
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []).map(
                    (f) => f.name,
                  );
                  if (files.length > 0) {
                    setCreateForm((prev) => ({
                      ...prev,
                      dinh_kem: [...prev.dinh_kem, ...files],
                    }));
                  }
                }}
              />
              <button
                type="button"
                onClick={() =>
                  document.getElementById("ticket-attachment-input")?.click()
                }
                className="text-slate-400 hover:text-blue-600 p-1 cursor-pointer"
                title="Tải tệp đính kèm"
              >
                <ImageIcon className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Khối 3: Đề xuất xử lý */}
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-bold text-slate-900">Đề xuất xử lý</h2>
          <div className="border-b border-slate-300">
            <input
              type="text"
              placeholder="Hình thức xử lý đề xuất"
              value={createForm.hinh_thuc_xu_ly}
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  hinh_thuc_xu_ly: e.target.value,
                })
              }
              className="w-full py-2.5 px-1 text-sm text-slate-800 placeholder:text-slate-500 bg-transparent focus:outline-none"
            />
          </div>
        </div>

        {/* 2 Nút hành động */}
        <div className="flex items-center justify-end gap-3 pt-6">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-semibold transition-all shadow-xs cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Hủy thao tác</span>
          </button>

          <button
            type="button"
            onClick={handleSaveNewTicket}
            className="flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-sky-50 text-sky-500 border border-sky-400 rounded-full text-sm font-semibold transition-all shadow-2xs cursor-pointer"
          >
            <Save className="w-4 h-4 text-sky-500" />
            <span>Lưu biên bản</span>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: CHI TIẾT BIÊN BẢN
  // =========================================================================
  if (viewMode === "detail" && selectedViolation) {
    const v = selectedViolation;

    return (
      <div className="w-full bg-slate-100/80 p-6 rounded-3xl border border-slate-200/60 space-y-6 flex-1 flex flex-col select-none">
        {/* Toast thông báo */}
        {toast && (
          <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-sm rounded-xl shadow-xl transition-all">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toast.message}</span>
          </div>
        )}

        {/* Header Chi tiết biên bản */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleBackToList}
            className="flex items-center gap-2 text-slate-900 hover:text-blue-600 transition-colors cursor-pointer text-left"
          >
            <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-800">
              Chi tiết biên bản {v.ma_bb}
            </h1>
          </button>

          <button
            type="button"
            onClick={() => setIsUpdateModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-semibold transition-all shadow-xs hover:shadow-md cursor-pointer shrink-0"
          >
            <Edit3 className="w-4 h-4" />
            <span>Cập nhật trạng thái</span>
          </button>
        </div>

        {/* Hàng thông tin tóm tắt */}
        <div className="flex flex-wrap items-center gap-8 text-sm sm:text-base border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-900">Trạng thái:</span>
            <span className={`font-bold ${getStatusColorClass(v.trang_thai)}`}>
              {getStatusText(v.trang_thai)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-900">Ngày lập:</span>
            <span className="text-slate-700 font-medium">{v.ngay_lap}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-900">Người lập:</span>
            <span className="text-slate-700 font-medium">{v.nguoi_lap}</span>
          </div>
        </div>

        {/* 2 Cột: Thông tin sinh viên & Nội dung vi phạm */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2.5">
            <h2 className="text-base font-bold text-slate-900">
              Thông tin sinh viên
            </h2>
            <div className="flex flex-col gap-2">
              <div className="bg-white border border-slate-200/90 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs">
                <span className="font-medium">Họ và tên: </span>
                <span className="font-semibold">{v.ho_ten}</span>
              </div>
              <div className="bg-white border border-slate-200/90 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs">
                <span className="font-medium">Mã SV: </span>
                <span className="font-semibold">{v.msv}</span>
              </div>
              <div className="bg-white border border-slate-200/90 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs">
                <span className="font-medium">Phòng ở: </span>
                <span className="font-semibold">{v.phong_ngan || v.phong}</span>
              </div>
              <div className="bg-white border border-slate-200/90 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs">
                <span className="font-medium">Số điện thoại: </span>
                <span className="font-semibold">{v.sdt}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <h2 className="text-base font-bold text-slate-900">
              Nội dung vi phạm
            </h2>
            <div className="flex flex-col gap-2">
              <div className="bg-white border border-slate-200/90 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs">
                <span className="font-medium">Nhóm vi phạm: </span>
                <span className="font-semibold">{v.nhom_vi_pham}</span>
              </div>
              <div className="bg-white border border-slate-200/90 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs">
                <span className="font-medium">Thời điểm: </span>
                <span className="font-semibold">{v.thoi_diem}</span>
              </div>
              <div className="bg-white border border-slate-200/90 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs">
                <span className="font-medium">Địa điểm: </span>
                <span className="font-semibold">{v.dia_diem}</span>
              </div>
              <div className="bg-white border border-slate-200/90 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs">
                <span className="font-medium">Số lần vi phạm lũy kế: </span>
                <span className="font-semibold">{v.so_lan_luy_ke}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Khối: Mô tả sự việc */}
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-bold text-slate-900">Mô tả sự việc</h2>
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 text-sm text-slate-700 leading-relaxed shadow-2xs">
            {v.mo_ta}
          </div>
        </div>

        {/* Khối: Bằng chứng ghi nhận */}
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-bold text-slate-900">
            Bằng chứng ghi nhận
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            {v.bang_chung && v.bang_chung.length > 0 ? (
              v.bang_chung.map((file, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPreviewImageName(file)}
                  className="text-blue-500 hover:text-blue-700 font-medium text-sm hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-blue-500" />
                  <span>{file}</span>
                </button>
              ))
            ) : (
              <span className="text-sm text-slate-400 italic">
                Không có tài liệu đính kèm
              </span>
            )}
          </div>
        </div>

        {/* Khối: Cập nhật kết quả xử lý (Bóc tách dữ liệu có cấu trúc) */}
        {(() => {
          const parsedSummon = parseSummonData(v.ghi_chu);
          const parsedResolution = parseResolutionData(
            v.ghi_chu,
            v.quyet_dinh || v.hinh_thuc_xu_ly,
          );
          const summonDisplayDate =
            parsedSummon?.ngay ||
            (parsedSummon?.thoi_gian
              ? parsedSummon.thoi_gian.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/)?.[1]
              : "") ||
            "22/10/2026";

          return (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">
                  Cập nhật kết quả xử lý
                </h2>
                {v.sub_status === "HOI_DONG_KY_LUAT" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs">
                    <Scale className="w-3.5 h-3.5" />
                    <span>Chờ họp Hội đồng kỷ luật</span>
                  </span>
                ) : v.sub_status === "DA_XU_LY_DUT_DIEM" ||
                  v.trang_thai === "DA_XU_LY" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Đã xử lý dứt điểm</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Chờ sinh viên giải trình</span>
                  </span>
                )}
              </div>

              {/* Giao diện khi ở Hội đồng kỷ luật */}
              {v.sub_status === "HOI_DONG_KY_LUAT" ? (
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 text-sm shadow-2xs flex flex-col gap-4">
                  {/* Hàng 1: Thời gian & Địa điểm */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-1">
                    <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-3 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">
                          Thời gian triệu tập
                        </span>
                        <span className="text-sm font-bold text-slate-900 block mt-0.5">
                          {parsedSummon?.thoi_gian || "08:30 - 22/10/2026"}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          Địa điểm triệu tập
                        </span>
                        <span className="text-sm font-bold text-slate-900 block mt-0.5">
                          {parsedSummon?.dia_diem ||
                            "Văn phòng Ban quản lý KTX"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Hàng 2: Thành phần tham gia */}
                  {parsedSummon?.thanh_phan && (
                    <div className="pt-1 flex items-start gap-2.5">
                      <Users className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                          Thành phần tham gia:
                        </span>
                        <div className="text-sm text-slate-800 bg-slate-50/90 border border-slate-200/70 rounded-xl px-3.5 py-2 font-medium">
                          {parsedSummon.thanh_phan}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Hàng 3: Yêu cầu đối với sinh viên */}
                  <div className="pt-1 flex items-start gap-2.5">
                    <FileText className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wide block mb-1">
                        Yêu cầu đối với sinh viên:
                      </span>
                      <div className="text-sm text-amber-900 bg-amber-50/80 border border-amber-200/80 rounded-xl px-3.5 py-2.5 font-medium leading-relaxed">
                        {parsedSummon?.yeu_cau ||
                          "Yêu cầu có mặt đúng giờ, mang theo Thẻ sinh viên và nộp bản tự kiểm điểm."}
                      </div>
                    </div>
                  </div>

                  {/* Nút hành động sửa lịch trực tiếp */}
                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenSummonModal(v)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Sửa lịch triệu tập</span>
                    </button>
                  </div>
                </div>
              ) : v.sub_status === "DA_XU_LY_DUT_DIEM" ||
                v.trang_thai === "DA_XU_LY" ? (
                /* Giao diện khi Đã xử lý dứt điểm */
                <div className="bg-white border border-slate-200/90 rounded-2xl p-5 text-sm shadow-2xs flex flex-col gap-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Hình thức kỷ luật chính thức:
                    </span>
                    <span className="inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs">
                      {parsedResolution.quyet_dinh ||
                        v.quyet_dinh ||
                        v.hinh_thuc_xu_ly ||
                        "Khiển trách"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Quyết định / Kết luận của Hội đồng:
                    </span>
                    <div className="text-sm text-slate-800 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 font-medium leading-relaxed">
                      {parsedResolution.ket_luan ||
                        v.ghi_chu ||
                        "Đã đóng hồ sơ vụ việc và thực hiện theo đúng quyết định kỷ luật."}
                    </div>
                  </div>

                  {parsedResolution.file && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Biên bản xử lý đính kèm:
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold shadow-2xs">
                        <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                        <span>{parsedResolution.file}</span>
                      </span>
                    </div>
                  )}

                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenResolveModal(v)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Chỉnh sửa kết luận</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Giao diện mặc định (Chờ giải trình) */
                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 text-sm flex flex-col gap-3 shadow-2xs divide-y divide-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 pb-1">
                    <span className="text-slate-800 font-medium">
                      Hình thức xử lý dự kiến:
                    </span>
                    <span className="text-slate-700 font-semibold">
                      {v.quyet_dinh || v.hinh_thuc_xu_ly || "Đang xem xét"}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4 pt-3">
                    <span className="text-slate-800 font-medium shrink-0">
                      Ghi chú bổ sung:
                    </span>
                    <span className="text-slate-500 text-right">
                      {(() => {
                        if (!v.ghi_chu) return "Chưa có ghi chú thêm.";
                        if (typeof v.ghi_chu === "string" && v.ghi_chu.trim().startsWith("{")) {
                          try {
                            const parsed = JSON.parse(v.ghi_chu);
                            if (parsed.raw_text && !parsed.raw_text.includes("Lịch triệu tập")) return parsed.raw_text;
                            return "Đang chờ sinh viên gửi bản giải trình.";
                          } catch (_) {
                            return "Chưa có ghi chú thêm.";
                          }
                        }
                        if (typeof v.ghi_chu === "string" && v.ghi_chu.includes("Lịch triệu tập")) {
                          return "Đang chờ sinh viên gửi bản giải trình.";
                        }
                        return v.ghi_chu;
                      })()}
                    </span>
                  </div>
                </div>
              )}

              {/* Kịch bản 1: Bản giải trình / Ý kiến phản hồi của sinh viên */}
              {studentExplanation ? (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col gap-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Bản giải trình / Ý kiến phản hồi từ sinh viên
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-white/90 px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                      Đã nhận phản hồi {studentExplanationAt ? `(${studentExplanationAt})` : ""}
                    </span>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-100 text-sm text-slate-800 font-medium whitespace-pre-line leading-relaxed shadow-2xs">
                    {studentExplanation}
                  </div>
                  <div className="flex items-center justify-between text-xs text-emerald-800/80 pt-0.5 flex-wrap gap-1">
                    <span>Sinh viên: {v.ho_ten} ({v.msv})</span>
                    <span className="italic">Ban quản lý căn cứ ý kiến trên để xem xét trước khi đưa ra quyết định tiếp theo.</span>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50/60 border border-dashed border-amber-200/90 rounded-2xl p-4 text-xs sm:text-sm text-amber-900 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Trạng thái giải trình:</strong> Sinh viên chưa gửi bản giải trình qua hệ thống (hoặc nộp trực tiếp tại văn phòng).
                    </span>
                  </div>
                  <span className="text-xs bg-amber-100/90 text-amber-800 font-bold px-2.5 py-1 rounded-lg shrink-0">
                    Chờ phản hồi
                  </span>
                </div>
              )}

              {/* Khối: Trạng thái xử lý (Action Bar tối ưu) */}
              <div className="flex flex-col gap-3 pt-3">
                <h2 className="text-base font-bold text-slate-900">
                  Trạng thái xử lý:
                </h2>

                <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  {/* Vế Trái: Trạng thái hiện tại hoặc nút trạng thái */}
                  {v.sub_status === "HOI_DONG_KY_LUAT" ? (
                    <div className="flex flex-wrap items-center gap-3 bg-rose-50 border border-rose-200/90 rounded-2xl px-4 py-3 flex-1">
                      <div className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                        <Scale className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 block">
                          Giai đoạn hiện tại
                        </span>
                        <span className="text-sm sm:text-base font-bold text-rose-950">
                          Đã chuyển Hội đồng - Chờ họp ({summonDisplayDate})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenSummonModal(v)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                        title="Thay đổi thời gian hoặc địa điểm triệu tập"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Sửa lịch</span>
                      </button>
                    </div>
                  ) : v.sub_status === "DA_XU_LY_DUT_DIEM" ||
                    v.trang_thai === "DA_XU_LY" ? (
                    <div className="flex flex-wrap items-center gap-3 bg-emerald-50 border border-emerald-200/90 rounded-2xl px-4 py-3 flex-1">
                      <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
                          Hồ sơ vụ việc
                        </span>
                        <span className="text-sm sm:text-base font-bold text-emerald-950">
                          Đã xử lý dứt điểm & Đóng hồ sơ
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenResolveModal(v)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Sửa kết quả</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickChangeSubStatus("CHO_GIAI_TRINH")
                        }
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer border ${
                          v.sub_status === "CHO_GIAI_TRINH"
                            ? "bg-amber-50 border-amber-300 text-amber-800 shadow-2xs"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        Chờ sinh viên giải trình
                      </button>
                    </div>
                  )}

                  {/* Vế Phải: Các Action Button */}
                  <div className="flex flex-wrap items-center gap-3 justify-end">
                    {/* Nút phụ: Chuyển về Chờ giải trình nếu đang ở Hội đồng kỷ luật */}
                    {v.sub_status === "HOI_DONG_KY_LUAT" && (
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickChangeSubStatus("CHO_GIAI_TRINH")
                        }
                        className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                      >
                        Chuyển về Chờ giải trình
                      </button>
                    )}

                    {/* Nút phụ: Đã xử lý dứt điểm (viền xanh/xám, mở popup) */}
                    {v.sub_status !== "DA_XU_LY_DUT_DIEM" &&
                      v.trang_thai !== "DA_XU_LY" && (
                        <button
                          type="button"
                          onClick={() => handleOpenResolveModal(v)}
                          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer border border-emerald-500/80 text-emerald-700 bg-white hover:bg-emerald-50/80 shadow-2xs flex items-center gap-2 active:scale-98"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Đã xử lý dứt điểm</span>
                        </button>
                      )}

                    {/* Nút chính: Lên lịch triệu tập Hội đồng (nền đỏ/nổi bật, mở popup) */}
                    {v.sub_status !== "HOI_DONG_KY_LUAT" &&
                      v.sub_status !== "DA_XU_LY_DUT_DIEM" &&
                      v.trang_thai !== "DA_XU_LY" && (
                        <button
                          type="button"
                          onClick={() => handleOpenSummonModal(v)}
                          className="px-5 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-700 hover:to-rose-700 shadow-sm flex items-center gap-2 active:scale-98"
                        >
                          <Scale className="w-4 h-4" />
                          <span>Lên lịch triệu tập Hội đồng</span>
                        </button>
                      )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Modal Cập nhật trạng thái */}
        {isUpdateModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-lg font-bold text-slate-900">
                  Cập nhật trạng thái biên bản {v.ma_bb}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsUpdateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={handleSaveStatusModal}
                className="flex flex-col gap-4"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Trạng thái chính
                  </label>
                  <select
                    value={editStatusData.trang_thai}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditStatusData((prev) => ({
                        ...prev,
                        trang_thai: val,
                        sub_status:
                          val === "DA_XU_LY"
                            ? "DA_XU_LY_DUT_DIEM"
                            : val === "KHAN_CAP"
                              ? "HOI_DONG_KY_LUAT"
                              : "CHO_GIAI_TRINH",
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="CHO_XU_LY">Chờ xử lý</option>
                    <option value="DA_XU_LY">Đã xử lý</option>
                    <option value="KHAN_CAP">Khẩn cấp</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Giai đoạn xử lý
                  </label>
                  <select
                    value={editStatusData.sub_status}
                    onChange={(e) =>
                      setEditStatusData({
                        ...editStatusData,
                        sub_status: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="CHO_GIAI_TRINH">
                      Chờ sinh viên giải trình
                    </option>
                    <option value="DA_XU_LY_DUT_DIEM">Đã xử lý dứt điểm</option>
                    <option value="HOI_DONG_KY_LUAT">
                      Chuyển lên cho hội đồng kỷ luật
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Quyết định kỷ luật chính thức
                  </label>
                  <input
                    type="text"
                    value={editStatusData.quyet_dinh}
                    onChange={(e) =>
                      setEditStatusData({
                        ...editStatusData,
                        quyet_dinh: e.target.value,
                      })
                    }
                    placeholder="Nhập hình thức kỷ luật..."
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Ghi chú bổ sung
                  </label>
                  <textarea
                    rows={3}
                    value={editStatusData.ghi_chu}
                    onChange={(e) =>
                      setEditStatusData({
                        ...editStatusData,
                        ghi_chu: e.target.value,
                      })
                    }
                    placeholder="Ghi chú yêu cầu nộp kiểm điểm, liên hệ phụ huynh..."
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsUpdateModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition shadow-xs cursor-pointer"
                  >
                    Lưu cập nhật
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal xem trước ảnh bằng chứng */}
        {previewImageName && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="font-bold text-slate-800 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-blue-600" />
                  {previewImageName}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewImageName(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="w-full h-64 bg-slate-100 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center p-6 text-center text-slate-500 gap-2">
                <ImageIcon className="w-12 h-12 text-slate-400 stroke-[1.5]" />
                <p className="text-sm font-semibold text-slate-700">
                  Hình ảnh bằng chứng hiện trường
                </p>
                <p className="text-xs text-slate-400 max-w-xs">
                  File: {previewImageName} (Ghi nhận biên bản vi phạm KTX ICTU)
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setPreviewImageName(null)}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Lên lịch triệu tập Hội đồng kỷ luật */}
        {isSummonModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">
                      Lên lịch triệu tập Hội đồng Kỷ luật
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Biên bản:{" "}
                      <span className="font-semibold text-slate-700">
                        {v.ma_bb}
                      </span>{" "}
                      • Sinh viên:{" "}
                      <span className="font-semibold text-slate-700">
                        {v.ho_ten} ({v.msv})
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSummonModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Hộp lưu ý */}
              <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-2xl text-xs text-rose-800 leading-relaxed flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  Hệ thống sẽ lưu thông tin triệu tập thành các trường cấu trúc
                  rõ ràng và{" "}
                  <b>tự động gửi thông báo triệu tập kèm lịch họp</b> đến tài
                  khoản sinh viên <b>{v.ho_ten}</b>.
                </div>
              </div>

              <form
                onSubmit={handleConfirmSummon}
                className="flex flex-col gap-4"
              >
                {/* 1. Thời gian triệu tập */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-rose-600" />
                    <span>
                      Thời gian triệu tập{" "}
                      <span className="text-rose-500">*</span>
                    </span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[11px] text-slate-500 mb-1 block">
                        Ngày họp:
                      </span>
                      <input
                        type="date"
                        required
                        value={summonForm.ngay}
                        onChange={(e) =>
                          setSummonForm((prev) => ({
                            ...prev,
                            ngay: e.target.value,
                          }))
                        }
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-rose-500 focus:outline-none transition"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 mb-1 block">
                        Giờ họp:
                      </span>
                      <input
                        type="time"
                        required
                        value={summonForm.gio}
                        onChange={(e) =>
                          setSummonForm((prev) => ({
                            ...prev,
                            gio: e.target.value,
                          }))
                        }
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-rose-500 focus:outline-none transition"
                      />
                    </div>
                  </div>
                  {/* Quick time pills */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-400">
                      Gợi ý giờ:
                    </span>
                    {["08:00", "08:30", "09:00", "14:00", "14:30", "15:30"].map(
                      (t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() =>
                            setSummonForm((prev) => ({ ...prev, gio: t }))
                          }
                          className={`text-[11px] px-2 py-0.5 rounded-md font-medium transition cursor-pointer border ${
                            summonForm.gio === t
                              ? "bg-rose-100 text-rose-700 border-rose-300 font-bold"
                              : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {t}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {/* 2. Địa điểm triệu tập */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-600" />
                    <span>
                      Địa điểm triệu tập{" "}
                      <span className="text-rose-500">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    required
                    value={summonForm.dia_diem}
                    onChange={(e) =>
                      setSummonForm((prev) => ({
                        ...prev,
                        dia_diem: e.target.value,
                      }))
                    }
                    placeholder="Ví dụ: Văn phòng Ban quản lý KTX"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-rose-500 focus:outline-none transition"
                  />
                  {/* Quick location pills */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {[
                      "Văn phòng Ban quản lý KTX",
                      "Phòng họp Hội đồng (Tầng 1 - Nhà A)",
                      "Văn phòng Quản trị Tòa B",
                    ].map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() =>
                          setSummonForm((prev) => ({
                            ...prev,
                            dia_diem: loc,
                          }))
                        }
                        className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 border border-slate-200 transition cursor-pointer"
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Thành phần tham gia */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-rose-600" />
                    <span>Thành phần tham gia</span>
                  </label>
                  <input
                    type="text"
                    value={summonForm.thanh_phan}
                    onChange={(e) =>
                      setSummonForm((prev) => ({
                        ...prev,
                        thanh_phan: e.target.value,
                      }))
                    }
                    placeholder="Ví dụ: Ban quản lý KTX, Quản trị tòa P202 - Tòa B, Sinh viên vi phạm"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-rose-500 focus:outline-none transition"
                  />
                </div>

                {/* 4. Yêu cầu đối với sinh viên */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-rose-600" />
                    <span>
                      Yêu cầu đối với sinh viên{" "}
                      <span className="text-rose-500">*</span>
                    </span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={summonForm.yeu_cau}
                    onChange={(e) =>
                      setSummonForm((prev) => ({
                        ...prev,
                        yeu_cau: e.target.value,
                      }))
                    }
                    placeholder="Ví dụ: Mang theo Thẻ sinh viên, bản tự kiểm điểm và các tài liệu giải trình liên quan..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-rose-500 focus:outline-none transition leading-relaxed"
                  />
                  {/* Quick requirement chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-slate-400">
                      Thêm nhanh:
                    </span>
                    {[
                      "Thẻ sinh viên",
                      "Bản tự kiểm điểm",
                      "Bản tường trình sự việc",
                      "Có mặt đúng giờ",
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          setSummonForm((prev) => {
                            if (prev.yeu_cau.includes(chip)) return prev;
                            const sep =
                              prev.yeu_cau.trim().length > 0 ? ", " : "";
                            return {
                              ...prev,
                              yeu_cau: `${prev.yeu_cau.trim()}${sep}${chip}`,
                            };
                          });
                        }}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 border border-slate-200 transition cursor-pointer"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsSummonModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl text-sm font-bold transition shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer active:scale-98"
                  >
                    <Scale className="w-4 h-4" />
                    <span>Xác nhận & Phát thông báo</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Chốt kết quả xử lý vi phạm */}
        {isResolveModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">
                      Chốt kết quả xử lý vi phạm
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Biên bản:{" "}
                      <span className="font-semibold text-slate-700">
                        {v.ma_bb}
                      </span>{" "}
                      • Sinh viên:{" "}
                      <span className="font-semibold text-slate-700">
                        {v.ho_ten}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Hộp lưu ý */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl text-xs text-emerald-800 leading-relaxed flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  Hồ sơ vụ việc sẽ được đóng dứt điểm, trạng thái chuyển thành
                  màu xanh lá (<b>Đã xử lý dứt điểm</b>) và hệ thống sẽ gửi{" "}
                  <b>thông báo kết quả chính thức</b> tới tài khoản sinh viên.
                </div>
              </div>

              <form
                onSubmit={handleConfirmResolve}
                className="flex flex-col gap-4"
              >
                {/* 1. Hình thức kỷ luật chính thức */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Hình thức kỷ luật chính thức{" "}
                    <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={resolveForm.hinh_thuc}
                    onChange={(e) =>
                      setResolveForm((prev) => ({
                        ...prev,
                        hinh_thuc: e.target.value,
                      }))
                    }
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none transition cursor-pointer"
                  >
                    <option value="Khiển trách">Khiển trách</option>
                    <option value="Cảnh cáo toàn KTX">Cảnh cáo toàn KTX</option>
                    <option value="Đình chỉ ở KTX 1 học kỳ">
                      Đình chỉ ở KTX 1 học kỳ
                    </option>
                    <option value="Buộc thôi ở KTX">Buộc thôi ở KTX</option>
                    <option value="Hòa giải không phạt">
                      Hòa giải không phạt
                    </option>
                    <option value="Bồi thường thiệt hại & Trừ điểm rèn luyện">
                      Bồi thường thiệt hại & Trừ điểm rèn luyện
                    </option>
                  </select>
                </div>

                {/* 2. Quyết định / Kết luận của Hội đồng */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Quyết định / Kết luận của Hội đồng{" "}
                    <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={resolveForm.ket_luan}
                    onChange={(e) =>
                      setResolveForm((prev) => ({
                        ...prev,
                        ket_luan: e.target.value,
                      }))
                    }
                    placeholder="Ví dụ: Căn cứ Quyết định số 14/QĐ-BQLKTX: Cảnh cáo toàn KTX đối với sinh viên do vi phạm quy chế an ninh trật tự. Sinh viên cam kết không tái phạm..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none transition leading-relaxed"
                  />
                </div>

                {/* 3. Đính kèm biên bản xử lý (nếu có) */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Đính kèm biên bản xử lý (nếu có)
                  </label>
                  <input
                    type="file"
                    id="resolve-attachment-file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setResolveForm((prev) => ({
                          ...prev,
                          attachedFileName: file.name,
                        }));
                      }
                    }}
                  />

                  {resolveForm.attachedFileName ? (
                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-semibold text-slate-800">
                          {resolveForm.attachedFileName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setResolveForm((prev) => ({
                            ...prev,
                            attachedFileName: "",
                          }))
                        }
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        title="Gỡ tệp"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("resolve-attachment-file")
                          ?.click()
                      }
                      className="w-full py-3 px-4 border border-dashed border-slate-300 hover:border-emerald-500 rounded-xl bg-slate-50 hover:bg-emerald-50/40 text-slate-600 hover:text-emerald-700 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>
                        Chọn file quyết định / biên bản có dấu ký (.pdf, .jpg,
                        .png)
                      </span>
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsResolveModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-sm font-bold transition shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer active:scale-98"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác nhận đóng hồ sơ</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: DANH SÁCH BIÊN BẢN VI PHẠM
  // =========================================================================
  return (
    <div className="w-full bg-slate-100/80 p-6 rounded-3xl border border-slate-200/60 space-y-6 flex-1 flex flex-col select-none">
      {/* Toast thông báo */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-sm rounded-xl shadow-xl transition-all">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header chính: Tiêu đề lớn đồng bộ Admin & Nút Lập biên bản mới */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">
          QUẢN LÝ VI PHẠM
        </h1>
        <button
          type="button"
          onClick={() => setViewMode("create")}
          className="flex items-center justify-center gap-1.5 px-5 py-2 rounded-full border border-blue-500 text-blue-600 bg-white hover:bg-blue-50/80 text-sm font-semibold transition-colors shadow-2xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Lập biên bản mới</span>
        </button>
      </div>

      {/* 3 Thẻ thống kê */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div className="text-[12px] font-bold text-slate-400 tracking-wider uppercase mb-2">
            TỔNG VỤ VI PHẠM KỲ NÀY
          </div>
          <div className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            {stats.totalDisplay} vụ
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div className="text-[12px] font-bold text-slate-400 tracking-wider uppercase mb-2">
            CHỜ XÁC NHẬN/XỬ LÝ
          </div>
          <div className="text-3xl sm:text-4xl font-black text-amber-500 tracking-tight">
            {stats.pendingDisplay} trường hợp
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div className="text-[12px] font-bold text-slate-400 tracking-wider uppercase mb-2">
            ĐÃ XỬ LÝ DỨT ĐIỂM
          </div>
          <div className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight">
            {stats.resolvedDisplay} trường hợp
          </div>
        </div>
      </div>

      {/* Thanh bộ lọc tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => {
              setFilterTab("ALL");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filterTab === "ALL"
                ? "bg-blue-100/90 text-blue-600 border border-blue-400/80 shadow-2xs"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            Tất cả ({stats.totalCount})
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterTab("KHAN_CAP");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filterTab === "KHAN_CAP"
                ? "bg-rose-100 text-rose-700 border border-rose-400/80 shadow-2xs"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            Khẩn cấp
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterTab("CHO_XU_LY");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filterTab === "CHO_XU_LY"
                ? "bg-amber-100 text-amber-700 border border-amber-400/80 shadow-2xs"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            Chờ xử lý
          </button>

          <button
            type="button"
            onClick={() => {
              setFilterTab("DA_XU_LY");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
              filterTab === "DA_XU_LY"
                ? "bg-emerald-100 text-emerald-700 border border-emerald-400/80 shadow-2xs"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            Đã xử lý
          </button>
        </div>
      </div>

      {/* Bảng danh sách biên bản */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1050px] table-fixed">
            <thead>
              <tr className="bg-[#dbeafe] text-slate-900 text-sm font-bold border-b border-blue-200/50">
                <th className="py-3.5 px-4 whitespace-nowrap w-[15%]">
                  Mã VP
                </th>
                <th className="py-3.5 px-4 whitespace-nowrap w-[13%]">
                  Mã SV
                </th>
                <th className="py-3.5 px-4 whitespace-nowrap w-[16%]">
                  Họ và tên
                </th>
                <th className="py-3.5 px-4 whitespace-nowrap w-[12%]">
                  Phòng
                </th>
                <th className="py-3.5 px-4 whitespace-nowrap w-[18%]">
                  Hành vi vi phạm
                </th>
                <th className="py-3.5 px-4 whitespace-nowrap w-[14%]">
                  Hình thức xử lý
                </th>
                <th className="py-3.5 px-4 whitespace-nowrap text-center w-[12%]">
                  Trạng thái
                </th>
                <th className="py-3.5 px-4 whitespace-nowrap text-right w-[10%]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedViolations?.length > 0 ? (
                paginatedViolations.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-4 px-4 font-bold text-slate-900 truncate" title={row.ma_bb}>
                      {row.ma_bb}
                    </td>
                    <td className="py-4 px-4 font-mono font-medium text-slate-600 truncate">
                      {row.msv}
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-800 truncate" title={row.ho_ten}>
                      {row.ho_ten}
                    </td>
                    <td className="py-4 px-4 text-slate-600 truncate">
                      {row.phong}
                    </td>
                    <td className="py-4 px-4 text-slate-600 leading-relaxed">
                      <div className="line-clamp-2" title={row.hanh_vi}>
                        {row.hanh_vi}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-600 leading-relaxed">
                      <div className="line-clamp-2" title={row.hinh_thuc_xu_ly}>
                        {row.hinh_thuc_xu_ly}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center justify-center gap-1">
                        {renderStatusBadge(row.trang_thai)}
                        {(row.giai_trinh ||
                          localStorage.getItem(
                            `ktx_violation_explanation_${row.ma_bb}`,
                          )) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Đã giải trình
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleViewDetail(row)}
                        className="text-blue-500 hover:text-blue-700 hover:underline text-xs font-semibold cursor-pointer"
                      >
                        xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Chưa có biên bản vi phạm nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {totalPages > 1 && (
          <div className="py-4 px-6 border-t border-slate-100 flex items-center justify-center gap-1.5 select-none">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="w-8 h-8 rounded-lg border border-slate-200/90 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
              aria-label="Trang trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {getPaginationItems(currentPage, totalPages).map((item, idx) => {
              if (item === "...") {
                return (
                  <span
                    key={`dots-${idx}`}
                    className="w-6 text-center text-slate-400 text-sm select-none"
                  >
                    ...
                  </span>
                );
              }
              const isActive = currentPage === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCurrentPage(item)}
                  className={`w-8 h-8 rounded-lg border text-sm font-semibold transition cursor-pointer ${
                    isActive
                      ? "border-blue-500 text-blue-600 bg-blue-50/50"
                      : "border-slate-200/90 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {item}
                </button>
              );
            })}

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="w-8 h-8 rounded-lg border border-slate-200/90 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
              aria-label="Trang sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
