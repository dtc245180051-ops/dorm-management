import api from './api';

const STORAGE_KEY = 'dorm_student_incidents';

// Khởi tạo danh sách phản ánh rỗng
const DEFAULT_INCIDENTS = [];

function getLocalIncidents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveLocalIncidents(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save incidents to localStorage:', e);
  }
}

export const feedbackService = {
  /**
   * Sinh viên gửi phản ánh mới
   * Đồng thời lưu vào API Backend và LocalStorage để Ban Quản lý KTX tiếp nhận tức thì
   */
  async submitFeedback(data) {
    const incidentId = `PA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const newIncident = {
      id: incidentId,
      ma_phan_anh: incidentId,
      msv: data.msv || localStorage.getItem('ktx_username') || 'DTC245180051',
      ho_ten: data.ho_ten || localStorage.getItem('ktx_fullname') || 'Nguyễn Văn A',
      phong: data.phong || 'P36',
      loai_phan_anh: data.loai_phan_anh || 'Cơ sở vật chất',
      tieu_de: data.tieu_de,
      mo_ta: data.mo_ta,
      hinh_anh: data.hinh_anh || null,
      ngay_gui: new Date().toISOString(),
      trang_thai: 'CHO_XU_LY',
      ghi_chu_xu_ly: '',
    };

    // 1. Lưu vào LocalStorage
    const current = getLocalIncidents();
    const updated = [newIncident, ...current];
    saveLocalIncidents(updated);

    // 2. Gửi lên Backend API
    try {
      const response = await api.post('/incidents', {
        msv: newIncident.msv,
        ho_ten: newIncident.ho_ten,
        phong: newIncident.phong,
        loai_phan_anh: newIncident.loai_phan_anh,
        tieu_de: newIncident.tieu_de,
        mo_ta: newIncident.mo_ta,
        hinh_anh: newIncident.hinh_anh,
      });
      if (response?.data?.data) {
        return response.data.data;
      }
    } catch (err) {
      console.warn('API /incidents failed, using local store:', err);
    }

    return newIncident;
  },

  /**
   * Lấy danh sách toàn bộ phản ánh (Dành cho Ban Quản lý KTX)
   */
  async getAllIncidents() {
    try {
      const response = await api.get('/incidents');
      if (response?.data?.data && Array.isArray(response.data.data)) {
        // Hợp nhất dữ liệu backend và local nếu có
        const backendItems = response.data.data;
        const localItems = getLocalIncidents();
        const mergedMap = new Map();
        [...localItems, ...backendItems].forEach((item) => {
          const key = item.ma_phan_anh || item.id;
          if (key) mergedMap.set(key, item);
        });
        const mergedList = Array.from(mergedMap.values());
        saveLocalIncidents(mergedList);
        return mergedList;
      }
    } catch (err) {
      console.warn('API /incidents not available, using local store:', err);
    }
    return getLocalIncidents();
  },

  /**
   * Lấy danh sách phản ánh của sinh viên hiện tại
   */
  async getStudentIncidents(msv) {
    const all = await this.getAllIncidents();
    if (!msv) return all;
    const cleanMsv = msv.trim().toLowerCase();
    return all.filter((item) => item.msv && item.msv.trim().toLowerCase() === cleanMsv);
  },

  /**
   * Ban Quản lý KTX cập nhật trạng thái phản ánh
   */
  async updateIncidentStatus(incidentId, status, note = '') {
    // 1. Cập nhật local store
    const list = getLocalIncidents();
    const target = list.find(
      (item) => item.id === incidentId || item.ma_phan_anh === incidentId
    );
    if (target) {
      target.trang_thai = status;
      if (note) target.ghi_chu_xu_ly = note;
      saveLocalIncidents(list);
    }

    // 2. Gửi API lên backend
    try {
      await api.patch(`/incidents/${incidentId}/status`, {
        trang_thai: status,
        ghi_chu_xu_ly: note,
      });
    } catch (err) {
      console.warn('API update incident status failed, updated locally:', err);
    }

    return target;
  },
};

export default feedbackService;
