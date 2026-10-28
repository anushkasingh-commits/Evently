const jwt = require('jsonwebtoken');
const User = require('../models/User');

const TOKEN_LIFETIME_DAYS = 7;

// Creates a signed login token for a user
function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: `${TOKEN_LIFETIME_DAYS}d` }
  );
}

// Stores the login token in an HTTP-only cookie (JavaScript on the page cannot read it)
function setAuthCookie(res, user) {
  res.cookie('token', signToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TOKEN_LIFETIME_DAYS * 24 * 60 * 60 * 1000
  });
}

// Sets req.user if a valid login cookie exists. Pages still work when signed out.
async function optionalAuth(req, res, next) {
  res.locals.currentUser = null;
  req.user = null;

  const token = req.cookies?.token;
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.id).select('-password').lean();
      if (user) {
        res.locals.currentUser = user;
        req.user = user;
      }
    } catch (error) {
      // An expired or invalid token means the user is signed out. Treat it as no login.
    }
  }

  next();
}

// Sends signed-out users to the sign-in page, then back to the page they wanted
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

module.exports = { signToken, setAuthCookie, optionalAuth, requireAuth };
