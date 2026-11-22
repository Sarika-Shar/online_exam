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
    <div className="stat-card h-100 p-2 p-sm-3" style={{ minWidth: 0, maxWidth: '100%' }}>
      <div className="d-flex align-items-center justify-content-between gap-1 mb-2 mb-sm-3">
        <span className="text-muted text-uppercase fw-semibold text-truncate" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }} title={title}>
          {title}
        </span>
        <div className="stat-icon-wrapper flex-shrink-0" style={{ backgroundColor: scheme.bg, color: scheme.text, width: '34px', height: '34px', fontSize: '1.1rem' }}>
          <i className={`bi ${icon}`}></i>
        </div>
      </div>
      <div className="d-flex align-items-baseline justify-content-between gap-1 flex-wrap">
        <h3 className="fw-bold mb-0 text-dark" style={{ fontSize: 'clamp(1.15rem, 3.2vw, 1.85rem)' }}>
          {value !== undefined && value !== null ? value.toLocaleString() : '0'}
        </h3>
        {badgeText && (
          <span className="badge bg-light text-dark border fw-medium" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
            {badgeText}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-muted mb-0 mt-1 text-truncate" style={{ fontSize: '0.72rem' }} title={subtitle}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default StatCard;
