const { Op } = require('sequelize');
const {
  ProctorSnapshot,
  ExamAttempt,
  Exam,
  Student,
  User,
  ExamResult,
  sequelize
} = require('../models');
const { recordAuditLog } = require('../middleware/auditLogger');
const logger = require('../utils/logger');

// Anomaly Penalty Deduction Rules (Deducted from 100 max integrity score)
const ANOMALY_PENALTIES = {
  MULTIPLE_FACES: 25,
  NO_FACE: 15,
  CELLPHONE_DETECTED: 30,
  TAB_SWITCH: 10,
  LOOKING_AWAY: 5,
  SUSPICIOUS_AUDIO: 10,
  NONE: 0
};

/**
 * Upload Webcam Proctoring Snapshot (Client Candidate Stream)
 */
const uploadSnapshot = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const institutionId = req.institutionId;
    const {
      exam_attempt_id,
      snapshot_url,
      snapshot_type = 'periodic',
      anomaly_detected = false,
      anomaly_type = 'NONE',
      confidence_score = 1.0
    } = req.body;

    if (!exam_attempt_id || !snapshot_url) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Exam attempt ID and snapshot URL are required.'
      });
    }

    const attempt = await ExamAttempt.findOne({
      where: { id: exam_attempt_id },
      include: [
        { model: Exam, as: 'exam' },
        {
          model: Student,
          as: 'student',
          include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }]
        }
      ],
      transaction
    });

    if (!attempt) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Exam attempt not found.' });
    }

    const isAnomaly = Boolean(anomaly_detected && anomaly_type !== 'NONE');
    const penalty = isAnomaly ? (ANOMALY_PENALTIES[anomaly_type] || 10) : 0;

    // Deduct integrity score if anomaly detected
    const currentScore = attempt.integrity_score !== undefined && attempt.integrity_score !== null
      ? attempt.integrity_score
      : 100;
    const newIntegrityScore = Math.max(0, currentScore - penalty);

    attempt.integrity_score = newIntegrityScore;

    // Automatically flag as suspicious if integrity score drops below 70
    if (newIntegrityScore < 70 && attempt.proctor_verdict === 'pending') {
      attempt.proctor_verdict = 'suspicious_flagged';
    }

    await attempt.save({ transaction });

    // Persist snapshot record
    const snapshot = await ProctorSnapshot.create({
      institution_id: institutionId || attempt.exam?.institution_id || 1,
      exam_attempt_id: attempt.id,
      student_id: attempt.student_id,
      snapshot_url,
      snapshot_type,
      anomaly_detected: isAnomaly,
      anomaly_type: isAnomaly ? anomaly_type : 'NONE',
      confidence_score: parseFloat(confidence_score) || 1.0,
      captured_at: new Date()
    }, { transaction });

    await transaction.commit();

    // Broadcast live proctoring event via Socket.IO
    const io = req.app.get('io');
    if (io) {
      const room = `exam_${attempt.exam_id}`;
      io.to(room).emit('proctor_snapshot_stream', {
        attemptId: attempt.id,
        studentId: attempt.student_id,
        studentName: attempt.student?.user?.name || 'Candidate',
        snapshotId: snapshot.id,
        snapshotUrl: snapshot.snapshot_url,
        snapshotType: snapshot.snapshot_type,
        anomalyDetected: isAnomaly,
        anomalyType: snapshot.anomaly_type,
        integrityScore: newIntegrityScore,
        capturedAt: snapshot.captured_at
      });

      if (isAnomaly) {
        io.to(room).emit('telemetry_anomaly', {
          type: snapshot.anomaly_type,
          studentId: attempt.student_id,
          studentName: attempt.student?.user?.name || 'Candidate',
          timestamp: snapshot.captured_at,
          message: `Proctor Alert: Anomaly detected [${snapshot.anomaly_type}] for candidate ${attempt.student?.user?.name || ''}. Trust Score: ${newIntegrityScore}/100.`
        });
      }
    }

    if (isAnomaly && req.user) {
      await recordAuditLog({
        req,
        action: 'PROCTOR_ANOMALY_RECORDED',
        entity_type: 'ProctorSnapshot',
        entity_id: snapshot.id,
        details: {
          exam_id: attempt.exam_id,
          student_id: attempt.student_id,
          anomaly_type,
          deducted_penalty: penalty,
          remaining_integrity: newIntegrityScore
        }
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        snapshotId: snapshot.id,
        integrityScore: newIntegrityScore,
        anomalyDetected: isAnomaly,
        anomalyType: snapshot.anomaly_type,
        proctorVerdict: attempt.proctor_verdict
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Retrieve Full Candidate Proctoring Evidence & Timeline
 */
const getAttemptEvidence = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const { attemptId } = req.params;

    const attempt = await ExamAttempt.findOne({
      where: { id: attemptId },
      include: [
        {
          model: Exam,
          as: 'exam',
          attributes: ['id', 'institution_id', 'title', 'duration_minutes', 'total_marks', 'passing_percentage']
        },
        {
          model: Student,
          as: 'student',
          include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'avatar'] }]
        },
        {
          model: ProctorSnapshot,
          as: 'snapshots'
        }
      ],
      order: [[{ model: ProctorSnapshot, as: 'snapshots' }, 'captured_at', 'ASC']]
    });

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Exam attempt not found.' });
    }

    // Tenant Check
    if (institutionId && attempt.exam && attempt.exam.institution_id !== institutionId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Access to another institution is restricted.' });
    }

    // Anomaly breakdown
    const snapshots = attempt.snapshots || [];
    const totalSnapshots = snapshots.length;
    const anomalies = snapshots.filter(s => s.anomaly_detected);
    const anomalyCounts = {
      MULTIPLE_FACES: 0,
      NO_FACE: 0,
      CELLPHONE_DETECTED: 0,
      TAB_SWITCH: 0,
      LOOKING_AWAY: 0,
      SUSPICIOUS_AUDIO: 0
    };

    anomalies.forEach(a => {
      if (anomalyCounts[a.anomaly_type] !== undefined) {
        anomalyCounts[a.anomaly_type]++;
      }
    });

    // Attempt Result
    const result = await ExamResult.findOne({ where: { exam_attempt_id: attempt.id } });

    return res.status(200).json({
      success: true,
      data: {
        attempt: {
          id: attempt.id,
          status: attempt.status,
          startTime: attempt.start_time,
          endTime: attempt.end_time,
          ipAddress: attempt.ip_address,
          userAgent: attempt.user_agent,
          integrityScore: attempt.integrity_score !== undefined ? attempt.integrity_score : 100,
          proctorVerdict: attempt.proctor_verdict || 'pending',
          proctorNotes: attempt.proctor_notes,
          proctorReviewedAt: attempt.proctor_reviewed_at
        },
        exam: attempt.exam,
        candidate: {
          id: attempt.student?.id,
          studentId: attempt.student?.student_id,
          rollNo: attempt.student?.roll_no,
          name: attempt.student?.user?.name,
          email: attempt.student?.user?.email,
          avatar: attempt.student?.user?.avatar
        },
        result: result ? {
          totalMarksObtained: result.total_marks_obtained,
          percentage: result.percentage,
          isPassed: result.is_passed,
          rank: result.rank
        } : null,
        metrics: {
          totalSnapshots,
          anomalyCount: anomalies.length,
          cleanCount: totalSnapshots - anomalies.length,
          anomalyCounts
        },
        snapshots: snapshots.map(s => ({
          id: s.id,
          url: s.snapshot_url,
          type: s.snapshot_type,
          anomalyDetected: s.anomaly_detected,
          anomalyType: s.anomaly_type,
          confidence: s.confidence_score,
          capturedAt: s.captured_at
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit Official Proctor Verdict (Approved, Flagged, Disqualified)
 */
const submitProctorVerdict = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const institutionId = req.institutionId;
    const { attemptId } = req.params;
    const { verdict, notes } = req.body;

    const validVerdicts = ['verified_clean', 'suspicious_flagged', 'disqualified'];
    if (!validVerdicts.includes(verdict)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Invalid verdict. Must be one of: ${validVerdicts.join(', ')}`
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

    const now = new Date();
    attempt.proctor_verdict = verdict;
    attempt.proctor_notes = notes || null;
    attempt.proctor_reviewed_by = req.user?.id || null;
    attempt.proctor_reviewed_at = now;

    // If verdict is disqualified, set status to disqualified and update ExamResult
    if (verdict === 'disqualified') {
      attempt.status = 'disqualified';
      const result = await ExamResult.findOne({ where: { exam_attempt_id: attempt.id }, transaction });
      if (result) {
        result.is_passed = false;
        result.total_marks_obtained = 0;
        result.percentage = 0;
        await result.save({ transaction });
      }
    }

    await attempt.save({ transaction });
    await transaction.commit();

    // Broadcast verdict via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`exam_${attempt.exam_id}`).emit('proctor_verdict_announced', {
        attemptId: attempt.id,
        studentId: attempt.student_id,
        studentName: attempt.student?.user?.name,
        verdict,
        reviewedAt: now.toISOString()
      });
    }

    await recordAuditLog({
      req,
      action: 'PROCTOR_VERDICT_SUBMITTED',
      entity_type: 'ExamAttempt',
      entity_id: attempt.id,
      details: {
        exam_id: attempt.exam_id,
        student_id: attempt.student_id,
        verdict,
        notes: notes ? notes.slice(0, 200) : ''
      }
    });

    return res.status(200).json({
      success: true,
      message: `Proctor verdict successfully recorded: [${verdict.toUpperCase()}].`,
      data: {
        attemptId: attempt.id,
        verdict: attempt.proctor_verdict,
        notes: attempt.proctor_notes,
        reviewedAt: attempt.proctor_reviewed_at
      }
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Cohort-Wide Proctoring Integrity Overview for an Exam
 */
const getExamIntegrityOverview = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const { examId } = req.params;

    const exam = await Exam.findOne({
      where: { id: examId, institution_id: institutionId }
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Examination not found.' });
    }

    const attempts = await ExamAttempt.findAll({
      where: { exam_id: examId },
      include: [
        {
          model: Student,
          as: 'student',
          include: [{ model: User, as: 'user', attributes: ['name', 'email'] }]
        },
        {
          model: ProctorSnapshot,
          as: 'snapshots',
          attributes: ['id', 'anomaly_detected', 'anomaly_type']
        }
      ],
      order: [['integrity_score', 'ASC']]
    });

    const totalMonitored = attempts.length;
    let totalScoreSum = 0;
    let pendingCount = 0;
    let cleanCount = 0;
    let flaggedCount = 0;
    let disqualifiedCount = 0;

    const candidatesList = [];

    for (const att of attempts) {
      const score = att.integrity_score !== undefined && att.integrity_score !== null ? att.integrity_score : 100;
      totalScoreSum += score;

      const verdict = att.proctor_verdict || 'pending';
      if (verdict === 'pending') pendingCount++;
      else if (verdict === 'verified_clean') cleanCount++;
      else if (verdict === 'suspicious_flagged') flaggedCount++;
      else if (verdict === 'disqualified') disqualifiedCount++;

      const anomalies = (att.snapshots || []).filter(s => s.anomaly_detected);

      candidatesList.push({
        attemptId: att.id,
        studentId: att.student?.student_id,
        rollNo: att.student?.roll_no,
        name: att.student?.user?.name,
        email: att.student?.user?.email,
        integrityScore: score,
        verdict,
        status: att.status,
        totalSnapshots: (att.snapshots || []).length,
        anomaliesCount: anomalies.length
      });
    }

    const avgScore = totalMonitored > 0 ? parseFloat((totalScoreSum / totalMonitored).toFixed(1)) : 100;

    return res.status(200).json({
      success: true,
      exam: {
        id: exam.id,
        title: exam.title,
        status: exam.status
      },
      overview: {
        totalMonitored,
        averageIntegrityScore: avgScore,
        verdicts: {
          pending: pendingCount,
          clean: cleanCount,
          flagged: flaggedCount,
          disqualified: disqualifiedCount
        }
      },
      candidates: candidatesList
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadSnapshot,
  getAttemptEvidence,
  submitProctorVerdict,
  getExamIntegrityOverview
};
