import { memo } from 'react'
import JobBlock from './JobBlock'
import AppointmentBlock from './AppointmentBlock'
import AvailableSlotSpan from './AvailableSlotSpan'
import { getJobAtTime, getAppointmentAtTime, getJobStartSlot, getAppointmentStartSlot, TIME_SLOTS } from '@/utils/timetableUtils'
import type { TimeSlot, JobOrderWithDetails, Technician } from '@/utils/timetableUtils'
import type { Appointment } from '@/types/appointment'
import { hasBreakTimeOverlap } from '@/utils/breakTimeUtils'

interface AvailableSlot {
  startTime: string
  endTime: string
  duration: number
}

interface TimeSlotGridCellProps {
  technician: Technician
  timeSlot: TimeSlot
  slotIndex: number
  rowIndex: number
  jobOrders: JobOrderWithDetails[]
  appointments: Appointment[]
  highlightedJobId: string | null
  availableSlots?: AvailableSlot[]
  onJobClick: (job: JobOrderWithDetails) => void
  onAppointmentClick: (appointment: Appointment) => void
  onDeleteAppointment?: (appointmentId: string) => void
  onAvailableSlotClick?: (technicianId: string, startTime: string, endTime: string) => void
}

const TimeSlotGridCell = memo(({
  technician,
  timeSlot,
  slotIndex,
  rowIndex,
  jobOrders,
  appointments,
  highlightedJobId,
  availableSlots = [],
  onJobClick,
  onAppointmentClick,
  onDeleteAppointment,
  onAvailableSlotClick
}: TimeSlotGridCellProps) => {
  const job = getJobAtTime(technician._id, timeSlot, jobOrders)
  const isJobStart = job && getJobStartSlot(job) === slotIndex
  
  const appointment = getAppointmentAtTime(technician._id, timeSlot, appointments)
  const isAppointmentStart = appointment && getAppointmentStartSlot(appointment) === slotIndex
  
  // Check if this time slot is available for walk-in
  const isAvailableSlot = availableSlots.some(slot => slot.startTime === timeSlot.time)
  
  // Check if this is the start of a consecutive available slot span
  const isAvailableSlotStart = isAvailableSlot && (
    slotIndex === 0 || 
    !availableSlots.some(slot => slot.startTime === TIME_SLOTS[slotIndex - 1]?.time)
  )
  
  // Find the end of this available slot span
  const getAvailableSlotSpan = () => {
    if (!isAvailableSlotStart) return null
    
    let endSlotIndex = slotIndex
    // Find consecutive available slots
    for (let i = slotIndex + 1; i < TIME_SLOTS.length; i++) {
      const nextSlotTime = TIME_SLOTS[i]?.time
      if (nextSlotTime && availableSlots.some(slot => slot.startTime === nextSlotTime)) {
        endSlotIndex = i
      } else {
        break
      }
    }
    
    // Only create span if there are multiple consecutive slots or if it's a single slot
    if (endSlotIndex > slotIndex || isAvailableSlot) {
      const startSlot = availableSlots.find(slot => slot.startTime === timeSlot.time)
      
      // Calculate the actual end time based on the consecutive slots
      const spanSlots = endSlotIndex - slotIndex + 1
      const startMinutes = slotIndex * 30 // Each slot is 30 minutes
      const endMinutes = startMinutes + (spanSlots * 30)
      
      // Convert back to time format
      const endHour = Math.floor(endMinutes / 60)
      const endMin = endMinutes % 60
      const calculatedEndTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
      
      return {
        startSlotIndex: slotIndex,
        endSlotIndex,
        startTime: startSlot?.startTime || timeSlot.time,
        endTime: calculatedEndTime
      }
    }
    
    return null
  }
  
  const availableSlotSpan = getAvailableSlotSpan()
  
  // Check if this time slot is during a break time
  const breakTimes = (technician as any).breakTimes || []
  const isBreakTime = breakTimes.some((breakTime: any) => {
    const [hour, minute] = timeSlot.time.split(':').map(Number)
    const [breakStartHour, breakStartMinute] = breakTime.startTime.split(':').map(Number)
    const [breakEndHour, breakEndMinute] = breakTime.endTime.split(':').map(Number)
    
    const slotMinutes = hour * 60 + minute
    const breakStartMinutes = breakStartHour * 60 + breakStartMinute
    const breakEndMinutes = breakEndHour * 60 + breakEndMinute
    
    return slotMinutes >= breakStartMinutes && slotMinutes < breakEndMinutes
  })
  
  // Find which break time this slot belongs to
  const currentBreakTime = breakTimes.find((breakTime: any) => {
    const [hour, minute] = timeSlot.time.split(':').map(Number)
    const [breakStartHour, breakStartMinute] = breakTime.startTime.split(':').map(Number)
    const [breakEndHour, breakEndMinute] = breakTime.endTime.split(':').map(Number)
    
    const slotMinutes = hour * 60 + minute
    const breakStartMinutes = breakStartHour * 60 + breakStartMinute
    const breakEndMinutes = breakEndHour * 60 + breakEndMinute
    
    return slotMinutes >= breakStartMinutes && slotMinutes < breakEndMinutes
  })

  return (
    <div
      className="relative"
      style={{ 
        gridColumn: slotIndex + 2,
        gridRow: rowIndex + 2,
        minHeight: '80px',
        borderBottom: '1px solid #d1d5db',
        borderRight: '1px solid #d1d5db'
      }}
    >
      {isBreakTime ? (
        // Show break time
        <div className="w-full h-full bg-orange-100 border-l-4 border-orange-400 flex items-center justify-center">
          <div className="text-xs text-orange-700 font-medium text-center px-1">
            {currentBreakTime?.description || 'Break'}
          </div>
        </div>
      ) : isAppointmentStart && !job ? (
        <AppointmentBlock
          appointment={appointment}
          onClick={onAppointmentClick}
          onDelete={onDeleteAppointment}
        />
      ) : isJobStart ? (
        <JobBlock
          job={job}
          highlightedJobId={highlightedJobId}
          onClick={onJobClick}
        />
      ) : job ? (
        // This cell is part of a job but not the start - show as continuation
        <div className="w-full h-full bg-transparent" />
      ) : (
        <div className="w-full h-full rounded min-h-[4rem]" />
      )}
    </div>
  )
})

TimeSlotGridCell.displayName = 'TimeSlotGridCell'

export default TimeSlotGridCell
