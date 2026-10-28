// Allows only signed-in users whose role is in the list, for example authorize('admin')
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.redirect('/login');
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).render('errors/403', { title: 'Access denied' });
    }
    next();
  };
}

module.exports = authorizeRoles;
