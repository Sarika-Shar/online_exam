import React, { useState, useEffect } from 'react';
import { resultService } from '../../services/resultService';
import { examService } from '../../services/examService';
import { academicService } from '../../services/academicService';
import { analyticsService } from '../../services/analyticsService';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const ResultManagement = () => {
  // Data State
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [classes, setClasses] = useState([]);
  const [batches, setBatches] = useState([]);

  // Filters State
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [statusFilter, setStatusFilter] = useState(''); // 'all' | 'passed' | 'failed'
  const [searchTerm, setSearchTerm] = useState('');

  // UI State
  const [activeTab, setActiveTab] = useState('leaderboard'); // 'leaderboard' | 'podium'
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Scorecard Modal State
  const [selectedResultId, setSelectedResultId] = useState(null);
  const [scorecardDetail, setScorecardDetail] = useState(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);

  // Psychometric Item Analysis & Cohort State
  const [itemAnalysisData, setItemAnalysisData] = useState(null);
  const [cohortData, setCohortData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedExamId) {
      loadExamLeaderboard(selectedExamId);
    }
  }, [selectedExamId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [examRes, classRes] = await Promise.all([
        examService.getExams({ limit: 100 }),
        academicService.getClasses()
      ]);

      if (examRes.success) {
        setExams(examRes.exams);
        if (examRes.exams.length > 0) {
          setSelectedExamId(examRes.exams[0].id.toString());
        }
      }
      if (classRes.success) {
        setClasses(classRes.classes);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load examination registry.');
    } finally {
      setLoading(false);
    }
  };

  const loadExamLeaderboard = async (examId) => {
    try {
      setLoading(true);
      setError(null);
      const res = await resultService.getExamLeaderboard(examId);
      if (res.success) {
        setLeaderboardData(res);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve examination leaderboard.');
    } finally {
      setLoading(false);
    }
  };

  const loadItemAnalysis = async (examId) => {
    try {
      setAnalysisLoading(true);
      const [itemRes, cohortRes] = await Promise.all([
        analyticsService.getExamItemAnalysis(examId),
        analyticsService.getExamCohortAnalytics(examId)
      ]);
      if (itemRes.success) setItemAnalysisData(itemRes);
      if (cohortRes.success) setCohortData(cohortRes);
    } catch (err) {
      console.error('Failed to load item analysis:', err);
    } finally {
      setAnalysisLoading(false);
    }
  };

  // Toggle Results Published Status
  const handleTogglePublish = async () => {
    if (!selectedExamId || !leaderboardData) return;

    const currentStatus = leaderboardData.exam?.resultsPublished;
    const confirmText = currentStatus
      ? 'Hide results from students? Candidates will no longer be able to see their scorecards.'
      : 'Publish results to students? All candidates will immediately be able to view their scorecards and leaderboard.';

    if (!window.confirm(confirmText)) return;

    try {
      setActionLoading(true);
      const res = await resultService.togglePublishResults(selectedExamId, !currentStatus);
      if (res.success) {
        setSuccessMsg(res.message);
        setTimeout(() => setSuccessMsg(null), 4000);
        // Reload leaderboard
        await loadExamLeaderboard(selectedExamId);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update results publication status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Recalculate Ranks
  const handleRecalculateRanks = async () => {
    if (!selectedExamId) return;

    try {
      setActionLoading(true);
      const res = await resultService.recalculateRanks(selectedExamId);
      if (res.success) {
        setSuccessMsg('Rankings and tie-breakers successfully recalculated.');
        setTimeout(() => setSuccessMsg(null), 4000);
        await loadExamLeaderboard(selectedExamId);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to recalculate rankings.');
    } finally {
      setActionLoading(false);
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    if (!selectedExamId || !leaderboardData) return;
    try {
      setActionLoading(true);
      const examTitle = leaderboardData.exam?.title || 'Exam';
      await resultService.downloadResultsCsv(selectedExamId, `${examTitle}_Results.csv`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to export CSV results.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Detailed Individual Scorecard Modal
  const handleViewScorecard = async (resultId) => {
    setSelectedResultId(resultId);
    try {
      setScorecardLoading(true);
      const res = await resultService.getIndividualScorecard(resultId);
      if (res.success) {
        setScorecardDetail(res.scorecard);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to load detailed scorecard.');
      setSelectedResultId(null);
    } finally {
      setScorecardLoading(false);
    }
  };

  // Filtered Leaderboard Items
  const filteredList = (leaderboardData?.leaderboard || []).filter((item) => {
    const student = item.student;
    const user = student?.user;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = user?.name?.toLowerCase().includes(term);
      const matchId = student?.student_id?.toLowerCase().includes(term);
      const matchEmail = user?.email?.toLowerCase().includes(term);
      if (!matchName && !matchId && !matchEmail) return false;
    }

    // Class filter
    if (selectedClass && student?.class_id !== parseInt(selectedClass, 10)) {
      return false;
    }

    // Status filter
    if (statusFilter === 'passed' && !item.is_passed) return false;
    if (statusFilter === 'failed' && item.is_passed) return false;

    return true;
  });

  const formatSeconds = (sec) => {
    if (!sec) return '0s';
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="container-fluid py-4 px-3 px-md-4">
      {/* PAGE HEADER */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h2 className="fw-bold text-dark mb-1">
            <i className="bi bi-bar-chart-fill text-primary me-2"></i> Results & Leaderboard Management
          </h2>
          <p className="text-secondary small mb-0">
            Real-time score calculation, automated rank determination, tie-breaker resolution, and institutional scorecards.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          {leaderboardData && (
            <>
              <button
                className={`btn btn-sm fw-semibold shadow-sm d-flex align-items-center gap-2 ${
                  leaderboardData.exam?.resultsPublished ? 'btn-outline-danger' : 'btn-success'
                }`}
                onClick={handleTogglePublish}
                disabled={actionLoading}
              >
                <i className={`bi ${leaderboardData.exam?.resultsPublished ? 'bi-eye-slash-fill' : 'bi-broadcast'}`}></i>
                <span>{leaderboardData.exam?.resultsPublished ? 'Hide Results from Students' : 'Publish Results to Students'}</span>
              </button>

              <button
                className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 shadow-sm"
                onClick={handleRecalculateRanks}
                disabled={actionLoading}
                title="Re-run tie-breakers and calculate sequential ranks"
              >
                <i className="bi bi-arrow-repeat"></i>
                <span>Recalculate Ranks</span>
              </button>

              <button
                className="btn btn-primary btn-sm d-flex align-items-center gap-1 shadow-sm fw-semibold"
                onClick={handleExportCsv}
                disabled={actionLoading}
              >
                <i className="bi bi-file-earmark-spreadsheet-fill"></i>
                <span>Export CSV</span>
              </button>
            </>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="alert alert-success alert-dismissible fade show shadow-sm mb-4" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i> {successMsg}
          <button type="button" className="btn-close" onClick={() => setSuccessMsg(null)}></button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger shadow-sm mb-4" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i> {error}
        </div>
      )}

      {/* EXAM SELECTOR BAR */}
      <div className="card-custom bg-white p-3 mb-4 shadow-sm border">
        <div className="row g-3 align-items-center">
          <div className="col-12 col-md-5">
            <label className="form-label small fw-bold text-muted mb-1">Select Examination</label>
            <select
              className="form-select form-select-sm fw-semibold text-dark"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} ({ex.subject?.name || 'General'}) — {ex.exam_date}
                </option>
              ))}
            </select>
          </div>

          {leaderboardData && (
            <div className="col-12 col-md-7 d-flex flex-wrap align-items-center justify-content-md-end gap-3 pt-2 pt-md-0">
              <div className="text-muted small">
                Status:{' '}
                <span
                  className={`badge ${
                    leaderboardData.exam?.resultsPublished
                      ? 'bg-success-subtle text-success border border-success'
                      : 'bg-secondary-subtle text-secondary border'
                  }`}
                >
                  <i className={`bi ${leaderboardData.exam?.resultsPublished ? 'bi-check-circle me-1' : 'bi-lock me-1'}`}></i>
                  {leaderboardData.exam?.resultsPublished ? 'Published to Students' : 'Hidden (Draft Mode)'}
                </span>
              </div>

              <div className="text-muted small">
                Subject: <strong className="text-dark">{leaderboardData.exam?.subject?.name}</strong>
              </div>

              <div className="text-muted small">
                Passing Score: <strong className="text-primary">{leaderboardData.exam?.passingPercentage}%</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-5">
          <LoadingSpinner message="Calculating dynamic rankings & metrics..." />
        </div>
      ) : (
        <>
          {/* 4 SUMMARY STAT CARDS */}
          {leaderboardData?.metrics && (
            <div className="row g-3 mb-4">
              <div className="col-6 col-md-3">
                <div className="card-custom bg-white p-3 border-start border-primary border-4 shadow-sm">
                  <span className="text-muted small d-block">Appeared Candidates</span>
                  <div className="d-flex align-items-baseline gap-2 mt-1">
                    <h3 className="fw-bold text-dark mb-0">{leaderboardData.metrics.totalAppeared}</h3>
                    <span className="text-muted small">Students</span>
                  </div>
                </div>
              </div>

              <div className="col-6 col-md-3">
                <div className="card-custom bg-white p-3 border-start border-success border-4 shadow-sm">
                  <span className="text-muted small d-block">Pass Rate</span>
                  <div className="d-flex align-items-baseline gap-2 mt-1">
                    <h3 className="fw-bold text-success mb-0">{leaderboardData.metrics.passPercentage}%</h3>
                    <span className="text-muted small">({leaderboardData.metrics.passedCount} Passed)</span>
                  </div>
                </div>
              </div>

              <div className="col-6 col-md-3">
                <div className="card-custom bg-white p-3 border-start border-info border-4 shadow-sm">
                  <span className="text-muted small d-block">Average Marks</span>
                  <div className="d-flex align-items-baseline gap-2 mt-1">
                    <h3 className="fw-bold text-dark mb-0">{leaderboardData.metrics.averageMarks}</h3>
                    <span className="text-muted small">/ {leaderboardData.exam?.totalMarks}</span>
                  </div>
                </div>
              </div>

              <div className="col-6 col-md-3">
                <div className="card-custom bg-white p-3 border-start border-warning border-4 shadow-sm">
                  <span className="text-muted small d-block">Highest Marks</span>
                  <div className="d-flex align-items-baseline gap-2 mt-1">
                    <h3 className="fw-bold text-warning mb-0">{leaderboardData.metrics.highestMarks}</h3>
                    <span className="text-muted small">/ {leaderboardData.exam?.totalMarks}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB NAVIGATION: Leaderboard vs Podium Preview */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <ul className="nav nav-pills gap-2">
              <li className="nav-item">
                <button
                  className={`nav-link btn-sm py-1 px-3 ${activeTab === 'leaderboard' ? 'active' : ''}`}
                  onClick={() => setActiveTab('leaderboard')}
                >
                  <i className="bi bi-list-ol me-1"></i> Full Leaderboard ({filteredList.length})
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link btn-sm py-1 px-3 ${activeTab === 'podium' ? 'active' : ''}`}
                  onClick={() => setActiveTab('podium')}
                >
                  <i className="bi bi-trophy-fill me-1"></i> Top 3 Podium Preview
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link btn-sm py-1 px-3 ${activeTab === 'item-analysis' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('item-analysis');
                    loadItemAnalysis(selectedExamId);
                  }}
                >
                  <i className="bi bi-graph-up me-1"></i> Psychometric Item Analysis
                </button>
              </li>
            </ul>
          </div>

          {activeTab === 'podium' ? (
            /* PODIUM PREVIEW CARDS */
            <div className="card-custom bg-white p-4 mb-4 shadow-sm border text-center">
              <h5 className="fw-bold text-dark mb-4">🏆 Top 3 Podium Winners</h5>
              <div className="row g-4 justify-content-center align-items-end mb-4">
                {/* 2nd Place */}
                <div className="col-12 col-md-4">
                  {leaderboardData?.podium?.[1] ? (
                    <div className="p-4 rounded-4 border bg-light shadow-sm position-relative">
                      <div
                        className="rounded-circle bg-secondary text-white fw-bold d-inline-flex align-items-center justify-content-center mb-2 shadow"
                        style={{ width: '56px', height: '56px', fontSize: '1.4rem' }}
                      >
                        🥈
                      </div>
                      <h6 className="fw-bold text-dark mb-1">{leaderboardData.podium[1].studentName}</h6>
                      <span className="badge bg-secondary mb-2">2nd Position</span>
                      <div className="small text-muted mb-1">ID: {leaderboardData.podium[1].studentId}</div>
                      <h5 className="fw-bold text-primary mb-1">{leaderboardData.podium[1].marksObtained} Marks</h5>
                      <span className="text-muted small">{leaderboardData.podium[1].percentage}% • {formatSeconds(leaderboardData.podium[1].completionSeconds)}</span>
                    </div>
                  ) : (
                    <div className="p-4 rounded-4 border bg-light text-muted small">No 2nd Place Yet</div>
                  )}
                </div>

                {/* 1st Place (Center & Taller) */}
                <div className="col-12 col-md-4">
                  {leaderboardData?.podium?.[0] ? (
                    <div className="p-4 rounded-4 border border-warning bg-warning-subtle shadow position-relative" style={{ transform: 'scale(1.05)' }}>
                      <div
                        className="rounded-circle bg-warning text-dark fw-bold d-inline-flex align-items-center justify-content-center mb-2 shadow"
                        style={{ width: '68px', height: '68px', fontSize: '1.8rem' }}
                      >
                        🥇
                      </div>
                      <h5 className="fw-bold text-dark mb-1">{leaderboardData.podium[0].studentName}</h5>
                      <span className="badge bg-warning text-dark fw-bold mb-2">Champion (1st Position)</span>
                      <div className="small text-muted mb-1">ID: {leaderboardData.podium[0].studentId}</div>
                      <h4 className="fw-bold text-primary mb-1">{leaderboardData.podium[0].marksObtained} Marks</h4>
                      <span className="text-dark small fw-semibold">{leaderboardData.podium[0].percentage}% • {formatSeconds(leaderboardData.podium[0].completionSeconds)}</span>
                    </div>
                  ) : (
                    <div className="p-4 rounded-4 border bg-light text-muted small">No 1st Place Yet</div>
                  )}
                </div>

                {/* 3rd Place */}
                <div className="col-12 col-md-4">
                  {leaderboardData?.podium?.[2] ? (
                    <div className="p-4 rounded-4 border bg-light shadow-sm position-relative">
                      <div
                        className="rounded-circle bg-warning bg-opacity-75 text-white fw-bold d-inline-flex align-items-center justify-content-center mb-2 shadow"
                        style={{ width: '56px', height: '56px', fontSize: '1.4rem' }}
                      >
                        🥉
                      </div>
                      <h6 className="fw-bold text-dark mb-1">{leaderboardData.podium[2].studentName}</h6>
                      <span className="badge bg-dark mb-2">3rd Position</span>
                      <div className="small text-muted mb-1">ID: {leaderboardData.podium[2].studentId}</div>
                      <h5 className="fw-bold text-primary mb-1">{leaderboardData.podium[2].marksObtained} Marks</h5>
                      <span className="text-muted small">{leaderboardData.podium[2].percentage}% • {formatSeconds(leaderboardData.podium[2].completionSeconds)}</span>
                    </div>
                  ) : (
                    <div className="p-4 rounded-4 border bg-light text-muted small">No 3rd Place Yet</div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'item-analysis' ? (
            /* PSYCHOMETRIC ITEM ANALYSIS & COHORT METRICS */
            <div className="card-custom bg-white p-4 shadow-sm border">
              {analysisLoading ? (
                <div className="py-5 text-center">
                  <LoadingSpinner message="Calculating psychometric difficulty & discrimination indexes..." />
                </div>
              ) : !itemAnalysisData || itemAnalysisData.itemAnalysis?.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-graph-up-arrow fs-1 text-muted d-block mb-3"></i>
                  <h6 className="text-secondary">No Psychometric Data Available</h6>
                  <p className="text-muted small">
                    Item analysis requires at least one evaluated examination result to calculate difficulty and discrimination statistics.
                  </p>
                </div>
              ) : (
                <>
                  {/* Cohort Stats Banner */}
                  {cohortData?.statistics && (
                    <div className="row g-3 mb-4">
                      <div className="col-6 col-md-3">
                        <div className="p-3 bg-light rounded-3 border">
                          <span className="text-muted small fw-bold text-uppercase">Cohort Mean Score</span>
                          <h4 className="fw-bold text-primary mb-0 mt-1">{cohortData.statistics.mean} Marks</h4>
                          <small className="text-muted">Median: {cohortData.statistics.median} Marks</small>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="p-3 bg-light rounded-3 border">
                          <span className="text-muted small fw-bold text-uppercase">Standard Deviation</span>
                          <h4 className="fw-bold text-dark mb-0 mt-1">±{cohortData.statistics.standardDeviation}</h4>
                          <small className="text-muted">Variance: {cohortData.statistics.variance}</small>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="p-3 bg-light rounded-3 border">
                          <span className="text-muted small fw-bold text-uppercase">Cohort Pass Rate</span>
                          <h4 className="fw-bold text-success mb-0 mt-1">{cohortData.statistics.passPercentage}%</h4>
                          <small className="text-muted">{cohortData.statistics.passCount} Passed / {cohortData.statistics.failCount} Failed</small>
                        </div>
                      </div>
                      <div className="col-6 col-md-3">
                        <div className="p-3 bg-light rounded-3 border">
                          <span className="text-muted small fw-bold text-uppercase">Score Range</span>
                          <h4 className="fw-bold text-dark mb-0 mt-1">{cohortData.statistics.min} - {cohortData.statistics.max}</h4>
                          <small className="text-muted">Min to Max Marks</small>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Score Distribution Bins (Bell Curve Representation) */}
                  {cohortData?.distributionBins && (
                    <div className="p-3 rounded-3 border bg-light mb-4">
                      <h6 className="fw-bold small text-secondary text-uppercase mb-3">
                        <i className="bi bi-bar-chart-steps me-1"></i> Score Distribution Curve
                      </h6>
                      <div className="row g-2">
                        {cohortData.distributionBins.map((bin, bIdx) => (
                          <div key={bIdx} className="col-12 col-md">
                            <div className="p-2 bg-white rounded border text-center">
                              <span className="badge bg-light text-dark border mb-1 small">{bin.range}</span>
                              <div className="fw-bold text-dark">{bin.count} Candidates</div>
                              <small className="text-muted" style={{ fontSize: '0.72rem' }}>{bin.label}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Item Analysis Table */}
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-bold mb-0 text-dark">
                      <i className="bi bi-diagram-3-fill text-primary me-2"></i>
                      Item Difficulty ($P$-Value) & Discrimination ($D$-Index) Analysis
                    </h6>
                    <span className="badge bg-light text-dark border">
                      Upper/Lower 27% Cohort: {itemAnalysisData.cohortSize27Percent} Candidates Each
                    </span>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 small">
                      <thead className="table-light text-uppercase text-muted">
                        <tr>
                          <th style={{ width: '60px' }}>Q#</th>
                          <th>Question Text</th>
                          <th>Marks</th>
                          <th>Attempts</th>
                          <th>Difficulty ($P$)</th>
                          <th>Discrimination ($D$)</th>
                          <th>Distractor Analysis (A, B, C, D)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemAnalysisData.itemAnalysis.map((item) => {
                          const pClass = item.difficultyIndex >= 0.75
                            ? 'bg-success text-white'
                            : item.difficultyIndex < 0.35
                            ? 'bg-danger text-white'
                            : 'bg-primary text-white';

                          const dClass = item.discriminationIndex >= 0.40
                            ? 'bg-success text-white'
                            : item.discriminationIndex >= 0.20
                            ? 'bg-info text-dark'
                            : 'bg-warning text-dark';

                          return (
                            <tr key={item.questionId}>
                              <td className="fw-bold">Q{item.order}</td>
                              <td style={{ maxWidth: '280px' }} className="text-truncate" title={item.questionText}>
                                {item.questionText}
                              </td>
                              <td>{item.marks} M</td>
                              <td>{item.correctCount} / {item.totalAttempts}</td>
                              <td>
                                <span className={`badge ${pClass} me-1`}>
                                  P = {item.difficultyIndex}
                                </span>
                                <small className="text-muted d-block">{item.difficultyRating}</small>
                              </td>
                              <td>
                                <span className={`badge ${dClass} me-1`}>
                                  D = {item.discriminationIndex}
                                </span>
                                <small className="text-muted d-block">{item.discriminationRating}</small>
                              </td>
                              <td>
                                <div className="d-flex gap-1 flex-wrap">
                                  {item.distractors.map((dist) => (
                                    <span
                                      key={dist.key}
                                      className={`badge border ${
                                        dist.isCorrect
                                          ? 'bg-success bg-opacity-10 text-success border-success'
                                          : 'bg-light text-dark'
                                      }`}
                                      title={`Option ${dist.key}: ${dist.selectedCount} votes (${dist.selectionPercentage}%)`}
                                    >
                                      {dist.key}: {dist.selectionPercentage}% {dist.isCorrect ? '✓' : ''}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* FULL LEADERBOARD TABLE & FILTERS */
            <div className="card-custom bg-white p-3 shadow-sm border">
              {/* Filter Toolbar */}
              <div className="row g-2 mb-3 pb-3 border-bottom align-items-center">
                <div className="col-12 col-md-4">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-white"><i className="bi bi-search"></i></span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search candidate name or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <select
                    className="form-select form-select-sm"
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                  >
                    <option value="">All Academic Programs</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-6 col-md-2">
                  <select
                    className="form-select form-select-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    <option value="passed">Passed Only</option>
                    <option value="failed">Failed Only</option>
                  </select>
                </div>

                <div className="col-12 col-md-3 text-md-end text-muted small">
                  Showing <strong>{filteredList.length}</strong> of {leaderboardData?.leaderboard?.length || 0} candidates
                </div>
              </div>

              {/* Leaderboard Table */}
              {filteredList.length === 0 ? (
                <div className="py-5 text-center text-muted">
                  <i className="bi bi-inbox fs-1 d-block mb-2 text-secondary opacity-50"></i>
                  No completed attempts found matching the selected filters.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light text-muted small text-uppercase">
                      <tr>
                        <th style={{ width: '70px' }}>Rank</th>
                        <th>Candidate Profile</th>
                        <th>Program & Cohort</th>
                        <th className="text-center">MCQ Performance</th>
                        <th className="text-center">Score & %</th>
                        <th className="text-center">Time Taken</th>
                        <th className="text-center">Status</th>
                        <th className="text-end">Scorecard</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredList.map((res) => {
                        const student = res.student;
                        const user = student?.user;

                        let rankBadge = (
                          <span className="badge bg-light text-dark border fw-bold px-2 py-1">
                            #{res.rank || 'N/A'}
                          </span>
                        );
                        if (res.rank === 1) {
                          rankBadge = <span className="badge bg-warning text-dark fw-bold px-2 py-1 shadow-sm">🥇 1st</span>;
                        } else if (res.rank === 2) {
                          rankBadge = <span className="badge bg-secondary text-white fw-bold px-2 py-1 shadow-sm">🥈 2nd</span>;
                        } else if (res.rank === 3) {
                          rankBadge = <span className="badge bg-dark text-white fw-bold px-2 py-1 shadow-sm">🥉 3rd</span>;
                        }

                        return (
                          <tr key={res.id}>
                            {/* Rank */}
                            <td>{rankBadge}</td>

                            {/* Candidate Profile */}
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                <div
                                  className="rounded-circle bg-primary bg-opacity-10 text-primary fw-bold d-flex align-items-center justify-content-center"
                                  style={{ width: '36px', height: '36px', fontSize: '0.85rem' }}
                                >
                                  {user?.name?.slice(0, 2).toUpperCase() || 'ST'}
                                </div>
                                <div>
                                  <div className="fw-bold text-dark">{user?.name}</div>
                                  <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                                    {student?.student_id} • Roll: {student?.roll_no || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Program */}
                            <td>
                              <div className="small fw-semibold text-dark">{student?.class?.name || 'Class N/A'}</div>
                              <div className="text-muted small" style={{ fontSize: '0.72rem' }}>{student?.batch?.name || 'Batch'}</div>
                            </td>

                            {/* MCQ Breakdown */}
                            <td className="text-center">
                              <div className="d-flex justify-content-center gap-2 small">
                                <span className="text-success" title="Correct">
                                  <i className="bi bi-check-circle-fill me-1"></i>{res.correct_answers}
                                </span>
                                <span className="text-danger" title="Wrong">
                                  <i className="bi bi-x-circle-fill me-1"></i>{res.wrong_answers}
                                </span>
                                <span className="text-secondary" title="Unattempted">
                                  <i className="bi bi-dash-circle me-1"></i>{res.unattempted_questions}
                                </span>
                              </div>
                              <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                {res.attempted_questions} of {res.total_questions} attempted
                              </div>
                            </td>

                            {/* Score & Percentage */}
                            <td className="text-center">
                              <div className="fw-bold text-dark fs-6">
                                {res.total_marks_obtained} <span className="text-muted small">/ {res.max_marks}</span>
                              </div>
                              <div className="progress mt-1" style={{ height: '5px' }}>
                                <div
                                  className={`progress-bar ${res.is_passed ? 'bg-success' : 'bg-danger'}`}
                                  style={{ width: `${Math.min(100, res.percentage)}%` }}
                                ></div>
                              </div>
                              <span className="text-muted small" style={{ fontSize: '0.72rem' }}>{res.percentage}%</span>
                            </td>

                            {/* Time Taken */}
                            <td className="text-center text-muted small">
                              <i className="bi bi-stopwatch me-1"></i>
                              {formatSeconds(res.completion_time_seconds)}
                            </td>

                            {/* Pass/Fail Status */}
                            <td className="text-center">
                              <span className={`badge ${res.is_passed ? 'bg-success' : 'bg-danger'}`}>
                                {res.is_passed ? 'PASSED' : 'FAILED'}
                              </span>
                            </td>

                            {/* Action */}
                            <td className="text-end">
                              <button
                                className="btn btn-outline-primary btn-sm px-2 py-1"
                                onClick={() => handleViewScorecard(res.id)}
                                title="View individual candidate scorecard"
                              >
                                <i className="bi bi-card-checklist me-1"></i> Scorecard
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* DETAILED INDIVIDUAL SCORECARD MODAL */}
      {selectedResultId && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3">
                <div>
                  <h5 className="modal-title fw-bold text-dark">
                    <i className="bi bi-person-lines-fill text-primary me-2"></i> Individual Candidate Scorecard
                  </h5>
                  <span className="text-muted small">
                    {scorecardDetail?.exam?.title} • {scorecardDetail?.candidate?.name} ({scorecardDetail?.candidate?.studentId})
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setSelectedResultId(null);
                    setScorecardDetail(null);
                  }}
                ></button>
              </div>

              <div className="modal-body p-4">
                {scorecardLoading ? (
                  <div className="py-5">
                    <LoadingSpinner message="Retrieving responses & answer key analysis..." />
                  </div>
                ) : scorecardDetail ? (
                  <>
                    {/* Header Performance Summary */}
                    <div className="row g-2 p-3 bg-light rounded-3 mb-4 border text-center">
                      <div className="col-3 border-end">
                        <span className="text-muted d-block small" style={{ fontSize: '0.72rem' }}>Rank</span>
                        <strong className="fs-5 text-dark">#{scorecardDetail.metrics.rank || 'N/A'}</strong>
                      </div>
                      <div className="col-3 border-end">
                        <span className="text-muted d-block small" style={{ fontSize: '0.72rem' }}>Marks Obtained</span>
                        <strong className="fs-5 text-primary">
                          {scorecardDetail.metrics.marksObtained} / {scorecardDetail.metrics.maxMarks}
                        </strong>
                      </div>
                      <div className="col-3 border-end">
                        <span className="text-muted d-block small" style={{ fontSize: '0.72rem' }}>Percentage</span>
                        <strong className="fs-5 text-dark">{scorecardDetail.metrics.percentage}%</strong>
                      </div>
                      <div className="col-3">
                        <span className="text-muted d-block small" style={{ fontSize: '0.72rem' }}>Outcome</span>
                        <span className={`badge ${scorecardDetail.metrics.isPassed ? 'bg-success' : 'bg-danger'}`}>
                          {scorecardDetail.metrics.isPassed ? 'PASSED' : 'FAILED'}
                        </span>
                      </div>
                    </div>

                    {/* Breakdown Counters */}
                    <div className="d-flex justify-content-between p-2 mb-4 bg-white rounded border small text-muted">
                      <span><strong>Attempted:</strong> {scorecardDetail.metrics.attempted}</span>
                      <span><strong>Correct:</strong> <span className="text-success fw-bold">{scorecardDetail.metrics.correct}</span></span>
                      <span><strong>Wrong:</strong> <span className="text-danger fw-bold">{scorecardDetail.metrics.wrong}</span></span>
                      <span><strong>Unattempted:</strong> {scorecardDetail.metrics.unattempted}</span>
                      <span><strong>Duration:</strong> {formatSeconds(scorecardDetail.attemptDetails?.completionSeconds)}</span>
                    </div>

                    {/* Question By Question Analysis */}
                    <h6 className="fw-bold text-dark mb-3">
                      <i className="bi bi-question-square-fill text-primary me-2"></i> Question Response Breakdown
                    </h6>

                    <div className="vstack gap-3">
                      {scorecardDetail.answersAnalysis?.map((q, idx) => {
                        let statusBadge = <span className="badge bg-secondary">Unattempted</span>;
                        if (q.selectedOptionKey) {
                          statusBadge = q.isCorrect ? (
                            <span className="badge bg-success">
                              <i className="bi bi-check-lg me-1"></i> Correct (+{q.marksAwarded})
                            </span>
                          ) : (
                            <span className="badge bg-danger">
                              <i className="bi bi-x-lg me-1"></i> Incorrect ({q.marksAwarded})
                            </span>
                          );
                        }

                        return (
                          <div key={q.questionId || idx} className="p-3 rounded-3 border bg-white shadow-sm">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <span className="badge bg-light text-dark border">Question {idx + 1}</span>
                              <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-light text-secondary border small">Topic: {q.topic || 'General'}</span>
                                {statusBadge}
                              </div>
                            </div>

                            <p className="fw-semibold text-dark mb-3">{q.questionText}</p>

                            {/* Options */}
                            <div className="row g-2 mb-2">
                              {q.options?.map((opt) => {
                                const isSelected = q.selectedOptionKey === opt.optionKey;
                                const isCorrect = opt.isCorrect;

                                let optClass = 'bg-light border text-dark';
                                if (isSelected && isCorrect) {
                                  optClass = 'border-success bg-success-subtle text-success fw-bold';
                                } else if (isSelected && !isCorrect) {
                                  optClass = 'border-danger bg-danger-subtle text-danger fw-bold';
                                } else if (isCorrect) {
                                  optClass = 'border-success bg-success-subtle text-success';
                                }

                                return (
                                  <div key={opt.optionKey} className="col-12 col-md-6">
                                    <div className={`p-2 rounded-2 small ${optClass} d-flex align-items-center justify-content-between`}>
                                      <span><strong>{opt.optionKey}.</strong> {opt.optionText}</span>
                                      {isSelected && <span className="badge bg-dark ms-2">Candidate Selection</span>}
                                      {isCorrect && !isSelected && <span className="badge bg-success ms-2">Correct Answer</span>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="modal-footer border-top py-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm px-3"
                  onClick={() => {
                    setSelectedResultId(null);
                    setScorecardDetail(null);
                  }}
                >
                  Close Scorecard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultManagement;
