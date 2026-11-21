const { Op } = require('sequelize');
const { sequelize, AuditLog, User, Institution } = require('../models');

/**
 * Get paginated audit logs with search and filters (Admin)
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const {
      action,
      user_id,
      entity_type,
      search,
      start_date,
      end_date,
      page = 1,
      limit = 25
    } = req.query;

    const whereClause = {};
    if (institutionId) {
      whereClause[Op.or] = [
        { institution_id: institutionId },
        { institution_id: null }
      ];
    }

    if (action) whereClause.action = action;
    if (user_id) whereClause.user_id = user_id;
    if (entity_type) whereClause.entity_type = entity_type;

    if (start_date && end_date) {
      whereClause.created_at = {
        [Op.between]: [new Date(start_date), new Date(end_date)]
      };
    } else if (start_date) {
      whereClause.created_at = { [Op.gte]: new Date(start_date) };
    } else if (end_date) {
      whereClause.created_at = { [Op.lte]: new Date(end_date) };
    }

    // User search condition
    const userWhere = {};
    if (search) {
      userWhere[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { username: { [Op.like]: `%${search}%` } }
      ];
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { count, rows } = await AuditLog.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'role', 'username'],
          where: Object.keys(userWhere).length > 0 ? userWhere : undefined
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset
    });

    return res.status(200).json({
      success: true,
      total: count,
      page: parseInt(page, 10),
      totalPages: Math.ceil(count / parseInt(limit, 10)),
      logs: rows
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get distinct actions and statistics for audit filter dropdowns
 */
const getAuditActionsAndStats = async (req, res, next) => {
  try {
    const institutionId = req.institutionId;
    const whereClause = institutionId ? { institution_id: institutionId } : {};

    const actions = await AuditLog.findAll({
      where: whereClause,
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('action')), 'action']],
      order: [['action', 'ASC']]
    });

    const totalLogs = await AuditLog.count({ where: whereClause });

    return res.status(200).json({
      success: true,
      totalLogs,
      actions: actions.map(a => a.action).filter(Boolean)
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs,
  getAuditActionsAndStats
};
