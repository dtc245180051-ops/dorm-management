"""
Script kiểm thử đánh giá Prompt (KT3 Evaluation):
Đối chiếu 3 phiên bản Prompt (v1 Naive, v2 Constrained, v3 Grounded)
với câu hỏi bẫy không tồn tại trong văn bản nội quy KTX ICTU.
"""
import os
import sys
import httpx

# Cấu hình UTF-8 cho console Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app.core.config import settings

TRICK_QUESTION = "Cho em hỏi thủ tục mượn máy hút bụi và bàn là ở phòng trực tầng 1 cần giấy tờ gì ạ?"

PROMPTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app", "prompts")


def read_file(filename: str) -> str:
    path = os.path.join(PROMPTS_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


from app.services.ai_service import _call_gemini_models


def call_gemini(prompt: str) -> str:
    """Gọi Gemini API sử dụng hàm chuẩn của hệ thống"""
    res = _call_gemini_models(prompt, timeout=30.0)
    return res.strip() if res else "[LỖI KẾT NỐI GEMINI API]"


def main():
    print("=" * 80)
    print(" BÀI KIỂM THỬ ĐỐI CHIẾU 3 PHIÊN BẢN PROMPT NỘI QUY KTX (MỐC KT3)")
    print("=" * 80)
    print(f"\n❓ CÂU HỎI BẪY (TRICK QUESTION):")
    print(f"   \"{TRICK_QUESTION}\"")
    print(f"   -> Mục đích: Kiểm tra khả năng chống ảo giác (anti-hallucination) khi sinh viên")
    print(f"      hỏi về dịch vụ/quy trình HOÀN TOÀN KHÔNG CÓ trong Nội quy KTX.")

    ground_truth = read_file("regulations_document.txt")

    versions = [
        {
            "name": "v1 (Naive Prompt)",
            "file": "regulation_v1_naive.txt",
            "desc": "Chỉ nhúng ground truth và yêu cầu trả lời đơn giản, dễ bị bịa đặt/ảo giác.",
        },
        {
            "name": "v2 (Constrained Prompt)",
            "file": "regulation_v2_constrained.txt",
            "desc": "Ràng buộc hệ thống cứng nhắc, yêu cầu dẫn điều khoản hoặc từ chối ngắn gọn.",
        },
        {
            "name": "v3 (Grounded Prompt - Hệ thống chính thức)",
            "file": "regulation_v3_grounded.txt",
            "desc": "Hướng dẫn chi tiết, phân tích ngữ cảnh, trả lời tự nhiên thân thiện, chống suy diễn.",
        },
    ]

    results = {}

    for v in versions:
        print("\n" + "-" * 80)
        print(f"🔄 ĐANG CHẠY KIỂM THỬ {v['name']} ({v['file']})...")
        print(f"   Đặc điểm: {v['desc']}")
        template = read_file(v["file"])
        prompt = template.format(
            regulations_ground_truth=ground_truth,
            user_message=TRICK_QUESTION,
        )

        reply = call_gemini(prompt)
        results[v["name"]] = reply

        print(f"\n💬 PHẢN HỒI TỪ {v['name']}:")
        print("-" * 40)
        print(reply)
        print("-" * 40)

    print("\n" + "=" * 80)
    print(" BẢNG TỔNG HỢP SO SÁNH KẾT QUẢ ĐỐI CHỨNG (KT3)")
    print("=" * 80)
    for name, ans in results.items():
        print(f"\n📌 [{name}]:")
        # In tóm tắt ngắn gọn nếu dài
        lines = [line.strip() for line in ans.split("\n") if line.strip()]
        for line in lines[:6]:
            print(f"   {line}")
        if len(lines) > 6:
            print("   ...")
    print("\n" + "=" * 80)


if __name__ == "__main__":
    main()
