import mongoose, { Schema } from 'mongoose'

export type JobStatus = 'OG' | 'WP' | 'FP' | 'QI' | 'HC' | 'HW' | 'HI' | 'FR' | 'FU' | 'CP'
export type JobItemStatus = 'Finished' | 'Unfinished'
export type QIStatus = 'pending' | 'approved' | 'rejected' | null

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
  assignedTechnician?: mongoose.Types.ObjectId | null  // Optional for carried over jobs
  serviceAdvisor?: mongoose.Types.ObjectId | null
  plateNumber: string
  vin: string
  timeRange: {
    start: string // Format: "07:00"
    end: string   // Format: "12:00"
  }
  actualEndTime?: string  // Format: "10:00" - when job actually ended (if early/interrupted)
  jobList: JobItem[]
  parts: Part[]
  status: JobStatus
  date: Date
  originalCreatedDate: Date  // Persistent creation date, not overwritten by replotting
  sourceType?: 'appointment' | 'carry-over' | 'direct'  // Track the source of the job order
  carriedOver?: boolean
  isImportant?: boolean
  qiStatus?: QIStatus
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
    required: false  // Not required for carried over jobs awaiting reassignment
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
  vin: { 
    type: String, 
    required: true,
    uppercase: true 
  },
  timeRange: {
    start: { type: String, required: true },
    end: { type: String, required: true }
  },
  actualEndTime: {
    type: String,
    required: false  // Only set when job ends early or is interrupted
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
    enum: ['OG', 'WP', 'FP', 'QI', 'HC', 'HW', 'HI', 'FR', 'FU', 'CP'], 
    required: true,
    default: 'OG'
  },
  date: { 
    type: Date, 
    required: true,
    default: Date.now 
  },
  originalCreatedDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  sourceType: {
    type: String,
    enum: ['appointment', 'carry-over', 'direct'],
    default: 'direct'
  },
  carriedOver: {
    type: Boolean,
    default: false
  },
  isImportant: {
    type: Boolean,
    default: false
  },
  qiStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', null],
    default: null
  }
}, { timestamps: true })

// Index for efficient queries
jobOrderSchema.index({ status: 1, date: -1 })
jobOrderSchema.index({ assignedTechnician: 1, date: 1 })
jobOrderSchema.index({ createdBy: 1 })
jobOrderSchema.index({ isImportant: 1, date: -1 })
jobOrderSchema.index({ carriedOver: 1, date: -1 })
jobOrderSchema.index({ qiStatus: 1 })

export const JobOrder = mongoose.models.JobOrder || mongoose.model<JobOrderDoc>('JobOrder', jobOrderSchema)
