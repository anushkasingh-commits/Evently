const express = require('express');
const adminController = require('../controllers/adminController');
const { requireAuth } = require('../middleware/auth');
const authorizeRoles = require('../middleware/authorizeRoles');

const router = express.Router();

// Every /admin route needs a signed-in admin
router.use('/admin', requireAuth, authorizeRoles('admin'));

router.get('/admin', adminController.dashboard);

// Venues and maintenance
router.get('/admin/venues', adminController.venues);
router.post('/admin/venues', adminController.createVenue);
router.post('/admin/venues/:id/update', adminController.updateVenue);
router.post('/admin/venues/:id/archive', adminController.deleteVenue);
router.post('/admin/maintenance', adminController.addMaintenance);
router.post('/admin/maintenance/:id/delete', adminController.deleteMaintenance);

// Bookings
router.get('/admin/bookings', adminController.bookings);
router.post('/admin/bookings/:id/approve', adminController.approve);
router.post('/admin/bookings/:id/reject', adminController.reject);
router.post('/admin/bookings/:id/complete', adminController.complete);
router.post('/admin/bookings/:id/cancel', adminController.cancel);
router.post('/admin/checkin', adminController.checkin);

// Reports
router.get('/admin/reports', adminController.reports);
router.get('/admin/reports.csv', adminController.csv);

module.exports = router;
