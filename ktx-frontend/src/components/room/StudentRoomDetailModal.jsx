import { useState } from 'react';
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
  Wind,
  Flame,
  Archive,
  BookOpen,
  Sun,
  Wifi,
  ArrowRight,
  AlertCircle,
  UserCheck,
} from 'lucide-react';

/**
 * Format tên giường thân thiện cho sinh viên:
 * Ví dụ: 'A1_T3_P301_G01' -> 'Giường 01'
 * 'G01' -> 'Giường 01'
 * '1' -> 'Giường 01'
 */
const formatBedDisplayName = (bedInput) => {
  if (!bedInput) return 'Giường';

  // Nếu là object giường
  if (typeof bedInput === 'object') {
    if (bedInput.bed_name) return bedInput.bed_name;
    if (bedInput.name) return bedInput.name;
    if (bedInput.ten_giuong) return bedInput.ten_giuong;
    if (bedInput.label) return bedInput.label;
    bedInput = bedInput.ma || bedInput.ma_giuong || bedInput.id || '';
  }

  const rawStr = String(bedInput).trim();
  if (!rawStr) return 'Giường';

  // Nếu chuỗi đã có sẵn chữ "Giường", chuẩn hóa số 2 chữ số (ví dụ: "Giường 1" -> "Giường 01")
  if (/^giường\s*\d+/i.test(rawStr)) {
    return rawStr.replace(/^giường\s*(\d+)$/i, (_, num) => `Giường ${num.padStart(2, '0')}`);
  }

  // Tách phần đuôi theo dấu gạch dưới '_' hoặc '-' (ví dụ: A1_T3_P301_G01 -> G01)
  const parts = rawStr.split(/[_-]/);
  const lastPart = parts[parts.length - 1];

  // Nếu đuôi có dạng G01, G1, g02...
  const matchG = lastPart.match(/^G(\d+)$/i);
  if (matchG) {
    const num = matchG[1].padStart(2, '0');
    return `Giường ${num}`;
  }

  // Nếu đuôi là số thuần túy '1', '2'...
  if (/^\d+$/.test(lastPart)) {
    return `Giường ${lastPart.padStart(2, '0')}`;
  }

  // Fallback: tìm ký tự G kèm số trong toàn bộ chuỗi
  const anyGMatch = rawStr.match(/G(\d+)/i);
  if (anyGMatch) {
    return `Giường ${anyGMatch[1].padStart(2, '0')}`;
  }

  return `Giường ${lastPart}`;
};

