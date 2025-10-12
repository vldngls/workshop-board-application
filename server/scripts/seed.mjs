import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true, enum: ['administrator', 'job-controller', 'technician'] },
  pictureUrl: String,
  level: { 
    type: String, 
    enum: ['Junior', 'Senior', 'Master', 'Lead'],
    required: function() { return this.role === 'technician' }
  },
}, { timestamps: true })

const JobOrderSchema = new mongoose.Schema({
  jobNumber: { type: String, required: true, unique: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTechnician: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
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
    { name: 'Mike Johnson', email: 'mike@example.com', level: 'Lead' },
    { name: 'Sarah Williams', email: 'sarah@example.com', level: 'Master' },
    { name: 'David Brown', email: 'david@example.com', level: 'Senior' },
    { name: 'Lisa Davis', email: 'lisa@example.com', level: 'Senior' },
    { name: 'Tom Wilson', email: 'tom@example.com', level: 'Junior' }
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
        level: techData.level,
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

  // Helper function to calculate end time accounting for lunch break
  function calculateEndTimeWithBreak(startTime, endTime, breakStart = '12:00', breakEnd = '13:00') {
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const [originalEndHour, originalEndMinute] = endTime.split(':').map(Number)
    const [breakStartHour, breakStartMinute] = breakStart.split(':').map(Number)
    const [breakEndHour, breakEndMinute] = breakEnd.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMinute
    const originalEndMinutes = originalEndHour * 60 + originalEndMinute
    const breakStartMinutes = breakStartHour * 60 + breakStartMinute
    const breakEndMinutes = breakEndHour * 60 + breakEndMinute
    
    const breakDuration = breakEndMinutes - breakStartMinutes
    
    // Check if work period overlaps with break
    if (startMinutes < breakEndMinutes && originalEndMinutes > breakStartMinutes) {
      // The break falls within the work period - add break duration to skip it
      const newEndMinutes = originalEndMinutes + breakDuration
      const newEndHour = Math.floor(newEndMinutes / 60)
      const newEndMin = newEndMinutes % 60
      return `${String(newEndHour).padStart(2, '0')}:${String(newEndMin).padStart(2, '0')}`
    }
    
    // No overlap with break, return original end time
    return endTime
  }

  // Create some specific job orders for today to demonstrate the new statuses
  const todayJobs = [
    {
      jobNumber: 'JO001',
      plateNumber: 'ABC123',
      vin: '1HGBH41JXMN109186',
      timeRange: { start: '08:00', end: '11:00' },
      jobList: [
        { description: 'Oil Change', status: 'Finished' },
        { description: 'Brake Inspection', status: 'Unfinished' },
        { description: 'Tire Rotation', status: 'Unfinished' }
      ],
      parts: [
        { name: 'Oil Filter', availability: 'Available' },
        { name: 'Engine Oil', availability: 'Available' },
        { name: 'Air Filter', availability: 'Available' }
      ],
      status: 'OG' // On Going
    },
    {
      jobNumber: 'JO002',
      plateNumber: 'XYZ789',
      vin: '2HGBH41JXMN109187',
      timeRange: { start: '09:00', end: '12:00' },
      jobList: [
        { description: 'Engine Diagnostic', status: 'Finished' },
        { description: 'Transmission Check', status: 'Finished' },
        { description: 'Battery Test', status: 'Unfinished' }
      ],
      parts: [
        { name: 'Spark Plugs', availability: 'Available' },
        { name: 'Ignition Coils', availability: 'Unavailable' },
        { name: 'Fuel Filter', availability: 'Available' }
      ],
      status: 'WP' // Waiting Parts
    },
    {
      jobNumber: 'JO003',
      plateNumber: 'DEF456',
      vin: '3HGBH41JXMN109188',
      timeRange: { start: '13:00', end: '14:00' },
      jobList: [
        { description: 'AC Repair', status: 'Finished' },
        { description: 'Heater Check', status: 'Finished' },
        { description: 'Coolant Flush', status: 'Finished' }
      ],
      parts: [
        { name: 'AC Compressor', availability: 'Available' },
        { name: 'Refrigerant', availability: 'Available' },
        { name: 'AC Filter', availability: 'Available' }
      ],
      status: 'FR' // For Release
    },
    {
      jobNumber: 'JO004',
      plateNumber: 'GHI789',
      vin: '4HGBH41JXMN109189',
      timeRange: { start: '10:30', end: calculateEndTimeWithBreak('10:30', '12:30') },
      jobList: [
        { description: 'Brake Pad Replacement', status: 'Finished' },
        { description: 'Brake Fluid Change', status: 'Finished' },
        { description: 'Rotor Inspection', status: 'Unfinished' }
      ],
      parts: [
        { name: 'Brake Pads', availability: 'Available' },
        { name: 'Brake Fluid', availability: 'Available' },
        { name: 'Brake Rotors', availability: 'Available' }
      ],
      status: 'QI' // Quality Inspection
    },
    {
      jobNumber: 'JO005',
      plateNumber: 'JKL012',
      vin: '5HGBH41JXMN109190',
      timeRange: { start: '14:00', end: '16:00' },
      jobList: [
        { description: 'Timing Belt', status: 'Unfinished' },
        { description: 'Water Pump', status: 'Unfinished' },
        { description: 'Serpentine Belt', status: 'Unfinished' }
      ],
      parts: [
        { name: 'Timing Belt Kit', availability: 'Available' },
        { name: 'Water Pump', availability: 'Available' },
        { name: 'Thermostat', availability: 'Available' }
      ],
      status: 'HC' // Hold Customer
    }
  ]

  // Helper function to check for time overlaps
  function hasTimeOverlap(newStart, newEnd, existingJobs) {
    const newStartTime = parseInt(newStart.split(':')[0]) * 60 + parseInt(newStart.split(':')[1])
    const newEndTime = parseInt(newEnd.split(':')[0]) * 60 + parseInt(newEnd.split(':')[1])
    
    return existingJobs.some(job => {
      const existingStartTime = parseInt(job.timeRange.start.split(':')[0]) * 60 + parseInt(job.timeRange.start.split(':')[1])
      const existingEndTime = parseInt(job.timeRange.end.split(':')[0]) * 60 + parseInt(job.timeRange.end.split(':')[1])
      
      // Check if times overlap
      return (newStartTime < existingEndTime && newEndTime > existingStartTime)
    })
  }

  // Create today's specific jobs with overlap prevention
  const technicianSchedules = {} // Track each technician's jobs for today
  
  for (let idx = 0; idx < todayJobs.length; idx++) {
    const jobData = todayJobs[idx]
    let technician
    let attempts = 0
    const maxAttempts = 10
    
    // Try to find a technician without time conflicts
    do {
      technician = technicians[Math.floor(Math.random() * technicians.length)]
      attempts++
      
      if (!technicianSchedules[technician._id]) {
        technicianSchedules[technician._id] = []
      }
      
      if (!hasTimeOverlap(jobData.timeRange.start, jobData.timeRange.end, technicianSchedules[technician._id])) {
        break
      }
    } while (attempts < maxAttempts)
    
    // Add special properties to some jobs for testing
    const specialProps = {}
    if (idx === 0) {
      // First job: carried over and important
      specialProps.carriedOver = true
      specialProps.isImportant = true
    } else if (idx === 1) {
      // Second job: important only (with unavailable parts - should be WP)
      specialProps.isImportant = true
    } else if (idx === 3) {
      // Fourth job: QI with pending status
      specialProps.qiStatus = 'pending'
    }
    
    const jobOrder = await JobOrder.create({
      ...jobData,
      ...specialProps,
      createdBy: users[0]._id, // Admin created all
      assignedTechnician: technician._id,
      date: today
    })
    
    // Track this job for the technician
    technicianSchedules[technician._id].push(jobData)
    jobOrders.push(jobOrder)
  }

  // Create additional random job orders with overlap prevention
  for (let i = 6; i < 30; i++) {
    const jobNumber = `JO${String(i + 1).padStart(3, '0')}`
    const plateNumber = plateNumbers[Math.floor(Math.random() * plateNumbers.length)]
    const vin = vins[Math.floor(Math.random() * vins.length)]
    
    let technician
    let timeRange
    let attempts = 0
    const maxAttempts = 20
    
    // Try to find a valid time slot without conflicts
    do {
      technician = technicians[Math.floor(Math.random() * technicians.length)]
      
      // Random time slots (7 AM to 5 PM) - 30-minute slots
      const startHour = 7 + Math.floor(Math.random() * 10) // 7 AM to 4 PM
      const startMinute = Math.random() < 0.5 ? 0 : 30 // 0 or 30 minutes
      const duration = Math.floor(Math.random() * 4) + 1 // 1-4 hours (2-8 slots)
      
      const startTime = startHour * 60 + startMinute
      const endTime = startTime + (duration * 60)
      const endHour = Math.floor(endTime / 60)
      const endMinute = endTime % 60
      
      const originalStart = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`
      const originalEnd = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
      
      timeRange = {
        start: originalStart,
        end: calculateEndTimeWithBreak(originalStart, originalEnd)
      }
      
      attempts++
      
      // Check if this time conflicts with existing jobs for this technician
      if (!technicianSchedules[technician._id]) {
        technicianSchedules[technician._id] = []
      }
      
      if (!hasTimeOverlap(timeRange.start, timeRange.end, technicianSchedules[technician._id])) {
        break
      }
    } while (attempts < maxAttempts)
    
    const jobTypeIndex = Math.floor(Math.random() * jobTypes.length)
    const jobList = jobTypes[jobTypeIndex].map(description => ({
      description,
      status: Math.random() < 0.3 ? 'Finished' : 'Unfinished'
    }))
    
    const partsList = parts[jobTypeIndex].map(name => ({
      name,
      availability: Math.random() < 0.8 ? 'Available' : 'Unavailable'
    }))
    
    // More realistic status distribution
    const statusWeights = [
      { status: 'OG', weight: 0.3 },   // 30% On Going
      { status: 'FR', weight: 0.2 },   // 20% For Release
      { status: 'WP', weight: 0.15 },  // 15% Waiting Parts
      { status: 'QI', weight: 0.1 },   // 10% Quality Inspection
      { status: 'HC', weight: 0.1 },   // 10% Hold Customer
      { status: 'HW', weight: 0.05 },  // 5% Hold Warranty
      { status: 'HI', weight: 0.05 },  // 5% Hold Insurance
      { status: 'FU', weight: 0.05 }   // 5% Finished Unclaimed
    ]
    
    const random = Math.random()
    let cumulativeWeight = 0
    let status = 'OG' // default
    
    for (const { status: statusCode, weight } of statusWeights) {
      cumulativeWeight += weight
      if (random <= cumulativeWeight) {
        status = statusCode
        break
      }
    }
    
    // Random date - mix of past, present, and future jobs
    let randomDays
    if (i < 9) {
      // Create some overdue jobs (10-15 days ago) for anomaly testing
      randomDays = -10 - Math.floor(Math.random() * 5)
    } else if (i < 12) {
      // Create some yesterday jobs for carry-over testing
      randomDays = -1
    } else {
      // Random date within the next 7 days
      randomDays = Math.floor(Math.random() * 7)
    }
    
    const jobDate = new Date(today)
    jobDate.setDate(today.getDate() + randomDays)
    
    // Add special properties to some jobs
    const specialProps = {}
    let skipTechnicianAssignment = false
    
    if (i === 6 || i === 7) {
      // Some old overdue jobs that are important
      specialProps.isImportant = true
    }
    if (i === 10 || i === 11) {
      // Yesterday's unfinished jobs marked as carried over - need reassignment
      specialProps.carriedOver = true
      skipTechnicianAssignment = true
      // Set time to morning slots for reassignment
      timeRange = {
        start: '08:00',
        end: '10:00'
      }
    }
    if (i === 15) {
      // Job with all tasks finished but not submitted for QI (anomaly)
      jobList.forEach(task => task.status = 'Finished')
    }
    
    const jobOrder = await JobOrder.create({
      jobNumber,
      createdBy: users[0]._id, // Admin created all
      assignedTechnician: skipTechnicianAssignment ? null : technician._id,
      plateNumber,
      vin,
      timeRange,
      jobList,
      parts: partsList,
      status,
      date: jobDate,
      ...specialProps
    })
    
    // Track this job for the technician (only for today's jobs)
    if (jobDate.toDateString() === today.toDateString()) {
      technicianSchedules[technician._id].push({ timeRange })
    }
    
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


