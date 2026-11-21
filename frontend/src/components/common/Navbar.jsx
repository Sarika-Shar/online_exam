import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Navbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'super_admin':
        return <span className="badge-role badge-super_admin">Super Admin</span>;
      case 'institution_admin':
        return <span className="badge-role badge-institution_admin">Institution Admin</span>;
      case 'teacher':
        return <span className="badge-role badge-teacher">Faculty</span>;
      case 'student':
        return <span className="badge-role badge-student">Student</span>;
      default:
        return <span className="badge bg-secondary">{role}</span>;
    }
  };

  return (
    <header className="top-navbar">
      <div className="d-flex align-items-center gap-3">
        <button
          className="btn btn-sm btn-light border d-lg-none"
          onClick={onToggleSidebar}
          aria-label="Toggle Navigation"
        >
          <i className="bi bi-list fs-5"></i>
        </button>

        {user?.institution ? (
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
              <i className="bi bi-buildings me-1"></i> {user.institution.name}
            </span>
            <span className="text-muted d-none d-md-inline" style={{ fontSize: '0.82rem' }}>
              ({user.institution.code})
            </span>
          </div>
        ) : (
          <span className="badge bg-dark-subtle text-dark border px-2 py-1">
            <i className="bi bi-shield-check me-1"></i> Global Administration
          </span>
        )}
      </div>

      <div className="d-flex align-items-center gap-3">
        <div className="text-end d-none d-sm-block">
          <div className="fw-semibold text-dark" style={{ fontSize: '0.9rem' }}>
            {user?.name || 'User'}
          </div>
          <div className="mt-0">{getRoleBadge(user?.role)}</div>
        </div>

        <div className="dropdown">
          <button
            className="btn btn-light rounded-circle p-1 border d-flex align-items-center justify-content-center"
            style={{ width: '40px', height: '40px' }}
            id="userDropdown"
            data-bs-toggle="dropdown"
            aria-expanded="false"
          >
            <i className="bi bi-person-circle fs-4 text-secondary"></i>
          </button>
          <ul className="dropdown-menu dropdown-menu-end shadow-sm border-0 py-2" aria-labelledby="userDropdown">
            <li className="px-3 py-2 border-bottom mb-2">
              <div className="fw-bold text-dark">{user?.name}</div>
              <div className="text-muted small">{user?.email}</div>
            </li>
            <li>
              <button className="dropdown-item d-flex align-items-center gap-2 text-danger" onClick={handleLogout}>
                <i className="bi bi-box-arrow-right"></i> Sign Out
              </button>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
