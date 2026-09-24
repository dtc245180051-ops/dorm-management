from fastapi import FastAPI
from app.database import engine, Base
from app import models

app = FastAPI(title="KTX Management API")

# Tự động tạo bảng trong CSDL dựa theo models đã khai báo
Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"message": "KTX Backend đang chạy"}