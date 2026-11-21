const express = require('express');
const router = express.Router();
const liveMonitorController = require('../controllers/liveMonitorController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const requireInstitution = require('../middleware/institution');

// Guard all live monitor routes for administrative proctors and faculty
router.use(authenticate);
router.use(authorize('super_admin', 'institution_admin', 'examiner', 'teacher'));
router.use(requireInstitution);

// Telemetry & Status
router.get('/exam/:examId', liveMonitorController.getLiveExamStatus);

// Active Candidate Remote Interventions
router.post('/attempt/:attemptId/extend-time', liveMonitorController.extendCandidateTime);
router.post('/attempt/:attemptId/pause', liveMonitorController.pauseCandidateAttempt);
router.post('/attempt/:attemptId/resume', liveMonitorController.resumeCandidateAttempt);
router.post('/attempt/:attemptId/warning', liveMonitorController.sendCandidateWarning);
router.post('/attempt/:attemptId/force-submit', liveMonitorController.forceSubmitAttempt);

// Cohort Wide Announcement Broadcast
router.post('/exam/:examId/broadcast', liveMonitorController.broadcastExamAnnouncement);

module.exports = router;
