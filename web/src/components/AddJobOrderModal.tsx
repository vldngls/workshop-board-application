'use client'

import { useState, useEffect } from 'react'
import type { CreateJobOrderRequest, Technician, JobItem, Part } from '@/types/jobOrder'

interface AddJobOrderModalProps {
  onClose: () => void
  onSuccess: () => void
}

export default function AddJobOrderModal({ onClose, onSuccess }: AddJobOrderModalProps) {
  const [formData, setFormData] = useState<CreateJobOrderRequest>({
    jobNumber: '',
    assignedTechnician: '',
    plateNumber: '',
    vin: '',
    timeRange: { start: '', end: '' },
    jobList: [{ description: '', status: 'Unfinished' }],
    parts: [{ name: '', availability: 'Available' }],
    date: new Date().toISOString().split('T')[0]
  })
  
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState<string>('')

  // Calculate duration when time range changes
  useEffect(() => {
    if (formData.timeRange.start && formData.timeRange.end) {
      const startTime = new Date(`2000-01-01T${formData.timeRange.start}:00`)
      const endTime = new Date(`2000-01-01T${formData.timeRange.end}:00`)
      const diffMs = endTime.getTime() - startTime.getTime()
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      setDuration(`${diffHours}h ${diffMinutes}m`)
    } else {
      setDuration('')
    }
  }, [formData.timeRange.start, formData.timeRange.end])

  // Fetch available technicians when date or time range changes
  useEffect(() => {
    if (formData.date && formData.timeRange.start && formData.timeRange.end) {
      fetchAvailableTechnicians()
    }
  }, [formData.date, formData.timeRange.start, formData.timeRange.end])

  const fetchAvailableTechnicians = async () => {
    try {
      const response = await fetch(
        `/api/job-orders/technicians/available?date=${formData.date}&startTime=${formData.timeRange.start}&endTime=${formData.timeRange.end}`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch available technicians')
      }
      const data = await response.json()
      setTechnicians(data.technicians || [])
    } catch (err) {
      console.error('Error fetching technicians:', err)
      setTechnicians([])
    }
  }

  const handleInputChange = (field: keyof CreateJobOrderRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleJobItemChange = (index: number, field: keyof JobItem, value: any) => {
    const newJobList = [...formData.jobList]
    newJobList[index] = { ...newJobList[index], [field]: value }
    setFormData(prev => ({ ...prev, jobList: newJobList }))
  }

  const handlePartChange = (index: number, field: keyof Part, value: any) => {
    const newParts = [...formData.parts]
    newParts[index] = { ...newParts[index], [field]: value }
    setFormData(prev => ({ ...prev, parts: newParts }))
  }

  const addJobItem = () => {
    setFormData(prev => ({
      ...prev,
      jobList: [...prev.jobList, { description: '', status: 'Unfinished' }]
    }))
  }

  const removeJobItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      jobList: prev.jobList.filter((_, i) => i !== index)
    }))
  }

  const addPart = () => {
    setFormData(prev => ({
      ...prev,
      parts: [...prev.parts, { name: '', availability: 'Available' }]
    }))
  }

  const removePart = (index: number) => {
    setFormData(prev => ({
      ...prev,
      parts: prev.parts.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/job-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create job order')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Add New Job Order</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Number *
                </label>
                <input
                  type="text"
                  value={formData.jobNumber}
                  onChange={(e) => handleInputChange('jobNumber', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Vehicle Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plate Number *
                </label>
                <input
                  type="text"
                  value={formData.plateNumber}
                  onChange={(e) => handleInputChange('plateNumber', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VIN *
                </label>
                <input
                  type="text"
                  value={formData.vin}
                  onChange={(e) => handleInputChange('vin', e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  value={formData.timeRange.start}
                  onChange={(e) => handleInputChange('timeRange', { ...formData.timeRange, start: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  value={formData.timeRange.end}
                  onChange={(e) => handleInputChange('timeRange', { ...formData.timeRange, end: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration
                </label>
                <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-600">
                  {duration || 'Select time range'}
                </div>
              </div>
            </div>

            {/* Assigned Technician */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned Technician *
              </label>
              <select
                value={formData.assignedTechnician}
                onChange={(e) => handleInputChange('assignedTechnician', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Technician</option>
                {technicians.map((tech) => (
                  <option key={tech._id} value={tech._id}>
                    {tech.name}
                  </option>
                ))}
              </select>
              {technicians.length === 0 && formData.date && formData.timeRange.start && formData.timeRange.end && (
                <p className="text-sm text-red-600 mt-1">No technicians available for this time slot</p>
              )}
            </div>

            {/* Job List */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Job List *
                </label>
                <button
                  type="button"
                  onClick={addJobItem}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  + Add Job
                </button>
              </div>
              <div className="space-y-2">
                {formData.jobList.map((job, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <select
                      value={job.status}
                      onChange={(e) => handleJobItemChange(index, 'status', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Unfinished">Unfinished</option>
                      <option value="Finished">Finished</option>
                    </select>
                    <input
                      type="text"
                      value={job.description}
                      onChange={(e) => handleJobItemChange(index, 'description', e.target.value)}
                      placeholder="Job description"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    {formData.jobList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeJobItem(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Parts */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Parts *
                </label>
                <button
                  type="button"
                  onClick={addPart}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  + Add Part
                </button>
              </div>
              <div className="space-y-2">
                {formData.parts.map((part, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <select
                      value={part.availability}
                      onChange={(e) => handlePartChange(index, 'availability', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Available">Available</option>
                      <option value="Unavailable">Unavailable</option>
                    </select>
                    <input
                      type="text"
                      value={part.name}
                      onChange={(e) => handlePartChange(index, 'name', e.target.value)}
                      placeholder="Part name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    {formData.parts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePart(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || technicians.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-md font-medium transition-colors"
              >
                {loading ? 'Creating...' : 'Create Job Order'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
