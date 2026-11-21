const { ExamResult, Student, User, Exam } = require('../models');
const logger = require('../utils/logger');

/**
 * Recomputes dynamic rankings and tie-breakers for all completed attempts in an exam.
 * Tie-Breaker Hierarchy:
 * 1. Total Marks Obtained (DESC) - highest score gets higher rank.
 * 2. Completion Time (ASC) - candidate who finished faster gets higher rank.
 * 3. Submission / Calculation Timestamp (ASC) - earliest timestamp breaks remaining tie.
 *
 * @param {number} examId - Target Examination ID
 * @param {object} transaction - Optional Sequelize transaction
 * @returns {Promise<Array>} Ranked results list
 */
const recomputeExamRanks = async (examId, transaction = null) => {
  try {
    const results = await ExamResult.findAll({
      where: { exam_id: examId },
      include: [
        {
          model: Student,
          as: 'student',
          include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }]
        }
      ],
      order: [
        ['total_marks_obtained', 'DESC'],
        ['completion_time_seconds', 'ASC'],
        ['calculated_at', 'ASC']
      ],
      transaction
    });

    if (results.length === 0) {
      return [];
    }

    // Assign sequential ranks 1 to N
    for (let i = 0; i < results.length; i++) {
      const newRank = i + 1;
      const res = results[i];

      if (res.rank !== newRank) {
        res.rank = newRank;
        await res.save({ transaction });
      }
    }

    logger.info(`[RankingService] Successfully recomputed ranks for exam ${examId} (${results.length} candidates ranked).`);
    return results;
  } catch (error) {
    logger.error(`[RankingService] Error computing ranks for exam ${examId}:`, error);
    throw error;
  }
};

/**
 * Calculates aggregate statistics for an exam (average, highest, pass rate).
 * @param {number} examId - Examination ID
 * @returns {Promise<object>} Aggregate statistics
 */
const getExamResultMetrics = async (examId) => {
  const results = await ExamResult.findAll({
    where: { exam_id: examId }
  });

  const totalAppeared = results.length;
  if (totalAppeared === 0) {
    return {
      totalAppeared: 0,
      passedCount: 0,
      failedCount: 0,
      passPercentage: 0,
      averageMarks: 0,
      highestMarks: 0,
      lowestMarks: 0
    };
  }

  let totalMarks = 0;
  let highestMarks = 0;
  let lowestMarks = Infinity;
  let passedCount = 0;

  results.forEach(r => {
    const marks = parseFloat(r.total_marks_obtained) || 0;
    totalMarks += marks;
    if (marks > highestMarks) highestMarks = marks;
    if (marks < lowestMarks) lowestMarks = marks;
    if (r.is_passed) passedCount++;
  });

  if (lowestMarks === Infinity) lowestMarks = 0;

  const failedCount = totalAppeared - passedCount;
  const passPercentage = parseFloat(((passedCount / totalAppeared) * 100).toFixed(2));
  const averageMarks = parseFloat((totalMarks / totalAppeared).toFixed(2));

  return {
    totalAppeared,
    passedCount,
    failedCount,
    passPercentage,
    averageMarks,
    highestMarks: parseFloat(highestMarks.toFixed(2)),
    lowestMarks: parseFloat(lowestMarks.toFixed(2))
  };
};

module.exports = {
  recomputeExamRanks,
  getExamResultMetrics
};
