export type JobStatus = 'Incomplete' | 'Complete' | 'In Progress'
export type JobItemStatus = 'Finished' | 'Unfinished'
export type PartAvailability = 'Available' | 'Unavailable'

export interface JobItem {
  description: string
  status: JobItemStatus
}

export interface Part {
  name: string
  availability: PartAvailability
}

export interface TimeRange {
  start: string // Format: "07:00"
  end: string   // Format: "12:00"
}

export interface User {
  _id: string
  name: string
  email: string
}

export interface JobOrder {
  _id: string
  jobNumber: string
  createdBy: User
  assignedTechnician: User
  plateNumber: string
  vin: string
  timeRange: TimeRange
  jobList: JobItem[]
  parts: Part[]
  status: JobStatus
  date: string
  createdAt: string
  updatedAt: string
}

export interface CreateJobOrderRequest {
  jobNumber: string
  assignedTechnician: string
  plateNumber: string
  vin: string
  timeRange: TimeRange
  jobList: JobItem[]
  parts: Part[]
  date?: string
}

export interface UpdateJobOrderRequest {
  assignedTechnician?: string
  plateNumber?: string
  vin?: string
  timeRange?: TimeRange
  jobList?: JobItem[]
  parts?: Part[]
  status?: JobStatus
}

export interface Technician {
  _id: string
  name: string
  email: string
}
