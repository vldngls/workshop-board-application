import { Router } from 'express'
import { z } from 'zod'
import { connectToMongo } from '../config/mongo.js'
import { Appointment } from '../models/Appointment.js'
import { User } from '../models/User.js'
import { verifyToken, requireRole } from '../middleware/auth.js'

const router = Router()

// Get all appointments with optional filtering
router.get('/', verifyToken, async (req, res) => {
  try {
    await connectToMongo()
    
    const { date, technician } = req.query
    
    const filter: any = {}
    if (technician) filter.assignedTechnician = technician
    if (date) {
      const startDate = new Date(date as string)
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 1)
      filter.date = { $gte: startDate, $lt: endDate }
    }
    
    const appointments = await Appointment.find(filter)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email level')
      .sort({ date: 1, 'timeRange.start': 1 })
      .lean()
    
    res.json({ appointments })
  } catch (error) {
    console.error('Error fetching appointments:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get appointment by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    await connectToMongo()
    
    const appointment = await Appointment.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email level')
      .lean()
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' })
    }
    
    res.json({ appointment })
  } catch (error) {
    console.error('Error fetching appointment:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create new appointment
const createAppointmentSchema = z.object({
  assignedTechnician: z.string().min(1),
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
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.errors })
    }
    
    const { assignedTechnician, plateNumber, timeRange, date } = parsed.data
    
    // Verify technician exists and has technician role
    const technician = await User.findById(assignedTechnician)
    if (!technician || technician.role !== 'technician') {
      return res.status(400).json({ error: 'Invalid technician assigned' })
    }
    
    // Get user ID from JWT token
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' })
    }
    
    const appointmentDate = date ? new Date(date) : new Date()
    
    // Check for overlapping appointments
    const overlappingAppointment = await Appointment.findOne({
      assignedTechnician,
      date: {
        $gte: new Date(appointmentDate.toISOString().split('T')[0]),
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
    
    // Import JobOrder model to check for job order conflicts
    const { JobOrder } = await import('../models/JobOrder.js')
    
    // Check for overlapping job orders
    const overlappingJobOrder = await JobOrder.findOne({
      assignedTechnician,
      date: {
        $gte: new Date(appointmentDate.toISOString().split('T')[0]),
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
      plateNumber: plateNumber.toUpperCase(),
      timeRange,
      date: appointmentDate,
      createdBy: userId
    })
    
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email level')
      .lean()
    
    res.status(201).json({ appointment: populatedAppointment })
  } catch (error) {
    console.error('Error creating appointment:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update appointment
const updateAppointmentSchema = z.object({
  assignedTechnician: z.string().optional(),
  plateNumber: z.string().optional(),
  timeRange: z.object({
    start: z.string(),
    end: z.string()
  }).optional(),
  date: z.string().optional()
})

router.put('/:id', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const parsed = updateAppointmentSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.errors })
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
      
      // Import JobOrder model to check for job order conflicts
      const { JobOrder } = await import('../models/JobOrder.js')
      
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
      .lean()
    
    res.json({ appointment: updatedAppointment })
  } catch (error) {
    console.error('Error updating appointment:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Convert appointment to job order
const createJobOrderFromAppointmentSchema = z.object({
  jobNumber: z.string().min(1),
  vin: z.string().min(1),
  jobList: z.array(z.object({
    description: z.string().min(1),
    status: z.enum(['Finished', 'Unfinished'])
  })),
  parts: z.array(z.object({
    name: z.string().min(1),
    availability: z.enum(['Available', 'Unavailable'])
  }))
})

router.post('/:id/create-job-order', verifyToken, requireRole(['administrator', 'job-controller']), async (req, res) => {
  try {
    await connectToMongo()
    
    const parsed = createJobOrderFromAppointmentSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.errors })
    }
    
    const appointment = await Appointment.findById(req.params.id)
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' })
    }
    
    // Import JobOrder model
    const { JobOrder } = await import('../models/JobOrder.js')
    
    const { jobNumber, vin, jobList, parts } = parsed.data
    
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
    const hasUnavailableParts = parts.some(part => part.availability === 'Unavailable')
    const allPartsUnavailable = parts.every(part => part.availability === 'Unavailable')
    const initialStatus = hasUnavailableParts ? 'WP' : 'OG'
    
    // Create job order from appointment
    const jobOrder = await JobOrder.create({
      jobNumber: jobNumber.toUpperCase(),
      createdBy: userId,
      assignedTechnician: allPartsUnavailable ? null : appointment.assignedTechnician,
      plateNumber: appointment.plateNumber,
      vin: vin.toUpperCase(),
      timeRange: appointment.timeRange,
      jobList,
      parts,
      status: initialStatus,
      date: appointment.date
    })
    
    // Delete the appointment
    await Appointment.findByIdAndDelete(req.params.id)
    
    const populatedJobOrder = await JobOrder.findById(jobOrder._id)
      .populate('createdBy', 'name email')
      .populate('assignedTechnician', 'name email')
      .lean()
    
    res.status(201).json({ jobOrder: populatedJobOrder })
  } catch (error) {
    console.error('Error creating job order from appointment:', error)
    res.status(500).json({ error: 'Internal server error' })
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
    
    res.json({ message: 'Appointment deleted successfully' })
  } catch (error) {
    console.error('Error deleting appointment:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

