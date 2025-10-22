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
  FiInfo,
  FiPlay,
  FiSend
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
  'UA': 'Unassigned',
  'QI': 'Quality Inspection',
  'HC': 'Hold Customer',
  'HW': 'Hold Warranty',
  'HI': 'Hold Insurance',
  'HF': 'Hold Ford',
  'SU': 'Sublet',
  'FR': 'For Release',
  'FU': 'Finished Unclaimed',
  'CP': 'Complete'
}

const STATUS_COLORS: Record<JobStatus, string> = {
  'OG': 'bg-blue-50 text-blue-700 border border-blue-200',
  'WP': 'bg-amber-50 text-amber-700 border border-amber-200',
  'UA': 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  'QI': 'bg-purple-50 text-purple-700 border border-purple-200',
  'HC': 'bg-orange-50 text-orange-700 border border-orange-200',
  'HW': 'bg-red-50 text-red-700 border border-red-200',
  'HI': 'bg-pink-50 text-pink-700 border border-pink-200',
  'HF': 'bg-pink-50 text-pink-700 border border-pink-200',
  'SU': 'bg-violet-50 text-violet-700 border border-violet-200',
  'FR': 'bg-green-50 text-green-700 border border-green-200',
  'FU': 'bg-gray-50 text-gray-700 border border-gray-200',
  'CP': 'bg-emerald-50 text-emerald-700 border border-emerald-200'
}

