export interface TimeRange {
  start: string // Format: "07:00"
  end: string   // Format: "12:00"
}

export interface User {
  _id: string
  name: string
  email: string
  level?: string
}

export interface Appointment {
  _id: string
  assignedTechnician: User
  serviceAdvisor?: User | null
  plateNumber: string
  timeRange: TimeRange
  date: string
  createdBy: User
  noShow?: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateAppointmentRequest {
  assignedTechnician: string
  serviceAdvisor: string
  plateNumber: string
  timeRange: TimeRange
  date?: string
}

export interface UpdateAppointmentRequest {
  assignedTechnician?: string
  serviceAdvisor?: string
  plateNumber?: string
  timeRange?: TimeRange
  date?: string
}

