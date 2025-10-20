'use client'

import { useState, memo, useCallback, MouseEvent } from 'react'
import toast from 'react-hot-toast'
import { FiCalendar, FiRefreshCw, FiAlertTriangle, FiClock, FiUser, FiTool, FiPackage } from 'react-icons/fi'
import type { JobOrder, JobStatus, JobItemStatus } from '@/types/jobOrder'
import { 
  useUpdateJobOrderStatus, 
  useUpdateJobOrder, 
  useToggleImportant,
  useAvailableTechnicians 
} from '@/hooks/useJobOrders'

interface JobOrderCardProps {
  jobOrder: JobOrder
  onClick?: (jobOrder: JobOrder) => void
}

// Status mapping for display
const STATUS_LABELS: Record<JobStatus, string> = {
  'OG': 'On Going',
  'WP': 'Waiting Parts',
  'FP': 'For Plotting',
  'QI': 'Quality Inspection',
  'HC': 'Hold Customer',
  'HW': 'Hold Warranty',
  'HI': 'Hold Insurance',
  'FR': 'For Release',
  'FU': 'Finished Unclaimed',
  'CP': 'Complete'
}

const STATUS_COLORS: Record<JobStatus, string> = {
  'OG': 'bg-blue-50 text-blue-700 border border-blue-200',
  'WP': 'bg-amber-50 text-amber-700 border border-amber-200',
  'FP': 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  'QI': 'bg-purple-50 text-purple-700 border border-purple-200',
  'HC': 'bg-orange-50 text-orange-700 border border-orange-200',
  'HW': 'bg-red-50 text-red-700 border border-red-200',
  'HI': 'bg-pink-50 text-pink-700 border border-pink-200',
  'FR': 'bg-green-50 text-green-700 border border-green-200',
  'FU': 'bg-gray-50 text-gray-700 border border-gray-200',
  'CP': 'bg-emerald-50 text-emerald-700 border border-emerald-200'
}

const STATUS_ACCENT: Record<JobStatus, string> = {
  'OG': 'bg-blue-500',
  'WP': 'bg-amber-500',
  'FP': 'bg-cyan-500',
  'QI': 'bg-purple-500',
  'HC': 'bg-orange-500',
  'HW': 'bg-red-500',
  'HI': 'bg-pink-500',
  'FR': 'bg-green-500',
  'FU': 'bg-gray-500',
  'CP': 'bg-emerald-500'
}

