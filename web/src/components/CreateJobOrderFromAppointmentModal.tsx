'use client'

import { useState, FormEvent } from 'react'
import type { Appointment } from '@/types/appointment'
import type { JobItem, Part } from '@/types/jobOrder'

interface CreateJobOrderFromAppointmentModalProps {
  appointment: Appointment
  onClose: () => void
  onSuccess: () => void
}

export default function CreateJobOrderFromAppointmentModal({
  appointment,
  onClose,
  onSuccess
}: CreateJobOrderFromAppointmentModalProps) {
  const [jobNumber, setJobNumber] = useState('')
  const [vin, setVin] = useState('')
  const [jobList, setJobList] = useState<JobItem[]>([{ description: '', status: 'Unfinished' }])
  const [parts, setParts] = useState<Part[]>([{ name: '', availability: 'Available' }])
  const [setActualTime, setSetActualTime] = useState(false)
  const [actualEndTime, setActualEndTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    
    // Validate
    if (!jobNumber.trim() || !vin.trim()) {
      setError('Job number and VIN are required')
      return
    }
    
    const validJobs = jobList.filter(j => j.description.trim())
    const validParts = parts.filter(p => p.name.trim())
    
    if (validJobs.length === 0) {
      setError('At least one job description is required')
      return
    }
    
    if (validParts.length === 0) {
      setError('At least one part is required')
      return
    }

    setSubmitting(true)
    
    try {
      const requestBody: any = {
        jobNumber: jobNumber.trim(),
        vin: vin.trim(),
        jobList: validJobs,
        parts: validParts
      }
      
      // Add actual end time if checkbox is checked
      if (setActualTime && actualEndTime) {
        requestBody.actualEndTime = actualEndTime
      }
      
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

  return (
    <div className="modal-backdrop">
      <div className="floating-card max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-5 rounded-t-[20px]">
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
                Set actual completion time (if job finished early or late)
              </label>
            </div>
            {setActualTime && (
              <div className="mt-4 pl-8">
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Actual End Time
                </label>
                <input
                  type="time"
                  value={actualEndTime}
                  onChange={(e) => setActualEndTime(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-sm text-gray-600 mt-2 font-medium">
                  Scheduled: {appointment.timeRange.start} - {appointment.timeRange.end}
                </p>
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
              <label className="block text-sm font-semibold text-gray-700">Parts *</label>
              <button
                type="button"
                onClick={addPart}
                className="text-sm text-blue-600 hover:text-blue-700 font-semibold px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
              >
                + Add Part
              </button>
            </div>
            <div className="space-y-3">
              {parts.map((part, index) => (
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
              ))}
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
    </div>
  )
}

