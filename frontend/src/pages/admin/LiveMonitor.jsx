import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { liveMonitorService } from '../../services/liveMonitorService';
import { examService } from '../../services/examService';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const LiveMonitor = () => {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [monitorData, setMonitorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filter & Search
  const [searchFilter, setSearchFilter] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Socket Connection State
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketAlerts, setSocketAlerts] = useState([]);
  const socketRef = useRef(null);

  // Action Loading & Feedback State
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedbackToast, setFeedbackToast] = useState(null);

  // Proctor Intercom & Remote Control Modals
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState('normal');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const [warningModalCandidate, setWarningModalCandidate] = useState(null);
  const [warningMessage, setWarningMessage] = useState('');
  const [warningSeverity, setWarningSeverity] = useState('warning');
  const [isSendingWarning, setIsSendingWarning] = useState(false);

  const [forceSubmitCandidate, setForceSubmitCandidate] = useState(null);
  const [forceSubmitReason, setForceSubmitReason] = useState('');
  const [isForceSubmitting, setIsForceSubmitting] = useState(false);

  // Auto-dismiss feedback toast
  useEffect(() => {
    if (feedbackToast) {
      const timer = setTimeout(() => setFeedbackToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedbackToast]);

  // Load Exam List on Mount
  useEffect(() => {
    loadExams();
  }, []);

  // When selected exam changes, fetch status and wire socket
  useEffect(() => {
    if (!selectedExamId) return;

    fetchExamStatus(selectedExamId);
    setupSocket(selectedExamId);

    // Periodic polling fallback every 15s to guarantee fresh state
    const pollInterval = setInterval(() => {
      fetchExamStatus(selectedExamId, true);
    }, 15000);

    return () => {
      clearInterval(pollInterval);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [selectedExamId]);

  // Local 1-second timer tick to keep live remaining seconds smooth (excluding paused attempts)
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setMonitorData((prev) => {
        if (!prev || !prev.activeCandidates) return prev;
        const updatedCandidates = prev.activeCandidates.map((c) => {
          if (!c.isPaused && c.remainingSeconds > 0) {
            const nextSec = c.remainingSeconds - 1;
            return {
              ...c,
              remainingSeconds: nextSec,
              alertFlag: nextSec <= 300 && nextSec > 0 ? 'CRITICAL_TIME' : nextSec === 0 ? 'TIME_EXPIRED' : c.alertFlag
            };
          }
          return c;
        });
        return { ...prev, activeCandidates: updatedCandidates };
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);

  const loadExams = async () => {
    try {
      setLoading(true);
      const res = await examService.getExams({ limit: 100 });
      if (res.success && res.data && res.data.exams) {
        setExams(res.data.exams);
        if (res.data.exams.length > 0) {
          const active = res.data.exams.find((e) => e.status === 'active') || res.data.exams[0];
          setSelectedExamId(active.id);
        }
      }
    } catch (err) {
      setError('Failed to load examinations list.');
    } finally {
      setLoading(false);
    }
  };

  const fetchExamStatus = async (examId, isSilent = false) => {
    try {
      if (!isSilent) setRefreshing(true);
      const data = await liveMonitorService.getLiveExamStatus(examId);
      if (data.success) {
        setMonitorData(data);
      }
    } catch (err) {
      if (!isSilent) {
        setError(err.response?.data?.message || 'Failed to fetch live monitoring telemetry.');
      }
    } finally {
      if (!isSilent) setRefreshing(false);
    }
  };

  const setupSocket = (examId) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || (window.location.origin.includes(':5173')
      ? 'http://localhost:5000'
      : 'https://online-exam-4llf.onrender.com');

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join_monitor_room', { examId });
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('candidate_started', (payload) => {
      setSocketAlerts((prev) => [
        {
          id: Date.now(),
          type: 'info',
          message: `Candidate ${payload.studentName} started exam session.`,
          time: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 9)
      ]);
      fetchExamStatus(examId, true);
    });

    socket.on('candidate_progress', (payload) => {
      setMonitorData((prev) => {
        if (!prev) return prev;
        const candidates = (prev.activeCandidates || []).map((c) => {
          if (c.studentId === payload.studentId) {
            return {
              ...c,
              lastActivityAt: payload.timestamp,
              answeredQuestions: payload.hasAnswer ? c.answeredQuestions + 1 : c.answeredQuestions
            };
          }
          return c;
        });
        return { ...prev, activeCandidates: candidates };
      });
    });

    socket.on('candidate_submitted', (payload) => {
      setSocketAlerts((prev) => [
        {
          id: Date.now(),
          type: 'success',
          message: `Candidate ${payload.studentName} submitted (${payload.percentage}%).`,
          time: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 9)
      ]);
      fetchExamStatus(examId, true);
    });

    socket.on('candidate_auto_submitted', (payload) => {
      setSocketAlerts((prev) => [
        {
          id: Date.now(),
          type: 'warning',
          message: `Candidate ${payload.studentName} auto-submitted on timer expiration.`,
          time: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 9)
      ]);
      fetchExamStatus(examId, true);
    });

    socket.on('telemetry_anomaly', (payload) => {
      setSocketAlerts((prev) => [
        {
          id: Date.now(),
          type: 'danger',
          message: `SECURITY ALERT: ${payload.message}`,
          time: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 9)
      ]);
    });

    // Phase 14 Remote Command Socket Handlers
    socket.on('exam_time_extended', (payload) => {
      setSocketAlerts((prev) => [
        {
          id: Date.now(),
          type: 'info',
          message: `⏱️ Extra time granted to ${payload.studentName} (+${payload.extraMinutes}m).`,
          time: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 9)
      ]);
      setMonitorData((prev) => {
        if (!prev) return prev;
        const candidates = (prev.activeCandidates || []).map((c) => {
          if (c.attemptId === payload.attemptId) {
            return {
              ...c,
              serverExpiryTime: payload.newServerExpiryTime,
              remainingSeconds: payload.remainingSeconds,
              interventionsCount: (c.interventionsCount || 0) + 1,
              alertFlag: payload.remainingSeconds <= 300 && payload.remainingSeconds > 0 ? 'CRITICAL_TIME' : payload.remainingSeconds === 0 ? 'TIME_EXPIRED' : 'NORMAL'
            };
          }
          return c;
        });
        return { ...prev, activeCandidates: candidates };
      });
    });

    socket.on('exam_paused', (payload) => {
      setSocketAlerts((prev) => [
        {
          id: Date.now(),
          type: 'warning',
          message: `⏸️ Session PAUSED for ${payload.studentName}: ${payload.reason}`,
          time: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 9)
      ]);
      setMonitorData((prev) => {
        if (!prev) return prev;
        const candidates = (prev.activeCandidates || []).map((c) => {
          if (c.attemptId === payload.attemptId) {
            return {
              ...c,
              isPaused: true,
              status: 'paused',
              pausedAt: payload.pausedAt,
              interventionsCount: (c.interventionsCount || 0) + 1,
              alertFlag: 'PAUSED'
            };
          }
          return c;
        });
        return { ...prev, activeCandidates: candidates };
      });
    });

    socket.on('exam_resumed', (payload) => {
      setSocketAlerts((prev) => [
        {
          id: Date.now(),
          type: 'success',
          message: `▶️ Session RESUMED for ${payload.studentName} (+${payload.elapsedPausedSeconds}s compensated).`,
          time: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 9)
      ]);
      setMonitorData((prev) => {
        if (!prev) return prev;
        const candidates = (prev.activeCandidates || []).map((c) => {
          if (c.attemptId === payload.attemptId) {
            return {
              ...c,
              isPaused: false,
              status: 'active',
              pausedAt: null,
              serverExpiryTime: payload.newServerExpiryTime,
              remainingSeconds: payload.remainingSeconds,
              totalPausedSeconds: (c.totalPausedSeconds || 0) + (payload.elapsedPausedSeconds || 0),
              alertFlag: payload.remainingSeconds <= 300 && payload.remainingSeconds > 0 ? 'CRITICAL_TIME' : 'NORMAL'
            };
          }
          return c;
        });
        return { ...prev, activeCandidates: candidates };
      });
    });

    socket.on('proctor_warning_alert', (payload) => {
      setSocketAlerts((prev) => [
        {
          id: Date.now(),
          type: 'danger',
          message: `⚠️ Direct warning sent to ${payload.studentName} [${payload.severity?.toUpperCase()}]: "${payload.message}"`,
          time: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 9)
      ]);
    });

    socket.on('exam_force_submitted', (payload) => {
      setSocketAlerts((prev) => [
        {
          id: Date.now(),
          type: 'danger',
          message: `🛑 Candidate ${payload.studentName} was FORCE-SUBMITTED by proctor: ${payload.reason}`,
          time: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 9)
      ]);
      fetchExamStatus(examId, true);
    });

    socket.on('cohort_announcement', (payload) => {
      setSocketAlerts((prev) => [
        {
          id: Date.now(),
          type: payload.priority === 'urgent' ? 'danger' : payload.priority === 'warning' ? 'warning' : 'info',
          message: `📢 Cohort Broadcast: "${payload.message}" (${payload.priority?.toUpperCase()})`,
          time: new Date().toLocaleTimeString()
        },
        ...prev.slice(0, 9)
      ]);
    });

    socketRef.current = socket;
  };

  // Phase 14 Remote Actions Handlers
  const handleExtendTime = async (attemptId, minutes, studentName) => {
    try {
      setActionLoadingId(attemptId);
      const res = await liveMonitorService.extendCandidateTime(attemptId, {
        minutes,
        reason: `Proctor extension of +${minutes}m granted from live proctoring desk.`
      });
      if (res.success) {
        setFeedbackToast({
          type: 'success',
          message: `Extended ${studentName}'s exam time by +${minutes} minutes.`
        });
      }
    } catch (err) {
      setFeedbackToast({
        type: 'danger',
        message: err.response?.data?.message || 'Failed to extend candidate time.'
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleTogglePause = async (candidate) => {
    try {
      setActionLoadingId(candidate.attemptId);
      if (candidate.isPaused) {
        const res = await liveMonitorService.resumeCandidateAttempt(candidate.attemptId, {
          notes: 'Resumed by proctor from live monitor control panel.'
        });
        if (res.success) {
          setFeedbackToast({
            type: 'success',
            message: `Resumed exam for ${candidate.studentName}.`
          });
        }
      } else {
        const res = await liveMonitorService.pauseCandidateAttempt(candidate.attemptId, {
          reason: 'Administrative proctor pause for review.'
        });
        if (res.success) {
          setFeedbackToast({
            type: 'warning',
            message: `Paused exam session for ${candidate.studentName}.`
          });
        }
      }
    } catch (err) {
      setFeedbackToast({
        type: 'danger',
        message: err.response?.data?.message || 'Failed to toggle pause state.'
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSendWarningSubmit = async (e) => {
    e.preventDefault();
    if (!warningModalCandidate || !warningMessage.trim()) return;

    try {
      setIsSendingWarning(true);
      const res = await liveMonitorService.sendCandidateWarning(warningModalCandidate.attemptId, {
        message: warningMessage.trim(),
        severity: warningSeverity
      });
      if (res.success) {
        setFeedbackToast({
          type: 'success',
          message: `Warning dispatched to ${warningModalCandidate.studentName}'s screen.`
        });
        setWarningModalCandidate(null);
        setWarningMessage('');
        setWarningSeverity('warning');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send warning alert.');
    } finally {
      setIsSendingWarning(false);
    }
  };

  const handleForceSubmitExecute = async () => {
    if (!forceSubmitCandidate) return;

    try {
      setIsForceSubmitting(true);
      const res = await liveMonitorService.forceSubmitAttempt(forceSubmitCandidate.attemptId, {
        reason: forceSubmitReason.trim() || 'Forced early submission by proctor due to proctoring protocol.'
      });
      if (res.success) {
        setFeedbackToast({
          type: 'danger',
          message: `Candidate ${forceSubmitCandidate.studentName} was forcefully submitted and evaluated.`
        });
        setForceSubmitCandidate(null);
        setForceSubmitReason('');
        fetchExamStatus(selectedExamId, true);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to force submit exam attempt.');
    } finally {
      setIsForceSubmitting(false);
    }
  };

  const handleBroadcastSubmit = async (e) => {
    e.preventDefault();
    if (!selectedExamId || !broadcastMessage.trim()) return;

    try {
      setIsBroadcasting(true);
      const res = await liveMonitorService.broadcastExamAnnouncement(selectedExamId, {
        message: broadcastMessage.trim(),
        priority: broadcastPriority
      });
      if (res.success) {
        setFeedbackToast({
          type: 'success',
          message: 'Cohort broadcast sent to all active candidates in the exam hall.'
        });
        setShowBroadcastModal(false);
        setBroadcastMessage('');
        setBroadcastPriority('normal');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to broadcast announcement.');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const formatSeconds = (sec) => {
    if (sec <= 0) return '00:00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const filteredCandidates = (monitorData?.activeCandidates || []).filter((c) => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    return (
      (c.studentName && c.studentName.toLowerCase().includes(term)) ||
      (c.studentEmail && c.studentEmail.toLowerCase().includes(term)) ||
      (c.ipAddress && c.ipAddress.includes(term)) ||
      (c.studentId && c.studentId.toString().includes(term))
    );
  });

  if (loading) {
    return (
      <div className="container-fluid py-5 text-center">
        <LoadingSpinner message="Initializing Live Proctoring Matrix..." />
      </div>
    );
  }

  const counters = monitorData?.counters || {
    assigned: 0,
    activeInProgress: 0,
    submitted: 0,
    autoSubmitted: 0,
    notStarted: 0
  };

  return (
    <div className="container-fluid py-4 px-4 position-relative">
      {/* Toast Feedback Alert */}
      {feedbackToast && (
        <div
          className={`position-fixed bottom-0 end-0 m-4 p-3 rounded-3 shadow-lg text-white d-flex align-items-center gap-2 alert alert-${feedbackToast.type} mb-0`}
          style={{ zIndex: 1090, maxWidth: '450px' }}
        >
          <i
            className={`bi ${
              feedbackToast.type === 'success'
                ? 'bi-check-circle-fill'
                : feedbackToast.type === 'danger'
                ? 'bi-exclamation-octagon-fill'
                : 'bi-info-circle-fill'
            } fs-5`}
          ></i>
          <span className="flex-grow-1 small fw-semibold text-dark">{feedbackToast.message}</span>
          <button
            type="button"
            className="btn-close btn-close-sm"
            onClick={() => setFeedbackToast(null)}
          ></button>
        </div>
      )}

      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-1 d-flex align-items-center gap-2">
            <i className="bi bi-broadcast text-danger"></i>
            Live Proctoring & Remote Control Desk
          </h3>
          <p className="text-muted mb-0">
            Real-time candidate session telemetry, bidirectional proctor commands, time extensions & intercom surveillance.
          </p>
        </div>

        {/* Live Stream Status & Actions */}
        <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">
          <span
            className={`badge px-3 py-2 border d-flex align-items-center gap-2 ${
              socketConnected ? 'bg-success text-white' : 'bg-warning text-dark'
            }`}
          >
            <span
              className="spinner-grow spinner-grow-sm"
              role="status"
              style={{ width: '0.6rem', height: '0.6rem' }}
            ></span>
            {socketConnected ? 'LIVE SOCKET STREAM' : 'POLLING TELEMETRY'}
          </span>

          <button
            className="btn btn-sm btn-primary d-flex align-items-center gap-1 shadow-sm"
            onClick={() => setShowBroadcastModal(true)}
            disabled={!selectedExamId}
          >
            <i className="bi bi-megaphone-fill"></i>
            <span>Broadcast to Room</span>
          </button>

          <button
            className="btn btn-sm btn-outline-primary"
            onClick={() => fetchExamStatus(selectedExamId)}
            disabled={refreshing}
            title="Refresh stream"
          >
            <i className={`bi bi-arrow-clockwise me-1 ${refreshing ? 'spin' : ''}`}></i>
            {refreshing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
      </div>

      {/* Exam Selector & Stream Controls Bar */}
      <div className="card shadow-sm border-0 rounded-3 mb-4">
        <div className="card-body p-3">
          <div className="row g-3 align-items-center">
            <div className="col-12 col-md-5">
              <label className="form-label small fw-bold text-secondary mb-1">
                Select Examination to Monitor:
              </label>
              <select
                className="form-select form-select-sm fw-semibold"
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    [{ex.status?.toUpperCase()}] {ex.title} ({ex.subject?.name || 'General'})
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12 col-md-4">
              <label className="form-label small fw-bold text-secondary mb-1">Search Candidates:</label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Candidate name, email, IP..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="col-12 col-md-3 text-md-end mt-md-4">
              <div className="btn-group btn-group-sm">
                <button
                  className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid View"
                >
                  <i className="bi bi-grid-fill me-1"></i> Cards
                </button>
                <button
                  className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setViewMode('table')}
                  title="Table View"
                >
                  <i className="bi bi-list-ul me-1"></i> Table
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live KPI Metric Counters */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-4 col-xl-2">
          <div className="card shadow-sm border-0 rounded-3 p-3 bg-white border-start border-primary border-4 h-100">
            <span className="text-muted small fw-bold text-uppercase">Assigned</span>
            <h3 className="fw-bold mt-1 mb-0">{counters.assigned}</h3>
            <small className="text-muted">Total Roster</small>
          </div>
        </div>

        <div className="col-6 col-md-4 col-xl-2">
          <div className="card shadow-sm border-0 rounded-3 p-3 bg-white border-start border-danger border-4 h-100">
            <div className="d-flex align-items-center justify-content-between">
              <span className="text-danger small fw-bold text-uppercase">Live Active</span>
              <span className="spinner-grow spinner-grow-sm text-danger" style={{ width: '0.6rem', height: '0.6rem' }}></span>
            </div>
            <h3 className="fw-bold mt-1 mb-0 text-danger">{counters.activeInProgress}</h3>
            <small className="text-muted">Currently in Exam</small>
          </div>
        </div>

        <div className="col-6 col-md-4 col-xl-2">
          <div className="card shadow-sm border-0 rounded-3 p-3 bg-white border-start border-success border-4 h-100">
            <span className="text-success small fw-bold text-uppercase">Submitted</span>
            <h3 className="fw-bold mt-1 mb-0 text-success">{counters.submitted}</h3>
            <small className="text-muted">Normal Hand-in</small>
          </div>
        </div>

        <div className="col-6 col-md-4 col-xl-2">
          <div className="card shadow-sm border-0 rounded-3 p-3 bg-white border-start border-warning border-4 h-100">
            <span className="text-warning small fw-bold text-uppercase">Auto-Submitted</span>
            <h3 className="fw-bold mt-1 mb-0 text-warning">{counters.autoSubmitted}</h3>
            <small className="text-muted">Time Expired</small>
          </div>
        </div>

        <div className="col-6 col-md-4 col-xl-2">
          <div className="card shadow-sm border-0 rounded-3 p-3 bg-white border-start border-secondary border-4 h-100">
            <span className="text-muted small fw-bold text-uppercase">Not Started</span>
            <h3 className="fw-bold mt-1 mb-0 text-secondary">{counters.notStarted}</h3>
            <small className="text-muted">Pending Entry</small>
          </div>
        </div>

        <div className="col-6 col-md-4 col-xl-2">
          <div className="card shadow-sm border-0 rounded-3 p-3 bg-white border-start border-info border-4 h-100">
            <span className="text-info small fw-bold text-uppercase">Duration</span>
            <h3 className="fw-bold mt-1 mb-0">{monitorData?.exam?.durationMinutes || 0}m</h3>
            <small className="text-muted">{monitorData?.exam?.totalQuestions || 0} Questions</small>
          </div>
        </div>
      </div>

      {/* Real-time Socket Event Alerts Ticker */}
      {socketAlerts.length > 0 && (
        <div className="alert alert-light border shadow-sm p-3 mb-4 rounded-3">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="fw-bold small text-uppercase text-secondary d-flex align-items-center gap-2">
              <i className="bi bi-activity text-danger"></i>
              Live Proctoring Telemetry Feed & Intercom Log
            </div>
            <button
              className="btn btn-xs btn-link text-muted p-0 text-decoration-none"
              onClick={() => setSocketAlerts([])}
            >
              Clear Feed
            </button>
          </div>
          <div className="d-flex flex-column gap-1">
            {socketAlerts.map((alt) => (
              <div
                key={alt.id}
                className={`alert alert-${alt.type} py-1 px-2 mb-0 small d-flex justify-content-between align-items-center rounded`}
              >
                <span>
                  <i className="bi bi-dot me-1"></i>
                  {alt.message}
                </span>
                <span className="badge bg-white text-dark border ms-2 font-monospace">{alt.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Candidate Monitoring Workspace */}
      <div className="row g-4">
        {/* Active Candidates Display */}
        <div className="col-12 col-xl-8">
          <div className="card shadow-sm border-0 rounded-3">
            <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
              <h6 className="fw-bold mb-0 text-dark">
                <i className="bi bi-people-fill text-primary me-2"></i>
                Active Candidates In-Progress ({filteredCandidates.length})
              </h6>
              <span className="badge bg-light text-dark border">
                Total Exam Questions: {monitorData?.exam?.totalQuestions || 0}
              </span>
            </div>

            <div className="card-body p-3">
              {filteredCandidates.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-person-x fs-1 text-muted d-block mb-3"></i>
                  <h6 className="text-secondary">No Active Candidates In Exam Hall</h6>
                  <p className="text-muted small mb-0">
                    No students currently taking this exam match the search filter.
                  </p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="row g-3">
                  {filteredCandidates.map((c) => {
                    const answeredRatio =
                      c.totalQuestions > 0 ? Math.round((c.answeredQuestions / c.totalQuestions) * 100) : 0;
                    const isTimeCritical = c.alertFlag === 'CRITICAL_TIME';
                    const isExpired = c.alertFlag === 'TIME_EXPIRED';
                    const isPaused = c.isPaused;
                    const isActing = actionLoadingId === c.attemptId;

                    return (
                      <div key={c.attemptId} className="col-12 col-md-6">
                        <div
                          className={`card h-100 rounded-3 border ${
                            isPaused
                              ? 'border-warning bg-warning bg-opacity-10 shadow-sm'
                              : isExpired
                              ? 'border-dark bg-light'
                              : isTimeCritical
                              ? 'border-danger shadow-sm'
                              : 'border-light shadow-sm'
                          }`}
                        >
                          <div className="card-body p-3">
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <div>
                                <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-1">
                                  {c.studentName}
                                  {isPaused && (
                                    <span className="badge bg-warning text-dark small" style={{ fontSize: '0.65rem' }}>
                                      PAUSED
                                    </span>
                                  )}
                                </h6>
                                <small className="text-muted">{c.studentEmail}</small>
                              </div>
                              <span
                                className={`badge font-monospace fs-6 px-2 py-1 ${
                                  isPaused
                                    ? 'bg-warning text-dark'
                                    : isExpired
                                    ? 'bg-secondary'
                                    : isTimeCritical
                                    ? 'bg-danger text-white pulse'
                                    : 'bg-primary'
                                }`}
                              >
                                {isPaused ? 'PAUSED' : formatSeconds(c.remainingSeconds)}
                              </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-2">
                              <div className="d-flex justify-content-between small text-muted mb-1">
                                <span>Answered:</span>
                                <span className="fw-bold text-dark">
                                  {c.answeredQuestions} / {c.totalQuestions} ({answeredRatio}%)
                                </span>
                              </div>
                              <div className="progress" style={{ height: '6px' }}>
                                <div
                                  className={`progress-bar ${answeredRatio === 100 ? 'bg-success' : 'bg-primary'}`}
                                  role="progressbar"
                                  style={{ width: `${answeredRatio}%` }}
                                ></div>
                              </div>
                            </div>

                            {/* Candidate Telemetry Tags */}
                            <div className="d-flex flex-wrap gap-1 align-items-center mb-2">
                              <span className="badge bg-light text-dark border font-monospace small">
                                <i className="bi bi-router me-1"></i> {c.ipAddress || '127.0.0.1'}
                              </span>
                              {c.markedForReview > 0 && (
                                <span className="badge bg-warning text-dark border small">
                                  <i className="bi bi-bookmark-fill me-1"></i> {c.markedForReview} Review
                                </span>
                              )}
                              {c.interventionsCount > 0 && (
                                <span className="badge bg-info text-dark border small">
                                  <i className="bi bi-tools me-1"></i> {c.interventionsCount} Interventions
                                </span>
                              )}
                              {isTimeCritical && (
                                <span className="badge bg-danger text-white small">
                                  <i className="bi bi-clock-fill me-1"></i> &lt; 5m Left
                                </span>
                              )}
                              {isExpired && (
                                <span className="badge bg-dark text-white small">
                                  <i className="bi bi-hourglass-bottom me-1"></i> Expired (Auto-Sweep)
                                </span>
                              )}
                            </div>

                            <div className="text-muted mb-3" style={{ fontSize: '0.72rem' }}>
                              Last Activity:{' '}
                              {c.lastActivityAt ? new Date(c.lastActivityAt).toLocaleTimeString() : 'Just now'}
                            </div>

                            {/* Remote Proctor Command Intercom Toolbar */}
                            <div className="p-2 bg-white rounded border d-flex flex-wrap align-items-center justify-content-between gap-1">
                              <div className="btn-group btn-group-sm">
                                <button
                                  type="button"
                                  className="btn btn-outline-success btn-xs px-2"
                                  onClick={() => handleExtendTime(c.attemptId, 5, c.studentName)}
                                  disabled={isActing || isExpired}
                                  title="Add 5 minutes to candidate timer"
                                >
                                  +5m
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-success btn-xs px-2"
                                  onClick={() => handleExtendTime(c.attemptId, 10, c.studentName)}
                                  disabled={isActing || isExpired}
                                  title="Add 10 minutes to candidate timer"
                                >
                                  +10m
                                </button>
                              </div>

                              <div className="d-flex align-items-center gap-1">
                                <button
                                  type="button"
                                  className={`btn btn-xs px-2 fw-semibold ${
                                    isPaused ? 'btn-success' : 'btn-outline-warning text-dark'
                                  }`}
                                  onClick={() => handleTogglePause(c)}
                                  disabled={isActing || isExpired}
                                  title={isPaused ? 'Resume candidate exam' : 'Pause candidate exam'}
                                >
                                  <i className={`bi ${isPaused ? 'bi-play-fill' : 'bi-pause-fill'} me-1`}></i>
                                  {isPaused ? 'Resume' : 'Pause'}
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-outline-primary btn-xs px-2"
                                  onClick={() => setWarningModalCandidate(c)}
                                  disabled={isActing || isExpired}
                                  title="Send direct warning intercom alert"
                                >
                                  <i className="bi bi-chat-left-dots-fill me-1"></i>
                                  Warn
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-xs px-2"
                                  onClick={() => setForceSubmitCandidate(c)}
                                  disabled={isActing || isExpired}
                                  title="Force submit candidate attempt"
                                >
                                  <i className="bi bi-stop-circle-fill me-1"></i>
                                  Force Submit
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0 small">
                    <thead className="table-light text-uppercase text-muted">
                      <tr>
                        <th>Candidate</th>
                        <th>Remaining</th>
                        <th>Progress</th>
                        <th>IP Address</th>
                        <th>Status</th>
                        <th className="text-end">Remote Controls</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCandidates.map((c) => {
                        const isActing = actionLoadingId === c.attemptId;
                        return (
                          <tr key={c.attemptId} className={c.isPaused ? 'table-warning' : ''}>
                            <td>
                              <div className="fw-bold">{c.studentName}</div>
                              <div className="text-muted small">{c.studentEmail}</div>
                            </td>
                            <td>
                              <span
                                className={`badge font-monospace ${
                                  c.isPaused
                                    ? 'bg-warning text-dark'
                                    : c.alertFlag === 'CRITICAL_TIME'
                                    ? 'bg-danger text-white'
                                    : 'bg-primary text-white'
                                }`}
                              >
                                {c.isPaused ? 'PAUSED' : formatSeconds(c.remainingSeconds)}
                              </span>
                            </td>
                            <td style={{ minWidth: '130px' }}>
                              <div className="small mb-1">
                                {c.answeredQuestions} / {c.totalQuestions}
                              </div>
                              <div className="progress" style={{ height: '4px' }}>
                                <div
                                  className="progress-bar bg-success"
                                  style={{
                                    width: `${(c.answeredQuestions / (c.totalQuestions || 1)) * 100}%`
                                  }}
                                ></div>
                              </div>
                            </td>
                            <td>
                              <code className="text-primary">{c.ipAddress || '127.0.0.1'}</code>
                            </td>
                            <td>
                              <span className={`badge ${c.isPaused ? 'bg-warning text-dark' : 'bg-success'}`}>
                                {c.isPaused ? 'Paused' : 'In Progress'}
                              </span>
                            </td>
                            <td className="text-end">
                              <div className="btn-group btn-group-sm">
                                <button
                                  type="button"
                                  className="btn btn-outline-success btn-xs"
                                  onClick={() => handleExtendTime(c.attemptId, 5, c.studentName)}
                                  disabled={isActing}
                                  title="+5 Minutes"
                                >
                                  +5m
                                </button>
                                <button
                                  type="button"
                                  className={`btn btn-xs ${
                                    c.isPaused ? 'btn-success' : 'btn-outline-warning text-dark'
                                  }`}
                                  onClick={() => handleTogglePause(c)}
                                  disabled={isActing}
                                  title={c.isPaused ? 'Resume Exam' : 'Pause Exam'}
                                >
                                  {c.isPaused ? 'Resume' : 'Pause'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-primary btn-xs"
                                  onClick={() => setWarningModalCandidate(c)}
                                  disabled={isActing}
                                  title="Send Warning"
                                >
                                  Warn
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-xs"
                                  onClick={() => setForceSubmitCandidate(c)}
                                  disabled={isActing}
                                  title="Force Submit"
                                >
                                  Force
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Audit Events / Telemetry Stream */}
        <div className="col-12 col-xl-4">
          <div className="card shadow-sm border-0 rounded-3">
            <div className="card-header bg-white border-bottom py-3">
              <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                <i className="bi bi-shield-check text-success"></i>
                Audit Trail Telemetry (Past 24h)
              </h6>
            </div>
            <div className="card-body p-0">
              <div style={{ maxHeight: '560px', overflowY: 'auto' }}>
                {(monitorData?.recentEvents || []).length === 0 ? (
                  <div className="text-center py-4 text-muted small">No recent telemetry events recorded.</div>
                ) : (
                  <ul className="list-group list-group-flush small">
                    {monitorData.recentEvents.map((evt) => (
                      <li key={evt.id} className="list-group-item p-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="badge bg-light text-dark border">{evt.action}</span>
                          <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                            {new Date(evt.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="fw-semibold text-dark">{evt.user}</div>
                        <div className="text-muted small">
                          IP: <code className="text-secondary">{evt.ip || '127.0.0.1'}</code>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* COHORT BROADCAST ANNOUNCEMENT MODAL */}
      {showBroadcastModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-megaphone-fill text-primary"></i>
                  Broadcast Announcement to Exam Hall
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowBroadcastModal(false)}></button>
              </div>
              <form onSubmit={handleBroadcastSubmit}>
                <div className="modal-body p-4">
                  <p className="text-muted small mb-3">
                    This notification will be transmitted instantly to all active student screens in room{' '}
                    <strong>exam_{selectedExamId}</strong>.
                  </p>

                  <div className="mb-3">
                    <label className="form-label small fw-bold text-secondary">Announcement Message:</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="e.g., Note on Question 4: Disregard typo in option B; please read as 'Standard Deviation'."
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      required
                    ></textarea>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold text-secondary">Urgency / Priority Level:</label>
                    <select
                      className="form-select form-select-sm"
                      value={broadcastPriority}
                      onChange={(e) => setBroadcastPriority(e.target.value)}
                    >
                      <option value="normal">Normal (Informative Blue Banner)</option>
                      <option value="warning">Warning (Notice Yellow Banner)</option>
                      <option value="urgent">Urgent (Flashing Red High-Priority Banner)</option>
                    </select>
                  </div>
                </div>

                <div className="modal-footer border-top py-2 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setShowBroadcastModal(false)}
                    disabled={isBroadcasting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm fw-bold d-flex align-items-center gap-2"
                    disabled={isBroadcasting || !broadcastMessage.trim()}
                  >
                    {isBroadcasting ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                        <span>Broadcasting...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-broadcast"></i>
                        <span>Transmit Broadcast</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* DIRECT CANDIDATE WARNING MODAL */}
      {warningModalCandidate && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-chat-left-dots-fill text-warning"></i>
                  Candidate Intercom: Dispatch Warning
                </h5>
                <button type="button" className="btn-close" onClick={() => setWarningModalCandidate(null)}></button>
              </div>
              <form onSubmit={handleSendWarningSubmit}>
                <div className="modal-body p-4">
                  <div className="p-3 bg-light rounded-3 mb-3 border">
                    <div className="fw-bold text-dark">{warningModalCandidate.studentName}</div>
                    <div className="text-muted small">{warningModalCandidate.studentEmail}</div>
                    <div className="text-muted small">Attempt ID: {warningModalCandidate.attemptId}</div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold text-secondary">Warning Severity:</label>
                    <select
                      className="form-select form-select-sm"
                      value={warningSeverity}
                      onChange={(e) => setWarningSeverity(e.target.value)}
                    >
                      <option value="advisory">Advisory Notice (Yellow)</option>
                      <option value="warning">Formal Warning (Orange)</option>
                      <option value="final_warning">Final Warning Before Termination (Red)</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-bold text-secondary">Warning Message to Candidate:</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="e.g., Please ensure your webcam faces you directly. Suspicious eye movements detected."
                      value={warningMessage}
                      onChange={(e) => setWarningMessage(e.target.value)}
                      required
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer border-top py-2 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setWarningModalCandidate(null)}
                    disabled={isSendingWarning}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-warning btn-sm fw-bold text-dark d-flex align-items-center gap-2"
                    disabled={isSendingWarning || !warningMessage.trim()}
                  >
                    {isSendingWarning ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                        <span>Dispatching...</span>
                      </>
                    ) : (
                      <>
                        <i className="bi bi-send-fill"></i>
                        <span>Send Alert to Candidate Screen</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* FORCE SUBMIT CONFIRMATION MODAL */}
      {forceSubmitCandidate && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3">
                <h5 className="modal-title fw-bold text-danger d-flex align-items-center gap-2">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  Confirm Remote Force Submit
                </h5>
                <button type="button" className="btn-close" onClick={() => setForceSubmitCandidate(null)}></button>
              </div>
              <div className="modal-body p-4 text-center">
                <div
                  className="rounded-circle bg-danger bg-opacity-10 text-danger d-inline-flex align-items-center justify-content-center mb-3"
                  style={{ width: '70px', height: '70px', fontSize: '2rem' }}
                >
                  <i className="bi bi-stop-circle-fill"></i>
                </div>
                <h5 className="fw-bold text-dark mb-1">
                  Force-submit {forceSubmitCandidate.studentName}?
                </h5>
                <p className="text-muted small mb-3">
                  This will immediately freeze the candidate's active exam session, evaluate all recorded answers, and record an administrative termination audit trail.
                </p>

                <div className="text-start mb-3">
                  <label className="form-label small fw-bold text-secondary">Reason for Termination:</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g., Unresolved proctoring infractions / unauthorised materials"
                    value={forceSubmitReason}
                    onChange={(e) => setForceSubmitReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer border-top py-2 d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setForceSubmitCandidate(null)}
                  disabled={isForceSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm fw-bold d-flex align-items-center gap-2"
                  onClick={handleForceSubmitExecute}
                  disabled={isForceSubmitting}
                >
                  {isForceSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check2-circle"></i>
                      <span>Yes, Force Finalize Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMonitor;
