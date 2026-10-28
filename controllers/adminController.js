const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const Maintenance = require('../models/Maintenance');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const { conflictForSlot, validTimes, normalizeDate } = require('../utils/bookingHelper');
const { sendBookingUpdate } = require('../utils/mailer');
const { isValidId, isValidDate, isValidTime, toInt, toNumber, text } = require('../utils/validators');
const { fail } = require('../utils/respond');

async function notify(user, message, type = 'info') {
  await Notification.create({ user, message, type });
}

async function audit(user, action, entity, entityId, details = '') {
  await AuditLog.create({ user, action, entity, entityId: entityId ? entityId.toString() : '', details });
}

// Splits a comma-separated or line-separated field into a clean list
function splitList(value, separator) {
  return String(value || '')
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
}

// Reads and checks the venue fields shared by "create" and "update"
function readVenueForm(body) {
  const venue = {
    name: text(body.name, 120),
    description: text(body.description, 1000),
    location: text(body.location, 160),
    floor: text(body.floor, 60) || 'Ground Floor',
    roomNumber: text(body.roomNumber, 30),
    capacity: toInt(body.capacity, 0),
    hourlyRate: toNumber(body.hourlyRate, -1),
    facilities: splitList(body.facilities, ','),
    images: splitList(body.images, '\n'),
    openingTime: body.openingTime || '08:00',
    closingTime: body.closingTime || '22:00'
  };

  if (!venue.name || !venue.location) {
    return { error: 'Venue name and location are required.' };
  }
  if (venue.capacity < 1) {
    return { error: 'Capacity must be at least 1.' };
  }
  if (venue.hourlyRate < 0) {
    return { error: 'The hourly rate cannot be negative.' };
  }
  if (!isValidTime(venue.openingTime) || !isValidTime(venue.closingTime) || venue.openingTime >= venue.closingTime) {
    return { error: 'Opening time must be before closing time, in HH:MM format.' };
  }
  return { venue };
}

// Admin command centre: totals, today's events, and utilisation per venue
exports.dashboard = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [venues, bookings, users, pending, todayEvents, revenueTotals, logs] = await Promise.all([
      Venue.find().lean(),
      Booking.find().populate('venue', 'name').populate('organiser', 'name email').sort({ date: 1 }).lean(),
      User.countDocuments(),
      Booking.countDocuments({ status: 'pending' }),
      Booking.find({ status: 'approved', date: { $gte: today, $lt: tomorrow } })
        .populate('venue', 'name')
        .populate('organiser', 'name')
        .sort({ startTime: 1 })
        .lean(),
      Booking.aggregate([
        { $match: { status: { $in: ['approved', 'completed'] } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, hours: { $sum: '$durationHours' } } }
      ]),
      AuditLog.find().populate('user', 'name').sort({ createdAt: -1 }).limit(8).lean()
    ]);

    const upcoming = bookings
      .filter((b) => ['approved', 'pending'].includes(b.status) && new Date(b.date) >= today)
      .slice(0, 8);

    const totalRevenue = revenueTotals[0]?.total || 0;
    const totalHours = revenueTotals[0]?.hours || 0;

    // Utilisation = booked hours out of roughly 14 opening hours for 30 days
    const utilisation = venues.map((venue) => {
      const bookedHours = bookings
        .filter((b) => b.venue?._id?.toString() === venue._id.toString() && ['approved', 'completed'].includes(b.status))
        .reduce((sum, b) => sum + b.durationHours, 0);
      return {
        ...venue,
        bookedHours,
        utilisation: Math.min(100, Math.round((bookedHours / (14 * 30)) * 100))
      };
    });

    res.render('admin/dashboard', {
      title: 'Admin command centre',
      venues,
      bookings,
      users,
      pending,
      todayEvents,
      upcoming,
      totalRevenue,
      totalHours,
      utilisation,
      logs
    });
  } catch (e) {
    next(e);
  }
};

// Venue management page
exports.venues = async (req, res, next) => {
  try {
    const venues = await Venue.find().sort({ createdAt: -1 }).lean();
    const maintenance = await Maintenance.find().populate('venue', 'name').sort({ date: 1 }).lean();
    res.render('admin/venues', { title: 'Manage venues', venues, maintenance });
  } catch (e) {
    next(e);
  }
};

exports.createVenue = async (req, res, next) => {
  try {
    const { venue, error } = readVenueForm(req.body);
    if (error) {
      return fail(res, 400, 'Invalid venue', error);
    }

    await Venue.create(venue);
    await audit(req.user, 'CREATE', 'Venue', '', venue.name);
    res.redirect('/admin/venues');
  } catch (e) {
    next(e);
  }
};

