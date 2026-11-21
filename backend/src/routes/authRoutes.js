const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// Public auth routes
router.post('/login', authLimiter, authController.login);

// Protected auth routes
router.get('/me', authenticate, authController.getMe);
router.post('/change-password', authenticate, authController.changePassword);

module.exports = router;
