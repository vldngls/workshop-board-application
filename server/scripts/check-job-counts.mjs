#!/usr/bin/env node

import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const jobOrderSchema = new mongoose.Schema({
  jobNumber: String,
  status: String,
  date: Date,
  carriedOver: Boolean,
  sourceType: String,
  createdAt: Date
}, { timestamps: true })

const JobOrder = mongoose.model('JobOrder', jobOrderSchema)

async function check() {
  await mongoose.connect(process.env.MONGODB_URI)
  
  const totalJobs = await JobOrder.countDocuments()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayJobs = await JobOrder.countDocuments({ date: { $gte: today } })
  const previousJobs = await JobOrder.countDocuments({ date: { $lt: today } })
  
  console.log('Total jobs:', totalJobs)
  console.log('Jobs from today:', todayJobs)
  console.log('Jobs from previous days:', previousJobs)
  
  if (totalJobs > 0) {
    const statusCounts = await JobOrder.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
    console.log('Status breakdown:', statusCounts)
  }
  
  await mongoose.disconnect()
}

check().catch(console.error)
