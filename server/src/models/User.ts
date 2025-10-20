const mongoose = require('mongoose')
const { Schema } = mongoose

type Role = 'administrator' | 'job-controller' | 'technician' | 'service-advisor'
type TechnicianLevel = 'untrained' | 'level-0' | 'level-1' | 'level-2' | 'level-3'

interface UserDoc {
  name: string
  email: string
  username?: string
  passwordHash: string
  role: Role
  pictureUrl?: string
  level?: TechnicianLevel // Only for technicians
}

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  username: { type: String, unique: true, sparse: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true, enum: ['administrator', 'job-controller', 'technician', 'service-advisor'] },
  pictureUrl: String,
  level: { 
    type: String, 
    enum: ['untrained', 'level-0', 'level-1', 'level-2', 'level-3'],
    required: function(this: any): boolean { return this.role === 'technician' }
  },
}, { timestamps: true })

const User = mongoose.models.User || mongoose.model('User', userSchema)

module.exports = { User }


