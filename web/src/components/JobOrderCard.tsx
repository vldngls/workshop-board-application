'use client'

import { useState, memo, useCallback, MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { 
  FiCalendar, 
  FiRefreshCw, 
  FiAlertTriangle, 
  FiClock, 
  FiUser, 
  FiTool, 
  FiPackage,
  FiEdit3,
  FiCheck,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiPlus,
  FiTrash2,
  FiInfo
} from 'react-icons/fi'
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
  const [isExpanded, setIsExpanded] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [updatingTaskIndex, setUpdatingTaskIndex] = useState<number | null>(null)
  const [updatingPartIndex, setUpdatingPartIndex] = useState<number | null>(null)

  // TanStack Query mutations
  const updateStatusMutation = useUpdateJobOrderStatus()
  const updateJobMutation = useUpdateJobOrder()
  const toggleImportantMutation = useToggleImportant()

  // Fetch available technicians when needed
  const { data: availableTechnicians = [] } = useAvailableTechnicians(
    jobOrder.date.split('T')[0],
    jobOrder.timeRange.start,
    jobOrder.timeRange.end
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

  const handleStatusUpdate = useCallback(async (newStatus: JobStatus) => {
    updateStatusMutation.mutate(
      { id: jobOrder._id, status: newStatus },
      {
        onSuccess: () => {
          setEditingField(null)
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

  const handlePartAvailabilityUpdate = useCallback(async (partIndex: number, newAvailability: 'Available' | 'Unavailable') => {
    setUpdatingPartIndex(partIndex)
    
    const updatedParts = [...jobOrder.parts]
    updatedParts[partIndex] = {
      ...updatedParts[partIndex],
      availability: newAvailability
    }
    
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
          if (allPartsAvailable && wasWaitingParts) {
            toast.success('All parts are now available! Please replot this job by assigning a technician and setting the time range to add it back to the job control board.', { duration: 7000 })
          }
          
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
          setEditingField(null)
        }
      }
    )
  }, [jobOrder._id, updateJobMutation])

  const handleFieldEdit = useCallback((field: string, currentValue: string) => {
    setEditingField(field)
    setEditingValue(currentValue)
  }, [])

  const handleFieldSave = useCallback(async () => {
    if (!editingField) return

    const updates: any = {}
    
    switch (editingField) {
      case 'plateNumber':
        updates.plateNumber = editingValue.toUpperCase()
        break
      case 'vin':
        updates.vin = editingValue.toUpperCase()
        break
      case 'timeRange':
        const [start, end] = editingValue.split('-')
        if (start && end) {
          updates.timeRange = { start: start.trim(), end: end.trim() }
        }
        break
      default:
        return
    }

    updateJobMutation.mutate(
      { id: jobOrder._id, updates },
      {
        onSuccess: () => {
          setEditingField(null)
          setEditingValue('')
        }
      }
    )
  }, [editingField, editingValue, jobOrder._id, updateJobMutation])

  const handleFieldCancel = useCallback(() => {
    setEditingField(null)
    setEditingValue('')
  }, [])

  const toggleImportant = useCallback(async () => {
    toggleImportantMutation.mutate(jobOrder._id)
  }, [jobOrder._id, toggleImportantMutation])

  const totalTasks = jobOrder.jobList.length
  const finishedTasks = jobOrder.jobList.filter(j => j.status === 'Finished').length
  const partsAvailable = jobOrder.parts.filter(p => p.availability === 'Available').length
  const partsTotal = jobOrder.parts.length

  const stop = (e: MouseEvent) => e.stopPropagation()

  return (
    <div
      className="floating-card p-3 relative group transition-all duration-300 hover:shadow-lg hover:bg-white/80 w-full"
      onClick={() => onClick?.(jobOrder)}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `Open details for job ${jobOrder.jobNumber}` : undefined}
    >
      {/* Left status accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${STATUS_ACCENT[jobOrder.status]} rounded-l-2xl`}></div>
      
      {/* Important Star Button */}
      <button
        onClick={(e) => { stop(e); toggleImportant() }}
        disabled={toggleImportantMutation.isPending}
        className={`absolute top-3 right-3 text-xl transition-all duration-200 ${
          jobOrder.isImportant 
            ? 'text-yellow-400 drop-shadow-lg' 
            : 'text-gray-300 hover:text-yellow-400'
        } hover:scale-125 hover:drop-shadow-xl`}
        title={jobOrder.isImportant ? 'Remove from important' : 'Mark as important'}
      >
        {jobOrder.isImportant ? '★' : '☆'}
      </button>

      {/* Source Type & Carried Over Badge */}
      <div className="absolute top-3 left-3 flex gap-1.5">
        {jobOrder.sourceType === 'appointment' && (
          <div className="bg-blue-500/20 backdrop-blur-sm text-blue-700 px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border border-blue-300/30">
            <FiCalendar size={12} />
            <span>Appointment</span>
          </div>
        )}
        {jobOrder.sourceType === 'carry-over' && (
          <div className="bg-purple-500/20 backdrop-blur-sm text-purple-700 px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border border-purple-300/30">
            <FiRefreshCw size={12} />
            <span>Carry-over</span>
          </div>
        )}
        {jobOrder.carriedOver && (
          <div className="bg-red-500/20 backdrop-blur-sm text-red-700 px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border border-red-300/30">
            <FiAlertTriangle size={12} />
            <span>Carried</span>
          </div>
        )}
      </div>

      {/* Main Content - Enhanced Visual Hierarchy */}
      <div className="flex items-start justify-between gap-12 mt-4 w-full">
        {/* Column 1: Job Info */}
        <div className="flex flex-col space-y-2 min-w-0 flex-1">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">{jobOrder.jobNumber}</h3>
            <div className="h-0.5 w-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"></div>
          </div>
          <div className="flex items-center gap-2 text-gray-700 bg-gray-50 px-2 py-1 rounded-md">
            <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
              <FiClock size={12} className="text-blue-600" />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-900">{jobOrder.timeRange.start}–{jobOrder.timeRange.end}</div>
              <div className="text-xs text-gray-500">Hours</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-700 bg-gray-50 px-2 py-1 rounded-md">
            <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
              <FiCalendar size={12} className="text-green-600" />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-900">{formatDate(jobOrder.date)}</div>
              <div className="text-xs text-gray-500">Created</div>
            </div>
          </div>
        </div>

        {/* Column 2: Personnel */}
        <div className="flex flex-col space-y-2 min-w-0 w-48">
          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 shadow-sm">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Technician</div>
            {editingField === 'technician' ? (
              <div className="space-y-1">
                {availableTechnicians.slice(0, 3).map((tech: any) => (
                  <button
                    key={tech._id}
                    onClick={(e) => { stop(e); handleTechnicianReassign(tech._id) }}
                    className="block w-full p-1.5 rounded text-xs font-semibold text-left bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-all"
                  >
                    {tech.name}
                  </button>
                ))}
                <button
                  onClick={(e) => { stop(e); handleFieldCancel() }}
                  className="block w-full p-1.5 rounded text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  {jobOrder.assignedTechnician ? (
                    <div>
                      <div className="text-sm font-bold text-gray-900 truncate">
                        {jobOrder.assignedTechnician.name}
                      </div>
                      {jobOrder.assignedTechnician.level && (
                        <div className="text-xs text-blue-600 font-medium">L{jobOrder.assignedTechnician.level}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-red-600 font-bold flex items-center gap-1">
                      <FiAlertTriangle size={12} />
                      <span className="text-xs">Unassigned</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => { stop(e); handleFieldEdit('technician', '') }}
                  className="text-gray-400 hover:text-blue-600 transition-colors p-0.5 rounded hover:bg-gray-100"
                >
                  <FiEdit3 size={14} />
                </button>
              </div>
            )}
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 shadow-sm">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Service Advisor</div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                {jobOrder.serviceAdvisor ? (
                  <div>
                    <div className="text-sm font-bold text-gray-900 truncate">{jobOrder.serviceAdvisor.name}</div>
                    <div className="text-xs text-green-600 font-medium">Assigned</div>
                  </div>
                ) : (
                  <div className="text-red-600 font-bold flex items-center gap-1">
                    <FiAlertTriangle size={12} />
                    <span className="text-xs">Required</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Vehicle Info */}
        <div className="flex flex-col space-y-2 min-w-0 w-52">
          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 shadow-sm">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Plate Number</div>
            {editingField === 'plateNumber' ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  className="w-full px-2 py-1 text-sm font-bold border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFieldSave()
                    if (e.key === 'Escape') handleFieldCancel()
                  }}
                />
                <button onClick={(e) => { stop(e); handleFieldSave() }} className="text-green-600 p-0.5 rounded hover:bg-green-50">
                  <FiCheck size={14} />
                </button>
                <button onClick={(e) => { stop(e); handleFieldCancel() }} className="text-red-600 p-0.5 rounded hover:bg-red-50">
                  <FiX size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="text-lg font-black text-gray-900 tracking-wide">{jobOrder.plateNumber}</div>
                </div>
                <button
                  onClick={(e) => { stop(e); handleFieldEdit('plateNumber', jobOrder.plateNumber) }}
                  className="text-gray-400 hover:text-blue-600 transition-colors p-0.5 rounded hover:bg-gray-100"
                >
                  <FiEdit3 size={14} />
                </button>
              </div>
            )}
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-2 shadow-sm">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">VIN</div>
            {editingField === 'vin' ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  className="w-full px-2 py-1 text-xs font-bold border border-gray-300 rounded font-mono focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFieldSave()
                    if (e.key === 'Escape') handleFieldCancel()
                  }}
                />
                <button onClick={(e) => { stop(e); handleFieldSave() }} className="text-green-600 p-0.5 rounded hover:bg-green-50">
                  <FiCheck size={14} />
                </button>
                <button onClick={(e) => { stop(e); handleFieldCancel() }} className="text-red-600 p-0.5 rounded hover:bg-red-50">
                  <FiX size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="text-sm font-bold text-gray-900 font-mono tracking-wide">{jobOrder.vin}</div>
                </div>
                <button
                  onClick={(e) => { stop(e); handleFieldEdit('vin', jobOrder.vin) }}
                  className="text-gray-400 hover:text-blue-600 transition-colors p-0.5 rounded hover:bg-gray-100"
                >
                  <FiEdit3 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Column 4: Progress & Parts */}
        <div className="flex flex-col space-y-2 min-w-0 w-44">
          <div className="text-center bg-white/60 backdrop-blur-sm rounded-lg p-2 shadow-sm">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Progress</div>
            <div className="w-28 h-3 bg-gray-200 rounded-full overflow-hidden mb-1 mx-auto">
              <div
                className="h-3 bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-700 shadow-sm"
                style={{ width: `${totalTasks === 0 ? 0 : Math.round((finishedTasks / totalTasks) * 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="text-sm font-bold text-gray-900">{finishedTasks}/{totalTasks}</div>
              <div className="text-xs text-gray-500 font-medium">
                {totalTasks > 0 ? Math.round((finishedTasks / totalTasks) * 100) : 0}%
              </div>
            </div>
          </div>

          <div className="text-center bg-white/60 backdrop-blur-sm rounded-lg p-2 shadow-sm">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Parts Status</div>
            {partsTotal === 0 ? (
              <div className="text-xs text-gray-500 font-medium bg-gray-50 px-2 py-1 rounded">No Parts Required</div>
            ) : (
              <>
                <div className="w-28 h-3 bg-gray-200 rounded-full overflow-hidden mb-1 mx-auto">
                  <div
                    className="h-3 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-700 shadow-sm"
                    style={{ width: `${Math.round((partsAvailable / partsTotal) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-center gap-2">
                  <div className="text-sm font-bold text-gray-900">{partsAvailable}/{partsTotal}</div>
                  <div className="text-xs text-gray-500 font-medium">
                    {Math.round((partsAvailable / partsTotal) * 100)}%
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Column 5: Status & Expand */}
        <div className="flex flex-col items-center gap-3 min-w-0 w-40">
          <div className="text-center w-full">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status</div>
            {editingField === 'status' ? (
              createPortal(
                <div 
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setEditingField(null)
                    }
                  }}
                >
                  <div className="bg-white rounded-2xl border-2 border-gray-200 p-6 shadow-2xl max-w-md w-full mx-4">
                    <div className="text-lg font-bold text-gray-800 mb-4 text-center">Select New Status for {jobOrder.jobNumber}</div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {Object.entries(STATUS_LABELS).map(([status, label]) => (
                        <button
                          key={status}
                          onClick={(e) => { stop(e); handleStatusUpdate(status as JobStatus) }}
                          disabled={updateStatusMutation.isPending || status === jobOrder.status}
                          className={`p-4 rounded-xl text-sm font-semibold transition-all border-2 ${
                            status === jobOrder.status
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 hover:border-blue-300 hover:shadow-lg hover:scale-105'
                          }`}
                        >
                          <div className="text-center">
                            <div className="font-bold text-base">{label}</div>
                            <div className="text-xs opacity-75 mt-1">({status})</div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={(e) => { stop(e); setEditingField(null) }}
                      className="w-full p-3 text-sm text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>,
                document.body
              )
            ) : (
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={(e) => { stop(e); handleFieldEdit('status', jobOrder.status) }}
                  className={`px-4 py-3 rounded-lg text-sm font-bold backdrop-blur-sm shadow-sm transition-all hover:shadow-md hover:scale-105 cursor-pointer border-2 border-transparent hover:border-white/30 ${getStatusColor(jobOrder.status)}`}
                  title="Click to change status"
                >
                  {STATUS_LABELS[jobOrder.status]}
                </button>
                <div className="text-xs text-gray-500 text-center">
                  Click status to change
                </div>
              </div>
            )}
          </div>

          <div className="text-center">
            <button
              onClick={(e) => { stop(e); setIsExpanded(!isExpanded) }}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100 bg-white/60 backdrop-blur-sm shadow-sm"
              title={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              {isExpanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Details - Optimized Horizontal Layout */}
      {isExpanded && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Tasks Section */}
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 border border-white/50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <FiTool size={18} />
                  Tasks Progress
                </h4>
                <div className="text-sm text-gray-600 font-semibold">
                  {finishedTasks}/{totalTasks} ({totalTasks > 0 ? Math.round((finishedTasks / totalTasks) * 100) : 0}%)
                </div>
              </div>
              <div className="space-y-3">
                {jobOrder.jobList.map((task, index) => (
                  <div key={index} className="p-3 bg-white/50 rounded-lg border border-white/30">
                    <div className="mb-2">
                      <span className="font-medium text-gray-800 text-sm">{task.description}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { stop(e); handleJobTaskUpdate(index, 'Finished') }}
                        disabled={updatingTaskIndex === index || task.status === 'Finished'}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          task.status === 'Finished'
                            ? 'bg-green-500 text-white shadow-sm cursor-not-allowed'
                            : 'bg-green-500/20 text-green-700 hover:bg-green-500/30 hover:shadow-md'
                        }`}
                      >
                        {updatingTaskIndex === index ? '...' : '✓ Finished'}
                      </button>
                      <button
                        onClick={(e) => { stop(e); handleJobTaskUpdate(index, 'Unfinished') }}
                        disabled={updatingTaskIndex === index || task.status === 'Unfinished'}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          task.status === 'Unfinished'
                            ? 'bg-red-500 text-white shadow-sm cursor-not-allowed'
                            : 'bg-red-500/20 text-red-700 hover:bg-red-500/30 hover:shadow-md'
                        }`}
                      >
                        {updatingTaskIndex === index ? '...' : '✗ Unfinished'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Parts Section */}
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 border border-white/50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <FiPackage size={18} />
                  Parts Status
                </h4>
                <div className="text-sm text-gray-600 font-semibold">
                  {partsAvailable}/{partsTotal} ({partsTotal > 0 ? Math.round((partsAvailable / partsTotal) * 100) : 0}%)
                </div>
              </div>
              <div className="space-y-3">
                {jobOrder.parts.map((part, index) => (
                  <div key={index} className="p-3 bg-white/50 rounded-lg border border-white/30">
                    <div className="mb-2">
                      <span className="font-medium text-gray-800 text-sm">{part.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { stop(e); handlePartAvailabilityUpdate(index, 'Available') }}
                        disabled={updatingPartIndex === index || part.availability === 'Available'}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          part.availability === 'Available'
                            ? 'bg-green-500 text-white shadow-sm cursor-not-allowed'
                            : 'bg-green-500/20 text-green-700 hover:bg-green-500/30 hover:shadow-md'
                        }`}
                      >
                        {updatingPartIndex === index ? '...' : '✓ Available'}
                      </button>
                      <button
                        onClick={(e) => { stop(e); handlePartAvailabilityUpdate(index, 'Unavailable') }}
                        disabled={updatingPartIndex === index || part.availability === 'Unavailable'}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          part.availability === 'Unavailable'
                            ? 'bg-red-500 text-white shadow-sm cursor-not-allowed'
                            : 'bg-red-500/20 text-red-700 hover:bg-red-500/30 hover:shadow-md'
                        }`}
                      >
                        {updatingPartIndex === index ? '...' : '✗ Unavailable'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Service Advisor & Additional Info Section */}
            <div className="space-y-4">
              {/* Service Advisor */}
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 border border-white/50">
                <h4 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
                  <FiUser size={18} />
                  Service Advisor
                </h4>
                <div className="p-4 bg-white/50 rounded-lg border border-white/30">
                  {jobOrder.serviceAdvisor ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">{jobOrder.serviceAdvisor.name}</p>
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">
                          Assigned
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{jobOrder.serviceAdvisor.email}</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-red-600 font-semibold">No service advisor assigned</span>
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold">
                        Required
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Job Details Summary */}
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 border border-white/50">
                <h4 className="text-base font-bold text-gray-800 flex items-center gap-2 mb-4">
                  <FiInfo size={18} />
                  Job Summary
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 bg-white/50 rounded-lg">
                    <span className="text-sm text-gray-600">Created By:</span>
                    <span className="text-sm font-semibold text-gray-800">{jobOrder.createdBy?.name || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-white/50 rounded-lg">
                    <span className="text-sm text-gray-600">Source:</span>
                    <span className="text-sm font-semibold text-gray-800 capitalize">
                      {jobOrder.sourceType?.replace('-', ' ') || 'Direct'}
                    </span>
                  </div>
                  {jobOrder.carriedOver && (
                    <div className="flex justify-between items-center p-2 bg-orange-100 rounded-lg">
                      <span className="text-sm text-orange-700">Carried Over:</span>
                      <span className="text-sm font-semibold text-orange-800">Yes</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center p-2 bg-white/50 rounded-lg">
                    <span className="text-sm text-gray-600">Last Updated:</span>
                    <span className="text-sm font-semibold text-gray-800">
                      {formatDate(jobOrder.updatedAt)}
                    </span>
                  </div>
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