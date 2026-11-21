const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const requireInstitution = require('../middleware/institution');

// List users for institution
router.get(
  '/',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  userController.getUsers
);

// Create user
router.post(
  '/',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  userController.createUser
);

// Update user
router.put(
  '/:id',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  userController.updateUser
);

// Delete user
router.delete(
  '/:id',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  userController.deleteUser
);

// Toggle user status
router.patch(
  '/:id/toggle-status',
  authenticate,
  authorize('super_admin', 'institution_admin'),
  requireInstitution,
  userController.toggleUserStatus
);

module.exports = router;
