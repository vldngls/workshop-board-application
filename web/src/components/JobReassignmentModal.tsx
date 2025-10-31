'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { 
  FiX, 
  FiUser, 
  FiClock, 
  FiCalendar,
  FiCheck,
  FiAlertTriangle
} from 'react-icons/fi'
import type { JobOrder } from '@/types/jobOrder'
import TechnicianScheduleView from './TechnicianScheduleView'

interface JobReassignmentModalProps {
  jobOrder: JobOrder
  onClose: () => void
  onSuccess: (responseData?: any) => void
}

interface Technician {
  _id: string
  name: string
  level?: number
}

export default function JobReassignmentModal({
  jobOrder,
  onClose,
  onSuccess
}: JobReassignmentModalProps) {
  const [selectedTechnician, setSelectedTechnician] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [startTime, setStartTime] = useState<string>('')
  const [endTime, setEndTime] = useState<string>('')
  const [duration, setDuration] = useState<number>(2) // Duration in hours
  const [availableTechnicians, setAvailableTechnicians] = useState<Technician[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)


  // Calculate end time based on start time and duration
  const calculateEndTime = useCallback((start: string, durationHours: number = 1) => {
    const [hours, minutes] = start.split(':').map(Number)
    const startMinutes = hours * 60 + minutes
    const endMinutes = startMinutes + (durationHours * 60)
    
    const endHours = Math.floor(endMinutes / 60)
    const endMins = endMinutes % 60
    
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
  }, [])

  // Calculate duration from current time range
  const calculateDuration = useCallback((start: string, end: string) => {
    const [startHours, startMinutes] = start.split(':').map(Number)
    const [endHours, endMinutes] = end.split(':').map(Number)
    
    const startTotalMinutes = startHours * 60 + startMinutes
    const endTotalMinutes = endHours * 60 + endMinutes
    
    return (endTotalMinutes - startTotalMinutes) / 60
  }, [])

  // Initialize form with current job data
  useEffect(() => {
    if (jobOrder) {
      // Set date to tomorrow by default (or today if it's a carried-over job)
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(today.getDate() + 1)
      
      // If it's a carried-over job, use tomorrow. If it's a current job, use today
      const defaultDate = jobOrder.carriedOver ? tomorrow : today
      const dateStr = defaultDate.toISOString().split('T')[0]
      
      setSelectedDate(dateStr)
      
      setStartTime(jobOrder.timeRange.start)
      setEndTime(jobOrder.timeRange.end)
      
      // Calculate and set duration
      const currentDuration = calculateDuration(jobOrder.timeRange.start, jobOrder.timeRange.end)
      setDuration(currentDuration)
      
      if (jobOrder.assignedTechnician) {
        setSelectedTechnician(jobOrder.assignedTechnician._id)
      }
    }
  }, [jobOrder, calculateDuration])

  // Fetch available technicians
  useEffect(() => {
    const fetchTechnicians = async () => {
      if (!selectedDate || !startTime || !endTime) {
        return
      }
      
      try {
        setLoading(true)
        const url = `/api/job-orders/technicians/available?date=${selectedDate}&startTime=${startTime}&endTime=${endTime}`
        
        const response = await fetch(url, { credentials: 'include' })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('❌ Technician fetch error response:', errorText)
          throw new Error('Failed to fetch available technicians')
        }
        
        const data = await response.json()
        setAvailableTechnicians(data.technicians || [])
      } catch (error) {
        console.error('💥 Error fetching technicians:', error)
        toast.error('Failed to fetch available technicians')
      } finally {
        setLoading(false)
      }
    }

    fetchTechnicians()
  }, [selectedDate, startTime, endTime])

  // Update end time when start time or duration changes
  useEffect(() => {
    if (startTime && duration > 0) {
      const newEndTime = calculateEndTime(startTime, duration)
      setEndTime(newEndTime)
    }
  }, [startTime, duration, calculateEndTime])


  const handleSubmit = async () => {

    if (!selectedTechnician) {
      toast.error('Please select a technician')
      return
    }

    if (!selectedDate || !startTime || !endTime) {
      toast.error('Please select date and time range')
      return
    }

    const requestBody = {
      assignedTechnician: selectedTechnician,
      timeRange: { start: startTime, end: endTime },
      date: selectedDate,
      status: 'OG', // Set status to On Going
      // Remove from carry-over queue but preserve carry-over chain for display
      carriedOver: false // Remove from carry-over queue since it's now reassigned
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/job-orders/${jobOrder._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ API Error Response:', errorData)
        throw new Error(errorData.error || 'Failed to reassign job')
      }

      const responseData = await response.json()

      toast.success(`Job ${jobOrder.jobNumber} reassigned successfully!`, {
        duration: 4000,
        style: {
          background: '#10B981',
          color: 'white',
          fontSize: '14px',
          fontWeight: '500'
        }
      })
      
      // Pass the reassigned job data to onSuccess for optimistic update
      onSuccess(responseData)
      
      // Small delay to let user see the success message
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (error) {
      console.error('💥 Error reassigning job:', error)
      if (error instanceof Error) {
        console.error('💥 Error message:', error.message)
        toast.error(error.message)
      } else {
        console.error('💥 Unknown error:', error)
        toast.error('Failed to reassign job')
      }
    } finally {
      setSubmitting(false)
    }
  }


  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Reassign Job Order</h2>
            <p className="text-sm text-gray-600 mt-1">Job #{jobOrder.jobNumber} - {jobOrder.plateNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Job Summary */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Job Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Job Number:</span>
              <span className="ml-2 text-gray-900">{jobOrder.jobNumber}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Plate Number:</span>
              <span className="ml-2 text-gray-900">{jobOrder.plateNumber}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">VIN:</span>
              <span className="ml-2 text-gray-900 font-mono text-xs">{jobOrder.vin}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Current Status:</span>
              <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                jobOrder.status === 'UA' ? 'bg-gray-100 text-gray-800' :
                jobOrder.status === 'OG' ? 'bg-green-100 text-green-800' :
                jobOrder.carriedOver ? 'bg-orange-100 text-orange-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {jobOrder.carriedOver ? 'Carried Over' : jobOrder.status}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Current Technician:</span>
              <span className="ml-2 text-gray-900">
                {jobOrder.assignedTechnician ? jobOrder.assignedTechnician.name : 'Unassigned'}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Current Time:</span>
              <span className="ml-2 text-gray-900">
                {jobOrder.timeRange.start} - {jobOrder.timeRange.end}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Form Controls */}
            <div className="lg:col-span-1 space-y-6">
              {/* Date Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <FiCalendar className="inline mr-2" size={16} />
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min={new Date().toISOString().split('T')[0]}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0]
                      setSelectedDate(today)
                    }}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => {
                      const tomorrow = new Date()
                      tomorrow.setDate(tomorrow.getDate() + 1)
                      setSelectedDate(tomorrow.toISOString().split('T')[0])
                    }}
                    className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                  >
                    Tomorrow
                  </button>
                </div>
              </div>

              {/* Time Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <FiClock className="inline mr-2" size={16} />
                  Start Time
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <span className="text-xs text-gray-500">or select from schedule</span>
                </div>
              </div>

              {/* Duration Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Duration (hours)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.5"
                    max="8"
                    step="0.5"
                    value={duration}
                    onChange={(e) => setDuration(parseFloat(e.target.value) || 1)}
                    className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="flex gap-1 flex-wrap">
                    {[1, 2, 3, 4, 6, 8].map((hours) => (
                      <button
                        key={hours}
                        onClick={() => setDuration(hours)}
                        className={`px-2 py-1 text-xs rounded border transition-all ${
                          duration === hours
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {hours}h
                      </button>
                    ))}
                  </div>
                </div>
                {startTime && endTime && (
                  <div className="mt-1 text-xs text-gray-600">
                    <span className="font-medium">End:</span> {endTime}
                  </div>
                )}
              </div>

              {/* Technician Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <FiUser className="inline mr-2" size={16} />
                  Technician
                </label>
                {loading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    <span className="ml-2 text-xs text-gray-600">Loading...</span>
                  </div>
                ) : (
                  <select
                    value={selectedTechnician}
                    onChange={(e) => setSelectedTechnician(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="">Choose technician...</option>
                    {availableTechnicians.map((tech) => (
                      <option key={tech._id} value={tech._id}>
                        {tech.name} {tech.level ? `(Level ${tech.level})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {!loading && availableTechnicians.length === 0 && (
                  <div className="text-center py-2 text-gray-500 text-xs mt-1">
                    <FiAlertTriangle className="inline mr-1" size={12} />
                    No technicians available for selected time
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Schedule View */}
            <div className="lg:col-span-2">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 h-full">
                <h4 className="font-semibold mb-3 text-gray-900">Technician Schedule</h4>
                {selectedTechnician ? (
                  <div>
                    <div className="mb-3">
                      <p className="text-sm text-gray-600">
                        Click on an available time slot to set the start time.
                        {duration > 0 && ` Duration: ${duration} hour${duration > 1 ? 's' : ''}`}
                      </p>
                    </div>
                    <TechnicianScheduleView
                      technicianId={selectedTechnician}
                      date={selectedDate}
                      duration={duration * 60} // Convert hours to minutes
                      onTimeSlotSelect={(startTime) => {
                        setStartTime(startTime)
                      }}
                      selectedStart={startTime}
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <div className="text-4xl mb-2">👤</div>
                    <p className="text-sm">Select a technician to view schedule</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedTechnician || !selectedDate || !startTime}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Reassigning...
              </>
            ) : (
              <>
                <FiCheck size={16} />
                Reassign Job
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
