const express = require('express'); const { loginPage, registerPage, login, register, logout } = require('../controllers/authController'); const rateLimit = require('express-rate-limit');
const router = express.Router(); const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false });
router.get('/login', loginPage); router.post('/login', limiter, login); router.get('/register', registerPage); router.post('/register', limiter, register); router.post('/logout', logout); router.get('/logout', logout); module.exports = router;
