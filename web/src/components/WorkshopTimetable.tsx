"use client"

import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import type { JobOrder } from '@/types/jobOrder'

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
  'OG': 'bg-blue-100 border-blue-300 text-blue-800',      // On going
  'WP': 'bg-orange-100 border-orange-300 text-orange-800', // Waiting Parts
  'QI': 'bg-purple-100 border-purple-300 text-purple-800', // Quality Inspection
  'HC': 'bg-yellow-100 border-yellow-300 text-yellow-800', // Hold Customer
  'HW': 'bg-red-100 border-red-300 text-red-800',         // Hold Warranty
  'HI': 'bg-indigo-100 border-indigo-300 text-indigo-800', // Hold Insurance
  'FR': 'bg-green-100 border-green-300 text-green-800',   // For Release
  'FU': 'bg-gray-100 border-gray-300 text-gray-800',      // Finished Unclaimed
  'CP': 'bg-emerald-100 border-emerald-300 text-emerald-800' // Complete
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
  const [updating, setUpdating] = useState(false)
  const [highlightedJobId, setHighlightedJobId] = useState<string | null>(null)
  
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
      
      // Sort job orders - important ones first, then carried over, then by date
      const sortedJobs = (jobOrdersData.jobOrders || []).sort((a: JobOrderWithDetails, b: JobOrderWithDetails) => {
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
    return jobOrders.find(job => {
      // Don't show jobs without assigned technician (e.g., all parts missing)
      if (!job.assignedTechnician || job.assignedTechnician._id !== technicianId) return false
      
      const jobStart = parseTime(job.timeRange.start)
      const jobEnd = parseTime(job.timeRange.end)
      const slotTime = timeSlot.hour * 60 + timeSlot.minute
      
      // Show job if the slot time is within the job's time range
      return slotTime >= jobStart && slotTime < jobEnd
    }) || null
  }, [jobOrders])

  const getJobStartSlot = useCallback((technicianId: string, job: JobOrderWithDetails): number => {
    const jobStart = parseTime(job.timeRange.start)
    return TIME_SLOTS.findIndex(slot => {
      const slotTime = slot.hour * 60 + slot.minute
      return slotTime === jobStart
    })
  }, [])

  const getJobEndSlot = useCallback((technicianId: string, job: JobOrderWithDetails): number => {
    const jobEnd = parseTime(job.timeRange.end)
    return TIME_SLOTS.findIndex(slot => {
      const slotTime = slot.hour * 60 + slot.minute
      return slotTime === jobEnd
    })
  }, [])

  const getJobSpan = useCallback((job: JobOrderWithDetails): number => {
    const startSlot = getJobStartSlot(job.assignedTechnician._id, job)
    const endSlot = getJobEndSlot(job.assignedTechnician._id, job)
    return endSlot - startSlot
  }, [getJobStartSlot, getJobEndSlot])

  const getJobOffset = useCallback((job: JobOrderWithDetails): number => {
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
      
      // Optimistic update - update local state immediately
      setJobOrders(prev => prev.map(job => 
        job._id === jobId ? { ...job, status: status as any } : job
      ))
      if (selectedJob?._id === jobId) {
        setSelectedJob(prev => prev ? { ...prev, status: status as any } : null)
      }
      
      const response = await fetch(`/api/job-orders/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        // Revert optimistic update on error
        fetchData()
        throw new Error(errorData.error || 'Failed to update job status')
      }
      
      // Update QI and For Release lists based on new status
      if (status === 'QI') {
        setQiJobs(prev => [...prev, selectedJob!])
      } else if (status === 'FR') {
        setForReleaseJobs(prev => [...prev, selectedJob!])
        setQiJobs(prev => prev.filter(job => job._id !== jobId))
      } else {
        // Remove from both lists for any other status (including CP - Complete)
        setQiJobs(prev => prev.filter(job => job._id !== jobId))
        setForReleaseJobs(prev => prev.filter(job => job._id !== jobId))
      }
      
      toast.success('Job status updated successfully')
    } catch (error) {
      console.error('Error updating job status:', error)
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Failed to update job status')
      }
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

  const updatePartAvailability = useCallback(async (jobId: string, partIndex: number, availability: 'Available' | 'Unavailable') => {
    try {
      setUpdating(true)
      if (!selectedJob) return
      
      const updatedParts = [...selectedJob.parts]
      updatedParts[partIndex].availability = availability
      
      const response = await fetch(`/api/job-orders/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts: updatedParts })
      })
      if (!response.ok) throw new Error('Failed to update part availability')
      const data = await response.json()
      setSelectedJob(data.jobOrder)
      await fetchData()
      toast.success(`Part marked as ${availability.toLowerCase()}`)
      
      // Check if all parts are now available and suggest technician reassignment
      const allPartsAvailable = updatedParts.every(part => part.availability === 'Available')
      if (allPartsAvailable && selectedJob.status === 'WP') {
        toast.success('All parts are now available! Consider reassigning a technician.', { duration: 5000 })
      }
    } catch (error) {
      console.error('Error updating part availability:', error)
      toast.error('Failed to update part availability')
    } finally {
      setUpdating(false)
    }
  }, [selectedJob, fetchData])

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
      const response = await fetch(`/api/job-orders/${jobId}/submit-qi`, {
        method: 'PATCH'
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit for QI')
      }
      setShowModal(false)
      await fetchData()
      toast.success('Job order submitted for Quality Inspection')
    } catch (error: any) {
      console.error('Error submitting for QI:', error)
      toast.error(error.message || 'Failed to submit for QI')
    } finally {
      setUpdating(false)
    }
  }, [fetchData])

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
      {/* Header with date navigation */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border">
        <button
          onClick={() => navigateDate('prev')}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          ← Previous
        </button>
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold">{formatDate(date)}</h2>
          <button
            onClick={() => onDateChange(new Date())}
            className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition-colors"
          >
            Today
          </button>
        </div>
        <button
          onClick={() => navigateDate('next')}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Timetable */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
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
            <tbody>
              {technicians.map((technician) => (
                <tr key={technician._id} className="border-t h-20">
                  <td className="w-32 px-2 py-3 text-sm font-medium text-gray-900 border-r bg-gray-50 h-20">
                    {technician.name}
                  </td>
                  {TIME_SLOTS.map((slot, slotIndex) => {
                    const job = getJobAtTime(technician._id, slot)
                    const isJobStart = job && getJobStartSlot(technician._id, job) === slotIndex
                    
                    return (
                      <td
                        key={`${technician._id}-${slot.time}`}
                        className="w-16 h-20 px-0 py-0 border-r border-b relative"
                      >
                        {isJobStart ? (
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
                              zIndex: highlightedJobId === job._id ? 20 : 10,
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

      {/* Statistics and Legend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Statistics */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-3">Daily Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Total Jobs</div>
              <div className="text-2xl font-bold text-blue-600">{jobOrders.length}</div>
            </div>
            <div>
              <div className="text-gray-600">On Going</div>
              <div className="text-2xl font-bold text-blue-600">
                {jobOrders.filter(job => job.status === 'OG').length}
              </div>
            </div>
            <div>
              <div className="text-gray-600">For Release</div>
              <div className="text-2xl font-bold text-green-600">
                {jobOrders.filter(job => job.status === 'FR').length}
              </div>
            </div>
            <div>
              <div className="text-gray-600">On Hold</div>
              <div className="text-2xl font-bold text-red-600">
                {jobOrders.filter(job => ['HC', 'HW', 'HI', 'WP'].includes(job.status)).length}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-3">Status Legend</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
              <span>OG - On Going</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-orange-100 border border-orange-300 rounded"></div>
              <span>WP - Waiting Parts</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-purple-100 border border-purple-300 rounded"></div>
              <span>QI - Quality Inspection</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
              <span>HC - Hold Customer</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
              <span>HW - Hold Warranty</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-indigo-100 border border-indigo-300 rounded"></div>
              <span>HI - Hold Insurance</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
              <span>FR - For Release</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></div>
              <span>FU - Finished Unclaimed</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded"></div>
              <span>CP - Complete</span>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Click on any job cell to view detailed information
          </div>
        </div>
      </div>

      {/* Quality Inspection & For Release Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quality Inspection Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-purple-800 flex items-center gap-2">
              <span className="text-2xl">🔍</span>
              Quality Inspection
            </h3>
            <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
              {qiJobs.length} job{qiJobs.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          {qiJobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">✅</div>
              <p>No jobs pending quality inspection</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {qiJobs.map((job) => (
                <div key={job._id} className="border-2 border-purple-300 rounded-lg p-4 bg-purple-50 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-lg text-purple-900">{job.jobNumber}</h4>
                      <p className="text-sm text-gray-600">{job.plateNumber}</p>
                    </div>
                    {job.isImportant && (
                      <span className="text-yellow-500 text-xl">★</span>
                    )}
                  </div>
                  
                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Technician:</span>
                      <span className="font-medium">{job.assignedTechnician ? job.assignedTechnician.name : 'Unassigned'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-medium">{new Date(job.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tasks:</span>
                      <span className="font-medium">
                        {job.jobList.filter(t => t.status === 'Finished').length}/{job.jobList.length}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => approveQI(job._id)}
                      disabled={updating}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium py-2 rounded-lg transition-colors text-sm"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => rejectQI(job._id)}
                      disabled={updating}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-medium py-2 rounded-lg transition-colors text-sm"
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* For Release Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-green-800 flex items-center gap-2">
              <span className="text-2xl">✅</span>
              For Release
            </h3>
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
              {forReleaseJobs.length} job{forReleaseJobs.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          {forReleaseJobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">🔧</div>
              <p>No jobs ready for release</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {forReleaseJobs.map((job) => (
                <div key={job._id} className="border-2 border-green-300 rounded-lg p-4 bg-green-50 hover:shadow-md transition-shadow cursor-pointer"
                     onClick={() => handleCellClick(job)}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-lg text-green-900">{job.jobNumber}</h4>
                      <p className="text-sm text-gray-600">{job.plateNumber}</p>
                    </div>
                    {job.isImportant && (
                      <span className="text-yellow-500 text-xl">★</span>
                    )}
                  </div>
                  
                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Technician:</span>
                      <span className="font-medium">{job.assignedTechnician ? job.assignedTechnician.name : 'Unassigned'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-medium">{new Date(job.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tasks:</span>
                      <span className="font-medium text-green-700">
                        ✓ {job.jobList.length}/{job.jobList.length}
                      </span>
                    </div>
                    {job.qiStatus === 'approved' && (
                      <div className="flex items-center gap-1 text-xs text-green-700 mt-2">
                        <span>✓</span>
                        <span>Quality Approved</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-green-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        completeJob(job._id)
                      }}
                      disabled={updating}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2 rounded-lg transition-colors text-sm"
                    >
                      ✓ Complete
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        redoJob(job._id)
                      }}
                      disabled={updating}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white font-medium py-2 rounded-lg transition-colors text-sm"
                    >
                      ↻ Redo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Job Details Modal */}
      {showModal && selectedJob && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold">Job Order Details</h3>
                  <button
                    onClick={() => toggleImportant(selectedJob._id)}
                    disabled={updating}
                    className={`text-2xl transition-all ${selectedJob.isImportant ? 'text-yellow-500' : 'text-gray-400'} hover:scale-110 hover:text-yellow-500`}
                    title={selectedJob.isImportant ? 'Remove from important' : 'Mark as important'}
                  >
                    {selectedJob.isImportant ? '★' : '☆'}
                  </button>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
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
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-800">
                      <span className="text-xl">🔄</span>
                      <span className="font-medium">This job was carried over from a previous day</span>
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

                {/* Submit for QI Button */}
                {selectedJob.status !== 'QI' && selectedJob.status !== 'FR' && selectedJob.status !== 'FU' && selectedJob.status !== 'CP' && (
                  <div className="pt-4 border-t">
                    <button
                      onClick={() => submitForQI(selectedJob._id)}
                      disabled={
                        updating || 
                        selectedJob.jobList.some(task => task.status === 'Unfinished') ||
                        selectedJob.parts.some(part => part.availability === 'Unavailable')
                      }
                      className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-lg transition-colors"
                    >
                      {updating ? 'Submitting...' : 'Submit for Quality Inspection'}
                    </button>
                    {selectedJob.jobList.some(task => task.status === 'Unfinished') && (
                      <p className="text-xs text-red-600 mt-2 text-center">All tasks must be finished before submitting for QI</p>
                    )}
                    {selectedJob.parts.some(part => part.availability === 'Unavailable') && (
                      <p className="text-xs text-red-600 mt-2 text-center">All parts must be available before submitting for QI</p>
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
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Reassign Technician</h3>
                <button
                  onClick={() => setShowTechnicianModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-gray-600">
                    Current: <span className="font-medium text-gray-900">
                      {selectedJob.assignedTechnician ? selectedJob.assignedTechnician.name : (
                        <span className="text-red-600">Not Assigned</span>
                      )}
                    </span>
                  </p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Available Technicians:</p>
                  {availableTechnicians.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Loading available technicians...</p>
                  ) : (
                    availableTechnicians.map((tech) => (
                      <button
                        key={tech._id}
                        onClick={() => reassignTechnician(tech._id)}
                        disabled={updating || (selectedJob.assignedTechnician && tech._id === selectedJob.assignedTechnician._id)}
                        className={`w-full p-3 rounded-lg text-sm font-medium text-left transition-colors ${
                          selectedJob.assignedTechnician && tech._id === selectedJob.assignedTechnician._id
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>{tech.name}</span>
                          {tech.level && (
                            <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">{tech.level}</span>
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
    </div>
  )
}

// Memoize component to prevent unnecessary re-renders
export default memo(WorkshopTimetable)
