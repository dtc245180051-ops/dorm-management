from app.core.database import SessionLocal
from app.services import dorm_service

db = SessionLocal()
buildings = dorm_service.get_buildings(db)
a1 = next((b for b in buildings if b.ma_toa == 'A1'), None)
if a1:
    print("Building A1 found")
    for t in a1.tangs:
        for p in t.phongs:
            if p.so_phong == '101':
                print(f"Room {p.so_phong} (ma_phong={p.ma_phong}):")
                for g in p.giuongs:
                    print(f"   Bed: {g.ma_giuong}, trang_thai: {g.trang_thai}")
db.close()
