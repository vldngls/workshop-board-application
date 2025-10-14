'use client'

import { useState, memo, useCallback } from 'react'
import toast from 'react-hot-toast'
import type { JobOrder, JobStatus, JobItemStatus } from '@/types/jobOrder'
import { 
  useUpdateJobOrderStatus, 
  useUpdateJobOrder, 
  useToggleImportant,
  useAvailableTechnicians 
} from '@/hooks/useJobOrders'

interface JobOrderCardProps {
  jobOrder: JobOrder
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
  'OG': 'bg-blue-100 text-blue-800',
  'WP': 'bg-yellow-100 text-yellow-800',
  'FP': 'bg-cyan-100 text-cyan-800',
  'QI': 'bg-purple-100 text-purple-800',
  'HC': 'bg-orange-100 text-orange-800',
  'HW': 'bg-red-100 text-red-800',
  'HI': 'bg-pink-100 text-pink-800',
  'FR': 'bg-green-100 text-green-800',
  'FU': 'bg-gray-100 text-gray-800',
  'CP': 'bg-emerald-100 text-emerald-800'
}

function JobOrderCard({ jobOrder }: JobOrderCardProps) {
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
            toast.success('All parts are now available! Please replot this job by assigning a technician and setting the time range to add it back to the workshop board.', { duration: 7000 })
          }
          
          // If parts became unavailable, notify user about re-plotting requirement
          if (hasUnavailableParts && newAvailability === 'Unavailable' && !wasWaitingParts) {
            toast.error('Part marked unavailable. Job removed from workshop board and will need to be re-plotted once parts are available.', { duration: 6000 })
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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow relative">
      {/* Important Star Button */}
      <button
        onClick={toggleImportant}
        disabled={toggleImportantMutation.isPending}
        className={`absolute top-2 right-2 text-xl transition-all ${jobOrder.isImportant ? 'text-yellow-500' : 'text-gray-300'} hover:text-yellow-500 hover:scale-110`}
        title={jobOrder.isImportant ? 'Remove from important' : 'Mark as important'}
      >
        {jobOrder.isImportant ? '★' : '☆'}
      </button>

      {/* Carried Over Badge */}
      {jobOrder.carriedOver && (
        <div className="absolute top-2 left-2 bg-red-100 text-red-800 px-1.5 py-0.5 rounded text-xs font-medium flex items-center gap-1">
          <span className="text-sm">🔄</span>
          <span>Carried</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-3 mt-6">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{jobOrder.jobNumber}</h3>
          <p className="text-xs text-gray-600">{formatDate(jobOrder.date)}</p>
        </div>
        <div className="flex flex-col items-end space-y-0.5 mr-6">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(jobOrder.status)}`}>
            {STATUS_LABELS[jobOrder.status]}
          </span>
          <button
            onClick={() => setShowStatusModal(true)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Change
          </button>
        </div>
      </div>

      {/* Info Grid - Compact */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div>
          <span className="text-gray-600">Plate:</span>
          <p className="font-medium text-gray-900">{jobOrder.plateNumber}</p>
        </div>
        <div>
          <span className="text-gray-600">VIN:</span>
          <p className="font-medium text-gray-900 font-mono truncate">{jobOrder.vin}</p>
        </div>
        <div>
          <span className="text-gray-600">Time:</span>
          <p className="font-medium text-gray-900">{jobOrder.timeRange.start} - {jobOrder.timeRange.end}</p>
        </div>
        <div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Technician:</span>
            <button
              onClick={() => setShowTechnicianModal(true)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {jobOrder.assignedTechnician ? 'Reassign' : 'Assign'}
            </button>
          </div>
          <p className="font-medium truncate">
            {jobOrder.assignedTechnician ? (
              <span className="text-gray-900">{jobOrder.assignedTechnician.name}</span>
            ) : (
              <span className="text-red-600 font-semibold">⚠️ Needs Assignment</span>
            )}
          </p>
        </div>
      </div>

      {/* Job & Parts - Compact */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="text-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="text-gray-600 font-medium">Tasks ({jobOrder.jobList.filter(j => j.status === 'Finished').length}/{jobOrder.jobList.length})</span>
            <button
              onClick={() => setShowJobTasksModal(true)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Manage
            </button>
          </div>
          <div className="text-xs text-gray-500">
            {jobOrder.jobList.length} task{jobOrder.jobList.length > 1 ? 's' : ''}
          </div>
        </div>
        <div className="text-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="text-gray-600 font-medium">Parts ({jobOrder.parts.filter(p => p.availability === 'Available').length}/{jobOrder.parts.length})</span>
            <button
              onClick={() => setShowPartsModal(true)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Manage
            </button>
          </div>
          <div className="text-xs text-gray-500">
            {jobOrder.parts.filter(p => p.availability === 'Unavailable').length > 0 && (
              <span className="text-red-600">{jobOrder.parts.filter(p => p.availability === 'Unavailable').length} missing</span>
            )}
            {jobOrder.parts.filter(p => p.availability === 'Unavailable').length === 0 && (
              <span className="text-green-600">All available</span>
            )}
          </div>
        </div>
      </div>

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="modal-backdrop">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Change Job Order Status</h3>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Current status: <span className="font-medium">{STATUS_LABELS[jobOrder.status]}</span>
                </p>
                
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(STATUS_LABELS).map(([status, label]) => (
                    <button
                      key={status}
                      onClick={() => handleStatusUpdate(status as JobStatus)}
                      disabled={updateStatusMutation.isPending || status === jobOrder.status}
                      className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                        status === jobOrder.status
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
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
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Manage Job Tasks</h3>
                <button
                  onClick={() => setShowJobTasksModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                {jobOrder.jobList.map((job, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium text-gray-900">{job.description}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        job.status === 'Finished' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleJobTaskUpdate(index, 'Finished')}
                        disabled={updatingTaskIndex === index || job.status === 'Finished'}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          job.status === 'Finished'
                            ? 'bg-green-100 text-green-400 cursor-not-allowed'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        Mark Finished
                      </button>
                      <button
                        onClick={() => handleJobTaskUpdate(index, 'Unfinished')}
                        disabled={updatingTaskIndex === index || job.status === 'Unfinished'}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          job.status === 'Unfinished'
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
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
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Manage Parts Availability</h3>
                <button
                  onClick={() => setShowPartsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                {jobOrder.parts.map((part, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium text-gray-900">{part.name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        part.availability === 'Available' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {part.availability}
                      </span>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handlePartAvailabilityUpdate(index, 'Available')}
                        disabled={updatingPartIndex === index || part.availability === 'Available'}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          part.availability === 'Available'
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        Mark Available
                      </button>
                      <button
                        onClick={() => handlePartAvailabilityUpdate(index, 'Unavailable')}
                        disabled={updatingPartIndex === index || part.availability === 'Unavailable'}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          part.availability === 'Unavailable'
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-red-50 text-red-700 hover:bg-red-100'
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Reassign Technician</h3>
                <button
                  onClick={() => setShowTechnicianModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Current: <span className="font-medium">
                    {jobOrder.assignedTechnician ? jobOrder.assignedTechnician.name : (
                      <span className="text-red-600">Not Assigned</span>
                    )}
                  </span>
                </p>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Available Technicians:</p>
                  {availableTechnicians.length === 0 ? (
                    <p className="text-sm text-gray-500">No available technicians for this time slot</p>
                  ) : (
                    availableTechnicians.map((tech: any) => (
                      <button
                        key={tech._id}
                        onClick={() => handleTechnicianReassign(tech._id)}
                        disabled={updateJobMutation.isPending || (jobOrder.assignedTechnician && tech._id === jobOrder.assignedTechnician._id)}
                        className={`w-full p-3 rounded-lg text-sm font-medium text-left transition-colors ${
                          jobOrder.assignedTechnician && tech._id === jobOrder.assignedTechnician._id
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>{tech.name}</span>
                          {tech.level && (
                            <span className="text-xs text-gray-500">{tech.level}</span>
                          )}
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
