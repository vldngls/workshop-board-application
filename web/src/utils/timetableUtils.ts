import type { JobOrder, User } from '@/types/jobOrder'
import type { Appointment } from '@/types/appointment'

export interface TimeSlot {
  time: string
  hour: number
  minute: number
}

export interface JobOrderWithDetails extends JobOrder {
  assignedTechnician: User
  createdBy: User
}

export type Technician = User

// Generate time slots every 30 minutes from 7:00 AM to 6:00 PM
export const generateTimeSlots = (): TimeSlot[] => {
  const slots: TimeSlot[] = []
  for (let hour = 7; hour <= 17; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      slots.push({ time: timeStr, hour, minute })
    }
  }
  // Add 6:00 PM slot
  slots.push({ time: '18:00', hour: 18, minute: 0 })
  return slots
}

export const TIME_SLOTS = generateTimeSlots()

export const STATUS_COLORS = {
  'OG': 'bg-blue-500/30 border-blue-400/50 text-blue-900',      // On going
  'WP': 'bg-orange-500/30 border-orange-400/50 text-orange-900', // Waiting Parts
  'UA': 'bg-cyan-500/30 border-cyan-400/50 text-cyan-900',      // Unassigned
  'QI': 'bg-purple-500/30 border-purple-400/50 text-purple-900', // Quality Inspection
  'HC': 'bg-yellow-500/30 border-yellow-400/50 text-yellow-900', // Hold Customer
  'HW': 'bg-red-500/30 border-red-400/50 text-red-900',         // Hold Warranty
  'HI': 'bg-indigo-500/30 border-indigo-400/50 text-indigo-900', // Hold Insurance
  'HF': 'bg-pink-500/30 border-pink-400/50 text-pink-900',      // Hold Ford
  'SU': 'bg-violet-500/30 border-violet-400/50 text-violet-900', // Sublet
  'FR': 'bg-green-500/30 border-green-400/50 text-green-900',   // For Release
  'FU': 'bg-gray-500/30 border-gray-400/50 text-gray-900',      // Finished Unclaimed
  'CP': 'bg-emerald-500/30 border-emerald-400/50 text-emerald-900' // Complete
}

export const parseTime = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