exports.updateVenue = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return fail(res, 404, 'Venue not found', 'This venue does not exist.');
    }

    const { venue, error } = readVenueForm(req.body);
    if (error) {
      return fail(res, 400, 'Invalid venue', error);
    }

    const existing = await Venue.findById(req.params.id);
    if (!existing) {
      return fail(res, 404, 'Venue not found', 'This venue does not exist.');
    }

    Object.assign(existing, venue, { active: req.body.active === 'on' });
    await existing.save();
    await audit(req.user, 'UPDATE', 'Venue', existing._id, venue.name);
    res.redirect('/admin/venues');
  } catch (e) {
    next(e);
  }
};

// Archive a venue. It is kept so old bookings still show its name.
exports.deleteVenue = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return fail(res, 404, 'Venue not found', 'This venue does not exist.');
    }

    const venue = await Venue.findById(req.params.id);
    if (venue) {
      venue.active = false;
      await venue.save();
      await audit(req.user, 'ARCHIVE', 'Venue', venue._id, venue.name);
    }
    res.redirect('/admin/venues');
  } catch (e) {
    next(e);
  }
};

// Block a venue for maintenance, if no booking or other block overlaps
exports.addMaintenance = async (req, res, next) => {
  try {
    const { venueId, date, startTime, endTime } = req.body;
    const reason = text(req.body.reason, 200);

    if (!isValidId(venueId)) {
      return fail(res, 400, 'Invalid maintenance', 'Please choose a venue.');
    }
    if (!isValidDate(date) || !validTimes(startTime, endTime)) {
      return fail(res, 400, 'Invalid maintenance', 'Please enter a valid date and time range.');
    }
    if (!reason) {
      return fail(res, 400, 'Invalid maintenance', 'Please give a reason for the maintenance block.');
    }

    if (await conflictForSlot({ venueId, date, startTime, endTime })) {
      return fail(res, 409, 'Time already taken', 'That maintenance window overlaps an active booking or maintenance block.');
    }

    const block = await Maintenance.create({
      venue: venueId,
      date: normalizeDate(date),
      startTime,
      endTime,
      reason,
      createdBy: req.user._id
    });
    await audit(req.user, 'BLOCK', 'Maintenance', block._id, reason);
    res.redirect('/admin/venues');
  } catch (e) {
    next(e);
  }
};

exports.deleteMaintenance = async (req, res, next) => {
  try {
    if (isValidId(req.params.id)) {
      await Maintenance.findByIdAndDelete(req.params.id);
    }
    res.redirect('/admin/venues');
  } catch (e) {
    next(e);
  }
};

// Booking approvals, optionally filtered by status
exports.bookings = async (req, res, next) => {
  try {
    const status = req.query.status;
    const query = status ? { status } : {};
    const bookings = await Booking.find(query)
      .populate('venue', 'name capacity')
      .populate('organiser', 'name email')
      .sort({ date: 1, startTime: 1 })
      .lean();
    res.render('admin/bookings', { title: 'Booking approvals', bookings, status: status || 'all' });
  } catch (e) {
    next(e);
  }
};

async function getBooking(id) {
  return Booking.findById(id).populate('venue', 'name').populate('organiser', 'name email');
}

exports.approve = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return fail(res, 404, 'Booking not found', 'The booking was not found.');
    }

    const booking = await getBooking(req.params.id);
    if (!booking || booking.status !== 'pending') {
      return fail(res, 400, 'Cannot approve', 'Booking is no longer pending.');
    }

    // Check again, because another booking may have been approved since this one was requested
    const conflict = await conflictForSlot({
      venueId: booking.venue._id,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      excludeId: booking._id
    });
    if (conflict) {
      return fail(res, 409, 'Time already taken', 'Cannot approve: the slot now conflicts with another booking or maintenance block.');
    }

    booking.status = 'approved';
    await booking.save();
    await notify(booking.organiser._id, `Your booking for ${booking.eventName} at ${booking.venue.name} was approved.`, 'success');

    // Email is optional. A failed email must not undo the approval.
    await sendBookingUpdate(
      booking.organiser.email,
      booking.organiser.name,
      'Evently booking approved',
      `Your booking for <b>${booking.eventName}</b> at <b>${booking.venue.name}</b> has been approved.`
    ).catch(() => {});

    await audit(req.user, 'APPROVE', 'Booking', booking._id, booking.eventName);
    res.redirect('/admin/bookings');
  } catch (e) {
    next(e);
  }
};

