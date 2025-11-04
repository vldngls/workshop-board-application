const mongoose = require('mongoose')
const { Schema } = mongoose

interface AppointmentDoc {
  _id?: any
  assignedTechnician: any
  serviceAdvisor?: any | null
  plateNumber: string
  timeRange: {
    start: string // Format: "07:00"
    end: string   // Format: "12:00"
  }
  date: Date
  createdBy: any
  noShow?: boolean
  createdAt?: Date
  updatedAt?: Date
}

const appointmentSchema = new Schema({
  assignedTechnician: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  serviceAdvisor: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  plateNumber: { 
    type: String, 
    required: true,
    uppercase: true 
  },
  timeRange: {
    start: { type: String, required: true },
    end: { type: String, required: true }
  },
  date: { 
    type: Date, 
    required: true,
    default: Date.now 
  },
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  noShow: {
    type: Boolean,
    default: false
  },
}, { timestamps: true })

// Index for efficient queries
appointmentSchema.index({ assignedTechnician: 1, date: 1 })
appointmentSchema.index({ date: 1, 'timeRange.start': 1 }) // Composite for date + time queries
appointmentSchema.index({ createdBy: 1 })
appointmentSchema.index({ noShow: 1, date: 1 }) // For filtering no-show appointments
appointmentSchema.index({ plateNumber: 1 }) // For search queries

const Appointment = mongoose.models.Appointment || mongoose.model('Appointment', appointmentSchema)

module.exports = { Appointment }

