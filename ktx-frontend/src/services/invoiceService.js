const API_BASE_URL = 'http://localhost:8000/api/v1';

/**
 * Service gọi API quản lý Hóa đơn định kỳ dành cho Kế toán (KeToan)
 */
export const invoiceService = {
  /**
   * Helper đảm bảo có token xác thực cho Kế toán
   */
  async ensureToken() {
    let token = localStorage.getItem('ktx_token');
    if (!token) {
      try {
        const resp = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ username: 'KT_Hoa', password: 'password123' }),
        });
        const d = await resp.json();
        if (d.access_token) {
          token = d.access_token;
          localStorage.setItem('ktx_token', token);
          localStorage.setItem('ktx_user', JSON.stringify({ username: 'KT_Hoa', role: 'KeToan' }));
        }
      } catch (e) {
        console.error('Lỗi tự động xác thực KT_Hoa trong invoiceService:', e);
      }
    }
    return token;
  },

  /**
   * Helper lấy header chứa Bearer Token
   */
  async getAuthHeaders() {
    const token = await this.ensureToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  },

  /**
   * Lấy danh sách đối tượng cần lập hóa đơn tiền phòng theo tháng
   */
  async getRoomCandidates(month = 'Tháng 09/2026', stayDuration = 1, unitPrice = 350000, appliedTarget = 'Tất cả phòng (Tiêu chuẩn & Dịch vụ)') {
    try {
      const params = new URLSearchParams({
        ky_thanh_toan: month,
        thoi_gian_o_thang: stayDuration,
        don_gia_thang: unitPrice,
        ap_dung: appliedTarget,
      });

      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/invoices/room/candidates?${params.toString()}`, {
        method: 'GET',
        headers,
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
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/invoices/room/publish`, {
        method: 'POST',
        headers,
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

      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/invoices/utility/candidates?${params.toString()}`, {
        method: 'GET',
        headers,
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
   * Upload file Excel/CSV chỉ số điện nước để tự động tính toán
   */
  async uploadUtilityReadings(file, month = 'Tháng 09/2026', donGiaDien = 3000, donGiaNuoc = 15000) {
    try {
      const token = await this.ensureToken();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('thang', month);
      formData.append('don_gia_dien', donGiaDien);
      formData.append('don_gia_nuoc', donGiaNuoc);

      const response = await fetch(`${API_BASE_URL}/invoices/utility/upload-readings`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Không thể xử lý file chỉ số điện nước');
      }

      return { success: true, data };
    } catch (error) {
      console.error('Lỗi uploadUtilityReadings:', error);
      return { success: false, message: error.message };
    }
  },

  /**
   * Tải file Excel mẫu nhập chỉ số điện nước
   */
  async downloadUtilityTemplate() {
    try {
      const token = await this.ensureToken();
      const response = await fetch(`${API_BASE_URL}/invoices/utility/template`, {
        method: 'GET',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        throw new Error('Tải file mẫu thất bại');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Mau_nhap_chi_so_dien_nuoc_KTX.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      console.error('Lỗi downloadUtilityTemplate:', error);
      return false;
    }
  },

  /**
   * Phát hành hóa đơn tiền điện nước
   */
  async publishUtilityInvoices(payload) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/invoices/utility/publish`, {
        method: 'POST',
        headers,
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

      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/invoices?${params.toString()}`, {
        method: 'GET',
        headers,
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
