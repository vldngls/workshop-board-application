import { memo } from 'react'
import { FiSearch, FiCheckCircle, FiTool, FiPackage, FiRefreshCw, FiShield, FiClipboard } from 'react-icons/fi'
import JobStatusSection from './JobStatusSection'
import { useDragScroll } from '@/hooks/useDragScroll'
import type { JobOrderWithDetails } from '@/utils/timetableUtils'

interface JobStatusSectionsProps {
  qiJobs: JobOrderWithDetails[]
  forReleaseJobs: JobOrderWithDetails[]
  waitingPartsJobs: JobOrderWithDetails[]
  forPlottingJobs: JobOrderWithDetails[]
  carriedOverJobs: JobOrderWithDetails[]
  holdCustomerJobs: JobOrderWithDetails[]
  holdWarrantyJobs: JobOrderWithDetails[]
  holdInsuranceJobs: JobOrderWithDetails[]
  finishedUnclaimedJobs: JobOrderWithDetails[]
  updating: boolean
  onJobClick: (job: JobOrderWithDetails) => void
  onApproveQI?: (jobId: string) => void
  onRejectQI?: (jobId: string) => void
  onCompleteJob?: (jobId: string) => void
  onRedoJob?: (jobId: string) => void
  onMarkComplete?: (jobId: string) => void
  onReassignCarryOver?: (job: JobOrderWithDetails) => void
}

