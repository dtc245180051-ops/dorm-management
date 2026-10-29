import os
from pathlib import Path
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    PROJECT_NAME: str = "KTX Management API"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = Field(
        default="mysql+pymysql://root:12345678@localhost:3306/dorm_management",
        validation_alias="DATABASE_URL",
    )
    SECRET_KEY: str = Field(
        default="dormitory_super_secret_jwt_key_2026",
        validation_alias="SECRET_KEY",
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    GOOGLE_CLIENT_ID: Optional[str] = None

    # Google Gemini AI API Key (Single Source of Truth)
    GEMINI_API_KEY: Optional[str] = Field(
        default=None,
        validation_alias="GEMINI_API_KEY",
    )

    model_config = SettingsConfigDict(
        env_file=(str(ENV_FILE), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    def get_gemini_api_key(self, required: bool = True) -> str:
        """
        Lấy Gemini API Key từ cấu hình tập trung.
        Nạp theo thứ tự ưu tiên:
        1. settings.GEMINI_API_KEY từ ktx-backend/.env
        2. Biến môi trường GEMINI_API_KEY hoặc VITE_GEMINI_API_KEY
        3. Tệp ktx-frontend/.env (nếu có)
        Ném ValueError rõ ràng nếu biến môi trường bị thiếu khi chạy chức năng AI.
        """
        key = (self.GEMINI_API_KEY or "").strip().strip('"').strip("'")
        if not key:
            key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("VITE_GEMINI_API_KEY", "").strip()
            key = key.strip('"').strip("'")

        if not key:
            try:
                fe_env = BASE_DIR.parent / "ktx-frontend" / ".env"
                if fe_env.exists():
                    with open(fe_env, "r", encoding="utf-8") as f:
                        for line in f:
                            raw_line = line.strip()
                            if raw_line.startswith("VITE_GEMINI_API_KEY=") or raw_line.startswith("GEMINI_API_KEY="):
                                key = raw_line.split("=", 1)[1].strip().strip('"').strip("'")
                                if key:
                                    break
            except Exception:
                pass

        if not key and required:
            raise ValueError(
                "Lỗi cấu hình bảo mật: GEMINI_API_KEY chưa được thiết lập trong tệp môi trường (.env). "
                "Vui lòng thiết lập biến môi trường GEMINI_API_KEY trước khi sử dụng chức năng AI."
            )
        return key


settings = Settings()

