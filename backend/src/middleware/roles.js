/**
 * RBAC middleware to restrict access based on user role(s)
 * @param  {...string} allowedRoles 
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.role) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User not authenticated.'
      });
    }

    if (!allowedRoles.includes(req.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted. Role '${req.role}' does not have sufficient permissions for this resource.`
      });
    }

    next();
  };
};

module.exports = authorize;
