from app.core.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

print("--- ALL BEDS ---")
res = db.execute(text("SELECT ma_giuong, ma_phong, trang_thai FROM giuong")).fetchall()
for r in res:
    print(r)

print("\n--- ALL HOP DONG ---")
res_hd = db.execute(text("SELECT ma_hop_dong, msv, ma_giuong, trang_thai FROM hop_dong")).fetchall()
for r in res_hd:
    print(r)

print("\n--- ALL PHONG ---")
res_p = db.execute(text("SELECT ma_phong, so_phong, ma_tang, loai_phong FROM phong")).fetchall()
for r in res_p:
    print(r)
