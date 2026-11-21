const express = require('express');
const router = express.Router();
const proctorController = require('../controllers/proctorController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const requireInstitution = require('../middleware/institution');

// Candidate snapshot upload (Students, Admins, Teachers)
router.post(
  '/snapshot',
  authenticate,
  authorize('student', 'super_admin', 'institution_admin', 'teacher'),
  proctorController.uploadSnapshot
);

// Admin / Proctor evidence review endpoints
router.get(
  '/attempt/:attemptId/evidence',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  proctorController.getAttemptEvidence
);

router.post(
  '/attempt/:attemptId/verdict',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  proctorController.submitProctorVerdict
);

router.get(
  '/exam/:examId/integrity-overview',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  proctorController.getExamIntegrityOverview
);

module.exports = router;
