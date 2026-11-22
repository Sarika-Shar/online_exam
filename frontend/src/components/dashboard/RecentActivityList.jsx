import React from 'react';

const RecentActivityList = ({ activities = [] }) => {
  const getActionBadge = (action) => {
    if (action.includes('LOGIN')) return { color: 'info', icon: 'bi-box-arrow-in-right' };
    if (action.includes('CREATE') || action.includes('SCHEDULE')) return { color: 'success', icon: 'bi-plus-circle' };
    if (action.includes('UPDATE')) return { color: 'warning', icon: 'bi-pencil-square' };
    if (action.includes('DELETE') || action.includes('DEACTIVATE')) return { color: 'danger', icon: 'bi-trash' };
    return { color: 'primary', icon: 'bi-activity' };
  };

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-4 text-muted">
        <i className="bi bi-clock-history fs-2 d-block mb-2 text-secondary opacity-50"></i>
        No recent activities recorded yet.
      </div>
    );
  }

  return (
    <div className="activity-list">
      {activities.map((act) => {
        const badge = getActionBadge(act.action);
        return (
          <div key={act.id} className="activity-item">
            <div className={`activity-dot bg-${badge.color}`}></div>
            <div className="flex-grow-1" style={{ minWidth: 0 }}>
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-1">
                <span className="fw-semibold text-dark text-truncate" style={{ fontSize: '0.88rem', maxWidth: '170px' }}>
                  {act.user ? act.user.name : 'System Automated'}
                </span>
                <span className="text-muted text-nowrap" style={{ fontSize: '0.73rem' }}>
                  {formatDate(act.created_at)}
                </span>
              </div>
              <div className="text-secondary mt-1" style={{ fontSize: '0.82rem', wordBreak: 'break-word' }}>
                <span className={`badge bg-${badge.color}-subtle text-${badge.color} me-1`}>
                  {act.action}
                </span>
                {act.details?.msg || act.details?.title || act.entity_type || 'Action performed'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RecentActivityList;
