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
  breakTimes: [{
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    description: { type: String, default: 'Break' }
  }]
}, { timestamps: true })

const JobOrderSchema = new mongoose.Schema({
  jobNumber: { type: String, required: true, unique: true, uppercase: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTechnician: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  serviceAdvisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  plateNumber: { type: String, required: true, uppercase: true },
  vin: { type: String, required: true, uppercase: true },
  timeRange: {
    start: { type: String, required: true },
    end: { type: String, required: true }
  },
  actualEndTime: { type: String, required: false },
  jobList: [{
    description: { type: String, required: true },
    status: { type: String, enum: ['Finished', 'Unfinished'], default: 'Unfinished' }
  }],
  parts: [{
    name: { type: String, required: true },
    availability: { type: String, enum: ['Available', 'Unavailable'], default: 'Available' }
  }],
  status: { 
    type: String, 
    enum: ['OG', 'WP', 'UA', 'QI', 'HC', 'HW', 'HI', 'HF', 'SU', 'FR', 'FU', 'CP'], 
    required: true,
    default: 'OG'
  },
  date: { type: Date, required: true },
  originalCreatedDate: { type: Date, required: true, default: Date.now },
  sourceType: { type: String, enum: ['appointment', 'carry-over', 'direct'], default: 'direct' },
  carriedOver: { type: Boolean, default: false },
  isImportant: { type: Boolean, default: false },
  qiStatus: { type: String, enum: ['pending', 'approved', 'rejected', null], default: null },
  holdCustomerRemarks: { type: String, required: false },
  subletRemarks: { type: String, required: false }
}, { timestamps: true })

const User = mongoose.models.User || mongoose.model('User', UserSchema)
const JobOrder = mongoose.models.JobOrder || mongoose.model('JobOrder', JobOrderSchema)

// Realistic automotive data
const carMakes = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'BMW', 'Mercedes', 'Audi', 'Volkswagen', 'Hyundai', 'Kia', 'Mazda', 'Subaru', 'Lexus', 'Acura', 'Infiniti', 'Genesis']
const carModels = ['Camry', 'Civic', 'F-150', 'Silverado', 'Altima', '3 Series', 'C-Class', 'A4', 'Jetta', 'Elantra', 'Sorento', 'CX-5', 'Outback', 'ES', 'TLX', 'Q50', 'G90']

const realisticJobTasks = [
  // Oil Change Services
  { description: 'Drain engine oil', status: 'Finished' },
  { description: 'Replace oil filter', status: 'Finished' },
  { description: 'Add new engine oil', status: 'Finished' },
  { description: 'Check oil level', status: 'Finished' },
  
  // Brake Services
  { description: 'Remove brake pads', status: 'Finished' },
  { description: 'Inspect brake rotors', status: 'Finished' },
  { description: 'Install new brake pads', status: 'Finished' },
  { description: 'Bleed brake system', status: 'Finished' },
  { description: 'Test brake function', status: 'Unfinished' },
  
  // Transmission Services
  { description: 'Drain transmission fluid', status: 'Finished' },
  { description: 'Replace transmission filter', status: 'Finished' },
  { description: 'Add new transmission fluid', status: 'Finished' },
  { description: 'Check fluid level', status: 'Unfinished' },
  
  // Engine Services
  { description: 'Remove air filter', status: 'Finished' },
  { description: 'Install new air filter', status: 'Finished' },
  { description: 'Replace spark plugs', status: 'Finished' },
  { description: 'Check engine timing', status: 'Unfinished' },
  
  // Battery Services
  { description: 'Test battery voltage', status: 'Finished' },
  { description: 'Remove old battery', status: 'Finished' },
  { description: 'Install new battery', status: 'Finished' },
  { description: 'Test charging system', status: 'Unfinished' },
  
  // Suspension Services
  { description: 'Inspect suspension components', status: 'Finished' },
  { description: 'Replace shock absorbers', status: 'Finished' },
  { description: 'Check wheel alignment', status: 'Unfinished' },
  
  // AC Services
  { description: 'Check AC refrigerant level', status: 'Finished' },
  { description: 'Test AC compressor', status: 'Finished' },
  { description: 'Recharge AC system', status: 'Unfinished' },
  
  // Timing Belt Services
  { description: 'Remove timing belt cover', status: 'Finished' },
  { description: 'Replace timing belt', status: 'Finished' },
  { description: 'Replace water pump', status: 'Finished' },
  { description: 'Reassemble timing components', status: 'Unfinished' }
]

