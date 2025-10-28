import { memo } from 'react'

interface AvailableSlotSpanProps {
  technicianId: string
  startSlotIndex: number
  endSlotIndex: number
  startTime: string
  endTime: string
  technicianRowIndex: number
  onAvailableSlotClick: (technicianId: string, startTime: string, endTime: string) => void
}

const AvailableSlotSpan = memo(({
  technicianId,
  startSlotIndex,
  endSlotIndex,
  startTime,
  endTime,
  technicianRowIndex,
  onAvailableSlotClick
}: AvailableSlotSpanProps) => {
  const spanSlots = endSlotIndex - startSlotIndex + 1
  const durationMinutes = spanSlots * 30
  
  const handleClick = () => {
    onAvailableSlotClick(technicianId, startTime, endTime)
  }

  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      if (remainingMinutes === 0) {
        return `${hours}h`
      }
      return `${hours}h ${remainingMinutes}m`
    }
    return `${minutes}m`
  }

  return (
    <div
      className="bg-green-100 border-2 border-green-400 hover:bg-green-200 hover:border-green-500 cursor-pointer transition-all duration-200 flex flex-col items-center justify-center group z-10"
      style={{
        gridColumn: `${startSlotIndex + 2} / ${endSlotIndex + 3}`,
        gridRow: `${technicianRowIndex + 2} / ${technicianRowIndex + 3}`
      }}
      onClick={handleClick}
      title={`Click to create job order (${formatDuration(durationMinutes)})`}
    >
      <div className="text-xs text-green-800 font-semibold text-center px-1 group-hover:text-green-900">
        Available
      </div>
      <div className="text-xs text-green-600 text-center px-1 mt-1 group-hover:text-green-700">
        + Job ({formatDuration(durationMinutes)})
      </div>
    </div>
  )
})

AvailableSlotSpan.displayName = 'AvailableSlotSpan'

export default AvailableSlotSpan
