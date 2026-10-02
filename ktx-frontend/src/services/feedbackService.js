import api from './api';

export const feedbackService = {
  /**
   * Sinh viên gửi phản ánh sự cố tối giản:
   * Backend AI tự động phân loại, sinh tiêu đề và xác định độ ưu tiên.
   */
  async submitFeedback(data) {
    const response = await api.post('/incidents', {
      msv: data.msv || localStorage.getItem('ktx_username') || '',
      ho_ten: data.ho_ten || localStorage.getItem('ktx_fullname') || '',
      phong: data.phong || '',
      mo_ta: data.mo_ta || '',
      hinh_anh: data.hinh_anh || null,
      // Dự phòng nếu có
      tieu_de: data.tieu_de || undefined,
      loai_phan_anh: data.loai_phan_anh || undefined,
    });
    return response.data?.data;
  },

  /**
   * Lấy tóm tắt sự cố trong ngày từ AI cho Ban Quản lý KTX.
   */
  async getDailySummary() {
    const response = await api.get('/incidents/daily-summary');
    return response.data?.data || response.data;
  },

  async getAllIncidents() {
    const response = await api.get('/incidents');
    return Array.isArray(response.data?.data) ? response.data.data : [];
  },

  async getStudentIncidents(msv) {
    const response = await api.get('/incidents', { params: msv ? { msv } : {} });
    return Array.isArray(response.data?.data) ? response.data.data : [];
  },

  async updateIncidentStatus(incidentId, status, note = '') {
    const response = await api.patch(`/incidents/${encodeURIComponent(incidentId)}/status`, {
      trang_thai: status,
      ghi_chu_xu_ly: note,
    });
    return response.data?.data;
  },
};

export default feedbackService;
