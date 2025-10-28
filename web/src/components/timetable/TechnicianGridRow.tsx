import { memo } from 'react'
import TimeSlotGridCell from './TimeSlotGridCell'
import { TIME_SLOTS } from '@/utils/timetableUtils'
import type { JobOrderWithDetails, Technician } from '@/utils/timetableUtils'
import type { Appointment } from '@/types/appointment'

interface TechnicianGridRowProps {
  technician: Technician
  rowIndex: number
  jobOrders: JobOrderWithDetails[]
  appointments: Appointment[]
  highlightedJobId: string | null
  availableSlots?: Array<{
    startTime: string
    endTime: string
    duration: number
  }>
  onJobClick: (job: JobOrderWithDetails) => void
  onAppointmentClick: (appointment: Appointment) => void
  onDeleteAppointment?: (appointmentId: string) => void
  onAvailableSlotClick?: (technicianId: string, startTime: string, endTime: string) => void
}

const TechnicianGridRow = memo(({
  technician,
  rowIndex,
  jobOrders,
  appointments,
  highlightedJobId,
  availableSlots = [],
  onJobClick,
  onAppointmentClick,
  onDeleteAppointment,
  onAvailableSlotClick
}: TechnicianGridRowProps) => {
  return (
    <>
      {/* Technician Name Cell */}
      <div 
        className="px-2 py-3 text-sm font-medium text-gray-900 bg-white border-b border-gray-300 flex items-center"
        style={{ 
          gridRow: rowIndex + 2,
          borderRight: '1px solid #d1d5db'
        }}
      >
        {technician.name}
      </div>
      
      {/* Time Slot Cells */}
      {TIME_SLOTS.map((slot, slotIndex) => (
        <TimeSlotGridCell
          key={`${technician._id}-${slot.time}`}
          technician={technician}
          timeSlot={slot}
          slotIndex={slotIndex}
          rowIndex={rowIndex}
          jobOrders={jobOrders}
          appointments={appointments}
          highlightedJobId={highlightedJobId}
          availableSlots={availableSlots}
          onJobClick={onJobClick}
          onAppointmentClick={onAppointmentClick}
          onDeleteAppointment={onDeleteAppointment}
          onAvailableSlotClick={onAvailableSlotClick}
        />
      ))}
    </>
  )
})

TechnicianGridRow.displayName = 'TechnicianGridRow'

export default TechnicianGridRow
