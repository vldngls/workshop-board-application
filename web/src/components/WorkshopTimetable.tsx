"use client"

import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import type { JobOrder } from '@/types/jobOrder'
import type { Appointment } from '@/types/appointment'
import ReassignTimeSlotModal from './ReassignTimeSlotModal'
import ReplotJobOrderModal from './ReplotJobOrderModal'
import CreateJobOrderFromAppointmentModal from './CreateJobOrderFromAppointmentModal'
import ConfirmDialog from './ConfirmDialog'

interface WorkshopTimetableProps {
  date: Date
  onDateChange: (date: Date) => void
  highlightJobId?: string
}

interface TimeSlot {
  time: string
  hour: number
  minute: number
}

interface Technician {
  _id: string
  name: string
  email: string
}

interface JobOrderWithDetails extends JobOrder {
  assignedTechnician: Technician
  createdBy: Technician
}

// Generate time slots every 30 minutes from 7:00 AM to 6:00 PM
const generateTimeSlots = (): TimeSlot[] => {
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

const TIME_SLOTS = generateTimeSlots() // 30-minute intervals from 7:00 AM to 6:00 PM

const STATUS_COLORS = {
  'OG': 'bg-blue-500/30 border-blue-400/50 text-blue-900',      // On going
  'WP': 'bg-orange-500/30 border-orange-400/50 text-orange-900', // Waiting Parts
  'FP': 'bg-cyan-500/30 border-cyan-400/50 text-cyan-900',      // For Plotting
  'QI': 'bg-purple-500/30 border-purple-400/50 text-purple-900', // Quality Inspection
  'HC': 'bg-yellow-500/30 border-yellow-400/50 text-yellow-900', // Hold Customer
  'HW': 'bg-red-500/30 border-red-400/50 text-red-900',         // Hold Warranty
  'HI': 'bg-indigo-500/30 border-indigo-400/50 text-indigo-900', // Hold Insurance
  'FR': 'bg-green-500/30 border-green-400/50 text-green-900',   // For Release
  'FU': 'bg-gray-500/30 border-gray-400/50 text-gray-900',      // Finished Unclaimed
  'CP': 'bg-emerald-500/30 border-emerald-400/50 text-emerald-900' // Complete
}

function WorkshopTimetable({ date, onDateChange, highlightJobId }: WorkshopTimetableProps) {
  const [jobOrders, setJobOrders] = useState<JobOrderWithDetails[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<JobOrderWithDetails | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showTechnicianModal, setShowTechnicianModal] = useState(false)
  const [availableTechnicians, setAvailableTechnicians] = useState<any[]>([])
  const [qiJobs, setQiJobs] = useState<JobOrderWithDetails[]>([])
  const [forReleaseJobs, setForReleaseJobs] = useState<JobOrderWithDetails[]>([])
  const [waitingPartsJobs, setWaitingPartsJobs] = useState<JobOrderWithDetails[]>([])
  const [forPlottingJobs, setForPlottingJobs] = useState<JobOrderWithDetails[]>([])
  const [carriedOverJobs, setCarriedOverJobs] = useState<JobOrderWithDetails[]>([])
  const [holdCustomerJobs, setHoldCustomerJobs] = useState<JobOrderWithDetails[]>([])
  const [holdWarrantyJobs, setHoldWarrantyJobs] = useState<JobOrderWithDetails[]>([])
  const [holdInsuranceJobs, setHoldInsuranceJobs] = useState<JobOrderWithDetails[]>([])
  const [finishedUnclaimedJobs, setFinishedUnclaimedJobs] = useState<JobOrderWithDetails[]>([])
  const [updating, setUpdating] = useState(false)
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null)
  
  // Appointments state
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [showCreateJobOrderModal, setShowCreateJobOrderModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null)
  
  // Reassignment modal state
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [reassignmentSlot, setReassignmentSlot] = useState<{
    technicianId: string
    technicianName: string
    startTime: string
    endTime: string
  } | null>(null)
  
  // Replot modal state
  const [showReplotModal, setShowReplotModal] = useState(false)
  
  // Break time settings
  const [breakStart, setBreakStart] = useState('12:00')
  const [breakEnd, setBreakEnd] = useState('13:00')

  // Load break settings from localStorage
  useEffect(() => {
    const savedBreakStart = localStorage.getItem('breakStart')
    const savedBreakEnd = localStorage.getItem('breakEnd')
    if (savedBreakStart) setBreakStart(savedBreakStart)
    if (savedBreakEnd) setBreakEnd(savedBreakEnd)
  }, [])

  // Check if a specific time slot is during break time
  const isBreakTimeSlot = useCallback((slotTime: string): boolean => {
    const [slotHour, slotMinute] = slotTime.split(':').map(Number)
    const [breakStartHour, breakStartMinute] = breakStart.split(':').map(Number)
    const [breakEndHour, breakEndMinute] = breakEnd.split(':').map(Number)
    
    const slotMinutes = slotHour * 60 + slotMinute
    const breakStartMinutes = breakStartHour * 60 + breakStartMinute
    const breakEndMinutes = breakEndHour * 60 + breakEndMinute
    
    // Slot is during break if it's >= break start and < break end
    return slotMinutes >= breakStartMinutes && slotMinutes < breakEndMinutes
  }, [breakStart, breakEnd])

  // Check if a job has a slot during break time
  const hasBreakSlot = useCallback((job: JobOrderWithDetails, slotTime: string): boolean => {
    const [jobStartHour, jobStartMinute] = job.timeRange.start.split(':').map(Number)
    const [jobEndHour, jobEndMinute] = job.timeRange.end.split(':').map(Number)
    const [slotHour, slotMinute] = slotTime.split(':').map(Number)
    
    const jobStartMinutes = jobStartHour * 60 + jobStartMinute
    const jobEndMinutes = jobEndHour * 60 + jobEndMinute
    const slotMinutes = slotHour * 60 + slotMinute
    
    // Check if this slot is within the job AND during break time
    return slotMinutes >= jobStartMinutes && slotMinutes < jobEndMinutes && isBreakTimeSlot(slotTime)
  }, [isBreakTimeSlot])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Fetch job orders for the selected date
      const dateStr = date.toISOString().split('T')[0]
      const jobOrdersResponse = await fetch(`/api/job-orders?date=${dateStr}`)
      if (!jobOrdersResponse.ok) throw new Error('Failed to fetch job orders')
      const jobOrdersData = await jobOrdersResponse.json()
      
      // Fetch technicians
      const techniciansResponse = await fetch('/api/users')
      if (!techniciansResponse.ok) throw new Error('Failed to fetch technicians')
      const techniciansData = await techniciansResponse.json()
      
      // Fetch QI jobs (status = QI and qiStatus = pending)
      const qiResponse = await fetch('/api/job-orders?status=QI')
      if (!qiResponse.ok) throw new Error('Failed to fetch QI jobs')
      const qiData = await qiResponse.json()
      const pendingQI = (qiData.jobOrders || []).filter((job: JobOrderWithDetails) => job.qiStatus === 'pending')
      
      // Fetch For Release jobs
      const frResponse = await fetch('/api/job-orders?status=FR')
      if (!frResponse.ok) throw new Error('Failed to fetch For Release jobs')
      const frData = await frResponse.json()
      const forRelease = frData.jobOrders || []
      
      // Fetch Waiting Parts jobs
      const wpResponse = await fetch('/api/job-orders?status=WP')
      if (!wpResponse.ok) throw new Error('Failed to fetch Waiting Parts jobs')
      const wpData = await wpResponse.json()
      const waitingParts = wpData.jobOrders || []
      
      // Fetch For Plotting jobs
      const fpResponse = await fetch('/api/job-orders?status=FP')
      if (!fpResponse.ok) throw new Error('Failed to fetch For Plotting jobs')
      const fpData = await fpResponse.json()
      const forPlotting = fpData.jobOrders || []
      
      // Fetch Hold Customer jobs
      const hcResponse = await fetch('/api/job-orders?status=HC')
      if (!hcResponse.ok) throw new Error('Failed to fetch Hold Customer jobs')
      const hcData = await hcResponse.json()
      const holdCustomer = hcData.jobOrders || []
      
      // Fetch Hold Warranty jobs
      const hwResponse = await fetch('/api/job-orders?status=HW')
      if (!hwResponse.ok) throw new Error('Failed to fetch Hold Warranty jobs')
      const hwData = await hwResponse.json()
      const holdWarranty = hwData.jobOrders || []
      
      // Fetch Hold Insurance jobs
      const hiResponse = await fetch('/api/job-orders?status=HI')
      if (!hiResponse.ok) throw new Error('Failed to fetch Hold Insurance jobs')
      const hiData = await hiResponse.json()
      const holdInsurance = hiData.jobOrders || []
      
      // Fetch Finished Unclaimed jobs
      const fuResponse = await fetch('/api/job-orders?status=FU')
      if (!fuResponse.ok) throw new Error('Failed to fetch Finished Unclaimed jobs')
      const fuData = await fuResponse.json()
      const finishedUnclaimed = fuData.jobOrders || []
      
      // Fetch all job orders to find carried over ones
      const allJobsResponse = await fetch('/api/job-orders')
      if (!allJobsResponse.ok) throw new Error('Failed to fetch all job orders')
      const allJobsData = await allJobsResponse.json()
      const carriedOver = (allJobsData.jobOrders || []).filter((job: JobOrderWithDetails) => job.carriedOver === true)
      
      // Filter job orders to exclude statuses that should only appear in sections below
      // Only show OG (On Going), QI (Quality Inspection), FR (For Release), and CP (Complete) on the timetable
      const timetableJobs = (jobOrdersData.jobOrders || []).filter((job: JobOrderWithDetails) => 
        !['WP', 'HC', 'HW', 'HI', 'FU'].includes(job.status)
      )
      
      // Sort job orders - important ones first, then carried over, then by date
      const sortedJobs = timetableJobs.sort((a: JobOrderWithDetails, b: JobOrderWithDetails) => {
        if (a.isImportant && !b.isImportant) return -1
        if (!a.isImportant && b.isImportant) return 1
        if (a.carriedOver && !b.carriedOver) return -1
        if (!a.carriedOver && b.carriedOver) return 1
        return 0
      })
      
      setJobOrders(sortedJobs)
      setTechnicians(techniciansData.users?.filter((user: any) => user.role === 'technician') || [])
      setQiJobs(pendingQI)
      setForReleaseJobs(forRelease)
      setWaitingPartsJobs(waitingParts)
      setForPlottingJobs(forPlotting)
      setHoldCustomerJobs(holdCustomer)
      setHoldWarrantyJobs(holdWarranty)
      setHoldInsuranceJobs(holdInsurance)
      setFinishedUnclaimedJobs(finishedUnclaimed)
      setCarriedOverJobs(carriedOver)
      
      // Fetch appointments for the selected date
      try {
        const appointmentsResponse = await fetch(`/api/appointments?date=${dateStr}`)
        if (appointmentsResponse.ok) {
          const appointmentsData = await appointmentsResponse.json()
          setAppointments(appointmentsData.appointments || [])
        }
      } catch (error) {
        console.error('Error fetching appointments:', error)
        // Don't fail the whole fetch if appointments fail
        setAppointments([])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Handle highlighting a specific job
  useEffect(() => {
    if (highlightJobId) {
      setHighlightedJobId(highlightJobId)
      
      // Scroll to the job after a short delay to ensure DOM is ready
      setTimeout(() => {
        const jobElement = document.querySelector(`[data-job-id="${highlightJobId}"]`)
        if (jobElement) {
          jobElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 500)
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        setHighlightedJobId(null)
      }, 3500)
    }
  }, [highlightJobId])

  // Memoize expensive calculations
  const getJobAtTime = useCallback((technicianId: string, timeSlot: TimeSlot): JobOrderWithDetails | null => {
    const parseTimeLocal = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number)
      return hours * 60 + minutes
    }
    return jobOrders.find(job => {
      // Don't show jobs without assigned technician (e.g., all parts missing)
      if (!job.assignedTechnician || job.assignedTechnician._id !== technicianId) return false
      
      const jobStart = parseTimeLocal(job.timeRange.start)
      const jobEnd = parseTimeLocal(job.timeRange.end)
      const slotTime = timeSlot.hour * 60 + timeSlot.minute
      
      // Show job if the slot time is within the job's time range
      return slotTime >= jobStart && slotTime < jobEnd
    }) || null
  }, [jobOrders])

  const getAppointmentAtTime = useCallback((technicianId: string, timeSlot: TimeSlot): Appointment | null => {
    const parseTimeLocal = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number)
      return hours * 60 + minutes
    }
    return appointments.find(appt => {
      if (!appt.assignedTechnician || appt.assignedTechnician._id !== technicianId) return false
      
      const apptStart = parseTimeLocal(appt.timeRange.start)
      const apptEnd = parseTimeLocal(appt.timeRange.end)
      const slotTime = timeSlot.hour * 60 + timeSlot.minute
      
      return slotTime >= apptStart && slotTime < apptEnd
    }) || null
  }, [appointments])

  const getAppointmentStartSlot = useCallback((appointment: Appointment): number => {
    const apptStart = parseTime(appointment.timeRange.start)
    return TIME_SLOTS.findIndex(slot => {
      const slotTime = slot.hour * 60 + slot.minute
      return slotTime === apptStart
    })
  }, [])

  const getAppointmentSpan = useCallback((appointment: Appointment): number => {
    const parseTimeLocal = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number)
      return hours * 60 + minutes
    }
    const start = parseTimeLocal(appointment.timeRange.start)
    const end = parseTimeLocal(appointment.timeRange.end)
    const duration = end - start
    return Math.ceil(duration / 30) // Number of 30-min slots
  }, [])

  const getJobStartSlot = useCallback((technicianId: string, job: JobOrderWithDetails): number => {
    const jobStart = parseTime(job.timeRange.start)
    return TIME_SLOTS.findIndex(slot => {
      const slotTime = slot.hour * 60 + slot.minute
      return slotTime === jobStart
    })
  }, [])

  const getJobEndSlot = useCallback((technicianId: string, job: JobOrderWithDetails): number => {
    const parseTimeLocal = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number)
      return hours * 60 + minutes
    }
    const jobEnd = parseTimeLocal(job.timeRange.end)
    return TIME_SLOTS.findIndex(slot => {
      const slotTime = slot.hour * 60 + slot.minute
      return slotTime === jobEnd
    })
  }, [])

  const getJobSpan = useCallback((job: JobOrderWithDetails): number => {
    if (!job.assignedTechnician) return 0
    const startSlot = getJobStartSlot(job.assignedTechnician._id, job)
    const endSlot = getJobEndSlot(job.assignedTechnician._id, job)
    return endSlot - startSlot
  }, [getJobStartSlot, getJobEndSlot])

  const getJobOffset = useCallback((job: JobOrderWithDetails): number => {
    if (!job.assignedTechnician) return 0
    const jobStart = parseTime(job.timeRange.start)
    const startSlot = getJobStartSlot(job.assignedTechnician._id, job)
    
    if (startSlot === -1) return 0
    
    const slotStartTime = TIME_SLOTS[startSlot].hour * 60 + TIME_SLOTS[startSlot].minute
    const offsetMinutes = jobStart - slotStartTime
    const offsetPercentage = (offsetMinutes / 30) * 100 // 30 minutes per slot
    
    return Math.max(0, offsetPercentage)
  }, [getJobStartSlot])

  const parseTime = useCallback((timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + minutes
  }, [])

  const formatTime = useCallback((timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }, [])

  const calculateWorkDuration = useCallback((startTime: string, endTime: string): string => {
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
  }, [breakStart, breakEnd])

  const handleCellClick = useCallback((job: JobOrderWithDetails) => {
    setSelectedJob(job)
    setShowModal(true)
  }, [])

  const handleAppointmentClick = useCallback((appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setShowCreateJobOrderModal(true)
  }, [])

  const handleDeleteAppointment = useCallback((appointmentId: string) => {
    setAppointmentToDelete(appointmentId)
    setShowDeleteConfirm(true)
  }, [])

  const confirmDeleteAppointment = useCallback(async () => {
    if (!appointmentToDelete) return

    try {
      const response = await fetch(`/api/appointments/${appointmentToDelete}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to delete appointment')
      }

      setAppointments(prev => prev.filter(a => a._id !== appointmentToDelete))
      toast.success('Appointment deleted (no show)')
    } catch (error) {
      console.error('Error deleting appointment:', error)
      toast.error('Failed to delete appointment')
    } finally {
      setShowDeleteConfirm(false)
      setAppointmentToDelete(null)
    }
  }, [appointmentToDelete])

  const cancelDeleteAppointment = useCallback(() => {
    setShowDeleteConfirm(false)
    setAppointmentToDelete(null)
  }, [])

  const handleCreateJobOrderSuccess = useCallback(() => {
    setShowCreateJobOrderModal(false)
    setSelectedAppointment(null)
    fetchData()
    toast.success('Job order created from appointment!')
  }, [fetchData])

  const formatDuration = useCallback((startTime: string, endTime: string): string => {
    const startMs = new Date(`2000-01-01T${startTime}:00`).getTime()
    const endMs = new Date(`2000-01-01T${endTime}:00`).getTime()
    const diffMs = endMs - startMs
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${diffHours}h ${diffMinutes}m`
  }, [])

  // Memoize job positions to avoid recalculating on every render
  const jobPositions = useMemo(() => {
    const positions = new Map<string, any>()
    jobOrders.forEach(job => {
      // Skip jobs without assigned technician (e.g., FP status jobs)
      if (!job.assignedTechnician) return
      
      const key = `${job._id}-${job.assignedTechnician._id}`
      positions.set(key, {
        span: getJobSpan(job),
        offset: getJobOffset(job),
        startSlot: getJobStartSlot(job.assignedTechnician._id, job)
      })
    })
    return positions
  }, [jobOrders, getJobSpan, getJobOffset, getJobStartSlot])

  const getJobProgress = useCallback((job: JobOrderWithDetails): number => {
    const finishedTasks = job.jobList.filter(task => task.status === 'Finished').length
    return job.jobList.length > 0 ? (finishedTasks / job.jobList.length) * 100 : 0
  }, [])

  const navigateDate = useCallback((direction: 'prev' | 'next') => {
    const newDate = new Date(date)
    newDate.setDate(date.getDate() + (direction === 'next' ? 1 : -1))
    onDateChange(newDate)
  }, [date, onDateChange])

  const formatDate = useCallback((dateVal: Date): string => {
    return dateVal.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }, [])

  const toggleImportant = useCallback(async (jobId: string) => {
    try {
      setUpdating(true)
      
      // Optimistic update - update local state immediately
      const currentJob = jobOrders.find(job => job._id === jobId)
      if (!currentJob) return
      
      const newImportantStatus = !currentJob.isImportant
      setJobOrders(prev => prev.map(job => 
        job._id === jobId ? { ...job, isImportant: newImportantStatus } : job
      ))
      if (selectedJob?._id === jobId) {
        setSelectedJob(prev => prev ? { ...prev, isImportant: newImportantStatus } : null)
      }
      
      const response = await fetch(`/api/job-orders/${jobId}/toggle-important`, {
        method: 'PATCH'
      })
      if (!response.ok) throw new Error('Failed to toggle important status')
      
      toast.success(newImportantStatus ? 'Job marked as important' : 'Job unmarked as important')
    } catch (error) {
      console.error('Error toggling important:', error)
      toast.error('Failed to toggle important status')
      // Revert optimistic update on error
      fetchData()
    } finally {
      setUpdating(false)
    }
  }, [jobOrders, selectedJob, fetchData])

  const updateJobStatus = useCallback(async (jobId: string, status: string) => {
    try {
      setUpdating(true)
      
      const response = await fetch(`/api/job-orders/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update job status')
      }
      
      const data = await response.json()
      const updatedJob = data.jobOrder
      
      // Remove from timetable if status is WP, HC, HW, HI, or FU
      if (['WP', 'HC', 'HW', 'HI', 'FU'].includes(status)) {
        setJobOrders(prev => prev.filter(job => job._id !== jobId))
      } else {
        // Update in timetable for other statuses
        setJobOrders(prev => prev.map(job => 
          job._id === jobId ? updatedJob : job
        ))
      }
      
      // Update selected job if it's the one being updated
      if (selectedJob?._id === jobId) {
        setSelectedJob(updatedJob)
      }
      
      // Update all status lists
      setQiJobs(prev => {
        const filtered = prev.filter(job => job._id !== jobId)
        return status === 'QI' ? [...filtered, updatedJob] : filtered
      })
      
      setForReleaseJobs(prev => {
        const filtered = prev.filter(job => job._id !== jobId)
        return status === 'FR' ? [...filtered, updatedJob] : filtered
      })
      
      setWaitingPartsJobs(prev => {
        const filtered = prev.filter(job => job._id !== jobId)
        return status === 'WP' ? [...filtered, updatedJob] : filtered
      })
      
      setHoldCustomerJobs(prev => {
        const filtered = prev.filter(job => job._id !== jobId)
        return status === 'HC' ? [...filtered, updatedJob] : filtered
      })
      
      setHoldWarrantyJobs(prev => {
        const filtered = prev.filter(job => job._id !== jobId)
        return status === 'HW' ? [...filtered, updatedJob] : filtered
      })
      
      setHoldInsuranceJobs(prev => {
        const filtered = prev.filter(job => job._id !== jobId)
        return status === 'HI' ? [...filtered, updatedJob] : filtered
      })
      
      setFinishedUnclaimedJobs(prev => {
        const filtered = prev.filter(job => job._id !== jobId)
        return status === 'FU' ? [...filtered, updatedJob] : filtered
      })
      
      toast.success('Job status updated successfully')
    } catch (error) {
      console.error('Error updating job status:', error)
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Failed to update job status')
      }
      // Refresh data on error
      fetchData()
    } finally {
      setUpdating(false)
    }
  }, [selectedJob, fetchData])

  const updateTaskStatus = useCallback(async (jobId: string, taskIndex: number, status: 'Finished' | 'Unfinished') => {
    try {
      setUpdating(true)
      if (!selectedJob) return
      
      const updatedJobList = [...selectedJob.jobList]
      updatedJobList[taskIndex].status = status
      
      // Optimistic update - update local state immediately
      setJobOrders(prev => prev.map(job => 
        job._id === jobId ? { ...job, jobList: updatedJobList } : job
      ))
      setSelectedJob(prev => prev ? { ...prev, jobList: updatedJobList } : null)
      
      const response = await fetch(`/api/job-orders/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobList: updatedJobList })
      })
      if (!response.ok) throw new Error('Failed to update task status')
      
      toast.success(`Task marked as ${status.toLowerCase()}`)
    } catch (error) {
      console.error('Error updating task status:', error)
      toast.error('Failed to update task status')
      // Revert optimistic update on error
      fetchData()
    } finally {
      setUpdating(false)
    }
  }, [selectedJob, fetchData])

  const getCurrentTime = useCallback((): string => {
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }, [])

  const promptReassignment = useCallback((job: JobOrderWithDetails, actualEndTime: string) => {
    if (!job.assignedTechnician) return
    
    setReassignmentSlot({
      technicianId: job.assignedTechnician._id,
      technicianName: job.assignedTechnician.name,
      startTime: actualEndTime,
      endTime: job.timeRange.end
    })
    setShowReassignModal(true)
  }, [])

  const updatePartAvailability = useCallback(async (jobId: string, partIndex: number, availability: 'Available' | 'Unavailable') => {
    try {
      setUpdating(true)
      if (!selectedJob) return
      
      const updatedParts = [...selectedJob.parts]
      updatedParts[partIndex].availability = availability
      
      // If parts became unavailable and job is currently on going, set actual end time
      const hasUnavailableParts = updatedParts.some(part => part.availability === 'Unavailable')
      const wasOnGoing = selectedJob.status === 'OG'
      const currentTime = getCurrentTime()
      
      const response = await fetch(`/api/job-orders/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          parts: updatedParts,
          ...(hasUnavailableParts && wasOnGoing && availability === 'Unavailable' ? { actualEndTime: currentTime } : {})
        })
      })
      if (!response.ok) throw new Error('Failed to update part availability')
      const data = await response.json()
      const updatedJobOrder = data.jobOrder
      setSelectedJob(updatedJobOrder)
      setShowModal(false)
      await fetchData()
      toast.success(`Part marked as ${availability.toLowerCase()}`)
      
      // Check if all parts are now available and status changed to FP
      const allPartsAvailable = updatedParts.every(part => part.availability === 'Available')
      const wasWaitingParts = selectedJob.status === 'WP'
      const nowForPlotting = updatedJobOrder.status === 'FP'
      
      if (allPartsAvailable && wasWaitingParts && nowForPlotting) {
        toast.success('All parts are now available! Status changed to "For Plotting". Use the Replot button to assign a technician and time slot.', { duration: 7000 })
      }
      
      // If parts became unavailable, prompt for reassignment
      if (hasUnavailableParts && availability === 'Unavailable' && wasOnGoing) {
        toast.error('Part unavailable. Job interrupted at ' + currentTime, { duration: 4000 })
        // Prompt user to assign another job to the remaining time slot
        const timeRemaining = parseTime(selectedJob.timeRange.end) - parseTime(currentTime)
        if (timeRemaining > 30) { // Only prompt if more than 30 minutes remain
          setTimeout(() => {
            promptReassignment(selectedJob, currentTime)
          }, 1000)
        }
      }
    } catch (error) {
      console.error('Error updating part availability:', error)
      toast.error('Failed to update part availability')
    } finally {
      setUpdating(false)
    }
  }, [selectedJob, fetchData, getCurrentTime, promptReassignment, parseTime])

  const reassignTechnician = useCallback(async (technicianId: string) => {
    try {
      setUpdating(true)
      if (!selectedJob) return
      
      const response = await fetch(`/api/job-orders/${selectedJob._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTechnician: technicianId })
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reassign technician')
      }
      const data = await response.json()
      setSelectedJob(data.jobOrder)
      setShowTechnicianModal(false)
      await fetchData()
      toast.success('Technician reassigned successfully')
    } catch (error: any) {
      console.error('Error reassigning technician:', error)
      toast.error(error.message || 'Failed to reassign technician')
    } finally {
      setUpdating(false)
    }
  }, [selectedJob, fetchData])

  // Fetch available technicians when modal opens
  useEffect(() => {
    const fetchAvailableTechnicians = async () => {
      if (!showTechnicianModal || !selectedJob) return
      
      try {
        const response = await fetch(
          `/api/job-orders/technicians/available?date=${selectedJob.date.split('T')[0]}&startTime=${selectedJob.timeRange.start}&endTime=${selectedJob.timeRange.end}`,
          { credentials: 'include' }
        )
        if (!response.ok) throw new Error('Failed to fetch available technicians')
        const data = await response.json()
        setAvailableTechnicians(data.technicians || [])
      } catch (error) {
        console.error('Error fetching technicians:', error)
        toast.error('Failed to fetch available technicians')
      }
    }
    
    fetchAvailableTechnicians()
  }, [showTechnicianModal, selectedJob])

  const submitForQI = useCallback(async (jobId: string) => {
    try {
      setUpdating(true)
      if (!selectedJob) return
      
      const currentTime = getCurrentTime()
      const response = await fetch(`/api/job-orders/${jobId}/submit-qi`, {
        method: 'PATCH'
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit for QI')
      }
      
      // Check if there's remaining time in the time slot
      const timeRemaining = parseTime(selectedJob.timeRange.end) - parseTime(currentTime)
      
      setShowModal(false)
      await fetchData()
      toast.success('Job order submitted for Quality Inspection')
      
      // If there's more than 30 minutes remaining, prompt to assign another job
      if (timeRemaining > 30 && selectedJob.assignedTechnician) {
        setTimeout(() => {
          const shouldAssign = confirm(`This job finished early. There are ${Math.floor(timeRemaining / 60)}h ${timeRemaining % 60}m remaining. Would you like to assign another job to ${selectedJob.assignedTechnician.name}?`)
          if (shouldAssign) {
            promptReassignment(selectedJob, currentTime)
          }
        }, 1000)
      }
    } catch (error: any) {
      console.error('Error submitting for QI:', error)
      toast.error(error.message || 'Failed to submit for QI')
    } finally {
      setUpdating(false)
    }
  }, [fetchData, selectedJob, getCurrentTime, parseTime, promptReassignment])

  const approveQI = useCallback(async (jobId: string) => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/job-orders/${jobId}/approve-qi`, {
        method: 'PATCH'
      })
      if (!response.ok) throw new Error('Failed to approve QI')
      await fetchData()
      toast.success('Job order approved and marked for release')
    } catch (error) {
      console.error('Error approving QI:', error)
      toast.error('Failed to approve QI')
    } finally {
      setUpdating(false)
    }
  }, [fetchData])

  const rejectQI = useCallback(async (jobId: string) => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/job-orders/${jobId}/reject-qi`, {
        method: 'PATCH'
      })
      if (!response.ok) throw new Error('Failed to reject QI')
      await fetchData()
      toast.error('Job order rejected and marked for re-assessment')
    } catch (error) {
      console.error('Error rejecting QI:', error)
      toast.error('Failed to reject QI')
    } finally {
      setUpdating(false)
    }
  }, [fetchData])

  const completeJob = useCallback(async (jobId: string) => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/job-orders/${jobId}/complete`, {
        method: 'PATCH'
      })
      if (!response.ok) throw new Error('Failed to complete job')
      
      // Remove from For Release list immediately
      setForReleaseJobs(prev => prev.filter(job => job._id !== jobId))
      
      await fetchData()
      toast.success('Job marked as Complete and released to customer')
    } catch (error) {
      console.error('Error completing job:', error)
      toast.error('Failed to complete job')
    } finally {
      setUpdating(false)
    }
  }, [fetchData])

  const redoJob = useCallback(async (jobId: string) => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/job-orders/${jobId}/redo`, {
        method: 'PATCH'
      })
      if (!response.ok) throw new Error('Failed to redo job')
      await fetchData()
      toast.success('Job sent back for rework')
    } catch (error) {
      console.error('Error redoing job:', error)
      toast.error('Failed to redo job')
    } finally {
      setUpdating(false)
    }
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading timetable...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Toaster position="top-right" />
      {/* Header with date navigation and summary - Balanced Layout */}
      <div className="flex gap-3">
        {/* Date navigation - Wider */}
        <div className="flex items-center justify-between floating-card p-3 flex-1">
          <button
            onClick={() => navigateDate('prev')}
            className="px-4 py-2 bg-white/50 hover:bg-white/70 rounded-lg font-semibold transition-all border border-white/50 hover:shadow-lg hover:-translate-y-0.5 text-sm"
          >
            ← Previous
          </button>
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-bold whitespace-nowrap">{formatDate(date)}</h2>
            <button
              onClick={() => onDateChange(new Date())}
              className="px-3 py-1.5 text-sm bg-blue-500/20 hover:bg-blue-500/30 text-blue-800 rounded-lg font-semibold transition-all border border-blue-300/30"
            >
              Today
            </button>
          </div>
          <button
            onClick={() => navigateDate('next')}
            className="px-4 py-2 bg-white/50 hover:bg-white/70 rounded-lg font-semibold transition-all border border-white/50 hover:shadow-lg hover:-translate-y-0.5 text-sm"
          >
            Next →
          </button>
        </div>
        
        {/* Daily Summary - Narrower */}
        <div className="floating-card p-3 lg:w-80">
          <h3 className="text-sm font-bold mb-2">Daily Summary</h3>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{jobOrders.length}</div>
              <div className="text-gray-600">On Timetable</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">
                {jobOrders.filter(job => job.status === 'OG').length}
              </div>
              <div className="text-gray-600">On Going</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">
                {forReleaseJobs.length}
              </div>
              <div className="text-gray-600">For Release</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-600">
                {holdCustomerJobs.length + holdWarrantyJobs.length + holdInsuranceJobs.length + waitingPartsJobs.length}
              </div>
              <div className="text-gray-600">On Hold</div>
            </div>
          </div>
        </div>
        
        {/* Status Legend - Compact */}
        <div className="floating-card p-3 lg:w-80">
          <h3 className="text-sm font-bold mb-2">Status Legend</h3>
          <div className="grid grid-cols-5 gap-1 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-100 border border-blue-300 rounded flex-shrink-0"></div>
              <span>OG</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-orange-100 border border-orange-300 rounded flex-shrink-0"></div>
              <span>WP</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-cyan-100 border border-cyan-300 rounded flex-shrink-0"></div>
              <span>FP</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-purple-100 border border-purple-300 rounded flex-shrink-0"></div>
              <span>QI</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-yellow-100 border border-yellow-300 rounded flex-shrink-0"></div>
              <span>HC</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-red-100 border border-red-300 rounded flex-shrink-0"></div>
              <span>HW</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-indigo-100 border border-indigo-300 rounded flex-shrink-0"></div>
              <span>HI</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-100 border border-green-300 rounded flex-shrink-0"></div>
              <span>FR</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-gray-100 border border-gray-300 rounded flex-shrink-0"></div>
              <span>FU</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-emerald-100 border border-emerald-300 rounded flex-shrink-0"></div>
              <span>CP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timetable */}
      <div className="floating-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed relative" style={{ zIndex: 1 }}>
            <thead className="bg-gray-50">
              <tr>
                <th className="w-32 px-2 py-3 text-left text-sm font-medium text-gray-700 border-r">
                  Technician
                </th>
                {TIME_SLOTS.map((slot) => (
                  <th
                    key={slot.time}
                    className="w-16 px-1 py-3 text-center text-xs font-medium text-gray-600 border-r"
                  >
                    {formatTime(slot.time)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody style={{ zIndex: 2 }}>
              {technicians.map((technician) => (
                <tr key={technician._id} className="border-t h-20">
                  <td className="w-32 px-2 py-3 text-sm font-medium text-gray-900 border-r bg-gray-50 h-20">
                    {technician.name}
                  </td>
                  {TIME_SLOTS.map((slot, slotIndex) => {
                    const job = getJobAtTime(technician._id, slot)
                    const isJobStart = job && getJobStartSlot(technician._id, job) === slotIndex
                    
                    const appointment = getAppointmentAtTime(technician._id, slot)
                    const isAppointmentStart = appointment && getAppointmentStartSlot(appointment) === slotIndex
                    
                    return (
                      <td
                        key={`${technician._id}-${slot.time}`}
                        className="w-16 h-20 px-0 py-0 border-r border-b relative overflow-visible"
                      >
                        {isAppointmentStart && !job ? (
                          <div
                            className="h-full rounded text-xs font-medium border-2 border-dashed border-pink-400 bg-pink-50 text-pink-800 transition-all hover:shadow-md relative cursor-pointer"
                            style={{
                              width: `${getAppointmentSpan(appointment) * 64}px`,
                              minWidth: '64px',
                              position: 'absolute',
                              left: '0px',
                              top: '0px',
                              zIndex: 100,
                              pointerEvents: 'auto',
                              maxWidth: 'none',
                              overflow: 'visible'
                            }}
                            title={`Appointment: ${appointment.plateNumber} - ${formatTime(appointment.timeRange.start)} to ${formatTime(appointment.timeRange.end)}`}
                          >
                            <div className="p-1 h-full flex flex-col justify-between">
                              <div>
                                <div className="truncate font-semibold text-xs">📅 {appointment.plateNumber}</div>
                                <div className="truncate text-xs opacity-75">
                                  {formatTime(appointment.timeRange.start)}-{formatTime(appointment.timeRange.end)}
                                </div>
                              </div>
                              <div className="flex gap-0.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleAppointmentClick(appointment)
                                  }}
                                  className="flex-1 create-job-button text-[10px] py-0.5 px-1"
                                  title="Create Job Order"
                                >
                                  Create JO
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteAppointment(appointment._id)
                                  }}
                                  className="no-show-button text-[10px] py-0.5 px-1"
                                  title="No Show - Delete"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : isJobStart ? (
                          <button
                            onClick={() => handleCellClick(job)}
                            data-job-id={job._id}
                            className={`h-full rounded text-xs font-medium border-2 transition-all hover:shadow-md relative ${STATUS_COLORS[job.status]} ${
                              highlightedJobId === job._id ? 'ring-4 ring-yellow-400 ring-opacity-75 animate-pulse' : ''
                            }`}
                            style={{
                              width: `${getJobSpan(job) * 64}px`, // 64px per 30-min slot (reduced from 80px)
                              minWidth: '64px',
                              position: 'absolute',
                              left: `${getJobOffset(job) * 64 / 100}px`, // Apply offset based on actual start time within slot
                              top: '0px',
                              zIndex: highlightedJobId === job._id ? 110 : 105,
                              pointerEvents: 'auto',
                              maxWidth: 'none',
                              overflow: 'visible',
                              ...(job.timeRange.start && job.timeRange.end && 
                                (() => {
                                  const [startHour, startMinute] = job.timeRange.start.split(':').map(Number)
                                  const [endHour, endMinute] = job.timeRange.end.split(':').map(Number)
                                  const [breakStartHour, breakStartMinute] = breakStart.split(':').map(Number)
                                  const [breakEndHour, breakEndMinute] = breakEnd.split(':').map(Number)
                                  
                                  const jobStartMinutes = startHour * 60 + startMinute
                                  const jobEndMinutes = endHour * 60 + endMinute
                                  const breakStartMinutes = breakStartHour * 60 + breakStartMinute
                                  const breakEndMinutes = breakEndHour * 60 + breakEndMinute
                                  
                                  // Check if job overlaps with break time
                                  const overlapsBreak = jobStartMinutes < breakEndMinutes && jobEndMinutes > breakStartMinutes
                                  
                                  if (overlapsBreak) {
                                    // Calculate the break portion width and position
                                    const breakStartInJob = Math.max(breakStartMinutes, jobStartMinutes)
                                    const breakEndInJob = Math.min(breakEndMinutes, jobEndMinutes)
                                    const breakDuration = breakEndInJob - breakStartInJob
                                    const totalJobDuration = jobEndMinutes - jobStartMinutes
                                    const breakWidthPercent = (breakDuration / totalJobDuration) * 100
                                    const breakLeftPercent = ((breakStartInJob - jobStartMinutes) / totalJobDuration) * 100
                                    
                                    return {
                                      position: 'relative',
                                      '--break-start': `${breakLeftPercent}%`,
                                      '--break-end': `${breakLeftPercent + breakWidthPercent}%`,
                                      '--break-width': `${breakWidthPercent}%`
                                    }
                                  }
                                  return {}
                                })()
                              )
                            }}
                            title={`${job.jobNumber} - ${job.plateNumber} (${getJobProgress(job).toFixed(0)}% complete) - ${formatTime(job.timeRange.start)} to ${formatTime(job.timeRange.end)}`}
                          >
                            {job.isImportant && (
                              <div className="absolute top-0 right-0 text-yellow-500 text-lg">
                                ★
                              </div>
                            )}
                            {job.carriedOver && (
                              <div className="absolute top-0 left-0 text-red-500 text-xs">
                                🔄
                              </div>
                            )}
                            <div className="truncate font-semibold">{job.jobNumber}</div>
                            <div className="truncate text-xs opacity-75">{job.plateNumber}</div>
                            <div className="truncate text-xs opacity-60">
                              {formatTime(job.timeRange.start)}-{formatTime(job.timeRange.end)}
                            </div>
                            {job.status !== 'FR' && job.status !== 'FU' && (
                              <div className="absolute bottom-1 left-1 right-1">
                                <div className="flex items-center justify-between text-xs mb-0.5 px-1">
                                  <span className="text-black font-bold bg-white bg-opacity-80 px-1 py-0.5 rounded">
                                    {job.jobList.filter(t => t.status === 'Finished').length}/{job.jobList.length}
                                  </span>
                                  <span className="text-black font-bold bg-white bg-opacity-80 px-1 py-0.5 rounded">
                                    {getJobProgress(job).toFixed(0)}%
                                  </span>
                                </div>
                                <div className="bg-white bg-opacity-50 rounded-full h-1">
                                  <div 
                                    className="bg-blue-500 h-1 rounded-full transition-all"
                                    style={{ width: `${getJobProgress(job)}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}
                            {/* Break time indicator - darker section with BREAK label */}
                            {job.timeRange.start && job.timeRange.end && (() => {
                              const [startHour, startMinute] = job.timeRange.start.split(':').map(Number)
                              const [endHour, endMinute] = job.timeRange.end.split(':').map(Number)
                              const [breakStartHour, breakStartMinute] = breakStart.split(':').map(Number)
                              const [breakEndHour, breakEndMinute] = breakEnd.split(':').map(Number)
                              
                              const jobStartMinutes = startHour * 60 + startMinute
                              const jobEndMinutes = endHour * 60 + endMinute
                              const breakStartMinutes = breakStartHour * 60 + breakStartMinute
                              const breakEndMinutes = breakEndHour * 60 + breakEndMinute
                              
                              const overlapsBreak = jobStartMinutes < breakEndMinutes && jobEndMinutes > breakStartMinutes
                              
                              if (overlapsBreak) {
                                const breakStartInJob = Math.max(breakStartMinutes, jobStartMinutes)
                                const breakEndInJob = Math.min(breakEndMinutes, jobEndMinutes)
                                const breakDuration = breakEndInJob - breakStartInJob
                                const totalJobDuration = jobEndMinutes - jobStartMinutes
                                const breakWidthPercent = (breakDuration / totalJobDuration) * 100
                                const breakLeftPercent = ((breakStartInJob - jobStartMinutes) / totalJobDuration) * 100
                                
                                return (
                                  <div 
                                    className="absolute inset-0 pointer-events-none"
                                    style={{
                                      left: breakLeftPercent + '%',
                                      width: breakWidthPercent + '%',
                                      backgroundColor: 'rgba(0, 0, 0, 0.1)'
                                    }}
                                  />
                                )
                              }
                              return null
                            })()}
                          </button>
                        ) : job ? (
                          // This cell is part of a job but not the start - show as continuation
                          <div className="w-full h-full bg-transparent"></div>
                        ) : (
                          <div className="w-full h-full bg-gray-50 rounded min-h-[4rem]"></div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job Status Sections - Compact Horizontal Scroll */}
      <div className="floating-card p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="text-xl">📊</span>
          Job Status Queues
        </h2>
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4 min-w-max">
            {/* Quality Inspection Section */}
            <div className={`${qiJobs.length > 0 ? 'bg-purple-500/20 backdrop-blur-sm border-2 border-purple-400/30' : 'bg-gray-100/50 backdrop-blur-sm border-2 border-gray-300/30'} rounded-xl p-4 w-72 flex-shrink-0`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-base font-bold flex items-center gap-2 ${qiJobs.length > 0 ? 'text-purple-900' : 'text-gray-600'}`}>
                  <span className="text-lg">🔍</span>
                  Quality Inspection
                </h3>
                <span className={`${qiJobs.length > 0 ? 'bg-purple-500/30 text-purple-900' : 'bg-gray-300/50 text-gray-600'} px-2.5 py-1 rounded-lg text-xs font-bold`}>
                  {qiJobs.length}
                </span>
              </div>
              
              {qiJobs.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <div className="text-2xl mb-1">✅</div>
                  <p className="text-xs">No jobs pending QI</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {qiJobs.map((job) => (
                    <div key={job._id} className="bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl p-3 hover:bg-white/80 transition-all hover:-translate-y-0.5">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1 min-w-0">
                          {job.isImportant && <span className="text-yellow-500 text-sm">★</span>}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-sm text-purple-900 truncate">{job.jobNumber}</h4>
                            <p className="text-xs text-gray-700 truncate">{job.plateNumber}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => approveQI(job._id)} disabled={updating} className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold px-2 py-1 rounded-lg transition-all hover:shadow-md text-xs flex-1">✓</button>
                          <button onClick={() => rejectQI(job._id)} disabled={updating} className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold px-2 py-1 rounded-lg transition-all hover:shadow-md text-xs flex-1">✗</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* For Release Section */}
            <div className={`${forReleaseJobs.length > 0 ? 'bg-green-500/20 backdrop-blur-sm border-2 border-green-400/30' : 'bg-gray-100/50 backdrop-blur-sm border-2 border-gray-300/30'} rounded-xl p-4 w-72 flex-shrink-0`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-base font-bold flex items-center gap-2 ${forReleaseJobs.length > 0 ? 'text-green-900' : 'text-gray-600'}`}>
                  <span className="text-lg">✅</span>
                  For Release
                </h3>
                <span className={`${forReleaseJobs.length > 0 ? 'bg-green-500/30 text-green-900' : 'bg-gray-300/50 text-gray-600'} px-2.5 py-1 rounded-lg text-xs font-bold`}>
                  {forReleaseJobs.length}
                </span>
              </div>
              
              {forReleaseJobs.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <div className="text-2xl mb-1">🔧</div>
                  <p className="text-xs">No jobs for release</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {forReleaseJobs.map((job) => (
                    <div key={job._id} className="bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl p-3 hover:bg-white/80 transition-all hover:-translate-y-0.5">
                      <div className="space-y-2">
                        <div className="flex items-center gap-1 min-w-0">
                          {job.isImportant && <span className="text-yellow-500 text-sm">★</span>}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-sm text-green-900 truncate">{job.jobNumber}</h4>
                            <p className="text-xs text-gray-700 truncate">{job.plateNumber}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => completeJob(job._id)} disabled={updating} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold px-2 py-1 rounded-lg transition-all hover:shadow-md text-xs flex-1">✓ Done</button>
                          <button onClick={() => redoJob(job._id)} disabled={updating} className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold px-2 py-1 rounded-lg transition-all hover:shadow-md text-xs flex-1">↻ Redo</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Waiting Parts Section */}
            <div className={`${waitingPartsJobs.length > 0 ? 'bg-orange-500/20 backdrop-blur-sm border-2 border-orange-400/30' : 'bg-gray-100/50 backdrop-blur-sm border-2 border-gray-300/30'} rounded-xl p-4 w-72 flex-shrink-0`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-base font-bold flex items-center gap-2 ${waitingPartsJobs.length > 0 ? 'text-orange-900' : 'text-gray-600'}`}>
                  <span className="text-lg">⏳</span>
                  Waiting Parts
                </h3>
                <span className={`${waitingPartsJobs.length > 0 ? 'bg-orange-500/30 text-orange-900' : 'bg-gray-300/50 text-gray-600'} px-2.5 py-1 rounded-lg text-xs font-bold`}>
                  {waitingPartsJobs.length}
                </span>
              </div>
              
              {waitingPartsJobs.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <div className="text-2xl mb-1">📦</div>
                  <p className="text-xs">No jobs waiting parts</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {waitingPartsJobs.map((job) => (
                    <div key={job._id} className="bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl p-3 hover:bg-white/80 transition-all cursor-pointer hover:-translate-y-0.5" onClick={() => handleCellClick(job)}>
                      <div className="flex items-center gap-1 min-w-0">
                        {job.isImportant && <span className="text-yellow-500 text-sm">★</span>}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-orange-900 truncate">{job.jobNumber}</h4>
                          <p className="text-xs text-gray-700 truncate">{job.plateNumber}</p>
                          <p className="text-xs text-red-600 mt-1 font-medium">{job.parts.filter(p => p.availability === 'Unavailable').length} parts missing</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* For Plotting Section */}
            <div className={`${forPlottingJobs.length > 0 ? 'bg-cyan-500/20 backdrop-blur-sm border-2 border-cyan-400/30' : 'bg-gray-100/50 backdrop-blur-sm border-2 border-gray-300/30'} rounded-xl p-4 w-72 flex-shrink-0`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-base font-bold flex items-center gap-2 ${forPlottingJobs.length > 0 ? 'text-cyan-900' : 'text-gray-600'}`}>
                  <span className="text-lg">📍</span>
                  For Plotting
                </h3>
                <span className={`${forPlottingJobs.length > 0 ? 'bg-cyan-500/30 text-cyan-900' : 'bg-gray-300/50 text-gray-600'} px-2.5 py-1 rounded-lg text-xs font-bold`}>
                  {forPlottingJobs.length}
                </span>
              </div>
              
              {forPlottingJobs.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <div className="text-2xl mb-1">✨</div>
                  <p className="text-xs">No jobs for plotting</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {forPlottingJobs.map((job) => (
                    <div key={job._id} className="bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl p-3 hover:bg-white/80 transition-all cursor-pointer hover:-translate-y-0.5" onClick={() => handleCellClick(job)}>
                      <div className="flex items-center gap-1 min-w-0">
                        {job.isImportant && <span className="text-yellow-500 text-sm">★</span>}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-cyan-900 truncate">{job.jobNumber}</h4>
                          <p className="text-xs text-gray-700 truncate">{job.plateNumber}</p>
                          <p className="text-xs text-green-600 mt-1 font-medium">✓ Ready to plot</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Carry Over Section */}
            <div className={`${carriedOverJobs.length > 0 ? 'bg-red-500/20 backdrop-blur-sm border-2 border-red-400/30' : 'bg-gray-100/50 backdrop-blur-sm border-2 border-gray-300/30'} rounded-xl p-4 w-72 flex-shrink-0`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-base font-bold flex items-center gap-2 ${carriedOverJobs.length > 0 ? 'text-red-900' : 'text-gray-600'}`}>
                  <span className="text-lg">🔄</span>
                  Carried Over
                </h3>
                <span className={`${carriedOverJobs.length > 0 ? 'bg-red-500/30 text-red-900' : 'bg-gray-300/50 text-gray-600'} px-2.5 py-1 rounded-lg text-xs font-bold`}>
                  {carriedOverJobs.length}
                </span>
              </div>
              
              {carriedOverJobs.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <div className="text-2xl mb-1">✨</div>
                  <p className="text-xs">No carried over jobs</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {carriedOverJobs.map((job) => (
                    <div key={job._id} className="bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl p-3 hover:bg-white/80 transition-all cursor-pointer hover:-translate-y-0.5" onClick={() => handleCellClick(job)}>
                      <div className="flex items-center gap-1 min-w-0">
                        {job.isImportant && <span className="text-yellow-500 text-sm">★</span>}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-red-900 truncate">{job.jobNumber}</h4>
                          <p className="text-xs text-gray-700 truncate">{job.plateNumber}</p>
                          <p className="text-xs text-gray-600 mt-1">{formatTime(job.timeRange.start)}-{formatTime(job.timeRange.end)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hold Customer Section */}
            <div className={`${holdCustomerJobs.length > 0 ? 'bg-yellow-500/20 backdrop-blur-sm border-2 border-yellow-400/30' : 'bg-gray-100/50 backdrop-blur-sm border-2 border-gray-300/30'} rounded-xl p-4 w-72 flex-shrink-0`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-base font-bold flex items-center gap-2 ${holdCustomerJobs.length > 0 ? 'text-yellow-900' : 'text-gray-600'}`}>
                  <span className="text-lg">👤</span>
                  Hold Customer
                </h3>
                <span className={`${holdCustomerJobs.length > 0 ? 'bg-yellow-500/30 text-yellow-900' : 'bg-gray-300/50 text-gray-600'} px-2.5 py-1 rounded-lg text-xs font-bold`}>
                  {holdCustomerJobs.length}
                </span>
              </div>
              
              {holdCustomerJobs.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <div className="text-2xl mb-1">✅</div>
                  <p className="text-xs">No jobs on hold</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {holdCustomerJobs.map((job) => (
                    <div key={job._id} className="bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl p-3 hover:bg-white/80 transition-all cursor-pointer hover:-translate-y-0.5" onClick={() => handleCellClick(job)}>
                      <div className="flex items-center gap-1 min-w-0">
                        {job.isImportant && <span className="text-yellow-500 text-sm">★</span>}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-yellow-900 truncate">{job.jobNumber}</h4>
                          <p className="text-xs text-gray-700 truncate">{job.plateNumber}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hold Warranty Section */}
            <div className={`${holdWarrantyJobs.length > 0 ? 'bg-red-500/20 backdrop-blur-sm border-2 border-red-400/30' : 'bg-gray-100/50 backdrop-blur-sm border-2 border-gray-300/30'} rounded-xl p-4 w-72 flex-shrink-0`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-base font-bold flex items-center gap-2 ${holdWarrantyJobs.length > 0 ? 'text-red-900' : 'text-gray-600'}`}>
                  <span className="text-lg">🛡️</span>
                  Hold Warranty
                </h3>
                <span className={`${holdWarrantyJobs.length > 0 ? 'bg-red-500/30 text-red-900' : 'bg-gray-300/50 text-gray-600'} px-2.5 py-1 rounded-lg text-xs font-bold`}>
                  {holdWarrantyJobs.length}
                </span>
              </div>
              
              {holdWarrantyJobs.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <div className="text-2xl mb-1">✅</div>
                  <p className="text-xs">No jobs on hold</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {holdWarrantyJobs.map((job) => (
                    <div key={job._id} className="bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl p-3 hover:bg-white/80 transition-all cursor-pointer hover:-translate-y-0.5" onClick={() => handleCellClick(job)}>
                      <div className="flex items-center gap-1 min-w-0">
                        {job.isImportant && <span className="text-yellow-500 text-sm">★</span>}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-red-900 truncate">{job.jobNumber}</h4>
                          <p className="text-xs text-gray-700 truncate">{job.plateNumber}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hold Insurance Section */}
            <div className={`${holdInsuranceJobs.length > 0 ? 'bg-indigo-500/20 backdrop-blur-sm border-2 border-indigo-400/30' : 'bg-gray-100/50 backdrop-blur-sm border-2 border-gray-300/30'} rounded-xl p-4 w-72 flex-shrink-0`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-base font-bold flex items-center gap-2 ${holdInsuranceJobs.length > 0 ? 'text-indigo-900' : 'text-gray-600'}`}>
                  <span className="text-lg">🏥</span>
                  Hold Insurance
                </h3>
                <span className={`${holdInsuranceJobs.length > 0 ? 'bg-indigo-500/30 text-indigo-900' : 'bg-gray-300/50 text-gray-600'} px-2.5 py-1 rounded-lg text-xs font-bold`}>
                  {holdInsuranceJobs.length}
                </span>
              </div>
              
              {holdInsuranceJobs.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <div className="text-2xl mb-1">✅</div>
                  <p className="text-xs">No jobs on hold</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {holdInsuranceJobs.map((job) => (
                    <div key={job._id} className="bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl p-3 hover:bg-white/80 transition-all cursor-pointer hover:-translate-y-0.5" onClick={() => handleCellClick(job)}>
                      <div className="flex items-center gap-1 min-w-0">
                        {job.isImportant && <span className="text-yellow-500 text-sm">★</span>}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-indigo-900 truncate">{job.jobNumber}</h4>
                          <p className="text-xs text-gray-700 truncate">{job.plateNumber}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Finished Unclaimed Section */}
            <div className={`${finishedUnclaimedJobs.length > 0 ? 'bg-gray-500/20 backdrop-blur-sm border-2 border-gray-400/30' : 'bg-gray-100/50 backdrop-blur-sm border-2 border-gray-300/30'} rounded-xl p-4 w-72 flex-shrink-0`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-base font-bold flex items-center gap-2 ${finishedUnclaimedJobs.length > 0 ? 'text-gray-900' : 'text-gray-600'}`}>
                  <span className="text-lg">📋</span>
                  Finished Unclaimed
                </h3>
                <span className={`${finishedUnclaimedJobs.length > 0 ? 'bg-gray-500/30 text-gray-900' : 'bg-gray-300/50 text-gray-600'} px-2.5 py-1 rounded-lg text-xs font-bold`}>
                  {finishedUnclaimedJobs.length}
                </span>
              </div>
              
              {finishedUnclaimedJobs.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <div className="text-2xl mb-1">✅</div>
                  <p className="text-xs">No unclaimed jobs</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {finishedUnclaimedJobs.map((job) => (
                    <div key={job._id} className="bg-white/60 backdrop-blur-sm border border-white/60 rounded-xl p-3 hover:bg-white/80 transition-all cursor-pointer hover:-translate-y-0.5" onClick={() => handleCellClick(job)}>
                      <div className="flex items-center gap-1 min-w-0">
                        {job.isImportant && <span className="text-yellow-500 text-sm">★</span>}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-gray-900 truncate">{job.jobNumber}</h4>
                          <p className="text-xs text-gray-700 truncate">{job.plateNumber}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Job Details Modal */}
      {showModal && selectedJob && (
        <div className="modal-backdrop">
          <div className="floating-card max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="p-6">
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-gray-900">Job Order Details</h3>
                  <button
                    onClick={() => toggleImportant(selectedJob._id)}
                    disabled={updating}
                    className={`text-2xl transition-all ${selectedJob.isImportant ? 'text-yellow-400 drop-shadow-lg' : 'text-gray-400/60'} hover:scale-125 hover:text-yellow-400`}
                    title={selectedJob.isImportant ? 'Remove from important' : 'Mark as important'}
                  >
                    {selectedJob.isImportant ? '★' : '☆'}
                  </button>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Job Number</label>
                    <p className="text-lg font-semibold">{selectedJob.jobNumber}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600 mb-1 block">Status</label>
                    <select
                      value={selectedJob.status}
                      onChange={(e) => updateJobStatus(selectedJob._id, e.target.value)}
                      disabled={updating}
                      className="px-3 py-1 rounded-lg text-sm font-medium border-2 border-gray-300 focus:outline-none focus:border-blue-500"
                    >
                      <option value="OG">OG - On Going</option>
                      <option value="WP">WP - Waiting Parts</option>
                      <option value="FP">FP - For Plotting</option>
                      <option value="QI">QI - Quality Inspection</option>
                      <option value="HC">HC - Hold Customer</option>
                      <option value="HW">HW - Hold Warranty</option>
                      <option value="HI">HI - Hold Insurance</option>
                      <option value="FR">FR - For Release</option>
                      <option value="FU">FU - Finished Unclaimed</option>
                      <option value="CP">CP - Complete</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Plate Number</label>
                    <p className="text-lg">{selectedJob.plateNumber}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">VIN</label>
                    <p className="text-sm font-mono">{selectedJob.vin}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-sm font-medium text-gray-600">Assigned Technician</label>
                      <button
                        onClick={() => setShowTechnicianModal(true)}
                        disabled={updating}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Reassign
                      </button>
                    </div>
                    <p className="text-lg">{selectedJob.assignedTechnician ? selectedJob.assignedTechnician.name : (
                      <span className="text-red-600 font-semibold">⚠️ Unassigned</span>
                    )}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Time Slot</label>
                    <p className="text-lg">{formatTime(selectedJob.timeRange.start)} - {formatTime(selectedJob.timeRange.end)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Work Duration</label>
                    <p className="text-lg font-semibold text-blue-600">{calculateWorkDuration(selectedJob.timeRange.start, selectedJob.timeRange.end)}</p>
                  </div>
                </div>

                {selectedJob.carriedOver && (
                  <div className="bg-red-500/20 backdrop-blur-sm border border-red-300/30 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-red-800">
                      <span className="text-xl">🔄</span>
                      <span className="font-semibold">This job was carried over from a previous day</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-600 mb-2 block">Job Tasks</label>
                  <div className="space-y-2">
                    {selectedJob.jobList.map((task, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                        <span className="text-sm flex-1">{task.description}</span>
                        <select
                          value={task.status}
                          onChange={(e) => updateTaskStatus(selectedJob._id, index, e.target.value as 'Finished' | 'Unfinished')}
                          disabled={updating}
                          className={`ml-3 px-3 py-1 rounded text-xs font-medium border-2 focus:outline-none ${
                            task.status === 'Finished' 
                              ? 'bg-green-100 text-green-800 border-green-300' 
                              : 'bg-gray-100 text-gray-800 border-gray-300'
                          }`}
                        >
                          <option value="Unfinished">Unfinished</option>
                          <option value="Finished">Finished</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600 mb-2 block">Parts Required</label>
                  <div className="space-y-2">
                    {selectedJob.parts.map((part, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                        <span className="text-sm flex-1">{part.name}</span>
                        <select
                          value={part.availability}
                          onChange={(e) => updatePartAvailability(selectedJob._id, index, e.target.value as 'Available' | 'Unavailable')}
                          disabled={updating}
                          className={`ml-3 px-3 py-1 rounded text-xs font-medium border-2 focus:outline-none ${
                            part.availability === 'Available' 
                              ? 'bg-green-100 text-green-800 border-green-300' 
                              : 'bg-red-100 text-red-800 border-red-300'
                          }`}
                        >
                          <option value="Available">Available</option>
                          <option value="Unavailable">Unavailable</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Replot Button for FP Status */}
                {selectedJob.status === 'FP' && (
                  <div className="pt-4 border-t border-white/30">
                    <button
                      onClick={() => {
                        setShowModal(false)
                        setShowReplotModal(true)
                      }}
                      disabled={updating}
                      className="w-full bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 rounded-xl transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                    >
                      Replot Job Order
                    </button>
                    <p className="text-xs text-gray-700 mt-2 text-center font-medium">Assign technician and time slot to add this job to the workshop board</p>
                  </div>
                )}

                {/* Submit for QI Button */}
                {selectedJob.status !== 'FP' && selectedJob.status !== 'QI' && selectedJob.status !== 'FR' && selectedJob.status !== 'FU' && selectedJob.status !== 'CP' && (
                  <div className="pt-4 border-t border-white/30">
                    <button
                      onClick={() => submitForQI(selectedJob._id)}
                      disabled={
                        updating || 
                        selectedJob.jobList.some(task => task.status === 'Unfinished') ||
                        selectedJob.parts.some(part => part.availability === 'Unavailable')
                      }
                      className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 rounded-xl transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                    >
                      {updating ? 'Submitting...' : 'Submit for Quality Inspection'}
                    </button>
                    {selectedJob.jobList.some(task => task.status === 'Unfinished') && (
                      <p className="text-xs text-red-600 mt-2 text-center font-medium">All tasks must be finished before submitting for QI</p>
                    )}
                    {selectedJob.parts.some(part => part.availability === 'Unavailable') && (
                      <p className="text-xs text-red-600 mt-2 text-center font-medium">All parts must be available before submitting for QI</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Technician Reassignment Modal */}
      {showTechnicianModal && selectedJob && (
        <div className="modal-backdrop">
          <div className="floating-card max-w-md w-full mx-4 animate-fade-in">
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-gray-900">Reassign Technician</h3>
                <button
                  onClick={() => setShowTechnicianModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-blue-500/20 backdrop-blur-sm border border-blue-300/30 rounded-xl p-3">
                  <p className="text-sm text-gray-700 font-medium">
                    Current: <span className="font-bold text-gray-900">
                      {selectedJob.assignedTechnician ? selectedJob.assignedTechnician.name : (
                        <span className="text-red-600">Not Assigned</span>
                      )}
                    </span>
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-bold text-gray-800">Available Technicians:</p>
                  {availableTechnicians.length === 0 ? (
                    <p className="text-sm text-gray-600 text-center py-4 font-medium">Loading available technicians...</p>
                  ) : (
                    availableTechnicians.map((tech) => (
                      <button
                        key={tech._id}
                        onClick={() => reassignTechnician(tech._id)}
                        disabled={updating || (selectedJob.assignedTechnician && tech._id === selectedJob.assignedTechnician._id)}
                        className={`w-full p-3 rounded-xl text-sm font-semibold text-left transition-all duration-200 ${
                          selectedJob.assignedTechnician && tech._id === selectedJob.assignedTechnician._id
                            ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed border border-gray-300/30'
                            : 'bg-blue-500/20 text-blue-700 hover:bg-blue-500/30 border border-blue-300/30 hover:shadow-lg hover:-translate-y-0.5'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>{tech.name}</span>
                          {tech.level && (
                            <span className="text-xs bg-blue-500/30 text-blue-800 px-2 py-1 rounded-lg border border-blue-400/30">{tech.level}</span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time Slot Reassignment Modal */}
      {showReassignModal && reassignmentSlot && (
        <ReassignTimeSlotModal
          onClose={() => {
            setShowReassignModal(false)
            setReassignmentSlot(null)
          }}
          technicianId={reassignmentSlot.technicianId}
          technicianName={reassignmentSlot.technicianName}
          date={date.toISOString().split('T')[0]}
          startTime={reassignmentSlot.startTime}
          endTime={reassignmentSlot.endTime}
          onJobAssigned={() => {
            fetchData()
          }}
        />
      )}

      {/* Replot Job Order Modal */}
      {showReplotModal && selectedJob && (
        <ReplotJobOrderModal
          onClose={() => setShowReplotModal(false)}
          jobId={selectedJob._id}
          jobNumber={selectedJob.jobNumber}
          currentDate={selectedJob.date.split('T')[0]}
          onSuccess={() => {
            fetchData()
          }}
        />
      )}

      {/* Create Job Order from Appointment Modal */}
      {showCreateJobOrderModal && selectedAppointment && (
        <CreateJobOrderFromAppointmentModal
          appointment={selectedAppointment}
          onClose={() => {
            setShowCreateJobOrderModal(false)
            setSelectedAppointment(null)
          }}
          onSuccess={handleCreateJobOrderSuccess}
        />
      )}

      {/* Delete Appointment Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Appointment"
        message="Mark this appointment as no-show and delete it? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        onConfirm={confirmDeleteAppointment}
        onCancel={cancelDeleteAppointment}
      />
    </div>
  )
}

// Memoize component to prevent unnecessary re-renders
export default memo(WorkshopTimetable)
