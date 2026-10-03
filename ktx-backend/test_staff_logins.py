import urllib.request
import urllib.parse
import json

accounts = [
    ("quanly", "password123", "/api/v1/auth/test-roles/quan-ly"),
    ("QL_Minh", "password123", "/api/v1/auth/test-roles/quan-ly"),
    ("ketoan", "password123", "/api/v1/auth/test-roles/ke-toan"),
    ("KT_Hoa", "password123", "/api/v1/auth/test-roles/ke-toan"),
]

for username, pwd, test_endpoint in accounts:
    # 1. Login
    data = urllib.parse.urlencode({"username": username, "password": pwd}).encode("utf-8")
    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/auth/login",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    with urllib.request.urlopen(req) as resp:
        body = json.loads(resp.read().decode("utf-8"))
        token = body.get("access_token")
        role = body.get("role")
        print(f"[OK] Đăng nhập '{username}' thành công (Vai trò: {role})")

    # 2. RBAC check
    test_req = urllib.request.Request(
        f"http://127.0.0.1:8000{test_endpoint}",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(test_req) as test_resp:
        test_body = json.loads(test_resp.read().decode("utf-8"))
        print(f"  -> RBAC {test_endpoint}: {test_body.get('message')}")
