import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Edit3,
  Trash2,
  AlertCircle,
  FileText,
  User,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import studentService from '../../services/studentService';
import EditStudentModal from './EditStudentModal';
import ContractDetailPage from '../room/ContractDetailPage';

export default function StudentDetailPage({
  student: initialStudent,
  msv,
  onBack,
  onStudentUpdated,
  onStudentDeleted,
}) {
  const [student, setStudent] = useState(initialStudent || null);
  const [loading, setLoading] = useState(!initialStudent);
  const [errorMsg, setErrorMsg] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [viewingContract, setViewingContract] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const currentMsv = initialStudent?.msv || msv;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const fetchStudentDetail = async () => {
    if (!currentMsv) return;
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await studentService.getStudentDetail(currentMsv);
      if (data) {
        setStudent(data);
      }
    } catch (err) {
      console.error('Error fetching student detail:', err);
      if (!initialStudent) {
        setErrorMsg('Không thể tải thông tin hồ sơ sinh viên.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentDetail();
  }, [currentMsv]);

  if (loading && !student) {
    return (
      <div className="flex-1 bg-[#f4f5f7] rounded-2xl border border-slate-200/60 p-12 text-center min-h-0">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-500">Đang tải hồ sơ sinh viên...</p>
      </div>
    );
  }

  if (errorMsg && !student) {
    return (
      <div className="flex-1 bg-[#f4f5f7] rounded-2xl border border-slate-200/60 p-10 text-center min-h-0">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-800 mb-4">{errorMsg}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2 bg-blue-600 text-white rounded-full text-xs font-semibold hover:bg-blue-700 transition cursor-pointer"
        >
          Quay lại danh sách hồ sơ
        </button>
      </div>
    );
  }

  if (!student) return null;

  // Xử lý xem hợp đồng
  const handleViewContract = () => {
    const roomInfo = student.thong_tin_phong_hien_tai;
    const contractObj = {
      ma_hop_dong: roomInfo?.ma_hop_dong || `HD26-${student.msv}-G1`,
      ho_ten: student.ho_ten,
      msv: student.msv,
      gioi_tinh: student.gioi_tinh,
      ngay_sinh: student.ngay_sinh || '21/01/2006',
      cccd: student.cccd || '019206001234',
      so_dien_thoai: student.so_dien_thoai || '0331 131 211',
      email: student.email || `${student.msv}@lns.edu.vn`,
      khoa: student.khoa || 'Công nghệ thông tin',
      lop: student.lop || 'CNTTK24M',
      lien_he_khan_cap: student.sdt_nguoi_giam_ho
        ? `${student.sdt_nguoi_giam_ho} (${student.moi_quan_he || 'Người thân'})`
        : '0988 765 432 (Bố)',
      dia_chi: student.dia_chi || 'Số 45, Đường Hoàng Văn Thụ, Thái Nguyên',
      phong_giuong: roomInfo
        ? `${roomInfo.ten_toa || 'Tòa A1'} – Phòng ${roomInfo.so_phong || '102'} – ${roomInfo.ten_giuong || 'Giường 1'}`
        : 'Tòa A – Phòng 102 – Giường 1',
      ngay_bat_dau: roomInfo?.ngay_bat_dau ? roomInfo.ngay_bat_dau.split('-').reverse().join('/') : '14/01/2026',
      ngay_ket_thuc: roomInfo?.ngay_ket_thuc ? roomInfo.ngay_ket_thuc.split('-').reverse().join('/') : '13/01/2027',
      trang_thai: 'ACTIVE',
      ma_giuong: roomInfo?.ma_giuong || 'A1_P102_G01',
    };
    setViewingContract(contractObj);
  };

  // Nếu đang xem chi tiết hợp đồng
  if (viewingContract) {
    return (
      <ContractDetailPage
        contract={viewingContract}
        onBack={() => setViewingContract(null)}
        onContractUpdated={async () => {
          setViewingContract(null);
          await fetchStudentDetail();
          showToast('Dữ liệu hợp đồng đã được cập nhật.');
        }}
      />
    );
  }

  // Xử lý xóa sinh viên
  const handleConfirmDelete = async () => {
    try {
      setDeleting(true);
      await studentService.deleteStudent(student.msv);
      setIsDeleteModalOpen(false);
      if (onStudentDeleted) {
        onStudentDeleted(student.msv);
      } else if (onBack) {
        onBack();
      }
    } catch (err) {
      console.error('Error deleting student:', err);
      const detail = err.response?.data?.detail;
      alert(typeof detail === 'string' ? detail : 'Không thể xóa sinh viên.');
    } finally {
      setDeleting(false);
    }
  };

  const roomInfo = student.thong_tin_phong_hien_tai;
  const isAssigned = student.trang_thai_o === 'DANG_O' && roomInfo;

  // Format date helper
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Avatar mặc định hoặc ảnh sinh viên
  const avatarUrl =
    student.anh_dai_dien ||
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200';

  return (
    <div className="flex-1 bg-[#f4f5f7] rounded-2xl border border-slate-200/60 p-7 min-h-0 relative overflow-y-auto flex flex-col animate-in fade-in duration-150">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-emerald-600 text-white text-sm font-semibold rounded-2xl shadow-xl animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header: Back button + Actions */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-slate-800 hover:text-blue-600 transition cursor-pointer group"
          >
            <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
            <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              Hồ sơ sinh viên
            </h1>
          </button>
        </div>

        {/* Action Buttons: Chỉnh sửa & Xóa */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-blue-600 border border-slate-300 rounded-[5px] text-xs font-semibold transition shadow-2xs cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Chỉnh sửa</span>
          </button>

          {!isAssigned && (
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-300 rounded-[5px] text-xs font-semibold transition shadow-2xs cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa hồ sơ</span>
            </button>
          )}
        </div>
      </div>

      {/* Profile Header (Avatar + Name + MSV/Lớp) */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0 bg-slate-200">
          <img
            src={avatarUrl}
            alt={student.ho_ten}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src =
                'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200';
            }}
          />
        </div>
        <div>
          <h2 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
            {student.ho_ten}
          </h2>
          <p className="text-xs lg:text-sm font-medium text-slate-500 mt-0.5">
            MSV: <span className="font-semibold text-slate-700">{student.msv}</span> – Lớp:{' '}
            <span className="font-semibold text-slate-700">{student.lop || 'CNTTK24M'}</span>
            {student.khoa && ` – Khoa: ${student.khoa}`}
          </p>
        </div>
      </div>

      <div className="space-y-6 w-full">
        {/* Khối 1: Thông tin cá nhân */}
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-2">
            Thông tin cá nhân
          </h3>
          <div className="bg-white rounded-[5px] border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="divide-y divide-slate-100">
              <div className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium">Giới tính</span>
                <span className="text-slate-800 font-medium">{student.gioi_tinh || 'Nam'}</span>
              </div>
              <div className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium">Email</span>
                <span className="text-slate-800 font-medium">
                  {student.email || (student.msv ? `${student.msv.toLowerCase()}@ictu.edu.vn` : 'Chưa cập nhật')}
                </span>
              </div>
              <div className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium">Số điện thoại</span>
                <span className="text-slate-800 font-medium">
                  {student.so_dien_thoai || '0331 131 211'}
                </span>
              </div>
              <div className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium">Ngày sinh</span>
                <span className="text-slate-800 font-medium">
                  {student.ngay_sinh ? formatDateDisplay(student.ngay_sinh) : '21/01/2006'}
                </span>
              </div>
              <div className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium">Số CCCD / Định danh</span>
                <span className="text-slate-800 font-medium">
                  {student.cccd || '019206001234'}
                </span>
              </div>
              <div className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium">Quê quán</span>
                <span className="text-slate-800 font-medium">
                  {student.que_quan || 'Thái Nguyên'}
                </span>
              </div>
              <div className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium">Địa chỉ</span>
                <span className="text-slate-800 font-medium">
                  {student.dia_chi || 'Số 45, Đường Hoàng Văn Thụ, Thái Nguyên'}
                </span>
              </div>
              <div className="px-5 py-3 flex items-center justify-between text-sm">
                <span className="text-slate-600 font-medium">Thông tin liên hệ khẩn cấp</span>
                <span className="text-slate-800 font-medium">
                  {student.sdt_nguoi_giam_ho
                    ? `${student.sdt_nguoi_giam_ho}${
                        student.nguoi_giam_ho || student.moi_quan_he
                          ? ` (${[student.moi_quan_he, student.nguoi_giam_ho].filter(Boolean).join(' - ')})`
                          : ''
                      }`
                    : student.nguoi_giam_ho
                    ? `${student.nguoi_giam_ho}${student.moi_quan_he ? ` (${student.moi_quan_he})` : ''}`
                    : '0988 765 432 (Bố - Hoàng Văn Hùng)'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Khối 2: Phòng ở hiện tại */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-slate-900">
              Phòng ở hiện tại
            </h3>
            {isAssigned && (
              <button
                type="button"
                onClick={handleViewContract}
                className="text-sky-600 hover:text-sky-800 text-xs font-semibold transition cursor-pointer"
              >
                Xem hợp đồng
              </button>
            )}
          </div>

          <div className="bg-white rounded-[5px] border border-slate-200/80 shadow-2xs p-5">
            {isAssigned ? (
              <div>
                <div className="text-sm lg:text-base font-medium text-slate-900">
                  {roomInfo.ten_toa
                    ? (roomInfo.ten_toa.startsWith('Tòa') ? roomInfo.ten_toa : `Tòa ${roomInfo.ten_toa}`)
                    : 'Tòa A1'}{' '}
                  – Phòng {roomInfo.so_phong || '102'} – {roomInfo.ten_giuong || 'Giường 1'}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Hiệu lực đến{' '}
                  {formatDateDisplay(roomInfo.ngay_ket_thuc) || '13/01/2027'}
                </div>
              </div>
            ) : student.trang_thai_o === 'DA_TRA_PHONG' ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      Đã trả phòng
                    </span>
                  </div>
                  {roomInfo && (
                    <p className="text-xs text-slate-500 mt-1.5">
                      Phòng đã lưu trú trước đây:{' '}
                      <span className="font-semibold text-slate-700">
                        {roomInfo.ten_toa || 'Tòa A1'} – Phòng {roomInfo.so_phong || '101'} – {roomInfo.ten_giuong || 'Giường 4'}
                      </span>
                    </p>
                  )}
                </div>
                {roomInfo && (
                  <button
                    type="button"
                    onClick={handleViewContract}
                    className="text-sky-600 hover:text-sky-800 text-xs font-semibold transition cursor-pointer"
                  >
                    Xem hợp đồng cũ
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-amber-500">Chưa xếp phòng</span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Sinh viên này hiện chưa được xếp phòng lưu trú trong ký túc xá.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-[5px] text-xs font-medium transition cursor-pointer"
                >
                  Cập nhật xếp phòng
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Khối 3: Phản ánh đã gửi */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-slate-900">
              Phản ánh đã gửi
            </h3>
            <span className="text-sky-600 text-xs font-semibold">
              {student.phan_anhs && student.phan_anhs.length > 0
                ? `${student.phan_anhs.length} phản ánh`
                : '0 phản ánh'}
            </span>
          </div>

          <div className="bg-white rounded-[5px] border border-slate-200/80 shadow-2xs overflow-hidden">
            {student.phan_anhs && student.phan_anhs.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {student.phan_anhs.map((pa, idx) => {
                  const isDone =
                    pa.trang_thai?.toLowerCase().includes('đã xử lý') ||
                    pa.trang_thai?.toLowerCase().includes('da xu ly') ||
                    pa.trang_thai === 'DA_XU_LY';
                  return (
                    <div
                      key={pa.ma_phan_anh || idx}
                      className="px-5 py-3 flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-800 font-medium">{pa.noi_dung}</span>
                      <span
                        className={`text-xs font-semibold ${
                          isDone ? 'text-emerald-600' : 'text-amber-500'
                        }`}
                      >
                        {isDone ? 'Đã xử lý' : 'Đang xử lý'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-4 text-xs text-slate-400">
                Chưa có phản ánh nào được ghi nhận.
              </div>
            )}
          </div>
        </div>

        {/* Khối 4: Vi phạm nội quy */}
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-2">
            Vi phạm nội quy
          </h3>
          <div className="bg-white rounded-[5px] border border-slate-200/80 shadow-2xs p-5">
            {student.vi_phams && student.vi_phams.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {student.vi_phams.map((vp, idx) => (
                  <div key={vp.ma_vi_pham || idx} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{vp.mo_ta}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Ngày: {vp.ngay_vi_pham}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-rose-600">
                      {vp.hinh_thuc_xu_ly}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-700 font-medium">
                Không có vi phạm nào được ghi nhận.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Edit Student Modal */}
      <EditStudentModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        student={student}
        onStudentUpdated={(updated) => {
          setStudent(updated);
          if (onStudentUpdated) onStudentUpdated(updated);
          showToast('Đã cập nhật thông tin sinh viên thành công!');
        }}
      />

      {/* Confirm Delete Modal */}
      {isDeleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setIsDeleteModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-center text-slate-900 mb-2">
              Xác nhận xóa hồ sơ sinh viên
            </h3>
            <p className="text-sm text-center text-slate-500 mb-6">
              Bạn có chắc chắn muốn xóa hồ sơ của sinh viên{' '}
              <span className="font-bold text-slate-800">{student.ho_ten}</span> (MSV: {student.msv})? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-full transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-full transition shadow-md cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
