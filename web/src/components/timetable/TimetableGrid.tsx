import React, { memo } from 'react'
import TechnicianGridRow from './TechnicianGridRow'
import AvailableSlotSpan from './AvailableSlotSpan'
import { TIME_SLOTS, formatTime } from '@/utils/timetableUtils'
import type { JobOrderWithDetails, Technician } from '@/utils/timetableUtils'
import type { Appointment } from '@/types/appointment'

interface TimetableGridProps {
  technicians: Technician[]
  jobOrders: JobOrderWithDetails[]
  appointments: Appointment[]
  highlightedJobId: string | null
  availableSlotsData?: Record<string, Array<{
    startTime: string
    endTime: string
    duration: number
  }>>
  onJobClick: (job: JobOrderWithDetails) => void
  onAppointmentClick: (appointment: Appointment) => void
  onDeleteAppointment?: (appointmentId: string) => void
  onAvailableSlotClick?: (technicianId: string, startTime: string, endTime: string) => void
}

const TimetableGrid = memo(({
  technicians,
  jobOrders,
  appointments,
  highlightedJobId,
  availableSlotsData = {},
  onJobClick,
  onAppointmentClick,
  onDeleteAppointment,
  onAvailableSlotClick
}: TimetableGridProps) => {
  // Generate available slot spans for each technician
  const generateAvailableSlotSpans = (technicianId: string, availableSlots: any[]) => {
    if (!availableSlots || availableSlots.length === 0) return []
    
    const spans = []
    let currentSpanStart = -1
    let currentSpanEnd = -1
    
    for (let i = 0; i < TIME_SLOTS.length; i++) {
      const slotTime = TIME_SLOTS[i].time
      const isAvailable = availableSlots.some(slot => slot.startTime === slotTime)
      
      if (isAvailable) {
        if (currentSpanStart === -1) {
          currentSpanStart = i
        }
        currentSpanEnd = i
      } else {
        if (currentSpanStart !== -1) {
          // End current span
          const startSlot = availableSlots.find(slot => slot.startTime === TIME_SLOTS[currentSpanStart].time)
          const endSlot = availableSlots.find(slot => slot.startTime === TIME_SLOTS[currentSpanEnd].time)
          
          spans.push({
            technicianId,
            startSlotIndex: currentSpanStart,
            endSlotIndex: currentSpanEnd,
            startTime: startSlot?.startTime || TIME_SLOTS[currentSpanStart].time,
            endTime: endSlot?.endTime || TIME_SLOTS[currentSpanEnd].time
          })
          
          currentSpanStart = -1
          currentSpanEnd = -1
        }
      }
    }
    
    // Handle span that goes to the end
    if (currentSpanStart !== -1) {
      const startSlot = availableSlots.find(slot => slot.startTime === TIME_SLOTS[currentSpanStart].time)
      const endSlot = availableSlots.find(slot => slot.startTime === TIME_SLOTS[currentSpanEnd].time)
      
      spans.push({
        technicianId,
        startSlotIndex: currentSpanStart,
        endSlotIndex: currentSpanEnd,
        startTime: startSlot?.startTime || TIME_SLOTS[currentSpanStart].time,
        endTime: endSlot?.endTime || TIME_SLOTS[currentSpanEnd].time
      })
    }
    
    return spans
  }
  
  // Generate all available slot spans
  const allAvailableSlotSpans = React.useMemo(() => {
    const spans: any[] = []
    
    technicians.forEach((technician, rowIndex) => {
      const techId = String(technician._id)
      const techIdObj = technician._id
      
      // Try multiple ID formats for matching
      const slots = availableSlotsData[techId] || 
                    availableSlotsData[techIdObj] || 
                    availableSlotsData[String(techIdObj)] || 
                    []
      
      const generatedSpans = generateAvailableSlotSpans(techId, slots)
      
      generatedSpans.forEach(span => {
        spans.push({
          ...span,
          technicianRowIndex: rowIndex
        })
      })
    })
    
    return spans
  }, [technicians, availableSlotsData])
  return (
    <div className="floating-card overflow-hidden">
      <div className="overflow-x-auto">
        {/* CSS Grid Layout */}
        <div 
          className="grid gap-0"
          style={{
            gridTemplateColumns: `128px repeat(${TIME_SLOTS.length}, 64px)`,
            gridTemplateRows: `auto repeat(${technicians.length}, 80px)`,
            width: 'fit-content',
            minWidth: `${128 + (TIME_SLOTS.length * 64)}px`
          }}
        >
          {/* Header Row */}
          <div className="bg-white px-2 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-300">
            Technician
          </div>
          {TIME_SLOTS.map((slot) => (
            <div
              key={slot.time}
              className="bg-white px-1 py-3 text-center text-xs font-medium text-gray-600 border-b border-gray-300"
              style={{ borderRight: '1px solid #d1d5db' }}
            >
              {formatTime(slot.time)}
            </div>
          ))}
          
          {/* Technician Rows */}
          {technicians.map((technician, rowIndex) => (
            <TechnicianGridRow
              key={technician._id}
              technician={technician}
              rowIndex={rowIndex}
              jobOrders={jobOrders}
              appointments={appointments}
              highlightedJobId={highlightedJobId}
              availableSlots={availableSlotsData[technician._id] || []}
              onJobClick={onJobClick}
              onAppointmentClick={onAppointmentClick}
              onDeleteAppointment={onDeleteAppointment}
              onAvailableSlotClick={onAvailableSlotClick}
            />
          ))}
          
          {/* Available Slot Spans */}
          {allAvailableSlotSpans.length > 0 && (
            <>
              {allAvailableSlotSpans.map((span, index) => {
                const key = `available-${span.technicianId}-${span.startSlotIndex}-${span.endSlotIndex}-${index}`
                return (
                  <AvailableSlotSpan
                    key={key}
                    technicianId={span.technicianId}
                    startSlotIndex={span.startSlotIndex}
                    endSlotIndex={span.endSlotIndex}
                    startTime={span.startTime}
                    endTime={span.endTime}
                    technicianRowIndex={span.technicianRowIndex}
                    onAvailableSlotClick={onAvailableSlotClick || (() => {})}
                  />
                )
              })}
            </>
          )}
        </div>
      </div>
    </div>
  )
})

TimetableGrid.displayName = 'TimetableGrid'

export default TimetableGrid
