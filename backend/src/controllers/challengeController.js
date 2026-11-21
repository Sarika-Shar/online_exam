const { Op } = require('sequelize');
const {
  sequelize,
  QuestionChallenge,
  Exam,
  ExamAttempt,
  StudentAnswer,
  ExamResult,
  Question,
  QuestionOption,
  Student,
  User,
  AuditLog
} = require('../models');
const { recomputeExamRanks } = require('../services/rankingService');
const { recordAuditLog } = require('../middleware/auditLogger');
const logger = require('../utils/logger');

/**
 * Re-grade entire candidate cohort for an exam after an answer key change or bonus award
 */
const regradeExamCohort = async (examId, transaction = null, options = {}) => {
  const bonusQuestionIds = new Set((options.bonusQuestionIds || []).map(id => parseInt(id, 10)));

  const exam = await Exam.findByPk(examId, { transaction });
  if (!exam) {
    throw new Error(`Exam ${examId} not found for regrading.`);
  }

  // 1. Fetch all questions with their latest options
  const questions = await Question.findAll({
    include: [{ model: QuestionOption, as: 'options' }],
    transaction
  });
  const questionMap = new Map();
  questions.forEach(q => {
    const correctOpt = q.options?.find(o => o.is_correct);
    questionMap.set(q.id, {
      id: q.id,
      correctKey: correctOpt ? correctOpt.option_key : null,
      marks: parseFloat(q.marks || exam.marks_per_question || 1),
      negativeMarks: parseFloat(q.negative_marks || exam.negative_marking || 0)
    });
  });

  // 2. Fetch all completed attempts for this exam (excluding disqualified attempts)
  const attempts = await ExamAttempt.findAll({
    where: {
      exam_id: examId,
      status: { [Op.in]: ['submitted', 'auto_submitted'] }
    },
    transaction
  });

  let candidatesRegraded = 0;
  let marksIncreasedCount = 0;
  let marksDecreasedCount = 0;
  let marksUnchangedCount = 0;

  for (const attempt of attempts) {
    const studentAnswers = await StudentAnswer.findAll({
      where: { exam_attempt_id: attempt.id },
      transaction
    });

    let correctCount = 0;
    let wrongCount = 0;
    let totalMarks = 0.0;

    for (const ans of studentAnswers) {
      const qMeta = questionMap.get(ans.question_id);
      if (!qMeta) continue;

      const isBonus = bonusQuestionIds.has(ans.question_id);

      if (isBonus) {
        // Full bonus marks awarded to all who faced this question
        correctCount++;
        ans.is_correct = true;
        ans.marks_awarded = qMeta.marks;
        totalMarks += qMeta.marks;
        await ans.save({ transaction });
      } else if (ans.selected_option_key) {
        if (ans.selected_option_key === qMeta.correctKey) {
          correctCount++;
          ans.is_correct = true;
          ans.marks_awarded = qMeta.marks;
          totalMarks += qMeta.marks;
        } else {
          wrongCount++;
          ans.is_correct = false;
          ans.marks_awarded = -qMeta.negativeMarks;
          totalMarks -= qMeta.negativeMarks;
        }
        await ans.save({ transaction });
      }
    }

    const finalMarksObtained = Math.max(0, parseFloat(totalMarks.toFixed(2)));
    const totalQuestions = exam.total_questions || studentAnswers.length;
    const attemptedCount = correctCount + wrongCount;
    const unattemptedCount = Math.max(0, totalQuestions - attemptedCount);
    const maxMarks = parseFloat(exam.total_marks || (totalQuestions * (exam.marks_per_question || 1)));
    const percentage = maxMarks > 0 ? parseFloat(((finalMarksObtained / maxMarks) * 100).toFixed(2)) : 0;
    const isPassed = percentage >= parseFloat(exam.passing_percentage || 40);

    const existingResult = await ExamResult.findOne({
      where: { exam_attempt_id: attempt.id },
      transaction
    });

    if (existingResult) {
      const prevMarks = parseFloat(existingResult.total_marks_obtained);
      if (finalMarksObtained > prevMarks) marksIncreasedCount++;
      else if (finalMarksObtained < prevMarks) marksDecreasedCount++;
      else marksUnchangedCount++;

      existingResult.correct_answers = correctCount;
      existingResult.wrong_answers = wrongCount;
      existingResult.attempted_questions = attemptedCount;
      existingResult.unattempted_questions = unattemptedCount;
      existingResult.total_marks_obtained = finalMarksObtained;
      existingResult.percentage = percentage;
      existingResult.is_passed = isPassed;
      existingResult.calculated_at = new Date();
      await existingResult.save({ transaction });
    }

    candidatesRegraded++;
  }

  // 3. Re-calculate dynamic ranks with tie-breakers
  await recomputeExamRanks(examId, transaction);

  return {
    candidatesRegraded,
    marksIncreasedCount,
    marksDecreasedCount,
    marksUnchangedCount
  };
};

