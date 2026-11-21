const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const requireInstitution = require('../middleware/institution');

// Exam Management Routes
router.get(
  '/',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  examController.getExams
);

router.post(
  '/',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  examController.createExam
);

router.get(
  '/:id',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  examController.getExamById
);

router.put(
  '/:id',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  examController.updateExam
);

router.patch(
  '/:id/status',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  examController.updateExamStatus
);

router.delete(
  '/:id',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  examController.deleteExam
);

module.exports = router;
