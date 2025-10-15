import { memo } from 'react'
import type { JobOrderWithDetails } from '@/utils/timetableUtils'

interface JobStatusSectionProps {
  title: string
  icon: React.ReactNode
  jobs: JobOrderWithDetails[]
  bgColor: string
  borderColor: string
  textColor: string
  badgeColor: string
  emptyIcon: React.ReactNode
  emptyText: string
  onJobClick?: (job: JobOrderWithDetails) => void
  actions?: React.ReactNode
  maxHeight?: string
}

const JobStatusSection = memo(({
  title,
  icon,
  jobs,
  bgColor,
  borderColor,
  textColor,
  badgeColor,
  emptyIcon,
  emptyText,
  onJobClick,
  actions,
  maxHeight = '300px'
}: JobStatusSectionProps) => {
  const hasJobs = jobs.length > 0

  return (
    <div className={`${hasJobs ? bgColor : 'bg-gray-100/50 backdrop-blur-sm border-2 border-gray-300/30'} rounded-xl p-4 w-72 flex-shrink-0`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-base font-bold flex items-center gap-2 ${hasJobs ? textColor : 'text-gray-600'}`}>
          <span className="text-lg">{icon}</span>
          {title}
        </h3>
        <span className={`${hasJobs ? badgeColor : 'bg-gray-300/50 text-gray-600'} px-2.5 py-1 rounded-md text-xs font-bold`}>
          {jobs.length}
        </span>
      </div>
      
      {jobs.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <div className="text-2xl mb-1">{emptyIcon}</div>
          <p className="text-xs">{emptyText}</p>
        </div>
      ) : (
        <div className={`space-y-2 max-h-[${maxHeight}] overflow-y-auto`}>
          {jobs.map((job) => (
            <div 
              key={job._id} 
              className={`bg-white/50 backdrop-blur-sm border border-white/60 rounded-xl p-3 hover:bg-white/60 transition-all hover:-translate-y-0.5 ${onJobClick ? 'cursor-pointer' : ''}`}
              onClick={onJobClick ? () => onJobClick(job) : undefined}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="space-y-2">
                <div className="flex items-center gap-1 min-w-0">
                  {job.isImportant && <span className="text-yellow-500 text-sm">★</span>}
                  <div className="min-w-0 flex-1">
                    <h4 className={`font-bold text-sm ${hasJobs ? textColor : 'text-gray-900'} truncate`}>
                      {job.jobNumber}
                    </h4>
                    <p className="text-xs text-gray-700 truncate">{job.plateNumber}</p>
                    {job.parts && (
                      <p className="text-xs text-red-600 mt-1 font-medium">
                        {job.parts.filter(p => p.availability === 'Unavailable').length} parts missing
                      </p>
                    )}
                  </div>
                </div>
                {actions}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

JobStatusSection.displayName = 'JobStatusSection'

export default JobStatusSection
