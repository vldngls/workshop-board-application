#!/usr/bin/env node

/**
 * Script to simulate yesterday's workshop with various job types
 * This creates a realistic workshop scenario for testing end-of-day processing
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Define schemas
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
  password: String
}, { timestamps: true })

const jobOrderSchema = new mongoose.Schema({
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
    status: { type: String, enum: ['Finished', 'Unfinished'], required: true }
  }],
  parts: [{
    name: { type: String, required: true },
    availability: { type: String, enum: ['Available', 'Unavailable'], required: true }
  }],
  status: { 
    type: String, 
    enum: ['OG', 'WP', 'UA', 'QI', 'HC', 'HW', 'HI', 'HF', 'SU', 'FR', 'FU', 'CP'], 
    required: true,
    default: 'OG'
  },
  date: { type: Date, required: true, default: Date.now },
  originalCreatedDate: { type: Date, required: true, default: Date.now },
  sourceType: {
    type: String,
    enum: ['appointment', 'carry-over', 'direct'],
    default: 'direct'
  },
  carriedOver: { type: Boolean, default: false },
  isImportant: { type: Boolean, default: false },
  qiStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', null],
    default: null
  },
  holdCustomerRemarks: { type: String, required: false },
  subletRemarks: { type: String, required: false },
  originalJobId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobOrder', required: false },
  carryOverChain: [{
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobOrder' },
    date: { type: Date },
    status: { type: String }
  }]
}, { timestamps: true })

const appointmentSchema = new mongoose.Schema({
  plateNumber: { type: String, required: true, uppercase: true },
  vin: { type: String, required: true, uppercase: true },
  timeRange: {
    start: { type: String, required: true },
    end: { type: String, required: true }
  },
  date: { type: Date, required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  serviceType: { type: String, required: true },
  notes: { type: String, required: false },
  status: { 
    type: String, 
    enum: ['scheduled', 'completed', 'no-show'], 
    default: 'scheduled' 
  }
}, { timestamps: true })

const User = mongoose.model('User', userSchema)
const JobOrder = mongoose.model('JobOrder', jobOrderSchema)
const Appointment = mongoose.model('Appointment', appointmentSchema)

// Helper functions
const getRandomElement = (array) => array[Math.floor(Math.random() * array.length)]
const generateJobNumber = (usedNumbers) => {
  let jobNumber
  do {
    const prefix = getRandomElement(['RO', 'VL', 'FM', 'TC', 'WT'])
    const number = Math.floor(Math.random() * 9000) + 1000
    jobNumber = `${prefix}${number}`
  } while (usedNumbers.has(jobNumber))
  usedNumbers.add(jobNumber)
  return jobNumber
}

const generatePlateNumber = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  let plate = ''
  for (let i = 0; i < 3; i++) {
    plate += letters[Math.floor(Math.random() * letters.length)]
  }
  for (let i = 0; i < 4; i++) {
    plate += numbers[Math.floor(Math.random() * numbers.length)]
  }
  return plate
}

const generateVIN = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let vin = ''
  for (let i = 0; i < 17; i++) {
    vin += chars[Math.floor(Math.random() * chars.length)]
  }
  return vin
}

const timeSlots = [
  { start: '07:00', end: '10:00' },
  { start: '08:00', end: '11:00' },
  { start: '09:00', end: '12:00' },
  { start: '10:00', end: '13:00' },
  { start: '11:00', end: '14:00' },
  { start: '12:00', end: '15:00' },
  { start: '13:00', end: '16:00' },
  { start: '14:00', end: '17:00' },
  { start: '15:00', end: '18:00' },
  { start: '16:00', end: '19:00' }
]

const jobDescriptions = [
  'Oil Change',
  'Brake Pad Replacement',
  'Tire Rotation',
  'Engine Diagnostic',
  'Transmission Service',
  'Battery Replacement',
  'Air Filter Change',
  'Spark Plug Replacement',
  'Coolant Flush',
  'Power Steering Service',
  'AC System Check',
  'Suspension Inspection',
  'Exhaust System Repair',
  'Timing Belt Replacement',
  'Fuel System Cleaning'
]

const partsList = [
  { name: 'Engine Oil 5W-30', availability: 'Available' },
  { name: 'Oil Filter', availability: 'Available' },
  { name: 'Brake Pads', availability: 'Available' },
  { name: 'Brake Fluid', availability: 'Available' },
  { name: 'Air Filter', availability: 'Available' },
  { name: 'Spark Plugs', availability: 'Available' },
  { name: 'Coolant', availability: 'Available' },
  { name: 'Transmission Fluid', availability: 'Unavailable' },
  { name: 'Power Steering Fluid', availability: 'Available' },
  { name: 'Battery', availability: 'Unavailable' },
  { name: 'Timing Belt', availability: 'Available' },
  { name: 'Serpentine Belt', availability: 'Available' }
]

const carMakes = ['Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'BMW', 'Mercedes', 'Audi', 'Hyundai', 'Kia']

async function main() {
  try {
    const uri = process.env.MONGODB_URI
    if (!uri) {
      console.error('❌ MONGODB_URI environment variable is required')
      process.exit(1)
    }

    console.log('🔌 Connecting to MongoDB...')
    await mongoose.connect(uri)
    console.log('✅ Connected to MongoDB')

    // Clear existing data for yesterday
    const yesterday = new Date('2025-10-22')
    yesterday.setHours(0, 0, 0, 0)
    const endOfYesterday = new Date(yesterday)
    endOfYesterday.setHours(23, 59, 59, 999)

    console.log(`\n🗑️  Clearing existing data for ${yesterday.toISOString().split('T')[0]}...`)
    await JobOrder.deleteMany({ date: { $gte: yesterday, $lte: endOfYesterday } })
    await Appointment.deleteMany({ date: { $gte: yesterday, $lte: endOfYesterday } })
    console.log('✅ Cleared existing data')

    // Get users
    const technicians = await User.find({ role: 'technician' })
    const serviceAdvisors = await User.find({ role: 'service-advisor' })
    const jobControllers = await User.find({ role: 'job-controller' })

    if (technicians.length === 0 || serviceAdvisors.length === 0 || jobControllers.length === 0) {
      console.error('❌ Need at least one technician, service advisor, and job controller')
      process.exit(1)
    }

    console.log(`\n👥 Found ${technicians.length} technicians, ${serviceAdvisors.length} service advisors, ${jobControllers.length} job controllers`)

    const usedJobNumbers = new Set()
    const jobOrders = []
    const appointments = []

    // 1. COMPLETED JOBS (CP - Complete)
    console.log('\n✅ Creating completed jobs...')
    for (let i = 0; i < 8; i++) {
      const timeSlot = getRandomElement(timeSlots)
      const technician = getRandomElement(technicians)
      const serviceAdvisor = getRandomElement(serviceAdvisors)
      const jobController = getRandomElement(jobControllers)
      
      const jobOrder = {
        jobNumber: generateJobNumber(usedJobNumbers),
        createdBy: jobController._id,
        assignedTechnician: technician._id,
        serviceAdvisor: serviceAdvisor._id,
        plateNumber: generatePlateNumber(),
        vin: generateVIN(),
        timeRange: timeSlot,
        jobList: [
          { description: getRandomElement(jobDescriptions), status: 'Finished' },
          { description: getRandomElement(jobDescriptions), status: 'Finished' }
        ],
        parts: [
          { name: getRandomElement(partsList).name, availability: 'Available' },
          { name: getRandomElement(partsList).name, availability: 'Available' }
        ],
        status: 'CP',
        date: yesterday,
        originalCreatedDate: yesterday,
        sourceType: 'direct',
        carriedOver: false,
        isImportant: Math.random() < 0.2
      }
      
      jobOrders.push(jobOrder)
    }

    // 2. FOR RELEASE JOBS (FR - For Release)
    console.log('📋 Creating jobs for release...')
    for (let i = 0; i < 5; i++) {
      const timeSlot = getRandomElement(timeSlots)
      const technician = getRandomElement(technicians)
      const serviceAdvisor = getRandomElement(serviceAdvisors)
      const jobController = getRandomElement(jobControllers)
      
      const jobOrder = {
        jobNumber: generateJobNumber(usedJobNumbers),
        createdBy: jobController._id,
        assignedTechnician: technician._id,
        serviceAdvisor: serviceAdvisor._id,
        plateNumber: generatePlateNumber(),
        vin: generateVIN(),
        timeRange: timeSlot,
        jobList: [
          { description: getRandomElement(jobDescriptions), status: 'Finished' },
          { description: getRandomElement(jobDescriptions), status: 'Finished' }
        ],
        parts: [
          { name: getRandomElement(partsList).name, availability: 'Available' },
          { name: getRandomElement(partsList).name, availability: 'Available' }
        ],
        status: 'FR',
        date: yesterday,
        originalCreatedDate: yesterday,
        sourceType: 'direct',
        carriedOver: false,
        isImportant: Math.random() < 0.3
      }
      
      jobOrders.push(jobOrder)
    }

    // 3. QUALITY INSPECTION JOBS (QI - Quality Inspection)
    console.log('🔍 Creating jobs for quality inspection...')
    for (let i = 0; i < 4; i++) {
      const timeSlot = getRandomElement(timeSlots)
      const technician = getRandomElement(technicians)
      const serviceAdvisor = getRandomElement(serviceAdvisors)
      const jobController = getRandomElement(jobControllers)
      
      const jobOrder = {
        jobNumber: generateJobNumber(usedJobNumbers),
        createdBy: jobController._id,
        assignedTechnician: technician._id,
        serviceAdvisor: serviceAdvisor._id,
        plateNumber: generatePlateNumber(),
        vin: generateVIN(),
        timeRange: timeSlot,
        jobList: [
          { description: getRandomElement(jobDescriptions), status: 'Finished' },
          { description: getRandomElement(jobDescriptions), status: 'Finished' }
        ],
        parts: [
          { name: getRandomElement(partsList).name, availability: 'Available' },
          { name: getRandomElement(partsList).name, availability: 'Available' }
        ],
        status: 'QI',
        qiStatus: 'pending',
        date: yesterday,
        originalCreatedDate: yesterday,
        sourceType: 'direct',
        carriedOver: false,
        isImportant: Math.random() < 0.4
      }
      
      jobOrders.push(jobOrder)
    }

    // 4. ON GOING JOBS (OG - On Going) - These will be carried over
    console.log('🔄 Creating ongoing jobs (will be carried over)...')
    for (let i = 0; i < 6; i++) {
      const timeSlot = getRandomElement(timeSlots)
      const technician = getRandomElement(technicians)
      const serviceAdvisor = getRandomElement(serviceAdvisors)
      const jobController = getRandomElement(jobControllers)
      
      const jobOrder = {
        jobNumber: generateJobNumber(usedJobNumbers),
        createdBy: jobController._id,
        assignedTechnician: technician._id,
        serviceAdvisor: serviceAdvisor._id,
        plateNumber: generatePlateNumber(),
        vin: generateVIN(),
        timeRange: timeSlot,
        jobList: [
          { description: getRandomElement(jobDescriptions), status: 'Unfinished' },
          { description: getRandomElement(jobDescriptions), status: 'Unfinished' }
        ],
        parts: [
          { name: getRandomElement(partsList).name, availability: 'Available' },
          { name: getRandomElement(partsList).name, availability: 'Available' }
        ],
        status: 'OG',
        date: yesterday,
        originalCreatedDate: yesterday,
        sourceType: 'direct',
        carriedOver: false,
        isImportant: Math.random() < 0.2
      }
      
      jobOrders.push(jobOrder)
    }

    // 5. WORK IN PROGRESS JOBS (WP - Work in Progress) - These will be carried over
    console.log('⏳ Creating work in progress jobs (will be carried over)...')
    for (let i = 0; i < 4; i++) {
      const timeSlot = getRandomElement(timeSlots)
      const technician = getRandomElement(technicians)
      const serviceAdvisor = getRandomElement(serviceAdvisors)
      const jobController = getRandomElement(jobControllers)
      
      const jobOrder = {
        jobNumber: generateJobNumber(usedJobNumbers),
        createdBy: jobController._id,
        assignedTechnician: technician._id,
        serviceAdvisor: serviceAdvisor._id,
        plateNumber: generatePlateNumber(),
        vin: generateVIN(),
        timeRange: timeSlot,
        jobList: [
          { description: getRandomElement(jobDescriptions), status: 'Unfinished' },
          { description: getRandomElement(jobDescriptions), status: 'Unfinished' }
        ],
        parts: [
          { name: getRandomElement(partsList).name, availability: 'Unavailable' },
          { name: getRandomElement(partsList).name, availability: 'Available' }
        ],
        status: 'WP',
        date: yesterday,
        originalCreatedDate: yesterday,
        sourceType: 'direct',
        carriedOver: false,
        isImportant: Math.random() < 0.3
      }
      
      jobOrders.push(jobOrder)
    }

    // 6. HOLD CUSTOMER JOBS (HC - Hold Customer)
    console.log('⏸️  Creating hold customer jobs...')
    for (let i = 0; i < 3; i++) {
      const timeSlot = getRandomElement(timeSlots)
      const technician = getRandomElement(technicians)
      const serviceAdvisor = getRandomElement(serviceAdvisors)
      const jobController = getRandomElement(jobControllers)
      
      const jobOrder = {
        jobNumber: generateJobNumber(usedJobNumbers),
        createdBy: jobController._id,
        assignedTechnician: technician._id,
        serviceAdvisor: serviceAdvisor._id,
        plateNumber: generatePlateNumber(),
        vin: generateVIN(),
        timeRange: timeSlot,
        jobList: [
          { description: getRandomElement(jobDescriptions), status: 'Unfinished' },
          { description: getRandomElement(jobDescriptions), status: 'Unfinished' }
        ],
        parts: [
          { name: getRandomElement(partsList).name, availability: 'Available' },
          { name: getRandomElement(partsList).name, availability: 'Available' }
        ],
        status: 'HC',
        holdCustomerRemarks: 'Customer needs to approve additional work',
        date: yesterday,
        originalCreatedDate: yesterday,
        sourceType: 'direct',
        carriedOver: false,
        isImportant: Math.random() < 0.4
      }
      
      jobOrders.push(jobOrder)
    }

    // 7. FINISHED UNCLAIMED JOBS (FU - Finished Unclaimed)
    console.log('📦 Creating finished unclaimed jobs...')
    for (let i = 0; i < 2; i++) {
      const timeSlot = getRandomElement(timeSlots)
      const technician = getRandomElement(technicians)
      const serviceAdvisor = getRandomElement(serviceAdvisors)
      const jobController = getRandomElement(jobControllers)
      
      const jobOrder = {
        jobNumber: generateJobNumber(usedJobNumbers),
        createdBy: jobController._id,
        assignedTechnician: technician._id,
        serviceAdvisor: serviceAdvisor._id,
        plateNumber: generatePlateNumber(),
        vin: generateVIN(),
        timeRange: timeSlot,
        jobList: [
          { description: getRandomElement(jobDescriptions), status: 'Finished' },
          { description: getRandomElement(jobDescriptions), status: 'Finished' }
        ],
        parts: [
          { name: getRandomElement(partsList).name, availability: 'Available' },
          { name: getRandomElement(partsList).name, availability: 'Available' }
        ],
        status: 'FU',
        date: yesterday,
        originalCreatedDate: yesterday,
        sourceType: 'direct',
        carriedOver: false,
        isImportant: false
      }
      
      jobOrders.push(jobOrder)
    }

    // 8. WALK-IN APPOINTMENTS
    console.log('🚶 Creating walk-in appointments...')
    for (let i = 0; i < 5; i++) {
      const timeSlot = getRandomElement(timeSlots)
      
      const appointment = {
        plateNumber: generatePlateNumber(),
        vin: generateVIN(),
        timeRange: timeSlot,
        date: yesterday,
        customerName: `Walk-in Customer ${i + 1}`,
        customerPhone: `555-${Math.floor(Math.random() * 9000) + 1000}`,
        serviceType: getRandomElement(jobDescriptions),
        notes: 'Walk-in customer',
        status: 'scheduled'
      }
      
      appointments.push(appointment)
    }

    // 9. WALK-IN JOB ORDERS (created from walk-ins)
    console.log('🔧 Creating walk-in job orders...')
    for (let i = 0; i < 3; i++) {
      const timeSlot = getRandomElement(timeSlots)
      const technician = getRandomElement(technicians)
      const serviceAdvisor = getRandomElement(serviceAdvisors)
      const jobController = getRandomElement(jobControllers)
      
      const jobOrder = {
        jobNumber: generateJobNumber(usedJobNumbers),
        createdBy: jobController._id,
        assignedTechnician: technician._id,
        serviceAdvisor: serviceAdvisor._id,
        plateNumber: generatePlateNumber(),
        vin: generateVIN(),
        timeRange: timeSlot,
        jobList: [
          { description: getRandomElement(jobDescriptions), status: 'Finished' },
          { description: getRandomElement(jobDescriptions), status: 'Unfinished' }
        ],
        parts: [
          { name: getRandomElement(partsList).name, availability: 'Available' }
        ],
        status: 'OG',
        date: yesterday,
        originalCreatedDate: yesterday,
        sourceType: 'appointment',
        carriedOver: false,
        isImportant: Math.random() < 0.2
      }
      
      jobOrders.push(jobOrder)
    }

    // Insert all data
    console.log('\n💾 Inserting data into database...')
    await JobOrder.insertMany(jobOrders)
    await Appointment.insertMany(appointments)

    // Summary
    console.log('\n📊 Simulation Summary:')
    console.log(`   - Total Job Orders: ${jobOrders.length}`)
    console.log(`   - Completed (CP): ${jobOrders.filter(j => j.status === 'CP').length}`)
    console.log(`   - For Release (FR): ${jobOrders.filter(j => j.status === 'FR').length}`)
    console.log(`   - Quality Inspection (QI): ${jobOrders.filter(j => j.status === 'QI').length}`)
    console.log(`   - On Going (OG): ${jobOrders.filter(j => j.status === 'OG').length}`)
    console.log(`   - Work in Progress (WP): ${jobOrders.filter(j => j.status === 'WP').length}`)
    console.log(`   - Hold Customer (HC): ${jobOrders.filter(j => j.status === 'HC').length}`)
    console.log(`   - Finished Unclaimed (FU): ${jobOrders.filter(j => j.status === 'FU').length}`)
    console.log(`   - Walk-in Appointments: ${appointments.length}`)
    
    const carryOverCount = jobOrders.filter(j => ['OG', 'WP', 'HC'].includes(j.status)).length
    console.log(`   - Jobs that will be carried over: ${carryOverCount}`)
    
    console.log(`\n✅ Successfully simulated yesterday's workshop (${yesterday.toISOString().split('T')[0]})`)
    console.log('🎯 You can now test the end-of-day processing!')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await mongoose.disconnect()
    console.log('🔌 Disconnected from MongoDB')
  }
}

main()
