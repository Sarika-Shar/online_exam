const { Winner, Prize, ExamResult, Student, User, Exam, Institution } = require('../models');
const { recomputeExamRanks } = require('./rankingService');
const logger = require('../utils/logger');

/**
 * Automatically calculates and persists Top 3 winners for an examination.
 * Applies tie-breakers: Highest Marks -> Lowest Duration -> Earliest Submission.
 *
 * @param {number} examId - Examination ID
 * @returns {Promise<Array>} List of top 3 winners with student details and prizes
 */
const calculateAndPersistWinners = async (examId) => {
  try {
    const exam = await Exam.findByPk(examId);
    if (!exam) throw new Error(`Exam with ID ${examId} not found.`);

    // 1. Ensure ranks are freshly calculated with tie-breakers
    const rankedResults = await recomputeExamRanks(examId);
    if (rankedResults.length === 0) {
      return [];
    }

    // 2. Select top 3 candidates
    const top3Results = rankedResults.slice(0, 3);

    // 3. Ensure default prize entries exist for this exam if none yet
    const existingPrizes = await Prize.findAll({ where: { exam_id: examId } });
    if (existingPrizes.length === 0) {
      const defaultPrizes = [
        { position: 1, title: 'First Place Gold Trophy', cash_amount: 500.00 },
        { position: 2, title: 'Second Place Silver Trophy', cash_amount: 300.00 },
        { position: 3, title: 'Third Place Bronze Medal', cash_amount: 150.00 }
      ];

      for (const p of defaultPrizes) {
        await Prize.create({
          institution_id: exam.institution_id,
          exam_id: exam.id,
          position: p.position,
          title: p.title,
          cash_amount: p.cash_amount,
          is_distributed: false
        });
      }
    }

    // 4. Upsert Winners records for positions 1, 2, 3
    const winnersList = [];
    for (let i = 0; i < top3Results.length; i++) {
      const res = top3Results[i];
      const pos = i + 1;

      const [winnerRecord, created] = await Winner.findOrCreate({
        where: { exam_id: examId, position: pos },
        defaults: {
          institution_id: exam.institution_id,
          exam_id: examId,
          student_id: res.student_id,
          position: pos,
          marks_obtained: res.total_marks_obtained,
          completion_time_seconds: res.completion_time_seconds || 0,
          announced: false
        }
      });

      if (!created) {
        winnerRecord.student_id = res.student_id;
        winnerRecord.marks_obtained = res.total_marks_obtained;
        winnerRecord.completion_time_seconds = res.completion_time_seconds || 0;
        await winnerRecord.save();
      }

      winnersList.push(winnerRecord);
    }

    logger.info(`[WinnerService] Top ${winnersList.length} winners calculated for exam ${examId}.`);
    return getExamWinnersData(examId);
  } catch (error) {
    logger.error(`[WinnerService] Error calculating winners for exam ${examId}:`, error);
    throw error;
  }
};

/**
 * Retrieves full winner podium data, prizes, and announcement status.
 * @param {number} examId - Examination ID
 * @returns {Promise<object>}
 */
const getExamWinnersData = async (examId) => {
  const exam = await Exam.findByPk(examId, {
    attributes: ['id', 'title', 'total_marks', 'passing_percentage', 'results_published']
  });
  if (!exam) return null;

  const winners = await Winner.findAll({
    where: { exam_id: examId },
    include: [
      {
        model: Student,
        as: 'student',
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }]
      }
    ],
    order: [['position', 'ASC']]
  });

  const prizes = await Prize.findAll({
    where: { exam_id: examId },
    order: [['position', 'ASC']]
  });

  const prizeMap = new Map();
  prizes.forEach(p => prizeMap.set(p.position, p));

  const formattedWinners = winners.map(w => {
    const prize = prizeMap.get(w.position);
    return {
      id: w.id,
      position: w.position,
      studentId: w.student?.student_id,
      studentName: w.student?.user?.name,
      studentEmail: w.student?.user?.email,
      marksObtained: parseFloat(w.marks_obtained),
      completionSeconds: w.completion_time_seconds,
      announced: w.announced,
      announcedAt: w.announced_at,
      prize: prize ? {
        id: prize.id,
        title: prize.title,
        cashAmount: parseFloat(prize.cash_amount),
        isDistributed: prize.is_distributed
      } : null
    };
  });

  const isAnnounced = winners.length > 0 && winners.every(w => w.announced);

  return {
    exam,
    isAnnounced,
    announcedAt: winners[0]?.announced_at || null,
    winners: formattedWinners,
    prizes
  };
};

module.exports = {
  calculateAndPersistWinners,
  getExamWinnersData
};
