import React from 'react';

const StatCard = ({ title, value, icon, color = 'primary', subtitle, badgeText }) => {
  const colorMap = {
    primary: { bg: '#eff6ff', text: '#2563eb' },
    success: { bg: '#ecfdf5', text: '#10b981' },
    warning: { bg: '#fffbeb', text: '#f59e0b' },
    danger: { bg: '#fef2f2', text: '#ef4444' },
    info: { bg: '#ecfeff', text: '#06b6d4' },
    purple: { bg: '#f5f3ff', text: '#8b5cf6' }
  };

  const scheme = colorMap[color] || colorMap.primary;

  return (
    <div className="stat-card h-100">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <span className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.78rem', letterSpacing: '0.05em' }}>
          {title}
        </span>
        <div className="stat-icon-wrapper" style={{ backgroundColor: scheme.bg, color: scheme.text }}>
          <i className={`bi ${icon}`}></i>
        </div>
      </div>
      <div className="d-flex align-items-baseline justify-content-between">
        <h3 className="fw-bold mb-0 text-dark" style={{ fontSize: '1.85rem' }}>
          {value !== undefined && value !== null ? value.toLocaleString() : '0'}
        </h3>
        {badgeText && (
          <span className="badge bg-light text-dark border fw-medium" style={{ fontSize: '0.75rem' }}>
            {badgeText}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-muted mb-0 mt-2" style={{ fontSize: '0.82rem' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default StatCard;