const realisticParts = [
  { name: 'Engine Oil 5W-30', availability: 'Available' },
  { name: 'Oil Filter', availability: 'Available' },
  { name: 'Brake Pads (Front)', availability: 'Available' },
  { name: 'Brake Pads (Rear)', availability: 'Available' },
  { name: 'Brake Rotors (Front)', availability: 'Available' },
  { name: 'Brake Rotors (Rear)', availability: 'Available' },
  { name: 'Brake Fluid', availability: 'Available' },
  { name: 'Transmission Fluid', availability: 'Available' },
  { name: 'Transmission Filter', availability: 'Available' },
  { name: 'Air Filter', availability: 'Available' },
  { name: 'Spark Plugs (Set of 4)', availability: 'Available' },
  { name: 'Car Battery', availability: 'Available' },
  { name: 'Timing Belt', availability: 'Available' },
  { name: 'Water Pump', availability: 'Available' },
  { name: 'Shock Absorbers (Front)', availability: 'Available' },
  { name: 'Shock Absorbers (Rear)', availability: 'Available' },
  { name: 'AC Refrigerant', availability: 'Available' },
  { name: 'Power Steering Fluid', availability: 'Available' },
  { name: 'Coolant/Antifreeze', availability: 'Available' },
  { name: 'Serpentine Belt', availability: 'Available' },
  // Some unavailable parts for realistic scenarios
  { name: 'Catalytic Converter', availability: 'Unavailable' },
  { name: 'Alternator', availability: 'Unavailable' },
  { name: 'Starter Motor', availability: 'Unavailable' },
  { name: 'Headlight Assembly', availability: 'Unavailable' }
]

const timeSlots = [
  { start: '07:00', end: '08:30' },
  { start: '08:30', end: '10:00' },
  { start: '10:00', end: '11:30' },
  { start: '11:30', end: '13:00' },
  { start: '13:00', end: '14:30' },
  { start: '14:30', end: '16:00' },
  { start: '16:00', end: '17:30' },
  { start: '17:30', end: '19:00' }
]

// Helper functions
function generateVIN() {
  const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789'
  let vin = ''
  for (let i = 0; i < 17; i++) {
    vin += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return vin
}

function generatePlateNumber() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  let plate = ''
  
  // Generate format like ABC-1234
  for (let i = 0; i < 3; i++) {
    plate += letters.charAt(Math.floor(Math.random() * letters.length))
  }
  plate += '-'
  for (let i = 0; i < 4; i++) {
    plate += numbers.charAt(Math.floor(Math.random() * numbers.length))
  }
  
  return plate
}

function generateJobNumber() {
  const year = new Date().getFullYear()
  const month = String(new Date().getMonth() + 1).padStart(2, '0')
  const randomNum = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
  return `${year}${month}${randomNum}`
}

function getRandomJobTasks() {
  const numTasks = Math.floor(Math.random() * 3) + 2 // 2-4 tasks
  const shuffled = [...realisticJobTasks].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, numTasks)
}

function getRandomParts() {
  const numParts = Math.floor(Math.random() * 3) + 1 // 1-3 parts
  const shuffled = [...realisticParts].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, numParts)
}

function determineInitialStatus(parts) {
  // If any part is unavailable, status should be WP (Waiting Parts)
  const hasUnavailableParts = parts.some(part => part.availability === 'Unavailable')
  return hasUnavailableParts ? 'WP' : 'OG'
}

