/**
 * Middleware ensuring multi-tenant institution isolation
 */
const requireInstitution = (req, res, next) => {
  // If user is super admin, they can act across institutions or filter by header/query/body
  if (req.user && req.user.role === 'super_admin') {
    const overrideId = req.headers['x-institution-id'] || req.query.institution_id || req.body?.institution_id;
    if (overrideId) {
      req.targetInstitutionId = parseInt(overrideId, 10);
    } else {
      req.targetInstitutionId = null; // represents all institutions for super admin
    }
    return next();
  }

  // For institution admin, teachers, and students, isolation is strictly required
  if (!req.institutionId) {
    return res.status(403).json({
      success: false,
      message: 'Access Denied: No institution associated with this account.'
    });
  }

  req.targetInstitutionId = req.institutionId;
  next();
};

module.exports = requireInstitution;
