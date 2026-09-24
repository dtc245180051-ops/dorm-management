from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models
from app.core.config import settings
from app.core.database import Base, engine
from app.routers.auth import router as auth_router
from app.routers.rooms import router as rooms_router
from app.routers.students import router as students_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Hệ thống quản lý Ký túc xá - API Backend với xác thực JWT, phân quyền RBAC & Quản lý cơ sở vật chất KTX",
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

# Tự động tạo bảng trong CSDL dựa theo models đã khai báo
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"Warning: Could not connect to database on startup: {e}")

# Đăng ký các router với prefix /api/v1
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(rooms_router, prefix=settings.API_V1_STR)
app.include_router(students_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Health Check"])
def root():
    return {
        "status": "online",
        "message": "KTX Backend đang hoạt động",
        "docs_url": "/docs",
    }