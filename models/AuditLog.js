const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  entity: { type: String, required: true },
  entityId: String,
  details: String
}, { timestamps: true });
module.exports = mongoose.model('AuditLog', schema);
