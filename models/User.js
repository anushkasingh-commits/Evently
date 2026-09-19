const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['organiser', 'admin'], default: 'organiser' },
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Venue' }]
}, { timestamps: true });

schema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

schema.methods.comparePassword = function(password) { return bcrypt.compare(password, this.password); };
module.exports = mongoose.model('User', schema);
