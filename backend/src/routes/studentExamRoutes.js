const express = require('express');
const router = express.Router();
const studentExamController = require('../controllers/studentExamController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const requireInstitution = require('../middleware/institution');

// Student Portal & Exam Interface Routes
router.get(
  '/exams',
  authenticate,
  authorize('student'),
  requireInstitution,
  studentExamController.getStudentExams
);

router.get(
  '/exams/:id/instructions',
  authenticate,
  authorize('student'),
  requireInstitution,
  studentExamController.getExamInstructions
);

router.post(
  '/exams/:id/start',
  authenticate,
  authorize('student'),
  requireInstitution,
  studentExamController.startOrResumeExam
);

router.post(
  '/exams/:id/save-answer',
  authenticate,
  authorize('student'),
  requireInstitution,
  studentExamController.saveAnswer
);

router.get(
  '/exams/:id/timer-sync',
  authenticate,
  authorize('student'),
  requireInstitution,
  studentExamController.getTimerSync
);

router.post(
  '/exams/:id/sync-offline-answers',
  authenticate,
  authorize('student'),
  requireInstitution,
  studentExamController.syncOfflineAnswers
);

router.post(
  '/exams/:id/submit',
  authenticate,
  authorize('student'),
  requireInstitution,
  studentExamController.submitExam
);

module.exports = router;
