import React from 'react';
import { Link } from 'react-router-dom';

const PhasePlaceholder = ({ title, phaseNumber, description, icon = 'bi-gear-wide-connected' }) => {
  return (
    <div className="container-fluid py-5 px-4">
      <div className="card-custom bg-white p-5 text-center mx-auto" style={{ maxWidth: '650px' }}>
        <div
          className="bg-primary-subtle text-primary rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
          style={{ width: '70px', height: '70px', fontSize: '2rem' }}
        >
          <i className={`bi ${icon}`}></i>
        </div>
        <span className="badge bg-secondary-subtle text-secondary mb-2">Phase {phaseNumber} Roadmap</span>
        <h3 className="fw-bold text-dark">{title}</h3>
        <p className="text-muted mb-4">{description}</p>
        <div className="d-flex justify-content-center gap-2">
          <Link to="/admin/dashboard" className="btn btn-primary btn-sm">
            <i className="bi bi-arrow-left me-1"></i> Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PhasePlaceholder;
