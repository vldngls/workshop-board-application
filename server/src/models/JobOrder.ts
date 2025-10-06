import mongoose, { Schema } from 'mongoose'

export type JobStatus = 'Incomplete' | 'Complete' | 'In Progress'
export type JobItemStatus = 'Finished' | 'Unfinished'

export interface JobItem {
  description: string
  status: JobItemStatus
}

export interface Part {
  name: string
  availability: 'Available' | 'Unavailable'
}

export interface JobOrderDoc {
  _id?: mongoose.Types.ObjectId
  jobNumber: string
  createdBy: mongoose.Types.ObjectId
  assignedTechnician: mongoose.Types.ObjectId
  plateNumber: string
  vin: string
  timeRange: {
    start: string // Format: "07:00"
    end: string   // Format: "12:00"
  }
  jobList: JobItem[]
  parts: Part[]
  status: JobStatus
  date: Date
  createdAt?: Date
  updatedAt?: Date
}

const jobOrderSchema = new Schema<JobOrderDoc>({
  jobNumber: { 
    type: String, 
    required: true, 
    unique: true,
    uppercase: true 
  },
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  assignedTechnician: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  plateNumber: { 
    type: String, 
    required: true,
    uppercase: true 
  },
  vin: { 
    type: String, 
    required: true,
    uppercase: true 
  },
  timeRange: {
    start: { type: String, required: true },
    end: { type: String, required: true }
  },
  jobList: [{
    description: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['Finished', 'Unfinished'], 
      required: true 
    }
  }],
  parts: [{
    name: { type: String, required: true },
    availability: { 
      type: String, 
      enum: ['Available', 'Unavailable'], 
      required: true 
    }
  }],
  status: { 
    type: String, 
    enum: ['Incomplete', 'Complete', 'In Progress'], 
    required: true,
    default: 'Incomplete'
  },
  date: { 
    type: Date, 
    required: true,
    default: Date.now 
  }
}, { timestamps: true })

// Index for efficient queries
jobOrderSchema.index({ status: 1, date: -1 })
jobOrderSchema.index({ assignedTechnician: 1, date: 1 })
jobOrderSchema.index({ createdBy: 1 })

export const JobOrder = mongoose.models.JobOrder || mongoose.model<JobOrderDoc>('JobOrder', jobOrderSchema)
