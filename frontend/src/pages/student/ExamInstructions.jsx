import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { studentExamService } from '../../services/studentExamService';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const ExamInstructions = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [student, setStudent] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInstructions();
  }, [id]);

  const fetchInstructions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await studentExamService.getExamInstructions(id);
      if (res.success) {
        setExam(res.data.exam);
        setStudent(res.data.student);
        // If student already has an active in-progress attempt, redirect straight to exam hall
        if (res.data.attemptStatus === 'in_progress') {
          navigate(`/student/exam-hall/${id}`);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load examination instructions.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = () => {
    if (!acknowledged) {
      alert('Please certify that you have read and agreed to the examination rules.');
      return;
    }
    navigate(`/student/exam-hall/${id}`);
  };

  if (loading) {
    return (
      <div className="container py-5">
        <LoadingSpinner message="Retrieving assessment instructions..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger shadow-sm p-4 rounded-4" role="alert">
          <h4 className="fw-bold">Unable to Enter Examination</h4>
          <p className="mb-3">{error}</p>
          <Link to="/student/exams" className="btn btn-outline-danger btn-sm">
            <i className="bi bi-arrow-left me-1"></i> Return to Examination Portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: '900px' }}>
      {/* Header Card */}
      <div className="card-custom bg-white p-4 mb-4 border-top border-primary border-4 shadow-sm">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="badge bg-primary px-3 py-1">Candidate Briefing Gate</span>
          <span className="text-muted small">Academic Integrity Enforced</span>
        </div>
        <h2 className="fw-bold text-dark mb-1">{exam?.title}</h2>
        <p className="text-secondary small mb-3">
          Subject: <strong>{exam?.subject?.name} ({exam?.subject?.code})</strong> | Program: <strong>{exam?.class?.name}</strong>
        </p>

        {/* Assessment Parameters Grid */}
        <div className="row g-2 text-center py-3 bg-light rounded-3 border small">
          <div className="col-6 col-md-3 border-end">
            <span className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Total Duration</span>
            <strong className="text-dark fs-6">{exam?.duration_minutes} Minutes</strong>
          </div>
          <div className="col-6 col-md-3 border-end">
            <span className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Questions</span>
            <strong className="text-dark fs-6">{exam?.total_questions} MCQs</strong>
          </div>
          <div className="col-6 col-md-3 border-end">
            <span className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Total Marks</span>
            <strong className="text-primary fs-6">{exam?.total_marks} Marks</strong>
          </div>
          <div className="col-6 col-md-3">
            <span className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Negative Penalty</span>
            <strong className="text-danger fs-6">-{exam?.negative_marking} Marks</strong>
          </div>
        </div>
      </div>

      {/* Candidate Verification Card */}
      <div className="card-custom bg-white p-4 mb-4">
        <h5 className="fw-bold text-dark mb-3">
          <i className="bi bi-person-check-fill text-primary me-2"></i> Verified Candidate Credentials
        </h5>
        <div className="row g-2 small">
          <div className="col-md-4">
            <span className="text-muted">Candidate Name:</span>
            <div className="fw-bold text-dark">{student?.name}</div>
          </div>
          <div className="col-md-4">
            <span className="text-muted">Student ID:</span>
            <div className="fw-bold text-dark">{student?.student_id}</div>
          </div>
          <div className="col-md-4">
            <span className="text-muted">Roll Number:</span>
            <div className="fw-bold text-dark">{student?.roll_no || 'Assigned'}</div>
          </div>
        </div>
      </div>

      {/* Rules & Guidelines Card */}
      <div className="card-custom bg-white p-4 mb-4">
        <h5 className="fw-bold text-dark mb-3">
          <i className="bi bi-journal-text text-primary me-2"></i> Examination Rules & Instructions
        </h5>

        <div className="p-3 bg-light rounded-3 font-monospace small mb-4 border">
          {exam?.instructions || (
            <>
              1. This assessment contains multiple-choice questions with only one correct option.<br />
              2. For each correct response, you will be awarded {exam?.marks_per_question} marks.<br />
              3. For each incorrect response, a penalty of {exam?.negative_marking} marks will be deducted.<br />
              4. Unattempted questions carry zero marks and no negative penalty.
            </>
          )}
        </div>

        <h6 className="fw-bold text-dark small mb-2">Technical & Proctoring Protocols (Sections 8, 9 & 14):</h6>
        <ul className="text-secondary small mb-0 lh-lg ps-3">
          <li><strong>Server-Side Timer:</strong> The countdown clock runs strictly on the backend server. Refreshing or closing your browser will NOT pause or extend your time.</li>
          <li><strong>Automatic Answer Persistence:</strong> Every selected option is autosaved to the database in real-time. If disconnected, your saved answers remain safe.</li>
          <li><strong>Dynamic Anti-Leak Watermark Enforced:</strong> Your candidate name, Roll Number, and IP Address are continuously imprinted across examination materials. Any attempt to photograph or screen-record will result in instant forensic tracing and disciplinary action.</li>
          <li><strong>Question Palette:</strong> You can navigate between questions, use "Mark for Review", or jump to any item at any point.</li>
          <li><strong>Automated Submission:</strong> If the timer expires before you submit, the server automatically captures your saved responses.</li>
        </ul>
      </div>

      {/* Mandatory Checkbox & Launch Button */}
      <div className="card-custom bg-white p-4 shadow-sm border-2 border-primary">
        <div className="form-check mb-4">
          <input
            className="form-check-input"
            type="checkbox"
            id="acknowledgeCheckbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          <label className="form-check-label text-dark fw-semibold small" htmlFor="acknowledgeCheckbox">
            I certify that I am the authorized candidate, that I will adhere to all institutional guidelines, and that I understand the server countdown timer cannot be paused.
          </label>
        </div>

        <div className="d-flex justify-content-between align-items-center">
          <Link to="/student/exams" className="btn btn-outline-secondary">
            <i className="bi bi-arrow-left me-1"></i> Return to Portal
          </Link>

          <button
            className="btn btn-success btn-lg fw-bold px-5 shadow-sm d-flex align-items-center gap-2"
            disabled={!acknowledged}
            onClick={handleStartExam}
          >
            <i className="bi bi-play-circle-fill fs-5"></i>
            <span>Start Examination Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamInstructions;
