const API_BASE_URL = 'http://localhost:8000/api/v1';

const CACHE_KEY = 'reconciliation_cache_data';

function getCachedData() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveCacheData(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save reconciliation cache:', e);
  }
}

/**
 * Service gọi API Đối soát giao dịch ngân hàng dành cho Kế toán (KeToan)
 */
export const reconciliationService = {
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

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          data,
        };
      }
    } catch (error) {
      console.warn('Lỗi getReconciliations API, sử dụng bộ đệm:', error);
    }

    return { success: false, data: { items: [], total: 0, statistics: { totalTransactions: 0, autoMatched: 0, manualRequired: 0 } } };
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

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          data,
        };
      }
    } catch (error) {
      console.warn('Lỗi getTransactionDetail API, sử dụng bộ đệm:', error);
    }


    return {
      success: false,
      status: 404,
      message: 'Không tìm thấy giao dịch',
    };
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
      const response = await fetch(
        `${API_BASE_URL}/reconciliation/students/search?${params.toString()}`,
        {
          method: 'GET',
          headers,
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          data,
        };
      }
    } catch (error) {
      console.warn('Lỗi searchStudents API, sử dụng dữ liệu mặc định:', error);
    }

    return { success: true, data: [] };
  },

  /**
   * Lấy danh sách hóa đơn còn nợ của sinh viên từ backend
   * @param {string} studentId
   */
  async getStudentInvoices(studentId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/reconciliation/students/${encodeURIComponent(studentId)}/invoices`,
        {
          method: 'GET',
          headers,
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          data,
        };
      }
    } catch (error) {
      console.warn('Lỗi getStudentInvoices API, sử dụng dữ liệu mặc định:', error);
    }

    return { success: true, data: [] };
  },

  /**
   * Lấy danh sách hóa đơn chưa thanh toán (cả tiền phòng và điện nước) để kế toán khớp tay
   * @param {Object} params - { keyword, invoiceType, amount }
   */
  async getUnpaidInvoices({ keyword = '', invoiceType = 'ALL', amount = null } = {}) {
    try {
      const headers = await this.getAuthHeaders();
      const params = new URLSearchParams();
      if (keyword) params.append('keyword', keyword);
      if (invoiceType && invoiceType !== 'ALL') params.append('invoice_type', invoiceType);
      if (amount !== null && amount !== undefined) params.append('amount', amount);

      const response = await fetch(
        `${API_BASE_URL}/reconciliation/unpaid-invoices?${params.toString()}`,
        {
          method: 'GET',
          headers,
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          data,
        };
      }
    } catch (error) {
      console.warn('Lỗi getUnpaidInvoices API:', error);
    }

    return {
      success: true,
      data: [],
    };
  },

  /**
   * Thực hiện gán giao dịch thủ công qua API
   * @param {string|number} transactionId
   * @param {Object} payload - { invoiceId, studentId }
   */
  async manualMatch(transactionId, { studentId, invoiceId }) {
    try {
      const headers = await this.getAuthHeaders();
      const bodyData = {
        invoiceId: (invoiceId || '').trim(),
      };
      if (studentId) {
        bodyData.studentId = studentId.trim();
      }

      const response = await fetch(
        `${API_BASE_URL}/reconciliation/${encodeURIComponent(transactionId)}/manual-match`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyData),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          data,
          message: data.message || 'Gán giao dịch thủ công thành công',
        };
      } else {
        const errData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: errData.detail || 'Lỗi khi gán giao dịch thủ công: Số tiền hoặc thông tin không hợp lệ',
        };
      }
    } catch (error) {
      console.warn('Lỗi manualMatch API:', error);
      return {
        success: false,
        message: `Lỗi kết nối máy chủ: ${error.message}`,
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
    const bankName = bank || '';
    const periodName = period || 'Tháng 09/2026';

    try {
      const token = await this.ensureToken();
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const formData = new FormData();
      formData.append('file', file);
      if (bank) formData.append('bank', bankName);
      if (period) formData.append('period', periodName);

      const response = await fetch(`${API_BASE_URL}/reconciliation/upload-statement`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        saveCacheData(data);
        return {
          success: true,
          data,
          message: `Đã tải lên và đối soát thành công file ${file.name}`,
        };
      }
    } catch (error) {
      console.warn('Lỗi uploadStatement API, kích hoạt bộ phân tích dữ liệu:', error);
    }

    // Fallback xử lý file trực tiếp không để bị chặn bởi lỗi Not Found
    return { success: false, data: { items: [], totalTransactions: 0, statistics: { totalTransactions: 0, autoMatched: 0, manualRequired: 0 } }, message: 'Không thể tải sao kê lên máy chủ.' };
  },
};
