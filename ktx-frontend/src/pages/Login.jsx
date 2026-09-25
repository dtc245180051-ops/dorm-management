import { useState } from 'react';
import './Auth.css';
import { authService } from '../services/authService';

export default function Login() {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'

  // State form Đăng nhập
  const [loginForm, setLoginForm] = useState({
    identifier: '',
    password: '',
  });

  // State form Đăng ký
  const [registerForm, setRegisterForm] = useState({
    fullName: '',
    gender: 'Nữ',
    emailOrPhone: '',
    password: '',
    confirmPassword: '',
  });

  // State hiển thị mật khẩu
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // State loading & thông báo
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' }); // type: 'error' | 'success' | 'info'
  const [, setCurrentUser] = useState(null);

  // Xử lý thay đổi form Đăng nhập
  const handleLoginChange = (e) => {
    setLoginForm({ ...loginForm, [e.target.name]: e.target.value });
    if (message.text) setMessage({ type: '', text: '' });
  };

  // Xử lý thay đổi form Đăng ký
  const handleRegisterChange = (e) => {
    setRegisterForm({ ...registerForm, [e.target.name]: e.target.value });
    if (message.text) setMessage({ type: '', text: '' });
  };

  // Submit Đăng nhập
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginForm.identifier.trim() || !loginForm.password) {
      setMessage({ type: 'error', text: 'Vui lòng nhập đầy đủ tài khoản và mật khẩu.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    const result = await authService.login(loginForm.identifier, loginForm.password);
    setLoading(false);

    if (result.success) {
      setMessage({
        type: 'success',
        text: `Đăng nhập thành công! Xin chào ${result.data.username} (${result.data.role}).`,
      });
      setCurrentUser(result.data);
    } else {
      setMessage({
        type: 'error',
        text: result.message || 'Tên đăng nhập hoặc mật khẩu không chính xác.',
      });
    }
  };

  // Submit Đăng ký
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    const { fullName, gender, emailOrPhone, password, confirmPassword } = registerForm;

    if (!fullName.trim() || !emailOrPhone.trim() || !password) {
      setMessage({ type: 'error', text: 'Vui lòng điền đầy đủ các thông tin bắt buộc.' });
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Mật khẩu phải có độ dài ít nhất 6 ký tự.' });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Nhập lại mật khẩu không trùng khớp.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    const result = await authService.register({
      fullName,
      gender,
      emailOrPhone,
      password,
    });
    setLoading(false);

    if (result.success) {
      setMessage({
        type: 'success',
        text: 'Đăng ký tài khoản thành công! Bạn có thể chuyển sang tab Đăng nhập ngay bây giờ.',
      });
      // Điền sẵn thông tin vào login form và chuyển tab
      setLoginForm({ identifier: emailOrPhone, password: '' });
      setTimeout(() => {
        setActiveTab('login');
      }, 1500);
    } else {
      setMessage({
        type: 'error',
        text: result.message || 'Đăng ký không thành công. Vui lòng kiểm tra lại.',
      });
    }
  };

  const handleGoogleAuth = () => {
    setMessage({
      type: 'info',
      text: 'Tính năng Đăng nhập / Đăng ký với Google đang được phát triển.',
    });
  };

  const handleForgotPassword = () => {
    setMessage({
      type: 'info',
      text: 'Vui lòng liên hệ ban quản lý KTX hoặc quản trị viên để hỗ trợ đặt lại mật khẩu.',
    });
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* ================= CỘT TRÁI: GIỚI THIỆU KÝ TÚC XÁ ================= */}
        <div className="auth-left">
          {/* Logo & Tên KTX */}
          <div className="brand-header">
            <div className="brand-icon-wrapper">
              <svg className="brand-icon-svg" viewBox="0 0 48 48" fill="none">
                <path
                  d="M8 20L24 6L40 20V42H8V20Z"
                  fill="#1d70f5"
                />
                <path
                  d="M19 42V26H29V42H19Z"
                  fill="#ffffff"
                />
              </svg>
            </div>
            <div className="brand-text">
              <span className="brand-title">KTX</span>
              <span className="brand-subtitle">Hệ thống ký túc xá</span>
            </div>
          </div>

          {/* Tiêu đề chào mừng */}
          <div className="welcome-section">
            <h1 className="welcome-title-line1">Chào mừng bạn đến với</h1>
            <h2 className="welcome-title-line2">Ký túc xá ICTU</h2>
          </div>

          {/* Giới thiệu ngắn */}
          <p className="welcome-desc">
            KTX - Giúp sinh viên dễ dàng đăng ký phòng, tra cứu thông tin và quản lý các dịch vụ trong khu ký túc xá.
          </p>

          {/* 4 Tính năng minh họa */}
          <div className="features-grid">
            {/* 1. Đăng ký phòng */}
            <div className="feature-item">
              <div className="feature-circle blue">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4v16" />
                  <path d="M2 8h18a2 2 0 0 1 2 2v10" />
                  <path d="M2 17h20" />
                  <path d="M6 8v9" />
                </svg>
              </div>
              <span className="feature-name">Đăng ký phòng</span>
              <span className="feature-caption">Nhanh chóng, thuận tiện</span>
            </div>

            {/* 2. Tra cứu thông tin */}
            <div className="feature-item">
              <div className="feature-circle green">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <line x1="10" y1="9" x2="8" y2="9" />
                </svg>
              </div>
              <span className="feature-name">Tra cứu thông tin</span>
              <span className="feature-caption">Phòng, giường, sinh viên,...</span>
            </div>

            {/* 3. Thanh toán */}
            <div className="feature-item">
              <div className="feature-circle purple">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v10" />
                  <path d="M15 9.5a2.5 2.5 0 0 0-5 0c0 2 3 2.5 3 4.5a2.5 2.5 0 0 1-5 0" />
                </svg>
              </div>
              <span className="feature-name">Thanh toán</span>
              <span className="feature-caption">An toàn, linh hoạt</span>
            </div>

            {/* 4. Quản lý dễ dàng */}
            <div className="feature-item">
              <div className="feature-circle amber">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <span className="feature-name">Quản lý dễ dàng</span>
              <span className="feature-caption">Minh bạch, hiệu quả</span>
            </div>
          </div>
        </div>

        {/* ================= CỘT PHẢI: FORM ĐĂNG NHẬP / ĐĂNG KÝ ================= */}
        <div className="auth-right">
          {/* Thanh Tab Đăng nhập / Đăng ký */}
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              className={`auth-tab-btn ${activeTab === 'login' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('login');
                setMessage({ type: '', text: '' });
              }}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('register');
                setMessage({ type: '', text: '' });
              }}
            >
              Đăng ký
            </button>
          </div>

          {/* Banner thông báo */}
          {message.text && (
            <div className={`auth-alert ${message.type}`}>
              <span>{message.text}</span>
            </div>
          )}

          {/* Wrapper chứa Form để giữ cố định chiều cao */}
          <div className="auth-form-wrapper">
            {activeTab === 'login' ? (
              /* ================= FORM ĐĂNG NHẬP ================= */
              <form className="auth-form login-form" onSubmit={handleLoginSubmit}>
                <div className="form-fields login-fields">
                  {/* Email / Số điện thoại */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="login-identifier">Email / Số điện thoại</label>
                    <div className="input-wrapper">
                      <input
                        id="login-identifier"
                        name="identifier"
                        type="text"
                        className="form-input"
                        placeholder="Nhập email hoặc số điện thoại"
                        value={loginForm.identifier}
                        onChange={handleLoginChange}
                        required
                      />
                    </div>
                  </div>

                  {/* Mật khẩu */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="login-password">Mật khẩu</label>
                    <div className="input-wrapper">
                      <input
                        id="login-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        className="form-input"
                        placeholder="Nhập mật khẩu"
                        value={loginForm.password}
                        onChange={handleLoginChange}
                        required
                      />
                      <button
                        type="button"
                        className="input-icon-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {showPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <div className="forgot-pwd-wrapper">
                      <button
                        type="button"
                        className="forgot-pwd-link"
                        onClick={handleForgotPassword}
                      >
                        Quên mật khẩu?
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  {/* Nút Đăng nhập */}
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={loading}
                  >
                    {loading ? <span className="spinner"></span> : 'Đăng nhập'}
                  </button>

                  {/* Hoặc */}
                  <div className="divider-or">
                    <div className="divider-line"></div>
                    <span className="divider-text">Hoặc</span>
                    <div className="divider-line"></div>
                  </div>

                  {/* Nút Google */}
                  <button
                    type="button"
                    className="google-btn"
                    onClick={handleGoogleAuth}
                  >
                    <svg className="google-icon-svg" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Đăng nhập với Google</span>
                  </button>

                  {/* Chuyển sang Đăng ký */}
                  <div className="switch-auth-text">
                    Bạn chưa có tài khoản?{' '}
                    <button
                      type="button"
                      className="switch-auth-link"
                      onClick={() => {
                        setActiveTab('register');
                        setMessage({ type: '', text: '' });
                      }}
                    >
                      Đăng ký
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              /* ================= FORM ĐĂNG KÝ ================= */
              <form className="auth-form register-form" onSubmit={handleRegisterSubmit}>
                <div className="form-fields register-fields">
                  {/* Họ tên & Giới tính */}
                  <div className="form-row-2col-equal">
                    <div className="form-group">
                      <label className="form-label" htmlFor="register-fullname">Họ tên</label>
                      <div className="input-wrapper">
                        <input
                          id="register-fullname"
                          name="fullName"
                          type="text"
                          className="form-input"
                          placeholder="Nhập họ và tên"
                          value={registerForm.fullName}
                          onChange={handleRegisterChange}
                          required
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label" htmlFor="register-gender">Giới tính</label>
                      <div className="input-wrapper">
                        <select
                          id="register-gender"
                          name="gender"
                          className="form-select"
                          value={registerForm.gender}
                          onChange={handleRegisterChange}
                        >
                          <option value="Nữ">Nữ</option>
                          <option value="Nam">Nam</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Email / Số điện thoại */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="register-emailOrPhone">Email / Số điện thoại</label>
                    <div className="input-wrapper">
                      <input
                        id="register-emailOrPhone"
                        name="emailOrPhone"
                        type="text"
                        className="form-input"
                        placeholder="Nhập email hoặc số điện thoại"
                        value={registerForm.emailOrPhone}
                        onChange={handleRegisterChange}
                        required
                      />
                    </div>
                  </div>

                  {/* Mật khẩu mới & Nhập lại mật khẩu */}
                  <div className="form-row-2col-equal">
                    <div className="form-group">
                      <label className="form-label" htmlFor="register-password">Mật khẩu mới</label>
                      <div className="input-wrapper">
                        <input
                          id="register-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          className="form-input"
                          placeholder="Nhập mật khẩu"
                          value={registerForm.password}
                          onChange={handleRegisterChange}
                          required
                        />
                        <button
                          type="button"
                          className="input-icon-btn"
                          onClick={() => setShowPassword(!showPassword)}
                          title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          {showPassword ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="register-confirmPassword">Nhập lại mật khẩu</label>
                      <div className="input-wrapper">
                        <input
                          id="register-confirmPassword"
                          name="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          className="form-input"
                          placeholder="Nhập lại mật khẩu"
                          value={registerForm.confirmPassword}
                          onChange={handleRegisterChange}
                          required
                        />
                        <button
                          type="button"
                          className="input-icon-btn"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          {showConfirmPassword ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                              <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  {/* Nút Đăng ký */}
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={loading}
                  >
                    {loading ? <span className="spinner"></span> : 'Đăng ký'}
                  </button>

                  {/* Hoặc */}
                  <div className="divider-or">
                    <div className="divider-line"></div>
                    <span className="divider-text">Hoặc</span>
                    <div className="divider-line"></div>
                  </div>

                  {/* Nút Google */}
                  <button
                    type="button"
                    className="google-btn"
                    onClick={handleGoogleAuth}
                  >
                    <svg className="google-icon-svg" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Đăng Ký với Google</span>
                  </button>

                  {/* Chuyển sang Đăng nhập */}
                  <div className="switch-auth-text">
                    Bạn đã có tài khoản?{' '}
                    <button
                      type="button"
                      className="switch-auth-link"
                      onClick={() => {
                        setActiveTab('login');
                        setMessage({ type: '', text: '' });
                      }}
                    >
                      Đăng nhập
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
