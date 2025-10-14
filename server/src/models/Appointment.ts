import mongoose, { Schema } from 'mongoose'

export interface AppointmentDoc {
  _id?: mongoose.Types.ObjectId
  assignedTechnician: mongoose.Types.ObjectId
  serviceAdvisor?: mongoose.Types.ObjectId | null
  plateNumber: string
  timeRange: {
    start: string // Format: "07:00"
    end: string   // Format: "12:00"
  }
  date: Date
  createdBy: mongoose.Types.ObjectId
  noShow?: boolean
  createdAt?: Date
  updatedAt?: Date
}

const appointmentSchema = new Schema<AppointmentDoc>({
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
appointmentSchema.index({ date: 1 })
appointmentSchema.index({ createdBy: 1 })

export const Appointment = mongoose.models.Appointment || mongoose.model<AppointmentDoc>('Appointment', appointmentSchema)

