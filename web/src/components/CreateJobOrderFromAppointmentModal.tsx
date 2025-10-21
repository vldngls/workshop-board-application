'use client'

import React, { useState, FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Appointment } from '@/types/appointment'
import type { JobItem, Part } from '@/types/jobOrder'
import { useUsers, useAvailableTechnicians } from '@/hooks/useJobOrders'

interface CreateJobOrderFromAppointmentModalProps {
  appointment: Appointment
  onClose: () => void
  onSuccess: () => void
  onConflictsResolved?: () => void
}

export default function CreateJobOrderFromAppointmentModal({
  appointment,
  onClose,
  onSuccess,
  onConflictsResolved
}: CreateJobOrderFromAppointmentModalProps) {
  const [jobNumber, setJobNumber] = useState('')
  const [vin, setVin] = useState('')
  const [assignedTechnician, setAssignedTechnician] = useState(appointment.assignedTechnician?._id || '')
  const [serviceAdvisor, setServiceAdvisor] = useState(appointment.serviceAdvisor?._id || '')
  const [jobList, setJobList] = useState<JobItem[]>([{ description: '', status: 'Unfinished' }])
  const [parts, setParts] = useState<Part[]>([])
  const [setActualTime, setSetActualTime] = useState(false)
  const [actualEndTime, setActualEndTime] = useState('')
  const [durationHours, setDurationHours] = useState(2) // Default 2 hours
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [conflicts, setConflicts] = useState<any[]>([])
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [pendingSubmission, setPendingSubmission] = useState<any>(null)
  const [realTimeConflicts, setRealTimeConflicts] = useState<any[]>([])
  const [resolvedJobs, setResolvedJobs] = useState<any[]>([])

  // Fetch technicians and service advisors
  const { data: techniciansData, isLoading: loadingTechnicians } = useUsers({ role: 'technician' })
  const { data: serviceAdvisorsData, isLoading: loadingServiceAdvisors } = useUsers({ role: 'service-advisor' })
  
  const technicians = techniciansData?.users || []
  const serviceAdvisors = serviceAdvisorsData?.users || []

  // Real-time conflict checking when duration or technician changes
  const checkConflictsRealTime = async () => {
    if (setActualTime && assignedTechnician && durationHours) {
      const newTimeRange = {
        start: appointment.timeRange.start,
        end: calculateEndTime(appointment.timeRange.start, durationHours)
      }
      
      const conflictResult = await checkForConflicts(newTimeRange, assignedTechnician)
      if (conflictResult.hasConflicts) {
        console.log('Real-time conflict detected:', conflictResult.conflictingJobs)
        setRealTimeConflicts(conflictResult.conflictingJobs)
      } else {
        setRealTimeConflicts([])
      }
    }
  }

  // Check conflicts when duration or technician changes
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkConflictsRealTime()
    }, 500) // Debounce the check

    return () => clearTimeout(timeoutId)
  }, [durationHours, assignedTechnician, setActualTime])

  // Calculate end time from start time and duration
  const calculateEndTime = (startTime: string, durationHours: number): string => {
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const startDate = new Date()
    startDate.setHours(startHour, startMinute, 0, 0)
    
    const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000)
    
    const endHour = String(endDate.getHours()).padStart(2, '0')
    const endMinute = String(endDate.getMinutes()).padStart(2, '0')
    return `${endHour}:${endMinute}`
  }

  // Check for conflicts when duration or technician changes
  const checkForConflicts = async (timeRange: { start: string, end: string }, technicianId: string) => {
    if (!setActualTime || !technicianId) {
      console.log('Skipping conflict check: setActualTime =', setActualTime, 'technicianId =', technicianId)
      return { hasConflicts: false, conflictingJobs: [] }
    }
    
    console.log('Checking conflicts for:', { timeRange, technicianId })
    
    try {
      const response = await fetch(`/api/appointments/${appointment._id}/check-conflicts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ timeRange, assignedTechnician: technicianId })
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('Conflict check result:', data)
        return data
      } else {
        const errorData = await response.json()
        console.error('Conflict check failed:', errorData)
      }
    } catch (error) {
      console.error('Error checking conflicts:', error)
    }
    
    return { hasConflicts: false, conflictingJobs: [] }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    
    // Validate
    if (!jobNumber.trim() || !vin.trim()) {
      setError('Job number and VIN are required')
      return
    }
    
    if (!assignedTechnician) {
      setError('Please select a technician')
      return
    }
    
    if (!serviceAdvisor) {
      setError('Please select a service advisor')
      return
    }
    
    const validJobs = jobList.filter(j => j.description.trim())
    const validParts = parts.filter(p => p.name.trim())
    
    if (validJobs.length === 0) {
      setError('At least one job description is required')
      return
    }

    const requestBody: any = {
      jobNumber: jobNumber.trim(),
      vin: vin.trim(),
      assignedTechnician: assignedTechnician,
      serviceAdvisor: serviceAdvisor,
      jobList: validJobs,
      parts: validParts.length > 0 ? validParts : undefined
    }
    
    // Add actual end time and override time range if checkbox is checked
    if (setActualTime && actualEndTime) {
      requestBody.actualEndTime = actualEndTime
      // Override the appointment time range with calculated duration
      requestBody.timeRange = {
        start: appointment.timeRange.start,
        end: calculateEndTime(appointment.timeRange.start, durationHours)
      }
      console.log('Setting custom time range:', requestBody.timeRange)
    }

    // Check for conflicts if we're overriding the time range
    if (setActualTime && requestBody.timeRange) {
      const conflictCheck = await checkForConflicts(requestBody.timeRange, assignedTechnician)
      
      if (conflictCheck.hasConflicts && conflictCheck.conflictingJobs.length > 0) {
        setConflicts(conflictCheck.conflictingJobs)
        setPendingSubmission(requestBody)
        setShowConflictDialog(true)
        return
      }
    }

    // Proceed with submission if no conflicts
    await submitJobOrder(requestBody)
  }

  const submitJobOrder = async (requestBody: any) => {
    setSubmitting(true)
    
    try {
      const response = await fetch(`/api/appointments/${appointment._id}/create-job-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create job order')
      }
      
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResolveConflicts = async () => {
    if (!pendingSubmission) return
    
    try {
      // Resolve conflicts by marking conflicting jobs as "For Plotting"
      const conflictingJobIds = conflicts.map(conflict => conflict._id)
      console.log('Resolving conflicts for job IDs:', conflictingJobIds)
      
      const resolveResponse = await fetch(`/api/appointments/${appointment._id}/resolve-conflicts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ conflictingJobIds })
      })
      
      if (!resolveResponse.ok) {
        const errorData = await resolveResponse.json()
        console.error('Failed to resolve conflicts:', errorData)
        throw new Error(errorData.error || 'Failed to resolve conflicts')
      }
      
      const resolveData = await resolveResponse.json()
      console.log('Conflict resolution result:', resolveData)
      setResolvedJobs(resolveData.updatedJobs || [])
      
      // Notify parent component that conflicts were resolved
      if (onConflictsResolved) {
        onConflictsResolved()
      }
      
      // Wait a moment to ensure database updates are committed
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Now proceed with the original submission
      console.log('Proceeding with job order submission:', pendingSubmission)
      await submitJobOrder(pendingSubmission)
      
      // Close conflict dialog
      setShowConflictDialog(false)
      setConflicts([])
      setPendingSubmission(null)
      setResolvedJobs([])
    } catch (err) {
      console.error('Error in handleResolveConflicts:', err)
      setError(err instanceof Error ? err.message : 'Failed to resolve conflicts')
      setShowConflictDialog(false)
    }
  }

  const addJobItem = () => {
    setJobList([...jobList, { description: '', status: 'Unfinished' }])
  }

  const removeJobItem = (index: number) => {
    setJobList(jobList.filter((_, i) => i !== index))
  }

  const updateJobItem = (index: number, field: keyof JobItem, value: string) => {
    const updated = [...jobList]
    updated[index] = { ...updated[index], [field]: value }
    setJobList(updated)
  }

  const addPart = () => {
    setParts([...parts, { name: '', availability: 'Available' }])
  }

  const removePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index))
  }

  const updatePart = (index: number, field: keyof Part, value: string) => {
    const updated = [...parts]
    updated[index] = { ...updated[index], [field]: value }
    setParts(updated)
  }

  return createPortal(
    <div className="modal-backdrop">
      <div className="floating-card max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="sticky top-0 bg-white/60 backdrop-blur-md border-b border-gray-200 px-6 py-5 rounded-t-[20px]">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create Job Order from Appointment</h2>
              <p className="text-sm text-gray-600 mt-1">
                Plate: <span className="font-semibold text-gray-800">{appointment.plateNumber}</span> | 
                Technician: <span className="font-semibold text-gray-800">{appointment.assignedTechnician?.name || 'No technician assigned'}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/20 backdrop-blur-sm border border-red-300/30 text-red-700 px-4 py-3 rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Job Number and VIN */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Job Number *
              </label>
              <input
                type="text"
                value={jobNumber}
                onChange={(e) => setJobNumber(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase font-medium text-gray-900"
                placeholder="Enter job number"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                VIN *
              </label>
              <input
                type="text"
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase font-medium text-gray-900"
                placeholder="Enter VIN number"
                required
              />
            </div>
          </div>

          {/* Technician and Service Advisor Selection */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Assigned Technician *
              </label>
              <select
                value={assignedTechnician}
                onChange={(e) => setAssignedTechnician(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                required
              >
                <option value="">
                  {loadingTechnicians ? 'Loading technicians...' : 'Select Technician'}
                </option>
                {technicians.map((tech: any) => (
                  <option key={tech._id} value={tech._id}>
                    {tech.name} {tech.level ? `(${tech.level})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Service Advisor *
              </label>
              <select
                value={serviceAdvisor}
                onChange={(e) => setServiceAdvisor(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                required
              >
                <option value="">
                  {loadingServiceAdvisors ? 'Loading service advisors...' : 'Select Service Advisor'}
                </option>
                {serviceAdvisors.map((advisor: any) => (
                  <option key={advisor._id} value={advisor._id}>
                    {advisor.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actual Time Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <div className="flex items-center mb-3">
              <input
                type="checkbox"
                id="setActualTime"
                checked={setActualTime}
                onChange={(e) => setSetActualTime(e.target.checked)}
                className="mr-3 w-5 h-5 rounded accent-blue-600"
              />
              <label htmlFor="setActualTime" className="text-sm font-semibold text-gray-800">
                Override appointment duration and set actual completion time
              </label>
            </div>
            {setActualTime && (
              <div className="mt-4 pl-8 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Job Duration (hours)
                    </label>
                    <input
                      type="number"
                      min="0.5"
                      max="8"
                      step="0.5"
                      value={durationHours}
                      onChange={(e) => setDurationHours(parseFloat(e.target.value) || 2)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Actual End Time
                    </label>
                    <input
                      type="time"
                      value={actualEndTime}
                      onChange={(e) => setActualEndTime(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="bg-white/60 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-gray-700 font-medium">
                    <span className="text-gray-600">Original:</span> {appointment.timeRange.start} - {appointment.timeRange.end}
                  </p>
                  <p className="text-sm text-blue-700 font-medium">
                    <span className="text-gray-600">New Duration:</span> {appointment.timeRange.start} - {calculateEndTime(appointment.timeRange.start, durationHours)}
                  </p>
                </div>
                
                {/* Real-time conflict warning */}
                {realTimeConflicts.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center mb-2">
                      <span className="text-red-600 text-lg mr-2">⚠️</span>
                      <p className="text-sm font-semibold text-red-800">
                        Conflicts Detected ({realTimeConflicts.length} job{realTimeConflicts.length > 1 ? 's' : ''})
                      </p>
                    </div>
                    <div className="space-y-1">
                      {realTimeConflicts.map((conflict) => (
                        <p key={conflict._id} className="text-xs text-red-700">
                          • {conflict.jobNumber} ({conflict.plateNumber}) - {conflict.timeRange.start} to {conflict.timeRange.end}
                          {conflict.carriedOver && <span className="text-orange-600 font-medium"> (Carried Over)</span>}
                        </p>
                      ))}
                    </div>
                    <p className="text-xs text-red-600 mt-2 font-medium">
                      These jobs will be marked as "For Plotting" if you proceed.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Job List */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-semibold text-gray-700">Job List *</label>
              <button
                type="button"
                onClick={addJobItem}
                className="text-sm text-blue-600 hover:text-blue-700 font-semibold px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
              >
                + Add Job
              </button>
            </div>
            <div className="space-y-3">
              {jobList.map((job, index) => (
                <div key={index} className="flex gap-3 items-center">
                  <input
                    type="text"
                    value={job.description}
                    onChange={(e) => updateJobItem(index, 'description', e.target.value)}
                    placeholder="Job description"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <select
                    value={job.status}
                    onChange={(e) => updateJobItem(index, 'status', e.target.value)}
                    className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px]"
                  >
                    <option value="Unfinished">Unfinished</option>
                    <option value="Finished">Finished</option>
                  </select>
                  {jobList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeJobItem(index)}
                      className="px-3 py-3 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors"
                      title="Remove job"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Parts */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-semibold text-gray-700">Parts</label>
              <button
                type="button"
                onClick={addPart}
                className="text-sm text-blue-600 hover:text-blue-700 font-semibold px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
              >
                + Add Part
              </button>
            </div>
            <div className="space-y-3">
              {parts.length > 0 ? (
                parts.map((part, index) => (
                  <div key={index} className="flex gap-3 items-center">
                    <input
                      type="text"
                      value={part.name}
                      onChange={(e) => updatePart(index, 'name', e.target.value)}
                      placeholder="Part name"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <select
                      value={part.availability}
                      onChange={(e) => updatePart(index, 'availability', e.target.value)}
                      className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[140px]"
                    >
                      <option value="Available">Available</option>
                      <option value="Unavailable">Unavailable</option>
                    </select>
                    {parts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePart(index)}
                        className="px-3 py-3 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors"
                        title="Remove part"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 italic">No parts added (optional)</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold text-gray-700 transition-all duration-200 border border-gray-300 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Job Order'}
            </button>
          </div>
        </form>
      </div>

      {/* Conflict Resolution Dialog */}
      {showConflictDialog && (
        <div className="modal-backdrop">
          <div className="floating-card max-w-2xl w-full animate-fade-in">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-red-600">⚠️ Scheduling Conflict Detected</h3>
                <button
                  onClick={() => {
                    setShowConflictDialog(false)
                    setConflicts([])
                    setPendingSubmission(null)
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  The extended appointment duration will overlap with the following job orders. 
                  These jobs will be marked as "For Plotting" and need to be reassigned.
                </p>
                
                <div className="space-y-3">
                  {conflicts.map((conflict) => (
                    <div key={conflict._id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-gray-900">{conflict.jobNumber}</h4>
                          <p className="text-sm text-gray-600">Plate: {conflict.plateNumber}</p>
                          <p className="text-sm text-gray-600">
                            Time: {conflict.timeRange.start} - {conflict.timeRange.end}
                          </p>
                          <p className="text-sm text-gray-600">
                            Status: {conflict.status} | Source: {conflict.sourceType}
                            {conflict.carriedOver && <span className="text-orange-600 font-medium"> (Carried Over)</span>}
                          </p>
                        </div>
                        <span className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded text-xs font-medium">
                          Will be marked as "For Plotting"
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Show resolved jobs if any */}
              {resolvedJobs.length > 0 && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-semibold text-green-800 mb-2">
                    ✅ Successfully resolved conflicts:
                  </p>
                  <div className="space-y-1">
                    {resolvedJobs.map((job) => (
                      <p key={job._id} className="text-xs text-green-700">
                        • {job.jobNumber} → Marked as "For Plotting"
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowConflictDialog(false)
                    setConflicts([])
                    setPendingSubmission(null)
                    setResolvedJobs([])
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold text-gray-700 transition-all duration-200 border border-gray-300 hover:shadow-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolveConflicts}
                  disabled={submitting}
                  className="flex-1 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Resolving...' : 'Resolve Conflicts & Proceed'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

