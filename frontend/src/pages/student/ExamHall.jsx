import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../../context/AuthContext';
import { studentExamService } from '../../services/studentExamService';
import { proctorService } from '../../services/proctorService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AntiLeakWatermark from '../../components/common/AntiLeakWatermark';

const ExamHall = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Exam Attempt State
  const [exam, setExam] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [qId]: { selected_option_key, is_marked_for_review } }

  // High-Precision Server Time & Expiry Tracking (Section 9)
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const serverExpiryTimeRef = useRef(null); // Unix timestamp (ms)
  const serverTimeOffsetRef = useRef(0); // client clock offset vs server clock
  const timerIntervalRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);

  // Network & Offline Resilience State (Section 9)
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineSyncCount, setOfflineSyncCount] = useState(0);
  const [autosaveStatus, setAutosaveStatus] = useState('saved'); // 'saved' | 'saving' | 'offline_saved' | 'syncing' | 'error'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Alerts & Milestone Notifications
  const [timeWarning, setTimeWarning] = useState(null); // { type: 'warning' | 'critical', message: string }
  const hasAlerted5Min = useRef(false);
  const hasAlerted1Min = useRef(false);

  // Final Submission State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);

  // AI Proctor Surveillance State
  const [attemptId, setAttemptId] = useState(null);
  const attemptIdRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [proctorAlert, setProctorAlert] = useState(null);
  const mediaStreamRef = useRef(null);
  const proctorIntervalRef = useRef(null);

  // Phase 14 Remote Proctor Controls & Intercom State
  const [isPaused, setIsPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState(null);
  const [directWarning, setDirectWarning] = useState(null);
  const [cohortAnnouncement, setCohortAnnouncement] = useState(null);
  const [timeExtensionToast, setTimeExtensionToast] = useState(null);
  const socketRef = useRef(null);

  // Storage keys for offline resilience
  const OFFLINE_ANSWERS_KEY = `exam_${id}_cached_answers`;
  const PENDING_SYNC_KEY = `exam_${id}_pending_sync`;

  // Play subtle browser audio tone for timer milestones
  const playMilestoneTone = (freq = 440, type = 'sine', duration = 0.2) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // 1. Initial Exam Boot & Recovery
  useEffect(() => {
    initExamAttempt();

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [id]);

  // 2. Network Online/Offline Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushPendingOfflineAnswers();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setAutosaveStatus('offline_saved');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [id]);

  // 3. Page Unload Guard (Warn Candidate Before Leaving Active Exam)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!submissionResult && questions.length > 0) {
        e.preventDefault();
        e.returnValue = 'An examination is currently in progress. Your server timer will continue running.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [submissionResult, questions.length]);

  // 4. Tab Visibility & Clock Drift Correction (Section 9)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && serverExpiryTimeRef.current && !submissionResult) {
        recalculateRemainingTime();
        triggerTimerSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [submissionResult]);

  // Recalculate remaining seconds based strictly on server expiry timestamp + client-server delta
  const recalculateRemainingTime = useCallback(() => {
    if (!serverExpiryTimeRef.current) return 0;
    const nowServer = Date.now() + serverTimeOffsetRef.current;
    const diffSeconds = Math.max(0, Math.floor((serverExpiryTimeRef.current - nowServer) / 1000));
    setRemainingSeconds(diffSeconds);

    // Threshold Milestone Alerts
    if (diffSeconds <= 300 && diffSeconds > 60 && !hasAlerted5Min.current) {
      hasAlerted5Min.current = true;
      setTimeWarning({
        type: 'warning',
        message: '⚠️ 5 Minutes Remaining! Please review your unanswered and marked questions.'
      });
      playMilestoneTone(587.33, 'triangle', 0.3); // Note D5
    }

    if (diffSeconds <= 60 && diffSeconds > 0 && !hasAlerted1Min.current) {
      hasAlerted1Min.current = true;
      setTimeWarning({
        type: 'critical',
        message: '🚨 1 Minute Remaining! Exam will automatically submit when timer reaches 00:00.'
      });
      playMilestoneTone(880, 'sawtooth', 0.4); // Note A5
    }

    return diffSeconds;
  }, []);

  // Periodic Timer Tick (1s Interval)
  useEffect(() => {
    if (loading || submissionResult || !serverExpiryTimeRef.current || isPaused) return;

    timerIntervalRef.current = setInterval(() => {
      const remaining = recalculateRemainingTime();
      if (remaining <= 0) {
        clearInterval(timerIntervalRef.current);
        handleAutoSubmitOnExpiry();
      }
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [loading, submissionResult, isPaused, recalculateRemainingTime]);

  // Periodic Server Heartbeat Sync (Every 45 seconds)
  useEffect(() => {
    if (loading || submissionResult) return;

    heartbeatIntervalRef.current = setInterval(() => {
      if (navigator.onLine) {
        triggerTimerSync();
      }
    }, 45000);

    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [loading, submissionResult]);

  // Start or Resume Attempt from Server
  const initExamAttempt = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await studentExamService.startOrResumeExam(id);

      if (res.success) {
        setAttemptId(res.attemptId);
        attemptIdRef.current = res.attemptId;
        setExam(res.exam);
        setQuestions(res.questions);
        if (res.candidate) {
          setCandidate(res.candidate);
        }

        // Calculate client-to-server clock offset
        const serverNowMs = res.serverTime ? new Date(res.serverTime).getTime() : Date.now();
        const clientNowMs = Date.now();
        serverTimeOffsetRef.current = serverNowMs - clientNowMs;

        const expiryMs = new Date(res.serverExpiryTime).getTime();
        serverExpiryTimeRef.current = expiryMs;

        const currentServerNow = Date.now() + serverTimeOffsetRef.current;
        const initialRemaining = Math.max(0, Math.floor((expiryMs - currentServerNow) / 1000));
        setRemainingSeconds(initialRemaining);

        // Prepopulate server-saved answers
        let initialAnswers = res.savedAnswers || {};

        // Merge with any offline localStorage backup if available
        try {
          const cachedRaw = localStorage.getItem(OFFLINE_ANSWERS_KEY);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw);
            initialAnswers = { ...initialAnswers, ...cached };
          }
        } catch {
          // Ignore local parse errors
        }

        setAnswers(initialAnswers);
        localStorage.setItem(OFFLINE_ANSWERS_KEY, JSON.stringify(initialAnswers));

        if (res.isPaused) {
          setIsPaused(true);
          setPauseReason('Examination session temporarily held by proctor.');
        }

        // Check if there are pending offline sync items from previous network drop
        const pendingRaw = localStorage.getItem(PENDING_SYNC_KEY);
        if (pendingRaw) {
          try {
            const pendingList = JSON.parse(pendingRaw);
            if (Array.isArray(pendingList) && pendingList.length > 0) {
              setOfflineSyncCount(pendingList.length);
              flushPendingOfflineAnswers();
            }
          } catch {
            // Ignore
          }
        }
      }
    } catch (err) {
      if (err.response?.data?.isExpired) {
        // Attempt was already expired and auto-submitted
        setSubmissionResult({
          ...err.response.data.summary,
          isAuto: true
        });
      } else if (err.response?.data?.isSubmitted) {
        setError('You have already submitted this examination. Re-entry is not permitted.');
      } else {
        setError(err.response?.data?.message || 'Unable to connect to examination server.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Background Timer Sync & Heartbeat
  const triggerTimerSync = async () => {
    try {
      const res = await studentExamService.timerSync(id);
      if (res.success) {
        if (res.isExpired || res.status === 'auto_submitted') {
          // Server marked as expired
          setRemainingSeconds(0);
          setSubmissionResult({
            ...res.summary,
            isAuto: true
          });
          return;
        }

        if (res.isPaused !== undefined) {
          setIsPaused(!!res.isPaused);
        }

        // Adjust clock drift with authoritative server time
        const serverNowMs = new Date(res.serverTime).getTime();
        serverTimeOffsetRef.current = serverNowMs - Date.now();
        serverExpiryTimeRef.current = new Date(res.serverExpiryTime).getTime();
        recalculateRemainingTime();
      }
    } catch {
      // Background sync failure shouldn't interrupt the candidate
    }
  };

  // Phase 14 Socket.IO Proctor Command Intercom Connection
  useEffect(() => {
    if (!id || !attemptId) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || (window.location.origin.includes(':5173')
      ? 'http://localhost:5000'
      : 'https://online-exam-4llf.onrender.com');

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      socket.emit('join_exam_room', { examId: id, studentId: attemptId });
    });

    socket.on('exam_time_extended', (payload) => {
      if (payload.attemptId === attemptIdRef.current) {
        if (payload.newServerExpiryTime) {
          serverExpiryTimeRef.current = new Date(payload.newServerExpiryTime).getTime();
          recalculateRemainingTime();
        }
        setTimeExtensionToast({
          extraMinutes: payload.extraMinutes,
          reason: payload.reason
        });
        playMilestoneTone(659.25, 'triangle', 0.4);
      }
    });

    socket.on('exam_paused', (payload) => {
      if (payload.attemptId === attemptIdRef.current) {
        setIsPaused(true);
        setPauseReason(payload.reason || 'Examination session temporarily paused by proctor.');
        playMilestoneTone(329.63, 'square', 0.5);
      }
    });

    socket.on('exam_resumed', (payload) => {
      if (payload.attemptId === attemptIdRef.current) {
        if (payload.newServerExpiryTime) {
          serverExpiryTimeRef.current = new Date(payload.newServerExpiryTime).getTime();
        }
        setIsPaused(false);
        setPauseReason(null);
        recalculateRemainingTime();
        setTimeExtensionToast({
          extraMinutes: Math.max(1, Math.round((payload.elapsedPausedSeconds || 0) / 60)),
          reason: `Session resumed. +${payload.elapsedPausedSeconds || 0}s compensatory time added.`
        });
        playMilestoneTone(523.25, 'sine', 0.3);
      }
    });

    socket.on('proctor_warning_alert', (payload) => {
      if (payload.attemptId === attemptIdRef.current) {
        setDirectWarning({
          message: payload.message,
          severity: payload.severity || 'warning',
          proctorName: payload.proctorName || 'Chief Proctor',
          timestamp: payload.timestamp || new Date().toISOString()
        });
        playMilestoneTone(880, 'sawtooth', 0.6);
      }
    });

    socket.on('exam_force_submitted', (payload) => {
      if (payload.attemptId === attemptIdRef.current) {
        handleAutoSubmitOnExpiry();
      }
    });

    socket.on('cohort_announcement', (payload) => {
      setCohortAnnouncement({
        message: payload.message,
        priority: payload.priority || 'normal',
        proctorName: payload.proctorName || 'Chief Proctor',
        timestamp: payload.timestamp || new Date().toISOString()
      });
      playMilestoneTone(587.33, 'triangle', 0.3);
    });

    socketRef.current = socket;

    return () => {
      if (socket) socket.disconnect();
    };
  }, [id, attemptId, recalculateRemainingTime]);

  // Auto-dismiss time extension toast after 8 seconds
  useEffect(() => {
    if (timeExtensionToast) {
      const timer = setTimeout(() => setTimeExtensionToast(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [timeExtensionToast]);

  // Anti-Leak Watermark Tamper Anomaly Handler
  const handleWatermarkTamper = useCallback((details) => {
    console.warn('[SECURITY ALERT] Watermark tampering intercepted:', details);
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('watermark_tamper_anomaly', {
        examId: id,
        studentId: candidate?.student_id || user?.id,
        studentName: candidate?.name || user?.name || 'Candidate',
        timestamp: new Date().toISOString(),
        details
      });
    }
  }, [id, candidate, user]);

  // Snapshot Capture & Upload Helper
  const captureAndSendSnapshot = useCallback(async (type = 'periodic', anomaly = false, anomalyType = 'NONE', confidence = 1.0) => {
    if (!attemptIdRef.current) return;

    try {
      let snapshotDataUrl = '';
      if (videoRef.current && canvasRef.current && cameraActive) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        snapshotDataUrl = canvas.toDataURL('image/jpeg', 0.6);
      } else {
        snapshotDataUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect fill="%231a1d20" width="320" height="240"/><text fill="%23adb5bd" font-family="sans-serif" font-size="14" x="50%" y="50%" text-anchor="middle" dominant-baseline="middle">Surveillance Stream Active</text></svg>';
      }

      await proctorService.uploadSnapshot({
        exam_attempt_id: attemptIdRef.current,
        snapshot_url: snapshotDataUrl,
        snapshot_type: type,
        anomaly_detected: anomaly,
        anomaly_type: anomalyType,
        confidence_score: confidence
      });
    } catch {
      // Non-blocking upload failure handling
    }
  }, [cameraActive]);

  // AI Proctor Webcam Stream Boot & Cleanup
  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 } },
          audio: false
        });

        if (active) {
          mediaStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setCameraActive(true);

          setTimeout(() => {
            captureAndSendSnapshot('entry', false, 'NONE', 1.0);
          }, 1500);
        } else {
          stream.getTracks().forEach(t => t.stop());
        }
      } catch {
        // Fallback gracefully if camera permission denied or unavailable
        setCameraActive(false);
      }
    };

    startCamera();

    return () => {
      active = false;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (proctorIntervalRef.current) {
        clearInterval(proctorIntervalRef.current);
      }
    };
  }, [captureAndSendSnapshot]);

  // Periodic Snapshot Interval (Every 60 Seconds)
  useEffect(() => {
    if (loading || submissionResult || !attemptId) return;

    proctorIntervalRef.current = setInterval(() => {
      captureAndSendSnapshot('periodic', false, 'NONE', 1.0);
    }, 60000);

    return () => {
      if (proctorIntervalRef.current) clearInterval(proctorIntervalRef.current);
    };
  }, [loading, submissionResult, attemptId, captureAndSendSnapshot]);

  // Tab Switch / Blur Anomaly Detection
  useEffect(() => {
    const handleTabAnomaly = () => {
      if (document.hidden && !submissionResult && attemptIdRef.current) {
        setProctorAlert('Security Alert: Tab change or window minimization detected! This incident has been logged.');
        captureAndSendSnapshot('anomaly', true, 'TAB_SWITCH', 0.95);
      }
    };

    document.addEventListener('visibilitychange', handleTabAnomaly);
    return () => {
      document.removeEventListener('visibilitychange', handleTabAnomaly);
    };
  }, [submissionResult, captureAndSendSnapshot]);

  // Instant Autosave with Offline Resilience Queue
  const handleSelectOption = async (optionKey) => {
    if (submissionResult || isSubmitting || isPaused) return;

    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const currentAnswerObj = answers[currentQ.id] || { is_marked_for_review: false };
    const newAnswerObj = {
      ...currentAnswerObj,
      selected_option_key: optionKey
    };

    // 1. Instant optimistic state update
    const updatedAnswers = {
      ...answers,
      [currentQ.id]: newAnswerObj
    };
    setAnswers(updatedAnswers);

    // 2. Persist to local storage backup immediately
    try {
      localStorage.setItem(OFFLINE_ANSWERS_KEY, JSON.stringify(updatedAnswers));
    } catch {
      // Storage quota safety
    }

    // 3. Queue / send to server
    if (navigator.onLine) {
      try {
        setAutosaveStatus('saving');
        await studentExamService.saveAnswer(id, {
          question_id: currentQ.id,
          selected_option_key: optionKey,
          is_marked_for_review: newAnswerObj.is_marked_for_review
        });
        setAutosaveStatus('saved');
      } catch (err) {
        if (err.response?.data?.isExpired) {
          handleAutoSubmitOnExpiry();
        } else {
          enqueueOfflineAnswer(currentQ.id, optionKey, newAnswerObj.is_marked_for_review);
          setAutosaveStatus('offline_saved');
        }
      }
    } else {
      enqueueOfflineAnswer(currentQ.id, optionKey, newAnswerObj.is_marked_for_review);
      setAutosaveStatus('offline_saved');
    }
  };

  // Clear Selected Option
  const handleClearOption = async () => {
    if (submissionResult || isSubmitting || isPaused) return;

    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const currentAnswerObj = answers[currentQ.id] || { is_marked_for_review: false };
    const newAnswerObj = {
      ...currentAnswerObj,
      selected_option_key: null
    };

    const updatedAnswers = {
      ...answers,
      [currentQ.id]: newAnswerObj
    };
    setAnswers(updatedAnswers);

    try {
      localStorage.setItem(OFFLINE_ANSWERS_KEY, JSON.stringify(updatedAnswers));
    } catch {
      // Ignore
    }

    if (navigator.onLine) {
      try {
        setAutosaveStatus('saving');
        await studentExamService.saveAnswer(id, {
          question_id: currentQ.id,
          selected_option_key: null,
          is_marked_for_review: newAnswerObj.is_marked_for_review
        });
        setAutosaveStatus('saved');
      } catch {
        enqueueOfflineAnswer(currentQ.id, null, newAnswerObj.is_marked_for_review);
        setAutosaveStatus('offline_saved');
      }
    } else {
      enqueueOfflineAnswer(currentQ.id, null, newAnswerObj.is_marked_for_review);
      setAutosaveStatus('offline_saved');
    }
  };

  // Toggle Mark for Review
  const handleToggleReview = async () => {
    if (submissionResult || isSubmitting || isPaused) return;

    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const currentAnswerObj = answers[currentQ.id] || { selected_option_key: null };
    const newReviewState = !currentAnswerObj.is_marked_for_review;

    const newAnswerObj = {
      ...currentAnswerObj,
      is_marked_for_review: newReviewState
    };

    const updatedAnswers = {
      ...answers,
      [currentQ.id]: newAnswerObj
    };
    setAnswers(updatedAnswers);

    try {
      localStorage.setItem(OFFLINE_ANSWERS_KEY, JSON.stringify(updatedAnswers));
    } catch {
      // Ignore
    }

    if (navigator.onLine) {
      try {
        setAutosaveStatus('saving');
        await studentExamService.saveAnswer(id, {
          question_id: currentQ.id,
          selected_option_key: newAnswerObj.selected_option_key,
          is_marked_for_review: newReviewState
        });
        setAutosaveStatus('saved');
      } catch {
        enqueueOfflineAnswer(currentQ.id, newAnswerObj.selected_option_key, newReviewState);
        setAutosaveStatus('offline_saved');
      }
    } else {
      enqueueOfflineAnswer(currentQ.id, newAnswerObj.selected_option_key, newReviewState);
      setAutosaveStatus('offline_saved');
    }
  };

  // Enqueue answer for offline sync when network recovers
  const enqueueOfflineAnswer = (questionId, selectedKey, isReview) => {
    try {
      const raw = localStorage.getItem(PENDING_SYNC_KEY);
      let list = raw ? JSON.parse(raw) : [];
      // Remove any prior pending entry for this question
      list = list.filter((item) => item.question_id !== questionId);
      list.push({
        question_id: questionId,
        selected_option_key: selectedKey,
        is_marked_for_review: isReview,
        timestamp: Date.now()
      });
      localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(list));
      setOfflineSyncCount(list.length);
    } catch {
      // Storage error
    }
  };

  // Bulk flush queued answers when internet connection is restored
  const flushPendingOfflineAnswers = async () => {
    try {
      const raw = localStorage.getItem(PENDING_SYNC_KEY);
      if (!raw) return;

      const list = JSON.parse(raw);
      if (!Array.isArray(list) || list.length === 0) return;

      setAutosaveStatus('syncing');
      const res = await studentExamService.syncOfflineAnswers(id, list);

      if (res.success) {
        localStorage.removeItem(PENDING_SYNC_KEY);
        setOfflineSyncCount(0);
        setAutosaveStatus('saved');
      }
    } catch (err) {
      if (err.response?.data?.isExpired) {
        handleAutoSubmitOnExpiry();
      } else {
        setAutosaveStatus('offline_saved');
      }
    }
  };

  // Automatic Submission upon Time Expiration (Section 9)
  const handleAutoSubmitOnExpiry = async () => {
    if (submissionResult || isSubmitting) return;

    try {
      setIsSubmitting(true);
      // Try to flush any pending offline answers first before closing attempt
      try {
        const raw = localStorage.getItem(PENDING_SYNC_KEY);
        if (raw) {
          const list = JSON.parse(raw);
          if (list.length > 0) {
            await studentExamService.syncOfflineAnswers(id, list);
          }
        }
      } catch {
        // Continue to submit
      }

      const res = await studentExamService.submitExam(id, { submission_type: 'auto' });
      if (res.success) {
        // Clear local storage exam cache on successful submission
        localStorage.removeItem(OFFLINE_ANSWERS_KEY);
        localStorage.removeItem(PENDING_SYNC_KEY);

        setSubmissionResult({
          ...res.summary,
          isAuto: true
        });
      }
    } catch (err) {
      setError('Time expired. Examination attempt was automatically finalized by the server.');
    } finally {
      setIsSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  // Manual Final Submission
  const handleFinalSubmit = async () => {
    if (isSubmitting || isPaused) return;

    try {
      setIsSubmitting(true);

      // Flush any pending offline answers before final submit
      try {
        const raw = localStorage.getItem(PENDING_SYNC_KEY);
        if (raw) {
          const list = JSON.parse(raw);
          if (list.length > 0) {
            await studentExamService.syncOfflineAnswers(id, list);
          }
        }
      } catch {
        // Continue
      }

      const res = await studentExamService.submitExam(id, { submission_type: 'manual' });
      if (res.success) {
        localStorage.removeItem(OFFLINE_ANSWERS_KEY);
        localStorage.removeItem(PENDING_SYNC_KEY);

        setSubmissionResult({
          ...res.summary,
          isAuto: false
        });
        setShowConfirmModal(false);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Submission failed. Please check network connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format Timer String (HH:MM:SS or MM:SS)
  const formatTime = (totalSecs) => {
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    if (hours > 0) {
      return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
    return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Calculate Statistics for Palette
  const answeredCount = questions.filter((q) => answers[q.id]?.selected_option_key).length;
  const markedForReviewCount = questions.filter((q) => answers[q.id]?.is_marked_for_review).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);

  if (loading) {
    return (
      <div className="vh-100 d-flex align-items-center justify-content-center bg-light">
        <LoadingSpinner message="Entering Examination Hall..." />
      </div>
    );
  }

  if (error && !submissionResult) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger p-4 rounded-4 shadow-sm" role="alert">
          <div className="d-flex align-items-center gap-2 mb-2">
            <i className="bi bi-exclamation-triangle-fill fs-4 text-danger"></i>
            <h4 className="fw-bold mb-0">Examination Notice</h4>
          </div>
          <p className="mb-3 text-secondary">{error}</p>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/student/exams')}>
            <i className="bi bi-arrow-left me-1"></i> Return to Examination Portal
          </button>
        </div>
      </div>
    );
  }

  // SUBMISSION SUCCESS CARD
  if (submissionResult) {
    return (
      <div className="vh-100 d-flex align-items-center justify-content-center bg-light p-3">
        <div className="card-custom bg-white p-5 text-center shadow-lg" style={{ maxWidth: '620px' }}>
          <div
            className={`rounded-circle d-inline-flex align-items-center justify-content-center mb-3 shadow ${
              submissionResult.isPassed ? 'bg-success text-white' : 'bg-primary text-white'
            }`}
            style={{ width: '80px', height: '80px', fontSize: '2.5rem' }}
          >
            <i className={`bi ${submissionResult.isAuto ? 'bi-stopwatch-fill' : 'bi-check2-circle'}`}></i>
          </div>

          <h3 className="fw-bold text-dark mb-1">
            {submissionResult.isAuto ? 'Time Expired: Examination Auto-Submitted' : 'Examination Submitted Successfully!'}
          </h3>
          <p className="text-muted small mb-4">
            {submissionResult.isAuto
              ? 'The server countdown reached zero. All your saved answers have been automatically evaluated.'
              : 'Your responses have been securely verified and evaluated by the server.'}
          </p>

          {/* Detailed Score Breakdown */}
          <div className="row g-2 p-3 bg-light rounded-3 mb-4 text-center border">
            <div className="col-3 border-end">
              <span className="text-muted d-block small" style={{ fontSize: '0.72rem' }}>Total MCQs</span>
              <strong className="fs-5 text-dark">{submissionResult.totalQuestions}</strong>
            </div>
            <div className="col-3 border-end">
              <span className="text-muted d-block small" style={{ fontSize: '0.72rem' }}>Attempted</span>
              <strong className="fs-5 text-primary">{submissionResult.attempted}</strong>
            </div>
            <div className="col-3 border-end">
              <span className="text-muted d-block small" style={{ fontSize: '0.72rem' }}>Correct</span>
              <strong className="fs-5 text-success">{submissionResult.correct}</strong>
            </div>
            <div className="col-3">
              <span className="text-muted d-block small" style={{ fontSize: '0.72rem' }}>Wrong</span>
              <strong className="fs-5 text-danger">{submissionResult.wrong}</strong>
            </div>
          </div>

          {/* Marks & Percentage Banner */}
          <div className="d-flex justify-content-between align-items-center p-3 rounded-3 bg-white border mb-4">
            <div>
              <span className="text-muted small d-block">Total Marks Obtained</span>
              <h4 className="fw-bold text-dark mb-0">
                {submissionResult.marksObtained} <span className="text-muted fs-6">/ {submissionResult.maxMarks}</span>
              </h4>
            </div>
            <div className="text-end">
              <span className="text-muted small d-block">Percentage</span>
              <h4 className="fw-bold text-primary mb-0">{submissionResult.percentage}%</h4>
            </div>
            <div>
              <span className="text-muted small d-block">Status</span>
              <span className={`badge fs-6 ${submissionResult.isPassed ? 'bg-success' : 'bg-danger'}`}>
                {submissionResult.isPassed ? 'PASSED' : 'NEEDS IMPROVEMENT'}
              </span>
            </div>
          </div>

          <div className="d-flex justify-content-center gap-3">
            <button className="btn btn-primary px-4 py-2 fw-semibold" onClick={() => navigate('/student/dashboard')}>
              <i className="bi bi-house-door-fill me-1"></i> Return to Dashboard
            </button>
            <button className="btn btn-outline-secondary px-4 py-2" onClick={() => navigate('/student/exams')}>
              Examination Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex] || {};
  const currentSelectedKey = answers[currentQ.id]?.selected_option_key;
  const isCurrentMarkedForReview = !!answers[currentQ.id]?.is_marked_for_review;

  const isTimerLow = remainingSeconds < 300; // < 5 mins
  const isTimerCritical = remainingSeconds < 60; // < 1 min

  return (
    <div className="min-vh-100 d-flex flex-column bg-light position-relative">
      {/* ENTERPRISE ANTI-LEAK DYNAMIC WATERMARK OVERLAY */}
      <AntiLeakWatermark
        candidate={candidate || user}
        examTitle={exam?.title || 'Online Examination'}
        attemptId={attemptId || id}
        onTamperDetected={handleWatermarkTamper}
      />

      {/* TIME EXTENSION TOAST NOTIFICATION */}
      {timeExtensionToast && (
        <div
          className="position-fixed top-0 end-0 m-4 p-3 rounded-4 shadow-lg bg-success text-white d-flex align-items-center gap-3 border border-white"
          style={{ zIndex: 2100, maxWidth: '420px' }}
        >
          <div
            className="rounded-circle bg-white text-success d-flex align-items-center justify-content-center shadow-sm"
            style={{ width: '45px', height: '45px', fontSize: '1.4rem' }}
          >
            <i className="bi bi-clock-history"></i>
          </div>
          <div className="flex-grow-1">
            <div className="fw-bold small">Time Extension Granted!</div>
            <div className="small text-white-50">
              +{timeExtensionToast.extraMinutes} minutes added to your test countdown.
            </div>
            {timeExtensionToast.reason && (
              <div className="small text-white fst-italic mt-1" style={{ fontSize: '0.72rem' }}>
                "{timeExtensionToast.reason}"
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn-close btn-close-white btn-close-sm ms-2"
            onClick={() => setTimeExtensionToast(null)}
          ></button>
        </div>
      )}

      {/* COHORT ROOM-WIDE ANNOUNCEMENT BANNER */}
      {cohortAnnouncement && (
        <div
          className={`py-2 px-3 small fw-bold border-bottom d-flex align-items-center justify-content-between ${
            cohortAnnouncement.priority === 'urgent'
              ? 'bg-danger text-white'
              : cohortAnnouncement.priority === 'warning'
              ? 'bg-warning text-dark'
              : 'bg-primary text-white'
          }`}
          style={{ zIndex: 1045 }}
        >
          <div className="d-flex align-items-center gap-2">
            <i
              className={`bi ${
                cohortAnnouncement.priority === 'urgent'
                  ? 'bi-exclamation-triangle-fill'
                  : 'bi-megaphone-fill'
              }`}
            ></i>
            <span className="badge bg-dark text-white text-uppercase" style={{ fontSize: '0.7rem' }}>
              Broadcast ({cohortAnnouncement.priority})
            </span>
            <span>{cohortAnnouncement.message}</span>
            <small className="opacity-75 d-none d-md-inline">
              — {cohortAnnouncement.proctorName}
            </small>
          </div>
          <button
            type="button"
            className={`btn-close btn-close-sm ${
              cohortAnnouncement.priority === 'warning' ? '' : 'btn-close-white'
            }`}
            onClick={() => setCohortAnnouncement(null)}
            aria-label="Dismiss"
          ></button>
        </div>
      )}

      {/* OFFLINE / RECONNECTING BANNER */}
      {!isOnline && (
        <div className="bg-warning text-dark py-2 px-3 text-center small fw-semibold border-bottom shadow-sm d-flex align-items-center justify-content-center gap-2">
          <i className="bi bi-wifi-off fs-6"></i>
          <span>
            You are currently offline. Answers are saved safely on your device and will synchronize automatically when connection is restored.
          </span>
          {offlineSyncCount > 0 && (
            <span className="badge bg-dark text-white px-2 py-1">{offlineSyncCount} pending sync</span>
          )}
        </div>
      )}

      {/* 5-MINUTE OR 1-MINUTE MILESTONE ALERT */}
      {timeWarning && (
        <div
          className={`py-2 px-3 text-center small fw-bold border-bottom d-flex align-items-center justify-content-center gap-2 ${
            timeWarning.type === 'critical' ? 'bg-danger text-white' : 'bg-warning-subtle text-dark'
          }`}
        >
          <span>{timeWarning.message}</span>
          <button
            type="button"
            className="btn-close btn-close-sm ms-2"
            onClick={() => setTimeWarning(null)}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* TOP BAR: Title, Countdown Timer, Autosave Status & Final Submit */}
      <header className="bg-white border-bottom shadow-sm px-3 py-2 sticky-top" style={{ zIndex: 1040 }}>
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
          {/* Exam Title & Subject */}
          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-primary px-2 py-1">Exam Hall</span>
            <div className="fw-bold text-dark text-truncate" style={{ maxWidth: '300px' }}>
              {exam?.title}
            </div>
            <span className="badge bg-light text-muted border d-none d-sm-inline-block">
              {exam?.duration_minutes} Mins
            </span>
          </div>

          {/* Center: Server-Synced Countdown Timer (Section 9) */}
          <div
            className={`d-flex align-items-center gap-2 px-3 py-1 rounded-pill fw-bold border ${
              isPaused
                ? 'bg-warning text-dark border-warning shadow-sm'
                : isTimerCritical
                ? 'bg-danger text-white border-danger shadow-sm'
                : isTimerLow
                ? 'bg-warning-subtle text-danger border-warning'
                : 'bg-light text-dark'
            }`}
            style={{
              fontSize: '1.2rem',
              letterSpacing: '0.06em',
              animation: !isPaused && isTimerCritical ? 'pulse 1s infinite' : 'none'
            }}
          >
            <i
              className={`bi ${
                isPaused
                  ? 'bi-pause-circle-fill text-dark'
                  : isTimerCritical
                  ? 'bi-alarm-fill text-white'
                  : 'bi-stopwatch text-primary'
              }`}
            ></i>
            <span>{isPaused ? 'SESSION PAUSED' : formatTime(remainingSeconds)}</span>
          </div>

          {/* Right: Autosave Status & Submit Button */}
          <div className="d-flex align-items-center gap-3">
            <div className="small text-muted d-none d-md-flex align-items-center gap-1">
              {autosaveStatus === 'saving' && (
                <>
                  <span className="spinner-border spinner-border-sm text-primary" role="status"></span>
                  <span>Saving...</span>
                </>
              )}
              {autosaveStatus === 'saved' && (
                <>
                  <i className="bi bi-cloud-check-fill text-success fs-6"></i>
                  <span className="text-success fw-medium">All answers saved</span>
                </>
              )}
              {autosaveStatus === 'offline_saved' && (
                <>
                  <i className="bi bi-hdd-fill text-warning fs-6"></i>
                  <span className="text-warning fw-medium">Saved locally (offline)</span>
                </>
              )}
              {autosaveStatus === 'syncing' && (
                <>
                  <span className="spinner-border spinner-border-sm text-info" role="status"></span>
                  <span className="text-info fw-medium">Syncing offline answers...</span>
                </>
              )}
              {autosaveStatus === 'error' && (
                <>
                  <i className="bi bi-cloud-slash-fill text-danger fs-6"></i>
                  <span className="text-danger fw-semibold">Retrying save...</span>
                </>
              )}
            </div>

            <button
              className="btn btn-danger btn-sm fw-bold px-3 shadow-sm d-flex align-items-center gap-1"
              onClick={() => setShowConfirmModal(true)}
              disabled={isSubmitting || isPaused}
            >
              <i className="bi bi-box-arrow-right"></i>
              <span>Submit Exam</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN EXAM ARENA: Two Column Grid */}
      <div className="container-fluid flex-grow-1 py-3 px-3 px-md-4">
        <div className="row g-3 h-100">
          {/* LEFT / CENTER: Question Statement & Options */}
          <div className="col-12 col-lg-8 col-xl-9 d-flex flex-column">
            <div className="card-custom bg-white p-4 flex-grow-1 d-flex flex-column shadow-sm">
              {/* Question Header */}
              <div className="d-flex justify-content-between align-items-center pb-3 mb-3 border-bottom">
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-primary fs-6 px-3 py-1">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <span className="badge bg-light text-secondary border small">
                    Marks: +{currentQ.marks || exam?.marks_per_question} / -{currentQ.negative_marks || exam?.negative_marking}
                  </span>
                  <span className="badge bg-light text-secondary border small">
                    Topic: {currentQ.topic || 'General'}
                  </span>
                </div>

                {isCurrentMarkedForReview && (
                  <span className="badge bg-warning text-dark d-flex align-items-center gap-1">
                    <i className="bi bi-bookmark-star-fill"></i> Marked for Review
                  </span>
                )}
              </div>

              {/* Question Text */}
              <div className="mb-4">
                <h5 className="fw-semibold text-dark lh-base" style={{ fontSize: '1.15rem' }}>
                  {currentQ.question_text}
                </h5>
              </div>

              {/* 4 Interactive Option Cards */}
              <div className="vstack gap-3 mb-4">
                {currentQ.options?.map((opt) => {
                  const isSelected = currentSelectedKey === opt.option_key;

                  return (
                    <div
                      key={opt.option_key}
                      className={`p-3 rounded-3 border transition cursor-pointer d-flex align-items-center gap-3 ${
                        isSelected
                          ? 'border-primary bg-primary-subtle bg-opacity-25 shadow-sm'
                          : 'bg-white hover-bg-light'
                      }`}
                      onClick={() => handleSelectOption(opt.option_key)}
                      style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                    >
                      <div
                        className={`rounded-circle d-flex align-items-center justify-content-center fw-bold ${
                          isSelected ? 'bg-primary text-white' : 'bg-light text-secondary border'
                        }`}
                        style={{ width: '36px', height: '36px', flexShrink: 0 }}
                      >
                        {opt.option_key}
                      </div>

                      <div className="flex-grow-1 text-dark fw-medium" style={{ fontSize: '0.96rem' }}>
                        {opt.option_text}
                      </div>

                      <div className="form-check me-2">
                        <input
                          className="form-check-input"
                          type="radio"
                          name={`optionRadio_${currentQ.id}`}
                          id={`optRadio_${opt.option_key}`}
                          checked={isSelected}
                          onChange={() => handleSelectOption(opt.option_key)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Clear Answer Button */}
              {currentSelectedKey && (
                <div className="mb-4">
                  <button className="btn btn-link text-danger btn-sm p-0 text-decoration-none" onClick={handleClearOption}>
                    <i className="bi bi-x-circle me-1"></i> Clear Selection
                  </button>
                </div>
              )}

              {/* Navigation Footer Controls */}
              <div className="mt-auto pt-3 border-top d-flex justify-content-between align-items-center">
                <button
                  className="btn btn-outline-secondary px-3 d-flex align-items-center gap-1"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex(currentIndex - 1)}
                >
                  <i className="bi bi-chevron-left"></i> Previous
                </button>

                <button
                  className={`btn ${
                    isCurrentMarkedForReview ? 'btn-warning text-dark fw-bold' : 'btn-outline-warning text-dark'
                  } d-flex align-items-center gap-1`}
                  onClick={handleToggleReview}
                >
                  <i className={`bi ${isCurrentMarkedForReview ? 'bi-bookmark-check-fill' : 'bi-bookmark'}`}></i>
                  <span>{isCurrentMarkedForReview ? 'Marked for Review' : 'Mark for Review'}</span>
                </button>

                <button
                  className="btn btn-primary px-4 fw-semibold d-flex align-items-center gap-1"
                  disabled={currentIndex === questions.length - 1}
                  onClick={() => setCurrentIndex(currentIndex + 1)}
                >
                  <span>Next</span>
                  <i className="bi bi-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR: AI Proctor Camera & 2D Question Navigation Palette */}
          <div className="col-12 col-lg-4 col-xl-3 d-flex flex-column gap-3">
            {/* LIVE AI PROCTOR CAMERA FEED */}
            <div className="card border-0 shadow-sm overflow-hidden bg-white">
              <div className="card-header bg-dark text-white py-1 px-3 d-flex justify-content-between align-items-center">
                <span className="small fw-bold d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                  <i className="bi bi-camera-video-fill text-danger"></i> AI Proctor Surveillance
                </span>
                <span className={`badge rounded-pill ${cameraActive ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: '0.65rem' }}>
                  {cameraActive ? 'Active' : 'Standby'}
                </span>
              </div>
              <div className="position-relative bg-black text-center" style={{ minHeight: '120px' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-100"
                  style={{ height: '120px', objectFit: 'cover', display: cameraActive ? 'block' : 'none' }}
                />
                {!cameraActive && (
                  <div className="d-flex flex-column align-items-center justify-content-center p-3 text-secondary" style={{ height: '120px' }}>
                    <i className="bi bi-shield-lock-fill fs-3 mb-1 text-primary opacity-50"></i>
                    <span style={{ fontSize: '0.72rem' }}>AI Surveillance Guard Active</span>
                  </div>
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>
              {proctorAlert && (
                <div className="p-2 bg-danger-subtle text-danger border-top small d-flex align-items-center justify-content-between" style={{ fontSize: '0.72rem' }}>
                  <div>
                    <i className="bi bi-exclamation-triangle-fill me-1"></i> {proctorAlert}
                  </div>
                  <button
                    type="button"
                    className="btn-close btn-close-sm"
                    style={{ fontSize: '0.55rem' }}
                    onClick={() => setProctorAlert(null)}
                  ></button>
                </div>
              )}
            </div>

            <div className="card-custom bg-white p-3 flex-grow-1 d-flex flex-column shadow-sm">
              <h6 className="fw-bold text-dark mb-3 pb-2 border-bottom">
                <i className="bi bi-grid-3x3-gap-fill text-primary me-2"></i> Question Palette
              </h6>

              {/* Legend */}
              <div className="row g-2 mb-3 pb-2 border-bottom text-muted" style={{ fontSize: '0.75rem' }}>
                <div className="col-6 d-flex align-items-center gap-1">
                  <span className="badge bg-success rounded-circle p-1"> </span>
                  <span>Answered ({answeredCount})</span>
                </div>
                <div className="col-6 d-flex align-items-center gap-1">
                  <span className="badge bg-warning text-dark rounded-circle p-1"> </span>
                  <span>Review ({markedForReviewCount})</span>
                </div>
                <div className="col-6 d-flex align-items-center gap-1">
                  <span className="badge bg-light text-dark border rounded-circle p-1"> </span>
                  <span>Unanswered ({unansweredCount})</span>
                </div>
                <div className="col-6 d-flex align-items-center gap-1">
                  <span className="badge bg-primary rounded-circle p-1"> </span>
                  <span>Current Question</span>
                </div>
              </div>

              {/* 2D Interactive Buttons Grid */}
              <div className="flex-grow-1 overflow-auto" style={{ maxHeight: '380px' }}>
                <div className="row g-2">
                  {questions.map((q, idx) => {
                    const isAnswered = !!answers[q.id]?.selected_option_key;
                    const isReviewed = !!answers[q.id]?.is_marked_for_review;
                    const isCurrent = idx === currentIndex;

                    let btnClass = 'btn-light text-dark border';
                    if (isReviewed) {
                      btnClass = 'btn-warning text-dark fw-bold border-warning';
                    } else if (isAnswered) {
                      btnClass = 'btn-success text-white border-success';
                    }

                    return (
                      <div key={q.id} className="col-3">
                        <button
                          type="button"
                          className={`btn w-100 p-2 fw-bold position-relative ${btnClass} ${
                            isCurrent ? 'ring-primary border-primary border-3 shadow-sm' : ''
                          }`}
                          style={{
                            fontSize: '0.86rem',
                            outline: isCurrent ? '2px solid #2563eb' : 'none',
                            outlineOffset: '1px'
                          }}
                          onClick={() => setCurrentIndex(idx)}
                        >
                          {idx + 1}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary Counter & Submit Button */}
              <div className="mt-3 pt-2 border-top">
                <button
                  className="btn btn-danger w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isSubmitting || isPaused}
                >
                  <i className="bi bi-check2-circle fs-5"></i>
                  <span>Submit Final Examination</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONFIRMATION SUBMISSION MODAL */}
      {showConfirmModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-bottom py-3">
                <h5 className="modal-title fw-bold text-dark">Confirm Final Submission</h5>
                <button type="button" className="btn-close" onClick={() => setShowConfirmModal(false)}></button>
              </div>

              <div className="modal-body p-4 text-center">
                <i className="bi bi-question-circle-fill text-warning display-4 d-block mb-3"></i>
                <h5 className="fw-bold text-dark mb-2">Ready to submit your examination?</h5>
                <p className="text-muted small mb-4">
                  Once submitted, your responses will be evaluated by the server. You cannot modify answers after final submission.
                </p>

                {/* Response Breakdown Summary */}
                <div className="row g-2 p-3 bg-light rounded-3 text-center small border mb-3">
                  <div className="col-4 border-end">
                    <span className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Total MCQs</span>
                    <strong className="fs-6 text-dark">{questions.length}</strong>
                  </div>
                  <div className="col-4 border-end">
                    <span className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Attempted</span>
                    <strong className="fs-6 text-success">{answeredCount}</strong>
                  </div>
                  <div className="col-4">
                    <span className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Unattempted</span>
                    <strong className="fs-6 text-danger">{unansweredCount}</strong>
                  </div>
                </div>

                {markedForReviewCount > 0 && (
                  <div className="alert alert-warning py-2 px-3 small rounded-3 mb-0">
                    <i className="bi bi-exclamation-circle-fill me-1"></i>
                    You have <strong>{markedForReviewCount}</strong> question(s) marked for review.
                  </div>
                )}
              </div>

              <div className="modal-footer border-top py-2 d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm px-3"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                >
                  Return to Exam
                </button>

                <button
                  type="button"
                  className="btn btn-danger btn-sm px-4 fw-bold d-flex align-items-center gap-2"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check2-circle"></i>
                      <span>Yes, Submit Exam</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIRECT CANDIDATE PROCTOR WARNING MODAL */}
      {directWarning && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', zIndex: 2050 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div
                className={`modal-header border-bottom py-3 ${
                  directWarning.severity === 'final_warning'
                    ? 'bg-danger text-white'
                    : directWarning.severity === 'warning'
                    ? 'bg-warning text-dark'
                    : 'bg-primary text-white'
                }`}
              >
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-exclamation-octagon-fill"></i>
                  Proctor Command Intercom Alert
                </h5>
              </div>
              <div className="modal-body p-4 text-center">
                <span
                  className={`badge mb-3 text-uppercase font-monospace px-3 py-1 ${
                    directWarning.severity === 'final_warning'
                      ? 'bg-danger text-white'
                      : directWarning.severity === 'warning'
                      ? 'bg-warning text-dark'
                      : 'bg-info text-dark'
                  }`}
                >
                  Severity: {directWarning.severity.replace('_', ' ')}
                </span>
                <div className="p-3 bg-light rounded-3 mb-3 border text-start">
                  <div className="text-muted small mb-1">
                    From: <strong>{directWarning.proctorName}</strong> at{' '}
                    {new Date(directWarning.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="fs-6 fw-bold text-dark">
                    "{directWarning.message}"
                  </div>
                </div>
                <p className="text-muted small mb-0">
                  Please strictly adhere to proctor instructions. Repeated infractions may result in immediate session termination.
                </p>
              </div>
              <div className="modal-footer border-top py-2">
                <button
                  type="button"
                  className="btn btn-dark btn-sm w-100 fw-bold py-2 shadow-sm"
                  onClick={() => setDirectWarning(null)}
                >
                  I Acknowledge & Understand
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN PROCTOR SESSION PAUSE OVERLAY */}
      {isPaused && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center text-white"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            zIndex: 2000,
            backdropFilter: 'blur(10px)'
          }}
        >
          <div
            className="card bg-dark border border-warning shadow-lg rounded-4 p-5 text-center"
            style={{ maxWidth: '580px' }}
          >
            <div
              className="rounded-circle bg-warning text-dark d-inline-flex align-items-center justify-content-center mx-auto mb-4 shadow"
              style={{ width: '90px', height: '90px', fontSize: '3rem' }}
            >
              <i className="bi bi-pause-fill"></i>
            </div>
            <h3 className="fw-bold text-white mb-2">Examination Session Paused</h3>
            <div className="badge bg-warning text-dark fs-6 px-3 py-2 mb-3">
              Administrative Proctor Hold Active
            </div>
            <p className="text-light mb-4 lh-base" style={{ fontSize: '1rem' }}>
              {pauseReason ||
                'Your examination session has been temporarily paused by the proctor for administrative verification.'}
            </p>
            <div className="alert alert-info py-2 px-3 small rounded-3 text-start mb-0 border-0 bg-opacity-25">
              <i className="bi bi-shield-check me-2 text-info"></i>
              <strong>Zero-Loss Compensatory Guarantee:</strong> Your exam timer is completely frozen. The exact seconds paused will be added to your countdown when the proctor resumes your session. Do not close or refresh this tab.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamHall;
