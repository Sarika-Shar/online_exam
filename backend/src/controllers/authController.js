const { Op } = require('sequelize');
const { User, Institution } = require('../models');
const { generateToken } = require('../utils/token');
const { recordAuditLog } = require('../middleware/auditLogger');
const bcrypt = require('bcryptjs');

/**
 * Login user (Super Admin, Institution Admin, Teacher, Student)
 */
const login = async (req, res, next) => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username/Email and password are required.'
      });
    }

    // Search user by email or username
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: usernameOrEmail.trim().toLowerCase() },
          { username: usernameOrEmail.trim() }
        ]
      },
      include: [{ model: Institution, as: 'institution' }]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Password incorrect.'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact administrator.'
      });
    }

    if (user.institution && !user.institution.is_active && user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Your institution account has been suspended.'
      });
    }

    // Update last login
    user.last_login_at = new Date();
    await user.save();

    // Generate JWT
    const token = generateToken(user);

    // Record audit log
    await recordAuditLog({
      institution_id: user.institution_id,
      user_id: user.id,
      action: 'USER_LOGIN',
      entity_type: 'User',
      entity_id: user.id,
      details: { role: user.role, email: user.email },
      req
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        institution_id: user.institution_id,
        avatar: user.avatar,
        institution: user.institution ? {
          id: user.institution.id,
          name: user.institution.name,
          code: user.institution.code,
          logo_url: user.institution.logo_url
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: Institution, as: 'institution' }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    return res.status(200).json({
      success: true,
      user: user.toSafeObject()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.'
      });
    }

    const user = await User.findByPk(req.user.id);
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password does not match.'
      });
    }

    user.password_hash = newPassword;
    await user.save();

    await recordAuditLog({
      req,
      action: 'PASSWORD_CHANGE',
      entity_type: 'User',
      entity_id: user.id,
      details: { message: 'Password updated successfully' }
    });

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  getMe,
  changePassword
};
