import React, { useState, useEffect } from 'react';
import { resultService } from '../../services/resultService';
import { certificateService } from '../../services/certificateService';
import { challengeService } from '../../services/challengeService';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const StudentResults = () => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State for Leaderboard & Question Analysis
  const [activeExamLeaderboard, setActiveExamLeaderboard] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  const [activeScorecard, setActiveScorecard] = useState(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);

  // Challenge / Dispute Modal State
  const [challengeTargetQuestion, setChallengeTargetQuestion] = useState(null);
  const [challengeType, setChallengeType] = useState('WRONG_KEY');
  const [claimedOptionKey, setClaimedOptionKey] = useState('');
  const [justification, setJustification] = useState('');
  const [referenceSource, setReferenceSource] = useState('');
  const [submittingChallenge, setSubmittingChallenge] = useState(false);
  const [challengeSuccessMsg, setChallengeSuccessMsg] = useState('');
  const [challengeError, setChallengeError] = useState('');

  // My Grievances History Modal State
  const [showMyChallengesModal, setShowMyChallengesModal] = useState(false);
  const [myChallengesList, setMyChallengesList] = useState([]);
  const [loadingMyChallenges, setLoadingMyChallenges] = useState(false);

  useEffect(() => {
    fetchMyResults();
  }, []);

  const fetchMyResults = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await resultService.getMyResults();
      if (res.success) {
        setResults(res.results);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve your examination results.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLeaderboard = async (examId) => {
    try {
      setLeaderboardLoading(true);
      const res = await resultService.getExamLeaderboard(examId);
      if (res.success) {
        setActiveExamLeaderboard(res);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to load cohort leaderboard.');
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const handleOpenScorecard = async (resultId) => {
    try {
      setScorecardLoading(true);
      const res = await resultService.getIndividualScorecard(resultId);
      if (res.success) {
        setActiveScorecard(res.scorecard);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to load question-by-question scorecard.');
    } finally {
      setScorecardLoading(false);
    }
  };

  const handleDownloadMyCertificate = async (examId, examTitle) => {
    try {
      const res = await certificateService.getMyCertificates();
      const cert = res.certificates?.find((c) => c.exam_id === examId);
      if (cert) {
        await certificateService.downloadCertificate(cert.certificate_uuid, cert.exam?.title || examTitle);
      } else {
        alert('Your certificate is currently being processed by the administration.');
      }
    } catch {
      alert('Unable to download certificate at this moment.');
    }
  };

  const handleOpenChallengeModal = (question) => {
    setChallengeTargetQuestion(question);
    setChallengeType('WRONG_KEY');
    setClaimedOptionKey('');
    setJustification('');
    setReferenceSource('');
    setChallengeSuccessMsg('');
    setChallengeError('');
  };

  const handleSubmitChallenge = async (e) => {
    e.preventDefault();
    if (!challengeTargetQuestion || !activeScorecard) return;

    try {
      setSubmittingChallenge(true);
      setChallengeError('');
      setChallengeSuccessMsg('');

      const attemptId = activeScorecard.attemptDetails?.attemptId || activeScorecard.metrics?.attemptId || activeScorecard.examAttemptId;

      const payload = {
        exam_id: activeScorecard.exam?.id,
        question_id: challengeTargetQuestion.questionId,
        exam_attempt_id: attemptId,
        challenge_type: challengeType,
        claimed_option_key: claimedOptionKey || null,
        justification: justification.trim(),
        reference_source: referenceSource.trim() || undefined
      };

      const res = await challengeService.submitChallenge(payload);
      if (res.success) {
        setChallengeSuccessMsg('Grievance lodged successfully! Academic committee review in progress.');
        setTimeout(() => {
          setChallengeTargetQuestion(null);
        }, 1800);
      } else {
        setChallengeError(res.message || 'Failed to submit grievance.');
      }
    } catch (err) {
      setChallengeError(err.response?.data?.message || 'Error submitting challenge. Please try again.');
    } finally {
      setSubmittingChallenge(false);
    }
  };

  const handleOpenMyChallenges = async () => {
    try {
      setShowMyChallengesModal(true);
      setLoadingMyChallenges(true);
      const res = await challengeService.getMyChallenges();
      if (res.success) {
        setMyChallengesList(res.challenges || []);
      }
    } catch (err) {
      console.error('Failed to load my challenges:', err);
    } finally {
      setLoadingMyChallenges(false);
    }
  };

  const formatSeconds = (sec) => {
    if (!sec) return '0s';
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  if (loading) {
    return (
      <div className="container py-5">
        <LoadingSpinner message="Retrieving your examination results..." />
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      {/* HEADER */}
      <div className="card-custom bg-white p-4 mb-4 border-start border-primary border-4 shadow-sm">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle mb-1">
              Candidate Academic Record
            </span>
            <h3 className="fw-bold text-dark mb-1">My Exam Results & Scorecards</h3>
            <p className="text-secondary small mb-0">
              Verified assessment scorecards, institutional rankings, and comprehensive question performance analyses.
            </p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-warning btn-sm fw-semibold d-flex align-items-center gap-1" onClick={handleOpenMyChallenges}>
              <i className="bi bi-patch-question-fill text-warning"></i> My Grievances
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={fetchMyResults}>
              <i className="bi bi-arrow-clockwise me-1"></i> Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger shadow-sm mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i> {error}
        </div>
      )}

      {/* RESULTS LIST */}
      {results.length === 0 ? (
        <div className="card-custom bg-white p-5 text-center text-muted shadow-sm">
          <i className="bi bi-journal-x fs-1 text-secondary opacity-50 d-block mb-3"></i>
          <h5 className="fw-bold text-dark">No Completed Examinations</h5>
          <p className="text-secondary small mb-0">
            You haven't completed any assessments yet. Visit Available Exams to launch scheduled assessments.
          </p>
        </div>
      ) : (
        <div className="row g-4">
          {results.map((res) => {
            const isPublished = res.resultsPublished;
            const scorecard = res.scorecard;

            return (
              <div key={res.resultId} className="col-12 col-lg-6">
                <div className={`card-custom bg-white p-4 h-100 shadow-sm border ${isPublished ? 'border-primary' : 'border-secondary border-opacity-25'}`}>
                  {/* Card Header */}
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <span className="badge bg-light text-secondary border small mb-1">
                        {res.subject} ({res.subjectCode || 'GEN'})
                      </span>
                      <h5 className="fw-bold text-dark mb-0">{res.examTitle}</h5>
                    </div>
                    <div>
                      {isPublished ? (
                        <span className="badge bg-success-subtle text-success border border-success">
                          <i className="bi bi-check-circle-fill me-1"></i> Published
                        </span>
                      ) : (
                        <span className="badge bg-warning-subtle text-dark border border-warning">
                          <i className="bi bi-hourglass-split me-1"></i> Evaluation Under Review
                        </span>
                      )}
                    </div>
                  </div>

                  {isPublished && scorecard ? (
                    <>
                      {/* Score Summary Box */}
                      <div className="row g-2 p-3 bg-light rounded-3 mb-3 border text-center">
                        <div className="col-3 border-end">
                          <span className="text-muted d-block small" style={{ fontSize: '0.72rem' }}>Rank</span>
                          <strong className="fs-5 text-dark">
                            {scorecard.rank === 1 ? '🥇 1st' : scorecard.rank === 2 ? '🥈 2nd' : scorecard.rank === 3 ? '🥉 3rd' : `#${scorecard.rank}`}
                          </strong>
                        </div>
                        <div className="col-3 border-end">
                          <span className="text-muted d-block small" style={{ fontSize: '0.72rem' }}>Score</span>
                          <strong className="fs-5 text-primary">{scorecard.marksObtained}</strong>
                          <span className="text-muted small" style={{ fontSize: '0.7rem' }}> / {scorecard.maxMarks}</span>
                        </div>
                        <div className="col-3 border-end">
                          <span className="text-muted d-block small" style={{ fontSize: '0.72rem' }}>Percentage</span>
                          <strong className="fs-5 text-dark">{scorecard.percentage}%</strong>
                        </div>
                        <div className="col-3">
                          <span className="text-muted d-block small" style={{ fontSize: '0.72rem' }}>Outcome</span>
                          <span className={`badge ${scorecard.isPassed ? 'bg-success' : 'bg-danger'}`}>
                            {scorecard.isPassed ? 'PASSED' : 'NEEDS WORK'}
                          </span>
                        </div>
                      </div>

                      {/* Performance Indicators */}
                      <div className="d-flex justify-content-between text-muted small mb-4 px-1">
                        <span><strong>Attempted:</strong> {scorecard.attempted}/{res.totalQuestions}</span>
                        <span className="text-success"><strong>Correct:</strong> {scorecard.correct}</span>
                        <span className="text-danger"><strong>Wrong:</strong> {scorecard.wrong}</span>
                        <span><strong>Time:</strong> {formatSeconds(scorecard.completionSeconds)}</span>
                      </div>

                      {/* Action Buttons */}
                      <div className="d-flex flex-wrap gap-2 mt-auto pt-3 border-top">
                        <button
                          className="btn btn-primary btn-sm flex-grow-1 fw-semibold d-flex align-items-center justify-content-center gap-1"
                          onClick={() => handleOpenScorecard(res.resultId)}
                        >
                          <i className="bi bi-card-checklist"></i> Question Analysis
                        </button>
                        <button
                          className="btn btn-outline-secondary btn-sm flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                          onClick={() => handleOpenLeaderboard(res.examId)}
                        >
                          <i className="bi bi-trophy-fill text-warning"></i> Leaderboard
                        </button>
                        {scorecard.isPassed && (
                          <button
                            className="btn btn-success btn-sm flex-grow-1 d-flex align-items-center justify-content-center gap-1 fw-bold shadow-sm"
                            onClick={() => handleDownloadMyCertificate(res.examId, res.examTitle)}
                          >
                            <i className="bi bi-patch-check-fill"></i> Certificate PDF
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Unpublished / Under Review Notice */
                    <div className="p-4 bg-light rounded-3 text-center my-auto border">
                      <i className="bi bi-shield-lock-fill text-warning fs-2 d-block mb-2"></i>
                      <h6 className="fw-bold text-dark mb-1">Results Are Under Faculty Review</h6>
                      <p className="text-secondary small mb-0">
                        Your examination attempt has been safely saved. Your institution will publish the scores and official leaderboard soon.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: COHORT LEADERBOARD */}
      {activeExamLeaderboard && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3">
                <div>
                  <h5 className="modal-title fw-bold text-dark">
                    <i className="bi bi-trophy-fill text-warning me-2"></i> {activeExamLeaderboard.exam?.title} Leaderboard
                  </h5>
                  <span className="text-muted small">
                    Subject: {activeExamLeaderboard.exam?.subject?.name} • Passing: {activeExamLeaderboard.exam?.passingPercentage}%
                  </span>
                </div>
                <button type="button" className="btn-close" onClick={() => setActiveExamLeaderboard(null)}></button>
              </div>

              <div className="modal-body p-4">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light text-muted small text-uppercase">
                      <tr>
                        <th style={{ width: '70px' }}>Rank</th>
                        <th>Student Candidate</th>
                        <th className="text-center">Score</th>
                        <th className="text-center">Percentage</th>
                        <th className="text-center">Time</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeExamLeaderboard.leaderboard?.map((item) => {
                        let rankPill = <span className="badge bg-light text-dark border">#{item.rank}</span>;
                        if (item.rank === 1) rankPill = <span className="badge bg-warning text-dark fw-bold">🥇 1st</span>;
                        else if (item.rank === 2) rankPill = <span className="badge bg-secondary text-white fw-bold">🥈 2nd</span>;
                        else if (item.rank === 3) rankPill = <span className="badge bg-dark text-white fw-bold">🥉 3rd</span>;

                        return (
                          <tr key={item.id}>
                            <td>{rankPill}</td>
                            <td>
                              <div className="fw-bold text-dark">{item.student?.user?.name || 'Candidate'}</div>
                              <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
                                {item.student?.student_id} • {item.student?.class?.name}
                              </div>
                            </td>
                            <td className="text-center fw-bold text-primary">
                              {item.total_marks_obtained} <span className="text-muted small fw-normal">/ {item.max_marks}</span>
                            </td>
                            <td className="text-center fw-semibold text-dark">{item.percentage}%</td>
                            <td className="text-center text-muted small">{formatSeconds(item.completion_time_seconds)}</td>
                            <td className="text-center">
                              <span className={`badge ${item.is_passed ? 'bg-success' : 'bg-danger'}`}>
                                {item.is_passed ? 'PASS' : 'FAIL'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="modal-footer border-top py-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveExamLeaderboard(null)}>
                  Close Leaderboard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DETAILED QUESTION ANALYSIS */}
      {activeScorecard && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3">
                <div>
                  <h5 className="modal-title fw-bold text-dark">
                    <i className="bi bi-card-checklist text-primary me-2"></i> Detailed Assessment Analysis
                  </h5>
                  <span className="text-muted small">
                    {activeScorecard.exam?.title} • Score: {activeScorecard.metrics.marksObtained}/{activeScorecard.metrics.maxMarks} ({activeScorecard.metrics.percentage}%)
                  </span>
                </div>
                <button type="button" className="btn-close" onClick={() => setActiveScorecard(null)}></button>
              </div>

              <div className="modal-body p-4">
                <div className="vstack gap-3">
                  {activeScorecard.answersAnalysis?.map((q, idx) => {
                    const isAnswered = !!q.selectedOptionKey;
                    const isCorrect = q.isCorrect;

                    return (
                      <div key={q.questionId || idx} className="p-3 rounded-3 border bg-white shadow-sm">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="badge bg-light text-dark border">Question {idx + 1}</span>
                          <div>
                            {!isAnswered ? (
                              <span className="badge bg-secondary">Unattempted (0 Marks)</span>
                            ) : isCorrect ? (
                              <span className="badge bg-success">
                                <i className="bi bi-check-lg me-1"></i> Correct (+{q.marksAwarded})
                              </span>
                            ) : (
                              <span className="badge bg-danger">
                                <i className="bi bi-x-lg me-1"></i> Incorrect ({q.marksAwarded})
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="fw-semibold text-dark mb-3">{q.questionText}</p>

                        <div className="row g-2 mb-2">
                          {q.options?.map((opt) => {
                            const isSelected = q.selectedOptionKey === opt.optionKey;
                            const isOptCorrect = opt.isCorrect;

                            let optClass = 'bg-light border text-dark';
                            if (isSelected && isOptCorrect) {
                              optClass = 'border-success bg-success-subtle text-success fw-bold';
                            } else if (isSelected && !isOptCorrect) {
                              optClass = 'border-danger bg-danger-subtle text-danger fw-bold';
                            } else if (isOptCorrect) {
                              optClass = 'border-success bg-success-subtle text-success';
                            }

                            return (
                              <div key={opt.optionKey} className="col-12 col-md-6">
                                <div className={`p-2 rounded-2 small ${optClass} d-flex align-items-center justify-content-between`}>
                                  <span><strong>{opt.optionKey}.</strong> {opt.optionText}</span>
                                  {isSelected && <span className="badge bg-dark ms-2">Your Answer</span>}
                                  {isOptCorrect && !isSelected && <span className="badge bg-success ms-2">Correct Answer</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Challenge / Grievance Action */}
                        <div className="mt-2 pt-2 border-top d-flex justify-content-between align-items-center">
                          <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                            Believe this official answer key is incorrect or ambiguous?
                          </small>
                          <button
                            type="button"
                            className="btn btn-outline-warning btn-xs px-2 py-1 d-flex align-items-center gap-1"
                            onClick={() => handleOpenChallengeModal(q)}
                          >
                            <i className="bi bi-patch-question-fill"></i> Challenge Key
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="modal-footer border-top py-2">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveScorecard(null)}>
                  Close Analysis
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUBMIT QUESTION KEY CHALLENGE */}
      {challengeTargetQuestion && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3 bg-light rounded-top-4">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-patch-question-fill text-warning"></i>
                  Lodge Answer Key Challenge
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setChallengeTargetQuestion(null)}
                ></button>
              </div>

              <form onSubmit={handleSubmitChallenge}>
                <div className="modal-body p-4">
                  {challengeError && (
                    <div className="alert alert-danger py-2 small mb-3">
                      <i className="bi bi-exclamation-triangle-fill me-1"></i> {challengeError}
                    </div>
                  )}

                  {challengeSuccessMsg && (
                    <div className="alert alert-success py-2 small mb-3">
                      <i className="bi bi-check-circle-fill me-1"></i> {challengeSuccessMsg}
                    </div>
                  )}

                  <div className="p-3 rounded-3 bg-light border mb-3">
                    <span className="badge bg-secondary mb-1">Target Question</span>
                    <p className="fw-semibold text-dark small mb-0">{challengeTargetQuestion.questionText}</p>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold text-secondary small">
                      Nature of Challenge <span className="text-danger">*</span>
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={challengeType}
                      onChange={(e) => setChallengeType(e.target.value)}
                      required
                    >
                      <option value="WRONG_KEY">Official Key is Incorrect (Another Option is Correct)</option>
                      <option value="AMBIGUOUS_QUESTION">Question is Ambiguous / Multiple Correct Answers</option>
                      <option value="OUT_OF_SYLLABUS">Question is Out of Prescribed Curriculum</option>
                      <option value="TYPO_ERROR">Typographical / Formula Error in Statement</option>
                    </select>
                  </div>

                  {challengeType === 'WRONG_KEY' && (
                    <div className="mb-3">
                      <label className="form-label fw-semibold text-secondary small">
                        Claimed Correct Option Key <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={claimedOptionKey}
                        onChange={(e) => setClaimedOptionKey(e.target.value)}
                        required
                      >
                        <option value="">Select Candidate Claimed Key</option>
                        {challengeTargetQuestion.options?.map((opt) => (
                          <option key={opt.optionKey} value={opt.optionKey}>
                            Option {opt.optionKey} ({opt.optionText.slice(0, 30)}...)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label fw-semibold text-secondary small">
                      Academic Justification & Evidence <span className="text-danger">*</span>
                    </label>
                    <textarea
                      className="form-control form-control-sm"
                      rows="3"
                      placeholder="Explain academic reasoning, steps, or standard reference justifying why the key should be revised..."
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      required
                    ></textarea>
                  </div>

                  <div className="mb-2">
                    <label className="form-label fw-semibold text-secondary small">
                      Standard Reference / Textbook Citation
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. NCERT Physics Class 12, Chapter 4, Page 112"
                      value={referenceSource}
                      onChange={(e) => setReferenceSource(e.target.value)}
                    />
                  </div>
                </div>

                <div className="modal-footer border-top py-2 bg-light rounded-bottom-4">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setChallengeTargetQuestion(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-warning btn-sm fw-bold text-dark d-flex align-items-center gap-1"
                    disabled={submittingChallenge || !justification.trim()}
                  >
                    {submittingChallenge ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-send-fill"></i> Submit Official Challenge
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MY GRIEVANCES & CHALLENGES HISTORY */}
      {showMyChallengesModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-journal-text text-primary"></i>
                  My Submitted Key Challenges & Grievances
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowMyChallengesModal(false)}
                ></button>
              </div>

              <div className="modal-body p-4">
                {loadingMyChallenges ? (
                  <div className="py-4 text-center">
                    <LoadingSpinner message="Loading your filed grievances..." />
                  </div>
                ) : myChallengesList.length === 0 ? (
                  <div className="py-4 text-center text-muted small">
                    <i className="bi bi-inbox fs-2 d-block mb-2 text-secondary opacity-50"></i>
                    You have not submitted any answer key challenges.
                  </div>
                ) : (
                  <div className="vstack gap-3">
                    {myChallengesList.map((ch) => (
                      <div key={ch.id} className="p-3 rounded-3 border bg-light shadow-sm">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <span className="badge bg-primary-subtle text-primary border me-2">
                              {ch.exam?.title || 'Examination'}
                            </span>
                            <span className="badge bg-secondary-subtle text-secondary">
                              Question #{ch.question_id}
                            </span>
                          </div>
                          <span className={`badge ${
                            ch.status === 'accepted' ? 'bg-success' : ch.status === 'rejected' ? 'bg-danger' : 'bg-warning text-dark'
                          }`}>
                            {ch.status.toUpperCase()}
                          </span>
                        </div>

                        <p className="fw-semibold text-dark small mb-2">
                          {ch.question?.question_text}
                        </p>

                        <div className="small text-muted mb-2">
                          <span className="fw-semibold text-dark">Your Claim:</span> {ch.challenge_type}
                          {ch.claimed_option_key && ` (Option ${ch.claimed_option_key})`}
                          <div className="mt-1">
                            <span className="fw-semibold text-dark">Justification:</span> {ch.justification}
                          </div>
                          {ch.reference_source && (
                            <div>
                              <span className="fw-semibold text-dark">Reference:</span> {ch.reference_source}
                            </div>
                          )}
                        </div>

                        {ch.resolution_notes && (
                          <div className="p-2 rounded bg-white border small border-start-3 border-primary">
                            <strong className="text-primary d-block">Academic Review Committee Decision:</strong>
                            <span className="text-dark">{ch.resolution_notes}</span>
                            {ch.reviewed_at && (
                              <div className="text-muted text-xs mt-1">
                                Reviewed on {new Date(ch.reviewed_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-footer border-top py-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowMyChallengesModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentResults;
