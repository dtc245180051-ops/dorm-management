import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
} from "lucide-react";
import AdminLayout from "../../layouts/Admin";
import occupancyService from "../../services/occupancyService";
import {
  matchRoomWithGemini,
  isGenderCompatible,
  normalizeGender,
} from "../../services/geminiService";
import { approveStudentRoom } from "../../services/studentAccountService";
import studentNotificationService from "../../services/studentNotificationService";

export default function ProcessRegistrationPage({
  requestId = "DK-001",
  onBack,
  onProcessed,
}) {
  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestData, setRequestData] = useState(null);

  // Dữ liệu Tòa - Phòng - Giường trống phục vụ 3 dropdown
  const [buildingTree, setBuildingTree] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedBed, setSelectedBed] = useState("");
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [isMatching, setIsMatching] = useState(false);

  // Modal từ chối
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");

  // Toast thông báo
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3500);
  };

  // 1. Tải dữ liệu chi tiết yêu cầu & cây phòng trống khi mở trang
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Lấy chi tiết đơn
        const detail = await occupancyService.getRequestDetail(requestId);
        setRequestData(detail);

        // Kiểm tra an toàn: Nếu là đơn chuyển phòng -> Chuyển hướng ngay sang trang xử lý chuyển phòng
        const cleanReqId = String(requestId || "").toUpperCase();
        const isTransfer =
          cleanReqId.startsWith("YC") ||
          cleanReqId.startsWith("CP") ||
          String(detail?.loai_don || "").toUpperCase().includes("CHUYEN") ||
          String(detail?.loai_yeu_cau || "").toLowerCase().includes("chuyển");

        if (isTransfer) {
          window.location.replace(`/admin/requests/transfer/${requestId}`);
          return;
        }

        // Lấy cây tòa -> phòng -> giường trống
        const bedsData = await occupancyService.getAvailableBeds();
        const tree = bedsData || [];
        setBuildingTree(tree);

        // Khớp Tòa, Phòng, Giường với cây dữ liệu thực tế theo ràng buộc giới tính
        const studentGender = detail?.gioi_tinh || detail?.gender || "";
        const compatibleBuildings = tree.filter((b) =>
          isGenderCompatible(studentGender, b.gioi_tinh),
        );

        if (compatibleBuildings.length === 0) {
          // KTX hiện không có tòa nào phù hợp giới tính sinh viên -> ĐỂ TRỐNG
          setSelectedBuilding("");
          setSelectedRoom("");
          setSelectedBed("");
        } else {
          // Chỉ tìm trong danh sách các tòa phù hợp giới tính
          let targetBuilding = null;
          if (detail?.goi_y?.ma_toa) {
            targetBuilding = compatibleBuildings.find(
              (b) => b.ma_toa === detail.goi_y.ma_toa,
            );
          }

          if (!targetBuilding) {
            const rawWish = [
              detail?.nguyen_vong,
              detail?.noi_dung_nguyen_vong,
              detail?.nguyen_vong_label,
              detail?.chi_tiet_nguyen_vong,
              detail?.ma_toa_mong_muon,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            const wantsA1 = /tòa\s*a1\b|toa\s*a1\b|\ba1\b/i.test(rawWish) || String(detail?.ma_toa_mong_muon || "").toLowerCase().includes("a1");
            const wantsB = /tòa\s*b\b|toa\s*b\b|\bb\b/i.test(rawWish) || String(detail?.ma_toa_mong_muon || "").toLowerCase().startsWith("b");

            if (wantsA1) {
              targetBuilding = compatibleBuildings.find(
                (b) => String(b.ma_toa).toLowerCase().includes("a1") || String(b.ten_toa).toLowerCase().includes("a1"),
              );
            } else if (wantsB) {
              targetBuilding = compatibleBuildings.find(
                (b) => String(b.ma_toa).toLowerCase().includes("b") || String(b.ten_toa).toLowerCase().includes("b"),
              );
            }
          }

          if (!targetBuilding && !detail?.suggestion_error) {
            targetBuilding = compatibleBuildings[0];
          }

          if (targetBuilding) {
            setSelectedBuilding(targetBuilding.ma_toa);
            const rooms = targetBuilding.rooms || [];
            if (rooms.length > 0) {
              const targetRoom =
                rooms.find((r) => r.ma_phong === detail?.goi_y?.ma_phong) ||
                rooms[0];
              setSelectedRoom(targetRoom.ma_phong);

              const beds = targetRoom.beds || [];
              if (beds.length > 0) {
                const targetBed =
                  beds.find((b) => b.ma_giuong === detail?.goi_y?.ma_giuong) ||
                  beds[0];
                setSelectedBed(targetBed.ma_giuong);
              } else {
                setSelectedBed("");
              }
            } else {
              setSelectedRoom("");
              setSelectedBed("");
            }
          } else {
            setSelectedBuilding("");
            setSelectedRoom("");
            setSelectedBed("");
          }
        }
      } catch (err) {
        console.error("Error fetching request detail:", err);
        showToast("Không thể tải thông tin đơn yêu cầu.", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [requestId]);

  useEffect(() => {
    if (!requestData || buildingTree.length === 0) return undefined;

    let isCurrent = true;
    const rooms = buildingTree.flatMap((building) =>
      (building.rooms || [])
        .filter((room) => (room.beds || []).length > 0)
        .map((room) => {
          const beds = room.beds || [];
          const occupied = Number(room.thanh_vien_hien_tai || 0);
          const roomGender = String(room.gioi_tinh || building.gioi_tinh || "");
          return {
            ...room,
            ten_phong: `Phòng ${room.so_phong || room.ma_phong}`,
            toa: building.ten_toa || `Tòa ${building.ma_toa}`,
            gioi_tinh: roomGender,
            loai_phong: room.loai_phong || "Phòng tiêu chuẩn",
            so_tang: room.so_tang || 1,
            thanh_vien_hien_tai: occupied,
            suc_chua: Number(room.suc_chua || occupied + beds.length),
            danh_sach_giuong: beds.map((bed) => ({
              ...bed,
              da_co_nguoi: false,
            })),
          };
        }),
    );

    const applyRecommendation = async () => {
      setIsMatching(true);
      try {
        const recommendation = await matchRoomWithGemini(requestData, rooms);
        if (!isCurrent) return;
        setAiRecommendation(recommendation);

        if (!recommendation?.best_room_id || !recommendation?.suggestion) {
          // Không có phòng hợp lệ phù hợp giới tính -> ĐỂ TRỐNG
          setSelectedBuilding("");
          setSelectedRoom("");
          setSelectedBed("");
          return;
        }

        // Lọc danh sách các tòa phù hợp với giới tính sinh viên
        const compatibleBuildings = buildingTree.filter((b) =>
          isGenderCompatible(requestData?.gioi_tinh, b.gioi_tinh),
        );

        if (compatibleBuildings.length === 0) {
          setSelectedBuilding("");
          setSelectedRoom("");
          setSelectedBed("");
          return;
        }

        // 1. Tự động tìm Tòa phù hợp từ kết quả gợi ý trong các tòa hợp lệ
        const recToa = String(recommendation.toa || "").trim().toLowerCase();
        const matchedBuilding =
          compatibleBuildings.find((building) => {
            const bMa = String(building.ma_toa || "").toLowerCase();
            const bTen = String(building.ten_toa || "").toLowerCase();
            return (
              recToa === bMa ||
              recToa === bTen ||
              recToa.includes(bMa) ||
              bTen.includes(recToa) ||
              (recToa.includes("a1") && (bMa.includes("a1") || bTen.includes("a1"))) ||
              (recToa.includes("b") && (bMa.includes("b") || bTen.includes("b")))
            );
          }) || compatibleBuildings[0];

        if (!matchedBuilding) {
          setSelectedBuilding("");
          setSelectedRoom("");
          setSelectedBed("");
          return;
        }

        // 2. Tự động tìm Phòng phù hợp từ kết quả gợi ý
        const recRoom = String(recommendation.best_room_id || "").trim();
        const roomToken = recRoom.replace(/^Phòng\s*/i, "").trim().toLowerCase();
        const bldRooms = matchedBuilding.rooms || [];
        const matchedRoom =
          bldRooms.find((room) => {
            const rMa = String(room.ma_phong || "").toLowerCase();
            const rSo = String(room.so_phong || "").toLowerCase();
            return (
              rMa === recRoom.toLowerCase() ||
              rSo === roomToken ||
              rMa.includes(roomToken) ||
              recRoom.toLowerCase().includes(rSo)
            );
          }) || bldRooms[0];

        if (!matchedRoom) {
          setSelectedRoom("");
          setSelectedBed("");
          return;
        }

        // 3. Tự động tìm Giường trống phù hợp từ kết quả gợi ý
        const recBed = String(recommendation.giuong || "").trim();
        const bedToken = recBed.replace(/^Giường\s*/i, "").trim().toLowerCase();
        const roomBeds = matchedRoom.beds || [];
        const matchedBed =
          roomBeds.find((bed) => {
            const bMa = String(bed.ma_giuong || "").toLowerCase();
            const bLabel = String(bed.label || "").toLowerCase();
            return (
              bMa === recBed.toLowerCase() ||
              bLabel === recBed.toLowerCase() ||
              bMa.endsWith(bedToken) ||
              bLabel.endsWith(bedToken) ||
              bMa.includes(bedToken)
            );
          }) || roomBeds[0];

        setSelectedBuilding(matchedBuilding.ma_toa);
        setSelectedRoom(matchedRoom.ma_phong);
        if (matchedBed) {
          setSelectedBed(matchedBed.ma_giuong);
        } else {
          setSelectedBed("");
        }
      } catch (err) {
        console.error("Error matching room with Gemini:", err);
      } finally {
        if (isCurrent) setIsMatching(false);
      }
    };

    applyRecommendation();
    return () => {
      isCurrent = false;
    };
  }, [requestData, buildingTree]);



  // Danh sách phòng tương ứng với Tòa đang chọn
  const currentBuildingObj = buildingTree.find(
    (b) => b.ma_toa === selectedBuilding,
  );
  const availableRooms = currentBuildingObj?.rooms || [];

  // Danh sách giường tương ứng với Phòng đang chọn
  const currentRoomObj = availableRooms.find(
    (r) => r.ma_phong === selectedRoom,
  );
  const availableBeds = currentRoomObj?.beds || [];

  // Khi đổi Tòa -> tự động chọn phòng đầu tiên
  const handleBuildingChange = (e) => {
    const newBld = e.target.value;
    setSelectedBuilding(newBld);
    const bldObj = buildingTree.find((b) => b.ma_toa === newBld);
    if (bldObj && bldObj.rooms && bldObj.rooms.length > 0) {
      const firstRoom = bldObj.rooms[0];
      setSelectedRoom(firstRoom.ma_phong);
      if (firstRoom.beds && firstRoom.beds.length > 0) {
        setSelectedBed(firstRoom.beds[0].ma_giuong);
      } else {
        setSelectedBed("");
      }
    } else {
      setSelectedRoom("");
      setSelectedBed("");
    }
  };

  // Khi đổi Phòng -> tự động chọn giường đầu tiên
  const handleRoomChange = (e) => {
    const newRoom = e.target.value;
    setSelectedRoom(newRoom);
    const roomObj = availableRooms.find((r) => r.ma_phong === newRoom);
    if (roomObj && roomObj.beds && roomObj.beds.length > 0) {
      setSelectedBed(roomObj.beds[0].ma_giuong);
    } else {
      setSelectedBed("");
    }
  };

  // Xử lý Phê duyệt & xếp phòng
  const handleApprove = async () => {
    if (!selectedBuilding || !selectedRoom || !selectedBed) {
      showToast(
        "Vui lòng chọn đầy đủ Tòa, Phòng và Giường trước khi duyệt.",
        "error",
      );
      return;
    }

    const studentGender = requestData?.gioi_tinh || requestData?.gender || "";
    const sNorm = normalizeGender(studentGender);
    const studentGenderLabel = sNorm === "FEMALE" ? "Nữ" : (sNorm === "MALE" ? "Nam" : (studentGender || "sinh viên"));

    if (!isGenderCompatible(studentGender, currentBuildingObj?.gioi_tinh)) {
      showToast(
        `Không thể phê duyệt: Sinh viên là ${studentGenderLabel} nhưng ${currentBuildingObj?.ten_toa || selectedBuilding} là tòa dành cho ${currentBuildingObj?.gioi_tinh || "khác"}.`,
        "error",
      );
      return;
    }

    setSubmitting(true);
    try {
      const cleanReqId = String(requestId || "").toUpperCase();
      const isTransfer =
        cleanReqId.startsWith("YC") ||
        cleanReqId.startsWith("CP") ||
        String(requestData?.loai_don || "").toUpperCase().includes("CHUYEN") ||
        String(requestData?.loai_yeu_cau || "").toLowerCase().includes("chuyển");

      const payload = {
        ma_toa: selectedBuilding,
        phong_id: selectedRoom,
        giuong_id: selectedBed,
        msv: requestData?.msv,
        ho_ten: requestData?.ho_ten,
      };

      if (isTransfer) {
        const result = await occupancyService.approveTransferRequest(requestId, payload);
        showToast(result.message || "Phê duyệt chuyển phòng thành công!", "success");
        setTimeout(() => {
          if (onProcessed) {
            onProcessed("approved", result);
          } else if (onBack) {
            onBack();
          }
        }, 1500);
        return;
      }

      const result = await occupancyService.approveRequest(requestId, payload);
      const contractCode =
        result?.data?.ma_hop_dong ||
        `HD26-${selectedBuilding}${selectedRoom}-G${selectedBed}`;

      // Cập nhật Schema tài khoản sinh viên dùng chung (Global State / localStorage)
      const bldName = selectedBuilding.startsWith("Tòa") ? selectedBuilding : `Tòa ${selectedBuilding}`;
      const rNum = String(selectedRoom).replace(/^P/i, "");
      approveStudentRoom(requestData?.msv, {
        requestId,
        building: bldName,
        roomNumber: rNum,
        roomType: currentRoomObj?.loai_phong || "Phòng tiêu chuẩn",
        startDate: "01/10/2026",
        endDate: "30/06/2027",
      });

      try {
        studentNotificationService.notifyFromManagement({
          title: "Thông báo duyệt đăng ký phòng KTX",
          content: `Đơn đăng ký phòng KTX của bạn đã được Ban quản lý KTX phê duyệt thành công. Bạn được xếp vào ${rNum ? `Phòng ${rNum} - ` : ""}${bldName}. Hợp đồng: ${contractCode}.`,
          type: "registration",
          actionUrl: "/student/history",
          actionLabel: "Kiểm tra lịch sử phòng",
          msv: requestData?.msv,
        });
      } catch {
        // ignore notification error
      }

      showToast(`Duyệt thành công! Đã tạo hợp đồng ${contractCode}`, "success");

      setTimeout(() => {
        if (onProcessed) {
          onProcessed("approved", result);
        } else if (onBack) {
          onBack();
        }
      }, 1500);
    } catch (err) {
      console.error("Error approving request:", err);
      const errorMsg =
        err.response?.data?.detail ||
        err.message ||
        "Phê duyệt yêu cầu thất bại. Vui lòng thử lại!";
      showToast(errorMsg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Xử lý Từ chối đơn
  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      setRejectError("Vui lòng nhập lý do từ chối đơn đăng ký.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = { ly_do_tu_choi: rejectReason.trim() };
      await occupancyService.rejectRequest(requestId, payload);

      try {
        studentNotificationService.notifyFromManagement({
          title: "Thông báo kết quả đăng ký phòng KTX",
          content: `Đơn đăng ký phòng KTX của bạn đã bị từ chối. Lý do: ${rejectReason.trim()}`,
          type: "registration",
          actionUrl: "/student/history",
          actionLabel: "Kiểm tra lịch sử",
          msv: requestData?.msv,
        });
      } catch {
        // ignore notification error
      }

      setIsRejectModalOpen(false);
      showToast("Đã từ chối đơn yêu cầu thành công.", "success");

      setTimeout(() => {
        if (onProcessed) {
          onProcessed("rejected");
        } else if (onBack) {
          onBack();
        }
      }, 1500);
    } catch (err) {
      console.error("Error rejecting request:", err);
      setRejectError("Không thể từ chối đơn. Vui lòng thử lại!");
    } finally {
      setSubmitting(false);
    }
  };

  const studentGender = requestData?.gioi_tinh || requestData?.gender || "";
  const sNorm = normalizeGender(studentGender);
  const studentGenderLabel = sNorm === "FEMALE" ? "Nữ" : (sNorm === "MALE" ? "Nam" : (studentGender || "sinh viên"));

  const compatibleBuildings = buildingTree.filter((b) =>
    isGenderCompatible(studentGender, b.gioi_tinh),
  );
  const hasCompatibleRooms = compatibleBuildings.some(
    (b) => (b.rooms || []).length > 0,
  );

  const isCurrentSelectionCompatible = selectedBuilding
    ? isGenderCompatible(studentGender, currentBuildingObj?.gioi_tinh)
    : false;

  return (
    <AdminLayout activeTab="dashboard" userName="QL_Minh">
      {/* Toast thông báo */}
      {toast.show && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all animate-in fade-in slide-in-from-top-4 ${
            toast.type === "success"
              ? "bg-emerald-600 text-white shadow-emerald-500/20"
              : "bg-rose-600 text-white shadow-rose-500/20"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Thẻ Card chính màu trắng bao trọn nội dung theo chuẩn Figma */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 lg:p-8 flex-1 flex flex-col justify-between">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[450px]">
            <Loader2 className="w-9 h-9 text-blue-600 animate-spin mb-3" />
            <span className="text-sm font-semibold text-slate-500">
              Đang tải dữ liệu yêu cầu đăng ký...
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Header: Nút back < và Tiêu đề */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBack}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title="Quay lại danh sách"
              >
                <ChevronLeft className="w-7 h-7 stroke-[2.5]" />
              </button>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Yêu cầu đăng ký ở
              </h1>
            </div>

            {/* 1. THÔNG TIN SINH VIÊN (2 CỘT CHỈ ĐỌC - READ ONLY) */}
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-3">
                Thông tin sinh viên
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                {/* Cột 1 */}
                <div className="space-y-3">
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={requestData?.msv || ""}
                      placeholder="Mã sinh viên"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={requestData?.ho_ten || ""}
                      placeholder="Họ và tên"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={requestData?.gioi_tinh || ""}
                      placeholder="Giới tính"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={requestData?.ngay_sinh || ""}
                      placeholder="Ngày sinh"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={requestData?.cccd || ""}
                      placeholder="Số CCCD/Định danh"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                  </div>
                </div>

                {/* Cột 2 */}
                <div className="space-y-3">
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={requestData?.so_dien_thoai || ""}
                      placeholder="Số điện thoại"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                  </div>
                  {/* Ô Email với hậu tố @ictu.edu.vn */}
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      readOnly
                      value={
                        requestData?.email
                          ? requestData.email.replace("@ictu.edu.vn", "")
                          : "nguyenvana"
                      }
                      placeholder="Email"
                      className="w-full pl-4 pr-28 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                    <span className="absolute right-4 text-xs font-semibold text-slate-400 pointer-events-none select-none">
                      @ictu.edu.vn
                    </span>
                  </div>
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={requestData?.khoa || ""}
                      placeholder="Khoa / Viện"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={requestData?.lop || ""}
                      placeholder="Lớp chuyên ngành"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      readOnly
                      value={
                        requestData?.dia_chi || "Số 123 Đường Cầu Giấy, Hà Nội"
                      }
                      placeholder="Địa chỉ"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. THÔNG TIN LIÊN HỆ KHẨN CẤP */}
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-3">
                Thông tin liên hệ khẩn cấp
              </h2>
              <div className="space-y-3">
                <div>
                  <input
                    type="text"
                    readOnly
                    value={
                      requestData?.nguoi_giam_ho ||
                      requestData?.ho_ten_nguoi_giam_ho ||
                      requestData?.ho_ten_phu_huynh ||
                      ""
                    }
                    placeholder="Họ và tên người giám hộ"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    readOnly
                    value={requestData?.moi_quan_he || ""}
                    placeholder="Mối quan hệ"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    readOnly
                    value={requestData?.sdt_nguoi_giam_ho || ""}
                    placeholder="Số điện thoại liên hệ"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none cursor-default select-none shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* 3. NGUYỆN VỌNG */}
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-3">
                Nguyện vọng
              </h2>
              <div className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 shadow-2xs space-y-3">
                {(requestData?.loai_phong ||
                  requestData?.tang_mong_muon ||
                  requestData?.muc_gia_mong_muon) && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    {requestData?.loai_phong && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-blue-700 font-semibold border border-blue-200 text-xs">
                        <span className="text-slate-500 font-normal">Loại phòng:</span>
                        {requestData.loai_phong}
                      </span>
                    )}
                    {requestData?.tang_mong_muon && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200 text-xs">
                        <span className="text-slate-500 font-normal">Tầng mong muốn:</span>
                        {requestData.tang_mong_muon}
                      </span>
                    )}
                    {requestData?.muc_gia_mong_muon && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 text-xs">
                        <span className="text-slate-500 font-normal">Ngân sách:</span>
                        {requestData.muc_gia_mong_muon}
                      </span>
                    )}
                  </div>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">
                  {requestData?.nguyen_vong ||
                    requestData?.noi_dung_nguyen_vong ||
                    requestData?.nguyen_vong_label ||
                    "Chưa có nội dung nguyện vọng chi tiết."}
                </p>
              </div>
            </div>

            {/* 4. GỢI Ý XẾP CHỖ CỦA HỆ THỐNG */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-slate-900">
                  Gợi ý xếp chỗ của hệ thống
                </h2>
                {isMatching && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang khớp nguyện vọng...
                  </span>
                )}
              </div>

              {/* THÔNG BÁO CẢNH BÁO KHI KHÔNG CÓ PHÒNG PHÙ HỢP GIỚI TÍNH */}
              {!hasCompatibleRooms ? (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-3 shadow-2xs mb-4">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold text-amber-950">
                      ⚠️ Không tìm thấy phòng khả dụng phù hợp với giới tính của sinh viên (Yêu cầu phòng {studentGenderLabel}).
                    </p>
                    <p className="text-amber-800 text-xs mt-1 leading-relaxed">
                      Vui lòng kiểm tra lại quỹ phòng hoặc liên hệ điều phối.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* CẢNH BÁO NẾU QUẢN LÝ CHỌN NHẦM TÒA KHÁC GIỚI TÍNH */}
              {selectedBuilding && !isCurrentSelectionCompatible ? (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 flex items-start gap-2.5 shadow-2xs mb-4">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-rose-950">
                      ❌ Cảnh báo vi phạm ràng buộc giới tính!
                    </p>
                    <p className="text-rose-800 mt-0.5">
                      {currentBuildingObj?.ten_toa || selectedBuilding} là tòa quy định giới tính {currentBuildingObj?.gioi_tinh || "khác"}, không phù hợp với sinh viên {studentGenderLabel}.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* LÝ DO GỢI Ý CỦA AI NẾU CÓ */}
              {aiRecommendation?.ai_reason && hasCompatibleRooms && selectedBuilding && (
                <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50/80 px-3 py-2 rounded-lg border border-blue-200 mb-4 shadow-2xs animate-in fade-in">
                  <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>{aiRecommendation.ai_reason}</span>
                </div>
              )}

              {/* 3 DROPDOWN LIÊN HOÀN */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Dropdown 1: Tòa */}
                <div className={`flex items-center justify-between px-4 py-2 border rounded-lg transition ${
                  selectedBuilding && !isCurrentSelectionCompatible
                    ? "bg-rose-50/60 border-rose-300"
                    : "bg-slate-50 border-slate-200 hover:border-slate-300"
                }`}>
                  <span className="text-xs font-bold text-slate-700">Tòa</span>
                  <div className="relative flex items-center">
                    <select
                      value={selectedBuilding}
                      onChange={handleBuildingChange}
                      className="appearance-none bg-transparent pr-7 pl-2 py-1 text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Chọn tòa --</option>
                      {buildingTree.map((b) => {
                        const isOk = isGenderCompatible(studentGender, b.gioi_tinh);
                        return (
                          <option key={b.ma_toa} value={b.ma_toa}>
                            {b.ten_toa || `Tòa ${b.ma_toa}`} {isOk ? "" : `(Tòa ${b.gioi_tinh || 'Khác'})`}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-1 pointer-events-none" />
                  </div>
                </div>

                {/* Dropdown 2: Phòng */}
                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition">
                  <span className="text-xs font-bold text-slate-700">
                    Phòng
                  </span>
                  <div className="relative flex items-center">
                    <select
                      value={selectedRoom}
                      onChange={handleRoomChange}
                      disabled={availableRooms.length === 0 || !selectedBuilding}
                      className="appearance-none bg-transparent pr-7 pl-2 py-1 text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer disabled:text-slate-400"
                    >
                      <option value="">-- Chọn phòng --</option>
                      {availableRooms.map((r) => (
                        <option key={r.ma_phong} value={r.ma_phong}>
                          {r.label || `Phòng ${r.so_phong}`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-1 pointer-events-none" />
                  </div>
                </div>

                {/* Dropdown 3: Giường */}
                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition">
                  <span className="text-xs font-bold text-slate-700">
                    Giường
                  </span>
                  <div className="relative flex items-center">
                    <select
                      value={selectedBed}
                      onChange={(e) => setSelectedBed(e.target.value)}
                      disabled={availableBeds.length === 0 || !selectedRoom}
                      className="appearance-none bg-transparent pr-7 pl-2 py-1 text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer disabled:text-slate-400"
                    >
                      <option value="">-- Chọn giường --</option>
                      {availableBeds.map((bed) => (
                        <option key={bed.ma_giuong} value={bed.ma_giuong}>
                          {bed.label || `Giường ${bed.ma_giuong}`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-500 absolute right-1 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* BỘ 2 NÚT HÀNH ĐỘNG DƯỚI CÙNG THEO CHUẨN FIGMA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 mt-2">
              {/* Nút 1: Từ chối đơn (Nút đỏ nhạt) */}
              <button
                type="button"
                onClick={() => {
                  setRejectReason("");
                  setRejectError("");
                  setIsRejectModalOpen(true);
                }}
                disabled={submitting}
                className="w-full py-3.5 px-6 rounded-xl bg-[#f8c8c8] hover:bg-[#f5b3b3] text-[#d32f2f] font-bold text-sm sm:text-base transition-colors duration-150 cursor-pointer text-center shadow-2xs disabled:opacity-50"
              >
                Từ chối đơn
              </button>

              {/* Nút 2: Phê duyệt & xếp phòng (Nút xanh nhạt / nổi bật) */}
              <button
                type="button"
                onClick={handleApprove}
                disabled={submitting || !selectedBed || !isCurrentSelectionCompatible}
                title={
                  selectedBuilding && !isCurrentSelectionCompatible
                    ? "Không thể phê duyệt do giới tính phòng/tòa không phù hợp với sinh viên"
                    : (!selectedBed ? "Vui lòng chọn Tòa, Phòng và Giường" : "Phê duyệt & xếp phòng")
                }
                className="w-full py-3.5 px-6 rounded-xl bg-[#cde4fd] hover:bg-[#b9d9fc] text-[#1976d2] font-bold text-sm sm:text-base transition-colors duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-[#1976d2]" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <span>Phê duyệt & xếp phòng</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* POPUP REJECT MODAL (NHẬP LÝ DO TỪ CHỐI ĐƠN) */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                Từ chối đơn đăng ký
              </h3>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Vui lòng nhập lý do từ chối đơn đăng ký của sinh viên{" "}
              <strong className="text-slate-800">
                {requestData?.ho_ten || "sinh viên"}
              </strong>
              :
            </p>

            <div>
              <textarea
                rows={4}
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  setRejectError("");
                }}
                placeholder="Ví dụ: Phòng tòa A hiện đã hết giường trống hoặc không đáp ứng tiêu chuẩn ưu tiên..."
                className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-rose-500 focus:bg-white transition resize-none"
              />
              {rejectError && (
                <p className="text-xs text-rose-600 font-medium mt-1">
                  {rejectError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-sm font-semibold transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <span>Xác nhận từ chối</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
