function requireAdmin(req, res, next) {
  if (!req.session || !req.session.admin) {
    return res.status(401).json({ error: 'Administrator login required.' });
  }
  if (!['owner', 'admin'].includes(req.session.admin.role)) {
    return res.status(403).json({ error: 'You are not authorized to access this resource.' });
  }
  next();
}
module.exports = { requireAdmin };
