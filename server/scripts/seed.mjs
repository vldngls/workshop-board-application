import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true, enum: ['administrator', 'job-controller', 'technician'] },
  pictureUrl: String,
}, { timestamps: true })

const JobOrderSchema = new mongoose.Schema({
  jobNumber: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTechnician: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
  status: { type: String, enum: ['Incomplete', 'Complete', 'In Progress'], default: 'Incomplete' },
  date: { type: Date, required: true }
}, { timestamps: true })

const User = mongoose.models.User || mongoose.model('User', UserSchema)
const JobOrder = mongoose.models.JobOrder || mongoose.model('JobOrder', JobOrderSchema)

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set')
  await mongoose.connect(uri)

  await User.createIndexes()
  await JobOrder.createIndexes()

  // Clear existing data
  await JobOrder.deleteMany({})
  console.log('Cleared existing job orders')

  // Create users
  const users = []
  
  // Admin
  const admin = await User.findOne({ email: 'admin@example.com' })
  if (!admin) {
    const passwordHash = await bcrypt.hash('admin123', 10)
    const newAdmin = await User.create({
      name: 'Administrator',
      email: 'admin@example.com',
      passwordHash,
      role: 'administrator',
    })
    users.push(newAdmin)
    console.log('Seeded administrator: admin@example.com / admin123')
  } else {
    users.push(admin)
    console.log('Admin user already exists')
  }

  // Job Controller
  const jc = await User.findOne({ email: 'jc@example.com' })
  if (!jc) {
    const passwordHash = await bcrypt.hash('jc12345', 10)
    const newJc = await User.create({
      name: 'Job Controller',
      email: 'jc@example.com',
      passwordHash,
      role: 'job-controller',
    })
    users.push(newJc)
    console.log('Seeded job-controller: jc@example.com / jc12345')
  } else {
    users.push(jc)
  }

  // Technicians
  const technicianData = [
    { name: 'Mike Johnson', email: 'mike@example.com' },
    { name: 'Sarah Williams', email: 'sarah@example.com' },
    { name: 'David Brown', email: 'david@example.com' },
    { name: 'Lisa Davis', email: 'lisa@example.com' },
    { name: 'Tom Wilson', email: 'tom@example.com' }
  ]

  const technicians = []
  for (const techData of technicianData) {
    let tech = await User.findOne({ email: techData.email })
    if (!tech) {
      const passwordHash = await bcrypt.hash('tech1234', 10)
      tech = await User.create({
        name: techData.name,
        email: techData.email,
        passwordHash,
        role: 'technician',
      })
      console.log(`Seeded technician: ${techData.email} / tech1234`)
    }
    technicians.push(tech)
  }

  // Create fake job orders
  const jobOrders = []
  const today = new Date()
  const plateNumbers = ['ABC123', 'XYZ789', 'DEF456', 'GHI789', 'JKL012', 'MNO345', 'PQR678', 'STU901', 'VWX234', 'YZA567']
  const vins = ['1HGBH41JXMN109186', '2HGBH41JXMN109187', '3HGBH41JXMN109188', '4HGBH41JXMN109189', '5HGBH41JXMN109190']
  const jobTypes = [
    ['Oil Change', 'Brake Inspection', 'Tire Rotation'],
    ['Engine Diagnostic', 'Transmission Check', 'Battery Test'],
    ['AC Repair', 'Heater Check', 'Coolant Flush'],
    ['Brake Pad Replacement', 'Brake Fluid Change', 'Rotor Inspection'],
    ['Timing Belt', 'Water Pump', 'Serpentine Belt']
  ]
  const parts = [
    ['Oil Filter', 'Engine Oil', 'Air Filter'],
    ['Brake Pads', 'Brake Fluid', 'Brake Rotors'],
    ['AC Compressor', 'Refrigerant', 'AC Filter'],
    ['Timing Belt Kit', 'Water Pump', 'Thermostat'],
    ['Spark Plugs', 'Ignition Coils', 'Fuel Filter']
  ]

  for (let i = 0; i < 25; i++) {
    const jobNumber = `JO${String(i + 1).padStart(3, '0')}`
    const technician = technicians[Math.floor(Math.random() * technicians.length)]
    const plateNumber = plateNumbers[Math.floor(Math.random() * plateNumbers.length)]
    const vin = vins[Math.floor(Math.random() * vins.length)]
    
    // Random time slots (8 AM to 6 PM) - hourly slots
    const startHour = 8 + Math.floor(Math.random() * 10) // 8 AM to 5 PM
    const endHour = startHour + Math.floor(Math.random() * 3) + 1 // 1-3 hour duration
    
    const timeRange = {
      start: `${String(startHour).padStart(2, '0')}:00`,
      end: `${String(endHour).padStart(2, '0')}:00`
    }
    
    const jobTypeIndex = Math.floor(Math.random() * jobTypes.length)
    const jobList = jobTypes[jobTypeIndex].map(description => ({
      description,
      status: Math.random() < 0.3 ? 'Finished' : 'Unfinished'
    }))
    
    const partsList = parts[jobTypeIndex].map(name => ({
      name,
      availability: Math.random() < 0.8 ? 'Available' : 'Unavailable'
    }))
    
    const statuses = ['Incomplete', 'In Progress', 'Complete']
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    
    // Random date within the next 7 days
    const randomDays = Math.floor(Math.random() * 7)
    const jobDate = new Date(today)
    jobDate.setDate(today.getDate() + randomDays)
    
    const jobOrder = await JobOrder.create({
      jobNumber,
      createdBy: users[0]._id, // Admin created all
      assignedTechnician: technician._id,
      plateNumber,
      vin,
      timeRange,
      jobList,
      parts: partsList,
      status,
      date: jobDate
    })
    
    jobOrders.push(jobOrder)
  }

  console.log(`Created ${jobOrders.length} job orders`)
  console.log(`Created ${technicians.length} technicians`)
  console.log('Seed data completed successfully!')

  await mongoose.disconnect()
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})


