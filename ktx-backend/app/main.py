from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models
from app.core.config import settings
from app.core.database import Base, engine
from app.routers.auth import router as auth_router
from app.routers.invoice import router as invoice_router
from app.routers.reconciliation import router as reconciliation_router
from app.routers.debt import router as debt_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Hệ thống quản lý Ký túc xá - API Backend với xác thực JWT & phân quyền RBAC",
)

# Cấu hình CORS cho phép Frontend truy cập
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tự động tạo và đồng bộ bảng trong CSDL dựa theo models đã khai báo
try:
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if "hoa_don" in inspector.get_table_names():
        fks = inspector.get_foreign_keys("hoa_don")
        cols = [c["name"] for c in inspector.get_columns("hoa_don")]
        with engine.connect() as conn:
            if "ho_ten" not in cols:
                conn.execute(text("ALTER TABLE hoa_don ADD COLUMN ho_ten VARCHAR(100) NULL AFTER msv"))
            if "so_phong" not in cols:
                conn.execute(text("ALTER TABLE hoa_don ADD COLUMN so_phong VARCHAR(50) NULL AFTER ma_phong"))

            # Đảm bảo Foreign Key liên kết hoa_don.ma_hop_dong -> hop_dong.ma_hop_dong luôn hoạt động (không tắt FK)
            has_hop_dong_fk = any(
                fk.get("referred_table") == "hop_dong" or "hop_dong" in fk.get("name", "")
                for fk in fks
            )
            if not has_hop_dong_fk:
                # Dọn dẹp bản ghi mồ côi nếu có từ test trước đó để khôi phục FK hợp lệ
                conn.execute(text("""
                    DELETE FROM hoa_don
                    WHERE ma_hop_dong IS NOT NULL
                      AND ma_hop_dong NOT IN (SELECT ma_hop_dong FROM hop_dong)
                """))
                try:
                    conn.execute(text("""
                        ALTER TABLE hoa_don
                        ADD CONSTRAINT fk_hoa_don_hop_dong
                        FOREIGN KEY (ma_hop_dong) REFERENCES hop_dong (ma_hop_dong)
                        ON DELETE CASCADE
                    """))
                except Exception:
                    pass
            conn.commit()
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"Warning on database startup/migration: {e}")


# Đăng ký các router với prefix /api/v1
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(invoice_router, prefix=settings.API_V1_STR)
app.include_router(reconciliation_router, prefix=settings.API_V1_STR)
app.include_router(debt_router, prefix=settings.API_V1_STR)



@app.get("/", tags=["Health Check"])
def root():
    return {
        "status": "online",
        "message": "KTX Backend đang hoạt động",
        "docs_url": "/docs",
    }