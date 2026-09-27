const API_BASE_URL = 'http://localhost:8000/api/v1';

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
      formData.append('username', identifier.trim());
      formData.append('password', password);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Đăng nhập không thành công');
      }

      // Lưu trữ token và thông tin phiên đăng nhập
      if (data.access_token) {
        localStorage.setItem('ktx_token', data.access_token);
        localStorage.setItem('ktx_user_role', data.role);
        localStorage.setItem('ktx_username', data.username);
      }

      return { success: true, data };
    } catch (error) {
      console.error('Lỗi đăng nhập:', error);
      return {
        success: false,
        message: error.message || 'Không thể kết nối đến máy chủ backend (http://localhost:8000)',
      };
    }
  },

  /**
   * Đăng ký tài khoản Sinh viên mới
   * @param {Object} registerData
   */
  async register({ fullName, gender, emailOrPhone, password }) {
    try {
      const isEmail = emailOrPhone.includes('@');
      const isPhone = /^[0-9+() -]+$/.test(emailOrPhone.trim());

      // Tạo username hợp lệ từ email/sđt
      let username = emailOrPhone.trim();
      if (isEmail) {
        username = emailOrPhone.split('@')[0];
      }

      const payload = {
        username: username,
        password: password,
        role: 'SinhVien',
        full_name: fullName.trim(),
        email: isEmail ? emailOrPhone.trim() : null,
        phone: isPhone && !isEmail ? emailOrPhone.trim() : null,
      };

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Đăng ký không thành công');
      }

      return { success: true, data };
    } catch (error) {
      console.error('Lỗi đăng ký:', error);
      return {
        success: false,
        message: error.message || 'Không thể kết nối đến máy chủ backend (http://localhost:8000)',
      };
    }
  },

  /**
   * Lấy thông tin tài khoản hiện tại từ Token
   */
  async getCurrentUser() {
    const token = localStorage.getItem('ktx_token');
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
      console.error('Lỗi lấy thông tin người dùng:', error);
      return null;
    }
  },

  /**
   * Đăng xuất
   */
  logout() {
    localStorage.removeItem('ktx_token');
    localStorage.removeItem('ktx_user_role');
    localStorage.removeItem('ktx_username');
  },
};
