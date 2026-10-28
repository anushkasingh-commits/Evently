const Booking = require('../models/Booking');
const Venue = require('../models/Venue');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const { conflictForSlot, validTimes, durationHours, normalizeDate, makeBookingCode } = require('../utils/bookingHelper');
const { suggestAlternatives } = require('../utils/recommendation');
const { isValidId, isValidDate, toInt, text } = require('../utils/validators');
const { fail } = require('../utils/respond');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');

const MAX_RECURRING_DATES = 12;

async function notify(user, message, type = 'info') {
  await Notification.create({ user, message, type });
}

// Creates one or more booking requests (more than one when the event repeats).
// Requests start as "pending" and an admin approves them.
// Creates one or more booking requests (more than one when the event repeats).
// Requests start as "pending" and an admin approves them.
// Requests that ask for JSON (the voice broker) get a JSON reason on failure; page forms get an error page.
exports.create = async (req, res, next) => {
  try {
    const wantsJson = (req.get('Accept') || '').includes('application/json');
    const reject = (status, message) => {
      if (wantsJson) {
        return res.status(status).json({ error: message });
      }
      return fail(res, status, 'Invalid booking', message);
    };

    const body = req.body;
    const venueId = body.venueId;

    if (!isValidId(venueId)) {
      return fail(res, 404, 'Venue not found', 'This venue does not exist.');
    }

    const venue = await Venue.findById(venueId);
    if (!venue || !venue.active) {
      return fail(res, 404, 'Venue not found', 'This venue does not exist.');
    }

    const eventName = text(body.eventName, 120);
    const eventType = text(body.eventType, 60) || 'Other';
    const description = text(body.description, 1000);
    const attendees = toInt(body.attendees, 0);
    const facilities = String(body.facilitiesRequested || '').split(',').map((f) => f.trim()).filter(Boolean);

    if (!eventName) {
      return reject(400, 'Please enter an event name.');
    }
    if (!isValidDate(body.date)) {
      return reject(400, 'Please choose a valid date.');
    }
    if (!validTimes(body.startTime, body.endTime)) {
      return reject(400, 'The end time must be after the start time.');
    }
    if (attendees < 1 || attendees > venue.capacity) {
      return reject(400, `The number of guests must be between 1 and ${venue.capacity}.`);
    }

    const firstDate = normalizeDate(body.date);
    if (firstDate < normalizeDate(new Date())) {
      return reject(400, 'Booking date cannot be in the past.');
    }

    // Work out every date the booking needs
    const repeatCount = Math.min(Math.max(toInt(body.recurrenceCount, 1), 1), MAX_RECURRING_DATES);
    const dates = [];
    for (let i = 0; i < repeatCount; i++) {
      const date = new Date(firstDate);
      if (body.recurrence === 'weekly') {
        date.setDate(date.getDate() + i * 7);
      } else if (body.recurrence === 'daily') {
        date.setDate(date.getDate() + i);
      } else if (i > 0) {
        break;
      }
      dates.push(date);
    }

    // Stop if any date clashes with another booking or maintenance
    const conflicts = [];
    for (const date of dates) {
      const conflict = await conflictForSlot({ venueId: venue._id, date, startTime: body.startTime, endTime: body.endTime });
      if (conflict) {
        conflicts.push({ date, type: conflict.type, item: conflict.item });
      }
    }

    if (conflicts.length) {
      if (wantsJson) {
        return res.status(409).json({ error: 'That slot is already booked.' });
      }
      const alternatives = await suggestAlternatives({
        venueId,
        date: firstDate,
        startTime: body.startTime,
        endTime: body.endTime,
        capacity: attendees,
        facilities,
        requestedRate: venue.hourlyRate
      });
      return res.status(409).render('booking-conflict', {
        title: 'Slot unavailable',
        venue,
        form: body,
        conflicts,
        alternatives
      });
    }

    const group = dates.length > 1 ? `REC-${Date.now()}` : '';
    const hours = durationHours(body.startTime, body.endTime);

    const docs = dates.map((date) => ({
      bookingCode: makeBookingCode(),
      organiser: req.user._id,
      venue: venue._id,
      eventName,
      eventType,
      description,
      attendees,
      date,
      startTime: body.startTime,
      endTime: body.endTime,
      durationHours: hours,
      hourlyRate: venue.hourlyRate,
      totalAmount: Math.round(hours * venue.hourlyRate),
      facilitiesRequested: facilities,
      status: 'pending',
      recurrenceGroup: group
    }));

    const created = await Booking.insertMany(docs);
    const summary = created.length > 1 ? `${created.length} booking requests` : 'Booking request';
    await notify(req.user._id, `${summary} submitted for ${venue.name}.`, 'success');

    if (wantsJson) {
      return res.status(201).json({ ok: true, count: created.length });
    }
    res.redirect('/bookings');
  } catch (e) {
    next(e);
  }
};

