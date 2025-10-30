const { Router } = require('express')
const { z } = require('zod')
const { connectToMongo } = require('../config/mongo.js')
const { JobOrder } = require('../models/JobOrder.js')
const { User } = require('../models/User.js')
const { Appointment } = require('../models/Appointment.js')
const { WorkshopSnapshot } = require('../models/WorkshopSnapshot.js')
const { verifyToken, requireRole } = require('../middleware/auth.js')

const router = Router()
const logger = require('../utils/logger.ts')

// Get all job orders with optional filtering, search, and pagination
router.get('/', verifyToken, async (req, res) => {
  try {
    await connectToMongo()
    
    const { status, technician, date, search, assignedToMe, carriedOver, page = '1', limit = '10' } = req.query
    
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

    // Optional carriedOver boolean filter
    if (typeof carriedOver !== 'undefined') {
      if (carriedOver === 'true') filter.carriedOver = true
      else if (carriedOver === 'false') filter.carriedOver = { $ne: true }
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

// Get available time slots for walk-ins
router.get('/walk-in-slots', verifyToken, async (req, res) => {
  try {
    await connectToMongo()
    
    const { date, duration } = req.query
    
    if (!date || !duration) {
      return res.status(400).json({ error: 'Date and duration are required' })
    }
    
    const jobDate = new Date(date as string)
    const durationMinutes = parseInt(duration as string)
    
    // Get all technicians
    const technicians = await User.find({ role: 'technician' }).select('name email level breakTimes').lean()
    
    // Get all job orders and appointments for the date
    const jobOrders = await JobOrder.find({
      date: {
        $gte: new Date(jobDate.toISOString().split('T')[0] || ''),
        $lt: new Date(new Date(jobDate).setDate(jobDate.getDate() + 1))
      }
    }).select('assignedTechnician timeRange').lean()
    
    const appointments = await Appointment.find({
      date: {
        $gte: new Date(jobDate.toISOString().split('T')[0] || ''),
        $lt: new Date(new Date(jobDate).setDate(jobDate.getDate() + 1))
      }
    }).select('assignedTechnician timeRange').lean()
    
    // Generate time slots from 7:00 AM to 6:00 PM (30-minute intervals)
    const generateTimeSlots = () => {
      const slots = []
      for (let hour = 7; hour <= 18; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
          slots.push(timeStr)
        }
      }
      return slots
    }
    
    const timeSlots = generateTimeSlots()
    
    // Helper function to calculate end time accounting for break times
    const calculateEndTimeWithBreaks = (startTime: string, durationMinutes: number, breakTimes: any[]): string => {
      const [startHour, startMinute] = startTime.split(':').map(Number)
      const startDate = new Date()
      startDate.setHours(startHour, startMinute, 0, 0)
      
      // Calculate initial end time without breaks
      let endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000)
      
      // Check if the time range crosses any break time
      for (const breakTime of breakTimes) {
        const [breakStartHour, breakStartMinute] = breakTime.startTime.split(':').map(Number)
        const [breakEndHour, breakEndMinute] = breakTime.endTime.split(':').map(Number)
        
        const breakStartDate = new Date()
        breakStartDate.setHours(breakStartHour, breakStartMinute, 0, 0)
        
        const breakEndDate = new Date()
        breakEndDate.setHours(breakEndHour, breakEndMinute, 0, 0)
        
        const breakDuration = (breakEndDate.getTime() - breakStartDate.getTime()) / (1000 * 60)
        
        // Work overlaps if: start < breakEnd AND initialEnd > breakStart
        if (startDate < breakEndDate && endDate > breakStartDate) {
          // The break falls within the work period - add break duration to skip it
          endDate = new Date(endDate.getTime() + breakDuration * 60 * 1000)
        }
      }
      
      const endHour = String(endDate.getHours()).padStart(2, '0')
      const endMinute = String(endDate.getMinutes()).padStart(2, '0')
      return `${endHour}:${endMinute}`
    }
    
    // Helper function to check if a time is within a range
    const isTimeInRange = (time: string, start: string, end: string): boolean => {
      const [tHour, tMin] = time.split(':').map(Number)
      const [sHour, sMin] = start.split(':').map(Number)
      const [eHour, eMin] = end.split(':').map(Number)
      
      const tMinutes = tHour * 60 + tMin
      const sMinutes = sHour * 60 + sMin
      const eMinutes = eHour * 60 + eMin
      
      return tMinutes >= sMinutes && tMinutes < eMinutes
    }
    
    // Helper function to check if technician has break time during slot
    const hasBreakTimeOverlap = (startTime: string, durationMinutes: number, breakTimes: any[]): boolean => {
      const [startHour, startMinute] = startTime.split(':').map(Number)
      const startMinutes = startHour * 60 + startMinute
      const endMinutes = startMinutes + durationMinutes
      
      return breakTimes.some((breakTime: any) => {
        const [breakStartHour, breakStartMinute] = breakTime.startTime.split(':').map(Number)
        const [breakEndHour, breakEndMinute] = breakTime.endTime.split(':').map(Number)
        
        const breakStartMinutes = breakStartHour * 60 + breakStartMinute
        const breakEndMinutes = breakEndHour * 60 + breakEndMinute
        
        // Check if appointment overlaps with break time
        return startMinutes < breakEndMinutes && endMinutes > breakStartMinutes
      })
    }
    
    // Calculate available slots for each technician
    const technicianSlots = technicians.map(technician => {
      const technicianJobs = jobOrders.filter(job => job.assignedTechnician?.toString() === technician._id.toString())
      const technicianAppointments = appointments.filter(appt => appt.assignedTechnician?.toString() === technician._id.toString())
      
      // Calculate daily hours for this technician
      let totalHours = 0
      for (const job of technicianJobs) {
        const [startHour, startMinute] = job.timeRange.start.split(':').map(Number)
        const [endHour, endMinute] = job.timeRange.end.split(':').map(Number)
        const startMinutes = startHour * 60 + startMinute
        const endMinutes = endHour * 60 + endMinute
        totalHours += (endMinutes - startMinutes) / 60
      }
      
      const availableSlots = []
      
      for (const startTime of timeSlots) {
        // Calculate end time accounting for break times
        const endTime = calculateEndTimeWithBreaks(startTime, durationMinutes, technician.breakTimes || [])
        
        // Check if this slot conflicts with any existing jobs
        const hasJobConflict = technicianJobs.some(job => {
          return isTimeInRange(startTime, job.timeRange.start, job.timeRange.end) ||
                 isTimeInRange(endTime, job.timeRange.start, job.timeRange.end) ||
                 (startTime <= job.timeRange.start && endTime >= job.timeRange.end)
        })
        
        // Check if this slot conflicts with any appointments
        const hasAppointmentConflict = technicianAppointments.some(appt => {
          return isTimeInRange(startTime, appt.timeRange.start, appt.timeRange.end) ||
                 isTimeInRange(endTime, appt.timeRange.start, appt.timeRange.end) ||
                 (startTime <= appt.timeRange.start && endTime >= appt.timeRange.end)
        })
        
        // Check if this slot overlaps with break times
        const hasBreakOverlap = hasBreakTimeOverlap(startTime, durationMinutes, technician.breakTimes || [])
        
        // Check if adding this job would exceed daily limit
        const jobHours = durationMinutes / 60
        const wouldExceedLimit = totalHours + jobHours > 7.5
        
        // Check if end time is within working hours (before 6:00 PM)
        const [endHour, endMinute] = endTime.split(':').map(Number)
        const isWithinWorkingHours = endHour < 18 || (endHour === 18 && endMinute === 0)
        
        if (!hasJobConflict && !hasAppointmentConflict && !hasBreakOverlap && !wouldExceedLimit && isWithinWorkingHours) {
          availableSlots.push({
            startTime,
            endTime,
            durationHighlight: `${durationMinutes} min`,
            dailyHoursRemaining: Math.max(0, 7.5 - totalHours)
          })
        }
      }
      
      return {
        technician: {
          _id: technician._id,
          name: technician.name,
          level: technician.level
        },
        availableSlots,
        currentDailyHours: totalHours,
        dailyHoursRemaining: Math.max(0, 7.5 - totalHours)
      }
    })
    
    return res.json({ technicianSlots })
  } catch (error) {
    console.error('Error fetching walk-in slots:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Get available time slots for workshop timetable (30-minute intervals)
router.get('/workshop-slots', verifyToken, async (req, res) => {
  try {
    await connectToMongo()
    
    const { date } = req.query
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' })
    }
    
    const jobDate = new Date(date as string)
    
    // Get all technicians
    const technicians = await User.find({ role: 'technician' }).select('name email level breakTimes').lean()
    
    // Get all job orders and appointments for the date
    const jobOrders = await JobOrder.find({
      date: {
        $gte: new Date(jobDate.toISOString().split('T')[0] || ''),
        $lt: new Date(new Date(jobDate).setDate(jobDate.getDate() + 1))
      }
    }).select('assignedTechnician timeRange').lean()
    
    const appointments = await Appointment.find({
      date: {
        $gte: new Date(jobDate.toISOString().split('T')[0] || ''),
        $lt: new Date(new Date(jobDate).setDate(jobDate.getDate() + 1))
      }
    }).select('assignedTechnician timeRange').lean()
    
    // Generate time slots from 7:00 AM to 6:00 PM (30-minute intervals)
    const generateTimeSlots = () => {
      const slots = []
      for (let hour = 7; hour <= 18; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
          slots.push(timeStr)
        }
      }
      return slots
    }
    
    const timeSlots = generateTimeSlots()
    
    // Helper function to check if a time is within a range
    const isTimeInRange = (time: string, start: string, end: string): boolean => {
      const [tHour, tMin] = time.split(':').map(Number)
      const [sHour, sMin] = start.split(':').map(Number)
      const [eHour, eMin] = end.split(':').map(Number)
      
      const tMinutes = tHour * 60 + tMin
      const sMinutes = sHour * 60 + sMin
      const eMinutes = eHour * 60 + eMin
      
      return tMinutes >= sMinutes && tMinutes < eMinutes
    }
    
    // Helper function to check if a time slot overlaps with break times
    const hasBreakTimeOverlap = (startTime: string, durationMinutes: number, breakTimes: any[]): boolean => {
      if (!breakTimes || breakTimes.length === 0) return false
      
      const [startHour, startMinute] = startTime.split(':').map(Number)
      const startMinutes = startHour * 60 + startMinute
      const endMinutes = startMinutes + durationMinutes
      
      return breakTimes.some(breakTime => {
        const [breakStartHour, breakStartMinute] = breakTime.startTime.split(':').map(Number)
        const [breakEndHour, breakEndMinute] = breakTime.endTime.split(':').map(Number)
        
        const breakStartMinutes = breakStartHour * 60 + breakStartMinute
        const breakEndMinutes = breakEndHour * 60 + breakEndMinute
        
        // Check if the time slot overlaps with the break time
        return (startMinutes < breakEndMinutes && endMinutes > breakStartMinutes)
      })
    }
    
    // Calculate available slots for each technician
    const technicianSlots = technicians.map(technician => {
      const technicianJobs = jobOrders.filter(job => 
        job.assignedTechnician && job.assignedTechnician.toString() === technician._id.toString()
      )
      
      const technicianAppointments = appointments.filter(appt => 
        appt.assignedTechnician && appt.assignedTechnician.toString() === technician._id.toString()
      )
      
      // Calculate total hours for the day
      let totalHours = 0
      for (const job of technicianJobs) {
        const [startHour, startMinute] = job.timeRange.start.split(':').map(Number)
        const [endHour, endMinute] = job.timeRange.end.split(':').map(Number)
        const hours = ((endHour * 60 + endMinute) - (startHour * 60 + startMinute)) / 60
        totalHours += hours
      }
      
      const availableSlots = []
      
      for (const startTime of timeSlots) {
        // Check if this slot conflicts with any existing jobs
        const hasJobConflict = technicianJobs.some(job => {
          return isTimeInRange(startTime, job.timeRange.start, job.timeRange.end)
        })
        
        // Check if this slot conflicts with any appointments
        const hasAppointmentConflict = technicianAppointments.some(appt => {
          return isTimeInRange(startTime, appt.timeRange.start, appt.timeRange.end)
        })
        
        // Check if this slot overlaps with break times
        const hasBreakOverlap = hasBreakTimeOverlap(startTime, 30, technician.breakTimes || [])
        
        // Check if end time is within working hours (before 6:00 PM)
        const [startHour, startMinute] = startTime.split(':').map(Number)
        const endMinutes = startHour * 60 + startMinute + 30
        const endHour = Math.floor(endMinutes / 60)
        const endMin = endMinutes % 60
        const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
        const isWithinWorkingHours = endHour < 18 || (endHour === 18 && endMin === 0)
        
        if (!hasJobConflict && !hasAppointmentConflict && !hasBreakOverlap && isWithinWorkingHours) {
          availableSlots.push({
            startTime,
            endTime,
            duration: 30
          })
        }
      }
      
      return {
        technician: {
          _id: technician._id,
          name: technician.name,
          level: technician.level
        },
        availableSlots,
        currentDailyHours: totalHours,
        dailyHoursRemaining: Math.max(0, 7.5 - totalHours)
      }
    })
    
    return res.json({ technicianSlots })
  } catch (error) {
    console.error('Error fetching workshop slots:', error)
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
    
    // Find unassigned jobs (no technician or in UA status - unassigned)
    // that could fit in this time slot
    const availableJobs = await JobOrder.find({
      $and: [
        {
          $or: [
            // Jobs without technician assignment  
            { assignedTechnician: null, status: { $nin: ['CP', 'FR', 'FU', 'QI'] } },
            // Jobs in UA status (unassigned - parts are available)
            { status: 'UA' }
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

// Dashboard endpoint - get stats and categorized jobs
router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    console.log('🔄 SERVER - Dashboard API called')
    await connectToMongo()
    
    // Get all job orders with populated fields
    const allJobs = await JobOrder.find({})
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .sort({ createdAt: -1 })
      .lean()
    
    console.log('📊 Total jobs found:', allJobs.length)
    
    // Calculate statistics
    const stats = {
      total: allJobs.length,
      onGoing: allJobs.filter(job => job.status === 'OG').length,
      forRelease: allJobs.filter(job => job.status === 'FR').length,
      onHold: allJobs.filter(job => ['HC', 'HW', 'HI', 'WP'].includes(job.status)).length,
      carriedOver: allJobs.filter(job => job.carriedOver === true).length,
      important: allJobs.filter(job => job.isImportant === true).length,
      qualityInspection: allJobs.filter(job => job.status === 'QI').length,
      finishedUnclaimed: allJobs.filter(job => ['FU', 'CP'].includes(job.status)).length
    }
    
    // Categorize jobs
    const carriedOverJobs = allJobs.filter(job => job.carriedOver === true)
    const importantJobs = allJobs.filter(job => job.isImportant === true)
    const anomalyJobs = allJobs.filter(job => 
      ['HC', 'HW', 'HI', 'WP'].includes(job.status) || 
      job.status === 'QI' || 
      ['FU', 'CP'].includes(job.status)
    )
    
    console.log('📈 Dashboard stats:', stats)
    console.log('📋 Carried over jobs:', carriedOverJobs.length)
    console.log('⭐ Important jobs:', importantJobs.length)
    console.log('⚠️ Anomaly jobs:', anomalyJobs.length)
    
    return res.json({
      stats,
      carriedOverJobs,
      importantJobs,
      anomalyJobs,
      allJobs
    })
  } catch (error) {
    console.error('💥 Dashboard API error:', error)
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
  vin: z.string().min(1).max(14),
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
  status: z.enum(['OG', 'WP', 'UA', 'QI', 'HC', 'HW', 'HI', 'HF', 'SU', 'FR', 'FU', 'CP']).optional()
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
    
    // Check daily hour limit (7.5 hours)
    const existingJobs = await JobOrder.find({
      assignedTechnician,
      date: {
        $gte: new Date(jobDate.toISOString().split('T')[0] || ''),
        $lt: new Date(new Date(jobDate).setDate(jobDate.getDate() + 1))
      }
    })
    
    // Calculate total hours for the day
    let totalHours = 0
    for (const job of existingJobs) {
      const start = new Date(`${jobDate.toISOString().split('T')[0]}T${job.timeRange.start}:00`)
      const end = new Date(`${jobDate.toISOString().split('T')[0]}T${job.timeRange.end}:00`)
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      totalHours += hours
    }
    
    // Add the new job hours
    const newJobHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60)
    const totalWithNewJob = totalHours + newJobHours
    
    if (totalWithNewJob > 7.5) {
      return res.status(409).json({ 
        error: `Technician daily limit exceeded. Current: ${totalHours.toFixed(1)}h, New job: ${newJobHours.toFixed(1)}h, Total: ${totalWithNewJob.toFixed(1)}h (Limit: 7.5h)` 
      })
    }
    
    // Get user ID from JWT token
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }
    
    // Determine initial status
    // Always check for missing parts and auto-set to WP if any parts are unavailable
    let initialStatus = status || 'OG'
    if (parts && parts.length > 0) {
      const hasUnavailableParts = parts.some(part => part.availability === 'Unavailable')
      // If any parts are unavailable, set to WP regardless of provided status
      if (hasUnavailableParts) {
        initialStatus = 'WP'
      }
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
    
    try {
      await logger.audit('Job order created', {
        userId: req.user?.userId,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        context: { jobId: String(jobOrder._id), jobNumber: jobOrder.jobNumber }
      })
    } catch {}

    return res.status(201).json({ jobOrder: populatedJobOrder })
  } catch (error) {
    console.error('Error creating job order:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Status transition validation rules
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  'OG': ['WP', 'UA', 'QI', 'HC', 'HW', 'HI', 'HF', 'SU', 'OG'], // Can stay OG or move to other statuses
  'WP': ['UA', 'OG', 'HC', 'HW', 'HI', 'HF', 'SU', 'WP'], // Waiting parts can go to unassigned or other statuses
  'UA': ['OG', 'WP', 'UA'], // Unassigned can be assigned to ongoing or back to WP
  'QI': ['FR', 'UA', 'QI'], // QI can approve to release or reject to unassigned
  'HC': ['OG', 'WP', 'UA', 'HC'], // Hold customer can resume
  'HW': ['OG', 'WP', 'UA', 'HW'], // Hold warranty can resume
  'HI': ['OG', 'WP', 'UA', 'HI'], // Hold insurance can resume
  'HF': ['OG', 'WP', 'UA', 'HF'], // Hold Ford can resume
  'SU': ['OG', 'WP', 'UA', 'SU'], // Sublet can resume
  'FR': ['FU', 'CP', 'QI', 'FR'], // For release can complete, finish unclaimed, or redo back to QI
  'FU': ['CP', 'FU'], // Finished unclaimed can be marked complete
  'CP': ['CP'] // Complete is final state
}

// Update job order
const updateJobOrderSchema = z.object({
  assignedTechnician: z.string().nullable().optional(),
  serviceAdvisor: z.string().min(1).optional(),
  plateNumber: z.string().optional(),
  vin: z.string().max(14).optional(),
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
  status: z.enum(['OG', 'WP', 'UA', 'QI', 'HC', 'HW', 'HI', 'HF', 'SU', 'FR', 'FU', 'CP']).optional(),
  date: z.string().optional(), // Allow date updates for reassignment
  carriedOver: z.boolean().optional(),
  isImportant: z.boolean().optional(),
  qiStatus: z.enum(['pending', 'approved', 'rejected']).nullable().optional(),
  holdCustomerRemarks: z.string().optional(),
  subletRemarks: z.string().optional()
})

router.put('/:id', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    console.log('🔄 SERVER - Job Order Update Request')
    console.log('📋 Job ID:', req.params.id)
    console.log('📤 Update Data:', JSON.stringify(req.body, null, 2))
    
    await connectToMongo()
    
    const parsed = updateJobOrderSchema.safeParse(req.body)
    if (!parsed.success) {
      console.log('❌ SERVER - Validation failed:', parsed.error.issues)
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues })
    }
    
    console.log('✅ SERVER - Validation passed')
    
    // Check if the id is a MongoDB ObjectId or a job number
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id)
    let jobOrder
    
    if (isObjectId) {
      // Search by MongoDB _id
      console.log('🔍 SERVER - Searching by MongoDB _id')
      jobOrder = await JobOrder.findById(req.params.id)
    } else {
      // Search by job number
      console.log('🔍 SERVER - Searching by job number')
      jobOrder = await JobOrder.findOne({ jobNumber: req.params.id })
    }
    
    if (!jobOrder) {
      console.log('❌ SERVER - Job order not found')
      return res.status(404).json({ error: 'Job order not found' })
    }
    
    console.log('✅ SERVER - Job order found:', {
      _id: jobOrder._id,
      jobNumber: jobOrder.jobNumber,
      status: jobOrder.status,
      carriedOver: jobOrder.carriedOver
    })
    
    const updateData = parsed.data
    
    console.log('📅 SERVER - Update data after validation:', JSON.stringify(updateData, null, 2))
    
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
        
        // If all parts become available and job is in WP status, change to UA (Unassigned)
        if (allPartsAvailable && jobOrder.status === 'WP' && !updateData.status) {
          updateData.status = 'UA'
        }
      }
      
      // If status is being changed to UA (Unassigned), remove technician assignment and reset time range
      if (updateData.status === 'UA') {
        updateData.assignedTechnician = null
        // Reset time range to default placeholder values
        updateData.timeRange = { start: '00:00', end: '00:00' }
      }
    } else {
      // If parts array is empty, ensure job can proceed (no parts dependency)
      if (jobOrder.status === 'WP' && !updateData.status) {
        updateData.status = 'UA'
      }
    }
    
    // If updating technician, check availability (skip if setting to null)
    if (updateData.assignedTechnician !== undefined && updateData.assignedTechnician !== null) {
      console.log('👤 Assigning technician to job:', updateData.assignedTechnician)
      console.log('📋 Current job status:', jobOrder.status)
      console.log('📋 Current job carriedOver:', jobOrder.carriedOver)
      
      const technician = await User.findById(updateData.assignedTechnician)
      if (!technician || technician.role !== 'technician') {
        console.log('❌ Invalid technician:', updateData.assignedTechnician)
        return res.status(400).json({ error: 'Invalid technician assigned' })
      }
      console.log('✅ Technician found:', technician.name)
      
      // If assigning a technician and no explicit status is set, set to 'OG' (On Going)
      if (!updateData.status && (jobOrder.status === 'UA' || jobOrder.carriedOver)) {
        updateData.status = 'OG'
        console.log('🔄 Setting status to OG for reassigned job (was:', jobOrder.status, ', carriedOver:', jobOrder.carriedOver, ')')
      }
      
      // If this is a carry-over job being reassigned, preserve the carry-over chain
      // but allow carriedOver to be set to false to remove from carry-over queue
      if (jobOrder.carriedOver) {
        console.log('🔄 Processing carry-over job reassignment')
        
        // Preserve original job ID and carry-over chain for tracking (to show 🔄 icon)
        if (jobOrder.originalJobId) {
          updateData.originalJobId = jobOrder.originalJobId
        }
        if (jobOrder.carryOverChain && jobOrder.carryOverChain.length > 0) {
          updateData.carryOverChain = jobOrder.carryOverChain
        }
        
        // If carriedOver is explicitly set to false in the request, respect that
        // This removes the job from carry-over queue while preserving the carry-over chain
        if (updateData.carriedOver === false) {
          console.log('🔄 Removing from carry-over queue (carriedOver set to false)')
        } else {
          // If not explicitly set, preserve the original carriedOver status
          updateData.carriedOver = jobOrder.carriedOver
          console.log('🔄 Preserving carriedOver flag:', jobOrder.carriedOver)
        }
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
      
      // Check daily hour limit (7.5 hours) for the new technician
      const existingJobs = await JobOrder.find({
        _id: { $ne: jobOrder._id },
        assignedTechnician: updateData.assignedTechnician,
        date: {
          $gte: new Date(jobOrder.date.toISOString().split('T')[0]),
          $lt: new Date(new Date(jobOrder.date).setDate(jobOrder.date.getDate() + 1))
        }
      })
      
      // Calculate total hours for the day
      let totalHours = 0
      for (const job of existingJobs) {
        const start = new Date(`${jobOrder.date.toISOString().split('T')[0]}T${job.timeRange.start}:00`)
        const end = new Date(`${jobOrder.date.toISOString().split('T')[0]}T${job.timeRange.end}:00`)
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        totalHours += hours
      }
      
      // Add the current job hours (with updated time range if provided)
      const currentJobStart = new Date(`${jobOrder.date.toISOString().split('T')[0]}T${timeRange.start}:00`)
      const currentJobEnd = new Date(`${jobOrder.date.toISOString().split('T')[0]}T${timeRange.end}:00`)
      const currentJobHours = (currentJobEnd.getTime() - currentJobStart.getTime()) / (1000 * 60 * 60)
      const totalWithCurrentJob = totalHours + currentJobHours
      
      if (totalWithCurrentJob > 7.5) {
        return res.status(409).json({ 
          error: `Technician daily limit exceeded. Current: ${totalHours.toFixed(1)}h, This job: ${currentJobHours.toFixed(1)}h, Total: ${totalWithCurrentJob.toFixed(1)}h (Limit: 7.5h)` 
        })
      }
    }
    
    console.log('💾 SERVER - Final update data:', JSON.stringify(updateData, null, 2))
    
    const updatedJobOrder = await JobOrder.findByIdAndUpdate(
      jobOrder._id,
      updateData,
      { new: true }
    )
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    try {
      await logger.audit('Job order updated', {
        userId: req.user?.userId,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        context: { jobId: String(jobOrder._id), changes: updateData }
      })
    } catch {}

    console.log('✅ SERVER - Job order updated successfully:', {
      _id: updatedJobOrder?._id,
      jobNumber: updatedJobOrder?.jobNumber,
      status: updatedJobOrder?.status,
      carriedOver: updatedJobOrder?.carriedOver,
      assignedTechnician: updatedJobOrder?.assignedTechnician,
      date: updatedJobOrder?.date,
      originalCreatedDate: updatedJobOrder?.originalCreatedDate
    })
    
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
    
    try {
      await logger.audit('Job order deleted', {
        userId: req.user?.userId,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        context: { jobId: String(jobOrder._id), jobNumber: jobOrder.jobNumber }
      })
    } catch {}

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
    
    try {
      await logger.audit('Job order important toggled', {
        userId: req.user?.userId,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        context: { jobId: String(jobOrder._id), isImportant: jobOrder.isImportant }
      })
    } catch {}

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
    
    try { await logger.audit('Job order submitted for QI', { userId: req.user?.userId, userEmail: req.user?.email, userRole: req.user?.role, context: { jobId: String(jobOrder._id) } }) } catch {}

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
    
    try { await logger.audit('QI approved', { userId: req.user?.userId, userEmail: req.user?.email, userRole: req.user?.role, context: { jobId: String(jobOrder._id) } }) } catch {}

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
    
    jobOrder.status = 'UA'
    jobOrder.qiStatus = 'rejected'
    await jobOrder.save()
    
    const updatedJobOrder = await JobOrder.findById(jobOrder._id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    try { await logger.audit('QI rejected', { userId: req.user?.userId, userEmail: req.user?.email, userRole: req.user?.role, context: { jobId: String(jobOrder._id) } }) } catch {}

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
    
    jobOrder.status = 'FU'  // Finished Unclaimed - when customer hasn't claimed the job
    await jobOrder.save()
    
    const updatedJobOrder = await JobOrder.findById(jobOrder._id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    try { await logger.audit('Job order marked finished-unclaimed', { userId: req.user?.userId, userEmail: req.user?.email, userRole: req.user?.role, context: { jobId: String(jobOrder._id) } }) } catch {}

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
    
    try { await logger.audit('Job order marked complete', { userId: req.user?.userId, userEmail: req.user?.email, userRole: req.user?.role, context: { jobId: String(jobOrder._id) } }) } catch {}

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
    
    try { await logger.audit('Job order redo to QI', { userId: req.user?.userId, userEmail: req.user?.email, userRole: req.user?.role, context: { jobId: String(jobOrder._id) } }) } catch {}

    return res.json({ jobOrder: updatedJobOrder })
  } catch (error) {
    console.error('Error redoing job:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// End of day processing: Create snapshot and mark carry-over jobs
router.post('/end-of-day', verifyToken, requireRole(['administrator', 'job-controller', 'superadmin']), async (req, res) => {
  try {
    await connectToMongo()
    
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }
    
    // Get today's date and set to start of day
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Get all jobs for today to create snapshot
    const todayJobs = await JobOrder.find({
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    })
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    // Calculate statistics
    const stats = {
      totalJobs: todayJobs.length,
      onGoing: todayJobs.filter(job => job.status === 'OG').length,
      forRelease: todayJobs.filter(job => job.status === 'FR').length,
      onHold: todayJobs.filter(job => ['HC', 'HW', 'HI', 'WP'].includes(job.status)).length,
      carriedOver: todayJobs.filter(job => job.carriedOver === true).length,
      important: todayJobs.filter(job => job.isImportant === true).length,
      qualityInspection: todayJobs.filter(job => job.status === 'QI').length,
      finishedUnclaimed: todayJobs.filter(job => ['FU', 'CP'].includes(job.status)).length
    }
    
    // Find jobs that will be marked as carry over
    const unfinishedJobs = await JobOrder.find({
      date: { $lt: today }, // Only jobs from previous days
      status: { $nin: ['FR', 'FU', 'CP'] }, // Not completed statuses
      carriedOver: { $ne: true } // Not already marked as carried over
    })
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    // Create carry-over jobs list for snapshot
    const carryOverJobs = unfinishedJobs.map(job => ({
      _id: job._id.toString(),
      jobNumber: job.jobNumber,
      plateNumber: job.plateNumber,
      status: job.status,
      reason: `Status: ${job.status} - Not completed by end of day`
    }))
    
    // Create workshop snapshot
    const snapshot = await WorkshopSnapshot.create({
      date: today,
      createdBy: userId,
      jobOrders: todayJobs.map(job => ({
        _id: String(job._id),
        jobNumber: job.jobNumber || '',
        createdBy: job.createdBy && job.createdBy._id ? {
          _id: String(job.createdBy._id),
          name: job.createdBy.name || 'Unknown',
          email: job.createdBy.email || 'unknown@example.com'
        } : {
          _id: String(userId),
          name: req.user?.name || 'System',
          email: req.user?.email || 'system@example.com'
        },
        assignedTechnician: job.assignedTechnician ? {
          _id: String(job.assignedTechnician._id || ''),
          name: job.assignedTechnician.name || 'Unknown',
          email: job.assignedTechnician.email || 'unknown@example.com'
        } : null,
        serviceAdvisor: job.serviceAdvisor ? {
          _id: String(job.serviceAdvisor._id || ''),
          name: job.serviceAdvisor.name || 'Unknown',
          email: job.serviceAdvisor.email || 'unknown@example.com'
        } : null,
        plateNumber: job.plateNumber || '',
        vin: job.vin || '',
        timeRange: job.timeRange || { start: '00:00', end: '00:00' },
        actualEndTime: job.actualEndTime || undefined,
        jobList: Array.isArray(job.jobList) ? job.jobList : [],
        parts: Array.isArray(job.parts) ? job.parts : [],
        status: job.status,
        date: job.date || new Date(),
        originalCreatedDate: job.originalCreatedDate || job.createdAt || new Date(),
        sourceType: job.sourceType || 'direct',
        carriedOver: !!job.carriedOver,
        isImportant: !!job.isImportant,
        qiStatus: job.qiStatus ?? null,
        holdCustomerRemarks: job.holdCustomerRemarks || undefined,
        subletRemarks: job.subletRemarks || undefined,
        originalJobId: job.originalJobId ? String(job.originalJobId) : undefined,
        carryOverChain: Array.isArray(job.carryOverChain) ? job.carryOverChain : [],
        createdAt: job.createdAt || new Date(),
        updatedAt: job.updatedAt || new Date()
      })),
      statistics: stats,
      carryOverJobs: carryOverJobs
    })
    
    // Mark unfinished jobs as carried over
    const updates = unfinishedJobs.map((job: any) => 
      JobOrder.findByIdAndUpdate(
        job._id,
        { 
          carriedOver: true,
          sourceType: 'carry-over',
          assignedTechnician: null, // Remove technician assignment for replotting
          timeRange: { start: '00:00', end: '00:00' }, // Reset time range
          // If this job doesn't have an originalJobId, set it to itself (first in chain)
          originalJobId: job.originalJobId || job._id,
          // Add to carry-over chain
          $push: {
            carryOverChain: {
              jobId: job._id,
              date: job.date,
              status: job.status
            }
          }
        },
        { new: true }
      )
    )
    
    const updatedJobs = await Promise.all(updates)
    
    return res.json({ 
      message: 'End of day processing completed successfully',
      snapshot: {
        id: snapshot._id,
        date: snapshot.date,
        totalJobs: stats.totalJobs,
        carryOverCount: updatedJobs.length
      },
      carryOverJobs: updatedJobs
    })
  } catch (error) {
    console.error('Error in end of day processing:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Check and mark carry-over jobs from previous days only (legacy endpoint)
router.post('/check-carry-over', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    // Get today's date and set to start of day
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Find jobs from previous days that are not completed and not already marked as carried over
    // This excludes today's newly created jobs
    const unfinishedJobs = await JobOrder.find({
      date: { $lt: today }, // Only jobs from previous days
      status: { $nin: ['FR', 'FU', 'CP'] }, // Not completed statuses
      carriedOver: { $ne: true } // Not already marked as carried over
    })
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    // Mark them as carried over and update their source type
    const updates = unfinishedJobs.map((job: any) => 
      JobOrder.findByIdAndUpdate(
        job._id,
        { 
          carriedOver: true,
          sourceType: 'carry-over',
          assignedTechnician: null, // Remove technician assignment for replotting
          timeRange: { start: '00:00', end: '00:00' }, // Reset time range
          // If this job doesn't have an originalJobId, set it to itself (first in chain)
          originalJobId: job.originalJobId || job._id,
          // Add to carry-over chain
          $push: {
            carryOverChain: {
              jobId: job._id,
              date: job.date,
              status: job.status
            }
          }
        },
        { new: true }
      )
    )
    
    const updatedJobs = await Promise.all(updates)
    
    return res.json({ 
      message: 'Unfinished jobs from previous days marked as carry-over successfully',
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

// Get workshop snapshot for a specific date
router.get('/snapshot/:date', verifyToken, async (req, res) => {
  try {
    await connectToMongo()
    
    const { date } = req.params
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)
    
    const snapshot = await WorkshopSnapshot.findOne({ date: targetDate })
      .populate('createdBy', 'name email')
      .lean()
    
    if (!snapshot) {
      return res.status(404).json({ error: 'No snapshot found for this date' })
    }
    
    return res.json({ snapshot })
  } catch (error) {
    console.error('Error fetching workshop snapshot:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Get list of available workshop snapshots
router.get('/snapshots', verifyToken, async (req, res) => {
  try {
    await connectToMongo()
    
    const { limit = '30' } = req.query
    const limitNum = parseInt(limit as string)
    
    const snapshots = await WorkshopSnapshot.find({})
      .populate('createdBy', 'name email')
      .select('date snapshotDate createdBy statistics.totalJobs statistics.carriedOver carryOverJobs')
      .sort({ date: -1 })
      .limit(limitNum)
      .lean()
    
    return res.json({ snapshots })
  } catch (error) {
    console.error('Error fetching workshop snapshots:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
