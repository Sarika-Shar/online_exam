import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Login = () => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!usernameOrEmail || !password) {
      setError('Please provide your username/email and password.');
      return;
    }

    try {
      setError('');
      setSubmitting(true);
      const res = await login(usernameOrEmail, password);
      if (res.success) {
        const destination = location.state?.from?.pathname || (res.user.role === 'student' ? '/student/dashboard' : '/admin/dashboard');
        navigate(destination, { replace: true });
      }
    } catch (err) {
      if (!err.response) {
        setError('Unable to reach backend server. Please ensure the backend is running on port 5000.');
      } else {
        setError(err.response?.data?.message || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickFill = (email, pwd) => {
    setUsernameOrEmail(email);
    setPassword(pwd);
    setError('');
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="text-center mb-4">
          <div
            className="bg-primary text-white rounded-4 d-inline-flex align-items-center justify-content-center shadow-sm mb-3"
            style={{ width: '56px', height: '56px', fontSize: '1.75rem' }}
          >
            <i className="bi bi-mortarboard-fill"></i>
          </div>
          <h3 className="fw-bold text-dark mb-1">Welcome to SARBIT INFOTECH</h3>
          <p className="text-muted small">Institutional Online Examination Management Platform</p>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-center py-2 px-3 small rounded-3" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2 fs-5"></i>
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label fw-semibold text-secondary small">Email or Username</label>
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0 text-muted">
                <i className="bi bi-envelope"></i>
              </span>
              <input
                type="text"
                className="form-control bg-light border-start-0"
                placeholder="e.g. admin@apex.edu"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="d-flex justify-content-between">
              <label className="form-label fw-semibold text-secondary small">Password</label>
              <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Please contact your institution administrator to reset your password.'); }} className="text-primary text-decoration-none small">
                Forgot password?
              </a>
            </div>
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0 text-muted">
                <i className="bi bi-lock"></i>
              </span>
              <input
                type="password"
                className="form-control bg-light border-start-0"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100 py-2 fw-semibold shadow-sm rounded-3 d-flex align-items-center justify-content-center gap-2"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In to Portal</span>
                <i className="bi bi-arrow-right"></i>
              </>
            )}
          </button>
        </form>

        {/* Demo Fast-Fill Buttons for Instant Evaluation */}
        <div className="mt-4 pt-3 border-top">
          <p className="text-muted text-uppercase fw-bold text-center mb-2" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>
            Instant Evaluation Roles (1-Click Fill)
          </p>
          <div className="row g-2">
            <div className="col-6">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary w-100 text-truncate text-start px-2 py-1.5 d-flex align-items-center"
                style={{ fontSize: '0.78rem', minHeight: '36px' }}
                onClick={() => handleQuickFill('admin@apex.edu', 'Admin@123')}
              >
                <i className="bi bi-building me-1.5 text-primary flex-shrink-0"></i>
                <span className="text-truncate">Inst. Admin</span>
              </button>
            </div>
            <div className="col-6">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary w-100 text-truncate text-start px-2 py-1.5 d-flex align-items-center"
                style={{ fontSize: '0.78rem', minHeight: '36px' }}
                onClick={() => handleQuickFill('teacher@apex.edu', 'Teacher@123')}
              >
                <i className="bi bi-person-badge me-1.5 text-warning flex-shrink-0"></i>
                <span className="text-truncate">Faculty</span>
              </button>
            </div>
            <div className="col-6">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary w-100 text-truncate text-start px-2 py-1.5 d-flex align-items-center"
                style={{ fontSize: '0.78rem', minHeight: '36px' }}
                onClick={() => handleQuickFill('student1@apex.edu', 'Student@123')}
              >
                <i className="bi bi-backpack me-1.5 text-success flex-shrink-0"></i>
                <span className="text-truncate">Student</span>
              </button>
            </div>
            <div className="col-6">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary w-100 text-truncate text-start px-2 py-1.5 d-flex align-items-center"
                style={{ fontSize: '0.78rem', minHeight: '36px' }}
                onClick={() => handleQuickFill('superadmin@onlineexam.com', 'SuperAdmin@123')}
              >
                <i className="bi bi-shield-lock me-1.5 text-danger flex-shrink-0"></i>
                <span className="text-truncate">Super Admin</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
