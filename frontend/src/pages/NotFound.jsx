import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-3 py-5">
      <div className="card-custom bg-white p-4 p-sm-5 text-center shadow-sm w-100" style={{ maxWidth: '450px' }}>
        <h1 className="display-1 fw-bold text-primary mb-0">404</h1>
        <h4 className="fw-bold text-dark mt-2 mb-3">Page Not Found</h4>
        <p className="text-muted small mb-4">
          The requested page or route does not exist or you do not have permission to access it.
        </p>
        <Link to="/" className="btn btn-primary px-4 py-2 rounded-3">
          <i className="bi bi-house-door-fill me-2"></i> Back to Safety
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
