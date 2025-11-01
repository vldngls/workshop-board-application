const mongoose = require('mongoose')
const { Schema } = mongoose

type JobStatus = 'OG' | 'WP' | 'UA' | 'QI' | 'HC' | 'HW' | 'HI' | 'HF' | 'SU' | 'FR' | 'FU' | 'CP'
type JobItemStatus = 'Finished' | 'Unfinished'
type QIStatus = 'pending' | 'approved' | 'rejected' | null

interface JobItem {
  description: string
  status: JobItemStatus
}

interface Part {
  name: string
  availability: 'Available' | 'Unavailable'
}

interface JobOrderDoc {
  _id?: any
  jobNumber: string
  createdBy: any
  assignedTechnician?: any | null  // Optional for carried over jobs
  serviceAdvisor?: any | null
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
  holdCustomerRemarks?: string  // Remarks when status is changed to Hold Customer
  subletRemarks?: string  // Remarks when status is changed to Sublet
  createdAt?: Date
  updatedAt?: Date
}

const jobOrderSchema = new Schema({
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
    enum: ['OG', 'WP', 'UA', 'QI', 'HC', 'HW', 'HI', 'HF', 'SU', 'FR', 'FU', 'CP'], 
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
  },
  holdCustomerRemarks: {
    type: String,
    required: false
  },
  subletRemarks: {
    type: String,
    required: false
  },
  originalJobId: {
    type: Schema.Types.ObjectId,
    ref: 'JobOrder',
    required: false
  },
  carryOverChain: [{
    jobId: { type: Schema.Types.ObjectId, ref: 'JobOrder' },
    date: { type: Date },
    status: { type: String }
  }]
}, { timestamps: true })

// Index for efficient queries
// Note: jobNumber already has unique index from schema definition (unique: true)
jobOrderSchema.index({ status: 1, date: -1 })
jobOrderSchema.index({ assignedTechnician: 1, date: 1 })
jobOrderSchema.index({ createdBy: 1 })
jobOrderSchema.index({ isImportant: 1, date: -1 })
jobOrderSchema.index({ carriedOver: 1, date: -1 })
jobOrderSchema.index({ qiStatus: 1 })
jobOrderSchema.index({ 'timeRange.start': 1, 'timeRange.end': 1 }) // For time slot queries
jobOrderSchema.index({ date: 1, status: 1, carriedOver: 1 }) // Composite index for common dashboard queries
jobOrderSchema.index({ plateNumber: 1 }) // For search queries
jobOrderSchema.index({ vin: 1 }) // For search queries

const JobOrder = mongoose.models.JobOrder || mongoose.model('JobOrder', jobOrderSchema)

module.exports = { JobOrder }
