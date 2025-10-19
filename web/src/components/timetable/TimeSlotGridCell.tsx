import { memo } from 'react'
import JobBlock from './JobBlock'
import AppointmentBlock from './AppointmentBlock'
import { getJobAtTime, getAppointmentAtTime, getJobStartSlot, getAppointmentStartSlot } from '@/utils/timetableUtils'
import type { TimeSlot, JobOrderWithDetails, Technician } from '@/utils/timetableUtils'
import type { Appointment } from '@/types/appointment'

interface TimeSlotGridCellProps {
  technician: Technician
  timeSlot: TimeSlot
  slotIndex: number
  rowIndex: number
  jobOrders: JobOrderWithDetails[]
  appointments: Appointment[]
  highlightedJobId: string | null
  breakStart: string
  breakEnd: string
  onJobClick: (job: JobOrderWithDetails) => void
  onAppointmentClick: (appointment: Appointment) => void
  onDeleteAppointment?: (appointmentId: string) => void
}

const TimeSlotGridCell = memo(({
  technician,
  timeSlot,
  slotIndex,
  rowIndex,
  jobOrders,
  appointments,
  highlightedJobId,
  breakStart,
  breakEnd,
  onJobClick,
  onAppointmentClick,
  onDeleteAppointment
}: TimeSlotGridCellProps) => {
  const job = getJobAtTime(technician._id, timeSlot, jobOrders)
  const isJobStart = job && getJobStartSlot(job) === slotIndex
  
  const appointment = getAppointmentAtTime(technician._id, timeSlot, appointments)
  const isAppointmentStart = appointment && getAppointmentStartSlot(appointment) === slotIndex

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
      {isAppointmentStart && !job ? (
        <AppointmentBlock
          appointment={appointment}
          onClick={onAppointmentClick}
          onDelete={onDeleteAppointment}
        />
      ) : isJobStart ? (
        <JobBlock
          job={job}
          highlightedJobId={highlightedJobId}
          breakStart={breakStart}
          breakEnd={breakEnd}
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