function JobOrderCard({ jobOrder, onClick }: JobOrderCardProps) {
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showJobTasksModal, setShowJobTasksModal] = useState(false)
  const [showPartsModal, setShowPartsModal] = useState(false)
  const [showTechnicianModal, setShowTechnicianModal] = useState(false)
  const [updatingTaskIndex, setUpdatingTaskIndex] = useState<number | null>(null)
  const [updatingPartIndex, setUpdatingPartIndex] = useState<number | null>(null)

  // TanStack Query mutations
  const updateStatusMutation = useUpdateJobOrderStatus()
  const updateJobMutation = useUpdateJobOrder()
  const toggleImportantMutation = useToggleImportant()

  // Fetch available technicians when modal opens
  const { data: availableTechnicians = [] } = useAvailableTechnicians(
    showTechnicianModal ? jobOrder.date.split('T')[0] : undefined,
    showTechnicianModal ? jobOrder.timeRange.start : undefined,
    showTechnicianModal ? jobOrder.timeRange.end : undefined
  )

  const getStatusColor = useCallback((status: JobStatus) => {
    return STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'
  }, [])

  const calculateDuration = useCallback((start: string, end: string) => {
    const startTime = new Date(`2000-01-01T${start}:00`)
    const endTime = new Date(`2000-01-01T${end}:00`)
    const diffMs = endTime.getTime() - startTime.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${diffHours}h ${diffMinutes}m`
  }, [])

  const handleStatusUpdate = useCallback(async (newStatus: JobStatus) => {
    updateStatusMutation.mutate(
      { id: jobOrder._id, status: newStatus },
      {
        onSuccess: () => {
          setShowStatusModal(false)
        }
      }
    )
  }, [jobOrder._id, updateStatusMutation])

  const handleJobTaskUpdate = useCallback(async (taskIndex: number, newStatus: JobItemStatus) => {
    setUpdatingTaskIndex(taskIndex)
    
    const updatedJobList = [...jobOrder.jobList]
    updatedJobList[taskIndex] = {
      ...updatedJobList[taskIndex],
      status: newStatus
    }

    updateJobMutation.mutate(
      { id: jobOrder._id, updates: { jobList: updatedJobList } },
      {
        onSettled: () => {
          setUpdatingTaskIndex(null)
        }
      }
    )
  }, [jobOrder._id, jobOrder.jobList, updateJobMutation])

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }, [])

  const calculateDaysInWorkshop = useCallback(() => {
    if (!jobOrder.originalCreatedDate) return 0
    const today = new Date()
    const createdDate = new Date(jobOrder.originalCreatedDate)
    const diffTime = Math.abs(today.getTime() - createdDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }, [jobOrder.originalCreatedDate])

  const toggleImportant = useCallback(async () => {
    toggleImportantMutation.mutate(jobOrder._id)
  }, [jobOrder._id, toggleImportantMutation])

  const handlePartAvailabilityUpdate = useCallback(async (partIndex: number, newAvailability: 'Available' | 'Unavailable') => {
    setUpdatingPartIndex(partIndex)
    
    const updatedParts = [...jobOrder.parts]
    updatedParts[partIndex] = {
      ...updatedParts[partIndex],
      availability: newAvailability
    }
    
    // Check if all parts will be available after this update
    const allPartsAvailable = updatedParts.every(part => part.availability === 'Available')
    const hasUnavailableParts = updatedParts.some(part => part.availability === 'Unavailable')
    const wasWaitingParts = jobOrder.status === 'WP'
    
    updateJobMutation.mutate(
      { id: jobOrder._id, updates: { parts: updatedParts } },
      {
        onSettled: () => {
          setUpdatingPartIndex(null)
        },
        onSuccess: () => {
          // If all parts are now available and job was in WP status, show guidance message
          if (allPartsAvailable && wasWaitingParts) {
            toast.success('All parts are now available! Please replot this job by assigning a technician and setting the time range to add it back to the job control board.', { duration: 7000 })
          }
          
          // If parts became unavailable, notify user about re-plotting requirement
          if (hasUnavailableParts && newAvailability === 'Unavailable' && !wasWaitingParts) {
            toast.error('Part marked unavailable. Job removed from job control board and will need to be re-plotted once parts are available.', { duration: 6000 })
          }
        }
      }
    )
  }, [jobOrder._id, jobOrder.parts, jobOrder.status, updateJobMutation])

  const handleTechnicianReassign = useCallback(async (technicianId: string) => {
    updateJobMutation.mutate(
      { id: jobOrder._id, updates: { assignedTechnician: technicianId } },
      {
        onSuccess: () => {
          setShowTechnicianModal(false)
        }
      }
    )
  }, [jobOrder._id, updateJobMutation])

  const totalTasks = jobOrder.jobList.length
  const finishedTasks = jobOrder.jobList.filter(j => j.status === 'Finished').length
  const partsAvailable = jobOrder.parts.filter(p => p.availability === 'Available').length
  const partsTotal = jobOrder.parts.length

  const stop = (e: MouseEvent) => e.stopPropagation()

  return (
    <div
      className="floating-card p-4 relative group cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-xl"
      onClick={() => onClick?.(jobOrder)}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `Open details for job ${jobOrder.jobNumber}` : undefined}
    >
      {/* Left status accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${STATUS_ACCENT[jobOrder.status]}`}></div>
      {/* Important Star Button */}
      <button
        onClick={(e) => { stop(e); toggleImportant() }}
        disabled={toggleImportantMutation.isPending}
        className={`absolute top-3 right-3 text-2xl transition-all ${jobOrder.isImportant ? 'text-yellow-400 drop-shadow-lg' : 'text-gray-300'} hover:text-yellow-400 hover:scale-125 hover:drop-shadow-xl`}
        title={jobOrder.isImportant ? 'Remove from important' : 'Mark as important'}
      >
        {jobOrder.isImportant ? '★' : '☆'}
      </button>

      {/* Source Type & Carried Over Badge */}
      <div className="absolute top-3 left-3 flex gap-1.5">
        {jobOrder.sourceType === 'appointment' && (
          <div className="bg-blue-500/20 backdrop-blur-sm text-blue-700 px-2 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 border border-blue-300/30">
            <FiCalendar size={14} />
            <span>Appointment</span>
          </div>
        )}
        {jobOrder.sourceType === 'carry-over' && (
          <div className="bg-purple-500/20 backdrop-blur-sm text-purple-700 px-2 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 border border-purple-300/30">
            <FiRefreshCw size={14} />
            <span>Carry-over</span>
          </div>
        )}
        {jobOrder.carriedOver && (
          <div className="bg-red-500/20 backdrop-blur-sm text-red-700 px-2 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 border border-red-300/30">
            <FiAlertTriangle size={14} />
            <span>Carried</span>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex justify-between items-start mb-4 mt-8">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900 tracking-tight">{jobOrder.jobNumber}</h3>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-600 uppercase">
              <FiClock />
              {jobOrder.timeRange.start}–{jobOrder.timeRange.end}
            </span>
          </div>
          <p className="text-xs text-gray-600 font-medium mt-0.5">{formatDate(jobOrder.date)}</p>
        </div>
        <div className="flex flex-col items-end space-y-1 mr-8">
          <span className={`px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-sm ${getStatusColor(jobOrder.status)}`}>
            {STATUS_LABELS[jobOrder.status]}
          </span>
          <button
            onClick={(e) => { stop(e); setShowStatusModal(true) }}
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline transition-all"
          >
            Change
          </button>
        </div>
      </div>

      {/* Info Grid - Compact */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
        <div className="bg-white/50 backdrop-blur-sm rounded-xl p-2.5 border border-white/50">
          <div className="flex items-center gap-2 text-gray-600 font-medium">
            <FiTool />
            <span>Plate</span>
          </div>
          <p className="font-bold text-gray-900 mt-0.5">{jobOrder.plateNumber}</p>
        </div>
        <div className="bg-white/50 backdrop-blur-sm rounded-xl p-2.5 border border-white/50">
          <div className="flex items-center gap-2 text-gray-600 font-medium">
            <FiPackage />
            <span>VIN</span>
          </div>
          <p className="font-bold text-gray-900 font-mono truncate mt-0.5">{jobOrder.vin}</p>
        </div>
        <div className="bg-white/50 backdrop-blur-sm rounded-xl p-2.5 border border-white/50">
          <div className="flex items-center gap-2 text-gray-600 font-medium">
            <FiClock />
            <span>Duration</span>
          </div>
          <p className="font-bold text-gray-900 mt-0.5">{calculateDuration(jobOrder.timeRange.start, jobOrder.timeRange.end)}</p>
        </div>
        <div className="bg-white/50 backdrop-blur-sm rounded-xl p-2.5 border border-white/50">
          <div className="flex justify-between items-center mb-0.5">
            <span className="flex items-center gap-2 text-gray-600 font-medium">
              <FiUser />
              Technician
            </span>
            <button
              onClick={(e) => { stop(e); setShowTechnicianModal(true) }}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline"
            >
              {jobOrder.assignedTechnician ? 'Reassign' : 'Assign'}
            </button>
          </div>
          <p className="font-bold truncate">
            {jobOrder.assignedTechnician ? (
              <span className="text-gray-900">
                {jobOrder.assignedTechnician.name}
                {jobOrder.assignedTechnician.level && (
                  <span className="ml-1 text-xs text-gray-600 font-medium">({jobOrder.assignedTechnician.level})</span>
                )}
              </span>
            ) : (
              <span className="text-red-600 font-bold flex items-center gap-1">
                <FiAlertTriangle size={14} />
                Needs Assignment
              </span>
            )}
          </p>
        </div>
        <div className="bg-white/50 backdrop-blur-sm rounded-xl p-2.5 border border-white/50">
          <span className="text-gray-600 font-medium">Service Advisor</span>
          <p className="font-bold text-gray-900 mt-0.5 truncate">
            {jobOrder.serviceAdvisor ? (
              <span className="text-gray-900">{jobOrder.serviceAdvisor.name}</span>
            ) : (
              <span className="text-red-600 font-bold flex items-center gap-1">
                <FiAlertTriangle size={14} />
                Required
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Job & Parts - Compact */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/50 backdrop-blur-sm rounded-xl p-2.5 border border-white/50 text-xs">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600 font-semibold">Tasks ({finishedTasks}/{totalTasks})</span>
            <button
              onClick={(e) => { stop(e); setShowJobTasksModal(true) }}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline"
            >
              Manage
            </button>
          </div>
          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-2 bg-green-500 rounded-full transition-all"
              style={{ width: `${totalTasks === 0 ? 0 : Math.round((finishedTasks / totalTasks) * 100)}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-gray-600 font-medium">
            {totalTasks} task{totalTasks !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="bg-white/50 backdrop-blur-sm rounded-xl p-2.5 border border-white/50 text-xs">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600 font-semibold">Parts ({partsAvailable}/{partsTotal})</span>
            <button
              onClick={(e) => { stop(e); setShowPartsModal(true) }}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline"
            >
              Manage
            </button>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold">
            {partsTotal === 0 && <span className="text-gray-600">No parts</span>}
            {partsTotal > 0 && partsAvailable === partsTotal && (
              <span className="text-green-600">All available</span>
            )}
            {partsTotal > 0 && partsAvailable < partsTotal && (
              <span className="text-red-600">{partsTotal - partsAvailable} missing</span>
            )}
          </div>
        </div>
      </div>

      {/* Days in Workshop - Only for WP, HC, HW, HI, carry-over */}
      {(['WP', 'HC', 'HW', 'HI'].includes(jobOrder.status) || jobOrder.carriedOver) && (
        <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs">
          <span className="text-orange-700 font-semibold">
            📊 Days in Workshop: {calculateDaysInWorkshop()} day{calculateDaysInWorkshop() !== 1 ? 's' : ''}
          </span>
          {jobOrder.originalCreatedDate && (
            <span className="text-orange-600 ml-2 font-medium">
              (Created: {formatDate(jobOrder.originalCreatedDate)})
            </span>
          )}
        </div>
      )}

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="modal-backdrop">
          <div className="floating-card max-w-md w-full animate-fade-in">
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-gray-900">Change Job Order Status</h3>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-sm text-gray-700 font-medium">
                  Current status: <span className="font-bold">{STATUS_LABELS[jobOrder.status]}</span>
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(STATUS_LABELS).map(([status, label]) => (
                    <button
                      key={status}
                      onClick={() => handleStatusUpdate(status as JobStatus)}
                      disabled={updateStatusMutation.isPending || status === jobOrder.status}
                      className={`p-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        status === jobOrder.status
                          ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed border border-gray-300/30'
                          : 'bg-blue-500/20 text-blue-700 hover:bg-blue-500/30 border border-blue-300/30 hover:shadow-lg hover:-translate-y-0.5'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Job Tasks Modal */}
      {showJobTasksModal && (
        <div className="modal-backdrop">
          <div className="floating-card max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-gray-900">Manage Job Tasks</h3>
                <button
                  onClick={() => setShowJobTasksModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-3">
                {jobOrder.jobList.map((job, index) => (
                  <div key={index} className="bg-white/50 backdrop-blur-sm border border-white/50 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-gray-900">{job.description}</h4>
                      <span className={`px-3 py-1 rounded-xl text-xs font-semibold backdrop-blur-sm ${
                        job.status === 'Finished' 
                          ? 'bg-green-500/20 text-green-700 border border-green-300/30' 
                          : 'bg-gray-500/20 text-gray-700 border border-gray-300/30'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleJobTaskUpdate(index, 'Finished')}
                        disabled={updatingTaskIndex === index || job.status === 'Finished'}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                          job.status === 'Finished'
                            ? 'bg-green-500/20 text-green-400 cursor-not-allowed border border-green-300/30'
                            : 'bg-green-500/20 text-green-700 hover:bg-green-500/30 border border-green-300/30 hover:shadow-lg hover:-translate-y-0.5'
                        }`}
                      >
                        Mark Finished
                      </button>
                      <button
                        onClick={() => handleJobTaskUpdate(index, 'Unfinished')}
                        disabled={updatingTaskIndex === index || job.status === 'Unfinished'}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                          job.status === 'Unfinished'
                            ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed border border-gray-300/30'
                            : 'bg-gray-500/20 text-gray-700 hover:bg-gray-500/30 border border-gray-300/30 hover:shadow-lg hover:-translate-y-0.5'
                        }`}
                      >
                        Mark Unfinished
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Parts Management Modal */}
      {showPartsModal && (
        <div className="modal-backdrop">
          <div className="floating-card max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-gray-900">Manage Parts Availability</h3>
                <button
                  onClick={() => setShowPartsModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-3">
                {jobOrder.parts.map((part, index) => (
                  <div key={index} className="bg-white/50 backdrop-blur-sm border border-white/50 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-bold text-gray-900">{part.name}</h4>
                      <span className={`px-3 py-1 rounded-xl text-xs font-semibold backdrop-blur-sm ${
                        part.availability === 'Available' 
                          ? 'bg-green-500/20 text-green-700 border border-green-300/30' 
                          : 'bg-red-500/20 text-red-700 border border-red-300/30'
                      }`}>
                        {part.availability}
                      </span>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handlePartAvailabilityUpdate(index, 'Available')}
                        disabled={updatingPartIndex === index || part.availability === 'Available'}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                          part.availability === 'Available'
                            ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed border border-gray-300/30'
                            : 'bg-green-500/20 text-green-700 hover:bg-green-500/30 border border-green-300/30 hover:shadow-lg hover:-translate-y-0.5'
                        }`}
                      >
                        Mark Available
                      </button>
                      <button
                        onClick={() => handlePartAvailabilityUpdate(index, 'Unavailable')}
                        disabled={updatingPartIndex === index || part.availability === 'Unavailable'}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                          part.availability === 'Unavailable'
                            ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed border border-gray-300/30'
                            : 'bg-red-500/20 text-red-700 hover:bg-red-500/30 border border-red-300/30 hover:shadow-lg hover:-translate-y-0.5'
                        }`}
                      >
                        Mark Unavailable
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Technician Reassignment Modal */}
      {showTechnicianModal && (
        <div className="modal-backdrop">
          <div className="floating-card max-w-md w-full animate-fade-in">
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-gray-900">Reassign Technician</h3>
                <button
                  onClick={() => setShowTechnicianModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-sm text-gray-700 font-medium">
                  Current: <span className="font-bold">
                    {jobOrder.assignedTechnician ? jobOrder.assignedTechnician.name : (
                      <span className="text-red-600">Not Assigned</span>
                    )}
                  </span>
                </p>
                
                <div className="space-y-2">
                  <p className="text-sm font-bold text-gray-800">Available Technicians:</p>
                  {availableTechnicians.length === 0 ? (
                    <p className="text-sm text-gray-600 font-medium">No available technicians for this time slot</p>
                  ) : (
                    availableTechnicians.map((tech: any) => (
                      <button
                        key={tech._id}
                        onClick={() => handleTechnicianReassign(tech._id)}
                        disabled={updateJobMutation.isPending === true || (jobOrder.assignedTechnician?._id === tech._id)}
                        className={`w-full p-3 rounded-xl text-sm font-semibold text-left transition-all duration-200 ${
                          jobOrder.assignedTechnician && tech._id === jobOrder.assignedTechnician._id
                            ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed border border-gray-300/30'
                            : 'bg-blue-500/20 text-blue-700 hover:bg-blue-500/30 border border-blue-300/30 hover:shadow-lg hover:-translate-y-0.5'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <span>{tech.name}</span>
                            {tech.level && (
                              <span className="text-xs text-gray-600 font-medium">Level: {tech.level}</span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Memoize component to prevent unnecessary re-renders
export default memo(JobOrderCard, (prevProps, nextProps) => {
  return prevProps.jobOrder._id === nextProps.jobOrder._id &&
         prevProps.jobOrder.status === nextProps.jobOrder.status &&
         prevProps.jobOrder.isImportant === nextProps.jobOrder.isImportant &&
         JSON.stringify(prevProps.jobOrder.jobList) === JSON.stringify(nextProps.jobOrder.jobList) &&
         JSON.stringify(prevProps.jobOrder.parts) === JSON.stringify(nextProps.jobOrder.parts)
})
