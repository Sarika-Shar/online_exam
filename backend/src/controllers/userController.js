const { Op } = require('sequelize');
const { User, Institution } = require('../models');
const { recordAuditLog } = require('../middleware/auditLogger');

/**
 * List users of an institution (or all for Super Admin)
 */
const getUsers = async (req, res, next) => {
  try {
    const institutionId = req.targetInstitutionId;
    const { role, search } = req.query;
    const filter = institutionId ? { institution_id: institutionId } : {};

    if (role) {
      filter.role = role;
    }

    if (search && search.trim()) {
      filter[Op.or] = [
        { name: { [Op.like]: `%${search.trim()}%` } },
        { email: { [Op.like]: `%${search.trim()}%` } },
        { username: { [Op.like]: `%${search.trim()}%` } }
      ];
    }

    const users = await User.findAll({
      where: filter,
      attributes: { exclude: ['password_hash'] },
      include: [{ model: Institution, as: 'institution', attributes: ['id', 'name', 'code'] }],
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new user (Institution Admin or Teacher)
 */
const createUser = async (req, res, next) => {
  try {
    const { name, email, username, password, role, phone, institution_id } = req.body;

    if (!name || !email || !username || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, username, password, and role are required.'
      });
    }

    // Determine target institution
    let targetInstId = req.targetInstitutionId;
    if (req.user.role === 'super_admin' && institution_id) {
      targetInstId = institution_id;
    }

    if (role !== 'super_admin' && !targetInstId) {
      return res.status(400).json({
        success: false,
        message: 'An institution ID must be assigned to this user.'
      });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists.'
      });
    }

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username is already taken.'
      });
    }

    const user = await User.create({
      institution_id: role === 'super_admin' ? null : targetInstId,
      name,
      email,
      username,
      password_hash: password,
      role,
      phone,
      is_active: true
    });

    await recordAuditLog({
      req,
      action: 'CREATE_USER',
      entity_type: 'User',
      entity_id: user.id,
      details: { role: user.role, email: user.email }
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: user.toSafeObject()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle user active/inactive status
 */
const toggleUserStatus = async (req, res, next) => {
  try {
    const id = req.params.id;
    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Tenant check
    if (req.user.role !== 'super_admin' && user.institution_id !== req.user.institution_id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Cannot modify users of another institution.'
      });
    }

    user.is_active = !user.is_active;
    await user.save();

    await recordAuditLog({
      req,
      action: user.is_active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      entity_type: 'User',
      entity_id: user.id,
      details: { is_active: user.is_active }
    });

    return res.status(200).json({
      success: true,
      message: `User ${user.is_active ? 'activated' : 'deactivated'} successfully.`,
      data: user.toSafeObject()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user details
 */
const updateUser = async (req, res, next) => {
  try {
    const id = req.params.id;
    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (req.user.role !== 'super_admin' && user.institution_id !== req.user.institution_id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Cannot modify users of another institution.'
      });
    }

    const { name, email, username, password, phone, role } = req.body;

    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail && existingEmail.id !== user.id) {
        return res.status(400).json({ success: false, message: 'Email is already taken by another account.' });
      }
      user.email = email;
    }

    if (username && username !== user.username) {
      const existingUsername = await User.findOne({ where: { username } });
      if (existingUsername && existingUsername.id !== user.id) {
        return res.status(400).json({ success: false, message: 'Username is already taken by another account.' });
      }
      user.username = username;
    }

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (role && ['teacher', 'institution_admin'].includes(role)) {
      user.role = role;
    }
    if (password && password.trim().length >= 6) {
      user.password_hash = password.trim();
    }

    await user.save();

    await recordAuditLog({
      req,
      action: 'UPDATE_USER',
      entity_type: 'User',
      entity_id: user.id,
      details: { role: user.role, email: user.email }
    });

    return res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      data: user.toSafeObject()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user
 */
const deleteUser = async (req, res, next) => {
  try {
    const id = req.params.id;
    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (req.user.role !== 'super_admin' && user.institution_id !== req.user.institution_id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Cannot delete users of another institution.'
      });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own logged-in account.'
      });
    }

    const userDetails = { role: user.role, email: user.email, name: user.name };
    await user.destroy();

    await recordAuditLog({
      req,
      action: 'DELETE_USER',
      entity_type: 'User',
      entity_id: id,
      details: userDetails
    });

    return res.status(200).json({
      success: true,
      message: 'User removed successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus
};
