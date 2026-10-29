import React, { useState, useEffect } from "react";
import {
  Bell,
  Search,
  Filter,
  CheckCheck,
  CheckCircle2,
  Trash2,
  Clock,
  Receipt,
  BadgeCheck,
  CreditCard,
  Download,
  Inbox,
  RefreshCw,
  ChevronRight,
  DollarSign,
} from "lucide-react";
import accountantNotificationService from "../../services/accountantNotificationService";

export default function AccountantNotificationsPage({ onNavigate }) {
  const [notifications, setNotifications] = useState(() =>
    accountantNotificationService.getNotifications()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedPriority, setSelectedPriority] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    setIsRefreshing(true);
    await accountantNotificationService.syncFromSystem();
    setNotifications(accountantNotificationService.getNotifications());
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => {
      setNotifications(accountantNotificationService.getNotifications());
    };
    window.addEventListener("accountant-notifications-updated", handleUpdate);
    return () => {
      window.removeEventListener("accountant-notifications-updated", handleUpdate);
    };
  }, []);

  // Bộ lọc
  const filteredList = notifications.filter((item) => {
    // 1. Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = (item.title || "").toLowerCase().includes(q);
      const matchPreview = (item.previewText || "").toLowerCase().includes(q);
      const matchMsv = (item.metadata?.studentId || "").toLowerCase().includes(q);
      const matchName = (item.metadata?.studentName || "").toLowerCase().includes(q);
      const matchRoom = (item.metadata?.roomCode || "").toLowerCase().includes(q);
      if (!matchTitle && !matchPreview && !matchMsv && !matchName && !matchRoom) {
        return false;
      }
    }

    // 2. Category
    if (selectedCategory !== "ALL" && item.category !== selectedCategory) {
      return false;
    }

    // 3. Priority
    if (selectedPriority !== "ALL" && item.priority !== selectedPriority) {
      return false;
    }

    // 4. Status
    if (selectedStatus === "UNREAD" && item.isRead) return false;
    if (selectedStatus === "ACTION_REQUIRED" && item.status !== "ACTION_REQUIRED") return false;
    if (selectedStatus === "ACTION_RESOLVED" && item.status !== "ACTION_RESOLVED") return false;

    return true;
  });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredList.map((n) => n.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Batch actions
  const handleBatchMarkAsRead = () => {
    selectedIds.forEach((id) => accountantNotificationService.markAsRead(id));
    setNotifications(accountantNotificationService.getNotifications());
    setSelectedIds([]);
  };

  const handleBatchResolve = () => {
    selectedIds.forEach((id) => accountantNotificationService.resolveNotification(id));
    setNotifications(accountantNotificationService.getNotifications());
    setSelectedIds([]);
  };

  const handleBatchDelete = () => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} thông báo đã chọn?`)) {
      selectedIds.forEach((id) => accountantNotificationService.deleteNotification(id));
      setNotifications(accountantNotificationService.getNotifications());
      setSelectedIds([]);
    }
  };

  const handleExportExcel = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["Mã thông báo,Loại,Cấp độ,Tiêu đề,Thời gian,Trạng thái"]
        .concat(
          filteredList.map(
            (n) =>
              `"${n.id}","${n.category}","${n.priority}","${n.title}","${n.createdAt}","${n.status}"`
          )
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `KeToan_ThongBao_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleItemClick = (item) => {
    accountantNotificationService.markAsRead(item.id);
    if (item.deepLink?.targetUrl) {
      if (onNavigate) {
        onNavigate(item.deepLink.targetUrl);
      } else {
        window.history.pushState({}, "", item.deepLink.targetUrl);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER KHỐI */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200/60 shadow-xs">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-800">Thông báo Tài chính & Đối soát</h1>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-indigo-100 text-indigo-700 rounded-full">
                {notifications.filter((n) => !n.isRead).length} chưa đọc
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi phát hành hóa đơn phòng mới, đối soát thanh toán ngân hàng và lệnh hoàn trả cọc
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadData}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            onClick={() => {
              accountantNotificationService.markAllAsRead();
              setNotifications(accountantNotificationService.getNotifications());
            }}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Đọc tất cả</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

      {/* 2. BỘ LỌC NÂNG CAO (Filter Bar) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Ô tìm kiếm */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo MSV, tên, hóa đơn..."
              className="w-full pl-10 pr-3 py-2 bg-slate-50 focus:bg-white text-xs text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            />
          </div>

          {/* Phân loại nghiệp vụ */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 focus:bg-white text-xs text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            >
              <option value="ALL">Tất cả nghiệp vụ</option>
              <option value="INVOICE_GENERATION">Lập hóa đơn thu phí</option>
              <option value="PAYMENT_RECONCILE">Đối soát thanh toán</option>
              <option value="DEPOSIT_REFUND">Hoàn trả tiền cọc</option>
            </select>
          </div>

          {/* Mức độ ưu tiên */}
          <div>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 focus:bg-white text-xs text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            >
              <option value="ALL">Mọi cấp độ ưu tiên</option>
              <option value="URGENT">Khẩn cấp (Urgent)</option>
              <option value="HIGH">Quan trọng (High)</option>
              <option value="NORMAL">Tiêu chuẩn (Normal)</option>
            </select>
          </div>

          {/* Trạng thái xử lý */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 focus:bg-white text-xs text-slate-800 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTION_REQUIRED">Cần xử lý ngay</option>
              <option value="ACTION_RESOLVED">Đã hoàn tất</option>
              <option value="UNREAD">Chưa đọc</option>
            </select>
          </div>
        </div>

        {/* Thanh thao tác hàng loạt (Batch Actions Toolbar) */}
        {selectedIds.length > 0 && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap animate-in fade-in duration-150">
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200">
              Đã chọn: {selectedIds.length} mục
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBatchMarkAsRead}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
              >
                Đánh dấu đã đọc
              </button>
              <button
                type="button"
                onClick={handleBatchResolve}
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition cursor-pointer"
              >
                Đánh dấu đã xử lý
              </button>
              <button
                type="button"
                onClick={handleBatchDelete}
                className="px-3 py-1.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. BẢNG DANH SÁCH THÔNG BÁO CHI TIẾT */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        {filteredList.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-700">Không có thông báo mới</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Hiện tại không có thông báo hay công việc tồn đọng nào cần xử lý.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.length > 0 && selectedIds.length === filteredList.length
                      }
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-3 w-28">Ưu tiên</th>
                  <th className="py-3.5 px-3 w-40">Nghiệp vụ</th>
                  <th className="py-3.5 px-4">Nội dung chi tiết</th>
                  <th className="py-3.5 px-4 w-32">Thời gian</th>
                  <th className="py-3.5 px-4 w-36">Trạng thái</th>
                  <th className="py-3.5 px-4 w-36 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((item) => {
                  const isChecked = selectedIds.includes(item.id);
                  const isUnread = !item.isRead;
                  const isUrgent = item.priority === "URGENT";

                  return (
                    <tr
                      key={item.id}
                      className={`transition cursor-pointer group ${
                        isChecked
                          ? "bg-indigo-50/60"
                          : isUnread
                          ? "bg-indigo-50/20 hover:bg-slate-50/80"
                          : "hover:bg-slate-50/60"
                      }`}
                      onClick={() => handleItemClick(item)}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3.5 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelect(item.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-3">
                        {isUrgent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping"></span>
                            Khẩn cấp
                          </span>
                        ) : item.priority === "HIGH" ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                            Quan trọng
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                            Tiêu chuẩn
                          </span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          {item.category === "INVOICE_GENERATION" && (
                            <>
                              <Receipt className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Lập hóa đơn</span>
                            </>
                          )}
                          {item.category === "PAYMENT_RECONCILE" && (
                            <>
                              <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Đối soát tiền</span>
                            </>
                          )}
                          {item.category === "DEPOSIT_REFUND" && (
                            <>
                              <CreditCard className="w-3.5 h-3.5 text-violet-600" />
                              <span>Hoàn trả cọc</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Content Preview */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>
                          )}
                          <h4
                            className={`text-xs ${
                              isUnread ? "font-bold text-slate-900" : "font-semibold text-slate-700"
                            }`}
                          >
                            {item.title}
                          </h4>
                        </div>
                        <p className="text-slate-500 text-[11px] mt-0.5 line-clamp-1">
                          {item.previewText}
                        </p>
                      </td>

                      {/* Time */}
                      <td className="py-3.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString("vi-VN") : "---"}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.status === "ACTION_REQUIRED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Chưa xử lý
                          </span>
                        ) : item.status === "ACTION_RESOLVED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Đã giải quyết
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                            Đã xem
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleItemClick(item)}
                          className="px-3 py-1.5 text-xs font-bold bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl transition inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <span>Xử lý</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
