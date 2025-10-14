import mongoose, { Schema } from 'mongoose'

export type Role = 'administrator' | 'job-controller' | 'technician' | 'service-advisor'
export type TechnicianLevel = 'untrained' | 'level-0' | 'level-1' | 'level-2' | 'level-3'

export interface UserDoc {
  name: string
  email: string
  username?: string
  passwordHash: string
  role: Role
  pictureUrl?: string
  level?: TechnicianLevel // Only for technicians
}

const userSchema = new Schema<UserDoc>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  username: { type: String, unique: true, sparse: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true, enum: ['administrator', 'job-controller', 'technician', 'service-advisor'] },
  pictureUrl: String,
  level: { 
    type: String, 
    enum: ['untrained', 'level-0', 'level-1', 'level-2', 'level-3'],
    required: function() { return this.role === 'technician' }
  },
}, { timestamps: true })

export const User = mongoose.models.User || mongoose.model<UserDoc>('User', userSchema)


