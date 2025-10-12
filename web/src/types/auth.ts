export type Role = 'administrator' | 'job-controller' | 'technician'
export type TechnicianLevel = 'Junior' | 'Senior' | 'Master' | 'Lead'

export interface User {
  _id: string
  name: string
  email: string
  role: Role
  level?: TechnicianLevel
  pictureUrl?: string
  createdAt?: string
  updatedAt?: string
}


