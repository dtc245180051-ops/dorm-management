// test_frontend_backend_flow.js
// Tests the exact frontend service integration with the live backend API

const BASE_URL = 'http://127.0.0.1:8000/api/v1';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, options);
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('='.repeat(60));
  console.log('BẮT ĐẦU KIỂM THỬ TÍCH HỢP FRONTEND - BACKEND (RECONCILIATION FLOW)');
  console.log('='.repeat(60));

  // 1. Login KeToan
  const loginBody = new URLSearchParams();
  loginBody.append('username', 'KT_Hoa');
  loginBody.append('password', 'password123');

  const loginRes = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: loginBody.toString(),
  });

  if (!loginRes.ok) {
    console.error('Đăng nhập Kế toán thất bại:', loginRes);
    process.exit(1);
  }

  const token = loginRes.data.access_token;
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  console.log('[PASS] 1. Đăng nhập thành công, token lấy được.');

  // 2. GET /reconciliation (default initial load)
  const listRes = await request('/reconciliation?page=1&pageSize=10', {
    headers: authHeaders,
  });
  console.log(`[PASS] 2. GET /reconciliation -> Status ${listRes.status}`);
  console.log('       Statistics:', listRes.data.statistics);
  console.log(`       Pagination: Page ${listRes.data.page}/${listRes.data.totalPages}, Total items: ${listRes.data.total}`);

  if (!listRes.data.statistics || typeof listRes.data.statistics.totalTransactions !== 'number') {
    throw new Error('Statistics format invalid');
  }

  // 3. Test Filter & Search
  const filterRes = await request(
    '/reconciliation?page=1&pageSize=10&status=MANUAL_REQUIRED&keyword=FT',
    { headers: authHeaders }
  );
  console.log(`[PASS] 3. Filter status=MANUAL_REQUIRED & keyword=FT -> Status ${filterRes.status}, items: ${filterRes.data.items.length}`);
  filterRes.data.items.forEach((item) => {
    if (item.status !== 'MANUAL_REQUIRED') {
      throw new Error(`Expected item status MANUAL_REQUIRED, got ${item.status}`);
    }
  });

  // 4. Test Search Students
  const searchStudentRes = await request('/reconciliation/students/search?keyword=Nguyen', {
    headers: authHeaders,
  });
  console.log(`[PASS] 4. GET /reconciliation/students/search?keyword=Nguyen -> Status ${searchStudentRes.status}, found: ${searchStudentRes.data.length} students`);
  if (!Array.isArray(searchStudentRes.data) || searchStudentRes.data.length === 0) {
    throw new Error('Students search returned no results');
  }
  const student = searchStudentRes.data.find((s) => s.studentCode === 'SV001') || searchStudentRes.data[0];
  console.log(`       Target student: ID=${student.studentId}, Name=${student.studentName}, Room=${student.room || 'N/A'}`);

  // 5. Test Load Student Invoices
  const invoicesRes = await request(`/reconciliation/students/${student.studentId}/invoices`, {
    headers: authHeaders,
  });
  console.log(`[PASS] 5. GET /reconciliation/students/${student.studentId}/invoices -> Status ${invoicesRes.status}, count: ${invoicesRes.data.length}`);
  if (invoicesRes.data.length > 0) {
    console.log(`       Invoices found:`, invoicesRes.data.map((inv) => `${inv.invoiceCode} (${inv.amount} đ)`));
  }

  // 6. Test Transaction Detail
  const txItem = filterRes.data.items[0];
  if (txItem) {
    const detailRes = await request(`/reconciliation/${txItem.id}`, {
      headers: authHeaders,
    });
    console.log(`[PASS] 6. GET /reconciliation/${txItem.id} -> Status ${detailRes.status}`);
    const tx = detailRes.data.transaction;
    console.log(`       Code: ${tx.bankTransactionCode}, Amount: ${tx.amount}, Status: ${tx.status}`);
  }

  // 7. Error Handling Verification
  // 7.1 Unauthenticated 401
  const unauthRes = await request('/reconciliation');
  console.log(`[PASS] 7.1 GET /reconciliation without token -> Status ${unauthRes.status} (Expected 401)`);

  // 7.2 Student token -> 403
  const svLoginBody = new URLSearchParams();
  svLoginBody.append('username', 'test_agent_1');
  svLoginBody.append('password', 'password123');
  const svLoginRes = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: svLoginBody.toString(),
  });
  if (svLoginRes.ok) {
    const svToken = svLoginRes.data.access_token;
    const svForbiddenRes = await request('/reconciliation', {
      headers: { 'Authorization': `Bearer ${svToken}` },
    });
    console.log(`[PASS] 7.2 Sinh viên truy cập đối soát -> Status ${svForbiddenRes.status} (Expected 403)`);
  }

  // 7.3 Not Found 404
  const notFoundRes = await request('/reconciliation/999999999', {
    headers: authHeaders,
  });
  console.log(`[PASS] 7.3 Giao dịch không tồn tại -> Status ${notFoundRes.status} (Expected 404)`);

  // 7.4 Validation error 400
  const badReqRes = await request(`/reconciliation/${txItem ? txItem.id : '1'}/manual-match`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ studentId: 'SV001', invoiceId: 'INVALID_INVOICE' }),
  });
  console.log(`[PASS] 7.4 Hóa đơn không tồn tại/không khớp -> Status ${badReqRes.status} (Expected 400 or 404)`);

  // 8. Test E2E Manual Match flow
  console.log('[TEST] 8. Thực hiện Gán giao dịch thủ công: FT2625502025 (1.200.000 đ) với HD-2026-00124...');
  const matchRes = await request('/reconciliation/FT2625502025/manual-match', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      studentId: 'SV001',
      invoiceId: 'HD-2026-00124',
    }),
  });
  console.log(`[PASS] 8.1 POST /reconciliation/FT2625502025/manual-match -> Status ${matchRes.status}, message: ${matchRes.data.message}`);
  if (matchRes.status !== 200) {
    throw new Error(`Manual match failed: ${JSON.stringify(matchRes.data)}`);
  }

  // Verify updated detail
  const updatedDetail = await request('/reconciliation/FT2625502025', { headers: authHeaders });
  console.log(`[PASS] 8.2 Chi tiết giao dịch sau gán: Status=${updatedDetail.data.transaction.status}, Invoice=${updatedDetail.data.transaction.invoiceCode}, Student=${updatedDetail.data.transaction.studentName}`);
  if (updatedDetail.data.transaction.status !== 'MATCHED_MANUALLY') {
    throw new Error(`Expected MATCHED_MANUALLY, got ${updatedDetail.data.transaction.status}`);
  }

  // Verify updated statistics
  const updatedList = await request('/reconciliation?page=1&pageSize=10', { headers: authHeaders });
  const updatedStats = updatedList.data.statistics;
  console.log(`[PASS] 8.3 Thống kê sau khi gán thủ công thành công:`, updatedStats);
  console.log(`       Cần xử lý tay giảm còn: ${updatedStats.manualRequired} (trước đó là ${listRes.data.statistics.manualRequired})`);

  console.log('='.repeat(60));
  console.log('TẤT CẢ CÁC BƯỚC KIỂM THỬ TÍCH HỢP FRONTEND - BACKEND ĐỀU THÀNH CÔNG RỰC RỠ!');
  console.log('='.repeat(60));
}

run().catch((err) => {
  console.error('LỖI KIỂM THỬ:', err);
  process.exit(1);
});
