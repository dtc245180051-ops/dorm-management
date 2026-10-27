import api from './api';

const INCIDENTS_LOCAL_STORAGE_KEY = 'dorm_student_incidents';

function getLocalIncidents() {
  try {
    const raw = localStorage.getItem(INCIDENTS_LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      // Loại bỏ hoàn toàn các mã sự cố mẫu cũ nếu còn tồn đọng
      return list.filter((item) =>
        item.id !== 'PA-8291A4' &&
        item.id !== 'PA-7193F2' &&
        item.ma_phan_anh !== 'PA-8291A4' &&
        item.ma_phan_anh !== 'PA-7193F2'
      );
    }
    return [];
  } catch (_) {
    return [];
  }
}

function saveLocalIncidents(list) {
  try {
    localStorage.setItem(INCIDENTS_LOCAL_STORAGE_KEY, JSON.stringify(list || []));
  } catch (_) {}
}

export const feedbackService = {
  /**
   * Sinh viên gửi phản ánh sự cố tối giản:
   * Backend AI tự động phân loại, sinh tiêu đề và xác định độ ưu tiên.
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
        const localList = getLocalIncidents();
        const merged = [created, ...localList.filter((item) => (item.id || item.ma_phan_anh) !== (created.id || created.ma_phan_anh))];
        saveLocalIncidents(merged);
        window.dispatchEvent(new CustomEvent('student-incidents-updated', { detail: created }));
        return created;
      }
    } catch (err) {
      console.warn('POST /incidents failed, falling back to local storage:', err);
    }

    // Fallback nếu server tạm thời lỗi
    const fallbackIncident = {
      id: `PA-${Date.now().toString().slice(-6)}`,
      ma_phan_anh: `PA-${Date.now().toString().slice(-6)}`,
      msv,
      ho_ten,
      phong,
      loai_phan_anh: data.loai_phan_anh || 'Cơ sở vật chất',
      phan_loai: data.loai_phan_anh || 'Cơ sở vật chất',
      tieu_de: data.tieu_de || 'Phản ánh sự cố phòng',
      mo_ta,
      muc_do_uu_tien: 'Thường',
      trang_thai: 'CHO_XU_LY',
      trang_thai_label: 'Chờ xử lý',
      ngay_gui: new Date().toISOString(),
      ngay_tao: new Date().toISOString(),
      ghi_chu_xu_ly: '',
    };
    const localList = getLocalIncidents();
    saveLocalIncidents([fallbackIncident, ...localList]);
    window.dispatchEvent(new CustomEvent('student-incidents-updated', { detail: fallbackIncident }));
    return fallbackIncident;
  },

  /**
   * Lấy tóm tắt sự cố trong ngày từ AI cho Ban Quản lý KTX.
   */
  async getDailySummary() {
    try {
      const response = await api.get('/incidents/daily-summary');
      return response.data?.data || response.data;
    } catch (err) {
      console.warn('GET /incidents/daily-summary failed:', err);
      return { count: 0, summary: 'Chưa ghi nhận phản ánh cần ưu tiên xử lý trong hôm nay.' };
    }
  },

  async getAllIncidents() {
    try {
      const response = await api.get('/incidents');
      const items = Array.isArray(response.data?.data) ? response.data.data : [];
      if (items.length > 0) {
        saveLocalIncidents(items);
        return items;
      }
    } catch (err) {
      console.warn('GET /incidents failed:', err);
    }
    return getLocalIncidents();
  },

  async getStudentIncidents(msv) {
    const studentCode = (msv || localStorage.getItem('ktx_username') || '').trim().toLowerCase();
    try {
      const response = await api.get('/incidents', { params: studentCode ? { msv: studentCode } : {} });
      const items = Array.isArray(response.data?.data) ? response.data.data : [];
      if (items.length > 0) {
        // Cập nhật lại cache cho sinh viên này
        const allLocal = getLocalIncidents();
        const otherStudents = allLocal.filter((item) => (item.msv || '').trim().toLowerCase() !== studentCode);
        saveLocalIncidents([...items, ...otherStudents]);
        return items;
      }
      return [];
    } catch (err) {
      console.warn('GET /incidents with msv failed, fallback to local storage:', err);
    }

    // Fallback: Tìm trong local storage đúng theo MSV của sinh viên hiện tại
    if (!studentCode) return [];
    const localList = getLocalIncidents();
    const myLocal = localList.filter((item) => (item.msv || '').trim().toLowerCase() === studentCode);
    return myLocal;
  },

  async updateIncidentStatus(incidentId, status, note = '') {
    try {
      const response = await api.patch(`/incidents/${encodeURIComponent(incidentId)}/status`, {
        trang_thai: status,
        ghi_chu_xu_ly: note,
      });
      const updated = response.data?.data;
      if (updated) {
        const localList = getLocalIncidents();
        const merged = localList.map((item) => ((item.id || item.ma_phan_anh) === incidentId ? { ...item, ...updated } : item));
        saveLocalIncidents(merged);
        return updated;
      }
    } catch (err) {
      console.warn('PATCH /incidents/:id/status failed:', err);
    }
    return null;
  },
};

export default feedbackService;
