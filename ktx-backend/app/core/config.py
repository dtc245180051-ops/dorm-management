from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "KTX Management API"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = "mysql+pymysql://root:12345678@localhost:3306/dorm_management"
    SECRET_KEY: str = "dormitory_super_secret_jwt_key_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
