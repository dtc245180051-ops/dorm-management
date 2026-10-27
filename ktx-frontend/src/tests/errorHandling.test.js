import { describe, it, expect, beforeEach, vi } from 'vitest';

class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

// Giả lập storage & window cho môi trường Node test runner
if (!globalThis.localStorage) {
  globalThis.localStorage = new MockStorage();
}
if (!globalThis.sessionStorage) {
  globalThis.sessionStorage = new MockStorage();
}
if (!globalThis.window) {
  globalThis.window = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}
if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, eventInitDict) {
      this.type = type;
      this.detail = eventInitDict?.detail;
    }
  };
}

import api, { getApiErrorMessage } from '../services/api';
import occupancyService from '../services/occupancyService';
import { invoiceService } from '../services/invoiceService';
import { cleanupObsoleteStorage } from '../utils/storageCleanup';

describe('Error Handling & Anti-Silent Caching Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. API Response Interceptor & Friendly Error Message', () => {
    it('should format friendly Vietnamese message for Network Error (offline / connection lost)', async () => {
      const mockNetworkError = {
        message: 'Network Error',
        isAxiosError: true,
      };

      try {
        const interceptor = api.interceptors.response.handlers[0].rejected;
        await interceptor(mockNetworkError);
      } catch (err) {
        expect(err.userFriendlyMessage).toBe(
          'Không thể kết nối tới máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.'
        );
        expect(getApiErrorMessage(err)).toBe(
          'Không thể kết nối tới máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.'
        );
      }
    });

    it('should format friendly message for HTTP 500 Internal Server Error', async () => {
      const mock500Error = {
        response: {
          status: 500,
          data: { detail: 'Lỗi máy chủ nội bộ trong quá trình xử lý.' },
        },
        message: 'Request failed with status code 500',
      };

      try {
        const interceptor = api.interceptors.response.handlers[0].rejected;
        await interceptor(mock500Error);
      } catch (err) {
        expect(err.userFriendlyMessage).toBe('Lỗi máy chủ nội bộ trong quá trình xử lý.');
        expect(getApiErrorMessage(err)).toBe('Lỗi máy chủ nội bộ trong quá trình xử lý.');
      }
    });

    it('should format friendly timeout message when request timed out', async () => {
      const mockTimeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      };

      try {
        const interceptor = api.interceptors.response.handlers[0].rejected;
        await interceptor(mockTimeoutError);
      } catch (err) {
        expect(err.userFriendlyMessage).toContain('quá thời gian chờ (timeout)');
      }
    });
  });

  describe('2. occupancyService: updateStudentProfile must NOT silently cache on failure', () => {
    it('should throw error and NOT write to localStorage when backend returns 500', async () => {
      const originalProfile = {
        msv: 'DTC245180001',
        ho_ten: 'Nguyễn Văn A',
        so_dien_thoai: '0912345678',
      };
      localStorage.setItem('dorm_student_profile', JSON.stringify(originalProfile));

      // Mock api.put to simulate 500 Server Error
      vi.spyOn(api, 'put').mockRejectedValueOnce({
        response: { status: 500, data: { detail: 'Database connection failed' } },
        userFriendlyMessage: 'Máy chủ đang gặp sự cố xử lý (mã 500). Vui lòng thử lại sau.',
      });

      const updatedData = {
        msv: 'DTC245180001',
        ho_ten: 'Nguyễn Văn A',
        so_dien_thoai: '0999999999',
      };

      await expect(occupancyService.updateStudentProfile(updatedData)).rejects.toThrow();

      // Ensure localStorage still holds original profile and did NOT silently overwrite with updatedData
      const stored = JSON.parse(localStorage.getItem('dorm_student_profile'));
      expect(stored.so_dien_thoai).toBe('0912345678');
      expect(stored.so_dien_thoai).not.toBe('0999999999');
    });

    it('should throw error and NOT write to localStorage when network error occurs', async () => {
      const originalProfile = {
        msv: 'DTC245180002',
        ho_ten: 'Trần Thị B',
        email: 'tranthib@gmail.com',
      };
      localStorage.setItem('dorm_student_profile', JSON.stringify(originalProfile));

      vi.spyOn(api, 'put').mockRejectedValueOnce({
        message: 'Network Error',
        userFriendlyMessage: 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.',
      });

      await expect(
        occupancyService.updateStudentProfile({
          msv: 'DTC245180002',
          email: 'newemail@gmail.com',
        })
      ).rejects.toThrow();

      const stored = JSON.parse(localStorage.getItem('dorm_student_profile'));
      expect(stored.email).toBe('tranthib@gmail.com');
    });
  });

  describe('3. invoiceService: confirmTransfer error handling', () => {
    it('should throw an error when API returns 500 instead of swallowing it', async () => {
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Lỗi ghi nhận thanh toán tại hệ thống ngân hàng' }),
      });

      await expect(invoiceService.confirmTransfer('HD-001', 'DTC245180001')).rejects.toThrow(
        'Lỗi ghi nhận thanh toán tại hệ thống ngân hàng'
      );
    });

    it('should throw an error when network drops during payment confirmation', async () => {
      globalThis.fetch = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(invoiceService.confirmTransfer('HD-001', 'DTC245180001')).rejects.toThrow(
        'Failed to fetch'
      );
    });
  });

  describe('4. Storage Cleanup: cleanupObsoleteStorage', () => {
    it('should remove obsolete mock keys from localStorage and sessionStorage', () => {
      localStorage.setItem('ktx_local_requests', JSON.stringify([{ id: 'mock-1' }]));
      localStorage.setItem('reconciliation_cache_data', JSON.stringify({ items: [] }));
      localStorage.setItem('dorm_temporary_mock_data', 'test');
      localStorage.setItem('valid_token', 'jwt-token-123');

      sessionStorage.setItem('reconciliation_cache_data', 'test');

      const result = cleanupObsoleteStorage();

      expect(localStorage.getItem('ktx_local_requests')).toBeNull();
      expect(localStorage.getItem('reconciliation_cache_data')).toBeNull();
      expect(localStorage.getItem('dorm_temporary_mock_data')).toBeNull();
      expect(sessionStorage.getItem('reconciliation_cache_data')).toBeNull();

      // Valid keys must remain untouched
      expect(localStorage.getItem('valid_token')).toBe('jwt-token-123');
      expect(result.cleanedKeys.length).toBeGreaterThanOrEqual(4);
    });
  });
});
