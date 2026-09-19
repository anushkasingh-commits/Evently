const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const Maintenance = require('../models/Maintenance');
const { conflictForSlot, availabilityForDate } = require('../utils/bookingHelper');
const { suggestAlternatives, suggestTimeSlots } = require('../utils/recommendation');
const parseNL = require('../utils/nlSearch');

exports.home = async (req, res, next) => {
  try {
    const venues = await Venue.find({ active: true }).sort({ capacity: -1 }).limit(6).lean();
    const upcoming = await Booking.find({ status: 'approved', date: { $gte: new Date() } }).populate('venue', 'name location').sort({ date: 1 }).limit(3).lean();
    res.render('home', { title: 'Evently • Make moments happen', venues, upcoming });
  } catch (e) { next(e) }
};

exports.dashboard = async (req, res, next) => {
  try {
    const [venues, bookings, notifications] = await Promise.all([Venue.find({ active: true }).lean(), Booking.find({ organiser: req.user._id }).populate('venue', 'name location').sort({ date: -1 }).lean(), require('../models/Notification').find({ user: req.user._id, isRead: false }).sort({ createdAt: -1 }).limit(5).lean()]);
    const upcoming = bookings.filter(b => ['pending', 'approved'].includes(b.status) && new Date(b.date) >= new Date()).slice(0, 4);
    res.render('dashboard', { title: 'My dashboard', venues, bookings, upcoming, notifications });
  } catch (e) { next(e) }
};

exports.list = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim(); let filters = { active: true };
    if (q) filters.$or = [{ name: new RegExp(q, 'i') }, { location: new RegExp(q, 'i') }, { facilities: new RegExp(q, 'i') }];
    if (req.query.capacity) filters.capacity = { $gte: +req.query.capacity };
    if (req.query.maxRate) filters.hourlyRate = { $lte: +req.query.maxRate };
    if (req.query.facility) filters.facilities = { $all: Array.isArray(req.query.facility) ? req.query.facility : [req.query.facility] };
    let parsed = {}; if (req.query.nl) { parsed = parseNL(req.query.nl); if (parsed.capacity) filters.capacity = { $gte: parsed.capacity }; if (parsed.maxRate) filters.hourlyRate = { $lte: parsed.maxRate }; if (parsed.facilities.length) filters.facilities = { $all: parsed.facilities }; }
    const venues = await Venue.find(filters).sort({ capacity: 1 }).lean();
    let availability = null;
    if (req.query.date && req.query.startTime && req.query.endTime) {
      availability = await Promise.all(venues.map(async v => ({ venueId: v._id.toString(), conflict: await conflictForSlot({ venueId: v._id, date: req.query.date, startTime: req.query.startTime, endTime: req.query.endTime }) })));
    }
    res.render('venues', { title: 'Explore venues', venues, availability, filters: req.query, parsed });
  } catch (e) { next(e) }
};

exports.details = async (req, res, next) => { try { const venue = await Venue.findById(req.params.id).lean(); if (!venue) return res.status(404).render('errors/error', { title: 'Venue not found', message: 'This venue does not exist.' }); const date = req.query.date || new Date().toISOString().slice(0, 10); const data = await availabilityForDate(venue._id, date); res.render('venue-details', { title: venue.name, venue, date, ...data }); } catch (e) { next(e) } };

exports.availability = async (req, res, next) => { try { const { venueId, date } = req.query; if (!venueId || !date) return res.status(400).json({ error: 'venueId and date are required' }); res.json(await availabilityForDate(venueId, date)); } catch (e) { next(e) } };
exports.suggestions = async (req, res, next) => { try { const { venueId, date, startTime, endTime, capacity, facilities } = req.query; if (!venueId || !date || !startTime || !endTime) return res.status(400).json({ error: 'Missing slot details' }); const venue = await Venue.findById(venueId).lean(); if (!venue) return res.status(404).json({ error: 'Venue not found' }); const data = await availabilityForDate(venueId, date); const requestedFacilities = facilities ? String(facilities).split(',').filter(Boolean) : []; const alternatives = await suggestAlternatives({ venueId, date, startTime, endTime, capacity: +capacity || 1, facilities: requestedFacilities, requestedRate: venue.hourlyRate }); const duration = (new Date(`1970-01-01T${endTime}`) - new Date(`1970-01-01T${startTime}`)) / 3600000; const timeSlots = suggestTimeSlots(venue, date, data.bookings, data.maintenance, duration); res.json({ alternatives, timeSlots }); } catch (e) { next(e) } };
