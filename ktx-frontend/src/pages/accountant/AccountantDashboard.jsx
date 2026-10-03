import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeftRight,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  BookOpen,
  Receipt,
  Zap,
  Bed,
  ChevronRight,
  ArrowUpRight,
  ShieldCheck,
  Building,
  Users,
  BarChart3,
} from 'lucide-react';
import financeService from '../../services/financeService';

/**
 * Trang Dashboard Kế toán (AccountantDashboard.jsx)
 * Trang chủ tổng quan cho phân hệ Phòng Kế Toán KTX
 */
export default function AccountantDashboard({ onNavigate }) {
  const [dashboardData, setDashboardData] = useState({
    kpis: {
      totalRevenue: 0,
      collectedRevenue: 0,
      collectionRate: 0,
      totalOutstanding: 0,
      overdueDebt: 0,
      reconciliationRate: 0,
      totalTransactions: 0,
      matchedTransactions: 0,
      unmatchedTransactions: 0,
      unpaidStudentsCount: 0,
    },
    monthlyTrend: [],
    roomTypeStats: [],
    recentTransactions: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('ALL');

  // Hàm chuyển trang an toàn (hỗ trợ cả prop onNavigate hoặc dispatch/history)
  const handleGoTo = (path) => {
    if (typeof onNavigate === 'function') {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  // Format tiền tệ VND
  const formatVND = (amount) => {
    const val = Number(amount) || 0;
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Tải dữ liệu Dashboard từ service
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await financeService.getDashboardData();
      if (res?.data) {
        setDashboardData(res.data);
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu Dashboard kế toán:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const kpis = dashboardData?.kpis || {
    totalRevenue: 0,
    collectedRevenue: 0,
    collectionRate: 0,
    totalOutstanding: 0,
    overdueDebt: 0,
    reconciliationRate: 0,
    totalTransactions: 0,
    matchedTransactions: 0,
    unmatchedTransactions: 0,
    unpaidStudentsCount: 0,
  };

  const monthlyTrend = dashboardData?.monthlyTrend || [];
  const roomTypeStats = dashboardData?.roomTypeStats || [];
  const recentTransactions = dashboardData?.recentTransactions || [];

  // Tính toán dữ liệu tiền phòng vs điện nước
  const latestTrend = monthlyTrend?.[monthlyTrend.length - 1] || null;
  const roomFeeTotal = latestTrend?.roomFee || (kpis?.totalRevenue ? kpis.totalRevenue * 0.7 : 0);
  const roomFeeCollected = kpis?.totalRevenue > 0
    ? Math.min(roomFeeTotal, kpis.collectedRevenue * 0.72)
    : 0;
  const roomFeeRate = roomFeeTotal > 0
    ? Math.min(100, Math.round((roomFeeCollected / roomFeeTotal) * 100))
    : 0;

  const utilityFeeTotal = latestTrend?.utilityFee || (kpis?.totalRevenue ? kpis.totalRevenue * 0.3 : 0);
  const utilityFeeCollected = kpis?.totalRevenue > 0
    ? Math.min(utilityFeeTotal, kpis.collectedRevenue * 0.28)
    : 0;
  const utilityFeeRate = utilityFeeTotal > 0
    ? Math.min(100, Math.round((utilityFeeCollected / utilityFeeTotal) * 100))
    : 0;

  return (
    <div className="w-full bg-slate-100/80 p-6 rounded-3xl border border-slate-200/60 space-y-6 flex-1 flex flex-col font-sans">
      {/* ========================================================================= */}
      {/* 1. HEADER: TIÊU ĐỀ & THAO TÁC NHANH */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/70">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            Phòng Kế Toán & Quản Lý Thu Phí KTX
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 tracking-tight">
            TỔNG QUAN TÀI CHÍNH KTX
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Báo cáo doanh thu, tiến độ thu tiền phòng, điện nước và đối soát giao dịch thời gian thực
          </p>
        </div>

        {/* Nút thao tác nhanh trên Header */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            type="button"
            onClick={loadDashboardData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-95 transition-all shadow-sm disabled:opacity-60 cursor-pointer"
            title="Làm mới số liệu"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <button
            type="button"
            onClick={() => handleGoTo('/accountant/billing')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Phát hành hóa đơn</span>
          </button>

          <button
            type="button"
            onClick={() => handleGoTo('/accountant/reconciliation')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>Đối soát giao dịch</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. 4 THẺ CHỈ SỐ TÀI CHÍNH TRỌNG TÂM (KPI CARDS) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Thẻ 1: Tổng doanh thu kỳ này (Xanh dương đậm) */}
        <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-blue-900/70 uppercase tracking-wider">
              Tổng doanh thu kỳ này
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shadow-inner">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-blue-950 tracking-tight">
              {formatVND(kpis?.totalRevenue)}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              <span>Toàn bộ hóa đơn phát hành trong kỳ</span>
            </div>
          </div>
        </div>

        {/* Thẻ 2: Đã thực thu (Màu xanh lá emerald) */}
        <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md transition-shadow group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-emerald-800/80 uppercase tracking-wider">
              Đã thực thu
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-900 tracking-tight">
              {formatVND(kpis?.collectedRevenue)}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">Tỷ lệ thu hồi quỹ:</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
                {kpis?.collectionRate || 0}%
              </span>
            </div>
            {/* Progress bar thu hồi */}
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, kpis?.collectionRate || 0))}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Thẻ 3: Công nợ tồn đọng (Màu đỏ rose) */}
        <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-rose-100 shadow-sm hover:shadow-md transition-shadow group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-rose-800/80 uppercase tracking-wider">
              Công nợ tồn đọng
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-inner">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-rose-900 tracking-tight">
              {formatVND(kpis?.totalOutstanding)}
            </div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-slate-500">Sinh viên chưa đóng:</span>
              <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/50">
                {kpis?.unpaidStudentsCount ? `${kpis.unpaidStudentsCount} SV` : '0 SV'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleGoTo('/accountant/debt')}
              className="mt-2 text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <span>Xem chi tiết sổ công nợ</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Thẻ 4: Giao dịch chờ đối soát (Màu hổ phách amber) */}
        <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-amber-100 shadow-sm hover:shadow-md transition-shadow group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform"></div>
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold text-amber-800/80 uppercase tracking-wider">
              Giao dịch chờ đối soát
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-900 tracking-tight">
              {kpis?.unmatchedTransactions || 0}{' '}
              <span className="text-sm font-semibold text-amber-700/80">giao dịch</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-slate-500">Tỷ lệ tự động khớp:</span>
              <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/50">
                {kpis?.reconciliationRate || 0}%
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleGoTo('/accountant/reconciliation')}
              className="mt-2 text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <span>Xử lý đối soát ngay</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. 2 KHỐI BIỂU ĐỒ / BẢNG TÓM TẮT NGHIỆP VỤ */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Khối bên trái: Tiến độ thu phí theo đợt (lg:col-span-7) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                  Tiến độ thu phí theo đợt
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đối chiếu thu hồi giữa Hóa đơn tiền phòng & Tiền điện nước
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                Kỳ hiện tại: Tháng 09/2026
              </span>
            </div>

            {/* Chi tiết 2 dòng thu: Tiền phòng vs Tiền điện nước */}
            <div className="space-y-6">
              {/* Mục 1: Hóa đơn tiền phòng */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Bed className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Hóa đơn Tiền phòng</h3>
                      <p className="text-xs text-slate-500">Phòng tiêu chuẩn & Dịch vụ</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-extrabold text-blue-700">
                      {formatVND(roomFeeCollected)} / {formatVND(roomFeeTotal)}
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      Đạt <span className="text-blue-600 font-bold">{roomFeeRate}%</span>
                    </span>
                  </div>
                </div>

                <div className="w-full bg-slate-200/70 h-2.5 rounded-full overflow-hidden mt-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${roomFeeRate}%` }}
                  ></div>
                </div>
              </div>

              {/* Mục 2: Hóa đơn tiền điện nước */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Hóa đơn Tiền điện nước</h3>
                      <p className="text-xs text-slate-500">Đơn giá điện 3.500đ/kWh, nước 15.000đ/m³</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-extrabold text-amber-700">
                      {formatVND(utilityFeeCollected)} / {formatVND(utilityFeeTotal)}
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      Đạt <span className="text-amber-600 font-bold">{utilityFeeRate}%</span>
                    </span>
                  </div>
                </div>

                <div className="w-full bg-slate-200/70 h-2.5 rounded-full overflow-hidden mt-3">
                  <div
                    className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${utilityFeeRate}%` }}
                  ></div>
                </div>
              </div>
            </div>

          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Dữ liệu được tổng hợp theo kỳ phát hành hóa đơn mới nhất</span>
            <button
              type="button"
              onClick={() => handleGoTo('/accountant/billing')}
              className="text-blue-600 font-semibold hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer"
            >
              Lập hóa đơn đợt tiếp theo
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Khối bên phải: Giao dịch chuyển khoản gần nhất (lg:col-span-5) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-600" />
                  Giao dịch chuyển khoản gần nhất
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  5 giao dịch mới nhất cần hoặc đã đối soát gạch nợ
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleGoTo('/accountant/reconciliation')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
              >
                <span>Xem tất cả</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Bảng rút gọn giao dịch */}
            {recentTransactions && recentTransactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-2">Thời gian</th>
                      <th className="py-2.5 px-2">Sinh viên / Phòng</th>
                      <th className="py-2.5 px-2 text-right">Số tiền</th>
                      <th className="py-2.5 px-2 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentTransactions.map((tx, idx) => {
                      const isMatched =
                        tx?.status === 'MATCHED' ||
                        tx?.status === 'AUTO_MATCHED' ||
                        tx?.statusText?.includes('khớp') ||
                        tx?.statusText?.includes('Khớp');
                      const isPartial = tx?.status === 'PARTIAL' || tx?.statusText?.includes('thiếu');
                      const isInvalid = tx?.status === 'INVALID_SYNTAX' || tx?.statusText?.includes('cú pháp');

                      let badgeClass = 'bg-amber-50 text-amber-700 border-amber-200/60';
                      if (isMatched) {
                        badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
                      } else if (isPartial || isInvalid) {
                        badgeClass = 'bg-rose-50 text-rose-700 border-rose-200/60';
                      }

                      return (
                        <tr key={tx?.id || idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-2 font-medium text-slate-600 whitespace-nowrap">
                            {tx?.date || 'Vừa xong'}
                          </td>
                          <td className="py-2.5 px-2">
                            <div className="font-semibold text-slate-800 line-clamp-1">
                              {tx?.studentName || tx?.studentId || 'Nộp tiền KTX'}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {tx?.room ? `Phòng ${tx.room}` : tx?.studentId || 'Chưa định danh'}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-right font-bold text-slate-800 whitespace-nowrap">
                            {formatVND(tx?.amount)}
                          </td>
                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}
                            >
                              {tx?.statusText || (isMatched ? 'Khớp' : 'Chờ đối soát')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Empty state nếu chưa có giao dịch */
              <div className="py-10 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                  <Receipt className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Chưa có giao dịch chuyển khoản mới</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Khi sinh viên nộp tiền qua ngân hàng, các khoản chuyển khoản sẽ xuất hiện tại đây để gạch nợ.
                </p>
                <button
                  type="button"
                  onClick={() => handleGoTo('/accountant/reconciliation')}
                  className="mt-4 px-3.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  Tải sao kê ngân hàng đối soát
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Đối soát tự động qua mã cú pháp hóa đơn</span>
            <button
              type="button"
              onClick={() => handleGoTo('/accountant/reconciliation')}
              className="text-emerald-600 font-semibold hover:text-emerald-700 inline-flex items-center gap-1 cursor-pointer"
            >
              Vào màn hình đối soát
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. LỐI TẮT THAO TÁC NHANH (QUICK ACTIONS) */}
      {/* ========================================================================= */}
      <div className="pt-2">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Lối tắt thao tác nghiệp vụ
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Lối tắt 1: Lập hóa đơn định kỳ */}
          <div
            onClick={() => handleGoTo('/accountant/billing')}
            className="group p-4 bg-white hover:bg-blue-50/50 rounded-2xl border border-slate-200 hover:border-blue-300 shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
                  Lập hóa đơn định kỳ
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  Hóa đơn tiền phòng & tải Excel chỉ số điện nước
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
          </div>

          {/* Lối tắt 2: Đối soát giao dịch */}
          <div
            onClick={() => handleGoTo('/accountant/reconciliation')}
            className="group p-4 bg-white hover:bg-emerald-50/50 rounded-2xl border border-slate-200 hover:border-emerald-300 shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                  Đối soát giao dịch
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  Tải sao kê VietinBank / BIDV & gạch nợ tự động
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
          </div>

          {/* Lối tắt 3: Sổ công nợ */}
          <div
            onClick={() => handleGoTo('/accountant/debt')}
            className="group p-4 bg-white hover:bg-rose-50/50 rounded-2xl border border-slate-200 hover:border-rose-300 shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 group-hover:text-rose-700 transition-colors">
                  Sổ công nợ
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  Tra cứu sinh viên nợ phí & gửi nhắc nhở thanh toán
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-rose-600 group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </div>
    </div>
  );
}
