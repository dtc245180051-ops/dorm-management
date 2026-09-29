import React, { useState } from 'react';
import {
  Home,
  Info,
  FileText,
  Search,
  ArrowRight,
  Check,
  Megaphone,
  PhoneCall,
  DollarSign,
  X,
  MessageSquare,
  Sparkles,
  Send,
  Building,
  Shield,
  Clock,
  ExternalLink,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import campusBanner from '../../assets/image.png';

export default function LandingPage({ onNavigate }) {
  const [searchTerm, setSearchTerm] = useState('');

  // State các Modal tương tác
  const [activeModal, setActiveModal] = useState(null); // 'intro' | 'rules' | 'gallery' | 'announcement' | 'chatbot'
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [selectedGalleryImg, setSelectedGalleryImg] = useState(0);

  // State Chatbot AI
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'bot',
      text: 'Xin chào! Tôi là Trợ lý AI KTX ICTU. Bạn cần giải đáp thông tin về quy trình đăng ký, mức phí hay nội quy ký túc xá?',
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState('');

  const navigateTo = (path) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  // Dữ liệu 4 thông báo mới nhất
  const announcements = [
    {
      id: 1,
      type: 'register',
      title: 'Thông báo đăng ký phòng ktx năm 2026–2027',
      subtext: 'Thời gian đăng ký từ 10/09 đến 20/09/2026',
      date: '10/09/2026',
      icon: 'megaphone',
      content:
        'Ban Quản lý Ký túc xá thông báo kế hoạch tiếp nhận và xét duyệt đơn đăng ký lưu trú cho năm học 2026–2027. Sinh viên thuộc diện ưu tiên (chính sách, hộ nghèo, con thương binh) và tân sinh viên khóa mới được ưu tiên sắp xếp phòng trước. Vui lòng nộp đơn trực tuyến qua cổng thông tin trước 20/09/2026.',
    },
    {
      id: 2,
      type: 'rooms',
      title: 'Danh sách phòng KTX còn trống',
      subtext: 'Cập nhật phòng trống tại các Tòa A1, A2, B1',
      date: '12/09/2026',
      icon: 'file',
      content:
        'Cập nhật số liệu chỗ ở trống phục vụ học kỳ mới: Tòa A1 (còn 28 chỗ trống - phòng tiêu chuẩn 6 người), Tòa A2 (còn 14 chỗ trống - phòng khép kín dịch vụ), Tòa B1 (còn 35 chỗ trống). Sinh viên có thể xem chi tiết danh sách phòng và sơ đồ từng tầng khi đăng ký trực tuyến.',
    },
    {
      id: 3,
      type: 'fee',
      title: 'Thông báo thời hạn đóng phí KTX',
      subtext: 'Hạn chót hoàn tất phí lưu trú học kỳ I',
      date: '15/09/2026',
      icon: 'dollar',
      content:
        'Thời hạn thanh toán phí lưu trú KTX học kỳ I năm học 2026–2027 đến hết ngày 30/09/2026. Sinh viên có thể nộp tiền trực tiếp tại phòng Kế toán hoặc thanh toán chuyển khoản qua cổng VNPAY/QR Code trong phân hệ Sinh viên. Sau ngày 30/09, những trường hợp chưa nộp phí sẽ bị hủy kết quả xếp phòng.',
    },
    {
      id: 4,
      type: 'hotline',
      title: 'Đường dây nóng hỗ trợ KTX',
      subtext: 'Hotline trực ban 24/7: 0280.3855.xxx',
      date: 'Thường trực 24/7',
      icon: 'phone',
      content:
        'Ban Quản lý Ký túc xá duy trì đường dây nóng 24/7 để tiếp nhận và xử lý nhanh chóng các phản ánh sự cố điện nước, an ninh trật tự và hỗ trợ y tế khẩn cấp: Hotline Ban quản lý: 0280.3855.123 - Đội Bảo vệ KTX: 0280.3855.456 - Phòng Y tế: 0280.3855.789.',
    },
  ];

  // Dữ liệu bộ sưu tập ảnh phòng thực tế
  const galleryImages = [
    {
      url: '/images/phong_thuc_te.jpg',
      title: 'Phòng ký túc xá sinh viên hiện đại',
      desc: 'Giường tầng gỗ cao cấp có rèm che riêng tư, bàn học độc lập, đèn học và tủ khóa cá nhân.',
    },
    {
      url: '/images/rooms/phong-tieu-chuan.jpg',
      title: 'Không gian học tập & nghỉ ngơi thoáng đãng',
      desc: 'Thiết kế thông minh tối ưu diện tích, cửa sổ đón ánh sáng tự nhiên ngập tràn.',
    },
    {
      url: '/images/rooms/phong-tieu-chuan-2.jpg',
      title: 'Phòng tiêu chuẩn 4–6 sinh viên',
      desc: 'Bàn ghế học tập rộng rãi, kệ sách liền tường và ngăn kéo để đồ tiện dụng.',
    },
    {
      url: campusBanner,
      title: 'Khuôn viên xanh mát toàn cảnh KTX',
      desc: 'Không gian trong lành, nhiều cây xanh, đường dạo bộ và sân thể thao đa năng.',
    },
  ];

  // Xử lý gửi tin nhắn hỏi Bot
  const handleSendChat = (e) => {
    e.preventDefault();
    if (!inputQuestion.trim()) return;

    const userText = inputQuestion.trim();
    const newMsgList = [...chatMessages, { sender: 'user', text: userText }];
    setChatMessages(newMsgList);
    setInputQuestion('');

    setTimeout(() => {
      let reply =
        'Cảm ơn bạn đã đặt câu hỏi. Ban Quản lý KTX sẵn sàng hỗ trợ bạn! Để đăng ký phòng trực tuyến, bạn hãy bấm nút "Đăng ký ngay" trên màn hình.';
      const lower = userText.toLowerCase();

      if (lower.includes('thời gian') || lower.includes('hạn') || lower.includes('khi nào')) {
        reply =
          'Đợt đăng ký phòng cho năm học mới diễn ra từ ngày 10/09 đến hết 20/09/2026. Sinh viên cần hoàn tất nộp hồ sơ trước thời hạn này.';
      } else if (lower.includes('giá') || lower.includes('phí') || lower.includes('tiền')) {
        reply =
          'Mức phí KTX hiện dao động từ 1.200.000đ - 1.940.000đ/học kỳ tùy thuộc loại phòng tiêu chuẩn hay phòng dịch vụ khép kín (đã bao gồm dịch vụ vệ sinh và internet tốc độ cao).';
      } else if (lower.includes('nội quy') || lower.includes('giờ') || lower.includes('ra vào')) {
        reply =
          'Ký túc xá mở cửa từ 05:00 sáng và đóng cửa lúc 22:30 tối. Sinh viên cần xuất trình thẻ nội trú khi ra vào và tuân thủ các quy định về giữ gìn an ninh, vệ sinh chung.';
      } else if (lower.includes('hồ sơ') || lower.includes('thủ tục') || lower.includes('giấy tờ')) {
        reply =
          'Hồ sơ đăng ký gồm: Bản sao CCCD, Ảnh thẻ 3x4, Giấy chứng nhận ưu tiên (nếu có) và điền đầy đủ phiếu thông tin đăng ký KTX trực tuyến.';
      }

      setChatMessages((prev) => [...prev, { sender: 'bot', text: reply }]);
    }, 600);
  };

  const handleQuickQuestion = (q) => {
    setInputQuestion(q);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* ========================================================================= */}
      {/* 1. HEADER CÔNG KHAI (TOP NAVIGATION BAR)                                 */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Logo bên trái: Icon ngôi nhà xanh + Tiêu đề KTX */}
          <div
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/30">
              <Home className="w-6 h-6 fill-white stroke-blue-600" />
            </div>
            <div className="leading-tight">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                KTX
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Hệ thống ký túc xá
              </p>
            </div>
          </div>

          {/* Menu giữa */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-2 text-blue-600 font-semibold border-b-2 border-blue-600 py-1 cursor-pointer transition"
            >
              <Home className="w-4 h-4" />
              <span>Trang chủ</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('intro')}
              className="flex items-center gap-2 text-slate-600 hover:text-blue-600 py-1 cursor-pointer transition"
            >
              <Info className="w-4 h-4" />
              <span>Giới thiệu</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('rules')}
              className="flex items-center gap-2 text-slate-600 hover:text-blue-600 py-1 cursor-pointer transition"
            >
              <FileText className="w-4 h-4" />
              <span>Nội quy</span>
            </button>
          </nav>

          {/* Tiện ích bên phải: Ô tìm kiếm + Nút Đăng nhập + Nút Đăng ký */}
          <div className="flex items-center gap-2.5 sm:gap-3">

            {/* Nút Đăng nhập */}
            <button
              type="button"
              onClick={() => navigateTo('/login')}
              className="border border-blue-400 hover:border-blue-500 text-blue-600 hover:bg-blue-50 bg-white rounded-full px-4 sm:px-5 py-1.5 text-xs sm:text-sm font-semibold transition cursor-pointer shadow-2xs"
            >
              Đăng nhập
            </button>

            {/* Nút Đăng ký */}
            <button
              type="button"
              onClick={() => navigateTo('/register')}
              className="bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-full px-4 sm:px-5 py-1.5 text-xs sm:text-sm font-semibold transition cursor-pointer shadow-sm shadow-blue-500/25"
            >
              Đăng ký
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN CONTENT                                                              */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {/* ======================================================================= */}
        {/* 2. KHỐI HERO BANNER CHÍNH                                              */}
        {/* ======================================================================= */}
        <section className="relative rounded-3xl overflow-hidden shadow-sm border border-slate-100 mb-8 sm:mb-10 min-h-[360px] sm:min-h-[420px] flex items-center bg-slate-900">
          {/* Ảnh nền khuôn viên góc rộng */}
          <img
            src={campusBanner}
            alt="Ký túc xá ICTU"
            className="absolute inset-0 w-full h-full object-cover object-center scale-102 hover:scale-100 transition-transform duration-1000 ease-out"
          />

          {/* Lớp phủ Gradient mờ dần từ trái sang phải để làm nổi bật văn bản */}
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 sm:via-white/70 to-transparent w-full md:w-3/4 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/30 via-transparent to-transparent pointer-events-none" />

          {/* Nội dung Banner cột trái */}
          <div className="relative z-10 p-6 sm:p-10 md:p-14 max-w-2xl select-none">
            <span className="inline-block text-slate-700 font-medium text-base sm:text-lg mb-1 drop-shadow-2xs">
              Chào mừng bạn đến với
            </span>

            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#1e40af] tracking-tight mb-4 drop-shadow-xs">
              Ký túc xá ICTU
            </h2>

            <p className="text-slate-700 text-sm sm:text-base font-medium leading-relaxed mb-8 max-w-lg">
              Nơi bạn không chỉ có một chỗ ở, mà còn là ngôi nhà thứ hai
              trong hành trình học tập và trưởng thành.
            </p>

            {/* 2 nút CTA: Đăng ký ngay & Đăng nhập */}
            <div className="flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={() => navigateTo('/register')}
                className="bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold py-2.5 sm:py-3 px-6 sm:px-7 rounded-full shadow-md shadow-blue-600/30 hover:shadow-lg transition cursor-pointer text-sm sm:text-base flex items-center gap-2"
              >
                <span>Đăng ký ngay</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => navigateTo('/login')}
                className="border border-blue-400 hover:border-blue-500 bg-white hover:bg-blue-50 text-blue-600 font-bold py-2.5 sm:py-3 px-6 sm:px-7 rounded-full transition cursor-pointer text-sm sm:text-base shadow-xs"
              >
                Đăng nhập
              </button>
            </div>
          </div>
        </section>

        {/* ======================================================================= */}
        {/* 3. KHỐI THÔNG BÁO MỚI NHẤT                                             */}
        {/* ======================================================================= */}
        <section className="mb-10 select-none">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Thông báo mới nhất
            </h2>
            <button
              type="button"
              onClick={() => {
                setSelectedAnnouncement(announcements[0]);
                setActiveModal('announcement');
              }}
              className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <span>Xem tất cả</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Grid 4 thẻ thông báo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {announcements.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedAnnouncement(item);
                  setActiveModal('announcement');
                }}
                className="bg-[#f0f7ff] hover:bg-[#e6f2fe] border border-blue-100/80 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-all duration-200 min-h-[145px] flex flex-col justify-between cursor-pointer group relative overflow-hidden"
              >
                {/* Phần trên: Icon + Tiêu đề */}
                <div>
                  <div className="flex items-start gap-3 mb-2">
                    {/* Icon tương ứng */}
                    {item.icon === 'megaphone' && (
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                        <Megaphone className="w-5 h-5 -rotate-12" />
                      </div>
                    )}
                    {item.icon === 'file' && (
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                        <FileText className="w-5 h-5" />
                      </div>
                    )}
                    {item.icon === 'dollar' && (
                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                        <DollarSign className="w-5 h-5" />
                      </div>
                    )}
                    {item.icon === 'phone' && (
                      <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                        <PhoneCall className="w-5 h-5" />
                      </div>
                    )}

                    <h3 className="font-bold text-blue-600 text-sm leading-snug group-hover:text-blue-700 transition">
                      {item.title}
                    </h3>
                  </div>

                  {item.subtext && (
                    <p className="text-xs text-slate-600 font-medium pl-13 line-clamp-2">
                      {item.subtext}
                    </p>
                  )}
                </div>

                {/* Nút mũi tên tròn bo góc phải dưới */}
                <div className="flex justify-end pt-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#dbeafe] text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition shadow-2xs">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ======================================================================= */}
        {/* 4. KHỐI THÔNG TIN NỔI BẬT                                              */}
        {/* ======================================================================= */}
        <section className="mb-12 select-none">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 tracking-tight">
            Thông tin nổi bật
          </h2>

          {/* Grid 3 card thông tin lớn nằm ngang */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* CARD 1: Giới thiệu về ký túc xá */}
            <div className="bg-[#f2f8fd] rounded-2xl border border-blue-100/70 p-4 sm:p-5 shadow-2xs flex flex-row gap-4 items-center justify-between hover:shadow-md hover:border-blue-200 transition-all duration-200">
              <img
                src={campusBanner}
                alt="Khuôn viên Ký túc xá"
                className="w-32 sm:w-36 h-36 rounded-xl object-cover shrink-0 shadow-2xs"
              />
              <div className="flex-1 flex flex-col justify-between h-full min-h-[144px]">
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-1.5 leading-snug">
                    Giới thiệu về ký túc xá
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed font-normal">
                    Ký túc xá là nơi ở dành cho sinh viên, được trang bị đầy đủ
                    tiện nghi, đảm bảo an ninh, trật tự và tạo môi trường học tập,
                    sinh hoạt tốt nhất cho các bạn sinh viên,
                  </p>
                </div>
                <div className="mt-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveModal('intro')}
                    className="border border-blue-400 bg-white text-blue-600 hover:bg-blue-50 px-4 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <span>Tìm hiểu thêm</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* CARD 2: Nội quy ký túc xá */}
            <div className="bg-[#f0faf4] rounded-2xl border border-emerald-100/70 p-4 sm:p-5 shadow-2xs flex flex-row gap-4 items-center justify-between hover:shadow-md hover:border-emerald-200 transition-all duration-200">
              <img
                src="/images/noi_quy_doc.jpg"
                alt="Văn bản Nội quy Ký túc xá"
                className="w-28 sm:w-32 h-44 rounded-xl object-cover shrink-0 border border-slate-200/60 shadow-2xs"
              />
              <div className="flex-1 flex flex-col justify-between h-full min-h-[160px]">
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-2 leading-snug">
                    Nội quy ký túc xá
                  </h3>
                  <ul className="text-xs text-slate-700 space-y-1.5 font-medium">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                      <span>Đảm bảo an ninh, trật tự</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                      <span>Giữ gìn vệ sinh chung</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                      <span>Không sử dụng chất cấm</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                      <span>Tuân thủ giờ giấc ra vào</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveModal('rules')}
                    className="border border-emerald-400 bg-white text-emerald-600 hover:bg-emerald-50 px-4 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <span>Tìm hiểu thêm</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* CARD 3: Hình ảnh phòng ở thực tế */}
            <div className="bg-[#fffcfd] rounded-2xl border border-pink-100/70 p-4 sm:p-5 shadow-2xs flex flex-row gap-4 items-center justify-between hover:shadow-md hover:border-pink-200 transition-all duration-200">
              <img
                src="/images/phong_thuc_te.jpg"
                alt="Phòng ở KTX thực tế"
                className="w-28 sm:w-32 h-44 rounded-xl object-cover shrink-0 shadow-2xs"
              />
              <div className="flex-1 flex flex-col justify-between h-full min-h-[160px]">
                <div>
                  <p className="text-xs text-slate-700 leading-relaxed font-normal pt-2">
                    Không gian sống thoáng mát, đầy đủ tiện nghi cho sinh viên.
                  </p>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setActiveModal('gallery')}
                    className="border border-pink-300 bg-pink-50/70 text-pink-600 hover:bg-pink-100/80 px-4 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <span>Xem bộ sưu tập</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* 5. FOOTER CÔNG KHAI                                                      */}
      {/* ========================================================================= */}
      <footer className="bg-white border-t border-slate-200 py-8 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Home className="w-4 h-4 fill-white stroke-blue-600" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">
                Ban Quản lý Ký túc xá - Trường ĐH CNTT & TT (ICTU)
              </p>
              <p className="text-[11px] text-slate-400">
                Đường Z115, Xã Quyết Thắng, TP. Thái Nguyên, Tỉnh Thái Nguyên
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveModal('intro')}
              className="hover:text-blue-600 cursor-pointer"
            >
              Giới thiệu
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('rules')}
              className="hover:text-blue-600 cursor-pointer"
            >
              Nội quy KTX
            </button>
            <button
              type="button"
              onClick={() => navigateTo('/login')}
              className="text-blue-600 font-semibold cursor-pointer"
            >
              Đăng nhập hệ thống
            </button>
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 6. FLOATING AI ASSISTANT WIDGET (ROBOT CHATBOT GÓC PHẢI DƯỚI)             */}
      {/* ========================================================================= */}
      <div className="fixed bottom-6 right-6 z-50">
        <div
          onClick={() => setActiveModal('chatbot')}
          className="relative group cursor-pointer"
          title="Trợ lý AI KTX - Tư vấn & Giải đáp 24/7"
        >
          {/* Avatar Robot Tròn Viền Xanh Rực Rỡ Chuẩn Figma */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-blue-500 via-indigo-600 to-sky-400 p-0.5 shadow-xl shadow-blue-500/40 hover:scale-108 active:scale-95 transition-all duration-200 flex items-center justify-center overflow-hidden">
            <img
              src="/chatbot.png"
              alt="AI Assistant"
              className="w-full h-full object-cover rounded-full bg-white"
            />
          </div>

          {/* Chấm xanh trạng thái Online */}
          <span className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-xs animate-pulse" />

          {/* Tooltip hiển thị khi hover */}
          <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900/90 backdrop-blur-xs text-white text-xs font-semibold rounded-xl shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200">
            Hỏi đáp Trợ lý AI KTX 24/7 ✨
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CHATBOT AI TRỢ LÝ HỎI ĐÁP                                       */}
      {/* ========================================================================= */}
      {activeModal === 'chatbot' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:p-6 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full h-[540px] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-8">
            {/* Header Chatbot */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 p-0.5 relative">
                  <img
                    src="/chatbot.png"
                    alt="Bot"
                    className="w-full h-full rounded-full object-cover bg-white"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-blue-700" />
                </div>
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-1.5">
                    Trợ lý AI KTX ICTU
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  </h3>
                  <p className="text-[11px] text-blue-100">
                    Sẵn sàng giải đáp thông tin 24/7
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg hover:bg-white/20 text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Khung tin nhắn */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/60 text-xs">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[82%] p-3 rounded-2xl leading-relaxed ${msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-xs shadow-xs'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs shadow-xs'
                      }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Câu hỏi gợi ý nhanh */}
            <div className="p-2 border-t border-slate-100 bg-white flex gap-1.5 overflow-x-auto text-[11px]">
              <button
                type="button"
                onClick={() => handleQuickQuestion('Thời gian đăng ký KTX là khi nào?')}
                className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 shrink-0 cursor-pointer"
              >
                Thời hạn đăng ký?
              </button>
              <button
                type="button"
                onClick={() => handleQuickQuestion('Mức phí lưu trú KTX bao nhiêu?')}
                className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 shrink-0 cursor-pointer"
              >
                Mức phí lưu trú?
              </button>
              <button
                type="button"
                onClick={() => handleQuickQuestion('Quy định giờ giấc ra vào KTX?')}
                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full hover:bg-emerald-100 shrink-0 cursor-pointer"
              >
                Giờ giấc KTX?
              </button>
            </div>

            {/* Input gửi câu hỏi */}
            <form
              onSubmit={handleSendChat}
              className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
            >
              <input
                type="text"
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                placeholder="Nhập câu hỏi của bạn tại đây..."
                className="flex-1 bg-slate-100 px-4 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <button
                type="submit"
                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: BỘ SƯU TẬP ẢNH PHÒNG Ở THỰC TẾ                                  */}
      {/* ========================================================================= */}
      {activeModal === 'gallery' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-lg">
                Bộ sưu tập hình ảnh phòng ở thực tế KTX ICTU
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ảnh lớn đang xem */}
            <div className="flex-1 overflow-hidden rounded-2xl relative bg-slate-950 max-h-[380px] mb-4">
              <img
                src={galleryImages[selectedGalleryImg].url}
                alt="Room"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950/90 to-transparent text-white">
                <h4 className="font-bold text-sm">
                  {galleryImages[selectedGalleryImg].title}
                </h4>
                <p className="text-xs text-slate-200 mt-0.5">
                  {galleryImages[selectedGalleryImg].desc}
                </p>
              </div>
            </div>

            {/* Danh sách ảnh thu nhỏ để bấm chọn */}
            <div className="grid grid-cols-4 gap-3">
              {galleryImages.map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedGalleryImg(idx)}
                  className={`h-20 rounded-xl overflow-hidden cursor-pointer border-2 transition ${selectedGalleryImg === idx
                    ? 'border-blue-600 scale-102 shadow-md'
                    : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                >
                  <img
                    src={img.url}
                    alt="Thumbnail"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  navigateTo('/student/register');
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition"
              >
                Đăng ký phòng ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: NỘI QUY KÝ TÚC XÁ CHI TIẾT                                      */}
      {/* ========================================================================= */}
      {activeModal === 'rules' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">
                  Nội quy Ký túc xá - Trường ĐH CNTT & TT
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed pr-2">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                <h4 className="font-bold text-slate-900 mb-1 text-sm">
                  Điều 1: Giờ giấc & Ra vào ký túc xá
                </h4>
                <p>
                  - Ký túc xá mở cửa từ 05:00 sáng và đóng cửa lúc 22:30 hàng ngày.<br />
                  - Sinh viên phải xuất trình thẻ nội trú hợp lệ khi ra vào cổng KTX.<br />
                  - Khách đến thăm phải đăng ký tại phòng thường trực bảo vệ và chỉ được tiếp tại phòng khách.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                <h4 className="font-bold text-slate-900 mb-1 text-sm">
                  Điều 2: Đảm bảo An ninh & Trật tự
                </h4>
                <p>
                  - Nghiêm cấm đánh bạc, tàng trữ vũ khí, chất cháy nổ và chất gây nghiện.<br />
                  - Không tụ tập gây ồn ào, mất trật tự sau 22:00 để đảm bảo không gian học tập.<br />
                  - Tự bảo quản tài sản cá nhân và có trách nhiệm bảo vệ tài sản công cộng.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                <h4 className="font-bold text-slate-900 mb-1 text-sm">
                  Điều 3: Giữ gìn Vệ sinh & Cảnh quan chung
                </h4>
                <p>
                  - Giữ vệ sinh phòng ở và hành lang, bỏ rác đúng nơi quy định.<br />
                  - Thực hiện tổng vệ sinh phòng hàng tuần theo lịch phân công.<br />
                  - Sử dụng điện nước tiết kiệm, tắt các thiết bị khi ra khỏi phòng.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: GIỚI THIỆU VỀ KÝ TÚC XÁ                                         */}
      {/* ========================================================================= */}
      {activeModal === 'intro' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Building className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">
                  Giới thiệu Ký túc xá Đại học CNTT & TT (ICTU)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed pr-2">
              <img
                src={campusBanner}
                alt="Campus"
                className="w-full h-48 rounded-2xl object-cover"
              />
              <p>
                Ký túc xá Trường Đại học Công nghệ Thông tin và Truyền thông
                (ICTU) tọa lạc tại khuôn viên trường với quy mô nhiều tòa nhà cao
                tầng hiện đại, đáp ứng chỗ ở cho hàng nghìn sinh viên nội trú.
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100">
                  <h5 className="font-bold text-blue-800 mb-1">Cơ sở vật chất</h5>
                  <p className="text-slate-600">
                    Phòng khép kín, bình nóng lạnh, wifi cáp quang tốc độ cao,
                    giường tầng tiện nghi và bàn học cá nhân.
                  </p>
                </div>
                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-100">
                  <h5 className="font-bold text-emerald-800 mb-1">Tiện ích xung quanh</h5>
                  <p className="text-slate-600">
                    Căng tin sinh viên, sân bóng đá cỏ nhân tạo, sân bóng rổ, siêu
                    thị mini và phòng tự học 24/7.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  navigateTo('/student/register');
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition"
              >
                Đăng ký ở ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: CHI TIẾT THÔNG BÁO                                              */}
      {/* ========================================================================= */}
      {activeModal === 'announcement' && selectedAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
                {selectedAnnouncement.date}
              </span>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="text-base font-bold text-slate-900 mb-2">
              {selectedAnnouncement.title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              {selectedAnnouncement.content}
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Đóng
              </button>
              {selectedAnnouncement.type === 'register' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    navigateTo('/student/register');
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer"
                >
                  Nộp đơn đăng ký
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
