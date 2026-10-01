import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Layers,
  Phone,
  Mail,
  Edit3,
  Calendar,
  XCircle,
  Users,
  Home,
  GraduationCap,
  Camera,
  X,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import StudentLayout from '../../layouts/Student';
import occupancyService from '../../services/occupancyService';

const STUDENT_AVATAR_STORAGE_KEY = 'ktx_student_avatar';

export default function StudentProfilePage({ onSelectTab }) {
  // 1. Dữ liệu hồ sơ sinh viên
  const [profile, setProfile] = useState({
    ho_ten: 'Nguyễn Văn A',
    vai_tro: 'Sinh viên',
    msv: 'DTCxxxxxxxxx',
    lop: 'CNTT K23A',
    so_dien_thoai: '09xxxxxxxx',
    email: 'DTCxxxxxxxxx@ictu.edu.vn',
    ngay_sinh: '12/07/2007',
    gioi_tinh: 'Nữ',
    dan_toc: 'Kinh',
    que_quan: 'Xã A - Tỉnh Bắc Ninh',
    khoa: 'CNTT',
    avatar_url: '/avatar.png',
  });

  // 2. Dữ liệu phòng ở (đồng bộ với occupancyService)
  const [roomInfo, setRoomInfo] = useState({
    toa: 'A2',
    so_phong: '36',
    tang: '3',
    giuong: '4',
    ngay_nhan_phong: '01/09/2024',
  });

  // 3. State modal chỉnh sửa & Toast
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({ ...profile });
  const [toastMessage, setToastMessage] = useState(null);
  const avatarInputRef = useRef(null);
  const modalAvatarInputRef = useRef(null);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Tải dữ liệu ban đầu và lắng nghe sự kiện đồng bộ phòng ở
  useEffect(() => {
    loadData();

    const handleOccupancyUpdate = () => {
      loadData();
    };

    window.addEventListener('occupancy-updated', handleOccupancyUpdate);
    return () => {
      window.removeEventListener('occupancy-updated', handleOccupancyUpdate);
    };
  }, []);

  const loadData = async () => {
    try {
      // 1. Tải hồ sơ sinh viên
      if (occupancyService.getStudentProfile) {
        const student = await occupancyService.getStudentProfile();
        if (student) {
          const savedAvatar = localStorage.getItem(STUDENT_AVATAR_STORAGE_KEY);
          const studentProfile = {
            ...student,
            avatar_url: savedAvatar || student.avatar_url || '/avatar.png',
          };
          setProfile(studentProfile);
          setEditFormData(studentProfile);
          if (studentProfile.avatar_url) {
            localStorage.setItem(STUDENT_AVATAR_STORAGE_KEY, studentProfile.avatar_url);
            window.dispatchEvent(
              new CustomEvent('student-avatar-updated', {
                detail: { avatarUrl: studentProfile.avatar_url },
              }),
            );
          }
        }
      }

      // 2. Tải thông tin phòng ở hiện tại
      if (occupancyService.getCurrentRoomInfo) {
        const currentRoom = await occupancyService.getCurrentRoomInfo();
        if (currentRoom) {
          const rawToa = currentRoom.toa || 'A2';
          const cleanToa = rawToa.replace('Tòa ', '').trim();
          const rawPhong = currentRoom.so_phong || currentRoom.phong || '36';
          const cleanPhong = rawPhong.replace(/^P/i, '').trim();
          const rawGiuong = currentRoom.giuong || '4';
          const cleanGiuong = rawGiuong.replace(/^G/i, '').replace(/^0+/, '').trim() || '4';

          setRoomInfo({
            toa: cleanToa || 'A2',
            so_phong: cleanPhong || '36',
            tang: currentRoom.tang || '3',
            giuong: cleanGiuong || '4',
            ngay_nhan_phong: currentRoom.ngay_nhan_phong || '01/09/2024',
          });
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải thông tin cá nhân / phòng ở:', err);
    }
  };

  // Xử lý upload ảnh đại diện
  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const newAvatarUrl = event.target?.result;
      if (newAvatarUrl) {
        const updated = { ...profile, avatar_url: newAvatarUrl };
        setProfile(updated);
        setEditFormData((prev) => ({ ...prev, avatar_url: newAvatarUrl }));
        localStorage.setItem(STUDENT_AVATAR_STORAGE_KEY, newAvatarUrl);
        window.dispatchEvent(
          new CustomEvent('student-avatar-updated', {
            detail: { avatarUrl: newAvatarUrl },
          }),
        );

        if (occupancyService.updateStudentProfile) {
          await occupancyService.updateStudentProfile(updated);
        }
        showToast('Cập nhật ảnh đại diện thành công!');
      }
    };
    reader.readAsDataURL(file);
  };

  // Mở modal chỉnh sửa
  const handleOpenEditModal = () => {
    setEditFormData({ ...profile });
    setIsEditModalOpen(true);
  };

  // Xử lý thay đổi input trong modal
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Lưu thông tin chỉnh sửa
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      // Chỉ cập nhật các trường được phép sửa
      const updatedProfile = {
        ...profile,
        so_dien_thoai: editFormData.so_dien_thoai,
        email: editFormData.email,
        que_quan: editFormData.que_quan,
        dan_toc: editFormData.dan_toc || profile.dan_toc,
        avatar_url: editFormData.avatar_url || profile.avatar_url,
      };

      setProfile(updatedProfile);
      if (updatedProfile.avatar_url) {
        localStorage.setItem(STUDENT_AVATAR_STORAGE_KEY, updatedProfile.avatar_url);
        window.dispatchEvent(
          new CustomEvent('student-avatar-updated', {
            detail: { avatarUrl: updatedProfile.avatar_url },
          }),
        );
      }

      if (occupancyService.updateStudentProfile) {
        await occupancyService.updateStudentProfile(updatedProfile);
      }

      setIsEditModalOpen(false);
      showToast('Cập nhật thông tin cá nhân thành công!');
    } catch (err) {
      console.error('Lỗi lưu thông tin cá nhân:', err);
    }
  };

  return (
    <StudentLayout
      activeTab="profile"
      onSelectTab={onSelectTab}
      userName={profile.ho_ten}
      userRole={profile.vai_tro || 'Sinh viên'}
    >
      <div className="space-y-6 pb-12 animate-in fade-in duration-300">
        {/* ========================================================================= */}
        {/* 1. TIÊU ĐỀ TRANG: ICON NGƯỜI DÙNG USER + TIÊU ĐỀ THÔNG TIN CÁ NHÂN         */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-3.5 select-none pt-1">
          <User className="w-8 h-8 text-blue-600 stroke-[2.3]" />
          <h1 className="text-2xl sm:text-[26px] font-black text-[#0f3b79] tracking-tight">
            Thông tin cá nhân
          </h1>
        </div>

        {/* ========================================================================= */}
        {/* 2. THẺ HỒ SƠ TỔNG QUAN (TOP PROFILE CARD)                                  */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          {/* Cột trái: Avatar tròn lớn kèm nút Camera */}
          <div className="relative shrink-0 select-none">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border-4 border-blue-100 overflow-hidden shadow-xs flex items-center justify-center bg-blue-50">
              <img
                src={profile.avatar_url || '/avatar.png'}
                alt="Avatar Sinh viên"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/avatar.png';
                }}
              />
            </div>
            {/* Nút tròn nhỏ màu xanh dương kèm icon máy ảnh Camera */}
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-105 active:scale-95"
              title="Tải ảnh đại diện mới"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              type="file"
              ref={avatarInputRef}
              onChange={handleAvatarUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* Cột giữa: Họ tên lớn, badge Sinh viên & Danh sách thông tin nhanh có icon */}
          <div className="flex-1 space-y-3 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
              <h2 className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight">
                {profile.ho_ten}
              </h2>
              {/* Badge bo tròn màu xanh dương nhạt */}
              <span className="bg-blue-100 text-blue-600 rounded-full px-3 py-0.5 text-xs font-semibold select-none">
                {profile.vai_tro || 'Sinh viên'}
              </span>
            </div>

            <div className="space-y-1.5 text-sm text-slate-600">
              <div className="flex items-center justify-center md:justify-start gap-2.5">
                <User className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Mã sinh viên:{' '}
                  <strong className="text-slate-800 font-semibold">{profile.msv}</strong>
                </span>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-2.5">
                <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Lớp:{' '}
                  <strong className="text-slate-800 font-semibold">{profile.lop}</strong>
                </span>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-2.5">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Số điện thoại:{' '}
                  <strong className="text-slate-800 font-semibold">{profile.so_dien_thoai}</strong>
                </span>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-2.5">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  Email:{' '}
                  <strong className="text-slate-800 font-semibold">{profile.email}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Cột phải: Nút Chỉnh sửa */}
          <div className="shrink-0 self-center md:self-start">
            <button
              type="button"
              onClick={handleOpenEditModal}
              className="bg-blue-50 text-blue-600 border border-blue-200/60 rounded-xl px-4 py-2 font-semibold hover:bg-blue-100 transition flex items-center gap-2 text-sm cursor-pointer shadow-2xs"
            >
              <Edit3 className="w-4 h-4" />
              <span>Chỉnh sửa</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. KHỐI THÔNG TIN CHI TIẾT (DETAILED INFORMATION)                          */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-4 tracking-tight">
            Thông tin chi tiết
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Cột trái */}
            <div className="space-y-3">
              {/* Họ tên */}
              <div className="bg-[#f0f6fe] rounded-full px-5 py-3 flex items-center justify-between text-sm transition-colors hover:bg-[#eaf2fd]">
                <div className="flex items-center gap-3 text-slate-500 font-medium">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Họ tên</span>
                </div>
                <span className="font-semibold text-slate-800">{profile.ho_ten}</span>
              </div>

              {/* Ngày sinh */}
              <div className="bg-[#f0f6fe] rounded-full px-5 py-3 flex items-center justify-between text-sm transition-colors hover:bg-[#eaf2fd]">
                <div className="flex items-center gap-3 text-slate-500 font-medium">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Ngày sinh</span>
                </div>
                <span className="font-semibold text-slate-800">{profile.ngay_sinh}</span>
              </div>

              {/* Giới tính */}
              <div className="bg-[#f0f6fe] rounded-full px-5 py-3 flex items-center justify-between text-sm transition-colors hover:bg-[#eaf2fd]">
                <div className="flex items-center gap-3 text-slate-500 font-medium">
                  <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Giới tính</span>
                </div>
                <span className="font-semibold text-slate-800">{profile.gioi_tinh}</span>
              </div>

              {/* Dân tộc */}
              <div className="bg-[#f0f6fe] rounded-full px-5 py-3 flex items-center justify-between text-sm transition-colors hover:bg-[#eaf2fd]">
                <div className="flex items-center gap-3 text-slate-500 font-medium">
                  <Users className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Dân tộc</span>
                </div>
                <span className="font-semibold text-slate-800">{profile.dan_toc}</span>
              </div>

              {/* Quê quán */}
              <div className="bg-[#f0f6fe] rounded-full px-5 py-3 flex items-center justify-between text-sm transition-colors hover:bg-[#eaf2fd]">
                <div className="flex items-center gap-3 text-slate-500 font-medium">
                  <Home className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Quê quán</span>
                </div>
                <span className="font-semibold text-slate-800">{profile.que_quan}</span>
              </div>
            </div>

            {/* Cột phải */}
            <div className="space-y-3">
              {/* Khoa / Viện */}
              <div className="bg-[#f0f6fe] rounded-full px-5 py-3 flex items-center justify-between text-sm transition-colors hover:bg-[#eaf2fd]">
                <div className="flex items-center gap-3 text-slate-500 font-medium">
                  <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Khoa / Viện</span>
                </div>
                <span className="font-semibold text-slate-800">{profile.khoa}</span>
              </div>

              {/* Lớp */}
              <div className="bg-[#f0f6fe] rounded-full px-5 py-3 flex items-center justify-between text-sm transition-colors hover:bg-[#eaf2fd]">
                <div className="flex items-center gap-3 text-slate-500 font-medium">
                  <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Lớp</span>
                </div>
                <span className="font-semibold text-slate-800">{profile.lop}</span>
              </div>

              {/* Mã sinh viên */}
              <div className="bg-[#f0f6fe] rounded-full px-5 py-3 flex items-center justify-between text-sm transition-colors hover:bg-[#eaf2fd]">
                <div className="flex items-center gap-3 text-slate-500 font-medium">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Mã sinh viên</span>
                </div>
                <span className="font-semibold text-slate-800">{profile.msv}</span>
              </div>

              {/* Số điện thoại */}
              <div className="bg-[#f0f6fe] rounded-full px-5 py-3 flex items-center justify-between text-sm transition-colors hover:bg-[#eaf2fd]">
                <div className="flex items-center gap-3 text-slate-500 font-medium">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Số điện thoại</span>
                </div>
                <span className="font-semibold text-slate-800">{profile.so_dien_thoai}</span>
              </div>

              {/* Email */}
              <div className="bg-[#f0f6fe] rounded-full px-5 py-3 flex items-center justify-between text-sm transition-colors hover:bg-[#eaf2fd]">
                <div className="flex items-center gap-3 text-slate-500 font-medium">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Email</span>
                </div>
                <span className="font-semibold text-slate-800">{profile.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. KHỐI THÔNG TIN PHÒNG Ở (ROOM INFORMATION)                               */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-xs">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-5 tracking-tight">
            Thông tin phòng ở
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 text-left">
            {/* Tòa KTX */}
            <div>
              <span className="text-xs text-slate-400 block mb-1.5 font-medium">Tòa KTX</span>
              <span className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
                {roomInfo.toa}
              </span>
            </div>

            {/* Phòng */}
            <div>
              <span className="text-xs text-slate-400 block mb-1.5 font-medium">Phòng</span>
              <span className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
                {roomInfo.so_phong}
              </span>
            </div>

            {/* Tầng */}
            <div>
              <span className="text-xs text-slate-400 block mb-1.5 font-medium">Tầng</span>
              <span className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
                {roomInfo.tang}
              </span>
            </div>

            {/* Giường */}
            <div>
              <span className="text-xs text-slate-400 block mb-1.5 font-medium">Giường</span>
              <span className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
                {roomInfo.giuong}
              </span>
            </div>

            {/* Ngày nhận phòng */}
            <div>
              <span className="text-xs text-slate-400 block mb-1.5 font-medium">Ngày nhận phòng</span>
              <span className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">
                {roomInfo.ngay_nhan_phong}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. MODAL CHỈNH SỬA THÔNG TIN CÁ NHÂN                                      */}
      {/* ========================================================================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200/80 animate-in zoom-in-95 duration-200">
            {/* Header modal */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Edit3 className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-lg text-slate-900">
                  Chỉnh sửa thông tin cá nhân
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="mt-5 space-y-4 text-xs sm:text-sm">
              {/* Ảnh đại diện preview & chọn ảnh */}
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-14 h-14 rounded-full border-2 border-blue-200 overflow-hidden bg-white shrink-0">
                  <img
                    src={editFormData.avatar_url || '/avatar.png'}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/avatar.png';
                    }}
                  />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-slate-700 block mb-1">
                    Ảnh đại diện
                  </span>
                  <button
                    type="button"
                    onClick={() => modalAvatarInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg transition cursor-pointer"
                  >
                    Chọn ảnh mới...
                  </button>
                  <input
                    type="file"
                    ref={modalAvatarInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        if (event.target?.result) {
                          setEditFormData((prev) => ({
                            ...prev,
                            avatar_url: event.target.result,
                          }));
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Các trường cố định (Không được sửa) */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-0.5 flex items-center gap-1 font-medium">
                    <Lock className="w-3 h-3 text-slate-400" /> Mã sinh viên (Cố định)
                  </span>
                  <span className="font-semibold text-slate-700 text-xs sm:text-sm">
                    {profile.msv}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block mb-0.5 flex items-center gap-1 font-medium">
                    <Lock className="w-3 h-3 text-slate-400" /> Họ tên (Cố định)
                  </span>
                  <span className="font-semibold text-slate-700 text-xs sm:text-sm">
                    {profile.ho_ten}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block mb-0.5 flex items-center gap-1 font-medium">
                    <Lock className="w-3 h-3 text-slate-400" /> Khoa / Viện (Cố định)
                  </span>
                  <span className="font-semibold text-slate-700 text-xs sm:text-sm">
                    {profile.khoa}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block mb-0.5 flex items-center gap-1 font-medium">
                    <Lock className="w-3 h-3 text-slate-400" /> Lớp (Cố định)
                  </span>
                  <span className="font-semibold text-slate-700 text-xs sm:text-sm">
                    {profile.lop}
                  </span>
                </div>
              </div>

              {/* Các trường cho phép chỉnh sửa */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="so_dien_thoai"
                  value={editFormData.so_dien_thoai}
                  onChange={handleInputChange}
                  required
                  placeholder="Nhập số điện thoại"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Email liên hệ <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={editFormData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="Nhập email"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Quê quán / Địa chỉ thường trú <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="que_quan"
                  value={editFormData.que_quan}
                  onChange={handleInputChange}
                  required
                  placeholder="Nhập quê quán (Xã, Huyện, Tỉnh)"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Dân tộc
                </label>
                <input
                  type="text"
                  name="dan_toc"
                  value={editFormData.dan_toc}
                  onChange={handleInputChange}
                  placeholder="VD: Kinh"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                />
              </div>

              {/* Nút hành động */}
              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100 select-none">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold text-xs sm:text-sm rounded-xl transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-xs transition cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TOAST THÔNG BÁO THÀNH CÔNG                                             */}
      {/* ========================================================================= */}
      {toastMessage && (
        <div className="fixed bottom-6 right-8 z-60 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl text-xs sm:text-sm animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}
    </StudentLayout>
  );
}
