const API_BASE_URL = 'http://localhost:8000/api/v1';

/**
 * Service gọi API Đối soát giao dịch ngân hàng dành cho Kế toán (KeToan)
 */
export const reconciliationService = {
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
        console.error('Lỗi tự động xác thực KT_Hoa:', e);
      }
    }
    return token;
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
   * Lấy danh sách giao dịch đối soát kèm bộ lọc và thống kê từ backend
   * @param {Object} queryParams - { dateFrom, dateTo, bank, status, keyword, page, pageSize, hasUploaded }
   */
  async getReconciliations({
    dateFrom = '',
    dateTo = '',
    bank = '',
    status = '',
    keyword = '',
    page = 1,
    pageSize = 5,
    hasUploaded = undefined,
  } = {}) {
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (bank && bank !== 'all') params.append('bank', bank);
      if (status && status !== 'ALL') params.append('status', status);
      if (keyword && keyword.trim()) params.append('keyword', keyword.trim());
      if (hasUploaded !== undefined) params.append('hasUploaded', hasUploaded);
      params.append('page', page);
      params.append('pageSize', pageSize);

      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/reconciliation?${params.toString()}`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          message: data.detail || `Lỗi lấy danh sách đối soát: ${response.status}`,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Lỗi getReconciliations:', error);
      return {
        success: false,
        status: 500,
        message: error.message || 'Không thể kết nối đến máy chủ backend (http://localhost:8000)',
      };
    }
  },

  /**
   * Xem chi tiết một giao dịch ngân hàng
   * @param {string|number} id
   */
  async getTransactionDetail(id) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/reconciliation/${id}`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          message: data.detail || `Lỗi xem chi tiết giao dịch: ${response.status}`,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Lỗi getTransactionDetail:', error);
      return {
        success: false,
        status: 500,
        message: error.message || 'Không thể kết nối đến máy chủ backend',
      };
    }
  },

  /**
   * Tìm kiếm sinh viên từ backend
   * @param {string} keyword
   */
  async searchStudents(keyword = '') {
    try {
      const params = new URLSearchParams();
      if (keyword && keyword.trim()) params.append('keyword', keyword.trim());
      params.append('limit', '20');

      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/reconciliation/students/search?${params.toString()}`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          message: data.detail || `Lỗi tìm kiếm sinh viên: ${response.status}`,
          data: [],
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Lỗi searchStudents:', error);
      return {
        success: false,
        status: 500,
        message: error.message || 'Không thể kết nối đến máy chủ backend',
        data: [],
      };
    }
  },

  /**
   * Lấy danh sách hóa đơn còn nợ của sinh viên từ backend
   * @param {string} studentId
   */
  async getStudentInvoices(studentId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/reconciliation/students/${encodeURIComponent(studentId)}/invoices`, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          message: data.detail || `Lỗi tải hóa đơn sinh viên: ${response.status}`,
          data: [],
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Lỗi getStudentInvoices:', error);
      return {
        success: false,
        status: 500,
        message: error.message || 'Không thể kết nối đến máy chủ backend',
        data: [],
      };
    }
  },

  /**
   * Thực hiện gán giao dịch thủ công qua API
   * @param {string|number} transactionId
   * @param {Object} payload - { studentId, invoiceId }
   */
  async manualMatch(transactionId, { studentId, invoiceId }) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/reconciliation/${encodeURIComponent(transactionId)}/manual-match`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          studentId: studentId.trim(),
          invoiceId: invoiceId.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          message: data.detail || `Gán giao dịch thủ công thất bại (${response.status})`,
        };
      }

      return {
        success: true,
        data,
        message: data.message || 'Gán giao dịch thủ công thành công',
      };
    } catch (error) {
      console.error('Lỗi manualMatch:', error);
      return {
        success: false,
        status: 500,
        message: error.message || 'Không thể kết nối đến máy chủ backend',
      };
    }
  },

  /**
   * Tải lên file sao kê ngân hàng (Excel/CSV)
   * @param {File} file - Đối tượng File từ input file
   * @param {string} [bank] - Tên ngân hàng
   * @param {string} [period] - Kỳ sao kê
   */
  async uploadStatement(file, bank = '', period = '') {
    try {
      const token = await this.ensureToken();
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const formData = new FormData();
      formData.append('file', file);
      if (bank) formData.append('bank', bank);
      if (period) formData.append('period', period);

      const response = await fetch(`${API_BASE_URL}/reconciliation/upload-statement`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          message: data.detail || `Lỗi tải lên file sao kê: ${response.status}`,
        };
      }

      return {
        success: true,
        data,
        message: data.message || 'Tải lên sao kê thành công',
      };
    } catch (error) {
      console.error('Lỗi uploadStatement:', error);
      return {
        success: false,
        status: 500,
        message: error.message || 'Không thể kết nối đến máy chủ backend',
      };
    }
  },
};