// The organiser's own bookings
exports.list = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ organiser: req.user._id })
      .populate('venue', 'name location capacity')
      .sort({ date: -1, startTime: -1 })
      .lean();
    res.render('bookings', { title: 'My bookings', bookings });
  } catch (e) {
    next(e);
  }
};

// One booking, with its QR event pass
exports.details = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return fail(res, 404, 'Booking not found', 'The booking was not found.');
    }

    const booking = await Booking.findOne({ _id: req.params.id, organiser: req.user._id })
      .populate('venue')
      .populate('organiser', 'name email')
      .lean();
    if (!booking) {
      return fail(res, 404, 'Booking not found', 'The booking was not found.');
    }

    const day = new Date(booking.date).toISOString().slice(0, 10);
    const passText = `EVENTLY|${booking.bookingCode}|${booking.eventName}|${day}|${booking.startTime}|${booking.endTime}`;
    const qr = await QRCode.toDataURL(passText);

    res.render('booking-details', { title: booking.eventName, booking, qr });
  } catch (e) {
    next(e);
  }
};

// Cancel a pending or approved booking (approved ones only up to 24 hours before)
exports.cancel = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return fail(res, 404, 'Booking not found', 'The booking was not found.');
    }

    const booking = await Booking.findOne({ _id: req.params.id, organiser: req.user._id });
    if (!booking) {
      return fail(res, 404, 'Booking not found', 'The booking was not found.');
    }

    if (!['pending', 'approved'].includes(booking.status)) {
      return fail(res, 400, 'Cannot cancel', 'This booking cannot be cancelled.');
    }

    const hoursUntilEvent = (new Date(booking.date) - new Date()) / 3600000;
    if (booking.status === 'approved' && hoursUntilEvent < 24) {
      return fail(res, 400, 'Cannot cancel', 'Approved bookings can only be cancelled at least 24 hours before the event.');
    }

    booking.status = 'cancelled';
    booking.cancelledReason = text(req.body.reason, 300) || 'Cancelled by organiser';
    await booking.save();
    await notify(req.user._id, `Booking ${booking.bookingCode} has been cancelled.`, 'warning');

    res.redirect('/bookings');
  } catch (e) {
    next(e);
  }
};

// Downloadable PDF booking confirmation
exports.pdf = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) {
      return fail(res, 404, 'Booking not found', 'The booking was not found.');
    }

    const booking = await Booking.findOne({ _id: req.params.id, organiser: req.user._id })
      .populate('venue')
      .populate('organiser', 'name email')
      .lean();
    if (!booking) {
      return fail(res, 404, 'Booking not found', 'The booking was not found.');
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${booking.bookingCode}.pdf"`);
    doc.pipe(res);

    doc.fontSize(11).text('EVENTLY', 50, 50);
    doc.fontSize(28).text('EVENT PASS', 50, 95);
    doc.fontSize(24).text(booking.eventName, 50, 140);
    doc.fontSize(11).fillColor('#666').text(booking.description || 'Event booking confirmation', 50, 180, { width: 490 });

    doc.fillColor('#111');
    doc.fontSize(12).text(`Booking ID: ${booking.bookingCode}`, 50, 230);
    doc.text(`Venue: ${booking.venue.name}`, 50, 255);
    doc.text(`Location: ${booking.venue.location}`, 50, 280);
    doc.text(`Date: ${new Date(booking.date).toLocaleDateString('en-IN')}`, 50, 305);
    doc.text(`Time: ${booking.startTime} – ${booking.endTime}`, 50, 330);
    doc.text(`Guests: ${booking.attendees}`, 50, 355);
    doc.text(`Estimated amount: INR ${booking.totalAmount.toLocaleString('en-IN')}`, 50, 380);

    doc.roundedRect(50, 430, 495, 105, 12).stroke();
    doc.fontSize(14).text(`Status: ${booking.status.toUpperCase()}`, 70, 455);
    doc.fontSize(10).fillColor('#777').text('Present this booking ID or the QR event pass at the venue entrance.', 70, 485, { width: 450 });

    doc.fillColor('#111').fontSize(10).text('Generated by Evently • Campus & Community Edition', 50, 760);
    doc.end();
  } catch (e) {
    next(e);
  }
};
