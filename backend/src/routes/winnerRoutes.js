const express = require('express');
const router = express.Router();
const winnerController = require('../controllers/winnerController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const requireInstitution = require('../middleware/institution');

// Winner history across examinations (Public or authenticated)
router.get(
  '/history',
  authenticate,
  requireInstitution,
  winnerController.getWinnerHistory
);

// Get winners and podium for an exam
router.get(
  '/exam/:examId',
  authenticate,
  requireInstitution,
  winnerController.getWinners
);

// Manually recalculate Top 3 winners (Admin)
router.post(
  '/exam/:examId/calculate',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  winnerController.calculateWinners
);

// Update prizes (Admin)
router.put(
  '/exam/:examId/prizes',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  winnerController.updatePrizes
);

// Officially announce winners with Socket.IO broadcast (Admin)
router.post(
  '/exam/:examId/announce',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  winnerController.announceWinners
);

module.exports = router;