export const formatTime = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${displayHour}:${minutes} ${ampm}`
}

export const getJobAtTime = (
  technicianId: string, 
  timeSlot: TimeSlot, 
  jobOrders: JobOrderWithDetails[]
): JobOrderWithDetails | null => {
  return jobOrders.find(job => {
    // Don't show jobs without assigned technician
    if (!job.assignedTechnician || job.assignedTechnician._id !== technicianId) return false
    
    const jobStart = parseTime(job.timeRange.start)
    const jobEnd = parseTime(job.timeRange.end)
    const slotTime = timeSlot.hour * 60 + timeSlot.minute
    
    // Show job if the slot time is within the job's time range
    return slotTime >= jobStart && slotTime < jobEnd
  }) || null
}

export const getAppointmentAtTime = (
  technicianId: string, 
  timeSlot: TimeSlot, 
  appointments: Appointment[]
): Appointment | null => {
  return appointments.find(appt => {
    if (!appt.assignedTechnician || appt.assignedTechnician._id !== technicianId) return false
    
    const apptStart = parseTime(appt.timeRange.start)
    const apptEnd = parseTime(appt.timeRange.end)
    const slotTime = timeSlot.hour * 60 + timeSlot.minute
    
    return slotTime >= apptStart && slotTime < apptEnd
  }) || null
}

export const getJobStartSlot = (job: JobOrderWithDetails): number => {
  const jobStart = parseTime(job.timeRange.start)
  return TIME_SLOTS.findIndex(slot => {
    const slotTime = slot.hour * 60 + slot.minute
    return slotTime === jobStart
  })
}

export const getJobEndSlot = (job: JobOrderWithDetails): number => {
  const jobEnd = parseTime(job.timeRange.end)
  return TIME_SLOTS.findIndex(slot => {
    const slotTime = slot.hour * 60 + slot.minute
    return slotTime === jobEnd
  })
}

export const getJobSpan = (job: JobOrderWithDetails): number => {
  if (!job.assignedTechnician) return 0
  const startSlot = getJobStartSlot(job)
  const endSlot = getJobEndSlot(job)
  return endSlot - startSlot
}

export const getJobOffset = (job: JobOrderWithDetails): number => {
  if (!job.assignedTechnician) return 0
  const jobStart = parseTime(job.timeRange.start)
  const startSlot = getJobStartSlot(job)
  
  if (startSlot === -1) return 0
  
  const slotStartTime = TIME_SLOTS[startSlot].hour * 60 + TIME_SLOTS[startSlot].minute
  const offsetMinutes = jobStart - slotStartTime
  const offsetPercentage = (offsetMinutes / 30) * 100 // 30 minutes per slot
  
  return Math.max(0, offsetPercentage)
}

export const getAppointmentStartSlot = (appointment: Appointment): number => {
  const apptStart = parseTime(appointment.timeRange.start)
  return TIME_SLOTS.findIndex(slot => {
    const slotTime = slot.hour * 60 + slot.minute
    return slotTime === apptStart
  })
}

export const getAppointmentSpan = (appointment: Appointment): number => {
  const start = parseTime(appointment.timeRange.start)
  const end = parseTime(appointment.timeRange.end)
  const duration = end - start
  return Math.ceil(duration / 30) // Number of 30-min slots
}

export const getJobProgress = (job: JobOrderWithDetails): number => {
  const finishedTasks = job.jobList.filter(task => task.status === 'Finished').length
  return job.jobList.length > 0 ? (finishedTasks / job.jobList.length) * 100 : 0
}

export const calculateWorkDuration = (startTime: string, endTime: string, breakStart: string = '12:00', breakEnd: string = '13:00'): string => {
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)
  const [breakStartHour, breakStartMinute] = breakStart.split(':').map(Number)
  const [breakEndHour, breakEndMinute] = breakEnd.split(':').map(Number)
  
  const startMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute
  const breakStartMinutes = breakStartHour * 60 + breakStartMinute
  const breakEndMinutes = breakEndHour * 60 + breakEndMinute
  
  // Calculate total duration in minutes
  let totalMinutes = endMinutes - startMinutes
  
  // Subtract break time if work period overlaps with break
  if (startMinutes < breakEndMinutes && endMinutes > breakStartMinutes) {
    const breakOverlapStart = Math.max(startMinutes, breakStartMinutes)
    const breakOverlapEnd = Math.min(endMinutes, breakEndMinutes)
    const breakOverlapMinutes = breakOverlapEnd - breakOverlapStart
    totalMinutes -= breakOverlapMinutes
  }
  
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`
  } else if (hours > 0) {
    return `${hours}h`
  } else {
    return `${minutes}m`
  }
}

export const isBreakTimeSlot = (slotTime: string, breakStart: string = '12:00', breakEnd: string = '13:00'): boolean => {
  const [slotHour, slotMinute] = slotTime.split(':').map(Number)
  const [breakStartHour, breakStartMinute] = breakStart.split(':').map(Number)
  const [breakEndHour, breakEndMinute] = breakEnd.split(':').map(Number)
  
  const slotMinutes = slotHour * 60 + slotMinute
  const breakStartMinutes = breakStartHour * 60 + breakStartMinute
  const breakEndMinutes = breakEndHour * 60 + breakEndMinute
  
  // Slot is during break if it's >= break start and < break end
  return slotMinutes >= breakStartMinutes && slotMinutes < breakEndMinutes
}

export const hasBreakSlot = (job: JobOrderWithDetails, slotTime: string, breakStart: string = '12:00', breakEnd: string = '13:00'): boolean => {
  const [jobStartHour, jobStartMinute] = job.timeRange.start.split(':').map(Number)
  const [jobEndHour, jobEndMinute] = job.timeRange.end.split(':').map(Number)
  const [slotHour, slotMinute] = slotTime.split(':').map(Number)
  
  const jobStartMinutes = jobStartHour * 60 + jobStartMinute
  const jobEndMinutes = jobEndHour * 60 + jobEndMinute
  const slotMinutes = slotHour * 60 + slotMinute
  
  // Check if this slot is within the job AND during break time
  return slotMinutes >= jobStartMinutes && slotMinutes < jobEndMinutes && isBreakTimeSlot(slotTime, breakStart, breakEnd)
}
