'use client'

import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUsers } from '@/hooks/useJobOrders'
import { hasBreakTimeOverlap } from '@/utils/breakTimeUtils'

interface TimeSlot {
  time: string
  label: string
  isOccupied: boolean
  occupiedBy?: string
  type?: 'appointment' | 'job-order' | 'break'
}

interface TechnicianScheduleViewProps {
  technicianId: string
  date: string
  duration: number // Duration in minutes
  onTimeSlotSelect: (startTime: string) => void
  selectedStart?: string
}

export default function TechnicianScheduleView({
  technicianId,
  date,
  duration,
  onTimeSlotSelect,
  selectedStart
}: TechnicianScheduleViewProps) {
  // Get technician data including break times
  const { data: techniciansData } = useUsers({ role: 'technician' })
  const technicians = techniciansData?.users || []
  const technician = technicians && Array.isArray(technicians) ? technicians.find((t: any) => t._id === technicianId) : undefined
  const breakTimes = technician?.breakTimes || []
  

  // Check if a specific time slot is during any break time
  const isBreakTime = (time: string): boolean => {
    return breakTimes.some((breakTime: any) => {
      const [hour, minute] = time.split(':').map(Number)
      const [breakStartHour, breakStartMinute] = breakTime.startTime.split(':').map(Number)
      const [breakEndHour, breakEndMinute] = breakTime.endTime.split(':').map(Number)
      
      const slotMinutes = hour * 60 + minute
      const breakStartMinutes = breakStartHour * 60 + breakStartMinute
      const breakEndMinutes = breakEndHour * 60 + breakEndMinute
      
      // Slot is during break if it's >= break start and < break end
      return slotMinutes >= breakStartMinutes && slotMinutes < breakEndMinutes
    })
  }

  // Check if an appointment duration would overlap with any break time
  const wouldOverlapWithBreak = (startTime: string, duration: number): boolean => {
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const startMinutes = startHour * 60 + startMinute
    const endMinutes = startMinutes + duration
    
    return breakTimes.some((breakTime: any) => {
      const [breakStartHour, breakStartMinute] = breakTime.startTime.split(':').map(Number)
      const [breakEndHour, breakEndMinute] = breakTime.endTime.split(':').map(Number)
      
      const breakStartMinutes = breakStartHour * 60 + breakStartMinute
      const breakEndMinutes = breakEndHour * 60 + breakEndMinute
      
      // Check if appointment overlaps with break time
      return startMinutes < breakEndMinutes && endMinutes > breakStartMinutes
    })
  }

  // Generate time slots from 7:00 AM to 6:00 PM
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = []
    for (let hour = 7; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const isBreak = isBreakTime(timeStr)
        
        // Find which break time this slot belongs to
        const currentBreakTime = breakTimes.find((breakTime: any) => {
          const [hour, minute] = timeStr.split(':').map(Number)
          const [breakStartHour, breakStartMinute] = breakTime.startTime.split(':').map(Number)
          const [breakEndHour, breakEndMinute] = breakTime.endTime.split(':').map(Number)
          
          const slotMinutes = hour * 60 + minute
          const breakStartMinutes = breakStartHour * 60 + breakStartMinute
          const breakEndMinutes = breakEndHour * 60 + breakEndMinute
          
          return slotMinutes >= breakStartMinutes && slotMinutes < breakEndMinutes
        })
        
        slots.push({
          time: timeStr,
          label: `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`,
          isOccupied: false, // Break times are not "occupied" for selection purposes
          occupiedBy: isBreak ? (currentBreakTime?.description || 'Break Time') : undefined,
          type: isBreak ? 'break' : undefined
        })
        
      }
    }
    return slots
  }

  // Fetch schedule data using React Query for automatic updates
  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ['technician-schedule', technicianId, date],
    queryFn: async () => {
      if (!technicianId || !date) return { appointments: [], jobOrders: [] }
      
      
      
      // Fetch appointments
      const appointmentsRes = await fetch(`/api/appointments?date=${date}&technician=${technicianId}`, {
        credentials: 'include'
      })
      if (!appointmentsRes.ok) {
        console.error('Failed to fetch appointments:', appointmentsRes.status, appointmentsRes.statusText)
        throw new Error('Failed to fetch appointments')
      }
      const appointmentsData = await appointmentsRes.json()
      const appointments = appointmentsData.appointments || []

      // Fetch job orders
      const jobOrdersRes = await fetch(`/api/job-orders?date=${date}&technician=${technicianId}`, {
        credentials: 'include'
      })
      if (!jobOrdersRes.ok) {
        console.error('Failed to fetch job orders:', jobOrdersRes.status, jobOrdersRes.statusText)
        throw new Error('Failed to fetch job orders')
      }
      const jobOrdersData = await jobOrdersRes.json()
      const jobOrders = jobOrdersData.jobOrders || []

      return { appointments, jobOrders }
    },
    enabled: !!(technicianId && date),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Generate schedule from fetched data
  const schedule = React.useMemo(() => {
    if (!scheduleData) return generateTimeSlots()
    
    const { appointments, jobOrders } = scheduleData
    const slots = generateTimeSlots()
    
    // Helper function to check if a time is within a range
    const isTimeInRange = (time: string, start: string, end: string): boolean => {
      const [tHour, tMin] = time.split(':').map(Number)
      const [sHour, sMin] = start.split(':').map(Number)
      const [eHour, eMin] = end.split(':').map(Number)
      
      const tMinutes = tHour * 60 + tMin
      const sMinutes = sHour * 60 + sMin
      const eMinutes = eHour * 60 + eMin
      
      return tMinutes >= sMinutes && tMinutes < eMinutes
    }

    slots.forEach(slot => {
      // Don't override breaktime slots
      if (slot.type === 'break') return
      
      // Check appointments
      for (const appt of appointments) {
        if (isTimeInRange(slot.time, appt.timeRange.start, appt.timeRange.end)) {
          slot.isOccupied = true
          slot.occupiedBy = `Appointment: ${appt.plateNumber}`
          slot.type = 'appointment'
          break
        }
      }
      
      // Check job orders (if not already occupied)
      if (!slot.isOccupied) {
        for (const job of jobOrders) {
          if (isTimeInRange(slot.time, job.timeRange.start, job.timeRange.end)) {
            slot.isOccupied = true
            slot.occupiedBy = `Job Order: ${job.jobNumber}`
            slot.type = 'job-order'
            break
          }
        }
      }
    })

    return slots
  }, [scheduleData, breakTimes])

  // Helper function to calculate end time accounting for break times
  const calculateEndTimeWithBreaks = (startTime: string, durationMinutes: number): string => {
    const [startHour, startMinute] = startTime.split(':').map(Number)
    const startDate = new Date()
    startDate.setHours(startHour, startMinute, 0, 0)
    
    // Calculate initial end time without breaks
    let endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000)
    
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
    
    const endHour = String(endDate.getHours()).padStart(2, '0')
    const endMinute = String(endDate.getMinutes()).padStart(2, '0')
    return `${endHour}:${endMinute}`
  }

  const handleSlotClick = (slot: TimeSlot) => {
    // Don't allow selection of already occupied slots (jobs/appointments)
    if (slot.isOccupied) return

    // Calculate end time accounting for break times
    const endTime = calculateEndTimeWithBreaks(slot.time, duration)
    const [startHour, startMin] = slot.time.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    
    // Check if any slots between start and end would be occupied by jobs/appointments (not breaks)
    const hasOccupiedSlots = schedule.some(s => {
      const [sHour, sMin] = s.time.split(':').map(Number)
      const sMinutes = sHour * 60 + sMin
      // Only check for conflicts with jobs/appointments, not break times
      return s.isOccupied && sMinutes >= startMinutes && sMinutes < endMinutes
    })

    if (hasOccupiedSlots) {
      // Can't select this start time with current duration
      return
    }

    // Just set the start time, don't auto-submit
    onTimeSlotSelect(slot.time)
  }

  const isSlotInSelection = (slotTime: string): boolean => {
    if (!selectedStart) return false
    
    const [slotHour, slotMin] = slotTime.split(':').map(Number)
    const slotMinutes = slotHour * 60 + slotMin
    
    const [startHour, startMin] = selectedStart.split(':').map(Number)
    const startMinutes = startHour * 60 + startMin
    
    // Calculate end time accounting for break times
    const endTime = calculateEndTimeWithBreaks(selectedStart, duration)
    const [endHour, endMin] = endTime.split(':').map(Number)
    const endMinutes = endHour * 60 + endMin
    
    return slotMinutes >= startMinutes && slotMinutes < endMinutes
  }

  if (!technicianId) {
    return (
      <div className="text-center py-8 text-neutral-500 text-sm">
        Select a technician to view their schedule
      </div>
    )
  }

  if (!duration) {
    return (
      <div className="text-center py-8 text-neutral-500 text-sm">
        Select a work duration first to see available time slots
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="text-center py-8 text-neutral-500 text-sm">
        Loading schedule...
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3">
        <div className="text-sm font-medium text-neutral-700 mb-2">Technician Schedule</div>
        <div className="text-xs text-neutral-500 mb-2">
          Click on an available start time slot ({duration} min duration)
        </div>
        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-pink-100 border border-pink-300 rounded"></div>
            <span>Appointment</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
            <span>Job Order</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-100 border border-orange-300 rounded"></div>
            <span>Break Time</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Selected</span>
          </div>
        </div>
      </div>

      <div className="border border-neutral-200 rounded-lg p-3 max-h-[400px] overflow-y-auto">
        <div className="grid grid-cols-4 gap-1.5">
          {schedule.map((slot) => {
            const isSelected = isSlotInSelection(slot.time)
            
            let bgClass = 'bg-green-50 border-green-300 hover:bg-green-100'
            if (slot.type === 'break') {
              bgClass = 'bg-orange-100 border-orange-300 hover:bg-orange-200'
            } else if (slot.isOccupied) {
              if (slot.type === 'appointment') {
                bgClass = 'bg-pink-100 border-pink-300 cursor-not-allowed'
              } else {
                bgClass = 'bg-blue-100 border-blue-300 cursor-not-allowed'
              }
            } else if (isSelected) {
              bgClass = 'bg-blue-500 border-blue-600 text-white'
            }

            return (
              <button
                key={slot.time}
                type="button"
                onClick={() => handleSlotClick(slot)}
                disabled={slot.isOccupied}
                className={`border rounded px-2 py-1.5 text-xs font-medium transition-colors ${bgClass}`}
                title={slot.isOccupied ? slot.occupiedBy : `Available: ${slot.label}`}
              >
                {slot.label.replace(' ', '\n')}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

