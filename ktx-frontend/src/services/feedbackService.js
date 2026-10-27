import api from './api';

export const feedbackService = {
  /**
   * Sinh viên gửi phản ánh sự cố:
   * Backend AI tự động phân loại, sinh tiêu đề và xác định độ ưu tiên.
   * Tuyệt đối không fallback tạo dữ liệu giả vào localStorage khi gặp lỗi.
   */
  async submitFeedback(data) {
    const msv = data.msv || localStorage.getItem('ktx_username') || '';
    const ho_ten = data.ho_ten || localStorage.getItem('ktx_fullname') || '';
    const phong = data.phong || '';
    const mo_ta = data.mo_ta || '';

    try {
      const response = await api.post('/incidents', {
        msv,
        ho_ten,
        phong,
        mo_ta,
        hinh_anh: data.hinh_anh || null,
        tieu_de: data.tieu_de || undefined,
        loai_phan_anh: data.loai_phan_anh || undefined,
      });

      const created = response.data?.data;
      if (created) {
        if (response.data?.is_ai_processed !== undefined) {
          created.is_ai_processed = response.data.is_ai_processed;
        }
        if (response.data?.ai_error_reason !== undefined) {
          created.ai_error_reason = response.data.ai_error_reason;
        }
        window.dispatchEvent(new CustomEvent('student-incidents-updated', { detail: created }));
        return created;
      }
      throw new Error('Dữ liệu phản hồi từ máy chủ không hợp lệ.');
    } catch (err) {
      console.error('POST /incidents failed:', err);
      const detail = err.response?.data?.detail || err.message || 'Không thể gửi phản ánh. Vui lòng kiểm tra kết nối mạng và thử lại.';
      const errorToThrow = new Error(detail);
      errorToThrow.response = err.response;
      throw errorToThrow;
    }
  },

  /**
   * Lấy tóm tắt sự cố trong ngày từ AI cho Ban Quản lý KTX.
   */
  async getDailySummary() {
    try {
      const response = await api.get('/incidents/daily-summary');
      return response.data?.data || response.data;
    } catch (err) {
      console.error('GET /incidents/daily-summary failed:', err);
      throw err;
    }
  },

  /**
   * Lấy danh sách tất cả phản ánh trực tiếp từ CSDL Backend.
   */
  async getAllIncidents() {
    try {
      const response = await api.get('/incidents');
      return Array.isArray(response.data?.data) ? response.data.data : [];
    } catch (err) {
      console.error('GET /incidents failed:', err);
      throw err;
    }
  },

  /**
   * Lấy danh sách phản ánh của sinh viên từ backend.
   */
  async getStudentIncidents(msv) {
    const studentCode = (msv || localStorage.getItem('ktx_username') || '').trim();
    try {
      const response = await api.get('/incidents', {
        params: studentCode ? { msv: studentCode } : {},
      });
      return Array.isArray(response.data?.data) ? response.data.data : [];
    } catch (err) {
      console.error('GET /incidents with msv failed:', err);
      throw err;
    }
  },

  /**
   * Ban Quản lý cập nhật trạng thái phản ánh.
   */
  async updateIncidentStatus(incidentId, status, note = '') {
    try {
      const response = await api.patch(`/incidents/${encodeURIComponent(incidentId)}/status`, {
        trang_thai: status,
        ghi_chu_xu_ly: note,
      });
      const updated = response.data?.data;
      if (updated) {
        window.dispatchEvent(new CustomEvent('student-incidents-updated', { detail: updated }));
        return updated;
      }
      throw new Error('Không nhận được dữ liệu phản hồi cập nhật.');
    } catch (err) {
      console.error('PATCH /incidents/:id/status failed:', err);
      throw err;
    }
  },
};

export default feedbackService;