function getRandomTimeSlot() {
  return timeSlots[Math.floor(Math.random() * timeSlots.length)]
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set')
  await mongoose.connect(uri)

  await User.createIndexes()
  await JobOrder.createIndexes()

  // Clear ALL existing data
  await JobOrder.deleteMany({})
  await User.deleteMany({})
  console.log('Cleared all existing data (users and job orders)')

  // Create users with password 'test123456'
  const passwordHash = await bcrypt.hash('test123456', 10)
  
  // Admin
  const admin = await User.create({
    name: 'Admin',
    email: 'admin@workshop.com',
    username: 'admin',
    passwordHash,
    role: 'administrator',
  })
  console.log('Created Admin: username: admin / password: test123456')

  // Job Controller
  const jobController = await User.create({
    name: 'Job Controller',
    email: 'jobcontroller@workshop.com',
    username: 'jobcontroller',
    passwordHash,
    role: 'job-controller',
  })
  console.log('Created Job Controller: username: jobcontroller / password: test123456')

  // Technicians with break times
  const technicianData = [
    { name: 'Technician 1', email: 'tech1@workshop.com', username: 'technician1', level: 'level-3', breakTimes: [{ startTime: '12:00', endTime: '13:00', description: 'Lunch Break' }] },
    { name: 'Technician 2', email: 'tech2@workshop.com', username: 'technician2', level: 'level-2', breakTimes: [{ startTime: '12:00', endTime: '13:00', description: 'Lunch Break' }] },
    { name: 'Technician 3', email: 'tech3@workshop.com', username: 'technician3', level: 'level-1', breakTimes: [{ startTime: '12:00', endTime: '13:00', description: 'Lunch Break' }] },
    { name: 'Technician 4', email: 'tech4@workshop.com', username: 'technician4', level: 'level-0', breakTimes: [{ startTime: '12:00', endTime: '13:00', description: 'Lunch Break' }] },
    { name: 'Technician 5', email: 'tech5@workshop.com', username: 'technician5', level: 'untrained', breakTimes: [{ startTime: '12:00', endTime: '13:00', description: 'Lunch Break' }] }
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
      breakTimes: techData.breakTimes
    })
    technicians.push(tech)
    console.log(`Created ${techData.name}: username: ${techData.username} / password: test123456`)
  }

  // Service Advisors
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

  // Generate job orders for multiple days
  const today = new Date()
  const dates = [
    new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    today // today
  ]

  let jobCount = 0
  const jobStatuses = ['OG', 'WP', 'UA', 'QI', 'HC', 'HW', 'HI', 'HF', 'SU', 'FR', 'FU', 'CP']

  for (const date of dates) {
    console.log(`\nGenerating jobs for ${date.toDateString()}...`)
    
    // Generate 8-12 jobs per day
    const jobsPerDay = Math.floor(Math.random() * 5) + 8
    
    for (let i = 0; i < jobsPerDay; i++) {
      const timeSlot = getRandomTimeSlot()
      const jobTasks = getRandomJobTasks()
      const parts = getRandomParts()
      const initialStatus = determineInitialStatus(parts)
      
      // For past days, some jobs should be completed
      let finalStatus = initialStatus
      if (date < today) {
        const statusWeights = {
          'OG': 0.1,   // 10% still ongoing
          'WP': 0.1,   // 10% waiting parts
          'QI': 0.05,  // 5% in QI
          'FR': 0.1,   // 10% for release
          'FU': 0.05,  // 5% finished unclaimed
          'CP': 0.6    // 60% completed
        }
        
        const random = Math.random()
        let cumulative = 0
        for (const [status, weight] of Object.entries(statusWeights)) {
          cumulative += weight
          if (random <= cumulative) {
            finalStatus = status
            break
          }
        }
      }
      
      // Mark some tasks as finished for completed jobs
      if (['FR', 'FU', 'CP'].includes(finalStatus)) {
        jobTasks.forEach(task => {
          if (Math.random() > 0.2) { // 80% chance to be finished
            task.status = 'Finished'
          }
        })
      }
      
      // Make all parts available for completed jobs
      if (['FR', 'FU', 'CP'].includes(finalStatus)) {
        parts.forEach(part => {
          part.availability = 'Available'
        })
      }

      const jobOrder = await JobOrder.create({
        jobNumber: generateJobNumber(),
        createdBy: jobController._id,
        assignedTechnician: technicians[Math.floor(Math.random() * technicians.length)]._id,
        serviceAdvisor: serviceAdvisors[Math.floor(Math.random() * serviceAdvisors.length)]._id,
        plateNumber: generatePlateNumber(),
        vin: generateVIN(),
        timeRange: timeSlot,
        jobList: jobTasks,
        parts: parts,
        status: finalStatus,
        date: date,
        originalCreatedDate: date,
        sourceType: 'direct',
        carriedOver: false,
        isImportant: Math.random() < 0.15, // 15% chance to be important
        qiStatus: finalStatus === 'QI' ? 'pending' : 
                 finalStatus === 'FR' ? 'approved' : 
                 finalStatus === 'OG' && Math.random() < 0.1 ? 'rejected' : null
      })
      
      jobCount++
      
      if (jobCount % 10 === 0) {
        console.log(`Created ${jobCount} job orders...`)
      }
    }
  }

  console.log(`\n✅ Seed data completed successfully!`)
  console.log(`📊 Summary:`)
  console.log(`   - Users: ${1 + 1 + technicians.length + serviceAdvisors.length}`)
  console.log(`   - Technicians: ${technicians.length}`)
  console.log(`   - Service Advisors: ${serviceAdvisors.length}`)
  console.log(`   - Job Orders: ${jobCount}`)
  console.log(`   - Days covered: ${dates.length}`)
  console.log(`\n🔑 Login credentials:`)
  console.log(`   - Admin: admin / test123456`)
  console.log(`   - Job Controller: jobcontroller / test123456`)
  console.log(`   - Technicians: technician1-5 / test123456`)
  console.log(`   - Service Advisors: serviceadvisor1-5 / test123456`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
