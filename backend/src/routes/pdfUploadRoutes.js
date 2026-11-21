const express = require('express');
const router = express.Router();
const pdfUploadController = require('../controllers/pdfUploadController');
const uploadPdf = require('../middleware/upload');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const requireInstitution = require('../middleware/institution');

// Upload PDF and extract MCQs (Text-based or OCR)
router.post(
  '/extract',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  uploadPdf.single('pdfFile'),
  pdfUploadController.uploadAndExtract
);

// Approve, edit, and save extracted questions into MySQL
router.post(
  '/approve',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  pdfUploadController.approveAndSaveQuestions
);

// Get historical PDF uploads
router.get(
  '/history',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  pdfUploadController.getPdfUploads
);

module.exports = router;
