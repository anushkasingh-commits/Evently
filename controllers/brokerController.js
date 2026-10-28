const Venue = require('../models/Venue');
const { conflictForSlot, validTimes } = require('../utils/bookingHelper');
const { isValidDate, toInt, toNumber } = require('../utils/validators');

// Voice broker page. Sign-in is enforced in the router.
exports.page = (req, res) => {
  res.render('broker', { title: 'Voice broker' });
};

// JSON: up to three active venues that fit the request and are free at that time
exports.venues = async (req, res, next) => {
  try {
    const { date, startTime, endTime } = req.query;
    if (!isValidDate(date) || !validTimes(startTime, endTime)) {
      return res.status(400).json({ error: 'A valid date, start time and end time are required' });
    }

    const capacity = Math.max(1, toInt(req.query.capacity, 1));
    const maxRate = toNumber(req.query.maxRate, 0);

    const filters = { active: true, capacity: { $gte: capacity } };
    if (maxRate > 0) {
      filters.hourlyRate = { $lte: maxRate };
    }

    const candidates = await Venue.find(filters).sort({ capacity: 1 }).lean();
    const found = [];

    for (const venue of candidates) {
      if (found.length === 3) {
        break;
      }
      const conflict = await conflictForSlot({ venueId: venue._id, date, startTime, endTime });
      if (!conflict) {
        found.push({
          _id: venue._id,
          name: venue.name,
          location: venue.location,
          capacity: venue.capacity,
          hourlyRate: venue.hourlyRate
        });
      }
    }

    res.json(found);
  } catch (e) {
    next(e);
  }
};
