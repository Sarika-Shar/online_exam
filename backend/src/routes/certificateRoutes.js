const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const requireInstitution = require('../middleware/institution');

// Public Certificate Verification Endpoint (No auth required)
router.get('/verify/:certificateUuid', certificateController.verifyCertificate);

// Download Certificate PDF (Public or authenticated)
router.get('/download/:certificateUuid', certificateController.downloadCertificate);

// Candidate's Own Certificates (Student Portal)
router.get(
  '/my-certificates',
  authenticate,
  authorize('student'),
  requireInstitution,
  certificateController.getMyCertificates
);

// Admin: Get paginated certificates list
router.get(
  '/',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  certificateController.getCertificates
);

// Admin: Generate certificates in bulk for an exam
router.post(
  '/generate/:examId',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  certificateController.generateCertificates
);

module.exports = router;
