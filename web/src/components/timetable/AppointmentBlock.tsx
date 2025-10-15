import { memo } from 'react'
import { FiCalendar } from 'react-icons/fi'
import { getAppointmentSpan, formatTime } from '@/utils/timetableUtils'
import type { Appointment } from '@/utils/timetableUtils'

interface AppointmentBlockProps {
  appointment: Appointment
  onClick: (appointment: Appointment) => void
  onDelete: (appointmentId: string) => void
}

const AppointmentBlock = memo(({ appointment, onClick, onDelete }: AppointmentBlockProps) => {
  const span = getAppointmentSpan(appointment)

  return (
    <div
      className="h-full rounded text-xs font-medium border-2 border-dashed border-rose-400 bg-rose-50 text-rose-800 transition-all hover:shadow-md relative cursor-pointer"
      style={{
        width: `${span * 64}px`,
        minWidth: '64px',
        position: 'absolute',
        left: '0px',
        top: '0px',
        zIndex: 500,
        pointerEvents: 'auto',
        maxWidth: 'none',
        overflow: 'visible',
        isolation: 'isolate',
        height: '100%'
      }}
      title={`Appointment: ${appointment.plateNumber} - ${formatTime(appointment.timeRange.start)} to ${formatTime(appointment.timeRange.end)}`}
    >
      <div className="p-1 h-full flex flex-col justify-between">
        <div>
          <div className="truncate font-semibold text-xs flex items-center gap-1">
            <FiCalendar size={12} />
            {appointment.plateNumber}
          </div>
          <div className="truncate text-xs opacity-75">
            {formatTime(appointment.timeRange.start)}-{formatTime(appointment.timeRange.end)}
          </div>
        </div>
        <div className="flex gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClick(appointment)
            }}
            className="flex-1 create-job-button text-[10px] py-0.5 px-1"
            title="Create Job Order"
          >
            Create JO
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(appointment._id)
            }}
            className="no-show-button text-[10px] py-0.5 px-1"
            title="No Show - Delete"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
})

AppointmentBlock.displayName = 'AppointmentBlock'

export default AppointmentBlock
