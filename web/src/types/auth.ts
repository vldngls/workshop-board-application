export type Role = 'administrator' | 'job-controller' | 'technician' | 'service-advisor'
export type TechnicianLevel = 'untrained' | 'level-0' | 'level-1' | 'level-2' | 'level-3'

export interface User {
  _id: string
  name: string
  email: string
  username?: string
  role: Role
  level?: TechnicianLevel
  pictureUrl?: string
  createdAt?: string
  updatedAt?: string
}


