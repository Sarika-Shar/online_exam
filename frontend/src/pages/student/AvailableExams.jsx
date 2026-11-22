import React, { useState, useEffect } from 'react';
import { studentExamService } from '../../services/studentExamService';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const AvailableExams = () => {
  const [student, setStudent] = useState(null);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await studentExamService.getStudentExams();
      if (res.success) {
        setStudent(res.student);
        setExams(res.exams);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve your assigned examinations.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-5">
        <LoadingSpinner message="Loading your assigned examinations..." />
      </div>
    );
  }

  // Group exams by availability
  const activeOrAvailable = exams.filter(
    (e) => e.student_status === 'available' || e.student_status === 'in_progress'
  );
  const upcomingExams = exams.filter((e) => e.student_status === 'upcoming');
  const pastExams = exams.filter(
    (e) => e.student_status === 'completed' || e.student_status === 'expired'
  );

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      {/* Student Profile Banner */}
      <div className="card-custom bg-white p-3 p-sm-4 mb-4 border-start border-primary border-4 shadow-sm">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
          <div>
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle mb-1">
              Candidate Examination Dashboard
            </span>
            <h3 className="fw-bold text-dark mb-1 fs-4 fs-sm-3">{student?.name}</h3>
            <div className="d-flex flex-wrap align-items-center gap-2 gap-sm-3 text-muted small">
              <span><strong>Student ID:</strong> {student?.student_id}</span>
              <span>•</span>
              <span><strong>Program:</strong> {student?.class || 'B.Tech CSE'}</span>
              <span>•</span>
              <span><strong>Cohort:</strong> {student?.batch || 'Batch 2026-A'}</span>
              <span>•</span>
              <span><strong>Roll No:</strong> {student?.roll_no || '101'}</span>
            </div>
          </div>

          <button className="btn btn-outline-secondary btn-sm align-self-stretch align-self-md-auto" onClick={fetchExams}>
            <i className="bi bi-arrow-clockwise me-1"></i> Refresh Schedule
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger shadow-sm rounded-3 mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i> {error}
        </div>
      )}

      {/* SECTION 1: Available & In-Progress Examinations */}
      <div className="mb-5">
        <h4 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
          <span className="badge rounded-circle bg-success p-2 d-inline-block" style={{ width: '12px', height: '12px' }}></span>
          Available & Live Examinations ({activeOrAvailable.length})
        </h4>

        {activeOrAvailable.length === 0 ? (
          <div className="card-custom bg-white p-4 text-center text-muted">
            <i className="bi bi-calendar-check fs-2 d-block mb-2 text-secondary opacity-50"></i>
            No examinations are currently active or ready to start. Please check upcoming schedule below.
          </div>
        ) : (
          <div className="row g-3">
            {activeOrAvailable.map((exam) => {
              const isInProgress = exam.student_status === 'in_progress';

              return (
                <div key={exam.id} className="col-12 col-lg-6">
                  <div className={`card-custom bg-white p-4 h-100 border ${isInProgress ? 'border-warning shadow' : 'border-success'}`}>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle small">
                        {exam.subject?.name} ({exam.subject?.code})
                      </span>
                      <span className={`badge ${isInProgress ? 'bg-warning text-dark' : 'bg-success'}`}>
                        {isInProgress ? 'In Progress' : 'Ready to Start'}
                      </span>
                    </div>

                    <h5 className="fw-bold text-dark mb-2">{exam.title}</h5>
                    <p className="text-secondary small mb-3">{exam.description || 'Comprehensive evaluation assessment.'}</p>

                    <div className="row g-2 py-2 mb-3 bg-light rounded-3 text-center small border">
                      <div className="col-4 border-end">
                        <span className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Duration</span>
                        <strong className="text-dark">{exam.duration_minutes} Mins</strong>
                      </div>
                      <div className="col-4 border-end">
                        <span className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Questions</span>
                        <strong className="text-dark">{exam.total_questions} MCQs</strong>
                      </div>
                      <div className="col-4">
                        <span className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Total Marks</span>
                        <strong className="text-primary">{exam.total_marks} Marks</strong>
                      </div>
                    </div>

                    <div className="d-flex flex-column flex-sm-row justify-content-between align-items-stretch align-items-sm-center gap-2 mt-auto pt-2 border-top">
                      <div className="text-muted small">
                        <i className="bi bi-shield-check text-success me-1"></i>
                        Negative Marking: -{exam.negative_marking}
                      </div>

                      <Link
                        to={isInProgress ? `/student/exam-hall/${exam.id}` : `/student/exams/${exam.id}/instructions`}
                        className={`btn ${isInProgress ? 'btn-warning fw-bold text-dark' : 'btn-success fw-bold'} shadow-sm px-4 text-center`}
                      >
                        {isInProgress ? (
                          <>
                            <i className="bi bi-play-circle-fill me-1"></i> Resume Exam ({Math.floor(exam.attempt.remaining_seconds / 60)}m left)
                          </>
                        ) : (
                          <>
                            <i className="bi bi-pencil-square me-1"></i> Launch Exam
                          </>
                        )}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Upcoming Scheduled Examinations */}
      <div className="mb-5">
        <h4 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
          <i className="bi bi-clock-history text-primary"></i>
          Upcoming Examinations ({upcomingExams.length})
        </h4>

        {upcomingExams.length === 0 ? (
          <div className="card-custom bg-white p-3 text-muted small">
            No further exams scheduled for your cohort at this time.
          </div>
        ) : (
          <div className="table-responsive card-custom bg-white p-0">
            <table className="table table-custom mb-0">
              <thead>
                <tr>
                  <th>Exam Title</th>
                  <th>Subject</th>
                  <th>Scheduled Date & Time</th>
                  <th>Duration</th>
                  <th>Total Marks</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {upcomingExams.map((e) => (
                  <tr key={e.id}>
                    <td className="fw-semibold text-dark">{e.title}</td>
                    <td>{e.subject?.name}</td>
                    <td>
                      <i className="bi bi-calendar-event text-primary me-1"></i>
                      {new Date(e.start_time).toLocaleDateString()} at{' '}
                      {new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>{e.duration_minutes} Mins</td>
                    <td>{e.total_marks} Marks</td>
                    <td>
                      <span className="badge bg-secondary-subtle text-secondary">Scheduled</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 3: Completed Examinations */}
      <div>
        <h4 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
          <i className="bi bi-check2-circle text-success"></i>
          Completed Examinations ({pastExams.length})
        </h4>

        {pastExams.length === 0 ? (
          <div className="card-custom bg-white p-3 text-muted small">
            You have not completed any examinations yet.
          </div>
        ) : (
          <div className="table-responsive card-custom bg-white p-0">
            <table className="table table-custom mb-0">
              <thead>
                <tr>
                  <th>Exam Title</th>
                  <th>Subject</th>
                  <th>Exam Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pastExams.map((e) => (
                  <tr key={e.id}>
                    <td className="fw-semibold text-dark">{e.title}</td>
                    <td>{e.subject?.name}</td>
                    <td>{new Date(e.exam_date).toLocaleDateString()}</td>
                    <td>
                      <span className="badge bg-success-subtle text-success">
                        <i className="bi bi-check-circle-fill me-1"></i> Submitted
                      </span>
                    </td>
                    <td>
                      <Link to="/student/results" className="btn btn-outline-primary btn-sm py-1 px-3">
                        View Result
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvailableExams;
