'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import type { Technician } from '@/types/jobOrder'
import { useUsers } from '@/hooks/useJobOrders'

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

  // Fetch technicians for break time data
  const { data: techniciansData } = useUsers({ role: 'technician' })
  const technicians = techniciansData?.users || []

  // Calculate end time when start time, duration, or technician changes
  useEffect(() => {
    if (startTime && durationHours) {
      const calculatedEnd = calculateEndTimeWithBreak(startTime, durationHours * 60, assignedTechnician)
      setEndTime(calculatedEnd)
    }
  }, [startTime, durationHours, assignedTechnician])

  // Fetch available technicians when date and time changes
  useEffect(() => {
    if (date && startTime && endTime) {
      fetchAvailableTechnicians()
    }
  }, [date, startTime, endTime])

  const calculateEndTimeWithBreak = (start: string, durationMinutes: number, technicianId?: string): string => {
    const [startHour, startMinute] = start.split(':').map(Number)
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

  return createPortal(
    <div className="modal-backdrop">
      <div className="floating-card max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Replot Job Order</h3>
              <p className="text-sm text-gray-700 mt-1 font-medium">Job Number: <span className="font-bold">{jobNumber}</span></p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors"
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
                    {tech.name} {(tech as any).level ? `(${(tech as any).level})` : ''}
                  </option>
                ))}
              </select>
              {availableTechnicians.length === 0 && date && startTime && endTime && !loadingTechs && (
                <p className="text-sm text-red-600 mt-1">No technicians available for this time slot</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/30">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-gray-700 bg-white/50 hover:bg-white/70 rounded-xl font-semibold transition-all border border-white/50 hover:shadow-lg hover:-translate-y-0.5"
            >
              Cancel
            </button>
            <button
              onClick={handleReplot}
              disabled={loading || !assignedTechnician || availableTechnicians.length === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-ford-blue to-ford-blue-light hover:from-ford-blue-light hover:to-ford-blue disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {loading ? 'Replotting...' : 'Replot Job Order'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

