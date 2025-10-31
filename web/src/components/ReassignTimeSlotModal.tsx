'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { FiRefreshCw, FiStar } from 'react-icons/fi'
import type { JobOrder, Technician } from '@/types/jobOrder'

interface ReassignTimeSlotModalProps {
  onClose: () => void
  technicianId: string
  technicianName: string
  date: string
  startTime: string
  endTime: string
  onJobAssigned: (responseData?: any) => void
}

interface AvailableJob extends JobOrder {
  originalDuration: number
  canFit: boolean
  suggestedDuration: number
}

export default function ReassignTimeSlotModal({
  onClose,
  technicianId,
  technicianName,
  date,
  startTime,
  endTime,
  onJobAssigned
}: ReassignTimeSlotModalProps) {
  const [availableJobs, setAvailableJobs] = useState<AvailableJob[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [adjustedDuration, setAdjustedDuration] = useState<number>(30)
  const [assigning, setAssigning] = useState(false)
  const [showCreateNew, setShowCreateNew] = useState(false)
  const [availableMinutes, setAvailableMinutes] = useState(0)

  useEffect(() => {
    fetchAvailableJobs()
  }, [date, startTime, endTime])

  const fetchAvailableJobs = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/job-orders/available-for-slot?date=${date}&startTime=${startTime}&endTime=${endTime}`
      )
      if (!response.ok) throw new Error('Failed to fetch available jobs')
      const data = await response.json()
      setAvailableJobs(data.jobs || [])
      setAvailableMinutes(data.availableMinutes || 0)
    } catch (error) {
      console.error('Error fetching available jobs:', error)
      toast.error('Failed to fetch available jobs')
    } finally {
      setLoading(false)
    }
  }

  const calculateEndTime = (start: string, durationMinutes: number): string => {
    const [hour, minute] = start.split(':').map(Number)
    const totalMinutes = hour * 60 + minute + durationMinutes
    const endHour = Math.floor(totalMinutes / 60)
    const endMinute = totalMinutes % 60
    return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`
  }

  const handleSelectJob = (job: AvailableJob) => {
    setSelectedJobId(job._id)
    setAdjustedDuration(job.suggestedDuration)
  }

  const handleAssignJob = async () => {
    if (!selectedJobId) return

    try {
      setAssigning(true)
      const calculatedEndTime = calculateEndTime(startTime, adjustedDuration)

      const response = await fetch(`/api/job-orders/${selectedJobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedTechnician: technicianId,
          timeRange: {
            start: startTime,
            end: calculatedEndTime
          },
          status: 'OG',
          date: date
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to assign job')
      }

      const responseData = await response.json()
      toast.success('Job assigned successfully!')
      onJobAssigned(responseData)
      onClose()
    } catch (error: any) {
      console.error('Error assigning job:', error)
      toast.error(error.message || 'Failed to assign job')
    } finally {
      setAssigning(false)
    }
  }

  const formatMinutesToHours = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`
    if (hours > 0) return `${hours}h`
    return `${mins}m`
  }

  const formatTime = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  return createPortal(
    <div className="modal-backdrop">
      <div className="floating-card max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Assign Other Job?</h3>
              <p className="text-sm text-gray-700 mt-2 font-medium">
                Technician: <span className="font-bold">{technicianName}</span>
              </p>
              <p className="text-sm text-gray-700 font-medium">
                Available Time: <span className="font-bold">{formatTime(startTime)} - {formatTime(endTime)}</span>
                <span className="ml-2 text-blue-600 font-bold">({formatMinutesToHours(availableMinutes)} available)</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors"
            >
              ×
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="text-gray-600">Loading available jobs...</div>
            </div>
          ) : (
            <>
              {/* Available Jobs List */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-4">Available Job Orders</h4>
                
                {availableJobs.length === 0 ? (
                  <div className="text-center py-8 bg-white/50 backdrop-blur-sm rounded-xl border border-white/40">
                    <p className="text-gray-700 font-medium">No unassigned jobs available</p>
                    <p className="text-sm text-gray-600 mt-2 font-medium">You can create a new job order</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {availableJobs.map((job) => (
                      <div
                        key={job._id}
                        onClick={() => handleSelectJob(job)}
                        className={`border-2 rounded-xl p-4 cursor-pointer transition-all backdrop-blur-sm ${
                          selectedJobId === job._id
                            ? 'border-blue-500/50 bg-blue-500/20 shadow-lg'
                            : 'border-white/40 bg-white/50 hover:bg-white/50 hover:shadow-lg hover:-translate-y-1'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {job.isImportant && (
                                <FiStar size={18} color="#eab308" />
                              )}
                              {job.carriedOver && (
                                <FiRefreshCw size={14} color="#ef4444" />
                              )}
                              <h5 className="font-bold text-gray-900">{job.jobNumber}</h5>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                job.status === 'WP' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {job.status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{job.plateNumber} | {job.vin}</p>
                            <div className="flex gap-4 mt-2 text-xs text-gray-500">
                              <span>Tasks: {job.jobList.filter(t => t.status === 'Finished').length}/{job.jobList.length}</span>
                              <span>Parts: {job.parts.filter(p => p.availability === 'Available').length}/{job.parts.length}</span>
                              <span>Original Duration: {formatMinutesToHours(job.originalDuration)}</span>
                            </div>
                          </div>
                          <div className="ml-4">
                            {job.canFit ? (
                              <span className="text-green-600 text-sm font-medium">✓ Fits</span>
                            ) : (
                              <span className="text-orange-600 text-sm font-medium">Adjust needed</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Job Details */}
              {selectedJobId && (
                <div className="bg-blue-500/20 backdrop-blur-sm border border-blue-300/30 rounded-xl p-4 mb-6">
                  <h4 className="font-semibold text-blue-900 mb-3">Adjust Time Slot</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Time
                      </label>
                      <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                        {formatTime(startTime)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Duration (minutes) *
                      </label>
                      <input
                        type="number"
                        value={adjustedDuration}
                        onChange={(e) => setAdjustedDuration(parseInt(e.target.value) || 30)}
                        min="30"
                        max={availableMinutes}
                        step="30"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Max: {formatMinutesToHours(availableMinutes)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Calculated End Time
                    </label>
                    <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700">
                      {formatTime(calculateEndTime(startTime, adjustedDuration))}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center gap-4 pt-4 border-t border-white/30">
                <button
                  onClick={() => setShowCreateNew(true)}
                  className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-600 text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5"
                >
                  + Create New Job Order
                </button>
                
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-700 bg-white/50 hover:bg-white/60 rounded-xl font-semibold transition-all border border-white/50 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleAssignJob}
                    disabled={!selectedJobId || assigning || adjustedDuration <= 0 || adjustedDuration > availableMinutes}
                    className="px-6 py-2 bg-gradient-to-r from-ford-blue to-ford-blue-light hover:from-ford-blue-light hover:to-ford-blue disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    {assigning ? 'Assigning...' : 'Assign Selected Job'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Note about creating new job */}
          {showCreateNew && (
            <div className="mt-4 p-4 bg-yellow-500/20 backdrop-blur-sm border border-yellow-300/30 rounded-xl">
              <p className="text-sm text-yellow-800 font-medium">
                <strong>Note:</strong> Please use the "Add Job Order" button in the main interface to create a new job order with this time slot ({formatTime(startTime)} - {formatTime(endTime)}).
              </p>
              <button
                onClick={() => {
                  onClose()
                  // Could trigger parent to open Add Job Order modal with pre-filled time
                }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-semibold hover:underline"
              >
                Close and create new job →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

