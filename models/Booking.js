const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  bookingCode: { type: String, unique: true, index: true },
  organiser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  venue: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
  eventName: { type: String, required: true, trim: true, maxlength: 120 },
  eventType: { type: String, default: 'Other' },
  description: { type: String, default: '' },
  attendees: { type: Number, required: true, min: 1 },
  date: { type: Date, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  durationHours: { type: Number, required: true },
  hourlyRate: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  facilitiesRequested: [{ type: String }],
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'], default: 'pending' },
  rejectionReason: { type: String, default: '' },
  cancelledReason: { type: String, default: '' },
  checkedIn: { type: Boolean, default: false },
  checkedInAt: { type: Date },
  recurrenceGroup: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

schema.index({ venue: 1, date: 1, startTime: 1, endTime: 1, status: 1 });
module.exports = mongoose.model('Booking', schema);
