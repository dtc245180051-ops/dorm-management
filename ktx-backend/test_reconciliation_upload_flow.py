import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
from fastapi.testclient import TestClient

# Thêm đường dẫn project
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.services.reconciliation_service import ReconciliationService
from app.models.invoice import HoaDon, TrangThaiHoaDon
from app.models.reconciliation import GiaoDichNganHang, TrangThaiDoiSoat

client = TestClient(app)

def test_full_statement_upload_flow():
    print("=" * 70)
    print("KIỂM THỬ TOÀN DIỆN LUỒNG UPLOAD FILE SAO KÊ NGÂN HÀNG (EXCEL & CSV)")
    print("=" * 70)

    token = create_access_token({"sub": "KT_Hoa", "role": "KE_TOAN"})
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Trạng thái ban đầu: Chưa upload file sao kê
    print("\n--- 1. Kiểm tra trạng thái ban đầu (Chưa upload) ---")
    res1 = client.get("/api/v1/reconciliation?hasUploaded=false", headers=headers)
    assert res1.status_code == 200, f"Error: {res1.text}"
    data1 = res1.json()
    assert len(data1["items"]) == 0, "Bảng phải rỗng khi chưa upload"
    assert data1["statistics"]["totalTransactions"] == 0
    assert data1["statistics"]["autoMatched"] == 0
    assert data1["statistics"]["manualRequired"] == 0
    print("  [+] ĐẠT: Bảng rỗng, statistics = 0 khi hasUploaded=false")

    # 2. Upload file Excel (.xlsx)
    print("\n--- 2. Tải lên file sao kê Excel (.xlsx) ---")
    xlsx_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_statements", "sao_ke_tien_phong_t9_tpbank.xlsx")
    assert os.path.exists(xlsx_path), f"Không tìm thấy file {xlsx_path}"

    with open(xlsx_path, "rb") as f:
        file_bytes = f.read()

    res2 = client.post(
        "/api/v1/reconciliation/upload-statement",
        files={"file": ("sao_ke_tien_phong_t9_tpbank.xlsx", file_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        data={"bank": "TP Bank - TK 20020813520", "period": "Tháng 09/2026"},
        headers=headers,
    )
    assert res2.status_code == 200, f"Upload thất bại: {res2.text}"
    data2 = res2.json()

    print(f"  [+] Metadata trả về: File={data2['fileName']}, Bank={data2['bankName']}, Period={data2['period']}")
    assert data2["fileName"] == "sao_ke_tien_phong_t9_tpbank.xlsx"
    assert "TP Bank" in data2["bankName"]
    assert "Tháng 09/2026" in data2["period"]

    items2 = data2["items"]
    assert len(items2) == 2, f"Kỳ vọng 2 dòng giao dịch, nhận được {len(items2)}"

    # Kiểm tra Dòng 1: Có mã SV -> Khớp tự động
    row1 = next((item for item in items2 if "DTC245180037" in item["transferContent"]), None)
    assert row1 is not None, "Không tìm thấy dòng giao dịch của DTC245180037"
    print(f"  [+] Dòng 1: Mã GD={row1['bankTransactionCode']}, ST={row1['amount']:,.0f} đ, Matched={row1['matched_invoice']}, Status={row1['statusText']}, Action={row1['action']}")
    assert row1["matched_invoice"] == "HD-2026-00130"
    assert row1["status"] in ["MATCHED", "AUTO_MATCHED"]
    assert row1["statusText"] == "Đã khớp"
    assert row1["action"] == "VIEW"

    # Kiểm tra Dòng 2: Không có mã SV -> Sai cú pháp, Khớp tay
    row2 = next((item for item in items2 if "DTC" not in item["transferContent"]), None)
    assert row2 is not None, "Không tìm thấy dòng giao dịch sai cú pháp"
    print(f"  [+] Dòng 2: Mã GD={row2['bankTransactionCode']}, ST={row2['amount']:,.0f} đ, Matched={row2['matched_invoice']}, Status={row2['statusText']}, Action={row2['action']}")
    assert row2["matched_invoice"] == "Thiếu mã sinh viên"
    assert row2["status"] == "INVALID_SYNTAX"
    assert row2["statusText"] == "Sai cú pháp"
    assert row2["action"] == "MANUAL_MATCH"

    # Kiểm tra thống kê
    stats2 = data2["statistics"]
    print(f"  [+] Thống kê: Tổng={stats2['totalTransactions']}, Khớp={stats2['autoMatched']}, Cần xử lý tay={stats2['manualRequired']}")
    assert stats2["totalTransactions"] == 2
    assert stats2["autoMatched"] == 1
    assert stats2["manualRequired"] == 1

    # 3. Tương tác Khớp tay (Manual match) cho Dòng 2
    print("\n--- 3. Tương tác 'Khớp tay' cho Dòng 2 ---")
    tx2_id = row2["id"]
    res_match = client.post(
        f"/api/v1/reconciliation/{tx2_id}/manual-match",
        json={"studentId": "DTC245180037", "invoiceId": "HDTP-20260926-5A08F4"},
        headers=headers,
    )
    assert res_match.status_code == 200, f"Khớp tay thất bại: {res_match.text}"
    match_data = res_match.json()
    print(f"  [+] Khớp tay thành công: TransactionId={match_data['transactionId']}, Invoice={match_data['invoiceCode']}, Status={match_data['status']}")
    assert match_data["status"] == "MATCHED"
    assert match_data["invoiceCode"] == "HDTP-20260926-5A08F4"

    # Kiểm tra lại DB xem hóa đơn đã được gạch nợ thành DA_THANH_TOAN chưa
    db = SessionLocal()
    inv_check = db.query(HoaDon).filter(HoaDon.ma_hoa_don == "HDTP-20260926-5A08F4").first()
    assert inv_check.trang_thai == TrangThaiHoaDon.DA_THANH_TOAN.value, f"Hóa đơn chưa chuyển DA_THANH_TOAN: {inv_check.trang_thai}"
    print(f"  [+] ĐÃ GẠCH NỢ HÓA ĐƠN THÀNH CÔNG: {inv_check.ma_hoa_don} -> {inv_check.trang_thai}")
    db.close()

    # 4. Upload file CSV
    print("\n--- 4. Tải lên file sao kê CSV (.csv) ---")
    csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_statements", "sao_ke_tien_phong_t9_tpbank.csv")
    with open(csv_path, "rb") as f:
        csv_bytes = f.read()

    res4 = client.post(
        "/api/v1/reconciliation/upload-statement",
        files={"file": ("sao_ke_tien_phong_t9_tpbank.csv", csv_bytes, "text/csv")},
        data={"bank": "TP Bank - TK 20020813520", "period": "Tháng 09/2026"},
        headers=headers,
    )
    assert res4.status_code == 200, f"Upload CSV thất bại: {res4.text}"
    data4 = res4.json()
    assert len(data4["items"]) == 2
    print(f"  [+] Upload CSV thành công: Đọc được {len(data4['items'])} dòng giao dịch")

    print("\n" + "=" * 70)
    print("HOÀN THÀNH 100% CÁC BƯỚC KIỂM THỬ UPLOAD & ĐỐI SOÁT SAO KÊ THEO YÊU CẦU!")
    print("=" * 70)

if __name__ == "__main__":
    test_full_statement_upload_flow()
