const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const requireInstitution = require('../middleware/institution');

// Admin, Super Admin, and Teacher roles
router.use(authenticate);
router.use(authorize('super_admin', 'institution_admin', 'teacher'));
router.use(requireInstitution);

router.get('/exam/:examId/item-analysis', analyticsController.getExamItemAnalysis);
router.get('/exam/:examId/cohort', analyticsController.getExamCohortAnalytics);

module.exports = router;