export default function StudentRoomDetailModal({
  isOpen,
  onClose,
  room,
  onRegisterRoom,
}) {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (!isOpen || !room) return null;

  const images =
    room.images && room.images.length > 0
      ? room.images
      : [room.hinh_anh || '/images/phong_thuc_te.jpg'];

  const isFull = room.trang_thai === 'DA_DAY';
  const rawEmptyBeds = room.giuong_trong || [];

  // Chuẩn hóa danh sách giường trong phòng
  const rawBeds =
    room.giuongs && room.giuongs.length > 0
      ? room.giuongs
      : room.beds && room.beds.length > 0
      ? room.beds
      : [];

  const bedsList =
    rawBeds.length > 0
      ? rawBeds
      : rawEmptyBeds.length > 0
      ? rawEmptyBeds.map((g, idx) => ({
          ma_giuong: g,
          ma: g,
          trang_thai: 'TRONG',
          tang: idx % 2 === 1 ? 2 : 1,
        }))
      : [
          { ma: 'G01', ma_giuong: 'G01', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G02', ma_giuong: 'G02', trang_thai: 'TRONG', tang: 2 },
          { ma: 'G03', ma_giuong: 'G03', trang_thai: 'TRONG', tang: 1 },
          { ma: 'G04', ma_giuong: 'G04', trang_thai: 'TRONG', tang: 2 },
        ];

  // Danh sách các giường trống
  const availableBeds = bedsList.filter((bed) => {
    const status = String(bed.trang_thai || '').toUpperCase();
    const isFree =
      status === 'TRONG' ||
      status === 'AVAILABLE' ||
      (!bed.da_co_nguoi && !bed.is_occupied) ||
      rawEmptyBeds.includes(bed.ma) ||
      rawEmptyBeds.includes(bed.ma_giuong);
    return isFree;
  });

  const emptyBedsCount =
    rawEmptyBeds.length > 0 ? rawEmptyBeds.length : availableBeds.length;

  // Format chuỗi tên giường còn trống thân thiện
  const emptyBedsNames = (
    rawEmptyBeds.length > 0
      ? rawEmptyBeds.map((g) => formatBedDisplayName(g))
      : availableBeds.map((b) => formatBedDisplayName(b))
  );

  const emptyBedsDisplayString =
    emptyBedsNames.length > 0
      ? emptyBedsNames.join(', ')
      : 'Không còn giường trống';

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
      onRegisterRoom();
    }
  };

  // Ánh xạ icon tiện ích
  const getAmenityIcon = (name) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('điều hòa'))
      return <Wind className="w-4 h-4 text-sky-500 shrink-0" />;
    if (lower.includes('nóng lạnh'))
      return <Flame className="w-4 h-4 text-amber-500 shrink-0" />;
    if (lower.includes('tủ'))
      return <Archive className="w-4 h-4 text-indigo-500 shrink-0" />;
    if (lower.includes('bàn'))
      return <BookOpen className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (lower.includes('ban công'))
      return <Sun className="w-4 h-4 text-yellow-500 shrink-0" />;
    if (lower.includes('wifi'))
      return <Wifi className="w-4 h-4 text-blue-500 shrink-0" />;
    return <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />;
  };

  // Chuẩn hóa và làm sạch phông chữ tiếng Việt hiển thị
  const displayTang = room.tang
    ? String(room.tang)
        .replace(/t\?ng/gi, 'Tầng')
        .replace(/^(\d+)$/, 'Tầng $1')
    : room.so_tang
    ? `Tầng ${room.so_tang}`
    : '';

  const displaySiSo = room.si_so
    ? String(room.si_so).replace(/ng\?\?i/gi, 'người')
    : `${room.da_o ?? 0}/${room.suc_chua ?? bedsList.length} người`;

  const displayGiaThue = room.gia_thue
    ? String(room.gia_thue)
        .replace(/\?\s*\/\s*n\?m/gi, 'đ / năm')
        .replace(/\?/g, 'đ')
    : room.gia_tien_nam != null
    ? `${Number(room.gia_tien_nam).toLocaleString('vi-VN')} đ / năm`
    : '';

  // Phân tích giới tính phòng quy định
  const rawGender =
    room.gioi_tinh ||
    room.gender ||
    (room.toa && String(room.toa).toLowerCase().includes('a1') ? 'Nữ' : '') ||
    'Nam & Nữ';

  const genderType = (() => {
    const g = String(rawGender).toLowerCase();
    if (g.includes('nữ') && !g.includes('nam')) return 'FEMALE';
    if (g.includes('nam') && !g.includes('nữ')) return 'MALE';
    return 'ALL';
  })();

  const displayGenderText =
    genderType === 'FEMALE'
      ? 'Phòng Nữ'
      : genderType === 'MALE'
      ? 'Phòng Nam'
      : 'Nam & Nữ';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      {/* Container Modal bo tròn 4 góc, có overflow-hidden để header/footer và bo góc liền mạch */}
      <div
        className="relative bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 my-auto max-h-[92vh] overflow-hidden flex flex-col text-slate-800 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================================= */}
        {/* 1. HEADER CỐ ĐỊNH TRÊN CÙNG: TIÊU ĐỀ + BADGE TRẠNG THÁI + GIỚI TÍNH + NÚT X */}
        {/* ========================================================================= */}
        <div className="shrink-0 bg-white border-b border-slate-100 px-5 sm:px-7 py-3.5 flex items-center justify-between gap-3 z-20">
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
              Phòng {room.so_phong}
            </h2>
            <span className="text-sm font-semibold text-slate-500 shrink-0">
              ({room.toa} - {displayTang})
            </span>

            {/* Badge Giới tính phòng quy định */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                genderType === 'FEMALE'
                  ? 'bg-pink-50 text-pink-700 border border-pink-200'
                  : genderType === 'MALE'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              {displayGenderText}
            </span>

            {/* Badge Trạng thái chỗ ở */}
            {isFull ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-[#e2e8f0] text-slate-500 shrink-0">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Đã đầy
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-[#dcfce7] text-[#15803d] shrink-0">
                <span className="w-2 h-2 rounded-full bg-[#16a34a] animate-pulse" />
                Còn chỗ ({emptyBedsCount} chỗ trống)
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

        {/* ========================================================================= */}
        {/* 2. THÂN MODAL CUỘN NỘI DUNG (ẢNH PHÒNG CUỘN CÙNG NỘI DUNG, KHÔNG BỊ GHIM) */}
        {/* ========================================================================= */}
        <div className="overflow-y-auto px-5 sm:px-7 py-5 space-y-5 flex-1">
          {/* Slide Ảnh phòng chất lượng cao - Nằm trong dòng cuộn bình thường */}
          <div className="space-y-2">
            <div className="relative w-full h-56 sm:h-72 rounded-2xl overflow-hidden bg-slate-900 shadow-inner group select-none">
              <img
                src={images[currentSlide]}
                alt={`Ảnh phòng ${room.so_phong} - slide ${currentSlide + 1}`}
                className="w-full h-full object-cover transition-all duration-300"
                onError={(e) => {
                  e.currentTarget.src = '/images/phong_thuc_te.jpg';
                }}
              />

              {/* Chỉ số ảnh ở góc trên bên phải */}
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                {currentSlide + 1} / {images.length}
              </div>

              {/* Nút lùi/tiến slide ảnh */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevSlide}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 hover:bg-white text-slate-800 backdrop-blur-xs flex items-center justify-center shadow-md transition cursor-pointer hover:scale-105 active:scale-95"
                    title="Ảnh trước"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleNextSlide}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 hover:bg-white text-slate-800 backdrop-blur-xs flex items-center justify-center shadow-md transition cursor-pointer hover:scale-105 active:scale-95"
                    title="Ảnh sau"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* Dải thumbnail ảnh nhỏ nếu có nhiều ảnh */}
            {images.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentSlide(idx)}
                    className={`relative w-16 h-11 rounded-xl overflow-hidden shrink-0 border-2 transition cursor-pointer ${
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

          {/* 3. Khối 4 thông số chi tiết (Tòa, Tầng, Sĩ số, Loại phòng) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#f8fafc] border border-slate-200/80 rounded-2xl p-3 flex flex-col gap-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-slate-400" />
                Tòa nhà
              </span>
              <span className="text-sm font-black text-slate-800 truncate">
                {room.toa}
              </span>
            </div>

            <div className="bg-[#f8fafc] border border-slate-200/80 rounded-2xl p-3 flex flex-col gap-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                Tầng
              </span>
              <span className="text-sm font-black text-slate-800 truncate">
                {displayTang}
              </span>
            </div>

            <div className="bg-[#f8fafc] border border-slate-200/80 rounded-2xl p-3 flex flex-col gap-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                Sĩ số
              </span>
              <span className="text-sm font-black text-slate-800 truncate">
                {displaySiSo}
              </span>
            </div>

            <div className="bg-[#f8fafc] border border-slate-200/80 rounded-2xl p-3 flex flex-col gap-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                Loại phòng
              </span>
              <span className="text-sm font-black text-blue-700 truncate">
                {room.loai_phong}
              </span>
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
              {(
                room.tien_ich || [
                  'Điều hòa',
                  'Nóng lạnh',
                  'Tủ đồ cá nhân',
                  'Bàn học',
                  'Ban công',
                  'Wifi tốc độ cao',
                ]
              ).map((amenity, idx) => (
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
            </div>

            {/* Dòng thông báo màu xanh lá format tên giường thân thiện */}
            <div className="p-2.5 sm:p-3 rounded-xl border border-emerald-200 bg-emerald-50/80 text-emerald-900 text-xs font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>
                Còn trống:{' '}
                <strong className="text-emerald-800 font-bold">
                  {emptyBedsDisplayString}
                </strong>
                {emptyBedsCount > 0 && (
                  <span className="text-emerald-600 font-normal ml-1">
                    ({emptyBedsCount}/{bedsList.length} vị trí)
                  </span>
                )}
              </span>
            </div>

            {/* Lưới sơ đồ thẻ giường */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {bedsList.map((bed, idx) => {
                const status = String(bed.trang_thai || '').toUpperCase();
                const isEmpty =
                  status === 'TRONG' ||
                  status === 'AVAILABLE' ||
                  (!bed.da_co_nguoi && !bed.is_occupied) ||
                  rawEmptyBeds.includes(bed.ma) ||
                  rawEmptyBeds.includes(bed.ma_giuong);

                const bedDisplayName =
                  formatBedDisplayName(bed) || `Giường ${String(idx + 1).padStart(2, '0')}`;
                const bedFloorText =
                  bed.tang === 2 ? 'Tầng trên' : 'Tầng dưới';

                return (
                  <div
                    key={bed.ma_giuong || bed.ma || idx}
                    className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                      isEmpty
                        ? 'bg-emerald-50/70 border-emerald-300 text-emerald-900 shadow-2xs hover:border-emerald-400'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    {/* Hàng 1: Tên giường cụ thể + Icon chiếc giường */}
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-sm tracking-tight text-slate-800">
                        {bedDisplayName}
                      </span>
                      <Bed
                        className={`w-4 h-4 shrink-0 ${
                          isEmpty ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      />
                    </div>

                    {/* Hàng 2: Tầng trên / Tầng dưới + Trạng thái Trống / Đã ở */}
                    <div className="mt-2.5 flex items-center justify-between text-[11px] font-semibold">
                      <span className={isEmpty ? 'text-slate-600' : 'text-slate-400'}>
                        {bedFloorText}
                      </span>
                      {isEmpty ? (
                        <span className="text-emerald-700 font-bold bg-white px-2 py-0.5 rounded shadow-2xs border border-emerald-200/60">
                          Trống
                        </span>
                      ) : (
                        <span className="text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded">
                          Đã ở
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. FOOTER MODAL CỐ ĐỊNH Ở DƯỚI                                           */}
        {/* ========================================================================= */}
        <div className="px-5 sm:px-7 py-3.5 border-t border-slate-100 bg-white shrink-0 flex items-center justify-end gap-3 flex-wrap">
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
              title="Đăng ký ngay"
            >
              <span>Đăng ký ngay</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
