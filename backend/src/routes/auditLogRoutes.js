const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLogController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const requireInstitution = require('../middleware/institution');

// Admin & Super Admin only
router.get(
  '/',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  auditLogController.getAuditLogs
);

router.get(
  '/actions',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  auditLogController.getAuditActionsAndStats
);

module.exports = router;
