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
    <div className="table-responsive">
      <table className="table table-custom mb-0">
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
  );
};

export default UpcomingExamsList;
