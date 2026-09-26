const API_BASE_URL = 'http://localhost:8000/api/v1';

/**
 * Service gọi API quản lý Hóa đơn định kỳ dành cho Kế toán (KeToan)
 */
export const invoiceService = {
  /**
   * Helper lấy header chứa Bearer Token
   */
  getAuthHeaders() {
    const token = localStorage.getItem('ktx_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  },

  /**
   * Lấy danh sách đối tượng cần lập hóa đơn tiền phòng
   */
  async getRoomCandidates(academicYear = 'Năm học 2026 – 2027', stayDuration = 11, unitPrice = 600000, appliedTarget = 'Tất cả sinh viên còn hạn hợp đồng') {
    try {
      const params = new URLSearchParams({
        ky_thanh_toan: academicYear,
        thoi_gian_o_thang: stayDuration,
        don_gia_thang: unitPrice,
        ap_dung: appliedTarget,
      });

      const response = await fetch(`${API_BASE_URL}/invoices/room/candidates?${params.toString()}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Lỗi lấy danh sách đối tượng: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.warn('Lỗi gọi API getRoomCandidates, sử dụng dữ liệu dự phòng:', error);
      return null;
    }
  },

  /**
   * Phát hành hóa đơn tiền phòng
   */
  async publishRoomInvoices(payload) {
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/room/publish`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Phát hành hóa đơn tiền phòng thất bại');
      }

      return { success: true, data };
    } catch (error) {
      console.error('Lỗi publishRoomInvoices:', error);
      return { success: false, message: error.message };
    }
  },

  /**
   * Lấy danh sách phòng phục vụ lập hóa đơn tiền điện nước
   */
  async getUtilityCandidates(month = 'Tháng 09/2026') {
    try {
      const params = new URLSearchParams({
        thang: month,
      });

      const response = await fetch(`${API_BASE_URL}/invoices/utility/candidates?${params.toString()}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Lỗi lấy danh sách phòng: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.warn('Lỗi gọi API getUtilityCandidates, sử dụng dữ liệu dự phòng:', error);
      return null;
    }
  },

  /**
   * Phát hành hóa đơn tiền điện nước
   */
  async publishUtilityInvoices(payload) {
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/utility/publish`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Phát hành hóa đơn điện nước thất bại');
      }

      return { success: true, data };
    } catch (error) {
      console.error('Lỗi publishUtilityInvoices:', error);
      return { success: false, message: error.message };
    }
  },

  /**
   * Tra cứu danh sách hóa đơn đã lập
   */
  async getInvoices(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.loai_hoa_don) params.append('loai_hoa_don', filters.loai_hoa_don);
      if (filters.ky_thanh_toan) params.append('ky_thanh_toan', filters.ky_thanh_toan);
      if (filters.trang_thai) params.append('trang_thai', filters.trang_thai);

      const response = await fetch(`${API_BASE_URL}/invoices?${params.toString()}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Lỗi tra cứu hóa đơn: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Lỗi getInvoices:', error);
      return [];
    }
  },
};
