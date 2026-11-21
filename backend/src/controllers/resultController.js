const { Op } = require('sequelize');
const {
  sequelize,
  ExamResult,
  Exam,
  Student,
  User,
  Class,
  Batch,
  Subject,
  ExamAttempt,
  StudentAnswer,
  Question,
  QuestionOption
} = require('../models');
const { recomputeExamRanks, getExamResultMetrics } = require('../services/rankingService');
const { recordAuditLog } = require('../middleware/auditLogger');
const logger = require('../utils/logger');

/**
 * Get paginated exam results with filters (Admin & Teachers)
 */
const getResults = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const {
      exam_id,
      class_id,
      batch_id,
      status, // 'passed' | 'failed'
      search,
      page = 1,
      limit = 20
    } = req.query;

    const whereClause = { institution_id: institutionId };
    if (exam_id) whereClause.exam_id = exam_id;
    if (status === 'passed') whereClause.is_passed = true;
    if (status === 'failed') whereClause.is_passed = false;

    // Student filter conditions
    const studentWhere = {};
    if (class_id) studentWhere.class_id = class_id;
    if (batch_id) studentWhere.batch_id = batch_id;

    // User search condition
    const userWhere = {};
    if (search) {
      userWhere[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { username: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { count, rows } = await ExamResult.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Student,
          as: 'student',
          where: Object.keys(studentWhere).length > 0 ? studentWhere : undefined,
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'email', 'username'],
              where: Object.keys(userWhere).length > 0 ? userWhere : undefined
            },
            { model: Class, as: 'class', attributes: ['id', 'name', 'code'] },
            { model: Batch, as: 'batch', attributes: ['id', 'name'] }
          ]
        },
        {
          model: Exam,
          as: 'exam',
          attributes: [
            'id',
            'title',
            'exam_date',
            'duration_minutes',
            'total_questions',
            'total_marks',
            'passing_percentage',
            'results_published'
          ],
          include: [{ model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] }]
        }
      ],
      order: [
        ['exam_id', 'ASC'],
        ['rank', 'ASC'],
        ['total_marks_obtained', 'DESC']
      ],
      limit: parseInt(limit, 10),
      offset
    });

    // Compute metrics if exam_id is provided
    let metrics = null;
    if (exam_id) {
      metrics = await getExamResultMetrics(exam_id);
    }

    return res.status(200).json({
      success: true,
      total: count,
      page: parseInt(page, 10),
      totalPages: Math.ceil(count / parseInt(limit, 10)),
      metrics,
      results: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Leaderboard for a Specific Exam (Admin & Students)
 */
const getExamLeaderboard = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const { examId } = req.params;
    const userRole = req.user?.role;

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

    // Student Privacy Guard: If results are hidden, students cannot access leaderboard
    if (userRole === 'student' && !exam.results_published) {
      return res.status(403).json({
        success: false,
        resultsPublished: false,
        message: 'Examination results and leaderboard are currently under review by institution administration.'
      });
    }

    // Recompute ranks if any unranked results exist
    let results = await ExamResult.findAll({
      where: { exam_id: examId },
      include: [
        {
          model: Student,
          as: 'student',
          include: [
            { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
            { model: Class, as: 'class', attributes: ['id', 'name'] },
            { model: Batch, as: 'batch', attributes: ['id', 'name'] }
          ]
        }
      ],
      order: [
        ['rank', 'ASC'],
        ['total_marks_obtained', 'DESC'],
        ['completion_time_seconds', 'ASC']
      ]
    });

    // If any candidate has rank null, trigger recompute
    if (results.some(r => r.rank === null)) {
      results = await recomputeExamRanks(examId);
    }

    const metrics = await getExamResultMetrics(examId);

    // Identify Podium (Top 3)
    const podium = results.slice(0, 3).map((r, idx) => ({
      position: idx + 1,
      studentId: r.student?.student_id,
      studentName: r.student?.user?.name,
      marksObtained: r.total_marks_obtained,
      percentage: r.percentage,
      completionSeconds: r.completion_time_seconds
    }));

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
        passingPercentage: exam.passing_percentage,
        resultsPublished: exam.results_published
      },
      metrics,
      podium,
      leaderboard: results
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Publish or Hide Results for an Exam (Admin)
 */
const togglePublishResults = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const { examId } = req.params;
    const { results_published } = req.body;

    const exam = await Exam.findOne({
      where: { id: examId, institution_id: institutionId }
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Examination not found.' });
    }

    const isPublished = results_published !== undefined ? !!results_published : !exam.results_published;
    exam.results_published = isPublished;
    await exam.save();

    // Recompute ranks to ensure data is clean upon publishing
    if (isPublished) {
      await recomputeExamRanks(examId);
    }

    // Broadcast live event to candidates
    const io = req.app.get('io');
    if (io) {
      io.to(`exam_${examId}`).emit('results_published_status', {
        examId: exam.id,
        resultsPublished: isPublished
      });
      io.emit('global_exam_results_updated', {
        examId: exam.id,
        resultsPublished: isPublished
      });
    }

    await recordAuditLog({
      req,
      action: isPublished ? 'PUBLISH_EXAM_RESULTS' : 'HIDE_EXAM_RESULTS',
      entity_type: 'Exam',
      entity_id: exam.id,
      details: {
        exam_id: exam.id,
        title: exam.title,
        results_published: isPublished
      }
    });

    return res.status(200).json({
      success: true,
      message: isPublished
        ? 'Examination results published successfully! Students can now view their scorecards and leaderboard.'
        : 'Examination results are now hidden from students.',
      resultsPublished: isPublished
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Manually Recalculate Ranks for an Exam (Admin)
 */
const recalculateRanks = async (req, res, next) => {
  try {
    const { examId } = req.params;
    const rankedResults = await recomputeExamRanks(examId);
    const metrics = await getExamResultMetrics(examId);

    return res.status(200).json({
      success: true,
      message: `Successfully recalculated ranks for ${rankedResults.length} candidates.`,
      rankedCount: rankedResults.length,
      metrics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Detailed Individual Scorecard (Question Breakdown)
 */
const getIndividualScorecard = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const { resultId } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    const result = await ExamResult.findOne({
      where: { id: resultId, institution_id: institutionId },
      include: [
        {
          model: Student,
          as: 'student',
          include: [
            { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
            { model: Class, as: 'class', attributes: ['id', 'name'] },
            { model: Batch, as: 'batch', attributes: ['id', 'name'] }
          ]
        },
        {
          model: Exam,
          as: 'exam',
          include: [
            { model: Subject, as: 'subject', attributes: ['id', 'name', 'code'] },
            { model: Class, as: 'class', attributes: ['id', 'name'] }
          ]
        },
        {
          model: ExamAttempt,
          as: 'attempt',
          include: [
            {
              model: StudentAnswer,
              as: 'answers',
              include: [
                {
                  model: Question,
                  as: 'question',
                  include: [{ model: QuestionOption, as: 'options' }]
                }
              ]
            }
          ]
        }
      ]
    });

    if (!result) {
      return res.status(404).json({ success: false, message: 'Examination result not found.' });
    }

    // Security Guard: Students can only view their own result and only if published
    if (userRole === 'student') {
      if (result.student?.user_id !== userId) {
        return res.status(403).json({ success: false, message: 'Access Denied: You cannot view another candidate\'s scorecard.' });
      }
      if (!result.exam?.results_published) {
        return res.status(403).json({
          success: false,
          resultsPublished: false,
          message: 'This examination scorecard is currently under evaluation and has not been published yet.'
        });
      }
    }

    // Format individual questions analysis
    const answersAnalysis = (result.attempt?.answers || []).map(ans => {
      const q = ans.question;
      const correctOpt = q?.options?.find(o => o.is_correct);

      return {
        questionId: q?.id,
        questionText: q?.question_text,
        topic: q?.topic,
        marks: parseFloat(q?.marks || 1),
        negativeMarks: parseFloat(q?.negative_marks || 0),
        selectedOptionKey: ans.selected_option_key,
        isMarkedForReview: ans.is_marked_for_review,
        isCorrect: ans.is_correct,
        marksAwarded: parseFloat(ans.marks_awarded || 0),
        correctOptionKey: correctOpt?.option_key,
        explanation: q?.explanation,
        options: (q?.options || []).map(o => ({
          optionKey: o.option_key,
          optionText: o.option_text,
          isCorrect: o.is_correct
        }))
      };
    });

    return res.status(200).json({
      success: true,
      scorecard: {
        id: result.id,
        exam: {
          id: result.exam?.id,
          title: result.exam?.title,
          subject: result.exam?.subject?.name,
          class: result.exam?.class?.name,
          totalQuestions: result.total_questions,
          totalMarks: result.max_marks,
          passingPercentage: result.exam?.passing_percentage,
          resultsPublished: result.exam?.results_published
        },
        candidate: {
          studentId: result.student?.student_id,
          name: result.student?.user?.name,
          rollNo: result.student?.roll_no,
          class: result.student?.class?.name,
          batch: result.student?.batch?.name
        },
        attemptDetails: {
          attemptId: result.exam_attempt_id,
          startTime: result.attempt?.start_time,
          endTime: result.attempt?.end_time,
          submissionType: result.attempt?.submission_type,
          completionSeconds: result.completion_time_seconds
        },
        metrics: {
          attempted: result.attempted_questions,
          correct: result.correct_answers,
          wrong: result.wrong_answers,
          unattempted: result.unattempted_questions,
          marksObtained: parseFloat(result.total_marks_obtained),
          maxMarks: parseFloat(result.max_marks),
          percentage: parseFloat(result.percentage),
          rank: result.rank,
          isPassed: result.is_passed
        },
        answersAnalysis
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export Exam Results as CSV File (Admin)
 */
const exportResultsCsv = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const { examId } = req.params;

    const exam = await Exam.findOne({
      where: { id: examId, institution_id: institutionId }
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Examination not found.' });
    }

    const results = await ExamResult.findAll({
      where: { exam_id: examId },
      include: [
        {
          model: Student,
          as: 'student',
          include: [
            { model: User, as: 'user', attributes: ['name', 'email'] },
            { model: Class, as: 'class', attributes: ['name'] },
            { model: Batch, as: 'batch', attributes: ['name'] }
          ]
        }
      ],
      order: [
        ['rank', 'ASC'],
        ['total_marks_obtained', 'DESC']
      ]
    });

    // CSV Header
    let csv = 'Rank,Student Name,Student ID,Email,Class,Batch,Total Questions,Attempted,Correct,Wrong,Unattempted,Marks Obtained,Max Marks,Percentage,Status,Completion Time (s)\n';

    results.forEach(r => {
      const studentName = (r.student?.user?.name || '').replace(/,/g, ' ');
      const studentId = r.student?.student_id || '';
      const email = r.student?.user?.email || '';
      const className = (r.student?.class?.name || '').replace(/,/g, ' ');
      const batchName = (r.student?.batch?.name || '').replace(/,/g, ' ');
      const statusStr = r.is_passed ? 'PASSED' : 'FAILED';

      csv += `${r.rank || 'N/A'},"${studentName}",${studentId},${email},"${className}","${batchName}",${r.total_questions},${r.attempted_questions},${r.correct_answers},${r.wrong_answers},${r.unattempted_questions},${r.total_marks_obtained},${r.max_marks},${r.percentage}%,${statusStr},${r.completion_time_seconds || 0}\n`;
    });

    const safeTitle = exam.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_Results.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Student's Own Results History (Student Portal)
 */
const getMyResults = async (req, res, next) => {
  try {
    const studentUser = req.user;

    const student = await Student.findOne({ where: { user_id: studentUser.id } });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student academic profile not found.' });
    }

    const results = await ExamResult.findAll({
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
      order: [['calculated_at', 'DESC']]
    });

    const formatted = results.map(r => {
      const isPublished = !!r.exam?.results_published;

      return {
        resultId: r.id,
        examId: r.exam?.id,
        examTitle: r.exam?.title,
        subject: r.exam?.subject?.name,
        subjectCode: r.exam?.subject?.code,
        examDate: r.exam?.exam_date,
        totalQuestions: r.total_questions,
        totalMarks: r.max_marks,
        calculatedAt: r.calculated_at,
        resultsPublished: isPublished,
        // Shield rank and scores if results not yet published by institution
        scorecard: isPublished ? {
          attempted: r.attempted_questions,
          correct: r.correct_answers,
          wrong: r.wrong_answers,
          unattempted: r.unattempted_questions,
          marksObtained: parseFloat(r.total_marks_obtained),
          maxMarks: parseFloat(r.max_marks),
          percentage: parseFloat(r.percentage),
          rank: r.rank,
          isPassed: r.is_passed,
          completionSeconds: r.completion_time_seconds
        } : null
      };
    });

    return res.status(200).json({
      success: true,
      results: formatted
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getResults,
  getExamLeaderboard,
  togglePublishResults,
  recalculateRanks,
  getIndividualScorecard,
  exportResultsCsv,
  getMyResults
};
