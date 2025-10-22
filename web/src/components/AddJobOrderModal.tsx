'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { CreateJobOrderRequest, Technician, JobItem, Part } from '@/types/jobOrder'
import { useCreateJobOrder, useAvailableTechnicians, useUsers } from '@/hooks/useJobOrders'
import TechnicianScheduleView from './TechnicianScheduleView'

interface AddJobOrderModalProps {
  onClose: () => void
  onSuccess: () => void
}

export default function AddJobOrderModal({ onClose, onSuccess }: AddJobOrderModalProps) {
  const [formData, setFormData] = useState<CreateJobOrderRequest>({
    jobNumber: '',
    assignedTechnician: '',
    serviceAdvisor: '',
    plateNumber: '',
    vin: '',
    timeRange: { start: '', end: '' },
    jobList: [{ description: '', status: 'Unfinished' }],
    parts: [],
    date: new Date().toISOString().split('T')[0],
    status: 'OG'
  })
  
  const [durationHours, setDurationHours] = useState<number>(2) // Default 2 hours
  

  // TanStack Query hooks
  const createJobMutation = useCreateJobOrder()
  
  // Fetch all technicians (not just available ones)
  const { data: techniciansData, isLoading: loadingTechnicians } = useUsers({ role: 'technician' })
  const technicians = techniciansData?.users || []
  
  // Fetch service advisors
  const { data: serviceAdvisorsData, isLoading: loadingServiceAdvisors } = useUsers({ role: 'service-advisor' })
  const serviceAdvisors = serviceAdvisorsData?.users || []


  // Calculate end time when start time, duration, or technician changes
  useEffect(() => {
    if (formData.timeRange.start && durationHours) {
      const calculatedEnd = calculateEndTimeWithBreak(formData.timeRange.start, durationHours * 60, formData.assignedTechnician)
      handleInputChange('timeRange', { ...formData.timeRange, end: calculatedEnd })
    }
  }, [formData.timeRange.start, durationHours, formData.assignedTechnician])

  // Calculate end time from start time and duration, accounting for technician's break times
  const calculateEndTimeWithBreak = (startTime: string, durationMinutes: number, technicianId?: string): string => {
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const startDate = new Date()
    startDate.setHours(startHour, startMinute, 0, 0)
    
    // Calculate initial end time without breaks
    let endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000)
    
    // Get technician's break times if technicianId is provided
    if (technicianId && technicians && Array.isArray(technicians)) {
      const technician = technicians.find((t: any) => t._id === technicianId)
      const breakTimes = technician?.breakTimes || []
      
      // Check if the time range crosses any break time
      for (const breakTime of breakTimes) {
        const [breakStartHour, breakStartMinute] = breakTime.startTime.split(':').map(Number)
        const [breakEndHour, breakEndMinute] = breakTime.endTime.split(':').map(Number)
        
        const breakStartDate = new Date()
        breakStartDate.setHours(breakStartHour, breakStartMinute, 0, 0)
        
        const breakEndDate = new Date()
        breakEndDate.setHours(breakEndHour, breakEndMinute, 0, 0)
        
        const breakDuration = (breakEndDate.getTime() - breakStartDate.getTime()) / (1000 * 60)
        
        // Work overlaps if: start < breakEnd AND initialEnd > breakStart
        if (startDate < breakEndDate && endDate > breakStartDate) {
          // The break falls within the work period - add break duration to skip it
          endDate = new Date(endDate.getTime() + breakDuration * 60 * 1000)
        }
      }
    }
    
    const endHour = String(endDate.getHours()).padStart(2, '0')
    const endMinute = String(endDate.getMinutes()).padStart(2, '0')
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
    const newParts = [...(formData.parts || [])]
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
      parts: [...(prev.parts || []), { name: '', availability: 'Available' }]
    }))
  }

  const removePart = (index: number) => {
    setFormData(prev => ({
      ...prev,
      parts: (prev.parts || []).filter((_, i) => i !== index)
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

  return createPortal(
    <div className="modal-backdrop">
      <div className="ios-card max-w-4xl w-full max-h-[90vh] overflow-y-auto modal-content">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Add New Job Order</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors"
            >
              ×
            </button>
          </div>

          {createJobMutation.isError && (
            <div className="mb-4 p-4 bg-red-500/20 backdrop-blur-sm border border-red-300/30 text-red-700 rounded-xl font-medium">
              {createJobMutation.error.message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
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
                Start Time * {formData.assignedTechnician && <span className="text-xs text-gray-500">(or select from schedule below)</span>}
              </label>
              <input
                type="time"
                value={formData.timeRange.start}
                onChange={(e) => handleInputChange('timeRange', { ...formData.timeRange, start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              {formData.assignedTechnician && !formData.timeRange.start && (
                <p className="text-xs text-blue-600 mt-1">
                  💡 Select a technician first to see their schedule and click on available time slots
                </p>
              )}
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
                {formData.timeRange.start && formData.timeRange.end && formData.assignedTechnician && (
                  <p className="text-xs text-gray-500 mt-1">
                    Technician break times included in calculation
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
                    {tech.name} {tech.level ? `(${tech.level})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Advisor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Advisor *
              </label>
              <select
                value={formData.serviceAdvisor}
                onChange={(e) => handleInputChange('serviceAdvisor', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

            {/* Visual Schedule Selector */}
            {formData.assignedTechnician && (
              <div className="border-t border-gray-200 pt-4">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Technician Schedule - {technicians && Array.isArray(technicians) ? technicians.find((t: any) => t._id === formData.assignedTechnician)?.name : 'Unknown'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    Click on an available time slot to set the start time, or manually enter it above.
                    {durationHours > 0 && ` Duration: ${durationHours} hour${durationHours > 1 ? 's' : ''}`}
                  </p>
                </div>
                <TechnicianScheduleView
                  technicianId={formData.assignedTechnician}
                  date={formData.date || new Date().toISOString().split('T')[0]}
                  duration={durationHours * 60}
                  onTimeSlotSelect={(startTime) => handleInputChange('timeRange', { ...formData.timeRange, start: startTime })}
                  selectedStart={formData.timeRange.start}
                />
              </div>
            )}

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
                  Parts
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
                {formData.parts && formData.parts.length > 0 ? (
                  formData.parts.map((part, index) => (
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
                      {(formData.parts || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePart(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 italic">No parts added (optional)</p>
                )}
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-white/30">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-gray-700 bg-white/50 hover:bg-white/70 rounded-xl font-semibold transition-all duration-200 border border-white/50 hover:shadow-lg hover:-translate-y-0.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createJobMutation.isPending}
                className="px-6 py-2.5 bg-gradient-to-r from-ford-blue to-ford-blue-light hover:from-ford-blue-light hover:to-ford-blue disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-semibold transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                {createJobMutation.isPending ? 'Creating...' : 'Create Job Order'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  )
}
