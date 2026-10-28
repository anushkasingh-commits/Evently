const User = require('../models/User');
const { setAuthCookie } = require('../middleware/auth');
const { text, safeRedirect } = require('../utils/validators');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function renderRegister(res, status, error, form) {
  return res.status(status).render('register', { title: 'Create account', error, form });
}

exports.loginPage = (req, res) => {
  res.render('login', { title: 'Sign in', error: null, email: '', next: safeRedirect(req.query.next, '') });
};

exports.registerPage = (req, res) => {
  res.render('register', { title: 'Create account', error: null, form: {} });
};

// Public sign-up always creates an organiser. Admin accounts are made by the seed script or an admin.
exports.register = async (req, res, next) => {
  try {
    const form = {
      name: text(req.body.name, 80),
      email: text(req.body.email, 120).toLowerCase()
    };
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!form.name || !form.email || !password) {
      return renderRegister(res, 400, 'All fields are required.', form);
    }
    if (form.name.length < 2) {
      return renderRegister(res, 400, 'Please enter your full name.', form);
    }
    if (!EMAIL_PATTERN.test(form.email)) {
      return renderRegister(res, 400, 'Please enter a valid email address.', form);
    }
    if (password.length < 6) {
      return renderRegister(res, 400, 'Password must be at least 6 characters.', form);
    }
    if (await User.findOne({ email: form.email })) {
      return renderRegister(res, 409, 'An account with that email already exists.', form);
    }

    const user = await User.create({ ...form, password, role: 'organiser' });
    setAuthCookie(res, user);
    res.redirect('/dashboard');
  } catch (e) {
    // Two sign-ups with the same email at the same moment: the database rejects the second
    if (e.code === 11000) {
      return renderRegister(res, 409, 'An account with that email already exists.', {});
    }
    next(e);
  }
};

exports.login = async (req, res, next) => {
  try {
    const email = text(req.body.email, 120).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const nextPage = safeRedirect(req.body.next, '');

    const user = email ? await User.findOne({ email }) : null;
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).render('login', {
        title: 'Sign in',
        error: 'Incorrect email or password.',
        email,
        next: nextPage
      });
    }

    setAuthCookie(res, user);

    // Send the user back to the page they asked for, or to their default dashboard
    const defaultPage = user.role === 'admin' ? '/admin' : '/dashboard';
    res.redirect(nextPage || defaultPage);
  } catch (e) {
    next(e);
  }
};

exports.logout = (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
};
