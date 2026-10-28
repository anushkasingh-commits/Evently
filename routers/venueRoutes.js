const express = require('express');
const venueController = require('../controllers/venueController');
const bookingController = require('../controllers/bookingController');
const userController = require('../controllers/userController');
const brokerController = require('../controllers/brokerController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Public pages
router.get('/', venueController.home);
router.get('/venues', venueController.list);
router.get('/venues/:id', venueController.details);

// Organiser pages (sign-in required)
router.get('/dashboard', requireAuth, venueController.dashboard);
router.get('/broker', requireAuth, brokerController.page);
router.post('/venues/:id/favorite', requireAuth, userController.toggleFavorite);

// Bookings
router.post('/bookings', requireAuth, bookingController.create);
router.get('/bookings', requireAuth, bookingController.list);
router.get('/bookings/:id', requireAuth, bookingController.details);
router.get('/bookings/:id/confirm.pdf', requireAuth, bookingController.pdf);
router.post('/bookings/:id/cancel', requireAuth, bookingController.cancel);

// Notifications
router.get('/notifications', requireAuth, userController.notifications);
router.post('/notifications/read', requireAuth, userController.readNotifications);

// JSON endpoints used by the page scripts
router.get('/api/availability', venueController.availability);
router.get('/api/suggestions', venueController.suggestions);
router.get('/api/venues', brokerController.venues);

module.exports = router;
