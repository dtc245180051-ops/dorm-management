import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tự động đính kèm token nếu có trong localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor xử lý lỗi chung và tự động lấy token cho Quản lý nếu chưa đăng nhập
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Tự động đăng nhập mặc định với tài khoản QL_Minh
        const formData = new URLSearchParams();
        formData.append('username', 'QL_Minh');
        formData.append('password', 'password123');

        const loginRes = await axios.post(`${API_BASE_URL}/auth/login`, formData, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        if (loginRes.data?.access_token) {
          localStorage.setItem('access_token', loginRes.data.access_token);
          localStorage.setItem('user_role', loginRes.data.role);
          localStorage.setItem('user_name', loginRes.data.username);
          originalRequest.headers.Authorization = `Bearer ${loginRes.data.access_token}`;
          return api(originalRequest);
        }
      } catch (loginErr) {
        console.warn('Auto login failed:', loginErr);
      }
    }
    return Promise.reject(error);
  }
);

// ----------------- AUTH SERVICES -----------------
export const authService = {
  login: async (username, password) => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    const res = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    if (res.data?.access_token) {
      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('user_role', res.data.role);
      localStorage.setItem('user_name', res.data.username);
    }
    return res.data;
  },

  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_name');
  },
};

// ----------------- DORM & ROOM SERVICES -----------------
export const dormService = {
  // Tòa nhà
  getBuildings: async () => {
    const res = await api.get('/rooms/buildings');
    return res.data;
  },

  createBuilding: async (data) => {
    const res = await api.post('/rooms/buildings', data);
    return res.data;
  },

  deleteBuilding: async (ma_toa) => {
    const res = await api.delete(`/rooms/buildings/${ma_toa}`);
    return res.data;
  },

  // Tầng
  getFloors: async (ma_toa) => {
    const res = await api.get('/rooms/floors', {
      params: ma_toa ? { ma_toa } : {},
    });
    return res.data;
  },

  createFloor: async (data) => {
    const res = await api.post('/rooms/floors', data);
    return res.data;
  },

  // Phòng
  getRooms: async (params) => {
    const res = await api.get('/rooms/available', { params });
    return res.data;
  },

  getRoomDetail: async (ma_phong) => {
    const res = await api.get(`/rooms/${ma_phong}`);
    return res.data;
  },

  createRoom: async (data) => {
    const res = await api.post('/rooms/', data);
    return res.data;
  },

  updateRoom: async (ma_phong, data) => {
    const res = await api.put(`/rooms/${ma_phong}`, data);
    return res.data;
  },

  deleteRoom: async (ma_phong) => {
    const res = await api.delete(`/rooms/${ma_phong}`);
    return res.data;
  },

  // Tải lên hình ảnh phòng từ máy tính
  uploadRoomImage: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/rooms/upload-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  // Giường
  updateBedStatus: async (ma_giuong, trang_thai) => {
    const res = await api.put(`/rooms/beds/${ma_giuong}/status`, {
      trang_thai,
    });
    return res.data;
  },

  // Tra cứu chỗ trống
  getAvailableRooms: async (gender, building_id) => {
    const res = await api.get('/rooms/available', {
      params: {
        ...(gender ? { gender } : {}),
        ...(building_id ? { building_id } : {}),
      },
    });
    return res.data;
  },
};

// ----------------- CONTRACT SERVICES -----------------
export const contractService = {
  getContractDetail: async (ma_hop_dong) => {
    const res = await api.get(`/contracts/${ma_hop_dong}`);
    return res.data;
  },

  renewContract: async (ma_hop_dong, data) => {
    const res = await api.post(`/contracts/${ma_hop_dong}/renew`, data);
    return res.data;
  },

  terminateContract: async (ma_hop_dong, data = {}) => {
    const res = await api.post(`/contracts/${ma_hop_dong}/terminate`, data);
    return res.data;
  },
};

export default api;
