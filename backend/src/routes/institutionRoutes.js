const express = require('express');
const router = express.Router();
const institutionController = require('../controllers/institutionController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');

// Super admin routes
router.get('/', authenticate, authorize('super_admin'), institutionController.getAllInstitutions);
router.post('/', authenticate, authorize('super_admin'), institutionController.createInstitution);
router.put('/:id', authenticate, authorize('super_admin'), institutionController.updateInstitution);

// Current institution details
router.get('/current', authenticate, institutionController.getInstitutionById);
router.get('/:id', authenticate, institutionController.getInstitutionById);

module.exports = router;
