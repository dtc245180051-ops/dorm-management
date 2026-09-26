from app.core.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
beds = db.execute(text("SELECT g.ma_giuong, g.trang_thai, g.ma_phong, h.ma_hop_dong FROM giuong g LEFT JOIN hop_dong h ON g.ma_giuong = h.ma_giuong WHERE g.trang_thai = 'DA_THUE'")).fetchall()
print(f"Total DA_THUE beds: {len(beds)}")
for b in beds:
    print(b)
db.close()
