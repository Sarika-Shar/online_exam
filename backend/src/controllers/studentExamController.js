const { Op } = require('sequelize');
const {
  sequelize,
  Exam,
  ExamAssignment,
  ExamAttempt,
  ExamQuestion,
  StudentAnswer,
  ExamResult,
  Question,
  QuestionOption,
  Subject,
  Class,
  Batch,
  Student,
  User
} = require('../models');
const { evaluateAndFinalizeAttempt } = require('../services/examEvaluationService');
const logger = require('../utils/logger');

/**
 * Get student profile and assigned exams
 */
const getStudentExams = async (req, res, next) => {
  try {
    const studentUser = req.user;

    // Find Student profile
    const student = await Student.findOne({
      where: { user_id: studentUser.id },
      include: [
        { model: Class, as: 'class', attributes: ['id', 'name', 'code'] },
        { model: Batch, as: 'batch', attributes: ['id', 'name'] }
      ]
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student academic profile not found for this user.'
      });
    }

    // Find all exam assignments
    const assignments = await ExamAssignment.findAll({
      where: { student_id: student.id },
      include: [
        {
          model: Exam,
          as: 'exam',
          include: [
            { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] },
            { model: Class, as: 'class', attributes: ['id', 'name'] }
          ]
        }
      ],
      order: [[{ model: Exam, as: 'exam' }, 'start_time', 'ASC']]
    });

    // Check attempts for these exams
    const attempts = await ExamAttempt.findAll({
      where: {
        student_id: student.id,
        exam_id: { [Op.in]: assignments.map(a => a.exam_id) }
      }
    });

    const attemptMap = new Map();
    attempts.forEach(att => {
      attemptMap.set(att.exam_id, att);
    });

    const now = new Date();
    const formattedExams = assignments.map(a => {
      const exam = a.exam;
      const attempt = attemptMap.get(exam.id);

      let studentStatus = 'upcoming'; // upcoming, available, in_progress, completed, expired

      if (attempt) {
        if (attempt.status === 'submitted' || attempt.status === 'auto_submitted') {
          studentStatus = 'completed';
        } else if (attempt.status === 'in_progress') {
          const isExpired = new Date(attempt.server_expiry_time) < now;
          studentStatus = isExpired ? 'completed' : 'in_progress';
        }
      } else {
        const isStarted = new Date(exam.start_time) <= now || exam.status === 'active';
        const isEnded = new Date(exam.end_time) < now && exam.status !== 'active';

        if (isEnded || exam.status === 'completed') {
          studentStatus = 'expired';
        } else if (isStarted) {
          studentStatus = 'available';
        } else {
          studentStatus = 'upcoming';
        }
      }

      return {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        instructions: exam.instructions,
        subject: exam.subject,
        class: exam.class,
        exam_date: exam.exam_date,
        start_time: exam.start_time,
        end_time: exam.end_time,
        duration_minutes: exam.duration_minutes,
        total_questions: exam.total_questions,
        total_marks: exam.total_marks,
        marks_per_question: exam.marks_per_question,
        negative_marking: exam.negative_marking,
        passing_percentage: exam.passing_percentage,
        selection_mode: exam.selection_mode,
        exam_status: exam.status,
        student_status: studentStatus,
        attempt: attempt ? {
          id: attempt.id,
          status: attempt.status,
          start_time: attempt.start_time,
          server_expiry_time: attempt.server_expiry_time,
          remaining_seconds: Math.max(0, Math.floor((new Date(attempt.server_expiry_time) - now) / 1000))
        } : null
      };
    });

    return res.status(200).json({
      success: true,
      student: {
        id: student.id,
        student_id: student.student_id,
        name: studentUser.name,
        email: studentUser.email,
        class: student.class?.name,
        batch: student.batch?.name,
        roll_no: student.roll_no
      },
      exams: formattedExams
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get exam instructions before candidate enters
 */
const getExamInstructions = async (req, res, next) => {
  try {
    const studentUser = req.user;
    const { id } = req.params;

    const student = await Student.findOne({ where: { user_id: studentUser.id } });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const assignment = await ExamAssignment.findOne({
      where: { exam_id: id, student_id: student.id }
    });

    if (!assignment) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to take this examination.'
      });
    }

    const exam = await Exam.findByPk(id, {
      include: [
        { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] },
        { model: Class, as: 'class', attributes: ['id', 'name'] }
      ]
    });

    const existingAttempt = await ExamAttempt.findOne({
      where: { exam_id: id, student_id: student.id }
    });

    return res.status(200).json({
      success: true,
      data: {
        exam,
        student: {
          name: studentUser.name,
          student_id: student.student_id,
          roll_no: student.roll_no
        },
        hasAttempt: !!existingAttempt,
        attemptStatus: existingAttempt ? existingAttempt.status : null
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Start Examination / Retrieve Active Attempt (Section 8 & 14)
 * Securely hides correct answers!
 */
const startOrResumeExam = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const studentUser = req.user;
    const { id } = req.params;

    const student = await Student.findOne({
      where: { user_id: studentUser.id },
      transaction
    });

    if (!student) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const assignment = await ExamAssignment.findOne({
      where: { exam_id: id, student_id: student.id },
      transaction
    });

    if (!assignment) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Access Denied: You are not assigned to take this examination.'
      });
    }

    const exam = await Exam.findByPk(id, { transaction });
    if (!exam) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Examination not found.' });
    }

    const now = new Date();

    // Check for existing attempt
    let attempt = await ExamAttempt.findOne({
      where: { exam_id: id, student_id: student.id },
      transaction
    });

    if (attempt) {
      if (attempt.status === 'submitted' || attempt.status === 'auto_submitted') {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          isSubmitted: true,
          message: 'You have already submitted this examination. Re-entry is not permitted.'
        });
      }

      // Check if server timer expired
      if (new Date(attempt.server_expiry_time) < now) {
        await transaction.rollback();
        const io = req.app.get('io');
        const evalResult = await evaluateAndFinalizeAttempt(attempt.id, 'auto', { req, io });

        return res.status(400).json({
          success: false,
          isExpired: true,
          message: 'The examination timer has expired. Your attempt has been automatically submitted.',
          summary: evalResult.summary
        });
      }
    } else {
      // Create New Attempt with strict server expiry
      const expiry = new Date(now.getTime() + (exam.duration_minutes * 60 * 1000));
      const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
      const userAgent = req.headers['user-agent'] || '';

      attempt = await ExamAttempt.create({
        exam_id: exam.id,
        student_id: student.id,
        start_time: now,
        server_expiry_time: expiry,
        status: 'in_progress',
        ip_address: clientIp.toString().slice(0, 50),
        user_agent: userAgent.slice(0, 300)
      }, { transaction });

      await assignment.update({ status: 'started' }, { transaction });

      // Notify Socket.IO live proctoring
      const io = req.app.get('io');
      if (io) {
        io.to(`exam_${exam.id}`).emit('candidate_started', {
          studentId: student.id,
          studentName: studentUser.name,
          startTime: now,
          serverExpiryTime: expiry
        });
      }
    }

    // Retrieve Question Set
    let targetQuestionIds = [];

    if (exam.selection_mode === 'manual_fixed' || exam.selection_mode === 'random_fixed_pool') {
      const eqList = await ExamQuestion.findAll({
        where: { exam_id: exam.id },
        order: [['question_order', 'ASC']],
        attributes: ['question_id', 'question_order'],
        transaction
      });
      targetQuestionIds = eqList.map(item => item.question_id);
    } else if (exam.selection_mode === 'random_per_student') {
      const existingAnswers = await StudentAnswer.findAll({
        where: { exam_attempt_id: attempt.id },
        attributes: ['question_id'],
        transaction
      });

      if (existingAnswers.length > 0) {
        targetQuestionIds = existingAnswers.map(a => a.question_id);
      } else {
        const poolQuestions = await Question.findAll({
          where: {
            institution_id: exam.institution_id,
            subject_id: exam.subject_id,
            status: 'approved'
          },
          attributes: ['id'],
          transaction
        });

        const poolIds = poolQuestions.map(q => q.id);
        const desiredCount = Math.min(exam.total_questions, poolIds.length);

        // Shuffle
        for (let i = poolIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [poolIds[j], poolIds[i]] = [poolIds[i], poolIds[j]];
        }
        targetQuestionIds = poolIds.slice(0, desiredCount);
      }
    }

    // Fetch Full Questions - CRITICAL SECURITY: Do not select is_correct!
    const questions = await Question.findAll({
      where: { id: { [Op.in]: targetQuestionIds } },
      attributes: ['id', 'question_text', 'marks', 'negative_marks', 'language', 'topic'],
      include: [
        {
          model: QuestionOption,
          as: 'options',
          attributes: ['id', 'option_key', 'option_text'] // NO is_correct returned to candidate!
        }
      ],
      transaction
    });

    // Preserve the exact question order
    const questionMap = new Map();
    questions.forEach(q => questionMap.set(q.id, q));
    const orderedQuestions = targetQuestionIds.map((qId, idx) => {
      const q = questionMap.get(qId);
      if (!q) return null;
      return {
        id: q.id,
        question_order: idx + 1,
        question_text: q.question_text,
        marks: q.marks,
        negative_marks: q.negative_marks,
        language: q.language,
        topic: q.topic,
        options: q.options
      };
    }).filter(Boolean);

    // Fetch candidate's currently saved answers (for seamless attempt recovery after refresh/disconnect)
    const savedAnswers = await StudentAnswer.findAll({
      where: { exam_attempt_id: attempt.id },
      attributes: ['question_id', 'selected_option_key', 'is_marked_for_review'],
      transaction
    });

    const savedAnswersMap = {};
    savedAnswers.forEach(ans => {
      savedAnswersMap[ans.question_id] = {
        selected_option_key: ans.selected_option_key,
        is_marked_for_review: ans.is_marked_for_review
      };
    });

    await transaction.commit();

    const remainingSeconds = Math.max(0, Math.floor((new Date(attempt.server_expiry_time) - new Date()) / 1000));
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || '127.0.0.1';

    return res.status(200).json({
      success: true,
      attemptId: attempt.id,
      serverTime: new Date().toISOString(),
      serverExpiryTime: attempt.server_expiry_time,
      remainingSeconds,
      durationMinutes: exam.duration_minutes,
      totalQuestions: orderedQuestions.length,
      candidate: {
        id: student.id,
        name: studentUser.name,
        email: studentUser.email,
        student_id: student.student_id,
        roll_no: student.roll_no || student.student_id,
        enrollment_no: student.enrollment_no || '',
        ip_address: clientIp
      },
      exam: {
        id: exam.id,
        title: exam.title,
        duration_minutes: exam.duration_minutes,
        total_marks: exam.total_marks,
        marks_per_question: exam.marks_per_question,
        negative_marking: exam.negative_marking
      },
      questions: orderedQuestions,
      savedAnswers: savedAnswersMap,
      isPaused: !!attempt.is_paused,
      pausedAt: attempt.paused_at
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Timer Synchronization Endpoint (Section 9)
 * Prevents timer drift, detects clock mismatches, auto-submits on expiry.
 */
const getTimerSync = async (req, res, next) => {
  try {
    const studentUser = req.user;
    const { id } = req.params;

    const student = await Student.findOne({ where: { user_id: studentUser.id } });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const attempt = await ExamAttempt.findOne({
      where: { exam_id: id, student_id: student.id }
    });

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'No examination attempt found for this exam.'
      });
    }

    const now = new Date();
    const expiryTime = new Date(attempt.server_expiry_time);
    let remainingSeconds = Math.max(0, Math.floor((expiryTime - now) / 1000));
    let status = attempt.status;

    // If attempt is in_progress but server countdown has expired (and not paused by proctor), auto-submit immediately
    if (status === 'in_progress' && remainingSeconds <= 0 && !attempt.is_paused) {
      const io = req.app.get('io');
      const evalResult = await evaluateAndFinalizeAttempt(attempt.id, 'auto', { req, io });
      status = 'auto_submitted';
      remainingSeconds = 0;

      return res.status(200).json({
        success: true,
        serverTime: now.toISOString(),
        serverExpiryTime: attempt.server_expiry_time,
        remainingSeconds: 0,
        status: 'auto_submitted',
        isExpired: true,
        message: 'The examination timer has expired. Attempt has been auto-submitted.',
        summary: evalResult.summary
      });
    }

    const savedAnswersCount = await StudentAnswer.count({
      where: {
        exam_attempt_id: attempt.id,
        selected_option_key: { [Op.ne]: null }
      }
    });

    return res.status(200).json({
      success: true,
      serverTime: now.toISOString(),
      serverExpiryTime: attempt.server_expiry_time,
      remainingSeconds,
      status,
      isPaused: !!attempt.is_paused,
      isExpired: (status !== 'in_progress' || remainingSeconds <= 0) && !attempt.is_paused,
      savedAnswersCount
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Autosave single answer immediately (Section 8 & 9)
 * With strict submission lock and expiry protection.
 */
const saveAnswer = async (req, res, next) => {
  try {
    const studentUser = req.user;
    const { id } = req.params;
    const { question_id, selected_option_key, is_marked_for_review } = req.body;

    const student = await Student.findOne({ where: { user_id: studentUser.id } });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const attempt = await ExamAttempt.findOne({
      where: { exam_id: id, student_id: student.id }
    });

    if (!attempt) {
      return res.status(400).json({
        success: false,
        message: 'No examination attempt found.'
      });
    }

    // Critical Security Guard: Prevent modifying answers if already submitted
    if (attempt.status === 'submitted' || attempt.status === 'auto_submitted') {
      return res.status(403).json({
        success: false,
        isSubmitted: true,
        message: 'This examination has already been submitted. Modifying answers is strictly prohibited.'
      });
    }

    // Critical Security Guard: Prevent modifying answers if attempt is paused by proctor
    if (attempt.is_paused) {
      return res.status(403).json({
        success: false,
        isPaused: true,
        message: 'This examination session is currently paused by the proctor. Modifying answers is locked.'
      });
    }

    // Verify server-side timer has not expired
    const now = new Date();
    if (new Date(attempt.server_expiry_time) < now) {
      const io = req.app.get('io');
      await evaluateAndFinalizeAttempt(attempt.id, 'auto', { req, io });

      return res.status(403).json({
        success: false,
        isExpired: true,
        message: 'Server countdown has expired. Answer could not be saved; exam has been auto-submitted.'
      });
    }

    // Upsert student answer
    const [answerRecord, created] = await StudentAnswer.findOrCreate({
      where: {
        exam_attempt_id: attempt.id,
        question_id: parseInt(question_id, 10)
      },
      defaults: {
        exam_attempt_id: attempt.id,
        question_id: parseInt(question_id, 10),
        selected_option_key: selected_option_key || null,
        is_marked_for_review: !!is_marked_for_review,
        answered_at: now
      }
    });

    if (!created) {
      await answerRecord.update({
        selected_option_key: selected_option_key !== undefined ? selected_option_key : answerRecord.selected_option_key,
        is_marked_for_review: is_marked_for_review !== undefined ? !!is_marked_for_review : answerRecord.is_marked_for_review,
        answered_at: now
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`exam_${id}`).emit('candidate_progress', {
        studentId: student.id,
        studentName: studentUser.name,
        questionId: parseInt(question_id, 10),
        hasAnswer: selected_option_key !== null,
        isMarkedForReview: !!is_marked_for_review,
        timestamp: now.toISOString()
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Answer saved securely.',
      savedAt: now.toISOString()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk / Offline Sync Answers Endpoint (Section 9 & 10)
 * Recovers and syncs all answers cached locally during an internet outage.
 */
const syncOfflineAnswers = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const studentUser = req.user;
    const { id } = req.params;
    const { answers } = req.body; // Array of { question_id, selected_option_key, is_marked_for_review }

    if (!Array.isArray(answers) || answers.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid answers array payload.'
      });
    }

    const student = await Student.findOne({ where: { user_id: studentUser.id }, transaction });
    if (!student) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const attempt = await ExamAttempt.findOne({
      where: { exam_id: id, student_id: student.id },
      transaction
    });

    if (!attempt) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'No examination attempt found.'
      });
    }

    if (attempt.status === 'submitted' || attempt.status === 'auto_submitted') {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        isSubmitted: true,
        message: 'Examination has already been submitted. Modification is prohibited.'
      });
    }

    const now = new Date();
    if (new Date(attempt.server_expiry_time) < now) {
      await transaction.rollback();
      const io = req.app.get('io');
      await evaluateAndFinalizeAttempt(attempt.id, 'auto', { req, io });

      return res.status(403).json({
        success: false,
        isExpired: true,
        message: 'Server countdown has expired. Exam auto-submitted.'
      });
    }

    let syncedCount = 0;
    for (const item of answers) {
      if (!item.question_id) continue;

      const qId = parseInt(item.question_id, 10);
      const [answerRecord, created] = await StudentAnswer.findOrCreate({
        where: {
          exam_attempt_id: attempt.id,
          question_id: qId
        },
        defaults: {
          exam_attempt_id: attempt.id,
          question_id: qId,
          selected_option_key: item.selected_option_key || null,
          is_marked_for_review: !!item.is_marked_for_review,
          answered_at: now
        },
        transaction
      });

      if (!created) {
        await answerRecord.update({
          selected_option_key: item.selected_option_key !== undefined ? item.selected_option_key : answerRecord.selected_option_key,
          is_marked_for_review: item.is_marked_for_review !== undefined ? !!item.is_marked_for_review : answerRecord.is_marked_for_review,
          answered_at: now
        }, { transaction });
      }
      syncedCount++;
    }

    await transaction.commit();

    return res.status(200).json({
      success: true,
      message: `Successfully synchronized ${syncedCount} answer(s).`,
      syncedCount,
      serverTime: now.toISOString()
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Final Examination Submission (Section 8 & 9)
 * Idempotent: Prevents duplicate submissions and double-scoring.
 */
const submitExam = async (req, res, next) => {
  try {
    const studentUser = req.user;
    const { id } = req.params;
    const { submission_type = 'manual' } = req.body;

    const student = await Student.findOne({ where: { user_id: studentUser.id } });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const attempt = await ExamAttempt.findOne({
      where: { exam_id: id, student_id: student.id }
    });

    if (!attempt) {
      return res.status(400).json({
        success: false,
        message: 'No examination attempt found for this student.'
      });
    }

    // Idempotency check: If already submitted, return previous result summary without re-evaluating
    if (attempt.status === 'submitted' || attempt.status === 'auto_submitted') {
      const existingResult = await ExamResult.findOne({
        where: { exam_attempt_id: attempt.id }
      });

      return res.status(200).json({
        success: true,
        alreadySubmitted: true,
        message: 'This examination was already submitted.',
        summary: {
          totalQuestions: existingResult?.total_questions || 0,
          attempted: existingResult?.attempted_questions || 0,
          correct: existingResult?.correct_answers || 0,
          wrong: existingResult?.wrong_answers || 0,
          unattempted: existingResult?.unattempted_questions || 0,
          marksObtained: parseFloat(existingResult?.total_marks_obtained || 0),
          maxMarks: parseFloat(existingResult?.max_marks || 0),
          percentage: parseFloat(existingResult?.percentage || 0),
          isPassed: existingResult?.is_passed || false
        }
      });
    }

    // Finalize via evaluation service
    const io = req.app.get('io');
    const evaluation = await evaluateAndFinalizeAttempt(attempt.id, submission_type, { req, io });

    return res.status(200).json({
      success: true,
      message: submission_type === 'auto'
        ? 'Time expired. Examination was automatically submitted and evaluated.'
        : 'Examination submitted successfully! Responses securely evaluated.',
      summary: evaluation.summary
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStudentExams,
  getExamInstructions,
  startOrResumeExam,
  getTimerSync,
  saveAnswer,
  syncOfflineAnswers,
  submitExam
};
