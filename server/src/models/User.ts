import mongoose, { Schema } from 'mongoose'

export type Role = 'administrator' | 'job-controller' | 'technician'
export type TechnicianLevel = 'Junior' | 'Senior' | 'Master' | 'Lead'

export interface UserDoc {
  name: string
  email: string
  passwordHash: string
  role: Role
  pictureUrl?: string
  level?: TechnicianLevel // Only for technicians
}

const userSchema = new Schema<UserDoc>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true, enum: ['administrator', 'job-controller', 'technician'] },
  pictureUrl: String,
  level: { 
    type: String, 
    enum: ['Junior', 'Senior', 'Master', 'Lead'],
    required: function() { return this.role === 'technician' }
  },
}, { timestamps: true })

export const User = mongoose.models.User || mongoose.model<UserDoc>('User', userSchema)


