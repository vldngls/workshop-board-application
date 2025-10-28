const mongoose = require('mongoose')
const { Schema } = mongoose

interface BugReportDoc {
  subject: string
  description: string
  imageData?: string // Base64 encoded image
  imageMimeType?: string
  submittedBy: mongoose.Types.ObjectId
  submittedByEmail: string
  submittedByName: string
  submittedByRole: string
  currentPage: string
  userAgent: string
  status: 'open' | 'in-progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignedTo?: mongoose.Types.ObjectId
  resolution?: string
  resolvedAt?: Date
  resolvedBy?: mongoose.Types.ObjectId
}

const bugReportSchema = new Schema({
  subject: { type: String, required: true },
  description: { type: String, required: true },
  imageData: String, // Base64 encoded image
  imageMimeType: String,
  submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  submittedByEmail: { type: String, required: true },
  submittedByName: { type: String, required: true },
  submittedByRole: { type: String, required: true },
  currentPage: { type: String, required: true },
  userAgent: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['open', 'in-progress', 'resolved', 'closed'],
    default: 'open'
  },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  resolution: String,
  resolvedAt: Date,
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

const BugReport = mongoose.models.BugReport || mongoose.model('BugReport', bugReportSchema)

module.exports = { BugReport }
