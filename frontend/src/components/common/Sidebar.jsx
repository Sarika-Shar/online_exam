import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const isAdminOrTeacher = ['super_admin', 'institution_admin', 'teacher'].includes(user?.role);
  const isSuperOrInstAdmin = ['super_admin', 'institution_admin'].includes(user?.role);

  return (
    <aside className={`app-sidebar ${isOpen ? 'show' : ''}`}>
      <div className="sidebar-brand justify-content-between">
        <div className="d-flex align-items-center gap-2 overflow-hidden">
          <div
            className="bg-primary rounded-3 d-flex align-items-center justify-content-center text-white flex-shrink-0"
            style={{ width: '36px', height: '36px', fontWeight: 800 }}
          >
            <i className="bi bi-mortarboard-fill"></i>
          </div>
          <div className="text-truncate">
            <div className="lh-1 text-truncate" style={{ fontSize: '1.05rem' }}>SARBIT INFOTECH</div>
            <small className="text-secondary" style={{ fontSize: '0.72rem' }}>Enterprise Examination</small>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-sm text-secondary hover-text-white d-lg-none p-1 border-0"
          onClick={onClose}
          aria-label="Close Sidebar"
          style={{ width: '32px', height: '32px' }}
        >
          <i className="bi bi-x-lg fs-5"></i>
        </button>
      </div>

      <div className="sidebar-nav">
        {isAdminOrTeacher ? (
          <>
            <div className="sidebar-heading">Core Modules</div>
            <NavLink
              to="/admin/dashboard"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="bi bi-grid-1x2-fill"></i> Dashboard
            </NavLink>

            <NavLink
              to="/admin/academic"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="bi bi-mortarboard-fill"></i> Classes & Batches
            </NavLink>

            {isSuperOrInstAdmin && (
              <NavLink
                to="/admin/teachers"
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <i className="bi bi-person-workspace"></i> Teacher Management
              </NavLink>
            )}

            <NavLink
              to="/admin/students"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="bi bi-people-fill"></i> Student Management
            </NavLink>

            <div className="sidebar-heading">Question Management</div>
            <NavLink
              to="/admin/pdf-upload"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="bi bi-file-earmark-pdf-fill"></i> PDF Question Upload
            </NavLink>

            <NavLink
              to="/admin/question-bank"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="bi bi-journal-check"></i> Question Bank
            </NavLink>

            <div className="sidebar-heading">Exams & Assessment</div>
            <NavLink
              to="/admin/exams"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="bi bi-file-earmark-text-fill"></i> Exam Management
            </NavLink>

            <NavLink
              to="/admin/live-monitor"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="bi bi-broadcast"></i> Live Monitoring
            </NavLink>

            <NavLink
              to="/admin/proctor-evidence"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="bi bi-camera-video-fill"></i> Proctor Evidence Studio
            </NavLink>

            <div className="sidebar-heading">Results & Recognition</div>
            <NavLink
              to="/admin/results"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="bi bi-bar-chart-fill"></i> Results & Reports
            </NavLink>

            <NavLink
              to="/admin/key-challenges"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="bi bi-patch-question-fill"></i> Key Challenge Studio
            </NavLink>

            <NavLink
              to="/admin/winners"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="bi bi-trophy-fill"></i> Top 3 Winners
            </NavLink>

            <NavLink
              to="/admin/certificates"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="bi bi-patch-check-fill"></i> Certificates
            </NavLink>

            <div className="sidebar-heading">System & Security</div>
            <NavLink
              to="/admin/audit-logs"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="bi bi-shield-lock-fill"></i> Audit Logs
            </NavLink>
          </>
        ) : (
          <>
            <div className="sidebar-heading">Student Portal</div>
            <NavLink
              to="/student/dashboard"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="bi bi-speedometer2"></i> My Dashboard
            </NavLink>

            <NavLink
              to="/student/exams"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="bi bi-pencil-square"></i> Available Exams
            </NavLink>

            <NavLink
              to="/student/results"
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              <i className="bi bi-award-fill"></i> My Results & Certificates
            </NavLink>
          </>
        )}
      </div>

      <div className="p-3 border-top border-secondary border-opacity-25" style={{ fontSize: '0.8rem' }}>
        <div className="d-flex align-items-center justify-content-between text-muted">
          <span>Enterprise v1.0.0</span>
          <span className="badge bg-success-subtle text-success">Online</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
