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
  FiSend,
  FiEye
} from 'react-icons/fi'
import type { JobOrder, JobStatus, JobItemStatus } from '@/types/jobOrder'
import { 
  useUpdateJobOrderStatus, 
  useUpdateJobOrder, 
  useToggleImportant
} from '@/hooks/useJobOrders'
import JobReassignmentModal from './JobReassignmentModal'

interface JobOrderCardProps {
  jobOrder: JobOrder
  onClick?: (jobOrder: JobOrder) => void
  onViewIn?: (jobId: string, jobDate: string, status: string) => void
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

function JobOrderCard({ jobOrder, onViewIn }: JobOrderCardProps) {
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
  const [showReassignmentModal, setShowReassignmentModal] = useState(false)

  // TanStack Query mutations
  const updateStatusMutation = useUpdateJobOrderStatus()
  const updateJobMutation = useUpdateJobOrder()
  const toggleImportantMutation = useToggleImportant()

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

  const handleReassignmentSuccess = useCallback(() => {
    // The mutation will automatically refetch data and update the UI
    toast.success('Job reassigned successfully!')
  }, [])

  const handleFieldEdit = useCallback((field: string, currentValue: string) => {
    setEditingField(field)
    setEditingValue(currentValue)
  }, [])

  const handleFieldSave = useCallback(async () => {
    if (!editingField) return

    const updates: Record<string, unknown> = {}
    
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
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
      toast.error('Failed to mark as carry-over')
    }
  }, [jobOrder._id, updateJobMutation])


  const handleServiceAdvisorUpdate = useCallback(async (serviceAdvisorId: string) => {
    try {
      await updateJobMutation.mutateAsync({
        id: jobOrder._id,
        updates: { serviceAdvisor: serviceAdvisorId }
      })
      setEditingServiceAdvisor(false)
      toast.success('Service advisor updated successfully')
    } catch {
      toast.error('Failed to update service advisor')
    }
  }, [jobOrder._id, updateJobMutation])

