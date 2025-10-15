import { memo } from 'react'
import { FiStar, FiRefreshCw } from 'react-icons/fi'
import { STATUS_COLORS, getJobSpan, getJobOffset, getJobProgress, formatTime } from '@/utils/timetableUtils'
import type { JobOrderWithDetails } from '@/utils/timetableUtils'

interface JobBlockProps {
  job: JobOrderWithDetails
  highlightedJobId: string | null
  breakStart: string
  breakEnd: string
  onClick: (job: JobOrderWithDetails) => void
}

const JobBlock = memo(({ job, highlightedJobId, breakStart, breakEnd, onClick }: JobBlockProps) => {
  const isHighlighted = highlightedJobId === job._id
  const span = getJobSpan(job)
  const offset = getJobOffset(job)
  const progress = getJobProgress(job)

  // Calculate break time styling
  const getBreakTimeStyle = () => {
    const [startHour, startMinute] = job.timeRange.start.split(':').map(Number)
    const [endHour, endMinute] = job.timeRange.end.split(':').map(Number)
    const [breakStartHour, breakStartMinute] = breakStart.split(':').map(Number)
    const [breakEndHour, breakEndMinute] = breakEnd.split(':').map(Number)
    
    const jobStartMinutes = startHour * 60 + startMinute
    const jobEndMinutes = endHour * 60 + endMinute
    const breakStartMinutes = breakStartHour * 60 + breakStartMinute
    const breakEndMinutes = breakEndHour * 60 + breakEndMinute
    
    // Check if job overlaps with break time
    const overlapsBreak = jobStartMinutes < breakEndMinutes && jobEndMinutes > breakStartMinutes
    
    if (overlapsBreak) {
      // Calculate the break portion width and position
      const breakStartInJob = Math.max(breakStartMinutes, jobStartMinutes)
      const breakEndInJob = Math.min(breakEndMinutes, jobEndMinutes)
      const breakDuration = breakEndInJob - breakStartInJob
      const totalJobDuration = jobEndMinutes - jobStartMinutes
      const breakWidthPercent = (breakDuration / totalJobDuration) * 100
      const breakLeftPercent = ((breakStartInJob - jobStartMinutes) / totalJobDuration) * 100
      
      return {
        position: 'relative' as const,
        '--break-start': `${breakLeftPercent}%`,
        '--break-end': `${breakLeftPercent + breakWidthPercent}%`,
        '--break-width': `${breakWidthPercent}%`
      }
    }
    return {}
  }

  const breakTimeStyle = getBreakTimeStyle()

  return (
    <button
      onClick={() => onClick(job)}
      data-job-id={job._id}
      className={`h-full rounded text-xs font-medium border-2 transition-all hover:shadow-md relative ${STATUS_COLORS[job.status]} ${
        isHighlighted ? 'ring-4 ring-yellow-400 ring-opacity-75 animate-pulse' : ''
      }`}
      style={{
        width: `${span * 64}px`,
        minWidth: '64px',
        position: 'absolute',
        left: `${offset * 64 / 100}px`,
        top: '0px',
        zIndex: isHighlighted ? 1000 : 500,
        pointerEvents: 'auto',
        maxWidth: 'none',
        overflow: 'visible',
        isolation: 'isolate',
        height: '100%',
        ...breakTimeStyle
      }}
      title={`${job.jobNumber} - ${job.plateNumber} (${progress.toFixed(0)}% complete) - ${formatTime(job.timeRange.start)} to ${formatTime(job.timeRange.end)}`}
    >
      {job.isImportant && (
        <div className="absolute top-0 right-0 text-yellow-500">
          <FiStar size={14} />
        </div>
      )}
      {job.carriedOver && (
        <div className="absolute top-0 left-0 text-red-500">
          <FiRefreshCw size={12} />
        </div>
      )}
      <div className="truncate font-semibold">{job.jobNumber}</div>
      <div className="truncate text-xs opacity-75">{job.plateNumber}</div>
      <div className="truncate text-xs opacity-60">
        {formatTime(job.timeRange.start)}-{formatTime(job.timeRange.end)}
      </div>
      {job.status !== 'FR' && job.status !== 'FU' && (
        <div className="absolute bottom-1 left-1 right-1">
          <div className="flex items-center justify-between text-xs mb-0.5 px-1">
            <span className="text-black font-bold bg-white bg-opacity-80 px-1 py-0.5 rounded">
              {job.jobList.filter(t => t.status === 'Finished').length}/{job.jobList.length}
            </span>
            <span className="text-black font-bold bg-white bg-opacity-80 px-1 py-0.5 rounded">
              {progress.toFixed(0)}%
            </span>
          </div>
          <div className="bg-white bg-opacity-50 rounded-full h-1">
            <div 
              className="bg-blue-500 h-1 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      {/* Break time indicator */}
      {Object.keys(breakTimeStyle).length > 0 && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            left: breakTimeStyle['--break-start'],
            width: breakTimeStyle['--break-width'],
            backgroundColor: 'rgba(0, 0, 0, 0.1)'
          }}
        />
      )}
    </button>
  )
})

JobBlock.displayName = 'JobBlock'

export default JobBlock
