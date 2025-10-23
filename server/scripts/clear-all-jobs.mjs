#!/usr/bin/env node

import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const jobOrderSchema = new mongoose.Schema({
  jobNumber: String,
  plateNumber: String,
  status: String,
  date: Date
}, { timestamps: true })

const appointmentSchema = new mongoose.Schema({
  plateNumber: String,
  customerName: String,
  date: Date,
  status: String
}, { timestamps: true })

const JobOrder = mongoose.model('JobOrder', jobOrderSchema)
const Appointment = mongoose.model('Appointment', appointmentSchema)

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  
  console.log('🗑️  Removing all job orders and appointments...')
  
  const jobResult = await JobOrder.deleteMany({})
  const appointmentResult = await Appointment.deleteMany({})
  
  console.log(`✅ Deleted ${jobResult.deletedCount} job orders`)
  console.log(`✅ Deleted ${appointmentResult.deletedCount} appointments`)
  
  // Verify deletion
  const remainingJobs = await JobOrder.countDocuments()
  const remainingAppointments = await Appointment.countDocuments()
  
  console.log(`\n📊 Remaining in database:`)
  console.log(`   - Job Orders: ${remainingJobs}`)
  console.log(`   - Appointments: ${remainingAppointments}`)
  
  if (remainingJobs === 0 && remainingAppointments === 0) {
    console.log('\n✅ Database successfully cleared!')
  } else {
    console.log('\n⚠️  Some data may still remain')
  }
  
  await mongoose.disconnect()
}

main().catch(console.error)
