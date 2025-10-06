import { Router } from 'express'
import { z } from 'zod'
import { connectToMongo } from '../config/mongo.js'
import { JobOrder } from '../models/JobOrder.js'
import { User } from '../models/User.js'
import { verifyToken, requireRole } from '../middleware/auth.js'

const router = Router()

// Get all job orders with optional filtering, search, and pagination
router.get('/', verifyToken, async (req, res) => {
  try {
    await connectToMongo()
    
    const { status, technician, date, search, page = '1', limit = '10' } = req.query
    
    const filter: any = {}
    if (status) filter.status = status
    if (technician) filter.assignedTechnician = technician
    if (date) {
      const startDate = new Date(date as string)
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 1)
      filter.date = { $gte: startDate, $lt: endDate }
    }
    
    // Add search functionality
    if (search) {
      filter.$or = [
        { jobNumber: { $regex: search, $options: 'i' } },
        { plateNumber: { $regex: search, $options: 'i' } },
        { vin: { $regex: search, $options: 'i' } }
      ]
    }
    
    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const skip = (pageNum - 1) * limitNum
    
    // Get total count for pagination
    const total = await JobOrder.countDocuments(filter)
    
    const jobOrders = await JobOrder.find(filter)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
    
    const totalPages = Math.ceil(total / limitNum)
    
    res.json({ 
      jobOrders,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    })
  } catch (error) {
    console.error('Error fetching job orders:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get job order by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    await connectToMongo()
    
    const jobOrder = await JobOrder.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .lean()
    
    if (!jobOrder) {
      return res.status(404).json({ error: 'Job order not found' })
    }
    
    res.json({ jobOrder })
  } catch (error) {
    console.error('Error fetching job order:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create new job order
const createJobOrderSchema = z.object({
  jobNumber: z.string().min(1),
  assignedTechnician: z.string().min(1),
  plateNumber: z.string().min(1),
  vin: z.string().min(1),
  timeRange: z.object({
    start: z.string(),
    end: z.string()
  }),
  jobList: z.array(z.object({
    description: z.string().min(1),
    status: z.enum(['Finished', 'Unfinished'])
  })),
  parts: z.array(z.object({
    name: z.string().min(1),
    availability: z.enum(['Available', 'Unavailable'])
  })),
  date: z.string().optional()
})

router.post('/', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const parsed = createJobOrderSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.errors })
    }
    
    const { jobNumber, assignedTechnician, plateNumber, vin, timeRange, jobList, parts, date } = parsed.data
    
    // Check if job number already exists
    const existingJob = await JobOrder.findOne({ jobNumber: jobNumber.toUpperCase() })
    if (existingJob) {
      return res.status(409).json({ error: 'Job number already exists' })
    }
    
    // Verify technician exists and has technician role
    const technician = await User.findById(assignedTechnician)
    if (!technician || technician.role !== 'technician') {
      return res.status(400).json({ error: 'Invalid technician assigned' })
    }
    
    // Check technician availability for the specified time range and date
    const jobDate = date ? new Date(date) : new Date()
    const startDateTime = new Date(`${jobDate.toISOString().split('T')[0]}T${timeRange.start}:00`)
    const endDateTime = new Date(`${jobDate.toISOString().split('T')[0]}T${timeRange.end}:00`)
    
    const conflictingJob = await JobOrder.findOne({
      assignedTechnician,
      date: {
        $gte: new Date(jobDate.toISOString().split('T')[0]),
        $lt: new Date(new Date(jobDate).setDate(jobDate.getDate() + 1))
      },
      $or: [
        {
          'timeRange.start': { $lt: timeRange.end },
          'timeRange.end': { $gt: timeRange.start }
        }
      ]
    })
    
    if (conflictingJob) {
      return res.status(409).json({ error: 'Technician is not available during the specified time range' })
    }
    
    // Get user ID from JWT token
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }
    
    const jobOrder = await JobOrder.create({
      jobNumber: jobNumber.toUpperCase(),
      createdBy: userId,
      assignedTechnician,
      plateNumber: plateNumber.toUpperCase(),
      vin: vin.toUpperCase(),
      timeRange,
      jobList,
      parts,
      date: jobDate
    })
    
    const populatedJobOrder = await JobOrder.findById(jobOrder._id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .lean()
    
    res.status(201).json({ jobOrder: populatedJobOrder })
  } catch (error) {
    console.error('Error creating job order:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update job order
const updateJobOrderSchema = z.object({
  assignedTechnician: z.string().optional(),
  plateNumber: z.string().optional(),
  vin: z.string().optional(),
  timeRange: z.object({
    start: z.string(),
    end: z.string()
  }).optional(),
  jobList: z.array(z.object({
    description: z.string().min(1),
    status: z.enum(['Finished', 'Unfinished'])
  })).optional(),
  parts: z.array(z.object({
    name: z.string().min(1),
    availability: z.enum(['Available', 'Unavailable'])
  })).optional(),
  status: z.enum(['Incomplete', 'Complete', 'In Progress']).optional()
})

router.put('/:id', verifyToken, async (req, res) => {
  try {
    await connectToMongo()
    
    const parsed = updateJobOrderSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.errors })
    }
    
    const jobOrder = await JobOrder.findById(req.params.id)
    if (!jobOrder) {
      return res.status(404).json({ error: 'Job order not found' })
    }
    
    const updateData = parsed.data
    
    // If updating technician, check availability
    if (updateData.assignedTechnician) {
      const technician = await User.findById(updateData.assignedTechnician)
      if (!technician || technician.role !== 'technician') {
        return res.status(400).json({ error: 'Invalid technician assigned' })
      }
      
      // Check for conflicts with other job orders
      const timeRange = updateData.timeRange || jobOrder.timeRange
      const conflictingJob = await JobOrder.findOne({
        _id: { $ne: jobOrder._id },
        assignedTechnician: updateData.assignedTechnician,
        date: {
          $gte: new Date(jobOrder.date.toISOString().split('T')[0]),
          $lt: new Date(new Date(jobOrder.date).setDate(jobOrder.date.getDate() + 1))
        },
        $or: [
          {
            'timeRange.start': { $lt: timeRange.end },
            'timeRange.end': { $gt: timeRange.start }
          }
        ]
      })
      
      if (conflictingJob) {
        return res.status(409).json({ error: 'Technician is not available during the specified time range' })
      }
    }
    
    const updatedJobOrder = await JobOrder.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .lean()
    
    res.json({ jobOrder: updatedJobOrder })
  } catch (error) {
    console.error('Error updating job order:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete job order
router.delete('/:id', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const jobOrder = await JobOrder.findByIdAndDelete(req.params.id)
    if (!jobOrder) {
      return res.status(404).json({ error: 'Job order not found' })
    }
    
    res.json({ message: 'Job order deleted successfully' })
  } catch (error) {
    console.error('Error deleting job order:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get available technicians for a specific time range
router.get('/technicians/available', verifyToken, async (req, res) => {
  try {
    await connectToMongo()
    
    const { date, startTime, endTime } = req.query
    
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Date, startTime, and endTime are required' })
    }
    
    const jobDate = new Date(date as string)
    const startDateTime = new Date(`${jobDate.toISOString().split('T')[0]}T${startTime}:00`)
    const endDateTime = new Date(`${jobDate.toISOString().split('T')[0]}T${endTime}:00`)
    
    // Find technicians with conflicting job orders
    const conflictingJobs = await JobOrder.find({
      date: {
        $gte: new Date(jobDate.toISOString().split('T')[0]),
        $lt: new Date(new Date(jobDate).setDate(jobDate.getDate() + 1))
      },
      $or: [
        {
          'timeRange.start': { $lt: endTime },
          'timeRange.end': { $gt: startTime }
        }
      ]
    }).select('assignedTechnician')
    
    const busyTechnicianIds = conflictingJobs.map(job => job.assignedTechnician)
    
    // Get all technicians excluding busy ones
    const availableTechnicians = await User.find({
      role: 'technician',
      _id: { $nin: busyTechnicianIds }
    }).select('name email').lean()
    
    res.json({ technicians: availableTechnicians })
  } catch (error) {
    console.error('Error fetching available technicians:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
