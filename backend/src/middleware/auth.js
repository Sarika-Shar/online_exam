const { verifyToken } = require('../utils/token');
const { User, Institution } = require('../models');

/**
 * Authentication middleware to verify JWT and attach user context
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token missing or invalid format. Please log in.'
      });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Session expired or token invalid. Please log in again.'
      });
    }

    const user = await User.findByPk(decoded.id, {
      include: [{ model: Institution, as: 'institution' }]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found.'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Please contact your administrator.'
      });
    }

    if (user.institution && !user.institution.is_active && user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Institution account is currently suspended.'
      });
    }

    // Attach user information to request
    req.user = user;
    req.role = user.role;
    req.institutionId = user.institution_id;

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal authentication error',
      error: error.message
    });
  }
};

module.exports = authenticate;
