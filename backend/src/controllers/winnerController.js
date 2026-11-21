const { Winner, Prize, Exam, Student, User, Class, Batch } = require('../models');
const { calculateAndPersistWinners, getExamWinnersData } = require('../services/winnerService');
const { recordAuditLog } = require('../middleware/auditLogger');
const logger = require('../utils/logger');

/**
 * Get Top 3 Winners and Prizes for an Exam
 */
const getWinners = async (req, res, next) => {
  try {
    const { examId } = req.params;
    let data = await getExamWinnersData(examId);

    // If no winners yet, attempt calculation
    if (!data || data.winners.length === 0) {
      data = await calculateAndPersistWinners(examId);
    }

    return res.status(200).json({
      success: true,
      ...data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Manually Recalculate Top 3 Winners (Admin)
 */
const calculateWinners = async (req, res, next) => {
  try {
    const { examId } = req.params;
    const data = await calculateAndPersistWinners(examId);

    return res.status(200).json({
      success: true,
      message: 'Top 3 winners successfully recalculated based on current scores and tie-breakers.',
      ...data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Cash Prizes and Titles for an Exam (Admin)
 */
const updatePrizes = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const { examId } = req.params;
    const { prizes } = req.body; // Array of { position: 1|2|3, title, cash_amount, is_distributed }

    if (!Array.isArray(prizes)) {
      return res.status(400).json({ success: false, message: 'Prizes payload must be an array.' });
    }

    const exam = await Exam.findByPk(examId);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found.' });

    for (const p of prizes) {
      const pos = parseInt(p.position, 10);
      if (![1, 2, 3].includes(pos)) continue;

      const [prizeRecord, created] = await Prize.findOrCreate({
        where: { exam_id: examId, position: pos },
        defaults: {
          institution_id: institutionId,
          exam_id: examId,
          position: pos,
          title: p.title || `Position ${pos} Award`,
          cash_amount: parseFloat(p.cash_amount || 0),
          is_distributed: !!p.is_distributed
        }
      });

      if (!created) {
        if (p.title !== undefined) prizeRecord.title = p.title;
        if (p.cash_amount !== undefined) prizeRecord.cash_amount = parseFloat(p.cash_amount);
        if (p.is_distributed !== undefined) prizeRecord.is_distributed = !!p.is_distributed;
        await prizeRecord.save();
      }
    }

    await recordAuditLog({
      req,
      action: 'UPDATE_EXAM_PRIZES',
      entity_type: 'Exam',
      entity_id: examId,
      details: { exam_title: exam.title, prizes_count: prizes.length }
    });

    const updatedData = await getExamWinnersData(examId);

    return res.status(200).json({
      success: true,
      message: 'Examination prizes successfully updated.',
      ...updatedData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin-Controlled Announcement of Top 3 Winners (Section 12)
 * Broadcasts via Socket.IO and updates announcement status.
 */
const announceWinners = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const { examId } = req.params;

    const exam = await Exam.findByPk(examId);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found.' });

    let winnersData = await getExamWinnersData(examId);
    if (!winnersData || winnersData.winners.length === 0) {
      winnersData = await calculateAndPersistWinners(examId);
    }

    if (!winnersData || winnersData.winners.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No candidate submissions found to determine winners.'
      });
    }

    const now = new Date();
    await Winner.update(
      { announced: true, announced_at: now },
      { where: { exam_id: examId } }
    );

    // Refresh data
    winnersData = await getExamWinnersData(examId);

    // Broadcast live event via Socket.IO to all students and dashboards
    const io = req.app.get('io');
    if (io) {
      io.to(`exam_${examId}`).emit('winners_announced', {
        examId: exam.id,
        examTitle: exam.title,
        announcedAt: now.toISOString(),
        winners: winnersData.winners,
        prizes: winnersData.prizes
      });

      io.emit('global_winner_announcement', {
        examId: exam.id,
        examTitle: exam.title,
        announcedAt: now.toISOString(),
        winners: winnersData.winners
      });
    }

    await recordAuditLog({
      req,
      action: 'ANNOUNCE_EXAM_WINNERS',
      entity_type: 'Exam',
      entity_id: examId,
      details: {
        exam_id: exam.id,
        exam_title: exam.title,
        winners: winnersData.winners.map(w => ({ pos: w.position, name: w.studentName, score: w.marksObtained }))
      }
    });

    return res.status(200).json({
      success: true,
      message: `Top 3 winners for "${exam.title}" officially announced to all candidates!`,
      announcedAt: now.toISOString(),
      ...winnersData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Winner History across Examinations
 */
const getWinnerHistory = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;

    const winners = await Winner.findAll({
      where: { institution_id: institutionId, announced: true },
      include: [
        {
          model: Exam,
          as: 'exam',
          attributes: ['id', 'title', 'exam_date', 'total_marks']
        },
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
        ['announced_at', 'DESC'],
        ['exam_id', 'DESC'],
        ['position', 'ASC']
      ]
    });

    return res.status(200).json({
      success: true,
      count: winners.length,
      history: winners
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWinners,
  calculateWinners,
  updatePrizes,
  announceWinners,
  getWinnerHistory
};
