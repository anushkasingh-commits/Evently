const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const { conflictForSlot, availabilityForDate, dateOnly, durationHours, validTimes } = require('../utils/bookingHelper');
const { suggestAlternatives, suggestTimeSlots } = require('../utils/recommendation');
const parseNaturalLanguage = require('../utils/nlSearch');
const { isValidId, isValidDate, escapeRegex, toInt, text } = require('../utils/validators');
const { fail } = require('../utils/respond');

const today = () => new Date().toISOString().slice(0, 10);

// Home page: a few featured venues and the next approved events
exports.home = async (req, res, next) => {
  try {
    const [venues, upcoming] = await Promise.all([
      Venue.find({ active: true }).sort({ capacity: -1 }).limit(6).lean(),
      Booking.find({ status: 'approved', date: { $gte: new Date() } })
        .populate('venue', 'name location')
        .sort({ date: 1 })
        .limit(3)
        .lean()
    ]);
    res.render('home', { title: 'Evently • Make moments happen', venues, upcoming });
  } catch (e) {
    next(e);
  }
};

// Organiser dashboard: their bookings, plus unread notifications
exports.dashboard = async (req, res, next) => {
  try {
    const [venues, bookings, notifications] = await Promise.all([
      Venue.find({ active: true }).lean(),
      Booking.find({ organiser: req.user._id })
        .populate('venue', 'name location')
        .sort({ date: -1 })
        .lean(),
      Notification.find({ user: req.user._id, isRead: false })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
    ]);

    const now = new Date();
    const upcoming = bookings
      .filter((b) => ['pending', 'approved'].includes(b.status) && new Date(b.date) >= now)
      .slice(0, 4);

    res.render('dashboard', { title: 'My dashboard', venues, bookings, upcoming, notifications });
  } catch (e) {
    next(e);
  }
};

// Venue search page: text search, filters, and the natural-language search box
exports.list = async (req, res, next) => {
  try {
    const query = req.query;
    const search = text(query.q, 100);
    const filters = { active: true };

    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      filters.$or = [{ name: pattern }, { location: pattern }, { facilities: pattern }];
    }

    const capacity = toInt(query.capacity, 0);
    if (capacity > 0) {
      filters.capacity = { $gte: capacity };
    }

    const maxRate = toInt(query.maxRate, 0);
    if (maxRate > 0) {
      filters.hourlyRate = { $lte: maxRate };
    }

    if (query.facility) {
      const facilities = [].concat(query.facility).filter((f) => typeof f === 'string');
      if (facilities.length) {
        filters.facilities = { $all: facilities };
      }
    }

    // The natural-language box overrides the matching filters, for example "300 people, projector, under 2000"
    let parsed = {};
    if (query.nl) {
      parsed = parseNaturalLanguage(text(query.nl, 200));
      if (parsed.capacity) filters.capacity = { $gte: parsed.capacity };
      if (parsed.maxRate) filters.hourlyRate = { $lte: parsed.maxRate };
      if (parsed.facilities.length) filters.facilities = { $all: parsed.facilities };
    }

    const venues = await Venue.find(filters).sort({ capacity: 1 }).lean();

    // Show which venues are free, only when a full date and time were given
    let availability = null;
    const { date, startTime, endTime } = query;
    if (isValidDate(date) && validTimes(startTime, endTime)) {
      availability = await Promise.all(
        venues.map(async (venue) => ({
          venueId: venue._id.toString(),
          conflict: await conflictForSlot({ venueId: venue._id, date, startTime, endTime })
        }))
      );
    }

    res.render('venues', { title: 'Explore venues', venues, availability, filters: query, parsed });
  } catch (e) {
    next(e);
  }
};

// Single venue page with that day's availability
exports.details = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return fail(res, 404, 'Venue not found', 'This venue does not exist.');
    }

    const venue = await Venue.findById(req.params.id).lean();
    if (!venue) {
      return fail(res, 404, 'Venue not found', 'This venue does not exist.');
    }

    const date = isValidDate(req.query.date) ? dateOnly(req.query.date) : today();
    const data = await availabilityForDate(venue._id, date);
    res.render('venue-details', { title: venue.name, venue, date, ...data });
  } catch (e) {
    next(e);
  }
};

// JSON: availability for one venue on one day (used by the live timeline)
exports.availability = async (req, res, next) => {
  try {
    const { venueId, date } = req.query;
    if (!isValidId(venueId) || !isValidDate(date)) {
      return res.status(400).json({ error: 'A valid venueId and date are required' });
    }
    res.json(await availabilityForDate(venueId, date));
  } catch (e) {
    next(e);
  }
};

// JSON: alternative venues and free time slots when a requested slot is taken
exports.suggestions = async (req, res, next) => {
  try {
    const { venueId, date, startTime, endTime } = req.query;
    if (!isValidId(venueId) || !isValidDate(date) || !validTimes(startTime, endTime)) {
      return res.status(400).json({ error: 'Missing or invalid slot details' });
    }

    const venue = await Venue.findById(venueId).lean();
    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    const capacity = Math.max(1, toInt(req.query.capacity, 1));
    const facilities = req.query.facilities ? String(req.query.facilities).split(',').filter(Boolean) : [];

    const alternatives = await suggestAlternatives({
      venueId,
      date,
      startTime,
      endTime,
      capacity,
      facilities,
      requestedRate: venue.hourlyRate
    });

    const data = await availabilityForDate(venueId, date);
    const timeSlots = suggestTimeSlots(venue, date, data.bookings, data.maintenance, durationHours(startTime, endTime));

    res.json({ alternatives, timeSlots });
  } catch (e) {
    next(e);
  }
};