  return (
    <div
      className="relative group transition-all duration-200 hover:shadow-lg bg-white w-full rounded-lg border border-gray-200 overflow-hidden"
    >
      {/* Status accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${STATUS_ACCENT[jobOrder.status]}`}></div>
      
      {/* Header with badges */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { stop(e); toggleImportant() }}
            disabled={toggleImportantMutation.isPending}
            className={`text-lg transition-all duration-200 ${
              jobOrder.isImportant 
                ? 'text-yellow-500' 
                : 'text-gray-300 hover:text-yellow-500'
            } hover:scale-105`}
            title={jobOrder.isImportant ? 'Remove from important' : 'Mark as important'}
          >
            {jobOrder.isImportant ? '★' : '☆'}
          </button>
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">{jobOrder.jobNumber}</h3>
              <div className="text-xs text-gray-500">{formatDate(jobOrder.date)}</div>
            </div>
            {/* View In button for ongoing jobs */}
            {jobOrder.status === 'OG' && onViewIn && (
              <button
                onClick={(e) => { 
                  stop(e); 
                  onViewIn(jobOrder._id, jobOrder.date, jobOrder.status);
                }}
                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors border border-blue-200 flex items-center gap-1.5"
                title="View this job in the workshop timetable"
              >
                <FiEye size={12} />
                View In
              </button>
            )}
          </div>
        </div>
        
        <div className="flex gap-1.5">
          {jobOrder.sourceType === 'appointment' && (
            <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 border border-blue-200">
              <FiCalendar size={10} />
              <span>Appointment</span>
            </div>
          )}
          {jobOrder.sourceType === 'carry-over' && (
            <div className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 border border-purple-200">
              <FiRefreshCw size={10} />
              <span>Carry-over</span>
            </div>
          )}
          {(jobOrder.carriedOver || jobOrder.carryOverChain || jobOrder.originalJobId) && (
            <div className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1 border border-red-200">
              <FiAlertTriangle size={10} />
              <span>Carried</span>
            </div>
          )}
        </div>
      </div>

      {/* Main content grid */}
      <div className="p-3">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-2">
          
          {/* Vehicle Information - Most Important */}
          <div className="lg:col-span-2">
            <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center">
                  <FiTool className="text-white" size={10} />
                </div>
                <h4 className="text-xs font-semibold text-gray-700">Vehicle Details</h4>
              </div>
              
              <div className="space-y-1.5">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-0.5 block">Plate Number</label>
                  {editingField === 'plateNumber' ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm font-bold border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent bg-white"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFieldSave()
                          if (e.key === 'Escape') handleFieldCancel()
                        }}
                      />
                      <button onClick={(e) => { stop(e); handleFieldSave() }} className="text-green-600 p-0.5 rounded hover:bg-green-50 transition-colors">
                        <FiCheck size={10} />
                      </button>
                      <button onClick={(e) => { stop(e); handleFieldCancel() }} className="text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors">
                        <FiX size={10} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <div className="text-sm font-bold text-gray-900 tracking-wide bg-white px-2 py-1 rounded border border-gray-200 flex-1">
                        {jobOrder.plateNumber}
                      </div>
                      <button
                        onClick={(e) => { stop(e); handleFieldEdit('plateNumber', jobOrder.plateNumber) }}
                        className="text-gray-400 hover:text-blue-600 transition-colors p-0.5 rounded hover:bg-gray-100"
                      >
                        <FiEdit3 size={10} />
                      </button>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-0.5 block">VIN</label>
                  {editingField === 'vin' ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs font-bold border border-gray-300 rounded font-mono focus:ring-1 focus:ring-blue-500 focus:border-transparent bg-white"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFieldSave()
                          if (e.key === 'Escape') handleFieldCancel()
                        }}
                      />
                      <button onClick={(e) => { stop(e); handleFieldSave() }} className="text-green-600 p-0.5 rounded hover:bg-green-50 transition-colors">
                        <FiCheck size={10} />
                      </button>
                      <button onClick={(e) => { stop(e); handleFieldCancel() }} className="text-red-600 p-0.5 rounded hover:bg-red-50 transition-colors">
                        <FiX size={10} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <div className="text-xs font-bold text-gray-900 font-mono tracking-wide bg-white px-2 py-1 rounded border border-gray-200 flex-1">
                        {jobOrder.vin}
                      </div>
                      <button
                        onClick={(e) => { stop(e); handleFieldEdit('vin', jobOrder.vin) }}
                        className="text-gray-400 hover:text-blue-600 transition-colors p-0.5 rounded hover:bg-gray-100"
                      >
                        <FiEdit3 size={10} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Personnel & Time */}
          <div className="lg:col-span-2">
            <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-4 h-4 bg-green-500 rounded flex items-center justify-center">
                  <FiUser className="text-white" size={10} />
                </div>
                <h4 className="text-xs font-semibold text-gray-700">Personnel & Schedule</h4>
              </div>
              
              <div className="space-y-1.5">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-0.5 block">Time Range</label>
                  <div className="flex items-center gap-2 bg-white px-2 py-1 rounded border border-gray-200">
                    <FiClock className="text-blue-600" size={10} />
                    <span className="text-xs font-bold text-gray-900">{jobOrder.timeRange.start} – {jobOrder.timeRange.end}</span>
                    <span className="text-xs text-gray-500 ml-auto">({calculateDuration(jobOrder.timeRange.start, jobOrder.timeRange.end)})</span>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-0.5 block">Technician</label>
                  <div className="flex items-center gap-1">
                    <div className="flex-1 bg-white px-2 py-1 rounded border border-gray-200">
                      {jobOrder.assignedTechnician ? (
                        <div>
                          <div className="text-xs font-bold text-gray-900 truncate">
                            {jobOrder.assignedTechnician.name}
                          </div>
                          {jobOrder.assignedTechnician.level && (
                            <div className="text-xs text-blue-600 font-medium">L{jobOrder.assignedTechnician.level}</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-red-600 font-bold flex items-center gap-1">
                          <FiAlertTriangle size={8} />
                          <span className="text-xs">Unassigned</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => { stop(e); setShowReassignmentModal(true) }}
                      className="text-gray-400 hover:text-blue-600 transition-colors p-0.5 rounded hover:bg-gray-100"
                      title="Reassign technician"
                    >
                      <FiEdit3 size={10} />
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-0.5 block">Service Advisor</label>
                  <div className="bg-white px-2 py-1 rounded border border-gray-200">
                    {jobOrder.serviceAdvisor ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 truncate">{jobOrder.serviceAdvisor.name}</span>
                        <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                          Assigned
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-red-600 font-bold flex items-center gap-1">
                          <FiAlertTriangle size={8} />
                          <span className="text-xs">Required</span>
                        </span>
                        <span className="px-1 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                          Required
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Status & Progress */}
          <div className="lg:col-span-1">
            <div className="bg-gray-50 rounded-lg p-2 border border-gray-200">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-4 h-4 bg-purple-500 rounded flex items-center justify-center">
                  <FiPlay className="text-white" size={10} />
                </div>
                <h4 className="text-xs font-semibold text-gray-700">Status</h4>
              </div>
              
              <div className="text-center mb-2">
                <div className={`px-2 py-1 rounded text-xs font-bold ${getStatusColor(jobOrder.status)}`}>
                  {STATUS_LABELS[jobOrder.status]}
                </div>
              </div>
              
              <div className="space-y-1.5">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-0.5 block text-center">Progress</label>
                  <div className="bg-white rounded p-1.5 border border-gray-200">
                    <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mb-1">
                      <div
                        className="h-1 bg-green-500 rounded-full transition-all duration-500"
                        style={{ width: `${totalTasks === 0 ? 0 : Math.round((finishedTasks / totalTasks) * 100)}%` }}
                      />
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-gray-900">{finishedTasks}/{totalTasks}</div>
                      <div className="text-xs text-gray-500">
                        {totalTasks > 0 ? Math.round((finishedTasks / totalTasks) * 100) : 0}%
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-0.5 block text-center">Parts</label>
                  <div className="bg-white rounded p-1.5 border border-gray-200">
                    {partsTotal === 0 ? (
                      <div className="text-xs text-gray-400 text-center font-medium">-- NO PARTS NEEDED --</div>
                    ) : (
                      <>
                        <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mb-1">
                          <div
                            className="h-1 bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.round((partsAvailable / partsTotal) * 100)}%` }}
                          />
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-gray-900">{partsAvailable}/{partsTotal}</div>
                          <div className="text-xs text-gray-500">
                            {Math.round((partsAvailable / partsTotal) * 100)}%
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width More button */}
      <div className="px-3 pb-3">
        <button
          onClick={(e) => { 
            stop(e); 
            setIsExpanded(!isExpanded);
          }}
          className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium transition-all border border-gray-200 hover:border-gray-300 flex items-center justify-center gap-1"
          title={isExpanded ? 'Collapse details' : 'Show details'}
        >
          {isExpanded ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
          {isExpanded ? 'Show Less Details' : 'Show More Details'}
        </button>
      </div>


      {/* Expandable Details - Compact Layout */}
      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            {/* Status Management & Actions */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-500 rounded flex items-center justify-center">
                    <FiPlay className="text-white" size={10} />
                  </div>
                  Status & Actions
                </h4>
                <div className="text-xs text-gray-600 bg-white px-2 py-1 rounded border border-gray-200">
                  Current: <span className="font-medium">{STATUS_LABELS[jobOrder.status]}</span>
                </div>
              </div>
              
              <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-200">
                <p className="text-xs text-blue-700 font-medium">
                  Click any status button below to change the job status. You&apos;ll be asked to confirm the change.
                </p>
              </div>
              
              {/* Compact Status Changes */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                {[
                  { value: 'UA', label: 'Unassigned', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
                  { value: 'HC', label: 'Hold Customer', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
                  { value: 'HW', label: 'Hold Warranty', color: 'bg-red-100 text-red-800 border-red-200' },
                  { value: 'HI', label: 'Hold Insurance', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
                  { value: 'HF', label: 'Hold Ford', color: 'bg-pink-100 text-pink-800 border-pink-200' },
                  { value: 'SU', label: 'Sublet', color: 'bg-violet-100 text-violet-800 border-violet-200' },
                  { value: 'FU', label: 'Finished Unclaimed', color: 'bg-gray-100 text-gray-800 border-gray-200' }
                ].map(({ value, label, color }) => (
                  <button
                    key={value}
                    onClick={(e) => { stop(e); handleStatusChange(value as JobStatus) }}
                    disabled={updateStatusMutation.isPending || value === jobOrder.status}
                    className={`p-2 rounded text-xs font-medium transition-all border ${
                      value === jobOrder.status
                        ? `${color} cursor-not-allowed opacity-75`
                        : `${color} hover:shadow-sm cursor-pointer`
                    }`}
                    title={`${value}: ${label} - Click to change status`}
                  >
                    <div className="text-center">
                      <div className="font-bold">{value}</div>
                      <div className="text-xs opacity-80">{label}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Special Actions */}
              <div className="flex flex-wrap gap-2">
                {/* Reassign button for Carried Over and Unassigned jobs */}
                {(jobOrder.status === 'UA' || jobOrder.carriedOver) && (
                  <button
                    onClick={(e) => { stop(e); setShowReassignmentModal(true) }}
                    className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors border border-blue-200 flex items-center gap-1"
                    title="Reassign job to technician and schedule"
                  >
                    <FiUser size={10} />
                    Reassign
                  </button>
                )}
                
                <button
                  onClick={(e) => { stop(e); handleCarryOver() }}
                  disabled={updateJobMutation.isPending}
                  className="px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 rounded hover:bg-orange-100 transition-colors disabled:opacity-50 border border-orange-200 flex items-center gap-1"
                  title="Mark this job as carried over to next day"
                >
                  <FiRefreshCw size={10} />
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
                    className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded hover:bg-purple-100 transition-colors disabled:opacity-50 flex items-center gap-1 border border-purple-200"
                    title="Submit job for Quality Inspection"
                  >
                    <FiSend size={10} />
                    Submit QI
                  </button>
                )}
              </div>
              
              {/* Validation Messages */}
              {jobOrder.jobList.some(task => task.status === 'Unfinished') && (
                <div className="mt-2 p-1.5 bg-red-50 rounded border border-red-200">
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <FiAlertTriangle size={10} />
                    All tasks must be finished for QI
                  </p>
                </div>
              )}
              {jobOrder.parts.some(part => part.availability === 'Unavailable') && (
                <div className="mt-1 p-1.5 bg-red-50 rounded border border-red-200">
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <FiAlertTriangle size={10} />
                    All parts must be available for QI
                  </p>
                </div>
              )}
            </div>

            {/* Tasks and Parts Management */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Tasks Section */}
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center">
                      <FiTool className="text-white" size={10} />
                    </div>
                    Tasks
                  </h4>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-gray-600 font-medium bg-gray-100 px-2 py-1 rounded">
                      {finishedTasks}/{totalTasks} ({totalTasks > 0 ? Math.round((finishedTasks / totalTasks) * 100) : 0}%)
                    </div>
                    {!editingTasks && (
                      <button
                        onClick={(e) => { stop(e); handleEditTasks() }}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors border border-blue-200"
                      >
                        <FiEdit3 size={10} />
                      </button>
                    )}
                  </div>
                </div>

                {editingTasks ? (
                  <div className="space-y-2">
                    {tempJobList.map((task, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                        <input
                          type="text"
                          value={task.description}
                          onChange={(e) => updateTask(index, 'description', e.target.value)}
                          placeholder="Enter task description..."
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                        <select
                          value={task.status}
                          onChange={(e) => updateTask(index, 'status', e.target.value)}
                          className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                          <option value="Unfinished">Unfinished</option>
                          <option value="Finished">Finished</option>
                        </select>
                        <button
                          onClick={(e) => { stop(e); removeTask(index) }}
                          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                        >
                          <FiTrash2 size={10} />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { stop(e); addTask() }}
                        className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs font-medium"
                      >
                        <FiPlus size={10} />
                        Add Task
                      </button>
                      <button
                        onClick={(e) => { stop(e); handleSaveTasks() }}
                        disabled={updateJobMutation.isPending}
                        className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors text-xs font-medium"
                      >
                        {updateJobMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={(e) => { stop(e); handleCancelEditTasks() }}
                        className="px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                <div className="space-y-2">
                  {jobOrder.jobList.map((task, index) => (
                    <div key={index} className="p-2 bg-gray-50 rounded border border-gray-200">
                      <div className="mb-2">
                        <span className="font-medium text-gray-800 text-xs">{task.description}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { stop(e); handleJobTaskUpdate(index, 'Finished') }}
                          disabled={updatingTaskIndex === index || task.status === 'Finished'}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                            task.status === 'Finished'
                              ? 'bg-green-500 text-white cursor-not-allowed'
                              : 'bg-green-500/20 text-green-700 hover:bg-green-500/30 border border-green-200'
                          }`}
                        >
                          {updatingTaskIndex === index ? '...' : '✓ Finished'}
                        </button>
                        <button
                          onClick={(e) => { stop(e); handleJobTaskUpdate(index, 'Unfinished') }}
                          disabled={updatingTaskIndex === index || task.status === 'Unfinished'}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                            task.status === 'Unfinished'
                              ? 'bg-red-500 text-white cursor-not-allowed'
                              : 'bg-red-500/20 text-red-700 hover:bg-red-500/30 border border-red-200'
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
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-4 h-4 bg-purple-500 rounded flex items-center justify-center">
                      <FiPackage className="text-white" size={10} />
                    </div>
                    Parts
                  </h4>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-gray-600 font-medium bg-gray-100 px-2 py-1 rounded">
                      {partsAvailable}/{partsTotal} ({partsTotal > 0 ? Math.round((partsAvailable / partsTotal) * 100) : 0}%)
                    </div>
                    {!editingTasks && (
                      <button
                        onClick={(e) => { stop(e); handleEditTasks() }}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors border border-blue-200"
                      >
                        <FiEdit3 size={10} />
                      </button>
                    )}
                  </div>
                </div>

                {editingTasks ? (
                  <div className="space-y-2">
                    {tempParts.map((part, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                        <input
                          type="text"
                          value={part.name}
                          onChange={(e) => updatePart(index, 'name', e.target.value)}
                          placeholder="Enter part name..."
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        />
                        <select
                          value={part.availability}
                          onChange={(e) => updatePart(index, 'availability', e.target.value)}
                          className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                        >
                          <option value="Available">Available</option>
                          <option value="Unavailable">Unavailable</option>
                        </select>
                        <button
                          onClick={(e) => { stop(e); removePart(index) }}
                          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                        >
                          <FiTrash2 size={10} />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { stop(e); addPart() }}
                        className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs font-medium"
                      >
                        <FiPlus size={10} />
                        Add Part
                      </button>
                      <button
                        onClick={(e) => { stop(e); handleSaveTasks() }}
                        disabled={updateJobMutation.isPending}
                        className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors text-xs font-medium"
                      >
                        {updateJobMutation.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={(e) => { stop(e); handleCancelEditTasks() }}
                        className="px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                <div className="space-y-2">
                  {jobOrder.parts.map((part, index) => (
                    <div key={index} className="p-2 bg-gray-50 rounded border border-gray-200">
                      <div className="mb-2">
                        <span className="font-medium text-gray-800 text-xs">{part.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { stop(e); handlePartAvailabilityUpdate(index, 'Available') }}
                          disabled={updatingPartIndex === index || part.availability === 'Available'}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                            part.availability === 'Available'
                              ? 'bg-green-500 text-white cursor-not-allowed'
                              : 'bg-green-500/20 text-green-700 hover:bg-green-500/30 border border-green-200'
                          }`}
                        >
                          {updatingPartIndex === index ? '...' : '✓ Available'}
                        </button>
                        <button
                          onClick={(e) => { stop(e); handlePartAvailabilityUpdate(index, 'Unavailable') }}
                          disabled={updatingPartIndex === index || part.availability === 'Unavailable'}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                            part.availability === 'Unavailable'
                              ? 'bg-red-500 text-white cursor-not-allowed'
                              : 'bg-red-500/20 text-red-700 hover:bg-red-500/30 border border-red-200'
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

            </div>

            {/* Service Advisor & Additional Info Section */}
            <div className="lg:col-span-2 space-y-3 mt-4">
              {/* Service Advisor */}
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded flex items-center justify-center">
                      <FiUser className="text-white" size={10} />
                    </div>
                    Service Advisor
                  </h4>
                  <button
                    onClick={(e) => { stop(e); setEditingServiceAdvisor(!editingServiceAdvisor) }}
                    className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors border border-blue-200"
                  >
                    {editingServiceAdvisor ? 'Cancel' : 'Edit'}
                  </button>
                </div>
                
                {editingServiceAdvisor ? (
                  <div className="space-y-2">
                    <select
                      value={jobOrder.serviceAdvisor?._id || ''}
                      onChange={(e) => handleServiceAdvisorUpdate(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Select Service Advisor</option>
                      {/* This would be populated with actual service advisors from props or context */}
                      <option value="advisor1">John Smith</option>
                      <option value="advisor2">Jane Doe</option>
                    </select>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded p-2 border border-gray-200">
                    {jobOrder.serviceAdvisor ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-gray-800 text-sm">{jobOrder.serviceAdvisor.name}</span>
                          <div className="text-xs text-gray-600">Service Advisor</div>
                        </div>
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium border border-green-200">
                          Assigned
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-red-600 font-bold text-sm">No service advisor assigned</span>
                          <div className="text-xs text-gray-600">Service Advisor</div>
                        </div>
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium border border-red-200">
                          Required
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Job Details Summary */}
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 bg-gray-500 rounded flex items-center justify-center">
                    <FiInfo className="text-white" size={10} />
                  </div>
                  Job Summary
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded border border-gray-200">
                    <span className="text-gray-600 text-xs">Source:</span>
                    <span className="font-bold text-gray-800 text-xs capitalize">
                      {jobOrder.sourceType?.replace('-', ' ') || 'Direct'}
                    </span>
                  </div>
                  {jobOrder.carriedOver && (
                    <div className="flex justify-between items-center p-2 bg-orange-50 rounded border border-orange-200">
                      <span className="text-orange-700 text-xs font-medium">Carried Over:</span>
                      <span className="font-bold text-orange-800 text-xs">Yes</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded border border-gray-200">
                    <span className="text-gray-600 text-xs">Last Updated:</span>
                    <span className="font-bold text-gray-800 text-xs">
                      {formatDate(jobOrder.updatedAt)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded border border-gray-200">
                    <span className="text-gray-600 text-xs">Days in Workshop:</span>
                    <span className="font-bold text-gray-800 text-xs">
                      {calculateDaysInWorkshop()} days
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Collapse Button */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <button
              onClick={(e) => { stop(e); setIsExpanded(false) }}
              className="w-full px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded text-xs font-medium transition-all border border-gray-200 hover:border-gray-300 flex items-center justify-center gap-1"
              title="Collapse quick details"
            >
              <FiChevronUp size={12} />
              Show Less Details
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

      {/* Reassignment Modal */}
      {showReassignmentModal && (
        <JobReassignmentModal
          jobOrder={jobOrder}
          onClose={() => setShowReassignmentModal(false)}
          onSuccess={handleReassignmentSuccess}
        />
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