import React, { useState, useEffect, useCallback } from 'react';
import Login from './pages/Login';
import LandingPage from './pages/public/LandingPage';
import AdminLayout from './layouts/Admin';
import StudentLayout from './layouts/Student';
import AccountantLayout from './layouts/Accountant';
import RoomManagement from './pages/admin/RoomManagement';
import StudentManagement from './pages/admin/StudentManagement';
import IncidentManagement from './pages/admin/IncidentManagement';
import ViolationManagement from './pages/admin/ViolationManagement';
import ProcessRegistrationPage from './pages/admin/ProcessRegistrationPage';
import ProcessTransferPage from './pages/admin/ProcessTransferPage';
import ProcessCheckoutPage from './pages/admin/ProcessCheckoutPage';
import RoomRegistrationPage from './pages/student/RoomRegistrationPage';
import RoomTransferPage from './pages/student/RoomTransferPage';
import RequestHistoryPage from './pages/student/RequestHistoryPage';
import FeedbackPage from './pages/student/FeedbackPage';
import StudentDashboard from './pages/student/StudentDashboard';
import TransactionReconciliation from './pages/accountant/TransactionReconciliation';
import PeriodicBilling from './pages/accountant/PeriodicBilling';
import DebtLedger from './pages/accountant/DebtLedger';
import occupancyService from './services/occupancyService';
import { API_BASE_URL } from './services/authService';
import StudentProfilePage from "./pages/student/StudentProfilePage";
import RoomSearchPage from "./pages/student/RoomSearchPage";
import PaymentPage from "./pages/student/PaymentPage";
import PaymentHistoryPage from "./pages/student/PaymentHistoryPage";
import Dashboard from "./pages/admin/Dashboard";
import {
  Clock,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Plus,
  FileCheck,
  RefreshCw,
  Home,
  Calculator,
} from "lucide-react";

