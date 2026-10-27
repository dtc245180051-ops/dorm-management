import unittest
from types import SimpleNamespace
from fastapi import HTTPException

from app.models.contract import HopDong
from app.models.dorm import Giuong, Phong, Tang, ToaNha
from app.models.room_request import RoomRequest
from app.models.user import SinhVien
from app.routers.admin_occupancy import ApproveRequestPayload, approve_request
from app.routers.student_requests import RegisterRoomRequest, register_room
from app.services import occupancy_request_store


class FakeQuery:
    def __init__(self, db, model):
        self.db = db
        self.model = model

    def filter(self, *_conditions):
        return self

    def order_by(self, *_args):
        return self

    def first(self):
        if self.model == RoomRequest:
            return self.db.current_room_request
        return {
            SinhVien: self.db.student,
            HopDong: None,
            Giuong: self.db.bed,
            Phong: self.db.room,
            Tang: self.db.floor,
            ToaNha: self.db.building,
        }.get(self.model)

    def count(self):
        return 0

    def all(self):
        return []


class FakeSession:
    def __init__(self):
        self.student = SimpleNamespace(msv="DTC-LIFECYCLE-TEST", ma_nguoi_dung="U-TEST")
        self.building = SimpleNamespace(
            ma_toa="A1",
            ten_toa="Tòa A1",
        )
        self.bed = SimpleNamespace(
            ma_giuong="A1_P101_G01",
            ma_phong="A1_P101",
            trang_thai="TRONG",
        )
        self.room = SimpleNamespace(
            ma_phong="A1_P101",
            ma_tang="A1_T1",
            so_phong="101",
            loai_phong="Phòng tiêu chuẩn",
        )
        self.floor = SimpleNamespace(
            ma_toa="A1",
            toa_nha=self.building,
        )
        self.added = []
        self.current_room_request = None

    def query(self, model):
        return FakeQuery(self, model)

    def add(self, value):
        self.added.append(value)
        if isinstance(value, RoomRequest):
            self.current_room_request = value

    def flush(self):
        pass

    def refresh(self, value):
        pass

    def commit(self):
        pass

    def rollback(self):
        pass


class TestRegistrationLifecycle(unittest.TestCase):
    def test_registration_only_assigns_bed_after_admin_approval(self):
        db = FakeSession()
        registration = RegisterRoomRequest(
            msv=db.student.msv,
            gioi_tinh="Nam",
            loai_phong="Phòng tiêu chuẩn",
            nguyen_vong="Gần khu học tập",
            ma_toa_mong_muon="A1",
            xac_nhan=True,
        )

        submitted = register_room(registration, db)
        request_id = submitted["data"]["id"]

        self.assertEqual(submitted["data"]["trang_thai"], "PENDING")
        self.assertEqual(submitted["data"]["ma_toa_mong_muon"], "A1")
        self.assertFalse(submitted["data"].get("ma_phong"))
        self.assertEqual(db.bed.trang_thai, "TRONG")

        # Sau khi đăng ký, bản ghi RoomRequest được thêm vào DB
        self.assertTrue(any(isinstance(x, RoomRequest) for x in db.added))

        # Kiểm tra ngăn chặn đăng ký trùng lặp khi đã có đơn PENDING
        with self.assertRaises(HTTPException) as duplicate:
            register_room(registration, db)
        self.assertEqual(duplicate.exception.status_code, 409)
        self.assertEqual(db.bed.trang_thai, "TRONG")

        # Quản lý duyệt đơn
        approved = approve_request(
            request_id,
            ApproveRequestPayload(
                ma_toa="A1",
                phong_id="A1_P101",
                giuong_id="A1_P101_G01",
            ),
            db,
        )

        self.assertEqual(approved["data"]["trang_thai"], "APPROVED")
        self.assertEqual(approved["data"]["toa_nha"], "Tòa A1")
        self.assertEqual(approved["data"]["so_phong"], "101")
        self.assertEqual(approved["data"]["so_giuong"], "A1_P101_G01")
        self.assertEqual(db.bed.trang_thai, "DA_CO_NGUOI")

        # Hợp đồng lưu trú (HopDong) được tạo sau khi duyệt
        self.assertTrue(any(isinstance(x, HopDong) for x in db.added))

        # Trạng thái trong MySQL ORM store được cập nhật thành APPROVED
        self.assertEqual(
            occupancy_request_store.get_request_by_id(request_id, db=db)["trang_thai"],
            "APPROVED",
        )
