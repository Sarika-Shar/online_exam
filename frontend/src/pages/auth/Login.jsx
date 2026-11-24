import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Login = () => {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [retryStatus, setRetryStatus] = useState(null);
  const [retryCountdown, setRetryCountdown] = useState(0);

  const retryTimeoutRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Pre-warm backend API health check silently when login page opens
    fetch('/api/health').catch(() => {});

    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const executeLogin = async (attempt = 1) => {
    if (!usernameOrEmail || !password) {
      setError('Please provide your username/email and password.');
      return;
    }

    try {
      setError('');
      setSubmitting(true);
      const res = await login(usernameOrEmail, password);
      if (res.success) {
        setRetryStatus(null);
        const destination = location.state?.from?.pathname || (res.user.role === 'student' ? '/student/dashboard' : '/admin/dashboard');
        navigate(destination, { replace: true });
      }
    } catch (err) {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isColdStart = (err.response && [502, 503, 504].includes(err.response.status)) || (!err.response && !isLocalhost);

      if (isColdStart && !isLocalhost && attempt < 7) {
        setRetryStatus({ attempt, max: 7 });
        setRetryCountdown(6);
        let seconds = 6;

        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = setInterval(() => {
          seconds -= 1;
          setRetryCountdown(seconds);
          if (seconds <= 0) {
            clearInterval(countdownIntervalRef.current);
          }
        }, 1000);

        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = setTimeout(() => {
          executeLogin(attempt + 1);
        }, 6000);
        return;
      }

      setRetryStatus(null);
      setSubmitting(false);

      if (!err.response) {
        if (isLocalhost) {
          setError('Unable to reach local backend server. Please ensure the backend is running on port 5000.');
        } else {
          setError('Unable to reach backend server. The cloud server (Render) may be waking up from sleep. Please wait 15-30 seconds and try again.');
        }
      } else if (err.response.status === 502 || err.response.status === 504 || err.response.status === 503) {
        if (isLocalhost) {
          setError('Local backend server is not running on port 5000 (Vite Proxy Gateway Error). Please run "node server.js" in the backend directory.');
        } else {
          setError('Cloud backend server is currently waking up from sleep (Render free-tier cold start). Please wait 20-30 seconds and click Sign In again.');
        }
      } else if (err.response.status === 401) {
        setError(err.response?.data?.message || 'Authentication failed: Invalid username/email or password.');
      } else {
        setError(err.response?.data?.message || `Server responded with error (${err.response.status}). Please try again.`);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setRetryStatus(null);
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    executeLogin(1);
  };

  const [activeFilledRole, setActiveFilledRole] = useState('');

  const handleQuickFill = (roleName, email, pwd) => {
    setUsernameOrEmail(email);
    setPassword(pwd);
    setActiveFilledRole(roleName);
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

        {retryStatus && (
          <div className="alert alert-warning border-warning border-opacity-50 d-flex align-items-center py-2.5 px-3 small rounded-3 shadow-sm mb-3" role="alert">
            <div className="spinner-border spinner-border-sm text-warning me-2.5 flex-shrink-0" role="status"></div>
            <div>
              <div className="fw-semibold text-dark">Connecting to Cloud Server...</div>
              <div className="text-secondary small">
                Server is waking up from sleep. Automatically reconnecting in <strong>{retryCountdown}s</strong> (Attempt {retryStatus.attempt} of {retryStatus.max})...
              </div>
            </div>
          </div>
        )}

        {error && !retryStatus && (
          <div className="alert alert-danger d-flex align-items-center py-2 px-3 small rounded-3 mb-3" role="alert">
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
                <span>{retryStatus ? `Connecting (${retryCountdown}s)...` : 'Authenticating...'}</span>
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
          {activeFilledRole && (
            <div className="text-center mb-2">
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1" style={{ fontSize: '0.72rem' }}>
                <i className="bi bi-check-circle-fill me-1"></i> Filled {activeFilledRole} credentials
              </span>
            </div>
          )}
          <div className="row g-2">
            <div className="col-6">
              <button
                type="button"
                className={`btn btn-sm ${activeFilledRole === 'Inst. Admin' ? 'btn-primary text-white' : 'btn-outline-secondary'} w-100 text-truncate text-start px-2 py-1.5 d-flex align-items-center`}
                style={{ fontSize: '0.78rem', minHeight: '36px' }}
                onClick={() => handleQuickFill('Inst. Admin', 'admin@apex.edu', 'Admin@123')}
              >
                <i className={`bi bi-building me-1.5 ${activeFilledRole === 'Inst. Admin' ? 'text-white' : 'text-primary'} flex-shrink-0`}></i>
                <span className="text-truncate">Inst. Admin</span>
              </button>
            </div>
            <div className="col-6">
              <button
                type="button"
                className={`btn btn-sm ${activeFilledRole === 'Faculty' ? 'btn-warning text-dark' : 'btn-outline-secondary'} w-100 text-truncate text-start px-2 py-1.5 d-flex align-items-center`}
                style={{ fontSize: '0.78rem', minHeight: '36px' }}
                onClick={() => handleQuickFill('Faculty', 'teacher@apex.edu', 'Teacher@123')}
              >
                <i className={`bi bi-person-badge me-1.5 ${activeFilledRole === 'Faculty' ? 'text-dark' : 'text-warning'} flex-shrink-0`}></i>
                <span className="text-truncate">Faculty</span>
              </button>
            </div>
            <div className="col-6">
              <button
                type="button"
                className={`btn btn-sm ${activeFilledRole === 'Student' ? 'btn-success text-white' : 'btn-outline-secondary'} w-100 text-truncate text-start px-2 py-1.5 d-flex align-items-center`}
                style={{ fontSize: '0.78rem', minHeight: '36px' }}
                onClick={() => handleQuickFill('Student', 'student1@apex.edu', 'Student@123')}
              >
                <i className={`bi bi-backpack me-1.5 ${activeFilledRole === 'Student' ? 'text-white' : 'text-success'} flex-shrink-0`}></i>
                <span className="text-truncate">Student</span>
              </button>
            </div>
            <div className="col-6">
              <button
                type="button"
                className={`btn btn-sm ${activeFilledRole === 'Super Admin' ? 'btn-danger text-white' : 'btn-outline-secondary'} w-100 text-truncate text-start px-2 py-1.5 d-flex align-items-center`}
                style={{ fontSize: '0.78rem', minHeight: '36px' }}
                onClick={() => handleQuickFill('Super Admin', 'superadmin@onlineexam.com', 'SuperAdmin@123')}
              >
                <i className={`bi bi-shield-lock me-1.5 ${activeFilledRole === 'Super Admin' ? 'text-white' : 'text-danger'} flex-shrink-0`}></i>
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
