const { Op } = require('sequelize');
const {
  Exam,
  ExamAttempt,
  ExamAssignment,
  StudentAnswer,
  Student,
  User,
  Subject,
  Class,
  AuditLog,
  sequelize
} = require('../models');
const { evaluateAndFinalizeAttempt } = require('../services/examEvaluationService');
const { recordAuditLog } = require('../middleware/auditLogger');
const logger = require('../utils/logger');

/**
 * Get Real-Time Live Monitoring & Proctoring Status for an Exam
 */
const getLiveExamStatus = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const { examId } = req.params;

    const exam = await Exam.findOne({
      where: { id: examId, institution_id: institutionId },
      include: [
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] },
        { model: Class, as: 'class', attributes: ['id', 'name'] }
      ]
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Examination not found.' });
    }

    const now = new Date();

    // 1. Fetch all assigned candidates
    const assignments = await ExamAssignment.findAll({
      where: { exam_id: examId },
      include: [
        {
          model: Student,
          as: 'student',
          include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'avatar'] }]
        }
      ]
    });

    // 2. Fetch all attempts for this exam
    const attempts = await ExamAttempt.findAll({
      where: { exam_id: examId },
      include: [
        {
          model: Student,
          as: 'student',
          include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }]
        },
        {
          model: StudentAnswer,
          as: 'answers',
          attributes: ['question_id', 'selected_option_key', 'is_marked_for_review', 'answered_at']
        }
      ],
      order: [['start_time', 'DESC']]
    });

    // 3. Process Live Candidate Cards
    const activeCandidates = [];
    let submittedCount = 0;
    let autoSubmittedCount = 0;

    for (const att of attempts) {
      if (att.status === 'submitted') {
        submittedCount++;
      } else if (att.status === 'auto_submitted') {
        autoSubmittedCount++;
      } else if (att.status === 'in_progress') {
        const remainingSeconds = Math.max(0, Math.floor((new Date(att.server_expiry_time) - now) / 1000));
        const answeredCount = att.answers.filter(a => a.selected_option_key !== null).length;
        const reviewCount = att.answers.filter(a => a.is_marked_for_review).length;

        // Anomaly / Alert heuristics
        const isExpiringSoon = remainingSeconds <= 300 && remainingSeconds > 0;
        const isExpired = remainingSeconds === 0;

        // Check last answer activity
        const lastAnswer = att.answers.length > 0
          ? att.answers.reduce((latest, a) => (new Date(a.answered_at) > new Date(latest.answered_at) ? a : latest))
          : null;

        activeCandidates.push({
          attemptId: att.id,
          studentId: att.student?.student_id,
          studentName: att.student?.user?.name,
          studentEmail: att.student?.user?.email,
          startTime: att.start_time,
          serverExpiryTime: att.server_expiry_time,
          remainingSeconds,
          answeredQuestions: answeredCount,
          totalQuestions: exam.total_questions,
          markedForReview: reviewCount,
          ipAddress: att.ip_address,
          userAgent: att.user_agent,
          lastActivityAt: lastAnswer ? lastAnswer.answered_at : att.start_time,
          status: isExpired ? 'expired_pending_sweep' : (att.is_paused ? 'paused' : 'active'),
          isPaused: !!att.is_paused,
          pausedAt: att.paused_at,
          totalPausedSeconds: att.total_paused_seconds || 0,
          interventionsCount: att.proctor_interventions_count || 0,
          alertFlag: att.is_paused ? 'PAUSED' : (isExpiringSoon ? 'CRITICAL_TIME' : isExpired ? 'TIME_EXPIRED' : 'NORMAL')
        });
      }
    }

    const assignedCount = assignments.length;
    const notStartedCount = Math.max(0, assignedCount - (activeCandidates.length + submittedCount + autoSubmittedCount));

    // 4. Fetch recent live telemetry audit events for this exam
    const recentEvents = await AuditLog.findAll({
      where: {
        entity_type: 'ExamAttempt',
        created_at: { [Op.gte]: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
      },
      include: [{ model: User, as: 'user', attributes: ['name', 'email'] }],
      order: [['created_at', 'DESC']],
      limit: 15
    });

    return res.status(200).json({
      success: true,
      exam: {
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        class: exam.class,
        durationMinutes: exam.duration_minutes,
        totalQuestions: exam.total_questions,
        totalMarks: exam.total_marks,
        status: exam.status
      },
      counters: {
        assigned: assignedCount,
        activeInProgress: activeCandidates.length,
        submitted: submittedCount,
        autoSubmitted: autoSubmittedCount,
        notStarted: notStartedCount
      },
      activeCandidates,
      recentEvents: recentEvents.map(e => ({
        id: e.id,
        action: e.action,
        user: e.user?.name || 'Candidate',
        ip: e.ip_address,
        timestamp: e.created_at,
        details: e.details
      }))
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Proctor Intervention: Grant Individual Candidate Time Extension (+X minutes)
 */
const extendCandidateTime = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const institutionId = req.institutionId;
    const { attemptId } = req.params;
    const { minutes = 5, reason } = req.body;

    const extraMinutes = parseInt(minutes, 10);
    if (isNaN(extraMinutes) || extraMinutes <= 0 || extraMinutes > 180) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid extension minutes. Must be a positive number between 1 and 180.'
      });
    }

    const attempt = await ExamAttempt.findOne({
      where: { id: attemptId },
      include: [
        { model: Exam, as: 'exam' },
        { model: Student, as: 'student', include: [{ model: User, as: 'user' }] }
      ],
      transaction
    });

    if (!attempt) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Exam attempt not found.' });
    }

    if (institutionId && attempt.exam && attempt.exam.institution_id !== institutionId) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized institution attempt.' });
    }

    if (attempt.status !== 'in_progress') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot extend time for an attempt with status "${attempt.status}".`
      });
    }

    // Add minutes to server_expiry_time
    const currentExpiry = new Date(attempt.server_expiry_time).getTime();
    const newExpiry = new Date(currentExpiry + extraMinutes * 60 * 1000);
    attempt.server_expiry_time = newExpiry;
    attempt.proctor_interventions_count = (attempt.proctor_interventions_count || 0) + 1;
    await attempt.save({ transaction });

    await transaction.commit();

    const remainingSeconds = Math.max(0, Math.floor((newExpiry - Date.now()) / 1000));

    // Real-time broadcast via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`exam_${attempt.exam_id}`).emit('exam_time_extended', {
        attemptId: attempt.id,
        studentId: attempt.student_id,
        studentName: attempt.student?.user?.name,
        extraMinutes,
        newServerExpiryTime: newExpiry.toISOString(),
        remainingSeconds,
        reason: reason || `Proctor granted an extra ${extraMinutes} minutes.`
      });
    }

    await recordAuditLog({
      req,
      action: 'PROCTOR_TIME_EXTENSION',
      entityType: 'ExamAttempt',
      entityId: attempt.id,
      details: {
        extraMinutes,
        newExpiry: newExpiry.toISOString(),
        reason
      }
    });

    return res.status(200).json({
      success: true,
      message: `Successfully extended candidate time by ${extraMinutes} minutes.`,
      newServerExpiryTime: newExpiry.toISOString(),
      remainingSeconds
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Proctor Intervention: Remote Pause Candidate Session
 */
const pauseCandidateAttempt = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const institutionId = req.institutionId;
    const { attemptId } = req.params;
    const { reason } = req.body;

    const attempt = await ExamAttempt.findOne({
      where: { id: attemptId },
      include: [
        { model: Exam, as: 'exam' },
        { model: Student, as: 'student', include: [{ model: User, as: 'user' }] }
      ],
      transaction
    });

    if (!attempt) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Exam attempt not found.' });
    }

    if (institutionId && attempt.exam && attempt.exam.institution_id !== institutionId) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized institution attempt.' });
    }

    if (attempt.status !== 'in_progress') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Only in-progress exam attempts can be paused.'
      });
    }

    if (attempt.is_paused) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Exam attempt is already paused.'
      });
    }

    const now = new Date();
    attempt.is_paused = true;
    attempt.paused_at = now;
    attempt.proctor_interventions_count = (attempt.proctor_interventions_count || 0) + 1;
    await attempt.save({ transaction });

    await transaction.commit();

    const io = req.app.get('io');
    if (io) {
      io.to(`exam_${attempt.exam_id}`).emit('exam_paused', {
        attemptId: attempt.id,
        studentId: attempt.student_id,
        studentName: attempt.student?.user?.name,
        pausedAt: now.toISOString(),
        reason: reason || 'Examination temporarily paused by the proctor for security or administrative review.'
      });
    }

    await recordAuditLog({
      req,
      action: 'PROCTOR_PAUSE_EXAM',
      entityType: 'ExamAttempt',
      entityId: attempt.id,
      details: { reason, pausedAt: now.toISOString() }
    });

    return res.status(200).json({
      success: true,
      message: 'Candidate examination session has been paused.',
      isPaused: true,
      pausedAt: now.toISOString()
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Proctor Intervention: Remote Resume Candidate Session
 */
const resumeCandidateAttempt = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const institutionId = req.institutionId;
    const { attemptId } = req.params;
    const { notes } = req.body;

    const attempt = await ExamAttempt.findOne({
      where: { id: attemptId },
      include: [
        { model: Exam, as: 'exam' },
        { model: Student, as: 'student', include: [{ model: User, as: 'user' }] }
      ],
      transaction
    });

    if (!attempt) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Exam attempt not found.' });
    }

    if (institutionId && attempt.exam && attempt.exam.institution_id !== institutionId) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized institution attempt.' });
    }

    if (!attempt.is_paused || !attempt.paused_at) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Exam attempt is not currently paused.'
      });
    }

    // Calculate exact pause elapsed duration and extend expiry time so student loses zero time
    const pauseStart = new Date(attempt.paused_at).getTime();
    const now = Date.now();
    const elapsedMs = Math.max(0, now - pauseStart);
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    const currentExpiry = new Date(attempt.server_expiry_time).getTime();
    const newExpiry = new Date(currentExpiry + elapsedMs);

    attempt.server_expiry_time = newExpiry;
    attempt.is_paused = false;
    attempt.paused_at = null;
    attempt.total_paused_seconds = (attempt.total_paused_seconds || 0) + elapsedSeconds;
    await attempt.save({ transaction });

    await transaction.commit();

    const remainingSeconds = Math.max(0, Math.floor((newExpiry - now) / 1000));

    const io = req.app.get('io');
    if (io) {
      io.to(`exam_${attempt.exam_id}`).emit('exam_resumed', {
        attemptId: attempt.id,
        studentId: attempt.student_id,
        studentName: attempt.student?.user?.name,
        newServerExpiryTime: newExpiry.toISOString(),
        remainingSeconds,
        elapsedPausedSeconds: elapsedSeconds,
        notes: notes || 'Examination session resumed. Compensatory time added.'
      });
    }

    await recordAuditLog({
      req,
      action: 'PROCTOR_RESUME_EXAM',
      entityType: 'ExamAttempt',
      entityId: attempt.id,
      details: {
        elapsedPausedSeconds: elapsedSeconds,
        newExpiry: newExpiry.toISOString()
      }
    });

    return res.status(200).json({
      success: true,
      message: `Candidate examination session resumed. ${elapsedSeconds}s compensatory time added.`,
      isPaused: false,
      newServerExpiryTime: newExpiry.toISOString(),
      remainingSeconds
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Proctor Intervention: Send Direct On-Screen Warning / Intercom Alert to Candidate
 */
const sendCandidateWarning = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const { attemptId } = req.params;
    const { message, severity = 'warning' } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Warning message content is required.'
      });
    }

    const attempt = await ExamAttempt.findOne({
      where: { id: attemptId },
      include: [
        { model: Exam, as: 'exam' },
        { model: Student, as: 'student', include: [{ model: User, as: 'user' }] }
      ]
    });

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Exam attempt not found.' });
    }

    if (institutionId && attempt.exam && attempt.exam.institution_id !== institutionId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized institution attempt.' });
    }

    attempt.proctor_interventions_count = (attempt.proctor_interventions_count || 0) + 1;
    await attempt.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`exam_${attempt.exam_id}`).emit('proctor_warning_alert', {
        attemptId: attempt.id,
        studentId: attempt.student_id,
        studentName: attempt.student?.user?.name,
        message: message.trim(),
        severity,
        proctorName: req.user?.name || 'Chief Proctor',
        timestamp: new Date().toISOString()
      });
    }

    await recordAuditLog({
      req,
      action: 'PROCTOR_WARNING_DISPATCHED',
      entityType: 'ExamAttempt',
      entityId: attempt.id,
      details: { message: message.trim(), severity }
    });

    return res.status(200).json({
      success: true,
      message: 'Direct proctor warning dispatched to candidate screen.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Proctor Intervention: Remote Force Submit Candidate Exam Attempt
 */
const forceSubmitAttempt = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const { attemptId } = req.params;
    const { reason = 'Proctor forced early submission due to conduct review' } = req.body;

    const attempt = await ExamAttempt.findOne({
      where: { id: attemptId },
      include: [
        { model: Exam, as: 'exam' },
        { model: Student, as: 'student', include: [{ model: User, as: 'user' }] }
      ]
    });

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Exam attempt not found.' });
    }

    if (institutionId && attempt.exam && attempt.exam.institution_id !== institutionId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Unauthorized institution attempt.' });
    }

    if (attempt.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: `Attempt cannot be force-submitted; current status is "${attempt.status}".`
      });
    }

    attempt.proctor_interventions_count = (attempt.proctor_interventions_count || 0) + 1;
    await attempt.save();

    // Finalize and evaluate attempt immediately
    const io = req.app.get('io');
    const evaluation = await evaluateAndFinalizeAttempt(attempt.id, 'auto', { req, io });

    if (io) {
      io.to(`exam_${attempt.exam_id}`).emit('exam_force_submitted', {
        attemptId: attempt.id,
        studentId: attempt.student_id,
        studentName: attempt.student?.user?.name,
        reason
      });
    }

    await recordAuditLog({
      req,
      action: 'PROCTOR_FORCE_SUBMISSION',
      entityType: 'ExamAttempt',
      entityId: attempt.id,
      details: { reason }
    });

    return res.status(200).json({
      success: true,
      message: 'Exam attempt was forcefully finalized and evaluated.',
      summary: evaluation.summary
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cohort Broadcast: Send Public Announcement to all Active Candidates in Exam Hall
 */
const broadcastExamAnnouncement = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const { examId } = req.params;
    const { message, priority = 'normal' } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Announcement message is required.'
      });
    }

    const exam = await Exam.findOne({
      where: { id: examId, institution_id: institutionId }
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Examination not found.' });
    }

    const now = new Date();
    const senderName = req.user?.name || 'Chief Proctor';

    const io = req.app.get('io');
    if (io) {
      io.to(`exam_${examId}`).emit('cohort_announcement', {
        examId: parseInt(examId, 10),
        message: message.trim(),
        priority,
        sender: senderName,
        timestamp: now.toISOString()
      });
    }

    await recordAuditLog({
      req,
      action: 'PROCTOR_COHORT_BROADCAST',
      entityType: 'Exam',
      entityId: exam.id,
      details: { message: message.trim(), priority, sender: senderName }
    });

    return res.status(200).json({
      success: true,
      message: 'Announcement successfully broadcast to all candidates in the exam hall.',
      timestamp: now.toISOString()
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLiveExamStatus,
  extendCandidateTime,
  pauseCandidateAttempt,
  resumeCandidateAttempt,
  sendCandidateWarning,
  forceSubmitAttempt,
  broadcastExamAnnouncement
};
