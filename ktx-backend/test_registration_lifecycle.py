import unittest
from types import SimpleNamespace
from fastapi import HTTPException

from app.models.contract import HopDong
from app.models.dorm import Giuong, Phong, Tang
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

    def first(self):
        return {
            SinhVien: self.db.student,
            HopDong: None,
            Giuong: self.db.bed,
            Phong: self.db.room,
            Tang: self.db.floor,
        }[self.model]


class FakeSession:
    def __init__(self):
        self.student = SimpleNamespace(msv="DTC-LIFECYCLE-TEST")
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
            toa_nha=SimpleNamespace(ten_toa="Tòa A1"),
        )
        self.added = []

    def query(self, model):
        return FakeQuery(self, model)

    def add(self, value):
        self.added.append(value)

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
        self.assertFalse(db.added)

        with self.assertRaises(HTTPException) as duplicate:
            register_room(registration, db)
        self.assertEqual(duplicate.exception.status_code, 409)
        self.assertEqual(db.bed.trang_thai, "TRONG")

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
        self.assertEqual(len(db.added), 1)
        self.assertEqual(
            occupancy_request_store.get_request_by_id(request_id)["trang_thai"],
            "APPROVED",
        )
