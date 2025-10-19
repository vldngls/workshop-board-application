import { memo } from 'react'
import { createPortal } from 'react-dom'
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi'
import { calculateWorkDuration, formatTime } from '@/utils/timetableUtils'
import type { JobOrderWithDetails } from '@/utils/timetableUtils'

interface JobDetailsModalProps {
  isOpen: boolean
  job: JobOrderWithDetails | null
  updating: boolean
  breakStart: string
  breakEnd: string
  onClose: () => void
  onToggleImportant?: (jobId: string) => void
  onUpdateJobStatus?: (jobId: string, status: string) => void
  onUpdateTaskStatus?: (jobId: string, taskIndex: number, status: 'Finished' | 'Unfinished') => void
  onUpdatePartAvailability?: (jobId: string, partIndex: number, availability: 'Available' | 'Unavailable') => void
  onReassignTechnician?: () => void
  onReplotJob?: () => void
  onSubmitForQI?: (jobId: string) => void
}

const JobDetailsModal = memo(({
  isOpen,
  job,
  updating,
  breakStart,
  breakEnd,
  onClose,
  onToggleImportant,
  onUpdateJobStatus,
  onUpdateTaskStatus,
  onUpdatePartAvailability,
  onReassignTechnician,
  onReplotJob,
  onSubmitForQI
}: JobDetailsModalProps) => {
  if (!isOpen || !job) return null

  const getStatusLabel = (status: string) => {
    const statusLabels: { [key: string]: string } = {
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
    return statusLabels[status] || status
  }

  return createPortal(
    <div className="modal-backdrop">
      <div className="floating-card max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="p-6">
          <div className="flex justify-between items-start mb-5">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-gray-900">Job Order Details</h3>
              {onToggleImportant && (
                <button
                  onClick={() => onToggleImportant(job._id)}
                  disabled={updating}
                  className={`text-2xl transition-all ${job.isImportant ? 'text-yellow-400 drop-shadow-lg' : 'text-gray-400/60'} hover:scale-125 hover:text-yellow-400`}
                  title={job.isImportant ? 'Remove from important' : 'Mark as important'}
                >
                  {job.isImportant ? '★' : '☆'}
                </button>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-3xl leading-none transition-colors"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Job Number</label>
                <p className="text-lg font-semibold">{job.jobNumber}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Status</label>
                {onUpdateJobStatus ? (
                  <select
                    value={job.status}
                    onChange={(e) => onUpdateJobStatus(job._id, e.target.value)}
                    disabled={updating}
                    className="px-3 py-1 rounded-xl text-sm font-medium border-2 border-gray-300 focus:outline-none focus:border-blue-500"
                  >
                  <option value="OG">OG - On Going</option>
                  <option value="WP">WP - Waiting Parts</option>
                  <option value="FP">FP - For Plotting</option>
                  <option value="QI">QI - Quality Inspection</option>
                  <option value="HC">HC - Hold Customer</option>
                  <option value="HW">HW - Hold Warranty</option>
                  <option value="HI">HI - Hold Insurance</option>
                  <option value="FR">FR - For Release</option>
                  <option value="FU">FU - Finished Unclaimed</option>
                  <option value="CP">CP - Complete</option>
                </select>
                ) : (
                  <div className="px-3 py-1 rounded-xl text-sm font-medium border-2 border-gray-200 bg-gray-50 text-gray-600">
                    {job.status} - {getStatusLabel(job.status)}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Plate Number</label>
                <p className="text-lg">{job.plateNumber}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">VIN</label>
                <p className="text-sm font-mono">{job.vin}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-600">Assigned Technician</label>
                  {onReassignTechnician && (
                    <button
                      onClick={onReassignTechnician}
                      disabled={updating}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Reassign
                    </button>
                  )}
                </div>
                <p className="text-lg">{job.assignedTechnician ? job.assignedTechnician.name : (
                  <span className="text-red-600 font-semibold flex items-center gap-1">
                    <FiAlertTriangle size={14} />
                    Unassigned
                  </span>
                )}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Time Slot</label>
                <p className="text-lg">{formatTime(job.timeRange.start)} - {formatTime(job.timeRange.end)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Work Duration</label>
                <p className="text-lg font-semibold text-blue-600">{calculateWorkDuration(job.timeRange.start, job.timeRange.end, breakStart, breakEnd)}</p>
              </div>
            </div>

            {job.carriedOver && (
              <div className="bg-red-500/20 backdrop-blur-sm border border-red-300/30 rounded-xl p-3">
                <div className="flex items-center gap-2 text-red-800">
                  <FiRefreshCw size={20} />
                  <span className="font-semibold">This job was carried over from a previous day</span>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">Job Tasks</label>
              <div className="space-y-2">
                {job.jobList.map((task, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white rounded-xl border">
                    <span className="text-sm flex-1">{task.description}</span>
                    {onUpdateTaskStatus ? (
                      <select
                        value={task.status}
                        onChange={(e) => onUpdateTaskStatus(job._id, index, e.target.value as 'Finished' | 'Unfinished')}
                        disabled={updating}
                        className={`ml-3 px-3 py-1 rounded text-xs font-medium border-2 focus:outline-none ${
                          task.status === 'Finished' 
                            ? 'bg-green-100 text-green-800 border-green-300' 
                            : 'bg-gray-100 text-gray-800 border-gray-300'
                        }`}
                      >
                        <option value="Unfinished">Unfinished</option>
                        <option value="Finished">Finished</option>
                      </select>
                    ) : (
                      <div className={`ml-3 px-3 py-1 rounded text-xs font-medium border-2 ${
                        task.status === 'Finished' 
                          ? 'bg-green-100 text-green-800 border-green-300' 
                          : 'bg-gray-100 text-gray-800 border-gray-300'
                      }`}>
                        {task.status}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">Parts Required</label>
              <div className="space-y-2">
                {job.parts.map((part, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white rounded-xl border">
                    <span className="text-sm flex-1">{part.name}</span>
                    {onUpdatePartAvailability ? (
                      <select
                        value={part.availability}
                        onChange={(e) => onUpdatePartAvailability(job._id, index, e.target.value as 'Available' | 'Unavailable')}
                        disabled={updating}
                        className={`ml-3 px-3 py-1 rounded text-xs font-medium border-2 focus:outline-none ${
                          part.availability === 'Available' 
                            ? 'bg-green-100 text-green-800 border-green-300' 
                            : 'bg-red-100 text-red-800 border-red-300'
                        }`}
                      >
                        <option value="Available">Available</option>
                        <option value="Unavailable">Unavailable</option>
                      </select>
                    ) : (
                      <div className={`ml-3 px-3 py-1 rounded text-xs font-medium border-2 ${
                        part.availability === 'Available' 
                          ? 'bg-green-100 text-green-800 border-green-300' 
                          : 'bg-red-100 text-red-800 border-red-300'
                      }`}>
                        {part.availability}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Replot Button for FP Status */}
            {job.status === 'FP' && onReplotJob && (
              <div className="pt-4 border-t border-white/30">
                <button
                  onClick={onReplotJob}
                  disabled={updating}
                  className="w-full bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 rounded-xl transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                >
                  Replot Job Order
                </button>
                <p className="text-xs text-gray-700 mt-2 text-center font-medium">Assign technician and time slot to add this job to the job control board</p>
              </div>
            )}

            {/* Submit for QI Button */}
            {job.status !== 'FP' && job.status !== 'QI' && job.status !== 'FR' && job.status !== 'FU' && job.status !== 'CP' && onSubmitForQI && (
              <div className="pt-4 border-t border-white/30">
                <button
                  onClick={() => onSubmitForQI(job._id)}
                  disabled={
                    updating || 
                    job.jobList.some(task => task.status === 'Unfinished') ||
                    job.parts.some(part => part.availability === 'Unavailable')
                  }
                  className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-600 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 rounded-xl transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                >
                  {updating ? 'Submitting...' : 'Submit for Quality Inspection'}
                </button>
                {job.jobList.some(task => task.status === 'Unfinished') && (
                  <p className="text-xs text-red-600 mt-2 text-center font-medium">All tasks must be finished before submitting for QI</p>
                )}
                {job.parts.some(part => part.availability === 'Unavailable') && (
                  <p className="text-xs text-red-600 mt-2 text-center font-medium">All parts must be available before submitting for QI</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
})

JobDetailsModal.displayName = 'JobDetailsModal'

export default JobDetailsModal
