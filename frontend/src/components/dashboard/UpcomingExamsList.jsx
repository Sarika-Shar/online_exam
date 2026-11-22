import React from 'react';

const UpcomingExamsList = ({ exams = [] }) => {
  const formatDateTime = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  if (!exams || exams.length === 0) {
    return (
      <div className="text-center py-4 text-muted">
        <i className="bi bi-calendar-x fs-2 d-block mb-2 text-secondary opacity-50"></i>
        No upcoming exams currently scheduled.
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card List View (< 768px) */}
      <div className="d-md-none p-2.5 p-sm-3">
        <div className="d-flex flex-column gap-2.5">
          {exams.map((exam) => (
            <div key={exam.id} className="border rounded-3 p-3 bg-light-subtle shadow-sm">
              <div className="d-flex align-items-center justify-content-between mb-2 gap-2">
                <span className={`badge ${exam.status === 'active' ? 'bg-success' : 'bg-primary-subtle text-primary border border-primary-subtle'}`}>
                  {exam.status === 'active' ? 'Live Now' : 'Scheduled'}
                </span>
                <span className="badge bg-light text-dark border">
                  <i className="bi bi-clock me-1 text-primary"></i> {exam.duration_minutes} Mins
                </span>
              </div>
              <div className="fw-bold text-dark mb-1" style={{ fontSize: '0.95rem' }}>{exam.title}</div>
              <div className="d-flex align-items-center justify-content-between small text-muted mb-2">
                <span>{exam.subject?.name || 'Subject'} • {exam.class?.name || 'Class'}</span>
                <span className="fw-semibold text-primary">{exam.total_questions} MCQs</span>
              </div>
              <div className="small text-muted border-top pt-2 d-flex align-items-center justify-content-between flex-wrap gap-1">
                <span><i className="bi bi-calendar3 me-1 text-secondary"></i> {formatDateTime(exam.start_time)}</span>
                <span className="text-secondary text-capitalize" style={{ fontSize: '0.72rem' }}>
                  {exam.selection_mode?.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop / Tablet Table View (>= 768px) */}
      <div className="d-none d-md-block table-responsive w-100" style={{ maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="table table-custom mb-0 text-nowrap">
          <thead>
            <tr>
              <th>Exam Details</th>
              <th>Subject & Class</th>
              <th>Start Time</th>
              <th>Duration</th>
              <th>Questions</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {exams.map((exam) => (
              <tr key={exam.id}>
                <td>
                  <div className="fw-semibold text-dark">{exam.title}</div>
                  <small className="text-muted" style={{ fontSize: '0.78rem' }}>
                    Selection: {exam.selection_mode.replace(/_/g, ' ')}
                  </small>
                </td>
                <td>
                  <div className="text-dark fw-medium">{exam.subject?.name || 'Subject'}</div>
                  <small className="text-muted">{exam.class?.name || 'Class'}</small>
                </td>
                <td>
                  <span className="text-dark fw-medium">
                    <i className="bi bi-clock me-1 text-primary"></i>
                    {formatDateTime(exam.start_time)}
                  </span>
                </td>
                <td>
                  <span className="badge bg-light text-dark border">
                    {exam.duration_minutes} Mins
                  </span>
                </td>
                <td>
                  <span className="fw-semibold text-dark">
                    {exam.total_questions} MCQs
                  </span>
                </td>
                <td>
                  <span className={`badge ${exam.status === 'active' ? 'bg-success' : 'bg-primary-subtle text-primary border border-primary-subtle'}`}>
                    {exam.status === 'active' ? 'Live Now' : 'Scheduled'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default UpcomingExamsList;
