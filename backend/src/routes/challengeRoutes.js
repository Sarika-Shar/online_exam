const express = require('express');
const router = express.Router();
const challengeController = require('../controllers/challengeController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const requireInstitution = require('../middleware/institution');

// Student endpoints
router.post(
  '/submit',
  authenticate,
  authorize('student'),
  challengeController.submitChallenge
);

router.get(
  '/my-challenges',
  authenticate,
  authorize('student'),
  challengeController.getMyChallenges
);

// Admin & Faculty Review endpoints
router.get(
  '/exam/:examId',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  challengeController.getExamChallenges
);

router.post(
  '/exam/:examId/resolve-question/:questionId',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  challengeController.resolveQuestionChallenges
);

module.exports = router;
