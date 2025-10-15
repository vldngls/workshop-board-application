import { memo } from 'react'
import TechnicianGridRow from './TechnicianGridRow'
import { TIME_SLOTS, formatTime } from '@/utils/timetableUtils'
import type { JobOrderWithDetails, Appointment, Technician } from '@/utils/timetableUtils'

interface TimetableGridProps {
  technicians: Technician[]
  jobOrders: JobOrderWithDetails[]
  appointments: Appointment[]
  highlightedJobId: string | null
  breakStart: string
  breakEnd: string
  onJobClick: (job: JobOrderWithDetails) => void
  onAppointmentClick: (appointment: Appointment) => void
  onDeleteAppointment: (appointmentId: string) => void
}

const TimetableGrid = memo(({
  technicians,
  jobOrders,
  appointments,
  highlightedJobId,
  breakStart,
  breakEnd,
  onJobClick,
  onAppointmentClick,
  onDeleteAppointment
}: TimetableGridProps) => {
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
          <div className="bg-gray-50 px-2 py-3 text-left text-sm font-medium text-gray-700 border-b border-gray-300">
            Technician
          </div>
          {TIME_SLOTS.map((slot) => (
            <div
              key={slot.time}
              className="bg-gray-50 px-1 py-3 text-center text-xs font-medium text-gray-600 border-b border-gray-300"
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
              breakStart={breakStart}
              breakEnd={breakEnd}
              onJobClick={onJobClick}
              onAppointmentClick={onAppointmentClick}
              onDeleteAppointment={onDeleteAppointment}
            />
          ))}
        </div>
      </div>
    </div>
  )
})

TimetableGrid.displayName = 'TimetableGrid'

export default TimetableGrid
