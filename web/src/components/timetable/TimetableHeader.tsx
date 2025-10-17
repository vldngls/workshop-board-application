import { memo } from 'react'
import type { JobOrderWithDetails } from '@/utils/timetableUtils'

interface TimetableHeaderProps {
  date: Date
  onDateChange: (date: Date) => void
  jobOrders: JobOrderWithDetails[]
  forReleaseJobs: JobOrderWithDetails[]
  holdCustomerJobs: JobOrderWithDetails[]
  holdWarrantyJobs: JobOrderWithDetails[]
  holdInsuranceJobs: JobOrderWithDetails[]
  waitingPartsJobs: JobOrderWithDetails[]
}

const TimetableHeader = memo(({
  date,
  onDateChange,
  jobOrders,
  forReleaseJobs,
  holdCustomerJobs,
  holdWarrantyJobs,
  holdInsuranceJobs,
  waitingPartsJobs
}: TimetableHeaderProps) => {
  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(date)
    newDate.setDate(date.getDate() + (direction === 'next' ? 1 : -1))
    onDateChange(newDate)
  }

  const formatDate = (dateVal: Date): string => {
    return dateVal.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="flex gap-3">
      {/* Date navigation - Wider */}
      <div className="flex items-center justify-between floating-card p-2 flex-1">
        <button
          onClick={() => navigateDate('prev')}
          className="px-4 py-2 rounded-lg font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 text-sm"
        >
          ← Previous
        </button>
        <div className="flex items-center space-x-3">
          <h2 className="text-lg font-bold whitespace-nowrap">{formatDate(date)}</h2>
          <button
            onClick={() => onDateChange(new Date())}
            className="px-3 py-1.5 text-sm bg-ford-blue/20 hover:bg-ford-blue/30 text-ford-blue rounded-lg font-semibold transition-all border border-ford-blue/30"
          >
            Today
          </button>
        </div>
        <button
          onClick={() => navigateDate('next')}
          className="px-4 py-2 rounded-lg font-semibold transition-all hover:shadow-lg hover:-translate-y-0.5 text-sm"
        >
          Next →
        </button>
      </div>
      
      {/* Daily Summary - Narrower */}
      <div className="floating-card p-2 lg:w-80">
        <h3 className="text-sm font-bold mb-1">Daily Summary</h3>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="text-center">
            <div className="text-base font-bold text-ford-blue">{jobOrders.length}</div>
            <div className="text-gray-600">Total</div>
          </div>
          <div className="text-center">
            <div className="text-base font-bold text-ford-blue">
              {jobOrders.filter(job => job.status === 'OG').length}
            </div>
            <div className="text-gray-600">On Going</div>
          </div>
          <div className="text-center">
            <div className="text-base font-bold text-green-600">
              {forReleaseJobs.length}
            </div>
            <div className="text-gray-600">For Release</div>
          </div>
          <div className="text-center">
            <div className="text-base font-bold text-red-600">
              {holdCustomerJobs.length + holdWarrantyJobs.length + holdInsuranceJobs.length + waitingPartsJobs.length}
            </div>
            <div className="text-gray-600">On Hold</div>
          </div>
        </div>
      </div>
      
      {/* Status Legend - Compact */}
      <div className="floating-card p-2 lg:w-80">
        <h3 className="text-sm font-bold mb-1">Status Legend</h3>
        <div className="grid grid-cols-6 gap-1 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-ford-blue/20 border border-ford-blue/30 rounded flex-shrink-0"></div>
            <span>OG</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-orange-100 border border-orange-300 rounded flex-shrink-0"></div>
            <span>WP</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-cyan-100 border border-cyan-300 rounded flex-shrink-0"></div>
            <span>FP</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-purple-100 border border-purple-300 rounded flex-shrink-0"></div>
            <span>QI</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-yellow-100 border border-yellow-300 rounded flex-shrink-0"></div>
            <span>HC</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-red-100 border border-red-300 rounded flex-shrink-0"></div>
            <span>HW</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-indigo-100 border border-indigo-300 rounded flex-shrink-0"></div>
            <span>HI</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-100 border border-green-300 rounded flex-shrink-0"></div>
            <span>FR</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-gray-100 border border-gray-300 rounded flex-shrink-0"></div>
            <span>FU</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-emerald-100 border border-emerald-300 rounded flex-shrink-0"></div>
            <span>CP</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-rose-100 border border-rose-300 rounded flex-shrink-0 border-dashed"></div>
            <span>APT</span>
          </div>
        </div>
      </div>
    </div>
  )
})

TimetableHeader.displayName = 'TimetableHeader'

export default TimetableHeader
