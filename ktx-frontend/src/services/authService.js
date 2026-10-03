export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

/**
 * Service gọi API xác thực (Authentication) cho KTX ICTU
 */
export const authService = {
  /**
   * Đăng nhập hệ thống
   * @param {string} identifier - Email, số điện thoại hoặc tên đăng nhập
   * @param {string} password - Mật khẩu
   */
  async login(identifier, password) {
    try {
      const formData = new URLSearchParams();
      formData.append("username", identifier.trim());
      formData.append("password", password);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Đăng nhập không thành công");
      }

      // Lưu trữ token và thông tin phiên đăng nhập
      if (data.access_token) {
        const prevUser = localStorage.getItem("ktx_username");
        if (prevUser && prevUser.toLowerCase() !== String(data.username || "").toLowerCase()) {
          localStorage.removeItem("ktx_student_account");
          localStorage.removeItem("dorm_registration_requests");
          localStorage.removeItem("dorm_current_room_info");
          localStorage.removeItem("ktx_payment_2026_09_status");
        }
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("ktx_token", data.access_token);
        localStorage.setItem("ktx_user_role", data.role);
        localStorage.setItem("user_role", data.role);
        localStorage.setItem("ktx_username", data.username);
        localStorage.setItem("user_name", data.username);
        if (data.full_name) {
          localStorage.setItem("ktx_fullname", data.full_name);
        }
        const email = identifier.trim();
        if (/^[^\s@]+@ictu\.edu\.vn$/i.test(email)) {
          localStorage.setItem("ktx_email", email);
        }
      }

      return { success: true, data };
    } catch (error) {
      console.error("Lỗi đăng nhập:", error);
      return {
        success: false,
        message:
          error.message ||
          "Không thể kết nối đến máy chủ backend (http://localhost:8000)",
      };
    }
  },

  /**
   * Đăng ký tài khoản Sinh viên mới
   * @param {Object} registerData
   */
  async register({ fullName, email, password }) {
    try {
      const emailVal = (email || "").trim();
      if (!emailVal.includes("@")) {
        throw new Error("Email không hợp lệ. Vui lòng nhập đúng email trường (@ictu.edu.vn).");
      }
      const prefix = emailVal.split("@")[0].trim();
      if (!prefix) {
        throw new Error("Phần tên người dùng trước ký tự '@' không được để trống.");
      }

      const username = prefix.toLowerCase();
      const msv = username.toUpperCase();

      const payload = {
        ten_dang_nhap: username,
        msv: msv,
        ho_ten: fullName.trim(),
        email: emailVal,
        mat_khau: password,
        // Các trường tương thích chuẩn schema
        username: username,
        password: password,
        full_name: fullName.trim(),
        role: "SinhVien",
      };

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Đăng ký không thành công");
      }

      return { success: true, data, username, msv };
    } catch (error) {
      console.error("Lỗi đăng ký:", error);
      return {
        success: false,
        message:
          error.message ||
          "Không thể kết nối đến máy chủ backend (http://localhost:8000)",
      };
    }
  },

  /**
   * Đăng nhập hoặc Đăng ký bằng Google (Chỉ chấp nhận email @ictu.edu.vn)
   * @param {Object} googleUser - { email, fullName, avatarUrl, googleId }
   */
  async loginWithGoogle({ email, fullName, avatarUrl, googleId }) {
    try {
      const emailVal = (email || "").trim().toLowerCase();
      if (!emailVal.endsWith("@ictu.edu.vn")) {
        throw new Error("Chỉ chấp nhận tài khoản Google có định dạng email trường (@ictu.edu.vn)");
      }

      const response = await fetch(`${API_BASE_URL}/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: emailVal,
          full_name: fullName || emailVal.split("@")[0],
          avatar_url: avatarUrl || "",
          google_id: googleId || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Đăng nhập Google thất bại");
      }

      // Lưu trữ phiên đăng nhập tương tự login thường
      if (data.access_token) {
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("ktx_token", data.access_token);
        localStorage.setItem("ktx_user_role", data.role);
        localStorage.setItem("user_role", data.role);
        localStorage.setItem("ktx_username", data.username);
        localStorage.setItem("user_name", data.username);
        if (data.full_name) {
          localStorage.setItem("ktx_fullname", data.full_name);
        }
        localStorage.setItem("ktx_email", emailVal);
        localStorage.setItem("ktx_msv", emailVal.split("@")[0].toUpperCase());
      }

      return { success: true, data };
    } catch (error) {
      console.error("Lỗi loginWithGoogle:", error);
      return {
        success: false,
        message: error.message || "Không thể xác thực với tài khoản Google",
      };
    }
  },

  /**
   * Lấy thông tin tài khoản hiện tại từ Token
   */
  async getCurrentUser() {
    const token = localStorage.getItem("ktx_token");
    if (!token) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        this.logout();
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error("Lỗi lấy thông tin người dùng:", error);
      return null;
    }
  },

  /**
   * Lấy token hiện tại từ localStorage
   */
  getToken() {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("ktx_token")
    );
  },

  /**
   * Đăng xuất
   */
  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("ktx_token");
    localStorage.removeItem("ktx_user_role");
    localStorage.removeItem("user_role");
    localStorage.removeItem("ktx_username");
    localStorage.removeItem("user_name");
    localStorage.removeItem("ktx_fullname");
  },
};
