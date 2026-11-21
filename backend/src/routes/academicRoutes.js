const express = require('express');
const router = express.Router();
const academicController = require('../controllers/academicController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const requireInstitution = require('../middleware/institution');

// =======================
// SUBJECT ROUTES
// =======================
router.get(
  '/subjects',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  academicController.getSubjects
);

router.post(
  '/subjects',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  academicController.createSubject
);

router.put(
  '/subjects/:id',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  academicController.updateSubject
);

router.delete(
  '/subjects/:id',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  academicController.deleteSubject
);

router.patch(
  '/subjects/:id/toggle-status',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  academicController.toggleSubjectStatus
);

// =======================
// CLASS ROUTES
// =======================
router.get(
  '/classes',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  academicController.getClasses
);

router.post(
  '/classes',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  academicController.createClass
);

router.put(
  '/classes/:id',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  academicController.updateClass
);

router.delete(
  '/classes/:id',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  academicController.deleteClass
);

router.patch(
  '/classes/:id/toggle-status',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  academicController.toggleClassStatus
);

// =======================
// BATCH ROUTES
// =======================
router.get(
  '/batches',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  academicController.getBatches
);

router.post(
  '/batches',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  academicController.createBatch
);

router.put(
  '/batches/:id',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  academicController.updateBatch
);

router.delete(
  '/batches/:id',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  academicController.deleteBatch
);

router.patch(
  '/batches/:id/toggle-status',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  academicController.toggleBatchStatus
);

// =======================
// QUESTION BANKS
// =======================
router.get(
  '/question-banks',
  authenticate,
  authorize('super_admin', 'institution_admin', 'teacher'),
  requireInstitution,
  academicController.getQuestionBanks
);

module.exports = router;
