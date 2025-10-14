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
      const response = await fetch(`/api/appointments/${appointment._id}/create-job-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          jobNumber: jobNumber.trim(),
          vin: vin.trim(),
          jobList: validJobs,
          parts: validParts
        })
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
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4">
          <h2 className="text-xl font-bold text-neutral-900">Create Job Order from Appointment</h2>
          <p className="text-sm text-neutral-600 mt-1">
            Plate: {appointment.plateNumber} | Technician: {appointment.assignedTechnician.name}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Job Number and VIN */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Job Number *
              </label>
              <input
                type="text"
                value={jobNumber}
                onChange={(e) => setJobNumber(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                VIN *
              </label>
              <input
                type="text"
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                required
              />
            </div>
          </div>

          {/* Job List */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-neutral-700">Job List *</label>
              <button
                type="button"
                onClick={addJobItem}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add Job
              </button>
            </div>
            <div className="space-y-2">
              {jobList.map((job, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={job.description}
                    onChange={(e) => updateJobItem(index, 'description', e.target.value)}
                    placeholder="Job description"
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={job.status}
                    onChange={(e) => updateJobItem(index, 'status', e.target.value)}
                    className="px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Unfinished">Unfinished</option>
                    <option value="Finished">Finished</option>
                  </select>
                  {jobList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeJobItem(index)}
                      className="px-3 py-2 text-red-600 hover:text-red-700"
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
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-neutral-700">Parts *</label>
              <button
                type="button"
                onClick={addPart}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                + Add Part
              </button>
            </div>
            <div className="space-y-2">
              {parts.map((part, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={part.name}
                    onChange={(e) => updatePart(index, 'name', e.target.value)}
                    placeholder="Part name"
                    className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={part.availability}
                    onChange={(e) => updatePart(index, 'availability', e.target.value)}
                    className="px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Available">Available</option>
                    <option value="Unavailable">Unavailable</option>
                  </select>
                  {parts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePart(index)}
                      className="px-3 py-2 text-red-600 hover:text-red-700"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-[color:var(--color-ford-blue)] hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Job Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

