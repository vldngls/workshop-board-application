import { memo } from 'react'
import TimeSlotGridCell from './TimeSlotGridCell'
import { TIME_SLOTS } from '@/utils/timetableUtils'
import type { JobOrderWithDetails, Appointment, Technician } from '@/utils/timetableUtils'

interface TechnicianGridRowProps {
  technician: Technician
  rowIndex: number
  jobOrders: JobOrderWithDetails[]
  appointments: Appointment[]
  highlightedJobId: string | null
  breakStart: string
  breakEnd: string
  onJobClick: (job: JobOrderWithDetails) => void
  onAppointmentClick: (appointment: Appointment) => void
  onDeleteAppointment: (appointmentId: string) => void
}

const TechnicianGridRow = memo(({
  technician,
  rowIndex,
  jobOrders,
  appointments,
  highlightedJobId,
  breakStart,
  breakEnd,
  onJobClick,
  onAppointmentClick,
  onDeleteAppointment
}: TechnicianGridRowProps) => {
  return (
    <>
      {/* Technician Name Cell */}
      <div 
        className="px-2 py-3 text-sm font-medium text-gray-900 bg-gray-50 border-b border-gray-300 flex items-center"
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
          breakStart={breakStart}
          breakEnd={breakEnd}
          onJobClick={onJobClick}
          onAppointmentClick={onAppointmentClick}
          onDeleteAppointment={onDeleteAppointment}
        />
      ))}
    </>
  )
})

TechnicianGridRow.displayName = 'TechnicianGridRow'

export default TechnicianGridRow
