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
  actualEndTime: { type: String, required: false },
  jobList: [{
    description: { type: String, required: true },
    status: { type: String, enum: ['Finished', 'Unfinished'], default: 'Unfinished' }
  }],
  parts: [{
    name: { type: String, required: true },
    availability: { type: String, enum: ['Available', 'Unavailable'], default: 'Available' }
  }],
  status: { type: String, enum: ['OG', 'WP', 'FP', 'QI', 'HC', 'HW', 'HI', 'FR', 'FU', 'CP'], default: 'OG' },
  date: { type: Date, required: true },
  originalCreatedDate: { type: Date, required: true, default: Date.now },
  sourceType: { type: String, enum: ['appointment', 'carry-over', 'direct'], default: 'direct' },
  carriedOver: { type: Boolean, default: false },
  isImportant: { type: Boolean, default: false },
  qiStatus: { type: String, enum: ['pending', 'approved', 'rejected', null], default: null }
}, { timestamps: true })

const User = mongoose.models.User || mongoose.model('User', UserSchema)
const JobOrder = mongoose.models.JobOrder || mongoose.model('JobOrder', JobOrderSchema)

// Realistic data arrays
const carMakes = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'BMW', 'Mercedes', 'Audi', 'Volkswagen', 'Hyundai', 'Kia', 'Mazda', 'Subaru', 'Lexus', 'Acura']
const carModels = ['Camry', 'Civic', 'F-150', 'Silverado', 'Altima', '3 Series', 'C-Class', 'A4', 'Jetta', 'Elantra', 'Sorento', 'CX-5', 'Outback', 'ES', 'TLX']
const jobDescriptions = [
  'Oil Change and Filter Replacement',
  'Brake Pad and Rotor Replacement',
  'Transmission Fluid Service',
  'Engine Diagnostic and Repair',
  'Air Filter Replacement',
  'Spark Plug Replacement',
  'Battery Replacement',
  'Tire Rotation and Balance',
  'Wheel Alignment',
  'Suspension System Inspection',
  'Exhaust System Repair',
  'AC System Service',
  'Power Steering Fluid Service',
  'Coolant System Flush',
  'Timing Belt Replacement',
  'Water Pump Replacement',
  'Alternator Replacement',
  'Starter Motor Replacement',
  'Fuel System Cleaning',
  'Catalytic Converter Replacement',
  'Headlight Bulb Replacement',
  'Windshield Wiper Replacement',
  'Door Lock Actuator Repair',
  'Window Regulator Replacement',
  'HVAC Blower Motor Replacement'
]

const partNames = [
  'Engine Oil Filter',
  'Brake Pads (Front)',
  'Brake Pads (Rear)',
  'Brake Rotors (Front)',
  'Brake Rotors (Rear)',
  'Transmission Fluid',
  'Air Filter',
  'Spark Plugs (Set of 4)',
  'Car Battery',
  'Oil Filter',
  'Timing Belt',
  'Water Pump',
  'Alternator',
  'Starter Motor',
  'Catalytic Converter',
  'Headlight Bulb',
  'Windshield Wiper Blades',
  'Door Lock Actuator',
  'Window Regulator',
  'HVAC Blower Motor',
  'Power Steering Fluid',
  'Coolant/Antifreeze',
  'Brake Fluid',
  'AC Refrigerant',
  'Serpentine Belt'
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

const jobStatuses = ['OG', 'WP', 'FP', 'QI', 'HC', 'HW', 'HI', 'FR', 'FU', 'CP']
const qiStatuses = ['pending', 'approved', 'rejected', null]

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
  
  // Generate 3 letters
  for (let i = 0; i < 3; i++) {
    plate += letters.charAt(Math.floor(Math.random() * letters.length))
  }
  
  // Generate 3-4 numbers
  const numCount = Math.random() > 0.5 ? 3 : 4
  for (let i = 0; i < numCount; i++) {
    plate += numbers.charAt(Math.floor(Math.random() * numbers.length))
  }
  
  return plate
}

function generateJobNumber(usedJobNumbers) {
  let jobNumber
  do {
    const year = new Date().getFullYear()
    const month = String(new Date().getMonth() + 1).padStart(2, '0')
    const day = String(new Date().getDate()).padStart(2, '0')
    const randomNum = String(Math.floor(Math.random() * 999999) + 1).padStart(6, '0')
    jobNumber = `JO${year}${month}${day}${randomNum}`
  } while (usedJobNumbers.has(jobNumber))
  
  usedJobNumbers.add(jobNumber)
  return jobNumber
}

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)]
}