exports.reject = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return fail(res, 404, 'Booking not found', 'The booking was not found.');
    }

    const booking = await getBooking(req.params.id);
    if (!booking || booking.status !== 'pending') {
      return fail(res, 400, 'Cannot reject', 'Booking is no longer pending.');
    }

    booking.status = 'rejected';
    booking.rejectionReason = text(req.body.reason, 300) || 'Rejected by venue manager';
    await booking.save();
    await notify(booking.organiser._id, `Your booking for ${booking.eventName} was rejected: ${booking.rejectionReason}`, 'warning');

    await sendBookingUpdate(
      booking.organiser.email,
      booking.organiser.name,
      'Evently booking update',
      `Your booking for <b>${booking.eventName}</b> was rejected. Reason: ${booking.rejectionReason}`
    ).catch(() => {});

    await audit(req.user, 'REJECT', 'Booking', booking._id, booking.rejectionReason);
    res.redirect('/admin/bookings');
  } catch (e) {
    next(e);
  }
};

exports.complete = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return fail(res, 404, 'Booking not found', 'The booking was not found.');
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking || booking.status !== 'approved') {
      return fail(res, 400, 'Cannot complete', 'Only approved bookings can be completed.');
    }

    booking.status = 'completed';
    await booking.save();
    await audit(req.user, 'COMPLETE', 'Booking', booking._id, booking.eventName);
    res.redirect('/admin/bookings');
  } catch (e) {
    next(e);
  }
};

exports.cancel = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return fail(res, 404, 'Booking not found', 'The booking was not found.');
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return fail(res, 404, 'Booking not found', 'The booking was not found.');
    }

    booking.status = 'cancelled';
    booking.cancelledReason = text(req.body.reason, 300) || 'Cancelled by admin';
    await booking.save();
    await notify(booking.organiser, `Booking ${booking.bookingCode} was cancelled by the venue manager.`, 'warning');
    await audit(req.user, 'CANCEL', 'Booking', booking._id, booking.cancelledReason);
    res.redirect('/admin/bookings');
  } catch (e) {
    next(e);
  }
};

// Check-in by booking code (from the QR scanner or typed in)
exports.checkin = async (req, res, next) => {
  try {
    const code = text(req.body.bookingCode, 40);
    const booking = code ? await Booking.findOne({ bookingCode: code }) : null;

    if (!booking || !['approved', 'completed'].includes(booking.status)) {
      return res.status(400).json({ ok: false, message: 'Valid approved booking not found.' });
    }

    booking.checkedIn = true;
    booking.checkedInAt = new Date();
    await booking.save();
    await audit(req.user, 'CHECK_IN', 'Booking', booking._id, booking.bookingCode);
    res.json({ ok: true, message: `Check-in confirmed for ${booking.eventName}.` });
  } catch (e) {
    next(e);
  }
};

exports.reports = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ status: { $in: ['approved', 'completed'] } })
      .populate('venue', 'name')
      .populate('organiser', 'name')
      .sort({ date: 1 })
      .lean();
    const total = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
    res.render('admin/reports', { title: 'Reports & exports', bookings, total });
  } catch (e) {
    next(e);
  }
};

// CSV export. Cells starting with = + - @ are prefixed so spreadsheets do not run them as formulas.
function csvCell(value) {
  let cell = String(value ?? '');
  if (/^[=+\-@]/.test(cell)) {
    cell = "'" + cell;
  }
  return `"${cell.replace(/"/g, '""')}"`;
}

exports.csv = async (req, res, next) => {
  try {
    const bookings = await Booking.find()
      .populate('venue', 'name')
      .populate('organiser', 'name')
      .sort({ date: 1 })
      .lean();

    const rows = [
      ['Booking ID', 'Event', 'Organiser', 'Venue', 'Date', 'Start', 'End', 'Status', 'Amount', 'Checked In'],
      ...bookings.map((b) => [
        b.bookingCode,
        b.eventName,
        b.organiser?.name,
        b.venue?.name,
        new Date(b.date).toISOString().slice(0, 10),
        b.startTime,
        b.endTime,
        b.status,
        b.totalAmount,
        b.checkedIn
      ])
    ];

    res
      .type('text/csv')
      .set('Content-Disposition', 'attachment; filename="evently-bookings.csv"')
      .send(rows.map((row) => row.map(csvCell).join(',')).join('\n'));
  } catch (e) {
    next(e);
  }
};
