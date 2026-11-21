const { AuditLog } = require('../models');
const logger = require('../utils/logger');

/**
 * Log an action to the audit trail
 */
const recordAuditLog = async ({
  institution_id = null,
  institutionId = null,
  user_id = null,
  userId = null,
  action,
  entity_type = null,
  entityType = null,
  entity_id = null,
  entityId = null,
  details = null,
  req = null
}) => {
  try {
    const ip_address = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '') : null;
    const user_agent = req ? (req.headers['user-agent'] || '') : null;
    const finalInstId = institution_id || institutionId || (req && req.institutionId) || null;
    const finalUserId = user_id || userId || (req && req.user ? req.user.id : null);
    const finalEntityType = entity_type || entityType || null;
    const finalEntityId = entity_id || entityId ? String(entity_id || entityId) : null;

    await AuditLog.create({
      institution_id: finalInstId,
      user_id: finalUserId,
      action,
      entity_type: finalEntityType,
      entity_id: finalEntityId,
      details,
      ip_address,
      user_agent
    });
  } catch (err) {
    logger.warn('Failed to record audit log:', err.message);
  }
};

module.exports = {
  recordAuditLog
};
