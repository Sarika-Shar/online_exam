import React, { useState, useEffect } from 'react';
import { examService } from '../../services/examService';
import { proctorService } from '../../services/proctorService';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const ProctorEvidenceStudio = () => {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [overview, setOverview] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState(null);
  const [evidenceData, setEvidenceData] = useState(null);
  
  // Filtering & Modal state
  const [snapshotFilter, setSnapshotFilter] = useState('ALL');
  const [activeModalSnapshot, setActiveModalSnapshot] = useState(null);
  
  // Verdict form state
  const [verdict, setVerdict] = useState('verified_clean');
  const [notes, setNotes] = useState('');
  const [submittingVerdict, setSubmittingVerdict] = useState(false);
  const [verdictSuccessMsg, setVerdictSuccessMsg] = useState('');
  
  // Loading & Error states
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [error, setError] = useState(null);

  // Load available exams on mount
  useEffect(() => {
    loadExams();
  }, []);

  // When selected exam changes, load integrity overview
  useEffect(() => {
    if (selectedExamId) {
      loadExamOverview(selectedExamId);
      setSelectedAttemptId(null);
      setEvidenceData(null);
    }
  }, [selectedExamId]);

  // When selected candidate attempt changes, load evidence
  useEffect(() => {
    if (selectedAttemptId) {
      loadEvidence(selectedAttemptId);
    }
  }, [selectedAttemptId]);

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
      setError(err.response?.data?.message || 'Failed to load exams list.');
    } finally {
      setLoadingExams(false);
    }
  };

  const loadExamOverview = async (examId) => {
    try {
      setLoadingOverview(true);
      setError(null);
      const res = await proctorService.getExamIntegrityOverview(examId);
      if (res.success) {
        setOverview(res.overview);
        setCandidates(res.candidates || []);
        // Auto-select first candidate if available
        if (res.candidates && res.candidates.length > 0) {
          setSelectedAttemptId(res.candidates[0].attemptId);
        }
      } else {
        setError(res.message || 'Failed to load proctor integrity overview.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error loading proctor overview.');
    } finally {
      setLoadingOverview(false);
    }
  };

  const loadEvidence = async (attemptId) => {
    try {
      setLoadingEvidence(true);
      setError(null);
      setVerdictSuccessMsg('');
      const res = await proctorService.getAttemptEvidence(attemptId);
      if (res.success && res.data) {
        setEvidenceData(res.data);
        if (res.data.attempt?.proctorVerdict && res.data.attempt.proctorVerdict !== 'pending') {
          setVerdict(res.data.attempt.proctorVerdict);
        } else {
          setVerdict('verified_clean');
        }
        setNotes(res.data.attempt?.proctorNotes || '');
      } else {
        setError(res.message || 'Failed to load candidate evidence.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error loading candidate evidence.');
    } finally {
      setLoadingEvidence(false);
    }
  };

  const handleVerdictSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAttemptId) return;

    try {
      setSubmittingVerdict(true);
      setError(null);
      setVerdictSuccessMsg('');

      const res = await proctorService.submitProctorVerdict(selectedAttemptId, {
        verdict,
        notes: notes.trim()
      });

      if (res.success) {
        setVerdictSuccessMsg(`Verdict successfully recorded as "${verdict}".`);
        // Refresh evidence and overview to reflect updated status
        await loadEvidence(selectedAttemptId);
        if (selectedExamId) {
          const overviewRes = await proctorService.getExamIntegrityOverview(selectedExamId);
          if (overviewRes.success) {
            setOverview(overviewRes.overview);
            setCandidates(overviewRes.candidates || []);
          }
        }
      } else {
        setError(res.message || 'Failed to record proctor verdict.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error submitting proctor verdict.');
    } finally {
      setSubmittingVerdict(false);
    }
  };

  // Helper for Trust Score Color & Status
  const getIntegrityBadge = (score) => {
    if (score >= 85) {
      return { bg: 'success', label: 'High Trust (Clean)', icon: 'bi-shield-check' };
    }
    if (score >= 70) {
      return { bg: 'warning', label: 'Moderate Risk', icon: 'bi-shield-exclamation' };
    }
    return { bg: 'danger', label: 'High Risk (Flagged)', icon: 'bi-shield-x' };
  };

  // Helper for Anomaly Tag styling
  const getAnomalyBadge = (type) => {
    switch (type) {
      case 'MULTIPLE_FACES':
        return { bg: 'danger', label: 'Multiple Faces' };
      case 'CELLPHONE_DETECTED':
        return { bg: 'danger', label: 'Phone Detected' };
      case 'NO_FACE':
        return { bg: 'warning', label: 'No Face Detected' };
      case 'TAB_SWITCH':
        return { bg: 'warning', label: 'Tab Switch / Blur' };
      case 'LOOKING_AWAY':
        return { bg: 'info', label: 'Gaze Away' };
      case 'SUSPICIOUS_AUDIO':
        return { bg: 'secondary', label: 'Audio Noise' };
      default:
        return { bg: 'success', label: 'Clean' };
    }
  };

  // Filter snapshots
  const snapshots = evidenceData?.snapshots || [];
  const filteredSnapshots = snapshots.filter(s => {
    if (snapshotFilter === 'ALL') return true;
    if (snapshotFilter === 'ANOMALIES') return s.anomalyDetected;
    return s.anomalyType === snapshotFilter;
  });

  return (
    <div className="container-fluid py-3">
      {/* Page Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 border-bottom">
        <div>
          <h3 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-camera-video-fill text-primary"></i>
            Proctor Evidence & Surveillance Studio
          </h3>
          <p className="text-muted mb-0 small">
            Automated webcam surveillance, AI anomaly inspection, trust scoring, and official verdict auditing.
          </p>
        </div>

        {/* Exam Selector Dropdown */}
        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <label className="fw-semibold text-secondary small text-nowrap mb-0">Select Exam:</label>
          <select
            className="form-select form-select-sm"
            style={{ minWidth: '240px' }}
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            disabled={loadingExams}
          >
            {loadingExams ? (
              <option>Loading exams...</option>
            ) : exams.length === 0 ? (
              <option value="">No exams available</option>
            ) : (
              exams.map(exam => (
                <option key={exam.id} value={exam.id}>
                  {exam.title} ({exam.status || 'Active'})
                </option>
              ))
            )}
          </select>
          <button
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
            onClick={() => selectedExamId && loadExamOverview(selectedExamId)}
            title="Refresh Overview"
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

      {/* Cohort Overview Metrics Cards */}
      {overview && (
        <div className="row g-3 mb-4">
          <div className="col-6 col-md-3">
            <div className="card shadow-sm border-0 border-start border-primary border-4 h-100">
              <div className="card-body py-3">
                <span className="text-muted small fw-semibold text-uppercase">Monitored Candidates</span>
                <div className="d-flex align-items-baseline justify-content-between mt-2">
                  <h3 className="fw-bold mb-0 text-dark">{overview.totalMonitored || 0}</h3>
                  <i className="bi bi-people text-primary fs-3 opacity-50"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="card shadow-sm border-0 border-start border-success border-4 h-100">
              <div className="card-body py-3">
                <span className="text-muted small fw-semibold text-uppercase">Cohort Avg Trust Score</span>
                <div className="d-flex align-items-baseline justify-content-between mt-2">
                  <h3 className="fw-bold mb-0 text-success">{overview.averageIntegrityScore || 100}%</h3>
                  <i className="bi bi-shield-check text-success fs-3 opacity-50"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="card shadow-sm border-0 border-start border-warning border-4 h-100">
              <div className="card-body py-3">
                <span className="text-muted small fw-semibold text-uppercase">Flagged / Under Review</span>
                <div className="d-flex align-items-baseline justify-content-between mt-2">
                  <h3 className="fw-bold mb-0 text-warning">{overview.verdicts?.flagged || 0}</h3>
                  <i className="bi bi-shield-exclamation text-warning fs-3 opacity-50"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="card shadow-sm border-0 border-start border-danger border-4 h-100">
              <div className="card-body py-3">
                <span className="text-muted small fw-semibold text-uppercase">Disqualified</span>
                <div className="d-flex align-items-baseline justify-content-between mt-2">
                  <h3 className="fw-bold mb-0 text-danger">{overview.verdicts?.disqualified || 0}</h3>
                  <i className="bi bi-shield-slash text-danger fs-3 opacity-50"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Studio Two-Column Layout */}
      <div className="row g-4">
        {/* Left Column: Candidate Roster & Trust Score Directory */}
        <div className="col-lg-4 col-xl-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
              <h6 className="fw-bold mb-0 text-dark">
                <i className="bi bi-person-lines-fill me-2 text-primary"></i>
                Candidate Roster ({candidates.length})
              </h6>
            </div>
            
            <div className="list-group list-group-flush overflow-auto" style={{ maxHeight: '720px' }}>
              {loadingOverview ? (
                <div className="p-4 text-center">
                  <LoadingSpinner message="Loading cohort candidates..." />
                </div>
              ) : candidates.length === 0 ? (
                <div className="p-4 text-center text-muted small">
                  <i className="bi bi-inbox fs-2 d-block mb-2 text-secondary opacity-50"></i>
                  No candidate attempts recorded for this exam yet.
                </div>
              ) : (
                candidates.map((cand) => {
                  const isSelected = selectedAttemptId === cand.attemptId;
                  const badgeInfo = getIntegrityBadge(cand.integrityScore);
                  return (
                    <button
                      key={cand.attemptId}
                      type="button"
                      className={`list-group-item list-group-item-action p-3 text-start border-start-4 ${
                        isSelected ? 'bg-primary-subtle border-primary' : ''
                      }`}
                      onClick={() => setSelectedAttemptId(cand.attemptId)}
                    >
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <span className="fw-bold text-dark text-truncate" style={{ maxWidth: '140px' }}>
                          {cand.name || 'Candidate'}
                        </span>
                        <span className={`badge bg-${badgeInfo.bg} rounded-pill`}>
                          {cand.integrityScore}%
                        </span>
                      </div>
                      
                      <div className="small text-muted mb-2">
                        <span>Roll: {cand.rollNumber || 'N/A'}</span> &bull; <span>{cand.status}</span>
                      </div>

                      <div className="d-flex justify-content-between align-items-center text-xs">
                        <span className="badge bg-light text-secondary border">
                          <i className="bi bi-camera me-1"></i>
                          {cand.totalSnapshots} shots
                        </span>
                        {cand.anomaliesCount > 0 ? (
                          <span className="badge bg-danger-subtle text-danger">
                            <i className="bi bi-exclamation-circle me-1"></i>
                            {cand.anomaliesCount} alerts
                          </span>
                        ) : (
                          <span className="badge bg-success-subtle text-success">
                            <i className="bi bi-check-circle me-1"></i>
                            Clean
                          </span>
                        )}
                        <span className="text-capitalize small text-muted">
                          {cand.proctorVerdict.replace('_', ' ')}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Candidate Evidence Details, Gallery & Verdict Studio */}
        <div className="col-lg-8 col-xl-9">
          {loadingEvidence ? (
            <div className="card shadow-sm border-0 p-5 text-center">
              <LoadingSpinner message="Auditing candidate surveillance evidence & snapshots..." />
            </div>
          ) : !evidenceData ? (
            <div className="card shadow-sm border-0 p-5 text-center text-muted">
              <i className="bi bi-shield-shaded fs-1 text-secondary opacity-50 mb-3"></i>
              <h5>Select a candidate from the roster to inspect surveillance evidence</h5>
              <p className="small mb-0">You can audit webcam captures, anomaly timestamps, and issue official verdicts.</p>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {/* Candidate Profile & Trust Score Header Card */}
              <div className="card shadow-sm border-0">
                <div className="card-body p-4">
                  <div className="row align-items-center">
                    {/* Left: Avatar & Candidate Info */}
                    <div className="col-md-7">
                      <div className="d-flex align-items-center gap-3">
                        <div
                          className="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold"
                          style={{ width: '56px', height: '56px', fontSize: '1.4rem' }}
                        >
                          {evidenceData.candidate?.name ? evidenceData.candidate.name.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div>
                          <h5 className="fw-bold mb-1 text-dark">
                            {evidenceData.candidate?.name || 'Candidate Name'}
                          </h5>
                          <div className="text-muted small">
                            <span className="me-2"><i className="bi bi-envelope me-1"></i>{evidenceData.candidate?.email || 'N/A'}</span>
                            <span><i className="bi bi-person-badge me-1"></i>Roll: {evidenceData.candidate?.rollNo || 'N/A'}</span>
                          </div>
                          <div className="text-secondary small mt-1">
                            <span className="me-3"><i className="bi bi-hdd-network me-1"></i>IP: {evidenceData.attempt?.ipAddress || '127.0.0.1'}</span>
                            <span className="badge bg-secondary-subtle text-secondary">{evidenceData.attempt?.status || 'Active'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Circular / High Impact Integrity Score Gauge */}
                    <div className="col-md-5 mt-3 mt-md-0 border-start ps-md-4">
                      <div className="d-flex align-items-center justify-content-between">
                        <div>
                          <span className="text-uppercase text-muted fw-semibold small">Integrity Trust Score</span>
                          <h2 className={`fw-black mb-0 text-${getIntegrityBadge(evidenceData.attempt?.integrityScore).bg}`}>
                            {evidenceData.attempt?.integrityScore || 100} / 100
                          </h2>
                          <span className={`badge bg-${getIntegrityBadge(evidenceData.attempt?.integrityScore).bg}-subtle text-${getIntegrityBadge(evidenceData.attempt?.integrityScore).bg} mt-1`}>
                            <i className={`bi ${getIntegrityBadge(evidenceData.attempt?.integrityScore).icon} me-1`}></i>
                            {getIntegrityBadge(evidenceData.attempt?.integrityScore).label}
                          </span>
                        </div>

                        {/* Current Proctor Status Badge */}
                        <div className="text-end">
                          <span className="text-uppercase text-muted fw-semibold small d-block">Current Verdict</span>
                          <span className={`badge py-2 px-3 fs-6 ${
                            evidenceData.attempt?.proctorVerdict === 'verified_clean'
                              ? 'bg-success'
                              : evidenceData.attempt?.proctorVerdict === 'disqualified'
                              ? 'bg-danger'
                              : 'bg-warning text-dark'
                          }`}>
                            {evidenceData.attempt?.proctorVerdict?.replace('_', ' ').toUpperCase() || 'PENDING'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Anomaly Breakdown Strip */}
                  <div className="row g-2 mt-3 pt-3 border-top">
                    <div className="col-4 col-sm-2 text-center">
                      <span className="d-block text-muted small">Multi-Face</span>
                      <span className="fw-bold text-danger">{evidenceData.metrics?.anomalyCounts?.MULTIPLE_FACES || 0}</span>
                    </div>
                    <div className="col-4 col-sm-2 text-center">
                      <span className="d-block text-muted small">No Face</span>
                      <span className="fw-bold text-warning">{evidenceData.metrics?.anomalyCounts?.NO_FACE || 0}</span>
                    </div>
                    <div className="col-4 col-sm-2 text-center">
                      <span className="d-block text-muted small">Cellphone</span>
                      <span className="fw-bold text-danger">{evidenceData.metrics?.anomalyCounts?.CELLPHONE_DETECTED || 0}</span>
                    </div>
                    <div className="col-4 col-sm-2 text-center">
                      <span className="d-block text-muted small">Tab Switch</span>
                      <span className="fw-bold text-warning">{evidenceData.metrics?.anomalyCounts?.TAB_SWITCH || 0}</span>
                    </div>
                    <div className="col-4 col-sm-2 text-center">
                      <span className="d-block text-muted small">Gaze Away</span>
                      <span className="fw-bold text-info">{evidenceData.metrics?.anomalyCounts?.LOOKING_AWAY || 0}</span>
                    </div>
                    <div className="col-4 col-sm-2 text-center">
                      <span className="d-block text-muted small">Susp. Audio</span>
                      <span className="fw-bold text-secondary">{evidenceData.metrics?.anomalyCounts?.SUSPICIOUS_AUDIO || 0}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Snapshot Gallery & Surveillance Carousel */}
              <div className="card shadow-sm border-0">
                <div className="card-header bg-white py-3 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-images text-primary"></i>
                    <h6 className="fw-bold mb-0">Surveillance Photo Evidence Gallery</h6>
                    <span className="badge bg-secondary-subtle text-secondary ms-2">
                      {filteredSnapshots.length} of {snapshots.length}
                    </span>
                  </div>

                  {/* Gallery Filter Chips */}
                  <div className="d-flex flex-wrap gap-1">
                    <button
                      className={`btn btn-xs px-2 py-1 btn-${snapshotFilter === 'ALL' ? 'primary' : 'outline-secondary'}`}
                      onClick={() => setSnapshotFilter('ALL')}
                    >
                      All
                    </button>
                    <button
                      className={`btn btn-xs px-2 py-1 btn-${snapshotFilter === 'ANOMALIES' ? 'danger' : 'outline-danger'}`}
                      onClick={() => setSnapshotFilter('ANOMALIES')}
                    >
                      Anomalies Only
                    </button>
                    <button
                      className={`btn btn-xs px-2 py-1 btn-${snapshotFilter === 'MULTIPLE_FACES' ? 'warning' : 'outline-secondary'}`}
                      onClick={() => setSnapshotFilter('MULTIPLE_FACES')}
                    >
                      Multi-Face
                    </button>
                    <button
                      className={`btn btn-xs px-2 py-1 btn-${snapshotFilter === 'CELLPHONE_DETECTED' ? 'warning' : 'outline-secondary'}`}
                      onClick={() => setSnapshotFilter('CELLPHONE_DETECTED')}
                    >
                      Cellphone
                    </button>
                    <button
                      className={`btn btn-xs px-2 py-1 btn-${snapshotFilter === 'TAB_SWITCH' ? 'warning' : 'outline-secondary'}`}
                      onClick={() => setSnapshotFilter('TAB_SWITCH')}
                    >
                      Tab Switch
                    </button>
                  </div>
                </div>

                <div className="card-body p-3">
                  {filteredSnapshots.length === 0 ? (
                    <div className="py-5 text-center text-muted small">
                      <i className="bi bi-camera-slash fs-2 d-block mb-2 text-secondary opacity-50"></i>
                      No snapshots match the selected filter.
                    </div>
                  ) : (
                    <div className="row g-3">
                      {filteredSnapshots.map((snap) => {
                        const tagInfo = getAnomalyBadge(snap.anomalyType);
                        return (
                          <div key={snap.id} className="col-6 col-md-4 col-lg-3">
                            <div className={`card h-100 border ${snap.anomalyDetected ? 'border-danger' : 'border-light-subtle'}`}>
                              <div
                                className="position-relative bg-dark rounded-top overflow-hidden"
                                style={{ height: '140px', cursor: 'pointer' }}
                                onClick={() => setActiveModalSnapshot(snap)}
                              >
                                {snap.url ? (
                                  <img
                                    src={snap.url}
                                    alt="Proctor Snapshot"
                                    className="w-100 h-100 object-fit-cover"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect fill="%23212529" width="200" height="150"/><text fill="%236c757d" font-family="sans-serif" font-size="12" x="50%" y="50%" text-anchor="middle" dominant-baseline="middle">Snapshot Image</text></svg>';
                                    }}
                                  />
                                ) : (
                                  <div className="w-100 h-100 d-flex align-items-center justify-content-center text-secondary small">
                                    <i className="bi bi-camera-fill me-1"></i> Stream Captured
                                  </div>
                                )}
                                
                                {snap.anomalyDetected ? (
                                  <span className="position-absolute top-0 start-0 m-2 badge bg-danger">
                                    <i className="bi bi-exclamation-triangle-fill me-1"></i>
                                    {tagInfo.label}
                                  </span>
                                ) : (
                                  <span className="position-absolute top-0 start-0 m-2 badge bg-success-subtle text-success">
                                    <i className="bi bi-check-circle me-1"></i>
                                    Verified
                                  </span>
                                )}

                                <div className="position-absolute bottom-0 end-0 m-1">
                                  <span className="badge bg-dark bg-opacity-75 text-white" style={{ fontSize: '0.65rem' }}>
                                    <i className="bi bi-zoom-in me-1"></i> Zoom
                                  </span>
                                </div>
                              </div>

                              <div className="card-body p-2 bg-light rounded-bottom">
                                <div className="d-flex justify-content-between align-items-center text-muted" style={{ fontSize: '0.72rem' }}>
                                  <span>{new Date(snap.capturedAt).toLocaleTimeString()}</span>
                                  <span className="text-uppercase fw-semibold">{snap.type}</span>
                                </div>
                                {snap.confidence && (
                                  <div className="text-secondary small mt-1" style={{ fontSize: '0.7rem' }}>
                                    Confidence: {Math.round(snap.confidence * 100)}%
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Official Proctor Decision & Verdict Audit Panel */}
              <div className="card shadow-sm border-0 border-top border-primary border-3">
                <div className="card-header bg-white py-3 border-bottom">
                  <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-journal-check text-primary"></i>
                    Official Proctor Verdict & Review Decision
                  </h6>
                </div>
                <div className="card-body p-4">
                  {verdictSuccessMsg && (
                    <div className="alert alert-success alert-dismissible fade show d-flex align-items-center gap-2 mb-3" role="alert">
                      <i className="bi bi-check-circle-fill"></i>
                      <div>{verdictSuccessMsg}</div>
                      <button type="button" className="btn-close" onClick={() => setVerdictSuccessMsg('')}></button>
                    </div>
                  )}

                  <form onSubmit={handleVerdictSubmit}>
                    <div className="row g-3">
                      <div className="col-md-5">
                        <label className="form-label fw-semibold text-secondary small">
                          Proctor Final Decision Verdict <span className="text-danger">*</span>
                        </label>
                        <select
                          className="form-select"
                          value={verdict}
                          onChange={(e) => setVerdict(e.target.value)}
                          required
                        >
                          <option value="verified_clean">Verified Clean (Integrity Approved)</option>
                          <option value="suspicious_flagged">Suspicious Flagged (Marked for Audit)</option>
                          <option value="disqualified">Disqualified (Void Result to 0 Marks)</option>
                        </select>
                        <small className="form-text text-muted">
                          Choosing &ldquo;Disqualified&rdquo; immediately invalidates the exam result and sets total score to 0.
                        </small>
                      </div>

                      <div className="col-md-7">
                        <label className="form-label fw-semibold text-secondary small">
                          Auditor & Proctor Observations / Notes
                        </label>
                        <textarea
                          className="form-control"
                          rows="3"
                          placeholder="Document evidence findings, anomalies reviewed, and audit rationale..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        ></textarea>
                      </div>

                      <div className="col-12 d-flex justify-content-between align-items-center pt-2">
                        <div className="text-muted small">
                          {evidenceData.attempt?.proctorReviewedAt && (
                            <span>
                              <i className="bi bi-clock-history me-1"></i>
                              Last reviewed: {new Date(evidenceData.attempt.proctorReviewedAt).toLocaleString()}
                            </span>
                          )}
                        </div>

                        <button
                          type="submit"
                          className="btn btn-primary px-4 fw-semibold d-flex align-items-center gap-2"
                          disabled={submittingVerdict}
                        >
                          {submittingVerdict ? (
                            <>
                              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                              Submitting...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-check2-circle"></i>
                              Record Official Verdict
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

      {/* Snapshot Enlarge Modal */}
      {activeModalSnapshot && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          tabIndex="-1"
          role="dialog"
          onClick={() => setActiveModalSnapshot(null)}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-dark text-white py-2">
                <h6 className="modal-title d-flex align-items-center gap-2">
                  <i className="bi bi-camera-fill"></i>
                  Snapshot Inspection &bull; {new Date(activeModalSnapshot.capturedAt).toLocaleString()}
                </h6>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setActiveModalSnapshot(null)}
                ></button>
              </div>

              <div className="modal-body p-0 bg-black text-center">
                <img
                  src={activeModalSnapshot.url}
                  alt="Snapshot Detailed View"
                  className="img-fluid"
                  style={{ maxHeight: '70vh' }}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect fill="%23212529" width="600" height="400"/><text fill="%23ffffff" font-family="sans-serif" font-size="16" x="50%" y="50%" text-anchor="middle" dominant-baseline="middle">Webcam Snapshot Capture</text></svg>';
                  }}
                />
              </div>

              <div className="modal-footer bg-light py-2 d-flex justify-content-between">
                <div>
                  {activeModalSnapshot.anomalyDetected ? (
                    <span className="badge bg-danger fs-6">
                      Anomaly Detected: {activeModalSnapshot.anomalyType}
                    </span>
                  ) : (
                    <span className="badge bg-success fs-6">
                      Normal / Clean Surveillance Stream
                    </span>
                  )}
                  {activeModalSnapshot.confidence && (
                    <span className="text-muted ms-2 small">
                      Confidence: {Math.round(activeModalSnapshot.confidence * 100)}%
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveModalSnapshot(null)}
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

export default ProctorEvidenceStudio;