function getRandomElements(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatTime(date) {
  return date.toTimeString().slice(0, 5)
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

  // Technicians 1-8 (increased for more realistic distribution)
  const technicianData = [
    { name: 'Mike Johnson', email: 'mike@workshop.com', username: 'mike', level: 'level-3' },
    { name: 'Sarah Chen', email: 'sarah@workshop.com', username: 'sarah', level: 'level-3' },
    { name: 'David Rodriguez', email: 'david@workshop.com', username: 'david', level: 'level-2' },
    { name: 'Lisa Thompson', email: 'lisa@workshop.com', username: 'lisa', level: 'level-2' },
    { name: 'James Wilson', email: 'james@workshop.com', username: 'james', level: 'level-1' },
    { name: 'Maria Garcia', email: 'maria@workshop.com', username: 'maria', level: 'level-1' },
    { name: 'Tom Anderson', email: 'tom@workshop.com', username: 'tom', level: 'level-0' },
    { name: 'Emma Davis', email: 'emma@workshop.com', username: 'emma', level: 'untrained' }
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
    { name: 'Robert Smith', email: 'robert@workshop.com', username: 'robert' },
    { name: 'Jennifer Brown', email: 'jennifer@workshop.com', username: 'jennifer' },
    { name: 'Michael Taylor', email: 'michael@workshop.com', username: 'michael' },
    { name: 'Amanda White', email: 'amanda@workshop.com', username: 'amanda' },
    { name: 'Christopher Lee', email: 'chris@workshop.com', username: 'chris' }
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

  // Generate job orders for the next 10 days
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Start of day
  
  const jobOrders = []
  const carryOverJobs = [] // Track jobs that need to be carried over
  const usedJobNumbers = new Set() // Track used job numbers to ensure uniqueness
  
  console.log('Generating job orders...')
  
  for (let dayOffset = 0; dayOffset < 10; dayOffset++) {
    const currentDate = addDays(today, dayOffset)
    const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6
    
    // Skip weekends or reduce workload
    if (isWeekend) {
      console.log(`Skipping weekend: ${currentDate.toDateString()}`)
      continue
    }
    
    // Generate 8-15 jobs per day (realistic workshop load)
    const jobsPerDay = Math.floor(Math.random() * 8) + 8
    console.log(`Generating ${jobsPerDay} jobs for ${currentDate.toDateString()}`)
    
    // Process carry-over jobs first
    const carryOverForToday = carryOverJobs.filter(job => 
      job.remainingDays > 0 && job.assignedDate.getTime() === currentDate.getTime()
    )
    
    for (const carryOverJob of carryOverForToday) {
      const timeSlot = getRandomElement(timeSlots)
      const technician = getRandomElement(technicians)
      const serviceAdvisor = getRandomElement(serviceAdvisors)
      
      // Create a new job order for the carry-over continuation
      const carryOverJobNumber = generateJobNumber(usedJobNumbers)
      
      const jobOrder = {
        jobNumber: carryOverJobNumber,
        createdBy: jobController._id,
        assignedTechnician: technician._id,
        serviceAdvisor: serviceAdvisor._id,
        plateNumber: carryOverJob.plateNumber,
        vin: carryOverJob.vin,
        timeRange: timeSlot,
        jobList: carryOverJob.jobList,
        parts: carryOverJob.parts,
        status: carryOverJob.remainingDays === 1 ? 'CP' : 'WP', // Complete if last day, otherwise work in progress
        date: currentDate,
        originalCreatedDate: carryOverJob.originalCreatedDate,
        sourceType: 'carry-over',
        carriedOver: true,
        isImportant: carryOverJob.isImportant,
        qiStatus: carryOverJob.remainingDays === 1 ? getRandomElement(qiStatuses) : null
      }
      
      jobOrders.push(jobOrder)
      carryOverJob.remainingDays--
      
      if (carryOverJob.remainingDays === 0) {
        // Remove from carry-over list
        const index = carryOverJobs.indexOf(carryOverJob)
        carryOverJobs.splice(index, 1)
      }
    }
    
    // Generate new jobs for today
    const newJobsCount = jobsPerDay - carryOverForToday.length
    for (let i = 0; i < newJobsCount; i++) {
      const make = getRandomElement(carMakes)
      const model = getRandomElement(carModels)
      const plateNumber = generatePlateNumber()
      const vin = generateVIN()
      const jobNumber = generateJobNumber(usedJobNumbers)
      const timeSlot = getRandomElement(timeSlots)
      const technician = getRandomElement(technicians)
      const serviceAdvisor = getRandomElement(serviceAdvisors)
      
      // Generate 1-4 job items
      const jobItemCount = Math.floor(Math.random() * 4) + 1
      const selectedJobs = getRandomElements(jobDescriptions, jobItemCount)
      const jobList = selectedJobs.map(job => ({
        description: job,
        status: Math.random() > 0.7 ? 'Finished' : 'Unfinished'
      }))
      
      // Generate 1-5 parts
      const partCount = Math.floor(Math.random() * 5) + 1
      const selectedParts = getRandomElements(partNames, partCount)
      const parts = selectedParts.map(part => ({
        name: part,
        availability: Math.random() > 0.2 ? 'Available' : 'Unavailable'
      }))
      
      // Determine if this job will be carried over (20% chance)
      const willCarryOver = Math.random() < 0.2
      const carryOverDays = willCarryOver ? Math.floor(Math.random() * 3) + 1 : 0
      
      let status = 'OG'
      let qiStatus = null
      
      if (dayOffset === 0) {
        // Today's jobs - mix of statuses
        const statusRand = Math.random()
        if (statusRand < 0.1) status = 'CP'
        else if (statusRand < 0.2) status = 'QI'
        else if (statusRand < 0.4) status = 'WP'
        else if (statusRand < 0.6) status = 'FP'
        else status = 'OG'
        
        if (status === 'QI') {
          qiStatus = getRandomElement(qiStatuses)
        }
      } else if (dayOffset < 3) {
        // Recent days - mostly completed or in progress
        const statusRand = Math.random()
        if (statusRand < 0.6) status = 'CP'
        else if (statusRand < 0.8) status = 'QI'
        else status = 'WP'
        
        if (status === 'QI') {
          qiStatus = getRandomElement(qiStatuses)
        }
      } else {
        // Older days - mostly completed
        const statusRand = Math.random()
        if (statusRand < 0.8) status = 'CP'
        else if (statusRand < 0.9) status = 'QI'
        else status = 'WP'
        
        if (status === 'QI') {
          qiStatus = getRandomElement(qiStatuses)
        }
      }
      
      const jobOrder = {
        jobNumber,
        createdBy: jobController._id,
        assignedTechnician: technician._id,
        serviceAdvisor: serviceAdvisor._id,
        plateNumber,
        vin,
        timeRange: timeSlot,
        jobList,
        parts,
        status,
        date: currentDate,
        originalCreatedDate: currentDate,
        sourceType: 'direct',
        carriedOver: false,
        isImportant: Math.random() < 0.1, // 10% chance of being important
        qiStatus
      }
      
      // Add actual end time for completed jobs (sometimes early)
      if (status === 'CP' && Math.random() < 0.3) {
        const startTime = new Date(`${currentDate.toDateString()} ${timeSlot.start}`)
        const endTime = new Date(`${currentDate.toDateString()} ${timeSlot.end}`)
        const actualEnd = new Date(startTime.getTime() + Math.random() * (endTime.getTime() - startTime.getTime()))
        jobOrder.actualEndTime = formatTime(actualEnd)
      }
      
      jobOrders.push(jobOrder)
      
      // If this job will carry over, add it to the carry-over list
      if (willCarryOver && carryOverDays > 0) {
        const nextAvailableDate = addDays(currentDate, 1)
        carryOverJobs.push({
          jobNumber,
          plateNumber,
          vin,
          jobList,
          parts,
          isImportant: jobOrder.isImportant,
          originalCreatedDate: currentDate,
          assignedDate: nextAvailableDate,
          remainingDays: carryOverDays
        })
      }
    }
  }
  
  // Create all job orders in batches
  console.log(`Creating ${jobOrders.length} job orders...`)
  const batchSize = 100
  for (let i = 0; i < jobOrders.length; i += batchSize) {
    const batch = jobOrders.slice(i, i + batchSize)
    await JobOrder.insertMany(batch)
    console.log(`Created batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(jobOrders.length / batchSize)}`)
  }
  
  console.log(`\n✅ Seed data completed successfully!`)
  console.log(`📊 Summary:`)
  console.log(`   - Users: ${users.length} (1 admin, 1 job controller, ${technicians.length} technicians, ${serviceAdvisors.length} service advisors)`)
  console.log(`   - Job Orders: ${jobOrders.length}`)
  console.log(`   - Carry-over Jobs: ${carryOverJobs.length} (still pending)`)
  console.log(`   - Date Range: ${today.toDateString()} to ${addDays(today, 9).toDateString()}`)
  console.log(`\n🔑 Login credentials (all users):`)
  console.log(`   Username: admin / Password: test123456`)
  console.log(`   Username: jobcontroller / Password: test123456`)
  console.log(`   Username: [technician/service advisor username] / Password: test123456`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('❌ Error during seeding:', err)
  process.exit(1)
})
