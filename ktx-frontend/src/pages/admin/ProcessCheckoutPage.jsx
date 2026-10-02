import React, { useState, useEffect } from "react";
import {
  ChevronLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import AdminLayout from "../../layouts/Admin";
import occupancyService from "../../services/occupancyService";

export default function ProcessCheckoutPage({
  requestId = "YC-0232",
  onBack,
  onProcessed,
}) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestData, setRequestData] = useState(null);

  // Địa chỉ sau khi trả phòng (3 ô)
  const [diaChiTinh, setDiaChiTinh] = useState("");
  const [diaChiHuyen, setDiaChiHuyen] = useState("");
  const [diaChiSoNha, setDiaChiSoNha] = useState("");

  // Modal từ chối
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");

  // Toast thông báo
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3000);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const detail = await occupancyService.getRequestDetail(requestId);
        setRequestData(detail);

        // Trích xuất địa chỉ 3 phần
        if (detail?.dia_chi_chi_tiet) {
          setDiaChiTinh(detail.dia_chi_chi_tiet.tinh || "");
          setDiaChiHuyen(detail.dia_chi_chi_tiet.huyen || "");
          setDiaChiSoNha(
            detail.dia_chi_chi_tiet.so_nha ||
              detail.dia_chi_chi_tiet.duong ||
              "",
          );
        } else if (detail?.dia_chi_sau_tra) {
          const parts = detail.dia_chi_sau_tra.split(",").map((s) => s.trim());
          if (parts.length >= 3) {
            setDiaChiSoNha(parts[0]);
            setDiaChiHuyen(parts[1]);
            setDiaChiTinh(parts.slice(2).join(", "));
          } else if (parts.length === 2) {
            setDiaChiSoNha(parts[0]);
            setDiaChiTinh(parts[1]);
          } else {
            setDiaChiTinh(detail.dia_chi_sau_tra);
          }
        }
      } catch (err) {
        console.error("Error fetching checkout request detail:", err);
        showToast("Không thể tải chi tiết đơn trả phòng.", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [requestId]);

  // Xử lý Phê duyệt trả phòng
  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const payload = {
        ngay_tra:
          requestData?.ngay_tra || new Date().toISOString().split("T")[0],
        ghi_chu: "Phê duyệt trả phòng bởi Quản lý",
      };

      const result = await occupancyService.approveCheckoutRequest(
        requestId,
        payload,
      );
      showToast(result.message || "Phê duyệt trả phòng thành công!", "success");

      setTimeout(() => {
        if (onProcessed) {
          onProcessed("approved", result);
        } else if (onBack) {
          onBack();
        }
      }, 1500);
    } catch (err) {
      console.error("Error approving checkout request:", err);
      showToast("Có lỗi xảy ra khi phê duyệt. Vui lòng thử lại!", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Xử lý Từ chối yêu cầu
  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      setRejectError("Vui lòng nhập lý do từ chối yêu cầu trả phòng.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = { ly_do_tu_choi: rejectReason.trim() };
      await occupancyService.rejectCheckoutRequest(requestId, payload);

      setIsRejectModalOpen(false);
      showToast("Đã từ chối yêu cầu trả phòng thành công.", "success");

      setTimeout(() => {
        if (onProcessed) {
          onProcessed("rejected");
        } else if (onBack) {
          onBack();
        }
      }, 1500);
    } catch (err) {
      console.error("Error rejecting checkout request:", err);
      setRejectError("Không thể từ chối yêu cầu. Vui lòng thử lại!");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout activeTab="dashboard" userName="QL_Minh">
      {/* Toast thông báo */}
      {toast.show && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border bg-white text-slate-800 animate-in fade-in slide-in-from-top-4 duration-200">
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-500" />
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Khung Card chính màu trắng bo góc */}
      <div className="bg-[#f4f5f7] rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs flex-1 flex flex-col justify-between">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="text-sm">
              Đang tải thông tin yêu cầu trả phòng...
            </span>
          </div>
        ) : (
          <div>
            {/* Header: Nút quay lại + Tiêu đề */}
            <div className="flex items-center gap-3 pb-6 border-b border-slate-100 mb-6">
              <button
                type="button"
                onClick={onBack}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-700 transition cursor-pointer"
                title="Quay lại danh sách"
              >
                <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Yêu cầu trả phòng
              </h1>
            </div>

            {/* 1. THÔNG TIN SINH VIÊN */}
            <div className="mb-6">
              <h3 className="text-base font-bold text-slate-900 mb-3 select-none">
                Thông tin sinh viên
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                {/* Cột trái */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                    <span className="text-slate-600 font-medium">
                      Mã sinh viên
                    </span>
                    <span className="font-semibold text-slate-900">
                      {requestData?.msv || ""}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                    <span className="text-slate-600 font-medium">
                      Họ và tên
                    </span>
                    <span className="font-bold text-slate-900">
                      {requestData?.ho_ten || "Nguyễn Quốc Huy"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                    <span className="text-slate-600 font-medium">
                      Giới tính
                    </span>
                    <span className="text-slate-900 font-medium">
                      {requestData?.gioi_tinh || "Nam"}
                    </span>
                  </div>
                </div>

                {/* Cột phải */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                    <span className="text-slate-600 font-medium">
                      Vị trí hiện tại
                    </span>
                    <span className="font-semibold text-slate-900">
                      {requestData?.vi_tri_hien_tai ||
                        "Phòng A102 - Giường G01"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-100 text-sm">
                    <span className="text-slate-600 font-medium">Công nợ</span>
                    <span className="font-bold text-emerald-600">
                      {requestData?.cong_no || "Đã hoàn thành toàn bộ phí"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. LÝ DO TRẢ PHÒNG */}
            <div className="mb-6">
              <h3 className="text-base font-bold text-slate-900 mb-3 select-none">
                Lý do trả phòng
              </h3>
              <div className="border border-slate-200 rounded-lg p-4 text-sm text-slate-800 bg-white shadow-2xs leading-relaxed">
                "
                {requestData?.mo_ta ||
                  requestData?.ly_do ||
                  "Em muốn chuyển sang phòng A305 để cùng phòng với các bạn cùng nhóm đồ án môn học..."}
                "
              </div>
            </div>

            {/* 3. ĐỊA CHỈ LIÊN HỆ SAU TRẢ PHÒNG */}
            <div className="mb-8">
              <h3 className="text-base font-bold text-slate-900 mb-3 select-none">
                Địa chỉ liên hệ sau trả phòng
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                  type="text"
                  readOnly
                  value={diaChiTinh || ""}
                  placeholder="Tỉnh / Thành phố"
                  className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs focus:outline-none"
                />
                <input
                  type="text"
                  readOnly
                  value={diaChiHuyen || ""}
                  placeholder="Quận / Huyện / Thị xã"
                  className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs focus:outline-none"
                />
                <input
                  type="text"
                  readOnly
                  value={diaChiSoNha || ""}
                  placeholder="Số nhà, tên đường / Xã, phường"
                  className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-800 shadow-2xs focus:outline-none"
                />
              </div>
            </div>

            {/* 4. HAI NÚT HÀNH ĐỘNG DƯỚI CÙNG (SIDE BY SIDE) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setRejectReason("");
                  setRejectError("");
                  setIsRejectModalOpen(true);
                }}
                className="py-3 px-6 rounded-lg bg-rose-200 hover:bg-rose-300 text-rose-700 font-semibold text-center transition cursor-pointer"
              >
                Từ chối yêu cầu
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting}
                className="py-3 px-6 rounded-lg bg-[#cce2fc] hover:bg-[#b8d8fa] text-blue-600 font-bold text-center transition cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Phê duyệt yêu cầu</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal xác nhận từ chối */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                Từ chối yêu cầu trả phòng
              </h3>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-3">
              Vui lòng nhập lý do từ chối yêu cầu trả phòng của sinh viên:
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                setRejectError("");
              }}
              placeholder="VD: Sinh viên chưa hoàn thành bàn giao cơ sở vật chất phòng ở..."
              className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400 mb-2"
            ></textarea>

            {rejectError && (
              <p className="text-xs text-rose-600 font-medium mb-4">
                {rejectError}
              </p>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={submitting}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer flex items-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Xác nhận từ chối</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
