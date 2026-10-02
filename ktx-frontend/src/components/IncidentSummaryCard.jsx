import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  ShieldAlert,
} from 'lucide-react';
import feedbackService from '../services/feedbackService';

/**
 * Card "AI Tóm tắt sự cố trong ngày" (IncidentSummaryCard)
 * - Đọc toàn bộ các phản ánh được tạo trong ngày hôm nay
 * - Nếu có phản ánh mới: Hiển thị tóm tắt thông minh của AI
 * - Nếu chưa có: "Chưa ghi nhận phản ánh cần ưu tiên xử lý trong hôm nay."
 */
export default function IncidentSummaryCard({ refreshTrigger, onRefresh }) {
  const [summaryData, setSummaryData] = useState({
    summary: 'Chưa ghi nhận phản ánh cần ưu tiên xử lý trong hôm nay.',
    count: 0,
    incidents: [],
  });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await feedbackService.getDailySummary();
      if (res) {
        setSummaryData({
          summary: res.summary || (res.data && res.data.summary) || 'Chưa ghi nhận phản ánh cần ưu tiên xử lý trong hôm nay.',
          count: res.count !== undefined ? res.count : (res.data?.count || 0),
          incidents: res.incidents || res.data?.incidents || [],
        });
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Lỗi khi tải tóm tắt sự cố AI:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [refreshTrigger]);

  const hasIncidents = summaryData.count > 0;
  const isUrgent =
    summaryData.summary.toLowerCase().includes('ưu tiên') ||
    summaryData.summary.toLowerCase().includes('khẩn cấp') ||
    summaryData.incidents.some((i) => i.muc_do_uu_tien === 'Khẩn cấp');

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-purple-50/70 p-5 sm:p-6 shadow-xs transition duration-300">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-blue-300/20 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 -mb-8 w-36 h-36 bg-purple-300/20 rounded-full blur-2xl pointer-events-none" />

      <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-4">
        {/* Left: Icon and AI Title */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/25">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                AI Tóm tắt sự cố trong ngày
              </h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                <Zap className="w-3 h-3 text-indigo-500" />
                Gemini AI
              </span>
              {hasIncidents && isUrgent && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                  <ShieldAlert className="w-3 h-3" />
                  Có sự cố khẩn cấp
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 mt-0.5">
              Hệ thống tự động tổng hợp & phân tích toàn bộ phản ánh phát sinh trong ngày hôm nay
            </p>

            {/* Nội dung tóm tắt thông minh */}
            <div className="mt-3 p-3.5 bg-white/90 backdrop-blur-xs rounded-xl border border-indigo-100/80 shadow-2xs">
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                  <span>AI đang đọc và tổng hợp sự cố trong ngày...</span>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                  {summaryData.summary}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions and Status */}
        <div className="flex md:flex-col items-center md:items-end justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              fetchSummary();
              if (onRefresh) onRefresh();
            }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-2xs hover:border-blue-300 hover:text-blue-600 transition cursor-pointer disabled:opacity-60"
            title="Làm mới tóm tắt sự cố hôm nay"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Phân tích lại</span>
          </button>

          {lastUpdated && (
            <span className="text-[11px] text-slate-400">
              Cập nhật: {lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
