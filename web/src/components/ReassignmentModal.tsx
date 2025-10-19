'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import type { JobOrderWithDetails } from '@/utils/timetableUtils'

interface ReassignmentModalProps {
  job: JobOrderWithDetails
  breakStart: string
  breakEnd: string
  calculateEndTime: (startTime: string, duration: number) => string
  onClose: () => void
  onSuccess: () => void
}

export default function ReassignmentModal({
  job,
  breakStart,
  breakEnd,
  calculateEndTime,
  onClose,
  onSuccess
}: ReassignmentModalProps) {
  const [startTime, setStartTime] = useState(job.timeRange.start)
  const [duration, setDuration] = useState(120) // Default 2 hours in minutes
  const [endTime, setEndTime] = useState(calculateEndTime(job.timeRange.start, 120))
  const [selectedTechnician, setSelectedTechnician] = useState('')
  const [allTechnicians, setAllTechnicians] = useState<any[]>([])
  const [technicianSchedule, setTechnicianSchedule] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  // Fetch all technicians on mount
  useEffect(() => {
    const fetchTechnicians = async () => {
      try {
        const response = await fetch('/api/users', { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          const techs = (data.users || []).filter((u: any) => u.role === 'technician')
          setAllTechnicians(techs)
        }
      } catch (error) {
        console.error('Error fetching technicians:', error)
      }
    }
    fetchTechnicians()
  }, [])

  // Fetch selected technician's schedule
  useEffect(() => {
    const fetchSchedule = async () => {
      if (!selectedTechnician) {
        setTechnicianSchedule([])
        return
      }

      setLoading(true)
      try {
        const response = await fetch(
          `/api/job-orders?date=${selectedDate}&technician=${selectedTechnician}&limit=100`,
          { credentials: 'include' }
        )
        if (response.ok) {
          const data = await response.json()
          // Filter out the current job being reassigned
          const schedule = (data.jobOrders || []).filter((j: any) => j._id !== job._id)
          setTechnicianSchedule(schedule)
        }
      } catch (error) {
        console.error('Error fetching schedule:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchSchedule()
  }, [selectedTechnician, selectedDate, job._id])

  // Recalculate end time when start time or duration changes
  useEffect(() => {
    if (startTime && duration) {
      const calculated = calculateEndTime(startTime, duration)
      setEndTime(calculated)
    }
  }, [startTime, duration, calculateEndTime])

  // Generate time slots (7 AM to 6 PM in 30-min intervals)
  const generateTimeSlots = () => {
    const slots = []
    for (let hour = 7; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        if (hour === 18 && minute > 0) break // Stop at 6:00 PM
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        slots.push(time)
      }
    }
    return slots
  }

  const timeSlots = generateTimeSlots()

  // Check if a time slot is occupied
  const isSlotOccupied = (slotTime: string) => {
    const [slotHour, slotMin] = slotTime.split(':').map(Number)
    const slotMinutes = slotHour * 60 + slotMin

    return technicianSchedule.some(job => {
      const [startHour, startMin] = job.timeRange.start.split(':').map(Number)
      const [endHour, endMin] = job.timeRange.end.split(':').map(Number)
      const jobStart = startHour * 60 + startMin
      const jobEnd = endHour * 60 + endMin
      
      return slotMinutes >= jobStart && slotMinutes < jobEnd
    })
  }

  // Get job at specific time slot
  const getJobAtSlot = (slotTime: string) => {
    const [slotHour, slotMin] = slotTime.split(':').map(Number)
    const slotMinutes = slotHour * 60 + slotMin

    return technicianSchedule.find(job => {
      const [startHour, startMin] = job.timeRange.start.split(':').map(Number)
      const [endHour, endMin] = job.timeRange.end.split(':').map(Number)
      const jobStart = startHour * 60 + startMin
      const jobEnd = endHour * 60 + endMin
      
      return slotMinutes >= jobStart && slotMinutes < jobEnd
    })
  }

  // Check if proposed time conflicts
  const hasConflict = () => {
    if (!startTime || !endTime) return false

    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    const proposedStart = startHour * 60 + startMin
    const proposedEnd = endHour * 60 + endMin

    return technicianSchedule.some(job => {
      const [jobStartHour, jobStartMin] = job.timeRange.start.split(':').map(Number)
      const [jobEndHour, jobEndMin] = job.timeRange.end.split(':').map(Number)
      const jobStart = jobStartHour * 60 + jobStartMin
      const jobEnd = jobEndHour * 60 + jobEndMin
      
      return proposedStart < jobEnd && proposedEnd > jobStart
    })
  }

  const handleSlotClick = (slotTime: string) => {
    if (!isSlotOccupied(slotTime)) {
      setStartTime(slotTime)
    }
  }

  const handleSubmit = async () => {
    if (!selectedTechnician) {
      toast.error('Please select a technician')
      return
    }

    if (hasConflict()) {
      toast.error('Time slot conflicts with existing job')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/job-orders/${job._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          assignedTechnician: selectedTechnician,
          timeRange: { start: startTime, end: endTime },
          date: selectedDate,
          carriedOver: false
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to reassign job')
      }

      toast.success('Job reassigned successfully!')
      onSuccess()
    } catch (error) {
      console.error('Error reassigning job:', error)
      if (error instanceof Error) {
        toast.error(error.message)
      } else {
        toast.error('Failed to reassign job')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop">
      <div className="floating-card max-w-6xl w-full max-h-[95vh] overflow-y-auto animate-fade-in">
        <div className="p-6">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-xl font-bold text-gray-900">Reassign Job Order - Visual Schedule</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors">
              ×
            </button>
          </div>

          {/* Job Info */}
          <div className="bg-orange-500/20 backdrop-blur-sm border border-orange-300/30 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-orange-900">{job.jobNumber}</h4>
            <p className="text-sm text-gray-700 font-medium">{job.plateNumber} - {job.vin}</p>
            <p className="text-xs text-gray-600 mt-1 font-medium">
              Current: {job.timeRange.start} - {job.timeRange.end} ({job.assignedTechnician ? job.assignedTechnician.name : 'Unassigned'})
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Controls */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Technician
                </label>
                <select
                  value={selectedTechnician}
                  onChange={(e) => setSelectedTechnician(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose technician...</option>
                  {allTechnicians.map((tech) => (
                    <option key={tech._id} value={tech._id}>
                      {tech.name} {tech.level && `(${tech.level})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={duration / 60}
                  onChange={(e) => setDuration(parseFloat(e.target.value) * 60)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Auto-calculated with break</p>
              </div>

              {hasConflict() && (
                <div className="bg-red-500/20 backdrop-blur-sm border border-red-300/30 rounded-xl p-3">
                  <p className="text-sm text-red-800 font-bold">⚠️ Time Conflict Detected</p>
                  <p className="text-xs text-red-600 mt-1 font-medium">Selected time overlaps with existing job</p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-2.5 bg-white/50 hover:bg-white/70 rounded-xl font-semibold transition-all border border-white/50 hover:shadow-lg hover:-translate-y-0.5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !selectedTechnician || hasConflict()}
                  className="flex-1 px-6 py-2.5 ford-gradient disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                >
                  {submitting ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>

            {/* Right: Visual Timeline */}
            <div className="lg:col-span-2">
              <div className="bg-white/40 backdrop-blur-sm rounded-xl p-4 border border-white/40">
                <h4 className="font-semibold mb-3">
                  {selectedTechnician ? (
                    <>Schedule for {allTechnicians.find(t => t._id === selectedTechnician)?.name}</>
                  ) : (
                    'Select a technician to view schedule'
                  )}
                </h4>

                {loading ? (
                  <div className="text-center py-8 text-gray-500">Loading schedule...</div>
                ) : !selectedTechnician ? (
                  <div className="text-center py-8 text-gray-400">
                    <div className="text-4xl mb-2">👤</div>
                    <p>Select a technician to see their availability</p>
                  </div>
                ) : (
                  <>
                    {/* Legend */}
                    <div className="flex gap-4 mb-3 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-green-200 border border-green-400 rounded"></div>
                        <span>Available</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-red-200 border border-red-400 rounded"></div>
                        <span>Occupied</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-blue-200 border-2 border-blue-600 rounded"></div>
                        <span>Your Selection</span>
                      </div>
                    </div>

                    {/* Timeline Grid */}
                    <div className="grid grid-cols-4 gap-2 max-h-[500px] overflow-y-auto">
                      {timeSlots.map((slot) => {
                        const occupied = isSlotOccupied(slot)
                        const jobAtSlot = getJobAtSlot(slot)
                        const isSelected = slot === startTime
                        const [slotHour, slotMin] = slot.split(':').map(Number)
                        const slotMinutes = slotHour * 60 + slotMin
                        const [startHour, startMin] = startTime.split(':').map(Number)
                        const [endHour, endMin] = endTime.split(':').map(Number)
                        const selectedStart = startHour * 60 + startMin
                        const selectedEnd = endHour * 60 + endMin
                        const isInSelectedRange = slotMinutes >= selectedStart && slotMinutes < selectedEnd

                        return (
                          <button
                            key={slot}
                            onClick={() => handleSlotClick(slot)}
                            disabled={occupied}
                            className={`
                              p-2 text-xs rounded border-2 transition-all
                              ${occupied 
                                ? 'bg-red-100 border-red-300 text-red-800 cursor-not-allowed' 
                                : isInSelectedRange
                                  ? 'bg-blue-200 border-blue-600 text-blue-900 font-bold'
                                  : 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200'
                              }
                              ${isSelected ? 'ring-2 ring-blue-500' : ''}
                            `}
                            title={occupied ? `Occupied: ${jobAtSlot?.jobNumber}` : 'Available - Click to select'}
                          >
                            <div className="font-semibold">{slot}</div>
                            {occupied && jobAtSlot && (
                              <div className="text-[10px] truncate mt-1">
                                {jobAtSlot.jobNumber}
                              </div>
                            )}
                            {isSelected && (
                              <div className="text-[10px] mt-1">START</div>
                            )}
                          </button>
                        )
                      })}
                    </div>

                    {/* Existing Jobs Summary */}
                    {technicianSchedule.length > 0 && (
                      <div className="mt-4 p-3 bg-white/60 backdrop-blur-sm rounded-xl border border-white/50">
                        <h5 className="font-bold text-sm mb-2">Existing Jobs ({technicianSchedule.length})</h5>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {technicianSchedule.map((j: any) => (
                            <div key={j._id} className="text-xs flex justify-between items-center p-2 bg-white/40 rounded-xl">
                              <span className="font-bold">{j.jobNumber}</span>
                              <span className="text-gray-700 font-medium">{j.timeRange.start} - {j.timeRange.end}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
