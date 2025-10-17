import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, unique: true, sparse: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true, enum: ['administrator', 'job-controller', 'technician', 'service-advisor'] },
  pictureUrl: String,
  level: { 
    type: String, 
    enum: ['untrained', 'level-0', 'level-1', 'level-2', 'level-3'],
    required: function() { return this.role === 'technician' }
  },
}, { timestamps: true })

const JobOrderSchema = new mongoose.Schema({
  jobNumber: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTechnician: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  serviceAdvisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  plateNumber: { type: String, required: true },
  vin: { type: String, required: true },
  timeRange: {
    start: { type: String, required: true },
    end: { type: String, required: true }
  },
  jobList: [{
    description: { type: String, required: true },
    status: { type: String, enum: ['Finished', 'Unfinished'], default: 'Unfinished' }
  }],
  parts: [{
    name: { type: String, required: true },
    availability: { type: String, enum: ['Available', 'Unavailable'], default: 'Available' }
  }],
  status: { type: String, enum: ['OG', 'WP', 'QI', 'HC', 'HW', 'HI', 'FR', 'FU'], default: 'OG' },
  date: { type: Date, required: true },
  originalCreatedDate: { type: Date, required: true, default: Date.now },
  sourceType: { type: String, enum: ['appointment', 'carry-over', 'direct'], default: 'direct' },
  carriedOver: { type: Boolean, default: false },
  isImportant: { type: Boolean, default: false },
  qiStatus: { type: String, enum: ['pending', 'approved', 'rejected', null], default: null }
}, { timestamps: true })

const User = mongoose.models.User || mongoose.model('User', UserSchema)
const JobOrder = mongoose.models.JobOrder || mongoose.model('JobOrder', JobOrderSchema)

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set')
  await mongoose.connect(uri)

  await User.createIndexes()
  await JobOrder.createIndexes()

  // Clear ALL existing data including users
  await JobOrder.deleteMany({})
  await User.deleteMany({})
  console.log('Cleared all existing data (users and job orders)')

  // Create users with password 'test123456'
  const passwordHash = await bcrypt.hash('test123456', 10)
  const users = []
  
  // Admin
  const admin = await User.create({
    name: 'Admin',
    email: 'admin@workshop.com',
    username: 'admin',
    passwordHash,
    role: 'administrator',
  })
  users.push(admin)
  console.log('Created Admin: username: admin / password: test123456')

  // Job Controller
  const jobController = await User.create({
    name: 'Job Controller',
    email: 'jobcontroller@workshop.com',
    username: 'jobcontroller',
    passwordHash,
    role: 'job-controller',
  })
  users.push(jobController)
  console.log('Created Job Controller: username: jobcontroller / password: test123456')

  // Technicians 1-5
  const technicianData = [
    { name: 'Technician 1', email: 'tech1@workshop.com', username: 'technician1', level: 'level-3' },
    { name: 'Technician 2', email: 'tech2@workshop.com', username: 'technician2', level: 'level-2' },
    { name: 'Technician 3', email: 'tech3@workshop.com', username: 'technician3', level: 'level-1' },
    { name: 'Technician 4', email: 'tech4@workshop.com', username: 'technician4', level: 'level-0' },
    { name: 'Technician 5', email: 'tech5@workshop.com', username: 'technician5', level: 'untrained' }
  ]

  const technicians = []
  for (const techData of technicianData) {
    const tech = await User.create({
      name: techData.name,
      email: techData.email,
      username: techData.username,
      passwordHash,
      role: 'technician',
      level: techData.level,
    })
    technicians.push(tech)
    console.log(`Created ${techData.name}: username: ${techData.username} / password: test123456`)
  }

  // Service Advisors 1-5
  const serviceAdvisorData = [
    { name: 'Service Advisor 1', email: 'sa1@workshop.com', username: 'serviceadvisor1' },
    { name: 'Service Advisor 2', email: 'sa2@workshop.com', username: 'serviceadvisor2' },
    { name: 'Service Advisor 3', email: 'sa3@workshop.com', username: 'serviceadvisor3' },
    { name: 'Service Advisor 4', email: 'sa4@workshop.com', username: 'serviceadvisor4' },
    { name: 'Service Advisor 5', email: 'sa5@workshop.com', username: 'serviceadvisor5' }
  ]

  const serviceAdvisors = []
  for (const saData of serviceAdvisorData) {
    const sa = await User.create({
      name: saData.name,
      email: saData.email,
      username: saData.username,
      passwordHash,
      role: 'service-advisor',
    })
    serviceAdvisors.push(sa)
    console.log(`Created ${saData.name}: username: ${saData.username} / password: test123456`)
  }

  console.log(`Created ${technicians.length} technicians`)
  console.log(`Created ${serviceAdvisors.length} service advisors`)
  console.log('Seed data completed successfully!')

  await mongoose.disconnect()
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})