export default function App() {
  const [currentPath, setCurrentPath] = useState(
    (window.location.pathname || "/").split("?")[0],
  );

  const [adminActiveTab, setAdminActiveTab] = useState("dashboard");
  const [adminSearchTerm, setAdminSearchTerm] = useState("");

  const [accountantActiveMenu, setAccountantActiveMenu] =
    useState("reconciliation");
  const [accountantSearchTerm, setAccountantSearchTerm] = useState("");

  const [requestsList, setRequestsList] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [addStudentRequestKey, setAddStudentRequestKey] = useState(0);

  // Thông tin phòng hiện tại cho Student
  const [currentRoomInfo, setCurrentRoomInfo] = useState({
    phong_hien_tai: "P36 – Tòa A2 – Tầng 3",
    thanh_vien: "6/8 người",
    thoi_gian_luu_tru: "09/2025 – Nay",
    so_phong: "P36",
  });

  const loadRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    try {
      if (occupancyService?.getAllRequests) {
        const data = await occupancyService.getAllRequests();
        setRequestsList(data || []);
      }
    } catch (err) {
      console.error("Error loading requests:", err);
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  const loadRoomInfo = useCallback(async () => {
    try {
      if (occupancyService?.getCurrentRoomInfo) {
        const info = await occupancyService.getCurrentRoomInfo();
        if (info) setCurrentRoomInfo(info);
      }
    } catch (e) {
      console.error("Error loading current room info:", e);
    }
  }, []);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath((window.location.pathname || "/").split("?")[0]);
    };

    const handleCustomNavigate = (e) => {
      if (e.detail?.path) {
        navigateTo(e.detail.path);
      }
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("student-navigate", handleCustomNavigate);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("student-navigate", handleCustomNavigate);
    };
  }, []);

  useEffect(() => {
    if (currentPath === '/admin/violations' || currentPath === '/violations') {
      setAdminActiveTab('violations');
    }
  }, [currentPath]);

  useEffect(() => {
    loadRequests();
    loadRoomInfo();

    const handleUpdate = () => {
      loadRequests();
      loadRoomInfo();
    };
    window.addEventListener("occupancy-updated", handleUpdate);
    return () => {
      window.removeEventListener("occupancy-updated", handleUpdate);
    };
  }, [currentPath, adminActiveTab, loadRequests, loadRoomInfo]);

  const navigateTo = (path) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path.split("?")[0]);
  };

  const handleStudentTabSelect = (tabId) => {
    switch (tabId) {
      case "home":
      case "dashboard":
        navigateTo("/student/dashboard");
        break;
      case "register":
      case "dang-ky":
        navigateTo("/student/register");
        break;
      case "transfer":
      case "chuyen-phong":
        navigateTo("/student/transfer-room");
        break;
      case "lookup":
      case "tra-cuu":
      case "search-rooms":
      case "search-room":
        navigateTo("/student/lookup");
        break;
      case "history":
      case "lich-su":
        navigateTo("/student/history");
        break;
      case "feedback":
      case "phan-anh":
        navigateTo("/student/feedback");
        break;
      case "payment":
        navigateTo("/student/payment");
        break;
      case "payment_history":
        navigateTo("/student/payment-history");
        break;
      case "profile":
      case "thong-tin-ca-nhan":
        navigateTo("/student/profile");
        break;
      default:
        break;
    }
  };

  const handleAccountantMenuChange = (menuKey) => {
    setAccountantActiveMenu(menuKey);
    if (menuKey === "reconciliation") {
      navigateTo("/doi-soat");
    } else if (menuKey === "billing") {
      navigateTo("/lap-hoa-don");
    } else if (menuKey === "debt-book") {
      navigateTo("/so-cong-no");
    }
  };

  // 0a. Trang chủ công khai (Landing Page theo Figma)
  if (
    currentPath === "/" ||
    currentPath === "/home" ||
    currentPath === "/landing"
  ) {
    return <LandingPage onNavigate={navigateTo} />;
  }

  // 0b. Trang đăng nhập
  if (currentPath === "/login" || currentPath === "/auth") {
    return (
      <main className="w-full min-h-screen flex items-center justify-center bg-slate-100">
        <Login
          initialTab="login"
          onTabChange={(tab) => {
            window.history.replaceState(
              {},
              "",
              tab === "register" ? "/register" : "/login",
            );
          }}
          onLoginSuccess={(role) => {
            if (role === "KeToan") {
              navigateTo("/doi-soat");
            } else if (role === "Admin") {
              navigateTo("/admin");
            } else {
              navigateTo("/student/dashboard");
            }
          }}
        />
      </main>
    );
  }

  // 0c. Trang đăng ký tài khoản
  if (currentPath === "/register" || currentPath === "/signup") {
    return (
      <main className="w-full min-h-screen flex items-center justify-center bg-slate-100">
        <Login
          initialTab="register"
          onTabChange={(tab) => {
            window.history.replaceState(
              {},
              "",
              tab === "register" ? "/register" : "/login",
            );
          }}
          onLoginSuccess={() => navigateTo("/student/dashboard")}
        />
      </main>
    );
  }

  // =========================================================================
  // PHÂN HỆ KẾ TOÁN (Accountant)
  // =========================================================================
  if (
    currentPath === "/doi-soat" ||
    currentPath === "/accountant/reconciliation" ||
    currentPath === "/reconciliation"
  ) {
    return (
      <div className="relative">
        <AccountantLayout
          user={{ username: "KT_Hoa", role: "KeToan" }}
          onLogout={() => navigateTo("/login")}
          activeMenu="reconciliation"
          onMenuChange={handleAccountantMenuChange}
          searchTerm={accountantSearchTerm}
          onSearchChange={setAccountantSearchTerm}
        >
          <TransactionReconciliation searchTerm={accountantSearchTerm} />
        </AccountantLayout>
        <RoleSwitcher currentRole="accountant" onSwitchRole={navigateTo} />
      </div>
    );
  }

  if (
    currentPath === "/lap-hoa-don" ||
    currentPath === "/accountant/billing" ||
    currentPath === "/billing"
  ) {
    return (
      <div className="relative">
        <AccountantLayout
          user={{ username: "KT_Hoa", role: "KeToan" }}
          onLogout={() => navigateTo("/login")}
          activeMenu="billing"
          onMenuChange={handleAccountantMenuChange}
          searchTerm={accountantSearchTerm}
          onSearchChange={setAccountantSearchTerm}
        >
          <PeriodicBilling searchTerm={accountantSearchTerm} />
        </AccountantLayout>
        <RoleSwitcher currentRole="accountant" onSwitchRole={navigateTo} />
      </div>
    );
  }

  if (
    currentPath === "/so-cong-no" ||
    currentPath === "/accountant/debt" ||
    currentPath === "/debt"
  ) {
    return (
      <div className="relative">
        <AccountantLayout
          user={{ username: "KT_Hoa", role: "KeToan" }}
          onLogout={() => navigateTo("/login")}
          activeMenu="debt-book"
          onMenuChange={handleAccountantMenuChange}
          searchTerm={accountantSearchTerm}
          onSearchChange={setAccountantSearchTerm}
        >
          <DebtLedger searchTerm={accountantSearchTerm} />
        </AccountantLayout>
        <RoleSwitcher currentRole="accountant" onSwitchRole={navigateTo} />
      </div>
    );
  }

  // =========================================================================
  // PHÂN HỆ ADMIN: XỬ LÝ CHI TIẾT ĐƠN YÊU CẦU
  // =========================================================================

  // 1a. Xử lý yêu cầu đăng ký phòng
  if (currentPath.startsWith("/admin/requests/registration")) {
    const match = currentPath.match(/\/admin\/requests\/registration\/?(.*)/);
    const requestId = match && match[1] ? match[1] : "DK-001";

    return (
      <div className="relative">
        <ProcessRegistrationPage
          requestId={requestId}
          onBack={() => {
            loadRequests();
            navigateTo("/admin");
          }}
          onProcessed={() => {
            loadRequests();
            navigateTo("/admin");
          }}
        />
        <RoleSwitcher
          currentRole="admin"
          onSwitchRole={(r) =>
            navigateTo(
              r === "admin"
                ? "/admin"
                : r === "student"
                  ? "/student/dashboard"
                  : "/doi-soat",
            )
          }
        />
      </div>
    );
  }

  // 1b. Xử lý yêu cầu chuyển phòng
  if (currentPath.startsWith("/admin/requests/transfer")) {
    const match = currentPath.match(/\/admin\/requests\/transfer\/?(.*)/);
    const requestId = match && match[1] ? match[1] : "YC-0231";

    return (
      <div className="relative">
        <ProcessTransferPage
          requestId={requestId}
          onBack={() => {
            loadRequests();
            navigateTo("/admin");
          }}
          onProcessed={() => {
            loadRequests();
            navigateTo("/admin");
          }}
        />
        <RoleSwitcher
          currentRole="admin"
          onSwitchRole={(r) =>
            navigateTo(
              r === "admin"
                ? "/admin"
                : r === "student"
                  ? "/student/dashboard"
                  : "/doi-soat",
            )
          }
        />
      </div>
    );
  }

  // 1c. Xử lý yêu cầu trả phòng
  if (currentPath.startsWith("/admin/requests/checkout")) {
    const match = currentPath.match(/\/admin\/requests\/checkout\/?(.*)/);
    const requestId = match && match[1] ? match[1] : "YC-0232";

    return (
      <div className="relative">
        <ProcessCheckoutPage
          requestId={requestId}
          onBack={() => {
            loadRequests();
            navigateTo("/admin");
          }}
          onProcessed={() => {
            loadRequests();
            navigateTo("/admin");
          }}
        />
        <RoleSwitcher
          currentRole="admin"
          onSwitchRole={(r) =>
            navigateTo(
              r === "admin"
                ? "/admin"
                : r === "student"
                  ? "/student/dashboard"
                  : "/doi-soat",
            )
          }
        />
      </div>
    );
  }

  // =========================================================================
  // PHÂN HỆ SINH VIÊN (Student)
  // =========================================================================

  // 1. Lịch sử thanh toán
  if (currentPath === "/student/payment-history") {
    return (
      <div className="relative">
        <PaymentHistoryPage
          onSelectTab={handleStudentTabSelect}
          onNavigate={navigateTo}
        />
        <RoleSwitcher
          currentRole="student"
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(
              r === "admin"
                ? "/admin"
                : r === "student"
                  ? "/student/dashboard"
                  : "/doi-soat",
            );
          }}
        />
      </div>
    );
  }

  // 2. Thanh toán phí KTX
  if (currentPath === "/student/payment") {
    return (
      <div className="relative">
        <PaymentPage
          onSelectTab={handleStudentTabSelect}
          onNavigate={navigateTo}
        />
        <RoleSwitcher
          currentRole="student"
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(
              r === "admin"
                ? "/admin"
                : r === "student"
                  ? "/student/dashboard"
                  : "/doi-soat",
            );
          }}
        />
      </div>
    );
  }

  // 2. Đăng ký ở mới
  if (
    currentPath === "/student/register" ||
    currentPath === "/student/register-room" ||
    currentPath === "/student/room-registration"
  ) {
    return (
      <div className="relative">
        <RoomRegistrationPage
          onNavigateHistory={() => {
            loadRequests();
            navigateTo("/student/history?tab=registration");
          }}
          onNavigateDashboard={() => navigateTo("/student/dashboard")}
          onSelectTab={handleStudentTabSelect}
          onNavigate={navigateTo}
        />
        <RoleSwitcher
          currentRole="student"
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(
              r === "admin"
                ? "/admin"
                : r === "student"
                  ? "/student/dashboard"
                  : "/doi-soat",
            );
          }}
        />
      </div>
    );
  }

  // 3. Chuyển / Trả phòng
  if (
    currentPath === "/student/transfer-room" ||
    currentPath === "/student/transfer"
  ) {
    return (
      <div className="relative">
        <RoomTransferPage
          onSelectTab={handleStudentTabSelect}
          onNavigate={navigateTo}
        />
        <RoleSwitcher
          currentRole="student"
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(
              r === "admin"
                ? "/admin"
                : r === "student"
                  ? "/student/dashboard"
                  : "/doi-soat",
            );
          }}
        />
      </div>
    );
  }

  // 3b. Tra cứu phòng (Room Lookup / Search theo chuẩn Figma)
  if (
    currentPath === "/student/lookup" ||
    currentPath === "/student/search-rooms" ||
    currentPath === "/student/tra-cuu"
  ) {
    return (
      <div className="relative">
        <RoomSearchPage
          onSelectTab={handleStudentTabSelect}
          onNavigate={navigateTo}
        />
        <RoleSwitcher
          currentRole="student"
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(
              r === "admin"
                ? "/admin"
                : r === "student"
                  ? "/student/dashboard"
                  : "/doi-soat",
            );
          }}
        />
      </div>
    );
  }

  // 4. Lịch sử đăng ký & ở
  if (currentPath === "/student/history") {
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get("tab") || "registration";

    return (
      <div className="relative">
        <RequestHistoryPage
          initialTab={initialTab}
          onSelectTab={handleStudentTabSelect}
          onNavigate={navigateTo}
        />
        <RoleSwitcher
          currentRole="student"
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(
              r === "admin"
                ? "/admin"
                : r === "student"
                  ? "/student/dashboard"
                  : "/doi-soat",
            );
          }}
        />
      </div>
    );
  }

  // 5. Gửi phản ánh / Báo hỏng sự cố
  if (currentPath === "/student/feedback") {
    return (
      <div className="relative">
        <FeedbackPage
          onNavigateDashboard={() => navigateTo("/student/dashboard")}
          onNavigateRegister={() => navigateTo("/student/register")}
          onNavigateHistory={() => navigateTo("/student/history")}
          onNavigateProfile={() => navigateTo("/student/profile")}
          onSelectTab={handleStudentTabSelect}
          onNavigate={navigateTo}
          onLogout={() => navigateTo("/login")}
        />
        <RoleSwitcher
          currentRole="student"
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(
              r === "admin"
                ? "/admin"
                : r === "student"
                  ? "/student/dashboard"
                  : "/doi-soat",
            );
          }}
        />
      </div>
    );
  }

  // 5b. Thông tin cá nhân Sinh viên
  if (
    currentPath === "/student/profile" ||
    currentPath === "/student/thong-tin-ca-nhan"
  ) {
    return (
      <div className="relative">
        <StudentProfilePage
          onSelectTab={handleStudentTabSelect}
          onNavigate={navigateTo}
        />
        <RoleSwitcher
          currentRole="student"
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(
              r === "admin"
                ? "/admin"
                : r === "student"
                  ? "/student/dashboard"
                  : "/doi-soat",
            );
          }}
        />
      </div>
    );
  }

  // 6. Trang chủ Sinh viên (Dashboard)
  if (currentPath === "/student/dashboard" || currentPath === "/student") {
    const studentName =
      localStorage.getItem("ktx_fullname") ||
      localStorage.getItem("ktx_username") ||
      "Nguyễn Văn A";

    return (
      <div className="relative">
        <StudentLayout
          activeTab="dashboard"
          onSelectTab={handleStudentTabSelect}
          userName={studentName}
          userRole="Sinh viên"
        >
          <StudentDashboard
            user={{
              ho_ten: studentName,
              username: localStorage.getItem("ktx_username") || "DTC245180051",
            }}
            onNavigate={navigateTo}
          />
        </StudentLayout>
        <RoleSwitcher
          currentRole="student"
          onSwitchRole={(r) => {
            loadRequests();
            navigateTo(
              r === "admin"
                ? "/admin"
                : r === "student"
                  ? "/student/dashboard"
                  : "/doi-soat",
            );
          }}
        />
      </div>
    );
  }

  // =========================================================================
  // PHÂN HỆ BAN QUẢN LÝ (Admin)
  // =========================================================================
  return (
    <div className="relative">
      <AdminLayout
        activeTab={adminActiveTab}
        onSelectTab={setAdminActiveTab}
        searchTerm={adminSearchTerm}
        onSearchChange={setAdminSearchTerm}
        userName="QL_Minh"
      >
        {adminActiveTab === "dashboard" && (
          <Dashboard
            requests={requestsList}
            isLoadingRequests={isLoadingRequests}
            onRefresh={loadRequests}
            searchTerm={adminSearchTerm}
            onOpenRequest={navigateTo}
            onAddStudent={() => {
              setAdminActiveTab("students");
              setAddStudentRequestKey((key) => key + 1);
            }}
            onRejectRequest={async (request) => {
              const reason = window.prompt("Nhập lý do từ chối yêu cầu:");
              if (reason === null) return;
              const id = String(request.id || request.ma_yeu_cau || "").replace(/^#/, "");
              const type = String(request.loai_don || request.loai_yeu_cau || "").toLocaleLowerCase("vi");
              const payload = { ly_do_tu_choi: reason.trim() || "Không đáp ứng điều kiện xét duyệt" };
              if (type.includes("chuy") || type.includes("transfer")) {
                await occupancyService.rejectTransferRequest(id, payload);
              } else if (type.includes("trả") || type.includes("tra") || type.includes("checkout")) {
                await occupancyService.rejectCheckoutRequest(id, payload);
              } else {
                await occupancyService.rejectRequest(id, payload);
              }
              await loadRequests();
            }}
          />
        )}
        {adminActiveTab === "rooms" && (
          <RoomManagement searchTerm={adminSearchTerm} />
        )}

        {adminActiveTab === "students" && (
          <StudentManagement
            searchTerm={adminSearchTerm}
            openAddRequest={addStudentRequestKey}
          />
        )}

        {adminActiveTab === "incidents" && (
          <IncidentManagement searchTerm={adminSearchTerm} />
        )}

        {adminActiveTab === 'violations' && (
          <ViolationManagement searchTerm={adminSearchTerm} />
        )}

        {adminActiveTab !== 'dashboard' &&
          adminActiveTab !== 'rooms' &&
          adminActiveTab !== 'students' &&
          adminActiveTab !== 'incidents' &&
          adminActiveTab !== 'violations' && (
            <div className="p-8 text-center text-slate-400 mt-20">
              <h2 className="text-xl font-bold text-slate-600 mb-2">
                Trang đang được xây dựng
              </h2>
              <p className="text-sm">
                Vui lòng chọn tab trên thanh menu bên trái.
              </p>
            </div>
          )}
      </AdminLayout>
      <RoleSwitcher
        currentRole="admin"
        onSwitchRole={(r) => {
          loadRequests();
          navigateTo(
            r === "admin"
              ? "/admin"
              : r === "student"
                ? "/student/dashboard"
                : "/doi-soat",
          );
        }}
      />
    </div>
  );
}

