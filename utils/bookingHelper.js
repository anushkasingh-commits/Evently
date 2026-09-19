const Booking = require('../models/Booking');
const Maintenance = require('../models/Maintenance');

const ACTIVE_STATUSES = ['pending', 'approved'];

function minutes(time) {
  const [h, m] = String(time).split(':').map(Number);
  return h * 60 + m;
}
function validTimes(start, end) { return Number.isFinite(minutes(start)) && Number.isFinite(minutes(end)) && minutes(start) < minutes(end); }
function sameDay(a, b) { return new Date(a).toISOString().slice(0,10) === new Date(b).toISOString().slice(0,10); }
function overlap(aStart, aEnd, bStart, bEnd) { return minutes(aStart) < minutes(bEnd) && minutes(aEnd) > minutes(bStart); }

async function conflictForSlot({ venueId, date, startTime, endTime, excludeId }) {
  const bookings = await Booking.find({ venue: venueId, date: new Date(date), status: { $in: ACTIVE_STATUSES }, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }).lean();
  const booking = bookings.find(b => overlap(startTime, endTime, b.startTime, b.endTime));
  if (booking) return { type: 'booking', item: booking };
  const maintenance = await Maintenance.find({ venue: venueId, date: new Date(date) }).lean();
  const block = maintenance.find(m => overlap(startTime, endTime, m.startTime, m.endTime));
  if (block) return { type: 'maintenance', item: block };
  return null;
}

async function availabilityForDate(venueId, date) {
  const [bookings, maintenance] = await Promise.all([
    Booking.find({ venue: venueId, date: new Date(date), status: { $in: ACTIVE_STATUSES } }).populate('organiser', 'name').lean(),
    Maintenance.find({ venue: venueId, date: new Date(date) }).lean()
  ]);
  return { bookings, maintenance };
}

function durationHours(start, end) { return (minutes(end) - minutes(start)) / 60; }
function normalizeDate(date) { const d = new Date(date); d.setHours(0,0,0,0); return d; }
function dateOnly(date) { return new Date(date).toISOString().slice(0,10); }
function makeBookingCode() { return `EVT-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`; }

module.exports = { minutes, validTimes, sameDay, overlap, conflictForSlot, availabilityForDate, durationHours, normalizeDate, dateOnly, makeBookingCode };
