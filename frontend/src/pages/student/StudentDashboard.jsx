import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

const StudentDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      <div className="bg-primary text-white p-4 rounded-4 mb-4 shadow-sm">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <span className="badge bg-white text-primary mb-2 fw-bold">Student Portal</span>
            <h2 className="fw-bold mb-1">Hello, {user?.name}!</h2>
            <p className="mb-0 text-white-50">
              Welcome to the examination portal for {user?.institution?.name || 'Your Institution'}.
            </p>
          </div>
          <div>
            <Link to="/student/exams" className="btn btn-light fw-bold px-4 py-2 text-primary shadow-sm">
              <i className="bi bi-pencil-square me-2"></i> View Available Exams
            </Link>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card-custom p-3 bg-white">
            <div className="d-flex align-items-center gap-3">
              <div className="stat-icon-wrapper bg-primary-subtle text-primary">
                <i className="bi bi-journal-check fs-4"></i>
              </div>
              <div>
                <div className="text-muted small">Assigned Exams</div>
                <h4 className="fw-bold mb-0">2 Scheduled</h4>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card-custom p-3 bg-white">
            <div className="d-flex align-items-center gap-3">
              <div className="stat-icon-wrapper bg-success-subtle text-success">
                <i className="bi bi-check2-circle fs-4"></i>
              </div>
              <div>
                <div className="text-muted small">Completed Exams</div>
                <h4 className="fw-bold mb-0">0 Completed</h4>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card-custom p-3 bg-white">
            <div className="d-flex align-items-center gap-3">
              <div className="stat-icon-wrapper bg-warning-subtle text-warning">
                <i className="bi bi-award fs-4"></i>
              </div>
              <div>
                <div className="text-muted small">Certificates Earned</div>
                <h4 className="fw-bold mb-0">0 Issued</h4>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card-custom bg-white p-4">
        <h5 className="fw-bold text-dark mb-3">Notice to Candidates</h5>
        <ul className="text-secondary small mb-0 lh-lg">
          <li>Ensure a stable internet connection before beginning any exam.</li>
          <li>Server-side timer is enforced: closing or refreshing the browser will not reset your countdown.</li>
          <li>All answers are saved automatically as you choose each option.</li>
          <li>Upon time expiration, exams are submitted automatically by the server.</li>
        </ul>
      </div>
    </div>
  );
};

export default StudentDashboard;
