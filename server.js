require('dotenv').config();
const express = require('express'); const cookieParser = require('cookie-parser'); const path = require('path'); const connectDB = require('./config/db'); const { optionalAuth } = require('./middleware/auth'); const errorHandler = require('./middleware/errorHandler');
const app = express(); 
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
app.set('view engine', 'ejs'); app.set('views', path.join(__dirname, 'views')); app.use(express.json()); app.use(express.urlencoded({ extended: true })); app.use(cookieParser()); app.use(express.static(path.join(__dirname, 'public'))); app.use(optionalAuth);
app.locals.money = n => `₹${Number(n || 0).toLocaleString('en-IN')}`; app.locals.dateFmt = d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); app.locals.timeFmt = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; const hh = h % 12 || 12; return `${hh}:${String(m).padStart(2, '0')} ${ap}` };
app.use(require('./routers/authRoutes')); app.use(require('./routers/venueRoutes')); app.use(require('./routers/adminRoutes')); app.get('/health', (req, res) => res.json({ ok: true, service: 'evently' })); app.use((req, res) => res.status(404).render('errors/error', { title: 'Page not found', message: 'The page you requested does not exist.' })); app.use(errorHandler);
const PORT = process.env.PORT || 3000;

let dbPromise = connectDB();

dbPromise.catch(err => {
  console.error('MongoDB connection failed:', err.message);
});

if (require.main === module) {
  dbPromise.then(() => {
    app.listen(PORT, () => {
      console.log(`\n✦ Evently running at http://localhost:${PORT}\n`);
    });
  });
}

module.exports = app;
