const { Op } = require('sequelize');
const { ExamAttempt, Exam } = require('../models');
const { evaluateAndFinalizeAttempt } = require('../services/examEvaluationService');
const logger = require('../utils/logger');

let expiryIntervalId = null;
let isSweeping = false;

/**
 * Sweep database for all expired in-progress exam attempts and auto-submit them.
 * @param {object} io - Socket.IO instance for real-time alerts
 * @returns {Promise<object>} Sweeping metrics
 */
const sweepExpiredExamAttempts = async (io = null) => {
  if (isSweeping) {
    logger.debug('Exam expiry sweep already in progress. Skipping this cycle.');
    return { skipped: true };
  }

  isSweeping = true;
  const now = new Date();

  try {
    // Find all in-progress attempts whose server_expiry_time has passed
    const expiredAttempts = await ExamAttempt.findAll({
      where: {
        status: 'in_progress',
        server_expiry_time: {
          [Op.lte]: now
        }
      },
      attributes: ['id', 'exam_id', 'student_id', 'server_expiry_time'],
      limit: 100 // Process in batches of 100 to prevent event loop blocking
    });

    if (expiredAttempts.length === 0) {
      isSweeping = false;
      return { processed: 0 };
    }

    logger.info(`[ExamExpiryJob] Found ${expiredAttempts.length} expired in-progress attempt(s). Auto-submitting...`);

    let processedCount = 0;
    let failedCount = 0;

    for (const attempt of expiredAttempts) {
      try {
        await evaluateAndFinalizeAttempt(attempt.id, 'auto', { io });
        processedCount++;
      } catch (err) {
        failedCount++;
        logger.error(`[ExamExpiryJob] Failed to auto-submit attempt ${attempt.id}:`, err.message);
      }
    }

    logger.info(`[ExamExpiryJob] Sweep completed: ${processedCount} auto-submitted, ${failedCount} failed.`);
    isSweeping = false;

    return {
      processed: processedCount,
      failed: failedCount,
      total: expiredAttempts.length
    };
  } catch (error) {
    isSweeping = false;
    logger.error('[ExamExpiryJob] Error running expired attempt sweep:', error);
    return { error: error.message };
  }
};

/**
 * Start the recurring background worker
 * @param {object} io - Socket.IO instance
 * @param {number} intervalMs - Polling interval in ms (default: 30 seconds)
 */
const startExpiryJob = (io, intervalMs = 30000) => {
  if (expiryIntervalId) {
    clearInterval(expiryIntervalId);
  }

  logger.info(`[ExamExpiryJob] Starting background exam expiry worker (Interval: ${intervalMs / 1000}s)`);

  // Run initial sweep on boot
  sweepExpiredExamAttempts(io).catch(err => {
    logger.error('[ExamExpiryJob] Initial sweep error:', err);
  });

  // Start periodic interval
  expiryIntervalId = setInterval(() => {
    sweepExpiredExamAttempts(io).catch(err => {
      logger.error('[ExamExpiryJob] Interval sweep error:', err);
    });
  }, intervalMs);

  return expiryIntervalId;
};

/**
 * Stop the recurring background worker (for clean testing or server shutdown)
 */
const stopExpiryJob = () => {
  if (expiryIntervalId) {
    clearInterval(expiryIntervalId);
    expiryIntervalId = null;
    logger.info('[ExamExpiryJob] Background exam expiry worker stopped.');
  }
};

module.exports = {
  sweepExpiredExamAttempts,
  startExpiryJob,
  stopExpiryJob
};
