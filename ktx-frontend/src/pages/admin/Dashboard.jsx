import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BedDouble,
  BellRing,
  Building2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  FileSpreadsheet,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import feedbackService from "../../services/feedbackService";
import studentService from "../../services/studentService";
import { dormService } from "../../services/api";
import { askGeminiChatbot } from "../../services/geminiService";

const OPEN_STATUSES = new Set([
  "CHO_DUYET",
  "CHO_XU_LY",
  "DANG_XU_LY",
  "CON_CHO",
  "PENDING",
]);
const ANNOUNCEMENTS_KEY = "ktx_announcements";

const normalize = (value) => String(value || "").toLocaleLowerCase("vi");

const isPending = (request) =>
  OPEN_STATUSES.has(String(request?.trang_thai || "").toUpperCase());

const requestRoute = (request) => {
  const id = String(
    request?.id || request?.ma_yeu_cau || request?.msv || "",
  ).replace(/^#/, "");
  const type = normalize(request?.loai_don || request?.loai_yeu_cau);
  if (type.includes("chuy") || type.includes("transfer"))
    return `/admin/requests/transfer/${id}`;
  if (type.includes("trả") || type.includes("tra") || type.includes("checkout"))
    return `/admin/requests/checkout/${id}`;
  return `/admin/requests/registration/${id}`;
};

const getRequestTypeLabel = (request) => {
  const type = normalize(request?.loai_don || request?.loai_yeu_cau);
  if (type.includes("chuy") || type.includes("transfer"))
    return "Đăng ký chuyển phòng";
  if (type.includes("trả") || type.includes("tra") || type.includes("checkout"))
    return "Trả phòng";
  return "Đăng ký ở";
};

const formatRequestSubmittedAt = (value) => {
  if (!value) return "Gửi lúc chưa cập nhật";

  const dateText = String(value).trim();
  const localizedDate = dateText.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/,
  );
  const date = localizedDate
    ? new Date(
        Number(localizedDate[3]),
        Number(localizedDate[2]) - 1,
        Number(localizedDate[1]),
        Number(localizedDate[4] || 0),
        Number(localizedDate[5] || 0),
      )
    : new Date(dateText);

  if (Number.isNaN(date.getTime())) return `Gửi lúc ${dateText}`;

  const time = date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const submittedDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.round((todayStart - submittedDay) / 86400000);

  if (daysAgo === 0) return `Gửi lúc ${time} hôm nay`;
  if (daysAgo === 1) return `Gửi lúc ${time} hôm qua`;
  return `Gửi lúc ${time} ${date.toLocaleDateString("vi-VN")}`;
};

const getTodayIncidents = (incidents) => {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return incidents.filter((incident) => {
    const submitted = String(
      incident.ngay_gui || incident.created_at || "",
    ).slice(0, 10);
    return submitted === todayKey;
  });
};

const getBuildingStats = (building) => {
  const rooms = (building?.tangs || []).flatMap((floor) => floor.phongs || []);
  let capacity = 0;
  let occupied = 0;
  let hasBedData = false;

  rooms.forEach((room) => {
    const beds = room.giuongs || [];
    if (beds.length) {
      hasBedData = true;
      capacity += beds.length;
      occupied += beds.filter((bed) =>
        ["DA_THUE", "DANG_O", "DA_O", "OCCUPIED"].includes(
          String(bed.trang_thai || "").toUpperCase(),
        ),
      ).length;
      return;
    }
    const roomCapacity = Number(room.suc_chua || 0);
    const emptyBeds = Number(room.so_giuong_trong);
    const occupiedBeds = Number(room.so_giuong_da_o);
    capacity += roomCapacity;
    if (Number.isFinite(occupiedBeds)) occupied += occupiedBeds;
    else if (Number.isFinite(emptyBeds) && roomCapacity)
      occupied += Math.max(0, roomCapacity - emptyBeds);
  });

  if (!hasBedData && rooms.length && occupied === 0)
    return { capacity, occupied: null, percent: null };
  return {
    capacity,
    occupied,
    percent: capacity ? Math.round((occupied / capacity) * 100) : null,
  };
};

const toCsvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

function downloadRequestsCsv(requests) {
  const rows = [
    [
      "Mã yêu cầu",
      "Sinh viên",
      "Mã sinh viên",
      "Giới tính",
      "Loại phòng",
      "Ngày gửi",
      "Trạng thái",
    ],
    ...requests.map((request) => [
      request.id || request.ma_yeu_cau,
      request.ho_ten,
      request.msv,
      request.gioi_tinh,
      request.loai_phong || request.nguyen_vong_label || request.nguyen_vong,
      request.ngay_gui,
      request.trang_thai_label || request.trang_thai,
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(toCsvCell).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `bao-cao-ktx-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  color,
  changeIcon: ChangeIcon = ArrowUpRight,
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-500">
          <ChangeIcon className="h-3 w-3" />
          Chưa có dữ liệu kỳ trước
        </span>
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function SectionCard({
  title,
  icon: Icon,
  iconClass = "text-blue-600",
  action,
  children,
  className = "",
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Icon className={`h-5 w-5 ${iconClass}`} />
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Dashboard({
  requests = [],
  isLoadingRequests = false,
  onRefresh,
  onOpenRequest,
  onAddStudent,
  searchTerm = "",
}) {
  const [studentStats, setStudentStats] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [aiInsight, setAiInsight] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementNotice, setAnnouncementNotice] = useState("");
  const [showAllRequests, setShowAllRequests] = useState(false);
  const [showAllTowers, setShowAllTowers] = useState(false);
  const [clockNow, setClockNow] = useState(() => new Date());

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      studentService.getStudentStats(),
      dormService.getBuildings(),
      feedbackService.getAllIncidents(),
    ]).then(([statsResult, buildingsResult, incidentsResult]) => {
      if (!active) return;
      if (statsResult.status === "fulfilled")
        setStudentStats(statsResult.value);
      if (
        buildingsResult.status === "fulfilled" &&
        Array.isArray(buildingsResult.value)
      )
        setBuildings(buildingsResult.value);
      if (
        incidentsResult.status === "fulfilled" &&
        Array.isArray(incidentsResult.value)
      )
        setIncidents(incidentsResult.value);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const pendingRequests = useMemo(
    () =>
      requests.filter(isPending).filter((request) => {
        if (!searchTerm.trim()) return true;
        const query = normalize(searchTerm);
        return normalize(
          `${request.ho_ten} ${request.msv} ${request.id} ${request.ma_yeu_cau}`,
        ).includes(query);
      }),
    [requests, searchTerm],
  );
  const todayIncidents = useMemo(
    () => getTodayIncidents(incidents),
    [incidents],
  );
  const unresolvedIncidents = todayIncidents.filter(
    (incident) =>
      !["DA_XU_LY", "DA_DONG", "HOAN_TAT", "CLOSED"].includes(
        String(incident.trang_thai || "").toUpperCase(),
      ),
  );
  const waterPowerCount = unresolvedIncidents.filter((incident) =>
    /điện|nước|dien|nuoc|cơ sở vật chất/i.test(
      `${incident.loai_phan_anh || ""} ${incident.tieu_de || ""} ${incident.mo_ta || ""}`,
    ),
  ).length;
  const securityCount = unresolvedIncidents.filter((incident) =>
    /an ninh|mất trật tự|bao ve|bảo vệ|security/i.test(
      `${incident.loai_phan_anh || ""} ${incident.tieu_de || ""} ${incident.mo_ta || ""}`,
    ),
  ).length;

  const totalBeds = buildings.reduce(
    (sum, building) => sum + getBuildingStats(building).capacity,
    0,
  );
  const occupiedBeds = buildings.reduce((sum, building) => {
    const occupied = getBuildingStats(building).occupied;
    return sum + (occupied == null ? 0 : occupied);
  }, 0);
  const hasOccupancy = buildings.some(
    (building) => getBuildingStats(building).occupied != null,
  );
  const occupancyPercent =
    totalBeds && hasOccupancy
      ? Math.round((occupiedBeds / totalBeds) * 100)
      : null;

  const towerCards = [...buildings]
    .sort((first, second) =>
      String(first.ten_toa || first.ma_toa || "").localeCompare(
        String(second.ten_toa || second.ma_toa || ""),
        "vi",
        { numeric: true, sensitivity: "base" },
      ),
    )
    .map((building) => ({
      id: building.ma_toa,
      label: building.ten_toa || building.ma_toa || "Tòa chưa đặt tên",
      hint: building.gioi_tinh || "Khu nội trú",
      stats: getBuildingStats(building),
    }));
  const visibleTowerCards = showAllTowers ? towerCards : towerCards.slice(0, 3);
  const visiblePendingRequests = showAllRequests
    ? pendingRequests
    : pendingRequests.slice(0, 3);

  const priorityInsight = useMemo(() => {
    const focus = [];
    if (waterPowerCount)
      focus.push(`${waterPowerCount} phản ánh điện nước/cơ sở vật chất`);
    if (securityCount) focus.push(`${securityCount} phản ánh an ninh`);
    if (!focus.length && unresolvedIncidents.length)
      focus.push(`${unresolvedIncidents.length} phản ánh đang chờ xử lý`);
    if (!focus.length)
      return "Chưa ghi nhận phản ánh cần ưu tiên xử lý trong hôm nay.";
    return `Hôm nay có ${focus.join(" và ")}. Nên kiểm tra các trường hợp tồn đọng và phân công người phụ trách sớm.`;
  }, [waterPowerCount, securityCount, unresolvedIncidents.length]);

  useEffect(() => {
    if (!incidents.length) {
      setAiInsight("");
      return;
    }
    const dailyOpenIncidents = getTodayIncidents(incidents).filter(
      (incident) =>
        !["DA_XU_LY", "DA_DONG", "HOAN_TAT", "CLOSED"].includes(
          String(incident.trang_thai || "").toUpperCase(),
        ),
    );
    if (!dailyOpenIncidents.length) {
      setAiInsight("Chưa ghi nhận phản ánh cần ưu tiên xử lý trong hôm nay.");
      return;
    }
    let active = true;
    setIsSummarizing(true);
    const digest = dailyOpenIncidents
      .slice(0, 8)
      .map(
        (incident, index) =>
          `${index + 1}. Nhóm: ${incident.loai_phan_anh || "Chưa phân loại"}; tiêu đề: ${incident.tieu_de || "Không có tiêu đề"}; mô tả: ${String(incident.mo_ta || "").slice(0, 240)}; trạng thái: ${incident.trang_thai || "Chưa cập nhật"}`,
      )
      .join("\n");
    askGeminiChatbot(
      `Hãy tóm tắt tối đa 2 câu bằng tiếng Việt về các sự cố cần chú ý trong danh sách dưới đây. Chỉ dựa trên dữ liệu cung cấp, nêu nhóm sự cố nổi bật và ưu tiên xử lý; không suy đoán nguyên nhân hoặc bịa số liệu.\n${digest}`,
    )
      .then((summary) => {
        if (!active) return;
        const unavailable =
          /chưa cấu hình API Key|bảo trì|đã xảy ra lỗi khi gọi AI/i.test(
            summary || "",
          );
        setAiInsight(unavailable ? priorityInsight : summary);
      })
      .catch(() => {
        if (active) setAiInsight(priorityInsight);
      })
      .finally(() => {
        if (active) setIsSummarizing(false);
      });
    return () => {
      active = false;
    };
  }, [incidents, priorityInsight]);

  const lockTime =
    clockNow.getMonth() >= 3 && clockNow.getMonth() <= 9 ? "23:00" : "22:30";
  const minutesUntilLock = (() => {
    const [hour, minute] = lockTime.split(":").map(Number);
    const deadline = new Date(clockNow);
    deadline.setHours(hour, minute, 0, 0);
    if (deadline < clockNow) deadline.setDate(deadline.getDate() + 1);
    return Math.max(0, Math.floor((deadline - clockNow) / 60_000));
  })();

  const submitAnnouncement = (event) => {
    event.preventDefault();
    const title = announcementTitle.trim();
    const body = announcementBody.trim();
    if (!title || !body) return;
    let current = [];
    try {
      const saved = JSON.parse(localStorage.getItem(ANNOUNCEMENTS_KEY) || "[]");
      if (Array.isArray(saved)) current = saved;
    } catch {
      current = [];
    }
    const announcement = {
      id: crypto.randomUUID(),
      title,
      body,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(
      ANNOUNCEMENTS_KEY,
      JSON.stringify([announcement, ...current]),
    );
    window.dispatchEvent(new CustomEvent("ktx-announcements-updated"));
    setAnnouncementNotice(
      "Đã đăng thông báo lên mục Thông báo sinh viên trên trình duyệt này.",
    );
    setAnnouncementTitle("");
    setAnnouncementBody("");
    setComposeOpen(false);
    window.setTimeout(() => setAnnouncementNotice(""), 5000);
  };

  return (
    <div className="min-h-full min-w-0">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-800">
            TỔNG QUAN KTX
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Tình hình vận hành và các việc cần ưu tiên hôm nay.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
        >
          <Clock3
            className={`h-4 w-4 ${isLoadingRequests ? "animate-spin" : ""}`}
          />{" "}
          Cập nhật dữ liệu
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <MetricCard
          title="Công suất phòng"
          value={occupancyPercent == null ? "—" : `${occupancyPercent}%`}
          detail={
            hasOccupancy
              ? `${occupiedBeds}/${totalBeds} giường đang sử dụng`
              : "Chưa có dữ liệu giường đã ở"
          }
          icon={BedDouble}
          color="bg-blue-50 text-blue-600"
        />
        <MetricCard
          title="Tổng sinh viên"
          value={studentStats?.total?.toLocaleString("vi-VN") ?? "—"}
          detail={`${studentStats?.dang_o?.toLocaleString("vi-VN") ?? "—"} đang lưu trú`}
          icon={Users}
          color="bg-violet-50 text-violet-600"
        />
        <MetricCard
          title="Yêu cầu chờ duyệt"
          value={pendingRequests.length.toLocaleString("vi-VN")}
          detail="Đăng ký, chuyển hoặc trả phòng"
          icon={FileSpreadsheet}
          color="bg-amber-50 text-amber-600"
        />
        <MetricCard
          title="Phản ánh hôm nay"
          value={todayIncidents.length.toLocaleString("vi-VN")}
          detail={`${unresolvedIncidents.length} trường hợp chưa hoàn tất`}
          icon={AlertTriangle}
          color="bg-rose-50 text-rose-600"
          changeIcon={ArrowDownRight}
        />
      </div>

      {announcementNotice && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          {announcementNotice}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <section className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm sm:px-5">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
              <h2 className="text-sm font-bold text-slate-900">
                Yêu cầu cần xử lý
              </h2>
              {pendingRequests.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllRequests((showing) => !showing)}
                  className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  {showAllRequests ? "Thu gọn" : "Xem tất cả"}
                </button>
              )}
            </div>
            {pendingRequests.length === 0 ? (
              <div className="py-5 text-sm text-slate-500">
                {isLoadingRequests
                  ? "Đang tải yêu cầu..."
                  : "Không có yêu cầu cần xử lý."}
              </div>
            ) : (
              <div>
                {visiblePendingRequests.map((request, index) => {
                  const id =
                    request.id || request.ma_yeu_cau || request.msv || index;
                  return (
                    <article
                      key={id}
                      className="flex items-start gap-3 border-b border-slate-100 py-2.5 last:border-b-0"
                    >
                      <span className="mt-0.5 h-8 w-0.5 shrink-0 rounded-full bg-blue-500" />
                      <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-800">
                            {request.ho_ten || "Sinh viên"} – {getRequestTypeLabel(request)}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {formatRequestSubmittedAt(
                              request.ngay_gui || request.created_at || request.createdAt,
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenRequest?.(requestRoute(request))}
                          className="shrink-0 text-xs font-medium text-blue-600 underline underline-offset-2 transition hover:text-blue-800"
                        >
                          Xem chi tiết
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <SectionCard
            title="Công suất theo Tòa"
            icon={Building2}
            action={
              towerCards.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllTowers((showing) => !showing)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  {showAllTowers ? "Thu gọn" : "Xem tất cả"}
                  {showAllTowers ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              )
            }
          >
            <div className="space-y-5">
              {visibleTowerCards.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  Chưa có tòa nhà trong dữ liệu KTX.
                </p>
              ) : (
                visibleTowerCards.map((tower) => (
                  <div key={tower.id || tower.label}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {tower.label}
                        </p>
                        <p className="text-xs text-slate-500">{tower.hint}</p>
                      </div>
                      <span className="text-sm font-bold text-slate-700">
                        {tower.stats?.percent == null
                          ? "Chưa có dữ liệu"
                          : `${tower.stats.percent}%`}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      {tower.stats?.percent != null && (
                        <div
                          className={`h-full rounded-full transition-all ${tower.stats.percent >= 90 ? "bg-rose-500" : tower.stats.percent >= 75 ? "bg-amber-500" : "bg-blue-600"}`}
                          style={{ width: `${tower.stats.percent}%` }}
                        />
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      {tower.stats.capacity > 0
                        ? `${tower.stats.occupied ?? "—"}/${tower.stats.capacity} giường đang sử dụng`
                        : "Chưa có dữ liệu giường của tòa này"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>

        <aside className="space-y-5">
          <SectionCard
            title="AI Tóm tắt sự cố trong ngày"
            icon={Sparkles}
            iconClass="text-violet-600"
          >
            <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-blue-50 p-4">
              <p className="text-sm leading-6 text-slate-700">
                {isSummarizing
                  ? "AI đang tổng hợp các phản ánh hôm nay..."
                  : aiInsight || priorityInsight}
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-violet-700">
                <ShieldAlert className="h-3.5 w-3.5" />
                {aiInsight && !isSummarizing
                  ? "Tóm tắt AI từ phản ánh mới nhất"
                  : "Tóm tắt theo dữ liệu phản ánh hiện có"}
              </p>
            </div>
          </SectionCard>

          <SectionCard title="Thao tác nhanh" icon={ArrowUpRight}>
            <div className="grid grid-cols-1 gap-2.5">
              <button
                type="button"
                onClick={onAddStudent}
                className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/60"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Plus className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-800">
                    Thêm sinh viên mới
                  </span>
                  <span className="text-xs text-slate-500">
                    Tạo hồ sơ nội trú
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => downloadRequestsCsv(requests)}
                className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50/60"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Download className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-800">
                    Xuất báo cáo Excel
                  </span>
                  <span className="text-xs text-slate-500">
                    Tải danh sách yêu cầu dạng CSV
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-amber-200 hover:bg-amber-50/60"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Send className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-800">
                    Gửi thông báo KTX
                  </span>
                  <span className="text-xs text-slate-500">
                    Đăng thông báo tới mục sinh viên
                  </span>
                </span>
              </button>
            </div>
          </SectionCard>
        </aside>
      </div>

      {composeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setComposeOpen(false);
          }}
        >
          <form
            onSubmit={submitAnnouncement}
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Thông báo KTX</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Thông báo sẽ hiển thị trong mục Thông báo của giao diện sinh
                  viên trên trình duyệt này.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                aria-label="Đóng"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mb-3 block text-xs font-semibold text-slate-700">
              Tiêu đề
              <input
                value={announcementTitle}
                onChange={(event) => setAnnouncementTitle(event.target.value)}
                required
                maxLength={120}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Ví dụ: Lịch kiểm tra phòng tuần này"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Nội dung
              <textarea
                value={announcementBody}
                onChange={(event) => setAnnouncementBody(event.target.value)}
                required
                rows={4}
                maxLength={1000}
                className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Nhập nội dung thông báo..."
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <BellRing className="h-4 w-4" />
                Đăng thông báo
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
