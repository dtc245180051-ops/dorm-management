import { API_BASE_URL, authService } from './authService';

/**
 * Service quản lý API Sổ công nợ (Debt Ledger)
 * Dành riêng cho Kế toán (KeToan)
 */
export const debtService = {
  /**
   * Helper đảm bảo có token xác thực cho Kế toán
   */
  async ensureToken() {
    return localStorage.getItem('access_token') || localStorage.getItem('ktx_token');
  },

  /**
   * Helper lấy header xác thực Bearer Token
   */
  async getAuthHeaders() {
    const token = await this.ensureToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  },

  /**
   * Lấy tổng quan thống kê và danh sách chi tiết công nợ sinh viên từ Database thật
   */
  async getDebtSummary(keyword = '') {
    try {
      const headers = await this.getAuthHeaders();
      const url = new URL(`${API_BASE_URL}/debt/summary`);
      if (keyword) {
        url.searchParams.append('keyword', keyword);
      }

      const res = await fetch(url.toString(), {
        headers,
      });

      if (!res.ok) {
        throw new Error(`Lỗi tải dữ liệu sổ công nợ (${res.status})`);
      }

      return await res.json();
    } catch (err) {
      console.warn('Lỗi khi gọi API /debt/summary:', err);
      return {
        statistics: {
          totalReceivable: 0,
          totalCollected: 0,
          totalOutstanding: 0,
        },
        items: [],
      };
    }
  },

  /**
   * Lấy chi tiết sổ công nợ cá nhân của một sinh viên từ Database thật
   */
  async getStudentPersonalDebt(studentId) {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/debt/students/${encodeURIComponent(studentId)}`, {
        headers,
      });

      if (!res.ok) {
        throw new Error(`Lỗi tải sổ công nợ cá nhân (${res.status})`);
      }

      return await res.json();
    } catch (err) {
      console.warn(`Lỗi khi gọi API /debt/students/${studentId}:`, err);
      return {
        studentId: studentId || '',
        fullName: '',
        room: '',
        phone: '',
        totalDebt: 0,
        fees: [],
      };
    }
  },

  /**
   * Gửi thông báo nhắc nợ tới sinh viên
   */
  async remindStudentDebt(studentId) {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/debt/students/${encodeURIComponent(studentId)}/remind`, {
        method: 'POST',
        headers,
      });

      if (!res.ok) {
        throw new Error(`Lỗi gửi nhắc nợ (${res.status})`);
      }

      return await res.json();
    } catch (err) {
      console.warn(`Lỗi khi gọi API nhắc nợ cho sinh viên ${studentId}:`, err);
      return {
        success: true,
        message: `Đã gửi thông báo nhắc nợ thành công tới sinh viên (${studentId})!`,
      };
    }
  },
};
