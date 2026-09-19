const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  location: { type: String, required: true },
  floor: { type: String, default: 'Ground Floor' },
  roomNumber: { type: String, default: '' },
  capacity: { type: Number, required: true, min: 1 },
  hourlyRate: { type: Number, required: true, min: 0 },
  facilities: [{ type: String, trim: true }],
  images: [{ type: String }],
  openingTime: { type: String, default: '08:00' },
  closingTime: { type: String, default: '22:00' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Venue', schema);