function RoleSwitcher({ currentRole, onSwitchRole }) {
  const handleRoleClick = (r) => {
    if (r === "home") {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
      return;
    }
    if (onSwitchRole) {
      if (r === "admin") onSwitchRole("/admin");
      else if (r === "student") onSwitchRole("/student/dashboard");
      else if (r === "accountant") onSwitchRole("/doi-soat");
      else onSwitchRole(r);
    }
  };

  return (
    <div className="fixed top-3 right-64 z-50 flex items-center bg-white/90 backdrop-blur-md border border-slate-200 p-1 rounded-full shadow-lg text-xs font-semibold gap-1">
      <button
        type="button"
        onClick={() => handleRoleClick("home")}
        className="px-3 py-1.5 rounded-full transition flex items-center gap-1.5 cursor-pointer text-slate-600 hover:text-blue-600 hover:bg-slate-100"
        title="Về Trang chủ công khai"
      >
        <Home className="w-3.5 h-3.5" />
        <span>Trang chủ</span>
      </button>

      <button
        type="button"
        onClick={() => handleRoleClick("admin")}
        className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 cursor-pointer ${
          currentRole === "admin"
            ? "bg-slate-900 text-white shadow-xs"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Admin</span>
      </button>

      <button
        type="button"
        onClick={() => handleRoleClick("student")}
        className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 cursor-pointer ${
          currentRole === "student"
            ? "bg-blue-600 text-white shadow-xs"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
      >
        <UserCheck className="w-3.5 h-3.5" />
        <span>Sinh viên</span>
      </button>

      <button
        type="button"
        onClick={() => handleRoleClick("accountant")}
        className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 cursor-pointer ${
          currentRole === "accountant"
            ? "bg-emerald-600 text-white shadow-xs"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`}
      >
        <Calculator className="w-3.5 h-3.5" />
        <span>Kế toán</span>
      </button>
    </div>
  );
}
