const { Router } = require('express')
const { z } = require('zod')
const { connectToMongo } = require('../config/mongo.js')
const { JobOrder } = require('../models/JobOrder.js')
const { User } = require('../models/User.js')
const { verifyToken, requireRole } = require('../middleware/auth.js')

const router = Router()

// Get all job orders with optional filtering, search, and pagination
router.get('/', verifyToken, async (req, res) => {
  try {
    await connectToMongo()
    
    const { status, technician, date, search, assignedToMe, page = '1', limit = '10' } = req.query
    
    const filter: Record<string, any> = {}
    if (status) filter.status = status
    if (technician) filter.assignedTechnician = technician
    if (assignedToMe === 'true') {
      // Filter to only show job orders assigned to the current user
      filter.assignedTechnician = req.user?.userId
    }
    if (date) {
      const startDate = new Date(date as string)
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 1)
      filter.date = { $gte: startDate, $lt: endDate }
    }
    
    // Add search functionality
    if (search) {
      // First, find technicians that match the search term
      const matchingTechnicians = await User.find({
        role: 'technician',
        name: { $regex: search, $options: 'i' }
      }).select('_id').lean()
      
      const technicianIds = matchingTechnicians.map((tech: any) => tech._id)
      
      filter.$or = [
        { jobNumber: { $regex: search, $options: 'i' } },
        { plateNumber: { $regex: search, $options: 'i' } },
        { vin: { $regex: search, $options: 'i' } },
        ...(technicianIds.length > 0 ? [{ assignedTechnician: { $in: technicianIds } }] : [])
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
      .populate('serviceAdvisor', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
    
    const totalPages = Math.ceil(total / limitNum)
    
    return res.json({ 
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
    return res.status(500).json({ error: 'Internal server error' })
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
        $gte: new Date(jobDate.toISOString().split('T')[0] || ''),
        $lt: new Date(new Date(jobDate).setDate(jobDate.getDate() + 1))
      },
      $or: [
        {
          'timeRange.start': { $lt: endTime },
          'timeRange.end': { $gt: startTime }
        }
      ]
    }).select('assignedTechnician')
    
    const busyTechnicianIds = conflictingJobs.map((job: any) => job.assignedTechnician)
    
    // Get all technicians excluding busy ones
    const availableTechnicians = await User.find({
      role: 'technician',
      _id: { $nin: busyTechnicianIds }
    }).select('name email level').lean()
    
    return res.json({ technicians: availableTechnicians })
  } catch (error) {
    console.error('Error fetching available technicians:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Get job orders that can fit in a specific time slot (for reassignment)
router.get('/available-for-slot', verifyToken, async (req, res) => {
  try {
    await connectToMongo()
    
    const { date, startTime, endTime } = req.query
    
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Date, startTime, and endTime are required' })
    }
    
    // Calculate available duration in minutes
    const [startHour, startMinute] = (startTime as string).split(':').map(Number)
    const [endHour, endMinute] = (endTime as string).split(':').map(Number)
    const availableMinutes = ((endHour || 0) * 60 + (endMinute || 0)) - ((startHour || 0) * 60 + (startMinute || 0))
    
    // Find unassigned jobs (no technician or in FP status - for plotting)
    // that could fit in this time slot
    const availableJobs = await JobOrder.find({
      $and: [
        {
          $or: [
            // Jobs without technician assignment  
            { assignedTechnician: null, status: { $nin: ['CP', 'FR', 'FU', 'QI'] } },
            // Jobs in FP status (for plotting - parts are available)
            { status: 'FP' }
          ]
        }
      ]
    })
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .sort({ isImportant: -1, carriedOver: -1, createdAt: -1 })
      .lean()
    
    // Filter jobs that can reasonably fit (we'll let user adjust duration)
    // Show all jobs but indicate which ones might be tight on time
    const jobsWithFitInfo = availableJobs.map((job: any) => {
      const [jobStartHour, jobStartMinute] = job.timeRange.start.split(':').map(Number)
      const [jobEndHour, jobEndMinute] = job.timeRange.end.split(':').map(Number)
      const jobDuration = (jobEndHour * 60 + jobEndMinute) - (jobStartHour * 60 + jobStartMinute)
      
      return {
        ...job,
        originalDuration: jobDuration,
        canFit: jobDuration <= availableMinutes,
        suggestedDuration: Math.min(jobDuration, availableMinutes)
      }
    })
    
    return res.json({ 
      jobs: jobsWithFitInfo,
      availableMinutes,
      timeSlot: { start: startTime, end: endTime }
    })
  } catch (error) {
    console.error('Error fetching available jobs for slot:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Get job order by ID or job number
router.get('/:id', verifyToken, async (req, res) => {
  try {
    await connectToMongo()
    
    // Check if the id is a MongoDB ObjectId or a job number
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id)
    let jobOrder
    
    if (isObjectId) {
      // Search by MongoDB _id
      jobOrder = await JobOrder.findById(req.params.id)
        .populate('createdBy', 'name email')
        .populate('assignedTechnician', 'name email')
        .populate('serviceAdvisor', 'name email')
        .lean()
    } else {
      // Search by job number
      jobOrder = await JobOrder.findOne({ jobNumber: req.params.id })
        .populate('createdBy', 'name email')
        .populate('assignedTechnician', 'name email')
        .populate('serviceAdvisor', 'name email')
        .lean()
    }
    
    if (!jobOrder) {
      return res.status(404).json({ error: 'Job order not found' })
    }
    
    return res.json({ jobOrder })
  } catch (error) {
    console.error('Error fetching job order:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Create new job order
const createJobOrderSchema = z.object({
  jobNumber: z.string().min(1),
  assignedTechnician: z.string().min(1),
  serviceAdvisor: z.string().min(1),
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
  })).optional(),
  date: z.string().optional(),
  status: z.enum(['OG', 'WP', 'FP', 'QI', 'HC', 'HW', 'HI', 'FR', 'FU', 'CP']).optional()
})

router.post('/', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const parsed = createJobOrderSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues })
    }
    
    const { jobNumber, assignedTechnician, serviceAdvisor, plateNumber, vin, timeRange, jobList, parts, date, status } = parsed.data
    
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
    
    // Verify service advisor exists and has service-advisor role
    const advisor = await User.findById(serviceAdvisor)
    if (!advisor || advisor.role !== 'service-advisor') {
      return res.status(400).json({ error: 'Invalid service advisor assigned' })
    }
    
    // Check technician availability for the specified time range and date
    const jobDate = date ? new Date(date) : new Date()
    const startDateTime = new Date(`${jobDate.toISOString().split('T')[0]}T${timeRange.start}:00`)
    const endDateTime = new Date(`${jobDate.toISOString().split('T')[0]}T${timeRange.end}:00`)
    
    const conflictingJob = await JobOrder.findOne({
      assignedTechnician,
      date: {
        $gte: new Date(jobDate.toISOString().split('T')[0] || ''),
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
    
    // Determine initial status
    // If status is provided in request, use it; otherwise auto-set based on parts availability
    let initialStatus = status || 'OG'
    if (!status && parts && parts.length > 0) {
      const hasUnavailableParts = parts.some(part => part.availability === 'Unavailable')
      // If parts are unavailable but not all, can still be OG
      initialStatus = hasUnavailableParts ? 'WP' : 'OG'
    }
    
    const allPartsUnavailable = parts && parts.length > 0 ? parts.every(part => part.availability === 'Unavailable') : false
    
    const jobOrder = await JobOrder.create({
      jobNumber: jobNumber.toUpperCase(),
      createdBy: userId,
      assignedTechnician: allPartsUnavailable ? null : assignedTechnician, // Don't assign if all parts missing
      serviceAdvisor: serviceAdvisor,
      plateNumber: plateNumber.toUpperCase(),
      vin: vin.toUpperCase(),
      timeRange,
      jobList,
      parts: parts || [],
      status: initialStatus,
      date: jobDate
    })
    
    const populatedJobOrder = await JobOrder.findById(jobOrder._id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    return res.status(201).json({ jobOrder: populatedJobOrder })
  } catch (error) {
    console.error('Error creating job order:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Status transition validation rules
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  'OG': ['WP', 'FP', 'QI', 'HC', 'HW', 'HI', 'OG'], // Can stay OG or move to other statuses
  'WP': ['FP', 'OG', 'HC', 'HW', 'HI', 'WP'], // Waiting parts can go to for plotting or other statuses
  'FP': ['OG', 'WP', 'FP'], // For plotting can be plotted to ongoing or back to WP
  'QI': ['FR', 'FP', 'QI'], // QI can approve to release or reject to for plotting
  'HC': ['OG', 'WP', 'FP', 'HC'], // Hold customer can resume
  'HW': ['OG', 'WP', 'FP', 'HW'], // Hold warranty can resume
  'HI': ['OG', 'WP', 'FP', 'HI'], // Hold insurance can resume
  'FR': ['FU', 'CP', 'QI', 'FR'], // For release can complete, finish unclaimed, or redo back to QI
  'FU': ['CP', 'FU'], // Finished unclaimed can be marked complete
  'CP': ['CP'] // Complete is final state
}

// Update job order
const updateJobOrderSchema = z.object({
  assignedTechnician: z.string().nullable().optional(),
  serviceAdvisor: z.string().min(1).optional(),
  plateNumber: z.string().optional(),
  vin: z.string().optional(),
  timeRange: z.object({
    start: z.string(),
    end: z.string()
  }).optional(),
  actualEndTime: z.string().optional(),
  jobList: z.array(z.object({
    description: z.string().min(1),
    status: z.enum(['Finished', 'Unfinished'])
  })).optional(),
  parts: z.array(z.object({
    name: z.string().min(1),
    availability: z.enum(['Available', 'Unavailable'])
  })).optional(),
  status: z.enum(['OG', 'WP', 'FP', 'QI', 'HC', 'HW', 'HI', 'FR', 'FU', 'CP']).optional(),
  carriedOver: z.boolean().optional(),
  isImportant: z.boolean().optional(),
  qiStatus: z.enum(['pending', 'approved', 'rejected']).nullable().optional()
})

router.put('/:id', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const parsed = updateJobOrderSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues })
    }
    
    // Check if the id is a MongoDB ObjectId or a job number
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id)
    let jobOrder
    
    if (isObjectId) {
      // Search by MongoDB _id
      jobOrder = await JobOrder.findById(req.params.id)
    } else {
      // Search by job number
      jobOrder = await JobOrder.findOne({ jobNumber: req.params.id })
    }
    
    if (!jobOrder) {
      return res.status(404).json({ error: 'Job order not found' })
    }
    
    const updateData = parsed.data
    
    // Validate status transition if status is being changed
    if (updateData.status && updateData.status !== jobOrder.status) {
      const currentStatus = jobOrder.status
      const newStatus = updateData.status
      const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || []
      
      if (!validTransitions.includes(newStatus)) {
        return res.status(400).json({ 
          error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
          validTransitions: validTransitions
        })
      }
    }
    
    // Auto-set status based on parts availability
    if (updateData.parts !== undefined) {
      if (updateData.parts.length > 0) {
        const hasUnavailableParts = updateData.parts.some(part => part.availability === 'Unavailable')
        const allPartsAvailable = updateData.parts.every(part => part.availability === 'Available')
        
        // If parts become unavailable, change to WP and clear technician and time assignments
        // This forces the job to be fully re-plotted when parts become available again
        if (hasUnavailableParts && (!updateData.status || updateData.status === 'OG')) {
          updateData.status = 'WP'
          // Clear technician and time range so job needs to be fully re-plotted
          updateData.assignedTechnician = null
          // Reset time range to default placeholder values
          updateData.timeRange = { start: '00:00', end: '00:00' }
        }
        
        // If all parts become available and job is in WP status, change to FP (For Plotting)
        if (allPartsAvailable && jobOrder.status === 'WP' && !updateData.status) {
          updateData.status = 'FP'
        }
      } else {
        // If parts array is empty, ensure job can proceed (no parts dependency)
        if (jobOrder.status === 'WP' && !updateData.status) {
          updateData.status = 'FP'
        }
      }
    }
    
    // If updating technician, check availability (skip if setting to null)
    if (updateData.assignedTechnician !== undefined && updateData.assignedTechnician !== null) {
      const technician = await User.findById(updateData.assignedTechnician)
      if (!technician || technician.role !== 'technician') {
        return res.status(400).json({ error: 'Invalid technician assigned' })
      }
    }
    
    // If updating service advisor, verify they exist and have service-advisor role
    if (updateData.serviceAdvisor !== undefined) {
      const advisor = await User.findById(updateData.serviceAdvisor)
      if (!advisor || advisor.role !== 'service-advisor') {
        return res.status(400).json({ error: 'Invalid service advisor assigned' })
      }
    }
    
    // Check for conflicts with other job orders if technician is being updated
    if (updateData.assignedTechnician !== undefined && updateData.assignedTechnician !== null) {
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
      jobOrder._id,
      updateData,
      { new: true }
    )
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    return res.json({ jobOrder: updatedJobOrder })
  } catch (error) {
    console.error('Error updating job order:', error)
    return res.status(500).json({ error: 'Internal server error' })
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
    
    return res.json({ message: 'Job order deleted successfully' })
  } catch (error) {
    console.error('Error deleting job order:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Toggle important status
router.patch('/:id/toggle-important', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const jobOrder = await JobOrder.findById(req.params.id)
    if (!jobOrder) {
      return res.status(404).json({ error: 'Job order not found' })
    }
    
    jobOrder.isImportant = !jobOrder.isImportant
    await jobOrder.save()
    
    const updatedJobOrder = await JobOrder.findById(jobOrder._id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    return res.json({ jobOrder: updatedJobOrder })
  } catch (error) {
    console.error('Error toggling important status:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Submit job order for Quality Inspection
router.patch('/:id/submit-qi', verifyToken, requireRole(['administrator', 'job-controller', 'technician']), async (req, res) => {
  try {
    await connectToMongo()
    
    const jobOrder = await JobOrder.findById(req.params.id)
    if (!jobOrder) {
      return res.status(404).json({ error: 'Job order not found' })
    }
    
    // Check if all tasks are finished
    const allTasksFinished = jobOrder.jobList.every((task: any) => task.status === 'Finished')
    if (!allTasksFinished) {
      return res.status(400).json({ error: 'Cannot submit for QI: Not all tasks are finished' })
    }
    
    // Check if all parts are available
    const allPartsAvailable = jobOrder.parts.every((part: any) => part.availability === 'Available')
    if (!allPartsAvailable) {
      return res.status(400).json({ error: 'Cannot submit for QI: Not all parts are available' })
    }
    
    jobOrder.status = 'QI'
    jobOrder.qiStatus = 'pending'
    await jobOrder.save()
    
    const updatedJobOrder = await JobOrder.findById(jobOrder._id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    return res.json({ jobOrder: updatedJobOrder })
  } catch (error) {
    console.error('Error submitting for QI:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Approve QI and mark for release
router.patch('/:id/approve-qi', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const jobOrder = await JobOrder.findById(req.params.id)
    if (!jobOrder) {
      return res.status(404).json({ error: 'Job order not found' })
    }
    
    if (jobOrder.status !== 'QI' || jobOrder.qiStatus !== 'pending') {
      return res.status(400).json({ error: 'Job order is not pending QI' })
    }
    
    jobOrder.status = 'FR'
    jobOrder.qiStatus = 'approved'
    await jobOrder.save()
    
    const updatedJobOrder = await JobOrder.findById(jobOrder._id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    return res.json({ jobOrder: updatedJobOrder })
  } catch (error) {
    console.error('Error approving QI:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Reject QI and mark for re-assessment
router.patch('/:id/reject-qi', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const jobOrder = await JobOrder.findById(req.params.id)
    if (!jobOrder) {
      return res.status(404).json({ error: 'Job order not found' })
    }
    
    if (jobOrder.status !== 'QI' || jobOrder.qiStatus !== 'pending') {
      return res.status(400).json({ error: 'Job order is not pending QI' })
    }
    
    jobOrder.status = 'FP'
    jobOrder.qiStatus = 'rejected'
    await jobOrder.save()
    
    const updatedJobOrder = await JobOrder.findById(jobOrder._id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    return res.json({ jobOrder: updatedJobOrder })
  } catch (error) {
    console.error('Error rejecting QI:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Complete a job (move from For Release to Finished Unclaimed)
router.patch('/:id/complete', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const jobOrder = await JobOrder.findById(req.params.id)
    if (!jobOrder) {
      return res.status(404).json({ error: 'Job order not found' })
    }
    
    if (jobOrder.status !== 'FR') {
      return res.status(400).json({ error: 'Job order is not marked for release' })
    }
    
    jobOrder.status = 'FU'  // Finished Unclaimed - automatically marked when approved from For Release
    await jobOrder.save()
    
    const updatedJobOrder = await JobOrder.findById(jobOrder._id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    return res.json({ jobOrder: updatedJobOrder })
  } catch (error) {
    console.error('Error completing job:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Mark job as Complete (final status - released to customer)
router.patch('/:id/mark-complete', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const jobOrder = await JobOrder.findById(req.params.id)
    if (!jobOrder) {
      return res.status(404).json({ error: 'Job order not found' })
    }
    
    if (jobOrder.status !== 'FU') {
      return res.status(400).json({ error: 'Job order must be in Finished Unclaimed status' })
    }
    
    jobOrder.status = 'CP'  // Complete - final status when released to customer
    await jobOrder.save()
    
    const updatedJobOrder = await JobOrder.findById(jobOrder._id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    return res.json({ jobOrder: updatedJobOrder })
  } catch (error) {
    console.error('Error marking job as complete:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Redo a job (move from For Release back to On Going)
router.patch('/:id/redo', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const jobOrder = await JobOrder.findById(req.params.id)
    if (!jobOrder) {
      return res.status(404).json({ error: 'Job order not found' })
    }
    
    if (jobOrder.status !== 'FR') {
      return res.status(400).json({ error: 'Job order is not marked for release' })
    }
    
    jobOrder.status = 'QI'  // Back to Quality Inspection for rework
    jobOrder.qiStatus = 'pending'  // Reset QI status to pending
    await jobOrder.save()
    
    const updatedJobOrder = await JobOrder.findById(jobOrder._id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    return res.json({ jobOrder: updatedJobOrder })
  } catch (error) {
    console.error('Error redoing job:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Check and mark carry-over jobs from previous days
router.post('/check-carry-over', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Find all jobs from previous days that are not completed and not already marked as carried over
    const previousDaysJobs = await JobOrder.find({
      date: { $lt: today },
      status: { $nin: ['FR', 'FU', 'CP'] }, // Not completed statuses
      carriedOver: { $ne: true } // Not already marked as carried over
    })
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    // Mark them as carried over and update their source type
    const updates = previousDaysJobs.map((job: any) => 
      JobOrder.findByIdAndUpdate(
        job._id,
        { 
          carriedOver: true,
          sourceType: 'carry-over',
          assignedTechnician: null, // Remove technician assignment for replotting
          timeRange: { start: '00:00', end: '00:00' } // Reset time range
        },
        { new: true }
      )
    )
    
    const updatedJobs = await Promise.all(updates)
    
    return res.json({ 
      message: 'Carry-over jobs processed successfully',
      count: updatedJobs.length,
      jobs: updatedJobs
    })
  } catch (error) {
    console.error('Error checking carry over:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Mark unfinished jobs as carry over (to be run at end of day)
router.post('/mark-carry-over', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const { date } = req.body
    const targetDate = date ? new Date(date) : new Date()
    
    // Set time to start and end of day
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0))
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999))
    
    // Find all unfinished jobs for the day (status not FR, FU, or CP)
    const unfinishedJobs = await JobOrder.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      status: { $nin: ['FR', 'FU', 'CP'] },
      carriedOver: { $ne: true }
    })
    
    // Mark them as carried over
    const updates = unfinishedJobs.map((job: any) => {
      job.carriedOver = true
      return job.save()
    })
    
    await Promise.all(updates)
    
    return res.json({ 
      message: 'Unfinished jobs marked as carry over',
      count: unfinishedJobs.length
    })
  } catch (error) {
    console.error('Error marking carry over:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
