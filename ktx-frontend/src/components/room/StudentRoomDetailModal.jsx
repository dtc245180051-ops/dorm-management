import React, { useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Home,
  Layers,
  Users,
  Tag,
  Bed,
  Sparkles,
  Check,
  Wind,
  Flame,
  Archive,
  BookOpen,
  Sun,
  Wifi,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

export default function StudentRoomDetailModal({
  isOpen,
  onClose,
  room,
  onRegisterRoom,
}) {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!isOpen || !room) return null;

  const images = room.images && room.images.length > 0
    ? room.images
    : [room.hinh_anh || '/images/phong_thuc_te.jpg'];

  const isFull = room.trang_thai === 'DA_DAY';
  const emptyBeds = room.giuong_trong || [];

  const handleNextSlide = (e) => {
    e.stopPropagation();
    setCurrentSlide((prev) => (prev + 1) % images.length);
  };

  const handlePrevSlide = (e) => {
    e.stopPropagation();
    setCurrentSlide((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleRegisterClick = () => {
    if (isFull) return;
    if (onRegisterRoom) {
      onRegisterRoom(room);
    }
  };

  // Ánh xạ icon tiện ích
  const getAmenityIcon = (name) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('điều hòa')) return <Wind className="w-4 h-4 text-sky-500 shrink-0" />;
    if (lower.includes('nóng lạnh')) return <Flame className="w-4 h-4 text-amber-500 shrink-0" />;
    if (lower.includes('tủ')) return <Archive className="w-4 h-4 text-indigo-500 shrink-0" />;
    if (lower.includes('bàn')) return <BookOpen className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (lower.includes('ban công')) return <Sun className="w-4 h-4 text-yellow-500 shrink-0" />;
    if (lower.includes('wifi')) return <Wifi className="w-4 h-4 text-blue-500 shrink-0" />;
    return <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />;
  };

  // Chuẩn hóa và làm sạch phông chữ tiếng Việt hiển thị
  const displayTang = room.tang
    ? String(room.tang).replace(/t\?ng/gi, 'Tầng').replace(/^(\d+)$/, 'Tầng $1')
    : (room.so_tang ? `Tầng ${room.so_tang}` : '');

  const displaySiSo = room.si_so
    ? String(room.si_so).replace(/ng\?\?i/gi, 'người')
    : `${room.da_o ?? 0}/${room.suc_chua ?? 0} người`;

  const displayGiaThue = room.gia_thue
    ? String(room.gia_thue).replace(/\?\s*\/\s*n\?m/gi, 'đ / năm').replace(/\?/g, 'đ')
    : (room.gia_tien_nam != null ? `${Number(room.gia_tien_nam).toLocaleString('vi-VN')} đ / năm` : '');

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 my-auto max-h-[90vh] overflow-y-auto flex flex-col gap-6 text-slate-800 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header Modal */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 sticky top-0 bg-white z-20 -mt-2 pt-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Phòng {room.so_phong}
            </h2>
            <span className="text-sm font-semibold text-slate-500">
              ({room.toa} - {displayTang})
            </span>
            {isFull ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#e2e8f0] text-slate-500">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Đã đầy
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#dcfce7] text-[#15803d]">
                <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
                Còn chỗ ({emptyBeds.length} chỗ trống)
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
            title="Đóng modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Slide Ảnh phòng chất lượng cao */}
        <div className="space-y-2.5">
          <div className="relative w-full h-56 sm:h-72 rounded-2xl overflow-hidden bg-slate-900 shadow-inner group select-none">
            <img
              src={images[currentSlide]}
              alt={`Ảnh phòng ${room.so_phong} - slide ${currentSlide + 1}`}
              className="w-full h-full object-cover transition-all duration-300"
              onError={(e) => {
                e.currentTarget.src = '/images/phong_thuc_te.jpg';
              }}
            />

            {/* Chỉ số ảnh */}
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
              {currentSlide + 1} / {images.length}
            </div>

            {/* Nút lùi slide */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrevSlide}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-slate-800 backdrop-blur-xs flex items-center justify-center shadow-md transition cursor-pointer hover:scale-105 active:scale-95"
                  title="Ảnh trước"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={handleNextSlide}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-slate-800 backdrop-blur-xs flex items-center justify-center shadow-md transition cursor-pointer hover:scale-105 active:scale-95"
                  title="Ảnh sau"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* Dải thumbnail */}
          {images.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  className={`relative w-16 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition cursor-pointer ${
                    currentSlide === idx
                      ? 'border-blue-600 ring-2 ring-blue-200'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/images/phong_thuc_te.jpg';
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. Khối thông tin chi tiết */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#f8fafc] border border-slate-200/80 rounded-2xl p-3 flex flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5 text-slate-400" />
              Tòa nhà
            </span>
            <span className="text-sm font-black text-slate-800">{room.toa}</span>
          </div>

          <div className="bg-[#f8fafc] border border-slate-200/80 rounded-2xl p-3 flex flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              Tầng
            </span>
            <span className="text-sm font-black text-slate-800">{displayTang}</span>
          </div>

          <div className="bg-[#f8fafc] border border-slate-200/80 rounded-2xl p-3 flex flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              Sĩ số
            </span>
            <span className="text-sm font-black text-slate-800">{displaySiSo}</span>
          </div>

          <div className="bg-[#f8fafc] border border-slate-200/80 rounded-2xl p-3 flex flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              Loại phòng
            </span>
            <span className="text-sm font-black text-blue-700">{room.loai_phong}</span>
          </div>
        </div>

        {/* 4. Giá thuê hiển thị nổi bật */}
        <div className="bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
              Mức giá thuê trọn gói
            </span>
            <span className="text-lg sm:text-2xl font-black text-[#0f3b79]">
              {displayGiaThue}
            </span>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            (Bao gồm chi phí quản lý KTX tiêu chuẩn)
          </span>
        </div>

        {/* 5. Danh sách tiện ích có sẵn */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            Tiện ích phòng có sẵn
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {(room.tien_ich || [
              'Điều hòa',
              'Nóng lạnh',
              'Tủ đồ cá nhân',
              'Bàn học',
              'Ban công',
              'Wifi tốc độ cao',
            ]).map((amenity, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2.5 p-2.5 bg-white border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs"
              >
                {getAmenityIcon(amenity)}
                <span>{amenity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Sơ đồ giường và số giường còn trống */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Bed className="w-4 h-4 text-blue-600" />
              Sơ đồ giường & Vị trí còn trống
            </h3>
            {isFull ? (
              <span className="text-xs font-bold text-slate-500">
                Phòng đã đủ 8/8 sinh viên
              </span>
            ) : (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                Còn trống: {emptyBeds.map((g) => `Giường ${g}`).join(', ')}
              </span>
            )}
          </div>

          {/* Lưới sơ đồ giường */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(room.giuongs && room.giuongs.length > 0
              ? room.giuongs
              : [
                  { ma: 'G01', trang_thai: 'DA_O', tang: 1 },
                  { ma: 'G02', trang_thai: 'DA_O', tang: 2 },
                  { ma: 'G03', trang_thai: 'TRONG', tang: 1 },
                  { ma: 'G04', trang_thai: 'DA_O', tang: 2 },
                  { ma: 'G05', trang_thai: 'DA_O', tang: 1 },
                  { ma: 'G06', trang_thai: 'DA_O', tang: 2 },
                  { ma: 'G07', trang_thai: 'TRONG', tang: 1 },
                  { ma: 'G08', trang_thai: 'DA_O', tang: 2 },
                ]
            ).map((bed) => {
              const isEmpty = bed.trang_thai === 'TRONG' || emptyBeds.includes(bed.ma);
              return (
                <div
                  key={bed.ma}
                  className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                    isEmpty
                      ? 'bg-emerald-50/70 border-emerald-300 text-emerald-800 shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm tracking-tight">
                      {bed.ma}
                    </span>
                    <Bed
                      className={`w-4 h-4 ${
                        isEmpty ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
                    <span>{bed.tang === 2 ? 'Tầng trên' : 'Tầng dưới'}</span>
                    {isEmpty ? (
                      <span className="text-emerald-700 font-bold bg-white/80 px-1.5 py-0.5 rounded">
                        Trống
                      </span>
                    ) : (
                      <span className="text-slate-400">Đã ở</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 7. Footer: Nút hành động */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-sm transition cursor-pointer"
          >
            Đóng
          </button>

          {isFull ? (
            <button
              type="button"
              disabled
              className="px-6 py-2.5 rounded-xl bg-slate-200 text-slate-400 font-bold text-sm cursor-not-allowed flex items-center gap-2"
              title="Phòng hiện đã đủ sĩ số, vui lòng chọn phòng khác"
            >
              <AlertCircle className="w-4 h-4" />
              Phòng đã đầy
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRegisterClick}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition flex items-center gap-2 cursor-pointer hover:shadow-lg active:scale-98"
              title="Đăng ký ngay phòng này"
            >
              <span>Đăng ký phòng này</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
