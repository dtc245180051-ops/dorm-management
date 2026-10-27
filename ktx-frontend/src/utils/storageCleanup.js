/**
 * Tiện ích dọn dẹp các key / dữ liệu rác tồn đọng trong LocalStorage và SessionStorage.
 * Đảm bảo hệ thống không lưu tạm ngầm dữ liệu giả lập hoặc cache lỗi thời.
 */

const OBSOLETE_KEYS = [
  'ktx_local_requests',
  'reconciliation_cache_data',
  'dorm_temporary_mock_data',
];

export function cleanupObsoleteStorage() {
  if (typeof window === 'undefined') return { cleanedKeys: [] };

  const removed = [];

  // 1. Quét và xóa các key lỗi thời đã định nghĩa
  OBSOLETE_KEYS.forEach((key) => {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
      removed.push(`localStorage:${key}`);
    }
    if (sessionStorage.getItem(key) !== null) {
      sessionStorage.removeItem(key);
      removed.push(`sessionStorage:${key}`);
    }
  });

  // 2. Quét các key bị hỏng JSON hoặc chứa dữ liệu rác bất thường
  const checkAndCleanCorrupted = (storage, prefix) => {
    const keys = Object.keys(storage);
    keys.forEach((k) => {
      if (k.startsWith('ktx_cached_') || k.startsWith('dorm_temp_')) {
        const val = storage.getItem(k);
        if (val) {
          try {
            JSON.parse(val);
          } catch {
            storage.removeItem(k);
            removed.push(`${prefix}:${k} (corrupted JSON)`);
          }
        }
      }
    });
  };

  try {
    checkAndCleanCorrupted(localStorage, 'localStorage');
    checkAndCleanCorrupted(sessionStorage, 'sessionStorage');
  } catch (err) {
    console.warn('Lỗi trong quá trình dọn dẹp storage rác:', err);
  }

  if (removed.length > 0) {
    console.info('[StorageCleanup] Đã dọn dẹp các key dữ liệu rác tồn đọng:', removed);
  }

  return { cleanedKeys: removed };
}

export default cleanupObsoleteStorage;
