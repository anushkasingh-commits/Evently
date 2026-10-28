require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const { optionalAuth } = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

// Login tokens cannot be signed without this secret, so stop early with a clear message
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Add it to your .env file (see .env.example).');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(optionalAuth);

// Formatting helpers available in every view
app.locals.money = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
app.locals.dateFmt = (date) =>
  new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
app.locals.timeFmt = (time) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
};

// Routes
app.use(require('./routers/authRoutes'));
app.use(require('./routers/venueRoutes'));
app.use(require('./routers/adminRoutes'));

app.get('/health', (req, res) => res.json({ ok: true, service: 'evently' }));

// Unknown pages, then the error handler. These must come last.
app.use((req, res) => {
  res.status(404).render('errors/error', {
    title: 'Page not found',
    message: 'The page you requested does not exist.'
  });
});
app.use(errorHandler);

// Start the server when this file is run directly (npm start / npm run dev)
if (require.main === module) {
  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Evently running at http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Could not connect to MongoDB:', err.message);
      process.exit(1);
    });
} else {
  // When imported (for example by Vercel or tests), report a connection problem without crashing
  connectDB().catch((err) => {
    console.error('MongoDB connection failed:', err.message);
  });
}

module.exports = app;
