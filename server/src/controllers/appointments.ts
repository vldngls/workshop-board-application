const { Router } = require('express')
const { z } = require('zod')
const { connectToMongo } = require('../config/mongo.js')
const { Appointment } = require('../models/Appointment.js')
const { User } = require('../models/User.js')
const { JobOrder } = require('../models/JobOrder.js')
const { verifyToken, requireRole } = require('../middleware/auth.js')

const router = Router()

// Get all appointments with optional filtering
router.get('/', verifyToken, async (req, res) => {
  try {
    await connectToMongo()
    
    const { date, technician, assignedToMe } = req.query
    
    const filter: Record<string, any> = {}
    if (technician) filter.assignedTechnician = technician
    if (assignedToMe === 'true') {
      // Filter to only show appointments assigned to the current user
      filter.assignedTechnician = req.user?.userId
    }
    if (date) {
      const startDate = new Date(date as string)
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 1)
      filter.date = { $gte: startDate, $lt: endDate }
    }
    
    const appointments = await Appointment.find(filter)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email level')
      .populate('serviceAdvisor', 'name email')
      .sort({ date: 1, 'timeRange.start': 1 })
      .lean()
    
    return res.json({ appointments })
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Get appointment by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    await connectToMongo()
    
    const appointment = await Appointment.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email level')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' })
    }
    
    return res.json({ appointment })
  } catch (error) {
    console.error('Error fetching appointment:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Create new appointment
const createAppointmentSchema = z.object({
  assignedTechnician: z.string().min(1),
  serviceAdvisor: z.string().min(1),
  plateNumber: z.string().min(1),
  timeRange: z.object({
    start: z.string(),
    end: z.string()
  }),
  date: z.string().optional()
})

router.post('/', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const parsed = createAppointmentSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues })
    }
    
    const { assignedTechnician, serviceAdvisor, plateNumber, timeRange, date } = parsed.data
    
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
    
    // Get user ID from JWT token
    const userId = req.user?.sub
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }
    
    const appointmentDate = new Date(date || new Date())
    
    // Check for overlapping appointments
    const overlappingAppointment = await Appointment.findOne({
      assignedTechnician,
      date: {
        $gte: new Date(appointmentDate.toISOString().split('T')[0] || ''),
        $lt: new Date(new Date(appointmentDate).setDate(appointmentDate.getDate() + 1))
      },
      $or: [
        {
          'timeRange.start': { $lt: timeRange.end },
          'timeRange.end': { $gt: timeRange.start }
        }
      ]
    })
    
    if (overlappingAppointment) {
      return res.status(409).json({ 
        error: 'Technician already has an appointment during this time',
        details: `Conflicting appointment: ${overlappingAppointment.plateNumber} (${overlappingAppointment.timeRange.start}-${overlappingAppointment.timeRange.end})`
      })
    }
    
    // Check for job order conflicts
    
    // Check for overlapping job orders
    const overlappingJobOrder = await JobOrder.findOne({
      assignedTechnician,
      date: {
        $gte: new Date(appointmentDate.toISOString().split('T')[0] || ''),
        $lt: new Date(new Date(appointmentDate).setDate(appointmentDate.getDate() + 1))
      },
      $or: [
        {
          'timeRange.start': { $lt: timeRange.end },
          'timeRange.end': { $gt: timeRange.start }
        }
      ]
    })
    
    if (overlappingJobOrder) {
      return res.status(409).json({ 
        error: 'Technician already has a job order during this time',
        details: `Conflicting job order: ${overlappingJobOrder.jobNumber} (${overlappingJobOrder.timeRange.start}-${overlappingJobOrder.timeRange.end})`
      })
    }
    
    const appointment = await Appointment.create({
      assignedTechnician,
      serviceAdvisor: serviceAdvisor,
      plateNumber: plateNumber.toUpperCase(),
      timeRange,
      date: appointmentDate,
      createdBy: userId
    })
    
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email level')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    return res.status(201).json({ appointment: populatedAppointment })
  } catch (error) {
    console.error('Error creating appointment:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Update appointment
const updateAppointmentSchema = z.object({
  assignedTechnician: z.string().optional(),
  serviceAdvisor: z.string().min(1).optional(),
  plateNumber: z.string().optional(),
  timeRange: z.object({
    start: z.string(),
    end: z.string()
  }).optional(),
  date: z.string().optional(),
  noShow: z.boolean().optional()
})

router.put('/:id', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const parsed = updateAppointmentSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues })
    }
    
    const appointment = await Appointment.findById(req.params.id)
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' })
    }
    
    const updateData = parsed.data
    
    // If updating technician, verify they exist
    if (updateData.assignedTechnician) {
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
    
    // If date is being updated, convert it
    if (updateData.date) {
      (updateData as any).date = new Date(updateData.date)
    }
    
    // Check for overlaps if technician, time, or date is being changed
    if (updateData.assignedTechnician || updateData.timeRange || updateData.date) {
      const checkTechnician = updateData.assignedTechnician || appointment.assignedTechnician
      const checkTimeRange = updateData.timeRange || appointment.timeRange
      const checkDate = updateData.date ? new Date(updateData.date) : appointment.date
      
      // Check for overlapping appointments (excluding current one)
      const overlappingAppointment = await Appointment.findOne({
        _id: { $ne: req.params.id },
        assignedTechnician: checkTechnician,
        date: {
          $gte: new Date(checkDate.toISOString().split('T')[0]),
          $lt: new Date(new Date(checkDate).setDate(checkDate.getDate() + 1))
        },
        $or: [
          {
            'timeRange.start': { $lt: checkTimeRange.end },
            'timeRange.end': { $gt: checkTimeRange.start }
          }
        ]
      })
      
      if (overlappingAppointment) {
        return res.status(409).json({ 
          error: 'Technician already has an appointment during this time',
          details: `Conflicting appointment: ${overlappingAppointment.plateNumber} (${overlappingAppointment.timeRange.start}-${overlappingAppointment.timeRange.end})`
        })
      }
      
      // Check for job order conflicts
      
      // Check for overlapping job orders
      const overlappingJobOrder = await JobOrder.findOne({
        assignedTechnician: checkTechnician,
        date: {
          $gte: new Date(checkDate.toISOString().split('T')[0]),
          $lt: new Date(new Date(checkDate).setDate(checkDate.getDate() + 1))
        },
        $or: [
          {
            'timeRange.start': { $lt: checkTimeRange.end },
            'timeRange.end': { $gt: checkTimeRange.start }
          }
        ]
      })
      
      if (overlappingJobOrder) {
        return res.status(409).json({ 
          error: 'Technician already has a job order during this time',
          details: `Conflicting job order: ${overlappingJobOrder.jobNumber} (${overlappingJobOrder.timeRange.start}-${overlappingJobOrder.timeRange.end})`
        })
      }
    }
    
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email level')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    return res.json({ appointment: updatedAppointment })
  } catch (error) {
    console.error('Error updating appointment:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Check for conflicts when changing appointment duration
const checkConflictsSchema = z.object({
  timeRange: z.object({
    start: z.string(),
    end: z.string()
  }),
  assignedTechnician: z.string().min(1)
})

router.post('/:id/check-conflicts', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const parsed = checkConflictsSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues })
    }
    
    const appointment = await Appointment.findById(req.params.id)
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' })
    }
    
    const { timeRange, assignedTechnician } = parsed.data
    
    // Find job orders that would conflict with the new time range
    console.log(`Checking conflicts for time range: ${timeRange.start} - ${timeRange.end}`)
    console.log(`Technician: ${assignedTechnician}, Date: ${appointment.date}`)
    
    // First, get all job orders for this technician on this date
    const allJobs = await JobOrder.find({
      assignedTechnician: assignedTechnician,
      date: appointment.date,
      status: { $nin: ['FR', 'FU', 'CP'] } // Exclude completed jobs
    })
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    console.log(`Found ${allJobs.length} jobs for this technician on this date`)
    
    // Filter for conflicts using JavaScript (more reliable than complex MongoDB queries)
    const conflictingJobs = allJobs.filter(job => {
      const jobStart = job.timeRange.start
      const jobEnd = job.timeRange.end
      const newStart = timeRange.start
      const newEnd = timeRange.end
      
      console.log(`Checking job ${job.jobNumber}: ${jobStart} - ${jobEnd} vs new: ${newStart} - ${newEnd}`)
      
      // Convert time strings to minutes for easier comparison
      const timeToMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(':').map(Number)
        return hours * 60 + minutes
      }
      
      const jobStartMinutes = timeToMinutes(jobStart)
      const jobEndMinutes = timeToMinutes(jobEnd)
      const newStartMinutes = timeToMinutes(newStart)
      const newEndMinutes = timeToMinutes(newEnd)
      
      // Check for any overlap
      const hasOverlap = (
        // New appointment starts during existing job
        (newStartMinutes >= jobStartMinutes && newStartMinutes < jobEndMinutes) ||
        // New appointment ends during existing job  
        (newEndMinutes > jobStartMinutes && newEndMinutes <= jobEndMinutes) ||
        // New appointment completely contains existing job
        (newStartMinutes <= jobStartMinutes && newEndMinutes >= jobEndMinutes) ||
        // Existing job completely contains new appointment
        (jobStartMinutes <= newStartMinutes && jobEndMinutes >= newEndMinutes)
      )
      
      if (hasOverlap) {
        console.log(`CONFLICT DETECTED: Job ${job.jobNumber} overlaps with new time range`)
        console.log(`  Job: ${jobStartMinutes}-${jobEndMinutes} minutes`)
        console.log(`  New: ${newStartMinutes}-${newEndMinutes} minutes`)
      }
      
      return hasOverlap
    })
    
    return res.json({ 
      hasConflicts: conflictingJobs.length > 0,
      conflictingJobs: conflictingJobs.map(job => ({
        _id: job._id,
        jobNumber: job.jobNumber,
        plateNumber: job.plateNumber,
        timeRange: job.timeRange,
        status: job.status,
        sourceType: job.sourceType,
        carriedOver: job.carriedOver,
        assignedTechnician: job.assignedTechnician,
        serviceAdvisor: job.serviceAdvisor
      }))
    })
  } catch (error) {
    console.error('Error checking appointment conflicts:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Resolve conflicts by marking conflicting jobs as "Unassigned"
const resolveConflictsSchema = z.object({
  conflictingJobIds: z.array(z.string())
})

router.post('/:id/resolve-conflicts', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const parsed = resolveConflictsSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues })
    }
    
    const { conflictingJobIds } = parsed.data
    
    console.log('Resolving conflicts for job IDs:', conflictingJobIds)
    
    // Update conflicting jobs to "Unassigned" status and remove technician assignment
    const updatePromises = conflictingJobIds.map(async (jobId) => {
      console.log(`Updating job ${jobId} to Unassigned status`)
      
      // First, let's check if the job exists
      const existingJob = await JobOrder.findById(jobId)
      if (!existingJob) {
        console.log(`Job ${jobId} not found`)
        return null
      }
      
      console.log(`Job ${jobId} current status: ${existingJob.status}`)
      
      const updatedJob = await JobOrder.findByIdAndUpdate(
        jobId,
        { 
          status: 'UA',
          assignedTechnician: null,
          timeRange: { start: '00:00', end: '00:00' }
        },
        { new: true }
      )
      
      if (updatedJob) {
        console.log(`Job ${jobId} updated successfully:`, {
          jobNumber: updatedJob.jobNumber,
          status: updatedJob.status,
          assignedTechnician: updatedJob.assignedTechnician,
          timeRange: updatedJob.timeRange
        })
      } else {
        console.log(`Job ${jobId} update FAILED`)
      }
      
      return updatedJob
    })
    
    const updatedJobs = await Promise.all(updatePromises)
    const successfulUpdates = updatedJobs.filter(job => job !== null)
    
    console.log(`Successfully updated ${successfulUpdates.length} out of ${conflictingJobIds.length} jobs`)
    
    return res.json({ 
      message: 'Conflicts resolved successfully',
      updatedJobs: successfulUpdates.map(job => ({
        _id: job._id,
        jobNumber: job.jobNumber,
        status: job.status
      }))
    })
  } catch (error) {
    console.error('Error resolving appointment conflicts:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Convert appointment to job order
const createJobOrderFromAppointmentSchema = z.object({
  jobNumber: z.string().min(1),
  vin: z.string().min(1).max(14),
  assignedTechnician: z.string().min(1),
  serviceAdvisor: z.string().min(1),
  jobList: z.array(z.object({
    description: z.string().min(1),
    status: z.enum(['Finished', 'Unfinished'])
  })),
  parts: z.array(z.object({
    name: z.string().min(1),
    availability: z.enum(['Available', 'Unavailable'])
  })).optional(),
  timeRange: z.object({
    start: z.string(),
    end: z.string()
  }).optional(),
  actualEndTime: z.string().optional()
})

router.post('/:id/create-job-order', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const parsed = createJobOrderFromAppointmentSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues })
    }
    
    const appointment = await Appointment.findById(req.params.id)
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' })
    }
    
    // Create job order
    
    const { jobNumber, vin, assignedTechnician, serviceAdvisor, jobList, parts, timeRange, actualEndTime } = parsed.data
    
    // Check if job number already exists
    const existingJob = await JobOrder.findOne({ jobNumber: jobNumber.toUpperCase() })
    if (existingJob) {
      return res.status(409).json({ error: 'Job number already exists' })
    }
    
    // Get user ID from JWT token
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }
    
    // Determine initial status based on parts availability
    const hasUnavailableParts = parts && parts.length > 0 ? parts.some(part => part.availability === 'Unavailable') : false
    const allPartsUnavailable = parts && parts.length > 0 ? parts.every(part => part.availability === 'Unavailable') : false
    const initialStatus = hasUnavailableParts ? 'WP' : 'OG'
    
    // Use provided timeRange or fall back to appointment timeRange
    const finalTimeRange = timeRange || appointment.timeRange
    
    // Check daily hour limit (7.5 hours) for the technician
    const existingJobs = await JobOrder.find({
      assignedTechnician,
      date: {
        $gte: new Date(appointment.date.toISOString().split('T')[0]),
        $lt: new Date(new Date(appointment.date).setDate(appointment.date.getDate() + 1))
      }
    })
    
    // Calculate total hours for the day
    let totalHours = 0
    for (const job of existingJobs) {
      const start = new Date(`${appointment.date.toISOString().split('T')[0]}T${job.timeRange.start}:00`)
      const end = new Date(`${appointment.date.toISOString().split('T')[0]}T${job.timeRange.end}:00`)
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      totalHours += hours
    }
    
    // Add the new job hours
    const newJobStart = new Date(`${appointment.date.toISOString().split('T')[0]}T${finalTimeRange.start}:00`)
    const newJobEnd = new Date(`${appointment.date.toISOString().split('T')[0]}T${finalTimeRange.end}:00`)
    const newJobHours = (newJobEnd.getTime() - newJobStart.getTime()) / (1000 * 60 * 60)
    const totalWithNewJob = totalHours + newJobHours
    
    if (totalWithNewJob > 7.5) {
      return res.status(409).json({ 
        error: `Technician daily limit exceeded. Current: ${totalHours.toFixed(1)}h, New job: ${newJobHours.toFixed(1)}h, Total: ${totalWithNewJob.toFixed(1)}h (Limit: 7.5h)` 
      })
    }
    
    console.log('Creating job order with time range:', finalTimeRange)
    console.log('Original appointment time range:', appointment.timeRange)
    console.log('Provided time range:', timeRange)
    
    // Create job order from appointment
    const jobOrder = await JobOrder.create({
      jobNumber: jobNumber.toUpperCase(),
      createdBy: userId,
      assignedTechnician: allPartsUnavailable ? null : assignedTechnician,
      serviceAdvisor: serviceAdvisor,
      plateNumber: appointment.plateNumber,
      vin: vin.toUpperCase(),
      timeRange: finalTimeRange,
      actualEndTime: actualEndTime || undefined,
      jobList,
      parts: parts || [],
      status: initialStatus,
      date: appointment.date,
      originalCreatedDate: new Date(),
      sourceType: 'appointment'
    })
    
    console.log('Created job order:', jobOrder.jobNumber, 'with time range:', jobOrder.timeRange)
    
    // Delete the appointment
    await Appointment.findByIdAndDelete(req.params.id)
    
    const populatedJobOrder = await JobOrder.findById(jobOrder._id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .populate('serviceAdvisor', 'name email')
      .lean()
    
    return res.status(201).json({ jobOrder: populatedJobOrder })
  } catch (error) {
    console.error('Error creating job order from appointment:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete all no-show appointments
router.delete('/delete-all-no-show', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const result = await Appointment.deleteMany({ noShow: true })
    
    return res.json({ 
      message: `Deleted ${result.deletedCount} no-show appointments successfully`,
      deletedCount: result.deletedCount
    })
  } catch (error) {
    console.error('Error deleting all no-show appointments:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete appointment (no show)
router.delete('/:id', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const appointment = await Appointment.findByIdAndDelete(req.params.id)
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' })
    }
    
    return res.json({ message: 'Appointment deleted successfully' })
  } catch (error) {
    console.error('Error deleting appointment:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router

