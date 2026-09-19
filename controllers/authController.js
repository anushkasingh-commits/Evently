const User = require('../models/User');
const { setAuthCookie } = require('../middleware/auth');

exports.loginPage = (req, res) => res.render('login', { title: 'Sign in', error: null, email: '' });
exports.registerPage = (req, res) => res.render('register', { title: 'Create account', error: null, form: {} });

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role = 'organiser' } = req.body;
    if (!name || !email || !password) return res.status(400).render('register', { title: 'Create account', error: 'All fields are required.', form: req.body });
    if (password.length < 6) return res.status(400).render('register', { title: 'Create account', error: 'Password must be at least 6 characters.', form: req.body });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).render('register', { title: 'Create account', error: 'An account with that email already exists.', form: req.body });
    const safeRole = role === 'admin' ? 'organiser' : role;
    const user = await User.create({ name, email, password, role: safeRole });
    setAuthCookie(res, user); res.redirect('/dashboard');
  } catch (e) { next(e) }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body; const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user || !(await user.comparePassword(password || ''))) return res.status(401).render('login', { title: 'Sign in', error: 'Incorrect email or password.', email });
    setAuthCookie(res, user); res.redirect(user.role === 'admin' ? '/admin' : '/dashboard');
  } catch (e) { next(e) }
};
exports.logout = (req, res) => { res.clearCookie('token'); res.redirect('/') };
