const mongoose = require('mongoose')

const SystemLogSchema = new mongoose.Schema({
  level: { type: String, enum: ['info', 'warn', 'error', 'audit'], required: true },
  message: { type: String, required: true },
  context: { type: Object, default: {} },
  userId: { type: String },
  userEmail: { type: String },
  userRole: { type: String },
  ip: { type: String },
  method: { type: String },
  path: { type: String },
  status: { type: Number },
  durationMs: { type: Number },
}, { timestamps: true })

module.exports = mongoose.models.SystemLog || mongoose.model('SystemLog', SystemLogSchema)


