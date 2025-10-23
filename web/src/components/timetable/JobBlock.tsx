import { memo } from 'react'
import { FiStar, FiRefreshCw } from 'react-icons/fi'
import { STATUS_COLORS, getJobSpan, getJobOffset, getJobProgress, formatTime } from '@/utils/timetableUtils'
import type { JobOrderWithDetails } from '@/utils/timetableUtils'

interface JobBlockProps {
  job: JobOrderWithDetails
  highlightedJobId: string | null
  onClick: (job: JobOrderWithDetails) => void
}

const JobBlock = memo(({ job, highlightedJobId, onClick }: JobBlockProps) => {
  const isHighlighted = highlightedJobId === job._id
  const span = getJobSpan(job)
  const offset = getJobOffset(job)
  const progress = getJobProgress(job)

  // Determine if job is "inactive" (no longer actively being worked on)
  const isInactive = ['QI', 'FR', 'FU', 'CP'].includes(job.status)
  const isOnHold = ['HC', 'HW', 'HI', 'HF', 'SU'].includes(job.status)
  const isWaitingParts = job.status === 'WP'

  // Get base styling
  let baseClasses = `${STATUS_COLORS[job.status]}`
  
  // Add visual modifications for different states
  if (isInactive) {
    // Jobs that are completed or in final stages - show as "sliced" or dimmed
    baseClasses += ' opacity-60 border-dashed'
  } else if (isOnHold) {
    // Jobs on hold - show with warning styling
    baseClasses += ' opacity-80 border-dotted'
  } else if (isWaitingParts) {
    // Jobs waiting for parts - show with amber warning
    baseClasses += ' opacity-75'
  }

  return (
    <button
      onClick={() => onClick(job)}
      data-job-id={job._id}
      className={`h-full rounded text-xs font-medium border-2 transition-all hover:shadow-md relative ${baseClasses} ${
        isHighlighted ? 'ring-4 ring-yellow-400 ring-opacity-75 animate-pulse' : ''
      }`}
      style={{
        width: `${span * 64}px`,
        minWidth: '64px',
        position: 'absolute',
        left: `${offset * 64 / 100}px`,
        top: '0px',
        zIndex: isHighlighted ? 100 : 10,
        pointerEvents: 'auto',
        maxWidth: 'none',
        overflow: 'visible',
        isolation: 'isolate',
        height: '100%'
      }}
      title={`${job.jobNumber} - ${job.plateNumber} (${progress.toFixed(0)}% complete) - ${formatTime(job.timeRange.start)} to ${formatTime(job.timeRange.end)} - Status: ${job.status}${isInactive ? ' (Completed/Inactive)' : isOnHold ? ' (On Hold)' : isWaitingParts ? ' (Waiting Parts)' : ''}`}
    >
      {job.carriedOver && (
        <div className="absolute top-0 left-0 text-red-500">
          <FiRefreshCw size={12} />
        </div>
      )}
      
      {/* Status indicator for inactive jobs */}
      {isInactive && (
        <div className="absolute top-0 right-0 bg-gray-600 text-white text-xs px-1 rounded-bl">
          {job.status}
        </div>
      )}
      
      {/* Important star - position it to avoid conflict with status indicator */}
      {job.isImportant && !isInactive && (
        <div className="absolute top-0 right-0 text-yellow-500">
          <FiStar size={14} />
        </div>
      )}
      {job.isImportant && isInactive && (
        <div className="absolute top-0 right-6 text-yellow-500">
          <FiStar size={12} />
        </div>
      )}
      
      <div className="truncate font-semibold">{job.jobNumber}</div>
      <div className="truncate text-xs opacity-75">{job.plateNumber}</div>
      <div className="truncate text-xs opacity-60">
        {formatTime(job.timeRange.start)}-{formatTime(job.timeRange.end)}
      </div>
      
      {/* Show status for on-hold and waiting parts jobs */}
      {(isOnHold || isWaitingParts) && (
        <div className="absolute bottom-0 left-0 right-0 text-center text-xs font-medium opacity-90">
          {job.status === 'WP' && '⏳ Parts'}
          {job.status === 'HC' && '⏸️ Customer'}
          {job.status === 'HW' && '⏸️ Warranty'}
          {job.status === 'HI' && '⏸️ Insurance'}
          {job.status === 'HF' && '⏸️ Ford'}
          {job.status === 'SU' && '⏸️ Sublet'}
        </div>
      )}
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
    </button>
  )
})

JobBlock.displayName = 'JobBlock'

export default JobBlock
