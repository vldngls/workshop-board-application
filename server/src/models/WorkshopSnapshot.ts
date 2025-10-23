import mongoose, { Schema, Document } from 'mongoose'

export interface WorkshopSnapshotDoc extends Document {
  date: Date
  snapshotDate: Date // When the snapshot was taken
  createdBy: mongoose.Types.ObjectId
  jobOrders: Array<{
    _id: string
    jobNumber: string
    createdBy: {
      _id: string
      name: string
      email: string
    }
    assignedTechnician: {
      _id: string
      name: string
      email: string
    } | null
    serviceAdvisor: {
      _id: string
      name: string
      email: string
    } | null
    plateNumber: string
    vin: string
    timeRange: {
      start: string
      end: string
    }
    actualEndTime?: string
    jobList: Array<{
      description: string
      status: 'Finished' | 'Unfinished'
    }>
    parts: Array<{
      name: string
      availability: 'Available' | 'Unavailable'
    }>
    status: 'OG' | 'WP' | 'UA' | 'QI' | 'HC' | 'HW' | 'HI' | 'HF' | 'SU' | 'FR' | 'FU' | 'CP'
    date: Date
    originalCreatedDate: Date
    sourceType: 'appointment' | 'carry-over' | 'direct'
    carriedOver: boolean
    isImportant: boolean
    qiStatus: 'pending' | 'approved' | 'rejected' | null
    holdCustomerRemarks?: string
    subletRemarks?: string
    originalJobId?: string
    carryOverChain?: Array<{
      jobId: string
      date: Date
      status: string
    }>
    createdAt: Date
    updatedAt: Date
  }>
  statistics: {
    totalJobs: number
    onGoing: number
    forRelease: number
    onHold: number
    carriedOver: number
    important: number
    qualityInspection: number
    finishedUnclaimed: number
  }
  carryOverJobs: Array<{
    _id: string
    jobNumber: string
    plateNumber: string
    status: string
    reason: string // Why it was carried over
  }>
  createdAt: Date
  updatedAt: Date
}

const workshopSnapshotSchema = new Schema({
  date: {
    type: Date,
    required: true,
    index: true // For efficient querying by date
  },
  snapshotDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  jobOrders: [{
    _id: { type: String, required: true },
    jobNumber: { type: String, required: true },
    createdBy: {
      _id: { type: String, required: true },
      name: { type: String, required: true },
      email: { type: String, required: true }
    },
    assignedTechnician: {
      _id: { type: String, required: false },
      name: { type: String, required: false },
      email: { type: String, required: false }
    },
    serviceAdvisor: {
      _id: { type: String, required: false },
      name: { type: String, required: false },
      email: { type: String, required: false }
    },
    plateNumber: { type: String, required: true },
    vin: { type: String, required: true },
    timeRange: {
      start: { type: String, required: true },
      end: { type: String, required: true }
    },
    actualEndTime: { type: String, required: false },
    jobList: [{
      description: { type: String, required: true },
      status: { type: String, enum: ['Finished', 'Unfinished'], required: true }
    }],
    parts: [{
      name: { type: String, required: true },
      availability: { type: String, enum: ['Available', 'Unavailable'], required: true }
    }],
    status: {
      type: String,
      enum: ['OG', 'WP', 'UA', 'QI', 'HC', 'HW', 'HI', 'HF', 'SU', 'FR', 'FU', 'CP'],
      required: true
    },
    date: { type: Date, required: true },
    originalCreatedDate: { type: Date, required: true },
    sourceType: {
      type: String,
      enum: ['appointment', 'carry-over', 'direct'],
      required: true
    },
    carriedOver: { type: Boolean, required: true },
    isImportant: { type: Boolean, required: true },
    qiStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected', null],
      required: false
    },
    holdCustomerRemarks: { type: String, required: false },
    subletRemarks: { type: String, required: false },
    originalJobId: { type: String, required: false },
    carryOverChain: [{
      jobId: { type: String, required: true },
      date: { type: Date, required: true },
      status: { type: String, required: true }
    }],
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true }
  }],
  statistics: {
    totalJobs: { type: Number, required: true },
    onGoing: { type: Number, required: true },
    forRelease: { type: Number, required: true },
    onHold: { type: Number, required: true },
    carriedOver: { type: Number, required: true },
    important: { type: Number, required: true },
    qualityInspection: { type: Number, required: true },
    finishedUnclaimed: { type: Number, required: true }
  },
  carryOverJobs: [{
    _id: { type: String, required: true },
    jobNumber: { type: String, required: true },
    plateNumber: { type: String, required: true },
    status: { type: String, required: true },
    reason: { type: String, required: true }
  }]
}, { timestamps: true })

// Index for efficient querying
workshopSnapshotSchema.index({ date: -1 })
workshopSnapshotSchema.index({ snapshotDate: -1 })

export const WorkshopSnapshot = mongoose.model<WorkshopSnapshotDoc>('WorkshopSnapshot', workshopSnapshotSchema)