/**
 * Candidate Submit Question / Answer Key Challenge
 */
const submitChallenge = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const studentUser = req.user;
    const institutionId = req.institutionId;
    const {
      exam_id,
      question_id,
      exam_attempt_id,
      challenge_type = 'WRONG_KEY',
      claimed_option_key,
      justification,
      reference_source
    } = req.body;

    if (!exam_id || !question_id || !exam_attempt_id || !justification) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Exam ID, Question ID, Attempt ID, and Justification are required.'
      });
    }

    const student = await Student.findOne({
      where: { user_id: studentUser.id },
      transaction
    });

    if (!student) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    // Verify student owns the exam attempt
    const attempt = await ExamAttempt.findOne({
      where: { id: exam_attempt_id, student_id: student.id, exam_id },
      transaction
    });

    if (!attempt) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only challenge questions from your own verified attempt.'
      });
    }

    // Check if challenge for this question already submitted by this student
    const existing = await QuestionChallenge.findOne({
      where: {
        exam_id,
        question_id,
        student_id: student.id
      },
      transaction
    });

    if (existing) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'You have already lodged a challenge for this question. Multiple submissions for the same question are not permitted.'
      });
    }

    const challenge = await QuestionChallenge.create({
      institution_id: institutionId || attempt.institution_id || 1,
      exam_id,
      question_id,
      student_id: student.id,
      exam_attempt_id,
      challenge_type,
      claimed_option_key: claimed_option_key ? claimed_option_key.toUpperCase() : null,
      justification: justification.trim(),
      reference_source: reference_source ? reference_source.trim() : null,
      status: 'pending'
    }, { transaction });

    await transaction.commit();

    await recordAuditLog({
      req,
      action: 'QUESTION_CHALLENGE_SUBMITTED',
      entityType: 'QuestionChallenge',
      entityId: challenge.id,
      details: {
        examId: exam_id,
        questionId: question_id,
        challengeType: challenge_type,
        claimedOptionKey: claimed_option_key
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Your answer key challenge has been submitted successfully for academic committee review.',
      challenge
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

/**
 * Retrieve Challenges submitted by current student
 */
const getMyChallenges = async (req, res, next) => {
  try {
    const studentUser = req.user;
    const { examId } = req.query;

    const student = await Student.findOne({ where: { user_id: studentUser.id } });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const whereClause = { student_id: student.id };
    if (examId) {
      whereClause.exam_id = examId;
    }

    const challenges = await QuestionChallenge.findAll({
      where: whereClause,
      include: [
        { model: Exam, as: 'exam', attributes: ['id', 'title'] },
        {
          model: Question,
          as: 'question',
          attributes: ['id', 'question_text', 'marks', 'negative_marks'],
          include: [{ model: QuestionOption, as: 'options', attributes: ['id', 'option_key', 'option_text', 'is_correct'] }]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      challenges
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve All Challenges for an Exam (Grouped by Question for Admin Review)
 */
const getExamChallenges = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const { examId } = req.params;
    const { status } = req.query;

    const exam = await Exam.findOne({
      where: { id: examId, institution_id: institutionId }
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Examination not found.' });
    }

    const challengeWhere = { exam_id: examId };
    if (status && status !== 'all') {
      challengeWhere.status = status;
    }

    const allChallenges = await QuestionChallenge.findAll({
      where: challengeWhere,
      include: [
        {
          model: Student,
          as: 'student',
          include: [{ model: User, as: 'user', attributes: ['name', 'email'] }]
        },
        {
          model: Question,
          as: 'question',
          include: [{ model: QuestionOption, as: 'options' }]
        },
        {
          model: User,
          as: 'reviewer',
          attributes: ['name', 'email']
        }
      ],
      order: [['created_at', 'ASC']]
    });

    // Group challenges by question_id
    const groupedMap = new Map();
    let pendingCount = 0;
    let underReviewCount = 0;
    let acceptedCount = 0;
    let rejectedCount = 0;

    allChallenges.forEach(c => {
      if (c.status === 'pending') pendingCount++;
      else if (c.status === 'under_review') underReviewCount++;
      else if (c.status === 'accepted') acceptedCount++;
      else if (c.status === 'rejected') rejectedCount++;

      if (!groupedMap.has(c.question_id)) {
        const q = c.question;
        const correctOpt = q?.options?.find(o => o.is_correct);
        groupedMap.set(c.question_id, {
          questionId: c.question_id,
          questionText: q ? q.question_text : 'Question not found',
          marks: q ? q.marks : 1,
          negativeMarks: q ? q.negative_marks : 0,
          currentCorrectKey: correctOpt ? correctOpt.option_key : 'N/A',
          currentCorrectText: correctOpt ? correctOpt.option_text : '',
          options: q?.options?.map(o => ({
            id: o.id,
            optionKey: o.option_key,
            optionText: o.option_text,
            isCorrect: o.is_correct
          })) || [],
          totalChallenges: 0,
          claimedKeyCounts: {},
          typeCounts: {},
          challenges: []
        });
      }

      const entry = groupedMap.get(c.question_id);
      entry.totalChallenges++;
      
      const claimed = c.claimed_option_key || 'NONE';
      entry.claimedKeyCounts[claimed] = (entry.claimedKeyCounts[claimed] || 0) + 1;
      entry.typeCounts[c.challenge_type] = (entry.typeCounts[c.challenge_type] || 0) + 1;

      entry.challenges.push({
        id: c.id,
        studentId: c.student?.student_id,
        studentName: c.student?.user?.name,
        rollNo: c.student?.roll_no,
        challengeType: c.challenge_type,
        claimedOptionKey: c.claimed_option_key,
        justification: c.justification,
        referenceSource: c.reference_source,
        status: c.status,
        resolutionAction: c.resolution_action,
        resolutionNotes: c.resolution_notes,
        reviewerName: c.reviewer?.name,
        reviewedAt: c.reviewed_at,
        createdAt: c.created_at
      });
    });

    const disputedQuestions = Array.from(groupedMap.values()).sort((a, b) => b.totalChallenges - a.totalChallenges);

    return res.status(200).json({
      success: true,
      exam: {
        id: exam.id,
        title: exam.title,
        status: exam.status
      },
      stats: {
        totalChallenges: allChallenges.length,
        uniqueQuestionsDisputed: disputedQuestions.length,
        pendingCount,
        underReviewCount,
        acceptedCount,
        rejectedCount
      },
      disputedQuestions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve All Challenges for a Question (Key Change, Bonus Marks, or Reject) & Auto Re-grade Cohort
 */
const resolveQuestionChallenges = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const institutionId = req.institutionId;
    const reviewerUser = req.user;
    const { examId, questionId } = req.params;
    const {
      resolution_action, // 'KEY_CHANGE' | 'BONUS_MARKS' | 'REJECT'
      new_correct_option_key,
      notes
    } = req.body;

    const validActions = ['KEY_CHANGE', 'BONUS_MARKS', 'REJECT'];
    if (!validActions.includes(resolution_action)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: `Invalid resolution action. Must be one of: ${validActions.join(', ')}`
      });
    }

    const exam = await Exam.findOne({
      where: { id: examId, institution_id: institutionId },
      transaction
    });

    if (!exam) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Examination not found.' });
    }

    const question = await Question.findOne({
      where: { id: questionId },
      include: [{ model: QuestionOption, as: 'options' }],
      transaction
    });

    if (!question) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    const now = new Date();
    let regradeSummary = null;

    if (resolution_action === 'KEY_CHANGE') {
      if (!new_correct_option_key) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'New correct option key (e.g. "C") is required for KEY_CHANGE resolution.'
        });
      }

      const targetKey = new_correct_option_key.toUpperCase();
      const optionExists = question.options.some(o => o.option_key.toUpperCase() === targetKey);
      if (!optionExists) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Option key "${targetKey}" does not exist for this question.`
        });
      }

      // Update question options: set new correct option to true, others to false
      for (const opt of question.options) {
        const isNowCorrect = opt.option_key.toUpperCase() === targetKey;
        if (opt.is_correct !== isNowCorrect) {
          opt.is_correct = isNowCorrect;
          await opt.save({ transaction });
        }
      }

      // Mark all challenges for this question as accepted
      await QuestionChallenge.update({
        status: 'accepted',
        resolution_action: 'KEY_CHANGE',
        resolution_notes: notes || `Key revised to option ${targetKey}. All cohort answers re-evaluated.`,
        reviewed_by: reviewerUser.id,
        reviewed_at: now
      }, {
        where: { exam_id: examId, question_id: questionId },
        transaction
      });

      // Trigger automatic cohort re-grading
      regradeSummary = await regradeExamCohort(examId, transaction);

    } else if (resolution_action === 'BONUS_MARKS') {
      // Award full marks to all candidates for this question
      await QuestionChallenge.update({
        status: 'accepted',
        resolution_action: 'BONUS_MARKS',
        resolution_notes: notes || 'Question deemed defective / ambiguous. Full bonus marks awarded to all candidates.',
        reviewed_by: reviewerUser.id,
        reviewed_at: now
      }, {
        where: { exam_id: examId, question_id: questionId },
        transaction
      });

      // Trigger automatic cohort re-grading with bonus
      regradeSummary = await regradeExamCohort(examId, transaction, { bonusQuestionIds: [questionId] });

    } else if (resolution_action === 'REJECT') {
      // Committee verified official key is correct; reject disputes
      await QuestionChallenge.update({
        status: 'rejected',
        resolution_action: 'REJECT',
        resolution_notes: notes || 'The academic review committee verified the official answer key as correct.',
        reviewed_by: reviewerUser.id,
        reviewed_at: now
      }, {
        where: { exam_id: examId, question_id: questionId },
        transaction
      });
    }

    await transaction.commit();

    // Broadcast regrading telemetry via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`exam_${examId}`).emit('cohort_regraded_event', {
        examId,
        questionId,
        action: resolution_action,
        timestamp: now.toISOString(),
        regradeSummary
      });
    }

    await recordAuditLog({
      req,
      action: 'QUESTION_CHALLENGES_RESOLVED',
      entityType: 'Question',
      entityId: questionId,
      details: {
        examId,
        resolutionAction: resolution_action,
        newKey: new_correct_option_key,
        regradeSummary
      }
    });

    return res.status(200).json({
      success: true,
      message: `Question challenges resolved successfully with action "${resolution_action}".`,
      resolutionAction: resolution_action,
      regradeSummary
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

module.exports = {
  submitChallenge,
  getMyChallenges,
  getExamChallenges,
  resolveQuestionChallenges,
  regradeExamCohort
};
