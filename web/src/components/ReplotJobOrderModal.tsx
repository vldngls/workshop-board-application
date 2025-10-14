'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import type { Technician } from '@/types/jobOrder'

interface ReplotJobOrderModalProps {
  onClose: () => void
  jobId: string
  jobNumber: string
  currentDate?: string
  onSuccess: () => void
}

export default function ReplotJobOrderModal({
  onClose,
  jobId,
  jobNumber,
  currentDate,
  onSuccess
}: ReplotJobOrderModalProps) {
  const [date, setDate] = useState(currentDate || new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('')
  const [durationHours, setDurationHours] = useState<number>(2)
  const [endTime, setEndTime] = useState('')
  const [assignedTechnician, setAssignedTechnician] = useState('')
  const [availableTechnicians, setAvailableTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTechs, setLoadingTechs] = useState(false)

  // Break time settings
  const [breakStart, setBreakStart] = useState('12:00')
  const [breakEnd, setBreakEnd] = useState('13:00')

  // Load break settings
  useEffect(() => {
    const savedBreakStart = localStorage.getItem('breakStart')
    const savedBreakEnd = localStorage.getItem('breakEnd')
    if (savedBreakStart) setBreakStart(savedBreakStart)
    if (savedBreakEnd) setBreakEnd(savedBreakEnd)
  }, [])

  // Calculate end time when start time or duration changes
  useEffect(() => {
    if (startTime && durationHours) {
      const calculatedEnd = calculateEndTimeWithBreak(startTime, durationHours * 60)
      setEndTime(calculatedEnd)
    }
  }, [startTime, durationHours, breakStart, breakEnd])

  // Fetch available technicians when date and time changes
  useEffect(() => {
    if (date && startTime && endTime) {
      fetchAvailableTechnicians()
    }
  }, [date, startTime, endTime])

  const calculateEndTimeWithBreak = (start: string, durationMinutes: number): string => {
    const [startHour, startMinute] = start.split(':').map(Number)
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

  const fetchAvailableTechnicians = async () => {
    try {
      setLoadingTechs(true)
      const response = await fetch(
        `/api/job-orders/technicians/available?date=${date}&startTime=${startTime}&endTime=${endTime}`
      )
      if (!response.ok) throw new Error('Failed to fetch available technicians')
      const data = await response.json()
      setAvailableTechnicians(data.technicians || [])
    } catch (error) {
      console.error('Error fetching technicians:', error)
      toast.error('Failed to fetch available technicians')
    } finally {
      setLoadingTechs(false)
    }
  }

  const handleReplot = async () => {
    if (!assignedTechnician || !startTime || !endTime) {
      toast.error('Please fill in all fields')
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/job-orders/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedTechnician,
          timeRange: { start: startTime, end: endTime },
          date: date,
          status: 'OG'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to replot job order')
      }

      toast.success('Job order replotted successfully!')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error replotting job:', error)
      toast.error(error.message || 'Failed to replot job order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Replot Job Order</h3>
              <p className="text-sm text-gray-600 mt-1">Job Number: <span className="font-medium">{jobNumber}</span></p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
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
                  {endTime || 'Set start time'}
                </div>
              </div>
            </div>

            {/* Assigned Technician */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned Technician *
              </label>
              <select
                value={assignedTechnician}
                onChange={(e) => setAssignedTechnician(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={loadingTechs}
              >
                <option value="">
                  {loadingTechs ? 'Loading technicians...' : 'Select Technician'}
                </option>
                {availableTechnicians.map((tech) => (
                  <option key={tech._id} value={tech._id}>
                    {tech.name}
                  </option>
                ))}
              </select>
              {availableTechnicians.length === 0 && date && startTime && endTime && !loadingTechs && (
                <p className="text-sm text-red-600 mt-1">No technicians available for this time slot</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReplot}
              disabled={loading || !assignedTechnician || availableTechnicians.length === 0}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors"
            >
              {loading ? 'Replotting...' : 'Replot Job Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

