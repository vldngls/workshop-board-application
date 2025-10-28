export type Role = 'administrator' | 'job-controller' | 'technician' | 'service-advisor' | 'superadmin'
export type TechnicianLevel = 'untrained' | 'level-0' | 'level-1' | 'level-2' | 'level-3'

export interface BreakTime {
  description: string
  startTime: string // Format: "12:00"
  endTime: string   // Format: "13:00"
}

export interface User {
  _id: string
  name: string
  email: string
  username?: string
  role: Role
  level?: TechnicianLevel
  pictureUrl?: string
  breakTimes?: BreakTime[] // Only for technicians
  createdAt?: string
  updatedAt?: string
}


