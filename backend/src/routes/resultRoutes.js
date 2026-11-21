const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const requireInstitution = require('../middleware/institution');

// 1. Student's own results history
router.get(
  '/my-results',
  authenticate,
  authorize('student'),
  requireInstitution,
  resultController.getMyResults
);

// 2. Exam Leaderboard (Accessible to Admins & Teachers, and to Students if published)
router.get(
  '/exam/:examId',
  authenticate,
  requireInstitution,
  resultController.getExamLeaderboard
);

// 3. Detailed Individual Scorecard & Question Breakdown
router.get(
  '/:resultId/scorecard',
  authenticate,
  requireInstitution,
  resultController.getIndividualScorecard
);

// 4. Admin Paginated Results with Filters
router.get(
  '/',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  resultController.getResults
);

// 5. Toggle Publish / Hide Results (Admin)
router.patch(
  '/exam/:examId/publish',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  resultController.togglePublishResults
);

// 6. Recalculate Ranks with Tie-Breaker
router.post(
  '/exam/:examId/recalculate-ranks',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  resultController.recalculateRanks
);

// 7. Export Results as CSV
router.get(
  '/exam/:examId/export',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  resultController.exportResultsCsv
);

module.exports = router;
