import api from './api';

export const studentService = {
  // Lấy danh sách sinh viên có tìm kiếm, phân trang và bộ lọc
  getStudents: async (params = {}) => {
    const res = await api.get('/students/', { params });
    const totalCount = res.headers['x-total-count'];
    return {
      data: res.data || [],
      total: totalCount ? parseInt(totalCount, 10) : (res.data || []).length,
    };
  },

  // Thống kê số lượng sinh viên (Tất cả, Đang ở, Chưa xếp)
  getStudentStats: async () => {
    try {
      const res = await api.get('/students/stats');
      return res.data;
    } catch (err) {
      console.warn('Could not fetch student stats, using fallback calculation:', err);
      return null;
    }
  },

  // Lấy chi tiết hồ sơ một sinh viên theo MSV
  getStudentDetail: async (msv) => {
    const res = await api.get(`/students/${encodeURIComponent(msv)}`);
    return res.data;
  },

  // Tiếp nhận / Thêm hồ sơ sinh viên mới (kèm chỉ định phòng nếu có)
  createStudent: async (studentData) => {
    const res = await api.post('/students/', studentData);
    return res.data;
  },

  // Cập nhật thông tin sinh viên
  updateStudent: async (msv, studentData) => {
    const res = await api.put(`/students/${encodeURIComponent(msv)}`, studentData);
    return res.data;
  },

  // Xóa hồ sơ sinh viên
  deleteStudent: async (msv) => {
    const res = await api.delete(`/students/${encodeURIComponent(msv)}`);
    return res.data;
  },

  // Lấy danh sách tòa nhà phục vụ bộ lọc và chọn vị trí lưu trú
  getBuildings: async () => {
    const res = await api.get('/rooms/buildings');
    return res.data || [];
  },

  // Lấy danh sách phòng và giường phục vụ gán phòng
  getAvailableRooms: async (params = {}) => {
    const res = await api.get('/rooms/available', { params });
    return res.data || [];
  },
};

export default studentService;
