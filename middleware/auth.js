const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ id: user._id.toString(), role: user.role, name: user.name, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function setAuthCookie(res, user) {
  res.cookie('token', signToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

async function optionalAuth(req, res, next) {
  res.locals.currentUser = null;
  const token = req.cookies?.token;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.id).select('-password').lean();
      if (user) res.locals.currentUser = user;
    } catch (_) {}
  }
  req.user = res.locals.currentUser;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  next();
}

module.exports = { signToken, setAuthCookie, optionalAuth, requireAuth };
