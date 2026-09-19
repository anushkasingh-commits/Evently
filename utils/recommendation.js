const Venue = require('../models/Venue');
const { conflictForSlot } = require('./bookingHelper');

function scoreVenue(v, requestedCapacity, requestedFacilities, requestedRate) {
  const capacityScore = v.capacity >= requestedCapacity ? 35 : Math.max(0, 35 - ((requestedCapacity - v.capacity) / Math.max(1, requestedCapacity)) * 50);
  const matched = requestedFacilities.filter(f => v.facilities.includes(f)).length;
  const facilityScore = requestedFacilities.length ? (matched / requestedFacilities.length) * 35 : 35;
  const priceScore = requestedRate ? Math.max(0, 20 - Math.abs(v.hourlyRate - requestedRate) / Math.max(1, requestedRate) * 20) : 15;
  return Math.round(capacityScore + facilityScore + priceScore);
}

async function suggestAlternatives({ venueId, date, startTime, endTime, capacity, facilities = [], requestedRate = 0 }) {
  const venues = await Venue.find({ active: true, _id: { $ne: venueId } }).lean();
  const available = [];
  for (const v of venues) {
    if (v.capacity < capacity) continue;
    const conflict = await conflictForSlot({ venueId: v._id, date, startTime, endTime });
    if (conflict) continue;
    const score = scoreVenue(v, capacity, facilities, requestedRate);
    available.push({ ...v, score, matchedFacilities: facilities.filter(f => v.facilities.includes(f)) });
  }
  return available.sort((a,b) => b.score - a.score).slice(0, 4);
}

function suggestTimeSlots(venue, date, bookings, maintenance, requestedDuration) {
  const result = [];
  const start = Number(venue.openingTime.split(':')[0]);
  const close = Number(venue.closingTime.split(':')[0]);
  for (let h = start; h + requestedDuration <= close; h++) {
    const s = `${String(h).padStart(2,'0')}:00`;
    const eHour = h + requestedDuration;
    const e = `${String(eHour).padStart(2,'0')}:00`;
    const conflict = bookings.some(b => b.startTime < e && b.endTime > s) || maintenance.some(m => m.startTime < e && m.endTime > s);
    if (!conflict) result.push({ startTime: s, endTime: e });
  }
  return result.slice(0, 5);
}
module.exports = { suggestAlternatives, suggestTimeSlots };
