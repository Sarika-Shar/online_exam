const { Op } = require('sequelize');
const {
  sequelize,
  Exam,
  ExamAssignment,
  ExamAttempt,
  StudentAnswer,
  ExamResult,
  Question,
  QuestionOption,
  Student,
  User
} = require('../models');
const logger = require('../utils/logger');
const { recordAuditLog } = require('../middleware/auditLogger');

/**
 * Enterprise Server-Side Examination Evaluation Service
 * Evaluates candidate responses against correct options with transactional integrity.
 * Used by manual submission, client-triggered timer expiry, and background auto-submit sweeper.
 *
 * @param {number} attemptId - ExamAttempt ID
 * @param {string} submissionType - 'manual' | 'auto'
 * @param {object} options - Optional context (req for audit log, io for live monitoring)
 * @returns {object} Evaluation summary
 */
const evaluateAndFinalizeAttempt = async (attemptId, submissionType = 'manual', options = {}) => {
  const transaction = await sequelize.transaction();
  try {
    const attempt = await ExamAttempt.findByPk(attemptId, {
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
      throw new Error(`ExamAttempt with ID ${attemptId} not found.`);
    }

    // Idempotency: If attempt is already submitted, return existing result without re-evaluating
    if (attempt.status === 'submitted' || attempt.status === 'auto_submitted') {
      const existingResult = await ExamResult.findOne({
        where: { exam_attempt_id: attempt.id },
        transaction
      });
      await transaction.rollback();

      return {
        alreadySubmitted: true,
        attemptId: attempt.id,
        status: attempt.status,
        submissionType: attempt.submission_type,
        result: existingResult
      };
    }

    const now = new Date();
    const finalStatus = submissionType === 'auto' ? 'auto_submitted' : 'submitted';

    // 1. Mark attempt status & end time
    attempt.status = finalStatus;
    attempt.submission_type = submissionType;
    attempt.end_time = now;
    await attempt.save({ transaction });

    // 2. Mark exam assignment as completed
    await ExamAssignment.update(
      { status: 'completed' },
      {
        where: {
          exam_id: attempt.exam_id,
          student_id: attempt.student_id
        },
        transaction
      }
    );

    // 3. Compute completion duration
    const completionSeconds = Math.max(1, Math.floor((now - new Date(attempt.start_time)) / 1000));

    // 4. Retrieve candidate answers for this attempt
    const studentAnswers = await StudentAnswer.findAll({
      where: { exam_attempt_id: attempt.id },
      transaction
    });

    const questionIds = studentAnswers.map(a => a.question_id);
    const questionsWithOptions = await Question.findAll({
      where: { id: { [Op.in]: questionIds } },
      include: [{ model: QuestionOption, as: 'options' }],
      transaction
    });

    // Map correct answers
    const correctAnswersMap = new Map();
    questionsWithOptions.forEach(q => {
      const correctOpt = q.options?.find(o => o.is_correct);
      if (correctOpt) {
        correctAnswersMap.set(q.id, {
          correct_key: correctOpt.option_key,
          marks: parseFloat(q.marks || attempt.exam?.marks_per_question || 1),
          negative_marks: parseFloat(q.negative_marks || attempt.exam?.negative_marking || 0)
        });
      }
    });

    let correctCount = 0;
    let wrongCount = 0;
    let totalMarksObtained = 0.0;

    for (const ans of studentAnswers) {
      if (ans.selected_option_key) {
        const qInfo = correctAnswersMap.get(ans.question_id);
        if (qInfo) {
          if (ans.selected_option_key === qInfo.correct_key) {
            correctCount++;
            ans.is_correct = true;
            ans.marks_awarded = qInfo.marks;
            totalMarksObtained += qInfo.marks;
          } else {
            wrongCount++;
            ans.is_correct = false;
            ans.marks_awarded = -qInfo.negative_marks;
            totalMarksObtained -= qInfo.negative_marks;
          }
          await ans.save({ transaction });
        }
      }
    }

    totalMarksObtained = Math.max(0, parseFloat(totalMarksObtained.toFixed(2)));
    const totalQuestions = attempt.exam.total_questions;
    const attemptedCount = correctCount + wrongCount;
    const unattemptedCount = Math.max(0, totalQuestions - attemptedCount);
    const maxMarks = parseFloat(attempt.exam.total_marks);
    const percentage = maxMarks > 0 ? parseFloat(((totalMarksObtained / maxMarks) * 100).toFixed(2)) : 0;
    const isPassed = percentage >= parseFloat(attempt.exam.passing_percentage);

    // 5. Upsert ExamResult record
    const [resultRecord] = await ExamResult.upsert(
      {
        institution_id: attempt.exam.institution_id,
        exam_id: attempt.exam_id,
        student_id: attempt.student_id,
        exam_attempt_id: attempt.id,
        total_questions: totalQuestions,
        attempted_questions: attemptedCount,
        correct_answers: correctCount,
        wrong_answers: wrongCount,
        unattempted_questions: unattemptedCount,
        total_marks_obtained: totalMarksObtained,
        max_marks: maxMarks,
        percentage,
        is_passed: isPassed,
        completion_time_seconds: completionSeconds,
        calculated_at: now
      },
      { transaction }
    );

    await transaction.commit();

    // Recompute dynamic rankings for the exam
    try {
      const { recomputeExamRanks } = require('./rankingService');
      await recomputeExamRanks(attempt.exam_id);
    } catch (err) {
      logger.warn(`Could not recompute ranks immediately: ${err.message}`);
    }

    // 6. Broadcast real-time Socket.IO update if available
    const io = options.io;
    if (io) {
      const eventName = submissionType === 'auto' ? 'candidate_auto_submitted' : 'candidate_submitted';
      io.to(`exam_${attempt.exam_id}`).emit(eventName, {
        examId: attempt.exam_id,
        studentId: attempt.student_id,
        studentName: attempt.student?.user?.name || 'Student',
        submissionType,
        totalMarksObtained,
        percentage,
        isPassed,
        submittedAt: now.toISOString()
      });
    }

    // 7. Audit log
    if (options.req) {
      await recordAuditLog({
        req: options.req,
        action: submissionType === 'auto' ? 'EXAM_AUTO_SUBMIT' : 'EXAM_SUBMISSION',
        entity_type: 'ExamAttempt',
        entity_id: attempt.id,
        details: {
          exam_id: attempt.exam_id,
          exam_title: attempt.exam.title,
          student_id: attempt.student_id,
          submission_type: submissionType,
          marksObtained: totalMarksObtained,
          percentage
        }
      });
    } else {
      logger.info(
        `Attempt ${attempt.id} finalized [${submissionType.toUpperCase()}]: Student ${attempt.student_id}, Marks: ${totalMarksObtained}/${maxMarks} (${percentage}%)`
      );
    }

    return {
      success: true,
      alreadySubmitted: false,
      attemptId: attempt.id,
      status: finalStatus,
      submissionType,
      summary: {
        totalQuestions,
        attempted: attemptedCount,
        correct: correctCount,
        wrong: wrongCount,
        unattempted: unattemptedCount,
        marksObtained: totalMarksObtained,
        maxMarks,
        percentage,
        isPassed,
        completionSeconds
      }
    };
  } catch (error) {
    await transaction.rollback();
    logger.error(`Error finalizing attempt ${attemptId}:`, error);
    throw error;
  }
};

module.exports = {
  evaluateAndFinalizeAttempt
};
