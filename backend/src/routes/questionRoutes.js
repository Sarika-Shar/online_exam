const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const requireInstitution = require('../middleware/institution');

// Question Bank Statistics & Topics (must come before /:id)
router.get(
  '/stats',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  questionController.getQuestionStats
);

router.get(
  '/topics',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  questionController.getTopicsBySubject
);

// Bulk Actions
router.post(
  '/bulk-delete',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  questionController.bulkDeleteQuestions
);

// CRUD Question Operations
router.get(
  '/',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  questionController.getQuestions
);

router.post(
  '/',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  questionController.createQuestion
);

router.get(
  '/:id',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  questionController.getQuestionById
);

router.put(
  '/:id',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  questionController.updateQuestion
);

router.delete(
  '/:id',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  questionController.deleteQuestion
);

module.exports = router;