const STATUS_ACCENT: Record<JobStatus, string> = {
  'OG': 'bg-blue-500',
  'WP': 'bg-amber-500',
  'UA': 'bg-cyan-500',
  'QI': 'bg-purple-500',
  'HC': 'bg-orange-500',
  'HW': 'bg-red-500',
  'HI': 'bg-pink-500',
  'HF': 'bg-pink-500',
  'SU': 'bg-violet-500',
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
  const [editingTasks, setEditingTasks] = useState(false)
  const [tempJobList, setTempJobList] = useState(jobOrder.jobList)
  const [tempParts, setTempParts] = useState(jobOrder.parts)
  const [editingServiceAdvisor, setEditingServiceAdvisor] = useState(false)
  const [showStatusConfirm, setShowStatusConfirm] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<JobStatus | null>(null)

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

  // New functions for enhanced functionality
  const handleStatusChange = useCallback((newStatus: JobStatus) => {
    setPendingStatus(newStatus)
    setShowStatusConfirm(true)
  }, [])

  const confirmStatusChange = useCallback(async () => {
    if (!pendingStatus) return
    
    try {
      await updateStatusMutation.mutateAsync({
        id: jobOrder._id,
        status: pendingStatus
      })
      toast.success(`Status changed to ${STATUS_LABELS[pendingStatus]}`)
    } catch (error) {
      toast.error('Failed to update status')
    } finally {
      setShowStatusConfirm(false)
      setPendingStatus(null)
    }
  }, [jobOrder._id, pendingStatus, updateStatusMutation])

  const handleEditTasks = useCallback(() => {
    setEditingTasks(true)
    setTempJobList([...jobOrder.jobList])
    setTempParts([...jobOrder.parts])
  }, [jobOrder.jobList, jobOrder.parts])

  const handleSaveTasks = useCallback(async () => {
    try {
      await updateJobMutation.mutateAsync({
        id: jobOrder._id,
        updates: {
          jobList: tempJobList.filter(task => task.description.trim() !== ''),
          parts: tempParts.filter(part => part.name.trim() !== '')
        }
      })
      setEditingTasks(false)
      toast.success('Tasks and parts updated successfully')
    } catch (error) {
      toast.error('Failed to update tasks and parts')
    }
  }, [jobOrder._id, tempJobList, tempParts, updateJobMutation])

  const handleCancelEditTasks = useCallback(() => {
    setEditingTasks(false)
    setTempJobList([...jobOrder.jobList])
    setTempParts([...jobOrder.parts])
  }, [jobOrder.jobList, jobOrder.parts])

  const addTask = useCallback(() => {
    setTempJobList([...tempJobList, { description: '', status: 'Unfinished' }])
  }, [tempJobList])

  const removeTask = useCallback((index: number) => {
    setTempJobList(tempJobList.filter((_, i) => i !== index))
  }, [tempJobList])

  const updateTask = useCallback((index: number, field: 'description' | 'status', value: string) => {
    const updated = [...tempJobList]
    updated[index] = { ...updated[index], [field]: value }
    setTempJobList(updated)
  }, [tempJobList])

  const addPart = useCallback(() => {
    setTempParts([...tempParts, { name: '', availability: 'Available' }])
  }, [tempParts])

  const removePart = useCallback((index: number) => {
    setTempParts(tempParts.filter((_, i) => i !== index))
  }, [tempParts])

  const updatePart = useCallback((index: number, field: 'name' | 'availability', value: string) => {
    const updated = [...tempParts]
    updated[index] = { ...updated[index], [field]: value }
    setTempParts(updated)
  }, [tempParts])

  const handleSubmitForQI = useCallback(async () => {
    try {
      await updateStatusMutation.mutateAsync({ id: jobOrder._id, status: 'QI' })
      toast.success('Job submitted for quality inspection')
    } catch (error) {
      toast.error('Failed to submit for quality inspection')
    }
  }, [jobOrder._id, updateStatusMutation])

  const handleCarryOver = useCallback(async () => {
    try {
      await updateJobMutation.mutateAsync({
        id: jobOrder._id,
        updates: { carriedOver: true }
      })
      toast.success('Job marked as carry-over')
    } catch (error) {
      toast.error('Failed to mark as carry-over')
    }
  }, [jobOrder._id, updateJobMutation])

  const handleReplotJob = useCallback(() => {
    // This would typically open a modal or navigate to a replot interface
    // For now, we'll just show a message
    toast.info('Replot functionality - assign technician and time slot')
  }, [])

  const handleServiceAdvisorUpdate = useCallback(async (serviceAdvisorId: string) => {
    try {
      await updateJobMutation.mutateAsync({
        id: jobOrder._id,
        updates: { serviceAdvisor: serviceAdvisorId }
      })
      setEditingServiceAdvisor(false)
      toast.success('Service advisor updated successfully')
    } catch (error) {
      toast.error('Failed to update service advisor')
    }
  }, [jobOrder._id, updateJobMutation])

  return (
    <div
      className="floating-card p-2 relative group transition-all duration-300 hover:shadow-lg bg-white/90 hover:bg-white w-full"
    >
      {/* Left status accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-2 ${STATUS_ACCENT[jobOrder.status]} rounded-l-2xl`}></div>
      

      {/* Source Type & Carried Over Badge */}
      <div className="absolute top-2 right-2 flex gap-1">
        {jobOrder.sourceType === 'appointment' && (
          <div className="bg-blue-500/20 backdrop-blur-sm text-blue-700 px-1.5 py-0.5 rounded text-xs font-semibold flex items-center gap-1 border border-blue-300/30">
            <FiCalendar size={10} />
            <span>Appointment</span>
          </div>
        )}
        {jobOrder.sourceType === 'carry-over' && (
          <div className="bg-purple-500/20 backdrop-blur-sm text-purple-700 px-1.5 py-0.5 rounded text-xs font-semibold flex items-center gap-1 border border-purple-300/30">
            <FiRefreshCw size={10} />
            <span>Carry-over</span>
          </div>
        )}
        {jobOrder.carriedOver && (
          <div className="bg-red-500/20 backdrop-blur-sm text-red-700 px-1.5 py-0.5 rounded text-xs font-semibold flex items-center gap-1 border border-red-300/30">
            <FiAlertTriangle size={10} />
            <span>Carried</span>
          </div>
        )}
      </div>

      {/* Main Content - Enhanced Visual Hierarchy */}
      <div className="flex items-start justify-between gap-6 mt-4 w-full">
        {/* Column 1: Job Info - Expanded */}
        <div className="flex flex-col min-w-0 flex-1 ml-2">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={(e) => { stop(e); toggleImportant() }}
              disabled={toggleImportantMutation.isPending}
              className={`text-xl transition-all duration-200 ${
                jobOrder.isImportant 
                  ? 'text-yellow-400 drop-shadow-lg' 
                  : 'text-gray-300 hover:text-yellow-400'
              } hover:scale-110 hover:drop-shadow-xl`}
              title={jobOrder.isImportant ? 'Remove from important' : 'Mark as important'}
            >
              {jobOrder.isImportant ? '★' : '☆'}
            </button>
            <h3 className="text-xl font-black text-gray-900 tracking-tight leading-tight">{jobOrder.jobNumber}</h3>
          </div>
          <div className="h-0.5 w-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full mb-2"></div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-700 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-gray-200 min-h-[60px]">
              <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
                <FiClock size={12} className="text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">{jobOrder.timeRange.start}–{jobOrder.timeRange.end}</div>
                <div className="text-xs text-gray-500">Hours</div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-gray-700 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-gray-200 min-h-[60px]">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                <FiCalendar size={12} className="text-green-600" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">{formatDate(jobOrder.date)}</div>
                <div className="text-xs text-gray-500">Created</div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Personnel - Moved to Right */}
        <div className="flex flex-col space-y-2 min-w-0 w-56">
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 shadow-sm border border-gray-200 min-h-[60px]">
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
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 shadow-sm border border-gray-200 min-h-[60px]">
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

        {/* Column 3: Vehicle Info - Moved to Right */}
        <div className="flex flex-col space-y-2 min-w-0 w-56">          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 shadow-sm border border-gray-200 min-h-[60px]">
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
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-2 shadow-sm border border-gray-200 min-h-[60px]">
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

        {/* Column 4: Progress & Parts - Moved to Right */}
        <div className="flex flex-col space-y-2 min-w-0 w-56">
          <div className="text-center bg-white/80 backdrop-blur-sm rounded-lg p-2 shadow-sm border border-gray-200 min-h-[60px]">
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

          <div className="text-center bg-white/80 backdrop-blur-sm rounded-lg p-2 shadow-sm border border-gray-200 min-h-[60px]">
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

        {/* Column 5: Unified Actions */}
        <div className="flex flex-col items-center min-w-0 w-56">
          {/* Status Display */}
          <div className="text-center w-full mb-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</div>
            <div className={`px-3 py-2 rounded-lg text-sm font-bold backdrop-blur-sm shadow-sm border-2 ${getStatusColor(jobOrder.status)} min-h-[60px] flex items-center justify-center`}>
              {STATUS_LABELS[jobOrder.status]}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 w-full">
            {/* More/Less Button */}
            <button
              onClick={(e) => { 
                stop(e); 
                setIsExpanded(!isExpanded);
              }}
              className="w-full px-3 py-2 bg-white/60 hover:bg-white/80 text-gray-600 rounded-lg text-xs font-semibold transition-all hover:shadow-md border border-gray-200 hover:border-gray-300 flex items-center justify-center gap-1"
              title={isExpanded ? 'Collapse details' : 'Show details'}
            >
              {isExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              {isExpanded ? 'Less' : 'More'}
            </button>
            
          </div>
        </div>
      </div>


      {/* Expandable Details - Optimized Horizontal Layout */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
          {/* Status Management & Actions */}
          <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <FiPlay size={16} />
                Status & Actions
              </h4>
              <div className="text-xs text-gray-500">Current: {STATUS_LABELS[jobOrder.status]}</div>
            </div>
            
            <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700 font-medium">
                💡 Click any status button below to change the job status. You'll be asked to confirm the change.
              </p>
            </div>
            
            {/* Compact Status Changes */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { value: 'UA', label: 'Unassigned', color: 'bg-cyan-100 text-cyan-800' },
                { value: 'HC', label: 'Hold Customer', color: 'bg-yellow-100 text-yellow-800' },
                { value: 'HW', label: 'Hold Warranty', color: 'bg-red-100 text-red-800' },
                { value: 'HI', label: 'Hold Insurance', color: 'bg-indigo-100 text-indigo-800' },
                { value: 'HF', label: 'Hold Ford', color: 'bg-pink-100 text-pink-800' },
                { value: 'SU', label: 'Sublet', color: 'bg-violet-100 text-violet-800' },
                { value: 'FU', label: 'Finished Unclaimed', color: 'bg-gray-100 text-gray-800' }
              ].map(({ value, label, color }) => (
                <button
                  key={value}
                  onClick={(e) => { stop(e); handleStatusChange(value as JobStatus) }}
                  disabled={updateStatusMutation.isPending || value === jobOrder.status}
                  className={`px-3 py-2 rounded text-xs font-semibold transition-all ${
                    value === jobOrder.status
                      ? `${color} cursor-not-allowed opacity-75`
                      : `${color} hover:shadow-sm hover:scale-105 cursor-pointer`
                  }`}
                  title={`${value}: ${label} - Click to change status`}
                >
                  {value} - {label}
                </button>
              ))}
            </div>

            {/* Special Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={(e) => { stop(e); handleCarryOver() }}
                disabled={updateJobMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50"
                title="Mark this job as carried over to next day"
              >
                Carry Over
              </button>
              
              {/* Submit for QI */}
              {jobOrder.status !== 'UA' && jobOrder.status !== 'QI' && jobOrder.status !== 'FR' && jobOrder.status !== 'FU' && jobOrder.status !== 'CP' && (
                <button
                  onClick={(e) => { stop(e); handleSubmitForQI() }}
                  disabled={
                    updateStatusMutation.isPending || 
                    jobOrder.jobList.some(task => task.status === 'Unfinished') ||
                    jobOrder.parts.some(part => part.availability === 'Unavailable')
                  }
                  className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50 flex items-center gap-2"
                  title="Submit job for Quality Inspection"
                >
                  <FiSend size={14} />
                  Submit QI
                </button>
              )}
            </div>
            
            {/* Validation Messages */}
            {jobOrder.jobList.some(task => task.status === 'Unfinished') && (
              <p className="text-xs text-red-600 mt-2">⚠ All tasks must be finished for QI</p>
            )}
            {jobOrder.parts.some(part => part.availability === 'Unavailable') && (
              <p className="text-xs text-red-600 mt-1">⚠ All parts must be available for QI</p>
            )}
          </div>

          {/* Tasks and Parts Management */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Tasks Section */}
            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <FiTool size={16} />
                  Tasks
                </h4>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-600 font-semibold">
                    {finishedTasks}/{totalTasks} ({totalTasks > 0 ? Math.round((finishedTasks / totalTasks) * 100) : 0}%)
                  </div>
                  {!editingTasks && (
                    <button
                      onClick={(e) => { stop(e); handleEditTasks() }}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                    >
                      <FiEdit3 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {editingTasks ? (
                <div className="space-y-3">
                  {tempJobList.map((task, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-white/50 rounded-lg">
                      <input
                        type="text"
                        value={task.description}
                        onChange={(e) => updateTask(index, 'description', e.target.value)}
                        placeholder="Enter task description..."
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <select
                        value={task.status}
                        onChange={(e) => updateTask(index, 'status', e.target.value)}
                        className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Unfinished">Unfinished</option>
                        <option value="Finished">Finished</option>
                      </select>
                      <button
                        onClick={(e) => { stop(e); removeTask(index) }}
                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                      >
                        <FiTrash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { stop(e); addTask() }}
                      className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      <FiPlus size={14} />
                      Add Task
                    </button>
                    <button
                      onClick={(e) => { stop(e); handleSaveTasks() }}
                      disabled={updateJobMutation.isPending}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
                    >
                      {updateJobMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={(e) => { stop(e); handleCancelEditTasks() }}
                      className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
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
              )}
            </div>

            {/* Parts Section */}
            <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <FiPackage size={16} />
                  Parts
                </h4>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-600 font-semibold">
                    {partsAvailable}/{partsTotal} ({partsTotal > 0 ? Math.round((partsAvailable / partsTotal) * 100) : 0}%)
                  </div>
                  {!editingTasks && (
                    <button
                      onClick={(e) => { stop(e); handleEditTasks() }}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                    >
                      <FiEdit3 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {editingTasks ? (
                <div className="space-y-3">
                  {tempParts.map((part, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-white/50 rounded-lg">
                      <input
                        type="text"
                        value={part.name}
                        onChange={(e) => updatePart(index, 'name', e.target.value)}
                        placeholder="Enter part name..."
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <select
                        value={part.availability}
                        onChange={(e) => updatePart(index, 'availability', e.target.value)}
                        className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Available">Available</option>
                        <option value="Unavailable">Unavailable</option>
                      </select>
                      <button
                        onClick={(e) => { stop(e); removePart(index) }}
                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                      >
                        <FiTrash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => { stop(e); addPart() }}
                      className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      <FiPlus size={14} />
                      Add Part
                    </button>
                    <button
                      onClick={(e) => { stop(e); handleSaveTasks() }}
                      disabled={updateJobMutation.isPending}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
                    >
                      {updateJobMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={(e) => { stop(e); handleCancelEditTasks() }}
                      className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
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
              )}
            </div>

            {/* Service Advisor & Additional Info Section */}
            <div className="space-y-3">
              {/* Service Advisor */}
              <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <FiUser size={16} />
                    Service Advisor
                  </h4>
                  <button
                    onClick={(e) => { stop(e); setEditingServiceAdvisor(!editingServiceAdvisor) }}
                    className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                  >
                    {editingServiceAdvisor ? 'Cancel' : 'Edit'}
                  </button>
                </div>
                
                {editingServiceAdvisor ? (
                  <div className="space-y-2">
                    <select
                      value={jobOrder.serviceAdvisor?._id || ''}
                      onChange={(e) => handleServiceAdvisorUpdate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Service Advisor</option>
                      {/* This would be populated with actual service advisors from props or context */}
                      <option value="advisor1">John Smith</option>
                      <option value="advisor2">Jane Doe</option>
                    </select>
                  </div>
                ) : (
                  <div className="text-sm">
                    {jobOrder.serviceAdvisor ? (
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-800">{jobOrder.serviceAdvisor.name}</span>
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
                          Assigned
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-red-600 font-medium">No service advisor assigned</span>
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-semibold">
                          Required
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Job Details Summary */}
              <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 border border-gray-200">
                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
                  <FiInfo size={16} />
                  Job Summary
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Source:</span>
                    <span className="font-medium text-gray-800 capitalize">
                      {jobOrder.sourceType?.replace('-', ' ') || 'Direct'}
                    </span>
                  </div>
                  {jobOrder.carriedOver && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-orange-700 font-medium">Carried Over:</span>
                      <span className="font-medium text-orange-800">Yes</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Updated:</span>
                    <span className="font-medium text-gray-800">
                      {formatDate(jobOrder.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Collapse Button */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={(e) => { stop(e); setIsExpanded(false) }}
              className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-all hover:shadow-md border border-gray-200 hover:border-gray-300 flex items-center justify-center gap-2"
              title="Collapse quick details"
            >
              <FiChevronUp size={16} />
              Less
            </button>
          </div>
        </div>
      )}

      {/* Status Change Modal */}
      {editingField === 'status' && createPortal(
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
      )}

      {/* Status Change Confirmation Dialog */}
      {showStatusConfirm && pendingStatus && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <FiPlay className="text-blue-600" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Confirm Status Change</h3>
                <p className="text-sm text-gray-600">Are you sure you want to change the status?</p>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Current Status:</span>
                <span className="text-sm font-medium text-gray-800">{STATUS_LABELS[jobOrder.status]}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-600">New Status:</span>
                <span className="text-sm font-medium text-blue-600">{STATUS_LABELS[pendingStatus]}</span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowStatusConfirm(false)
                  setPendingStatus(null)
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmStatusChange}
                disabled={updateStatusMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
              >
                {updateStatusMutation.isPending ? 'Changing...' : 'Confirm Change'}
              </button>
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