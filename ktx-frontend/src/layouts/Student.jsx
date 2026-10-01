import React, { useEffect, useState } from "react";
import {
  Home,
  FileEdit,
  ArrowLeftRight,
  Search,
  Clock,
  FileText,
  CreditCard,
  User,
  LogOut,
  Bell,
  MessageSquare,
  Sparkles,
  X,
  Send,
  Menu,
} from "lucide-react";
import { askGeminiChatbot } from "../services/geminiService";

const STUDENT_AVATAR_STORAGE_KEY = "ktx_student_avatar";

export default function StudentLayout({
  children,
  activeTab = "register",
  onSelectTab,
  searchTerm = "",
  onSearchChange,
  userName,
  userRole = "Sinh viên",
}) {
  const displayUserName =
    userName ||
    localStorage.getItem("ktx_fullname") ||
    localStorage.getItem("ktx_username") ||
    "Sinh viên";
  const [showChatbotModal, setShowChatbotModal] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(
    () => localStorage.getItem(STUDENT_AVATAR_STORAGE_KEY) || "",
  );
  const [chatMessages, setChatMessages] = useState([
    {
      sender: "bot",
      text: `Xin chào ${displayUserName}! Mình là Trợ lý AI KTX. Bạn cần hỗ trợ gì về đăng ký phòng, thủ tục hay nội quy KTX không?`,
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [isChatbotResponding, setIsChatbotResponding] = useState(false);

  useEffect(() => {
    const syncAvatar = (event) => {
      setAvatarUrl(
        event.detail?.avatarUrl ||
          localStorage.getItem(STUDENT_AVATAR_STORAGE_KEY) ||
          "",
      );
    };
    window.addEventListener("student-avatar-updated", syncAvatar);
    window.addEventListener("storage", syncAvatar);
    return () => {
      window.removeEventListener("student-avatar-updated", syncAvatar);
      window.removeEventListener("storage", syncAvatar);
    };
  }, []);

  useEffect(() => {
    const openChatbot = (event) => {
      setInputQuestion(event.detail?.topic || "");
      setShowChatbotModal(true);
    };

    window.addEventListener("student-open-chatbot", openChatbot);
    return () =>
      window.removeEventListener("student-open-chatbot", openChatbot);
  }, []);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputQuestion.trim() || isChatbotResponding) return;

    const userText = inputQuestion.trim();
    const conversationHistory = chatMessages.map((message) => ({
      role: message.sender === "user" ? "user" : "model",
      text: message.text,
    }));
    setChatMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setInputQuestion("");
    setIsChatbotResponding(true);
    try {
      const reply = await askGeminiChatbot(userText, conversationHistory);
      setChatMessages((prev) => [...prev, { sender: "bot", text: reply }]);
    } finally {
      setIsChatbotResponding(false);
    }
  };

  const navItems = [
    { id: "dashboard", label: "Trang chủ", icon: Home, section: "main" },
    {
      id: "register",
      label: "Đăng ký phòng",
      icon: FileEdit,
      section: "room",
      highlightLabel: "Đăng ký ở",
    },
    {
      id: "transfer",
      label: "Chuyển / trả phòng",
      icon: ArrowLeftRight,
      section: "room",
    },
    { id: "lookup", label: "Tra cứu phòng", icon: Search, section: "room" },
    { id: "history", label: "Lịch sử", icon: Clock, section: "room" },
    { id: "feedback", label: "Gửi phản ánh", icon: FileText, section: "room" },
    {
      id: "payment",
      label: "Thanh toán phí KTX",
      icon: CreditCard,
      section: "finance",
    },
    {
      id: "payment_history",
      label: "Lịch sử thanh toán",
      icon: Clock,
      section: "finance",
    },
    {
      id: "profile",
      label: "Thông tin cá nhân",
      icon: User,
      section: "personal",
    },
  ];

  const handleTabClick = (tabId) => {
    setShowMobileNav(false);
    if (onSelectTab) {
      onSelectTab(tabId);
      return;
    }
    const pathMap = {
      dashboard: "/student/dashboard",
      home: "/student/dashboard",
      register: "/student/register",
      "dang-ky": "/student/register",
      transfer: "/student/transfer-room",
      "chuyen-phong": "/student/transfer-room",
      lookup: "/student/lookup",
      "tra-cuu": "/student/lookup",
      "search-rooms": "/student/lookup",
      history: "/student/history",
      "lich-su": "/student/history",
      feedback: "/student/feedback",
      "phan-anh": "/student/feedback",
      payment: "/student/payment",
      payment_history: "/student/payment-history",
      profile: "/student/profile",
      "thong-tin-ca-nhan": "/student/profile",
    };
    const targetPath = pathMap[tabId];
    if (targetPath) {
      window.history.pushState({}, "", targetPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(
        new CustomEvent("student-navigate", { detail: { path: targetPath } }),
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#eef2f6] text-slate-800 font-sans flex flex-col antialiased selection:bg-blue-100 selection:text-blue-700">
      {/* 1. Header trên cùng theo chuẩn Figma */}
      <header className="h-20 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between gap-3 sm:gap-6 shrink-0 sticky top-0 z-40 shadow-sm">
        <button
          type="button"
          onClick={() => setShowMobileNav((isOpen) => !isOpen)}
          aria-label={showMobileNav ? "Đóng menu" : "Mở menu"}
          className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
        >
          {showMobileNav ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>

        {/* Logo KTX */}
        <div
          onClick={() => handleTabClick("dashboard")}
          className="flex items-center gap-3 cursor-pointer select-none group shrink-0"
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
            <span className="hidden sm:block text-[11px] font-medium text-slate-500 mt-1">
              Hệ thống ký túc xá
            </span>
          </div>
        </div>

        {/* Thanh tìm kiếm ở giữa */}
        <div className="hidden md:block flex-1 max-w-xl mx-4">
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
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
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
          <div
            onClick={() => handleTabClick("profile")}
            className="flex items-center gap-3 pl-2 border-l border-slate-200 cursor-pointer hover:opacity-85 transition select-none"
            title="Xem thông tin cá nhân"
          >
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shadow-sm border border-blue-200 overflow-hidden shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                  onError={() => {
                    localStorage.removeItem(STUDENT_AVATAR_STORAGE_KEY);
                    setAvatarUrl("");
                  }}
                />
              ) : (
                <User aria-hidden="true" className="h-5 w-5 text-blue-600" />
              )}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-sm font-bold text-slate-800 leading-tight">
                {displayUserName}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {userRole}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Phần thân gồm Sidebar bên trái và Content bên phải */}
      <div className="relative flex-1 flex gap-5 p-3 sm:p-5 max-w-[1600px] w-full mx-auto box-border min-w-0">
        {showMobileNav && (
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setShowMobileNav(false)}
            className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          />
        )}

        {/* Sidebar Sinh Viên */}
        <aside
          className={`${
            showMobileNav
              ? "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] overflow-y-auto shadow-xl"
              : "hidden"
          } lg:static lg:z-auto lg:flex lg:w-64 lg:max-w-none lg:overflow-visible bg-white rounded-2xl border border-slate-200/80 p-4 shrink-0 flex-col justify-between shadow-sm select-none`}
        >
          <div className="flex justify-end lg:hidden">
            <button
              type="button"
              onClick={() => setShowMobileNav(false)}
              aria-label="Đóng menu"
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="space-y-4">
            {/* Mục Trang chủ */}
            <div>
              <button
                type="button"
                onClick={() => handleTabClick("dashboard")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                  activeTab === "dashboard"
                    ? "bg-blue-50 text-blue-600 font-semibold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
                  .filter((item) => item.section === "room")
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
                            ? "bg-[#e0f2fe] text-[#0284c7] font-bold shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? "text-[#0284c7]" : "text-slate-400"
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
                  .filter((item) => item.section === "finance")
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
                            ? "bg-[#e0f2fe] text-[#0284c7] font-bold"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium"
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
                  .filter((item) => item.section === "personal")
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
                            ? "bg-[#e0f2fe] text-[#0284c7] font-bold"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium"
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
                  .filter((item) => item.section === "system")
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
                            ? "bg-[#e0f2fe] text-[#0284c7] font-bold"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium"
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
                    if (
                      window.confirm("Bạn có chắc chắn muốn đăng xuất không?")
                    ) {
                      localStorage.clear();
                      window.location.href = "/";
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
        <main className="flex-1 min-w-0 flex flex-col">{children}</main>
      </div>

      {/* 3. Nút nổi Chatbot AI ở góc dưới bên phải theo đúng thiết kế Ảnh 2 */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-8 z-40">
        <button
          type="button"
          onClick={() => setShowChatbotModal(!showChatbotModal)}
          className="relative group flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-105 active:scale-95 focus:outline-none"
          title="Trợ lý AI KTX"
        >
          {/* Avatar Robot Công nghệ */}
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden shadow-lg flex items-center justify-center">
            <img
              src="/chatbot.png"
              alt="Chatbot Avatar"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Chấm tròn xanh lá cây online góc dưới bên phải */}
          <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></span>
        </button>

        {/* Khung Chat AI dạng Popup */}
        {showChatbotModal && (
          <div className="absolute bottom-16 right-0 w-[calc(100vw-2rem)] max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Chatbot Header */}
            <div className="bg-gradient-to-r from-blue-600 to-sky-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-cyan-200" />
                </div>
                <div>
                  <h4 className="text-sm font-bold leading-tight">
                    Trợ lý AI KTX
                  </h4>
                  <p className="text-[11px] text-blue-100">
                    Luôn sẵn sàng hỗ trợ 24/7
                  </p>
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
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : "bg-white text-slate-800 border border-slate-200/80 shadow-sm rounded-bl-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-white border-t border-slate-200 flex gap-2"
            >
              <input
                type="text"
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                placeholder="Hỏi AI về đăng ký phòng, thủ tục..."
                disabled={isChatbotResponding}
                className="flex-1 text-xs px-3 py-2 bg-slate-100 rounded-full border border-transparent focus:border-blue-400 focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={isChatbotResponding || !inputQuestion.trim()}
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
