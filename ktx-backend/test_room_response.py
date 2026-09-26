from app.core.database import SessionLocal
from app.services import dorm_service
from app.schemas.dorm import PhongResponse

db = SessionLocal()
room = dorm_service.get_room_by_id(db, 'A1_P101')
res = PhongResponse.model_validate(room)
print("Room:", res.ma_phong, res.so_phong)
for g in res.giuongs:
    print("  Bed:", g.ma_giuong, "status:", g.trang_thai, "sinh_vien:", g.sinh_vien)
db.close()
