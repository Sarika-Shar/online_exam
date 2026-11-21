import React, { useState, useEffect } from 'react';
import { examService } from '../../services/examService';
import { challengeService } from '../../services/challengeService';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const AnswerKeyChallengeStudio = () => {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingChallenges, setLoadingChallenges] = useState(false);
  const [challengesData, setChallengesData] = useState(null);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  
  // Resolution form state
  const [resolutionAction, setResolutionAction] = useState('KEY_CHANGE');
  const [newCorrectKey, setNewCorrectKey] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);
  const [regradeDetails, setRegradeDetails] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadExams();
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      loadExamChallenges(selectedExamId, statusFilter);
    }
  }, [selectedExamId, statusFilter]);

  const loadExams = async () => {
    try {
      setLoadingExams(true);
      setError(null);
      const res = await examService.getExams();
      const list = res.data?.exams || res.exams || (Array.isArray(res.data) ? res.data : []);
      setExams(list);
      if (list.length > 0) {
        setSelectedExamId(list[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve examinations list.');
    } finally {
      setLoadingExams(false);
    }
  };

  const loadExamChallenges = async (examId, status = 'all') => {
    try {
      setLoadingChallenges(true);
      setError(null);
      const res = await challengeService.getExamChallenges(examId, { status });
      if (res.success) {
        setChallengesData(res);
        if (res.disputedQuestions && res.disputedQuestions.length > 0) {
          // If previously selected question is in the new list, keep it; else select first
          const stillExists = res.disputedQuestions.find(q => q.questionId === selectedQuestion?.questionId);
          setSelectedQuestion(stillExists || res.disputedQuestions[0]);
        } else {
          setSelectedQuestion(null);
        }
      } else {
        setError(res.message || 'Failed to load question challenges.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error fetching exam challenges.');
    } finally {
      setLoadingChallenges(false);
    }
  };

  const handleResolveQuestion = async (e) => {
    e.preventDefault();
    if (!selectedExamId || !selectedQuestion) return;

    try {
      setResolving(true);
      setError(null);
      setActionSuccessMsg(null);
      setRegradeDetails(null);

      const payload = {
        resolution_action: resolutionAction,
        new_correct_option_key: resolutionAction === 'KEY_CHANGE' ? newCorrectKey : undefined,
        notes: resolutionNotes.trim()
      };

      const res = await challengeService.resolveQuestionChallenges(
        selectedExamId,
        selectedQuestion.questionId,
        payload
      );

      if (res.success) {
        setActionSuccessMsg(`Resolution applied: "${resolutionAction}". All pending grievances updated.`);
        setRegradeDetails(res.regradeSummary);
        setResolutionNotes('');
        setNewCorrectKey('');
        // Refresh challenges data to reflect updated key and re-graded state
        await loadExamChallenges(selectedExamId, statusFilter);
      } else {
        setError(res.message || 'Failed to apply resolution.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error executing resolution and regrading.');
    } finally {
      setResolving(false);
    }
  };

  const stats = challengesData?.stats || {
    totalChallenges: 0,
    uniqueQuestionsDisputed: 0,
    pendingCount: 0,
    underReviewCount: 0,
    acceptedCount: 0,
    rejectedCount: 0
  };

  const disputedQuestions = challengesData?.disputedQuestions || [];

  return (
    <div className="container-fluid py-3">
      {/* Page Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h3 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-patch-question-fill text-primary"></i>
            Answer Key Challenge & Grievance Redressal Studio
          </h3>
          <p className="text-muted mb-0 small">
            Review candidate dispute filings, verify question validity, revise official answer keys, and execute automated cohort re-grading.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="d-flex flex-wrap align-items-center gap-2 mt-2 mt-md-0">
          <div className="d-flex align-items-center gap-1">
            <label className="fw-semibold text-secondary small text-nowrap mb-0">Exam:</label>
            <select
              className="form-select form-select-sm"
              style={{ minWidth: '220px' }}
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              disabled={loadingExams}
            >
              {loadingExams ? (
                <option>Loading exams...</option>
              ) : exams.length === 0 ? (
                <option value="">No exams found</option>
              ) : (
                exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.title} ({exam.status})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="d-flex align-items-center gap-1">
            <label className="fw-semibold text-secondary small text-nowrap mb-0">Filter:</label>
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Grievances</option>
              <option value="pending">Pending Only</option>
              <option value="accepted">Accepted (Key Revised)</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => selectedExamId && loadExamChallenges(selectedExamId, statusFilter)}
            title="Refresh"
          >
            <i className="bi bi-arrow-clockwise"></i>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center gap-2" role="alert">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <div>{error}</div>
          <button type="button" className="btn-close" onClick={() => setError(null)}></button>
        </div>
      )}

      {/* Success & Regrade Telemetry Alert */}
      {actionSuccessMsg && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          <div className="d-flex align-items-center gap-2 mb-1">
            <i className="bi bi-check-circle-fill fs-5"></i>
            <strong>{actionSuccessMsg}</strong>
          </div>
          {regradeDetails && (
            <div className="small mt-2 pt-2 border-top border-success border-opacity-25 d-flex flex-wrap gap-3">
              <span><strong>{regradeDetails.candidatesRegraded}</strong> candidate attempts re-evaluated</span>
              <span className="text-success"><i className="bi bi-arrow-up-circle-fill me-1"></i>{regradeDetails.marksIncreasedCount} scores increased</span>
              <span className="text-danger"><i className="bi bi-arrow-down-circle-fill me-1"></i>{regradeDetails.marksDecreasedCount} scores decreased</span>
              <span className="text-muted"><i className="bi bi-dash-circle me-1"></i>{regradeDetails.marksUnchangedCount} unchanged</span>
              <span className="fw-semibold">&bull; Cohort leaderboard ranks re-computed automatically</span>
            </div>
          )}
          <button type="button" className="btn-close" onClick={() => setActionSuccessMsg(null)}></button>
        </div>
      )}

      {/* Top Aggregation Cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card shadow-sm border-0 border-start border-primary border-4 h-100">
            <div className="card-body py-3">
              <span className="text-muted small fw-semibold text-uppercase">Total Challenges</span>
              <div className="d-flex align-items-baseline justify-content-between mt-2">
                <h3 className="fw-bold mb-0 text-dark">{stats.totalChallenges}</h3>
                <i className="bi bi-files text-primary fs-3 opacity-50"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="card shadow-sm border-0 border-start border-warning border-4 h-100">
            <div className="card-body py-3">
              <span className="text-muted small fw-semibold text-uppercase">Pending Review</span>
              <div className="d-flex align-items-baseline justify-content-between mt-2">
                <h3 className="fw-bold mb-0 text-warning">{stats.pendingCount}</h3>
                <i className="bi bi-hourglass-split text-warning fs-3 opacity-50"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="card shadow-sm border-0 border-start border-success border-4 h-100">
            <div className="card-body py-3">
              <span className="text-muted small fw-semibold text-uppercase">Accepted & Revised</span>
              <div className="d-flex align-items-baseline justify-content-between mt-2">
                <h3 className="fw-bold mb-0 text-success">{stats.acceptedCount}</h3>
                <i className="bi bi-check2-all text-success fs-3 opacity-50"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="card shadow-sm border-0 border-start border-danger border-4 h-100">
            <div className="card-body py-3">
              <span className="text-muted small fw-semibold text-uppercase">Rejected / Upheld</span>
              <div className="d-flex align-items-baseline justify-content-between mt-2">
                <h3 className="fw-bold mb-0 text-danger">{stats.rejectedCount}</h3>
                <i className="bi bi-x-circle text-danger fs-3 opacity-50"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Studio Two-Column Grid */}
      <div className="row g-4">
        {/* Left Column: Disputed Questions Master List */}
        <div className="col-lg-5 col-xl-4">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
              <h6 className="fw-bold mb-0 text-dark">
                <i className="bi bi-list-check me-2 text-primary"></i>
                Disputed Questions ({disputedQuestions.length})
              </h6>
            </div>

            <div className="list-group list-group-flush overflow-auto" style={{ maxHeight: '720px' }}>
              {loadingChallenges ? (
                <div className="p-4 text-center">
                  <LoadingSpinner message="Loading disputed questions..." />
                </div>
              ) : disputedQuestions.length === 0 ? (
                <div className="p-4 text-center text-muted small">
                  <i className="bi bi-patch-check fs-2 d-block mb-2 text-success opacity-50"></i>
                  No question challenges or grievances reported for this exam.
                </div>
              ) : (
                disputedQuestions.map((q) => {
                  const isSelected = selectedQuestion?.questionId === q.questionId;
                  const claimedKeys = Object.entries(q.claimedKeyCounts || {})
                    .map(([k, count]) => `${k} (${count})`)
                    .join(', ');

                  return (
                    <button
                      key={q.questionId}
                      type="button"
                      className={`list-group-item list-group-item-action p-3 text-start border-start-4 ${
                        isSelected ? 'bg-primary-subtle border-primary' : ''
                      }`}
                      onClick={() => setSelectedQuestion(q)}
                    >
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <span className="badge bg-secondary-subtle text-secondary">
                          Q-ID #{q.questionId}
                        </span>
                        <span className="badge bg-danger rounded-pill">
                          <i className="bi bi-chat-left-dots-fill me-1"></i>
                          {q.totalChallenges} disputes
                        </span>
                      </div>

                      <div className="fw-bold text-dark text-truncate mb-2" style={{ maxWidth: '300px' }}>
                        {q.questionText}
                      </div>

                      <div className="d-flex flex-wrap gap-2 text-xs">
                        <span className="badge bg-success-subtle text-success border">
                          Official Key: <strong>{q.currentCorrectKey}</strong>
                        </span>
                        {claimedKeys && (
                          <span className="badge bg-warning-subtle text-dark border">
                            Claimed: {claimedKeys}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Question Dispute Inspector & Academic Committee Action Studio */}
        <div className="col-lg-7 col-xl-8">
          {!selectedQuestion ? (
            <div className="card shadow-sm border-0 p-5 text-center text-muted">
              <i className="bi bi-card-checklist fs-1 text-secondary opacity-50 mb-3"></i>
              <h5>Select a disputed question from the roster to inspect filings</h5>
              <p className="small mb-0">You can audit candidate justifications, change answer keys, or award bonus marks to all students.</p>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {/* Question Statement & Option Hierarchy Card */}
              <div className="card shadow-sm border-0">
                <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-primary">Question #{selectedQuestion.questionId}</span>
                    <h6 className="fw-bold mb-0 text-dark">Question Statement & Answer Key</h6>
                  </div>
                  <div className="d-flex gap-2">
                    <span className="badge bg-light text-secondary border">
                      +{selectedQuestion.marks} / -{selectedQuestion.negativeMarks} Marks
                    </span>
                    <span className="badge bg-success">
                      Current Key: {selectedQuestion.currentCorrectKey}
                    </span>
                  </div>
                </div>

                <div className="card-body p-4">
                  <p className="fw-semibold text-dark fs-6 mb-3">
                    {selectedQuestion.questionText}
                  </p>

                  <div className="row g-2">
                    {selectedQuestion.options.map((opt) => (
                      <div key={opt.id} className="col-md-6">
                        <div
                          className={`p-2 px-3 rounded-3 border d-flex align-items-center justify-content-between ${
                            opt.isCorrect ? 'bg-success-subtle border-success text-success fw-bold' : 'bg-light text-dark'
                          }`}
                        >
                          <div>
                            <span className="badge bg-secondary me-2">{opt.optionKey}</span>
                            <span>{opt.optionText}</span>
                          </div>
                          {opt.isCorrect && (
                            <span className="badge bg-success">
                              <i className="bi bi-check-circle-fill me-1"></i> Current Official Key
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Candidate Grievance Dossier / Filings List */}
              <div className="card shadow-sm border-0">
                <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                  <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-chat-quote-fill text-danger"></i>
                    Candidate Grievance Dossier ({selectedQuestion.challenges?.length || 0})
                  </h6>
                  <span className="badge bg-secondary-subtle text-secondary">
                    Audited Grievances
                  </span>
                </div>

                <div className="list-group list-group-flush overflow-auto" style={{ maxHeight: '340px' }}>
                  {selectedQuestion.challenges.map((c) => (
                    <div key={c.id} className="list-group-item p-3">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div>
                          <strong className="text-dark me-2">{c.studentName || 'Candidate'}</strong>
                          <span className="text-muted small">Roll: {c.rollNo || 'N/A'}</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <span className="badge bg-warning-subtle text-dark border">
                            Claim: Option <strong>{c.claimedOptionKey || 'None'}</strong>
                          </span>
                          <span className={`badge ${
                            c.status === 'accepted' ? 'bg-success' : c.status === 'rejected' ? 'bg-danger' : 'bg-warning text-dark'
                          }`}>
                            {c.status.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="p-2 rounded bg-light border text-secondary small mb-2">
                        <i className="bi bi-quote me-1 text-primary"></i>
                        {c.justification}
                      </div>

                      <div className="d-flex justify-content-between align-items-center text-muted" style={{ fontSize: '0.72rem' }}>
                        <span>
                          {c.referenceSource ? (
                            <span><i className="bi bi-book me-1"></i>Citation: {c.referenceSource}</span>
                          ) : (
                            <span>No reference document provided</span>
                          )}
                        </span>
                        <span>{new Date(c.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Academic Committee Resolution & Re-Grading Studio Panel */}
              <div className="card shadow-sm border-0 border-top border-primary border-3">
                <div className="card-header bg-white py-3 border-bottom">
                  <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-gear-wide-connected text-primary"></i>
                    Academic Committee Decision & Automated Cohort Re-Grading
                  </h6>
                </div>

                <div className="card-body p-4">
                  <form onSubmit={handleResolveQuestion}>
                    <div className="row g-3">
                      <div className="col-md-5">
                        <label className="form-label fw-semibold text-secondary small">
                          Resolution Action <span className="text-danger">*</span>
                        </label>
                        <select
                          className="form-select"
                          value={resolutionAction}
                          onChange={(e) => setResolutionAction(e.target.value)}
                          required
                        >
                          <option value="KEY_CHANGE">Key Change (Revise Official Answer Key)</option>
                          <option value="BONUS_MARKS">Award Bonus Marks (Defective Question)</option>
                          <option value="REJECT">Reject Grievances (Official Key Upheld)</option>
                        </select>
                        <small className="form-text text-muted">
                          {resolutionAction === 'KEY_CHANGE' && 'Revises the official key and automatically re-grades all attempts.'}
                          {resolutionAction === 'BONUS_MARKS' && 'Awards full question marks to all candidates who attempted this exam.'}
                          {resolutionAction === 'REJECT' && 'Closes challenges as rejected without modifying cohort results.'}
                        </small>
                      </div>

                      {resolutionAction === 'KEY_CHANGE' && (
                        <div className="col-md-3">
                          <label className="form-label fw-semibold text-secondary small">
                            New Correct Option Key <span className="text-danger">*</span>
                          </label>
                          <select
                            className="form-select"
                            value={newCorrectKey}
                            onChange={(e) => setNewCorrectKey(e.target.value)}
                            required
                          >
                            <option value="">Select Option</option>
                            {selectedQuestion.options.map((opt) => (
                              <option key={opt.id} value={opt.optionKey}>
                                Option {opt.optionKey} ({opt.optionText.slice(0, 20)}...)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className={resolutionAction === 'KEY_CHANGE' ? 'col-md-4' : 'col-md-7'}>
                        <label className="form-label fw-semibold text-secondary small">
                          Committee Justification / Notes
                        </label>
                        <textarea
                          className="form-control"
                          rows="2"
                          placeholder="Document academic explanation for revision or rejection..."
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                        ></textarea>
                      </div>

                      <div className="col-12 d-flex justify-content-end pt-2">
                        <button
                          type="submit"
                          className="btn btn-primary px-4 fw-semibold d-flex align-items-center gap-2"
                          disabled={resolving || (resolutionAction === 'KEY_CHANGE' && !newCorrectKey)}
                        >
                          {resolving ? (
                            <>
                              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                              Executing Re-grading...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-arrow-repeat"></i>
                              Apply Resolution & Re-grade Cohort
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnswerKeyChallengeStudio;
