#!/usr/bin/env node

import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const jobOrderSchema = new mongoose.Schema({
  jobNumber: String,
  plateNumber: String,
  status: String,
  date: Date,
  sourceType: String,
  carriedOver: Boolean,
  isImportant: Boolean,
  assignedTechnician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

const appointmentSchema = new mongoose.Schema({
  plateNumber: String,
  customerName: String,
  date: Date,
  status: String
}, { timestamps: true })

const userSchema = new mongoose.Schema({
  name: String,
  role: String
})

const JobOrder = mongoose.model('JobOrder', jobOrderSchema)
const Appointment = mongoose.model('Appointment', appointmentSchema)
const User = mongoose.model('User', userSchema)

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  
  const yesterday = new Date('2025-10-22')
  yesterday.setHours(0, 0, 0, 0)
  const endOfYesterday = new Date(yesterday)
  endOfYesterday.setHours(23, 59, 59, 999)
  
  const jobs = await JobOrder.find({ 
    date: { $gte: yesterday, $lte: endOfYesterday } 
  }).populate('assignedTechnician', 'name').populate('createdBy', 'name').lean()
  
  const appointments = await Appointment.find({ 
    date: { $gte: yesterday, $lte: endOfYesterday } 
  }).lean()
  
  console.log(`\n📅 Yesterday's Workshop (${yesterday.toISOString().split('T')[0]})`)
  console.log(`\n📊 Summary:`)
  console.log(`   - Total Job Orders: ${jobs.length}`)
  console.log(`   - Walk-in Appointments: ${appointments.length}`)
  
  const statusCounts = {}
  jobs.forEach(job => {
    statusCounts[job.status] = (statusCounts[job.status] || 0) + 1
  })
  
  console.log(`\n📋 Job Status Breakdown:`)
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`   - ${status}: ${count} jobs`)
  })
  
  const carryOverJobs = jobs.filter(job => ['OG', 'WP', 'HC'].includes(job.status))
  console.log(`\n🔄 Jobs that will be carried over: ${carryOverJobs.length}`)
  
  console.log(`\n📝 Sample Jobs:`)
  jobs.slice(0, 10).forEach((job, index) => {
    const techName = job.assignedTechnician?.name || 'Unassigned'
    const important = job.isImportant ? ' ⭐' : ''
    console.log(`   ${index + 1}. ${job.jobNumber} (${job.plateNumber}) - ${job.status} - Tech: ${techName}${important}`)
  })
  
  if (jobs.length > 10) {
    console.log(`   ... and ${jobs.length - 10} more jobs`)
  }
  
  console.log(`\n🚶 Walk-in Appointments:`)
  appointments.forEach((apt, index) => {
    console.log(`   ${index + 1}. ${apt.plateNumber} - ${apt.customerName} - ${apt.status}`)
  })
  
  await mongoose.disconnect()
}

main().catch(console.error)
