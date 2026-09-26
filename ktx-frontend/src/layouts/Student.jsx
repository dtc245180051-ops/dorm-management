import React, { useState } from 'react';
import {
  Home,
  FileEdit,
  ArrowLeftRight,
  Search,
  Clock,
  FileText,
  CreditCard,
  User,
  HelpCircle,
  LogOut,
  Bell,
  MessageSquare,
  Sparkles,
  X,
  Send,
} from 'lucide-react';

export default function StudentLayout({
  children,
  activeTab = 'register',
  onSelectTab,
  searchTerm = '',
  onSearchChange,
  userName = 'Nguyễn Văn A',
  userRole = 'Sinh viên',
}) {
  const [showChatbotModal, setShowChatbotModal] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'bot',
      text: 'Xin chào Nguyễn Văn A! Mình là Trợ lý AI KTX. Bạn cần hỗ trợ gì về đăng ký phòng, thủ tục hay nội quy KTX không?',
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState('');

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputQuestion.trim()) return;

    const userText = inputQuestion.trim();
    setChatMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setInputQuestion('');

    setTimeout(() => {
      let reply = 'Cảm ơn bạn đã đặt câu hỏi. Đơn đăng ký ở sẽ được ban quản lý xét duyệt trong vòng 1-2 ngày làm việc!';
      if (userText.toLowerCase().includes('phòng') || userText.toLowerCase().includes('giường')) {
        reply = 'Bạn có thể chọn các phòng trống tại mục Nguyện vọng và nêu rõ mong muốn ở cùng bạn bè hoặc tầng thấp/cao nhé.';
      } else if (userText.toLowerCase().includes('chi phí') || userText.toLowerCase().includes('tiền')) {
        reply = 'Chi phí phòng tiêu chuẩn là 350.000đ - 650.000đ/tháng tùy theo loại phòng 4 hoặc 6 người.';
      }
      setChatMessages((prev) => [...prev, { sender: 'bot', text: reply }]);
    }, 600);
  };

  const navItems = [
    { id: 'dashboard', label: 'Trang chủ', icon: Home, section: 'main' },
    {
      id: 'register',
      label: 'Đăng ký phòng',
      icon: FileEdit,
      section: 'room',
      highlightLabel: 'Đăng ký ở',
    },
    { id: 'transfer', label: 'Chuyển / trả phòng', icon: ArrowLeftRight, section: 'room' },
    { id: 'lookup', label: 'Tra cứu phòng', icon: Search, section: 'room' },
    { id: 'history', label: 'Lịch sử', icon: Clock, section: 'room' },
    { id: 'feedback', label: 'Gửi phản ánh', icon: FileText, section: 'room' },
    { id: 'payment', label: 'Thanh toán phí KTX', icon: CreditCard, section: 'finance' },
    { id: 'payment_history', label: 'Lịch sử thanh toán', icon: Clock, section: 'finance' },
    { id: 'profile', label: 'Thông tin cá nhân', icon: User, section: 'personal' },
    { id: 'help', label: 'Trợ giúp và hỗ trợ', icon: HelpCircle, section: 'system' },
  ];

  const handleTabClick = (tabId) => {
    if (onSelectTab) {
      onSelectTab(tabId);
    } else {
      if (tabId === 'register') {
        window.history.pushState({}, '', '/student/register');
      } else if (tabId === 'history') {
        window.history.pushState({}, '', '/student/history');
      } else if (tabId === 'dashboard') {
        window.history.pushState({}, '', '/student/dashboard');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#eef2f6] text-slate-800 font-sans flex flex-col antialiased selection:bg-blue-100 selection:text-blue-700">
      {/* 1. Header trên cùng theo chuẩn Figma */}
      <header className="h-18 bg-white border-b border-slate-200/80 px-6 sm:px-8 flex items-center justify-between gap-6 shrink-0 sticky top-0 z-40 shadow-xs">
        {/* Logo KTX */}
        <div
          onClick={() => handleTabClick('dashboard')}
          className="flex items-center gap-3 cursor-pointer select-none group"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:bg-blue-700 transition">
            {/* SVG Nhà KTX */}
            <svg
              className="w-6 h-6 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-black tracking-tight text-slate-900 leading-none">
              KTX
            </span>
            <span className="text-[11px] font-medium text-slate-500 mt-1">
              Hệ thống ký túc xá
            </span>
          </div>
        </div>

        {/* Thanh tìm kiếm ở giữa */}
        <div className="flex-1 max-w-xl mx-4">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              placeholder="Tìm kiếm..."
              className="w-full pl-5 pr-11 py-2 bg-[#f1f3f5] hover:bg-[#ebedf0] focus:bg-white text-sm text-slate-800 placeholder-slate-400 rounded-full border border-transparent focus:border-blue-400 focus:outline-none focus:ring-3 focus:ring-blue-100 transition-all"
            />
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Khối cá nhân & Thông báo bên phải */}
        <div className="flex items-center gap-5 shrink-0">
          {/* Nút chuông thông báo kèm chấm đỏ */}
          <button
            type="button"
            className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition cursor-pointer"
            title="Thông báo"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white"></span>
          </button>

          {/* User profile */}
          <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
            <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm shadow-xs border border-purple-200">
              <User className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-bold text-slate-800 leading-tight">
                {userName}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {userRole}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Phần thân gồm Sidebar bên trái và Content bên phải */}
      <div className="flex-1 flex gap-5 p-5 max-w-[1600px] w-full mx-auto box-border">
        {/* Sidebar Sinh Viên */}
        <aside className="w-64 bg-white rounded-2xl border border-slate-200/80 p-4 shrink-0 flex flex-col justify-between shadow-xs select-none">
          <nav className="space-y-4">
            {/* Mục Trang chủ */}
            <div>
              <button
                type="button"
                onClick={() => handleTabClick('dashboard')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-50 text-blue-600 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Home className="w-4 h-4 shrink-0 text-slate-500" />
                <span>Trang chủ</span>
              </button>
            </div>

            {/* Mục QUẢN LÝ PHÒNG */}
            <div>
              <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase px-3 mb-1.5">
                QUẢN LÝ PHÒNG
              </div>
              <div className="space-y-1">
                {navItems
                  .filter((item) => item.section === 'room')
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleTabClick(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition text-left cursor-pointer ${
                          isActive
                            ? 'bg-[#e0f2fe] text-[#0284c7] font-bold shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-[#0284c7]' : 'text-slate-400'
                          }`}
                        />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Mục TÀI CHÍNH */}
            <div>
              <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase px-3 mb-1.5">
                TÀI CHÍNH
              </div>
              <div className="space-y-1">
                {navItems
                  .filter((item) => item.section === 'finance')
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleTabClick(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition text-left cursor-pointer ${
                          isActive
                            ? 'bg-[#e0f2fe] text-[#0284c7] font-bold'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0 text-slate-400" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Mục CÁ NHÂN */}
            <div>
              <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase px-3 mb-1.5">
                CÁ NHÂN
              </div>
              <div className="space-y-1">
                {navItems
                  .filter((item) => item.section === 'personal')
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleTabClick(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition text-left cursor-pointer ${
                          isActive
                            ? 'bg-[#e0f2fe] text-[#0284c7] font-bold'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0 text-slate-400" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Mục HỆ THỐNG */}
            <div>
              <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase px-3 mb-1.5">
                HỆ THỐNG
              </div>
              <div className="space-y-1">
                {navItems
                  .filter((item) => item.section === 'system')
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleTabClick(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition text-left cursor-pointer ${
                          isActive
                            ? 'bg-[#e0f2fe] text-[#0284c7] font-bold'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0 text-slate-400" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}

                {/* Đăng xuất */}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Bạn có chắc chắn muốn đăng xuất không?')) {
                      localStorage.clear();
                      window.location.href = '/';
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition text-left cursor-pointer"
                >
                  <LogOut className="w-4 h-4 shrink-0 text-slate-400 hover:text-red-500" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          </nav>
        </aside>

        {/* Khung nội dung chính */}
        <main className="flex-1 min-w-0 flex flex-col">
          {children}
        </main>
      </div>

      {/* 3. Nút nổi Chatbot AI ở góc dưới bên phải theo đúng thiết kế Ảnh 2 */}
      <div className="fixed bottom-6 right-8 z-50">
        <button
          type="button"
          onClick={() => setShowChatbotModal(!showChatbotModal)}
          className="relative group flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95 focus:outline-none"
          title="Trợ lý AI KTX"
        >
          {/* Avatar Robot Công nghệ */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 via-sky-500 to-indigo-400 p-0.5 shadow-xl shadow-blue-500/30 flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden relative">
              {/* Cute Robot Face SVG */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-b from-blue-50 to-blue-100 flex items-center justify-center relative shadow-inner">
                {/* Robot Eyes & Smile */}
                <div className="w-7 h-4 bg-blue-600 rounded-full flex items-center justify-around px-1 relative">
                  <div className="w-1.5 h-1.5 bg-cyan-300 rounded-full animate-pulse"></div>
                  <div className="w-1.5 h-1.5 bg-cyan-300 rounded-full animate-pulse"></div>
                </div>
                {/* Robot Antennas */}
                <div className="absolute -top-1 w-2 h-1 bg-sky-400 rounded-t-sm"></div>
              </div>
            </div>
          </div>

          {/* Chấm tròn xanh lá cây online góc dưới bên phải */}
          <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></span>
        </button>

        {/* Khung Chat AI dạng Popup */}
        {showChatbotModal && (
          <div className="absolute bottom-16 right-0 w-84 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Chatbot Header */}
            <div className="bg-gradient-to-r from-blue-600 to-sky-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-cyan-200" />
                </div>
                <div>
                  <h4 className="text-sm font-bold leading-tight">Trợ lý AI KTX</h4>
                  <p className="text-[11px] text-blue-100">Luôn sẵn sàng hỗ trợ 24/7</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChatbotModal(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Messages Body */}
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto bg-slate-50 text-xs">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-blue-600 text-white rounded-br-xs'
                        : 'bg-white text-slate-800 border border-slate-200/80 shadow-2xs rounded-bl-xs'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex gap-2">
              <input
                type="text"
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                placeholder="Hỏi AI về đăng ký phòng, thủ tục..."
                className="flex-1 text-xs px-3 py-2 bg-slate-100 rounded-full border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