const JobStatusSections = memo(({
  qiJobs,
  forReleaseJobs,
  waitingPartsJobs,
  forPlottingJobs,
  carriedOverJobs,
  holdCustomerJobs,
  holdWarrantyJobs,
  holdInsuranceJobs,
  finishedUnclaimedJobs,
  updating,
  onJobClick,
  onApproveQI,
  onRejectQI,
  onCompleteJob,
  onRedoJob,
  onMarkComplete,
  onReassignCarryOver
}: JobStatusSectionsProps) => {
  const { containerRef, handleMouseDown } = useDragScroll()
  return (
    <div className="floating-card p-8">
      <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
        <span className="text-xl">📊</span>
        Job Status Queues
      </h2>
      <div 
        ref={containerRef}
        className="overflow-x-auto pb-2 cursor-grab active:cursor-grabbing drag-scroll-container"
        onMouseDown={handleMouseDown}
        style={{ scrollbarWidth: 'thin' }}
      >
        <div className="flex gap-3 min-w-max">
          {/* Quality Inspection Section */}
          <JobStatusSection
            title="Quality Inspection"
            icon={<FiSearch />}
            jobs={qiJobs}
            bgColor="bg-purple-500/20 backdrop-blur-sm border-2 border-purple-400/30"
            borderColor="border-purple-400/30"
            textColor="text-purple-900"
            badgeColor="bg-purple-500/30 text-purple-900"
            emptyIcon={<FiCheckCircle />}
            emptyText="No jobs pending QI"
            actions={
              <div className="flex gap-1">
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    onApproveQI?.(qiJobs[0]._id)
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={updating} 
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold px-2 py-1 rounded-lg transition-all hover:shadow-md text-xs flex-1"
                >
                  ✓
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    onRejectQI?.(qiJobs[0]._id)
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={updating} 
                  className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold px-2 py-1 rounded-lg transition-all hover:shadow-md text-xs flex-1"
                >
                  ✗
                </button>
              </div>
            }
          />

          {/* For Release Section */}
          <JobStatusSection
            title="For Release"
            icon={<FiCheckCircle />}
            jobs={forReleaseJobs}
            bgColor="bg-green-500/20 backdrop-blur-sm border-2 border-green-400/30"
            borderColor="border-green-400/30"
            textColor="text-green-900"
            badgeColor="bg-green-500/30 text-green-900"
            emptyIcon={<FiTool />}
            emptyText="No jobs for release"
            actions={
              <div className="flex gap-1">
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    onCompleteJob?.(forReleaseJobs[0]._id)
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={updating} 
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold px-2 py-1 rounded-lg transition-all hover:shadow-md text-xs flex-1"
                >
                  ✓ Done
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    onRedoJob?.(forReleaseJobs[0]._id)
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={updating} 
                  className="bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold px-2 py-1 rounded-lg transition-all hover:shadow-md text-xs flex-1"
                >
                  ↻ Redo
                </button>
              </div>
            }
          />

          {/* Finished Unclaimed Section */}
          <JobStatusSection
            title="Finished Unclaimed"
            icon={<FiClipboard />}
            jobs={finishedUnclaimedJobs}
            bgColor="bg-gray-500/20 backdrop-blur-sm border-2 border-gray-400/30"
            borderColor="border-gray-400/30"
            textColor="text-gray-900"
            badgeColor="bg-gray-500/30 text-gray-900"
            emptyIcon={<FiCheckCircle />}
            emptyText="No unclaimed jobs"
            onJobClick={onJobClick}
            actions={
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  onMarkComplete?.(finishedUnclaimedJobs[0]._id)
                }}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={updating} 
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold px-2 py-1 rounded-lg transition-all hover:shadow-md text-xs w-full"
              >
                ✓ Complete
              </button>
            }
          />

          {/* Carry Over Section */}
          <JobStatusSection
            title="Carried Over"
            icon={<FiRefreshCw />}
            jobs={carriedOverJobs}
            bgColor="bg-red-500/20 backdrop-blur-sm border-2 border-red-400/30"
            borderColor="border-red-400/30"
            textColor="text-red-900"
            badgeColor="bg-red-500/30 text-red-900"
            emptyIcon="✨"
            emptyText="No carried over jobs"
            onJobClick={onJobClick}
            actions={
              onReassignCarryOver && carriedOverJobs.length > 0 ? (
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    onReassignCarryOver(carriedOverJobs[0])
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={updating} 
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold px-2 py-1 rounded-lg transition-all hover:shadow-md text-xs w-full"
                >
                  🔄 Reassign
                </button>
              ) : undefined
            }
          />

          {/* For Plotting Section */}
          <JobStatusSection
            title="For Plotting"
            icon="📍"
            jobs={forPlottingJobs}
            bgColor="bg-cyan-500/20 backdrop-blur-sm border-2 border-cyan-400/30"
            borderColor="border-cyan-400/30"
            textColor="text-cyan-900"
            badgeColor="bg-cyan-500/30 text-cyan-900"
            emptyIcon="✨"
            emptyText="No jobs for plotting"
            onJobClick={onJobClick}
          />

          {/* Waiting Parts Section */}
          <JobStatusSection
            title="Waiting Parts"
            icon="⏳"
            jobs={waitingPartsJobs}
            bgColor="bg-orange-500/20 backdrop-blur-sm border-2 border-orange-400/30"
            borderColor="border-orange-400/30"
            textColor="text-orange-900"
            badgeColor="bg-orange-500/30 text-orange-900"
            emptyIcon={<FiPackage />}
            emptyText="No jobs waiting parts"
            onJobClick={onJobClick}
          />

          {/* Hold Customer Section */}
          <JobStatusSection
            title="Hold Customer"
            icon="👤"
            jobs={holdCustomerJobs}
            bgColor="bg-yellow-500/20 backdrop-blur-sm border-2 border-yellow-400/30"
            borderColor="border-yellow-400/30"
            textColor="text-yellow-900"
            badgeColor="bg-yellow-500/30 text-yellow-900"
            emptyIcon={<FiCheckCircle />}
            emptyText="No jobs on hold"
            onJobClick={onJobClick}
          />

          {/* Hold Warranty Section */}
          <JobStatusSection
            title="Hold Warranty"
            icon={<FiShield />}
            jobs={holdWarrantyJobs}
            bgColor="bg-red-500/20 backdrop-blur-sm border-2 border-red-400/30"
            borderColor="border-red-400/30"
            textColor="text-red-900"
            badgeColor="bg-red-500/30 text-red-900"
            emptyIcon={<FiCheckCircle />}
            emptyText="No jobs on hold"
            onJobClick={onJobClick}
          />

          {/* Hold Insurance Section */}
          <JobStatusSection
            title="Hold Insurance"
            icon="🏥"
            jobs={holdInsuranceJobs}
            bgColor="bg-indigo-500/20 backdrop-blur-sm border-2 border-indigo-400/30"
            borderColor="border-indigo-400/30"
            textColor="text-indigo-900"
            badgeColor="bg-indigo-500/30 text-indigo-900"
            emptyIcon={<FiCheckCircle />}
            emptyText="No jobs on hold"
            onJobClick={onJobClick}
          />
        </div>
      </div>
    </div>
  )
})

JobStatusSections.displayName = 'JobStatusSections'

export default JobStatusSections
