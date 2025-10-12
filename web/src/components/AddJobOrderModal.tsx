'use client'

import { useState, useEffect } from 'react'
import type { CreateJobOrderRequest, Technician, JobItem, Part } from '@/types/jobOrder'
import { useCreateJobOrder, useAvailableTechnicians } from '@/hooks/useJobOrders'

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
  
  const [durationHours, setDurationHours] = useState<number>(2) // Default 2 hours
  
  // Break time settings (from localStorage)
  const [breakStart, setBreakStart] = useState('12:00')
  const [breakEnd, setBreakEnd] = useState('13:00')

  // TanStack Query hooks
  const createJobMutation = useCreateJobOrder()
  
  // Fetch available technicians
  const { data: technicians = [], isLoading: loadingTechnicians } = useAvailableTechnicians(
    formData.date,
    formData.timeRange.start,
    formData.timeRange.end
  )

  // Load break settings
  useEffect(() => {
    const savedBreakStart = localStorage.getItem('breakStart')
    const savedBreakEnd = localStorage.getItem('breakEnd')
    if (savedBreakStart) setBreakStart(savedBreakStart)
    if (savedBreakEnd) setBreakEnd(savedBreakEnd)
  }, [])

  // Calculate end time when start time or duration changes
  useEffect(() => {
    if (formData.timeRange.start && durationHours) {
      const calculatedEnd = calculateEndTimeWithBreak(formData.timeRange.start, durationHours * 60)
      handleInputChange('timeRange', { ...formData.timeRange, end: calculatedEnd })
    }
  }, [formData.timeRange.start, durationHours, breakStart, breakEnd])

  // Calculate end time from start time and duration, accounting for lunch break
  const calculateEndTimeWithBreak = (startTime: string, durationMinutes: number): string => {
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const startDate = new Date()
    startDate.setHours(startHour, startMinute, 0, 0)
    
    const [breakStartHour, breakStartMinute] = breakStart.split(':').map(Number)
    const [breakEndHour, breakEndMinute] = breakEnd.split(':').map(Number)
    
    const breakStartDate = new Date()
    breakStartDate.setHours(breakStartHour, breakStartMinute, 0, 0)
    
    const breakEndDate = new Date()
    breakEndDate.setHours(breakEndHour, breakEndMinute, 0, 0)
    
    const breakDuration = (breakEndDate.getTime() - breakStartDate.getTime()) / (1000 * 60)
    
    // Calculate initial end time without break
    const initialEndDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000)
    
    // Check if work period overlaps with break
    if (startDate < breakEndDate && initialEndDate > breakStartDate) {
      // The break falls within the work period - add break duration to skip it
      const endDate = new Date(initialEndDate.getTime() + breakDuration * 60 * 1000)
      
      const endHour = String(endDate.getHours()).padStart(2, '0')
      const endMinute = String(endDate.getMinutes()).padStart(2, '0')
      return `${endHour}:${endMinute}`
    }
    
    // No overlap with break, return initial calculation
    const endHour = String(initialEndDate.getHours()).padStart(2, '0')
    const endMinute = String(initialEndDate.getMinutes()).padStart(2, '0')
    return `${endHour}:${endMinute}`
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
    
    createJobMutation.mutate(formData, {
      onSuccess: () => {
        onSuccess()
      }
    })
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

          {createJobMutation.isError && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {createJobMutation.error.message}
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

            {/* Time Range with Duration */}
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
                  Duration (hours) *
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={durationHours}
                  onChange={(e) => setDurationHours(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Time (Auto)
                </label>
                <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-600">
                  {formData.timeRange.end || 'Set start time'}
                </div>
                {formData.timeRange.start && formData.timeRange.end && (
                  <p className="text-xs text-gray-500 mt-1">
                    Break: {breakStart}-{breakEnd} included
                  </p>
                )}
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
                <option value="">
                  {loadingTechnicians ? 'Loading technicians...' : 'Select Technician'}
                </option>
                {technicians.map((tech: any) => (
                  <option key={tech._id} value={tech._id}>
                    {tech.name}
                  </option>
                ))}
              </select>
              {technicians.length === 0 && formData.date && formData.timeRange.start && formData.timeRange.end && !loadingTechnicians && (
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
                disabled={createJobMutation.isPending || technicians.length === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-md font-medium transition-colors"
              >
                {createJobMutation.isPending ? 'Creating...' : 'Create Job Order'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
