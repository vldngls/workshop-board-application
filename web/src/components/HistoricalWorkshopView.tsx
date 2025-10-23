import { useState, useEffect } from 'react'
import { FiCalendar, FiClock, FiUser, FiRefreshCw, FiArrowLeft } from 'react-icons/fi'
import { WorkshopSnapshot } from '@/types/workshopSnapshot'
import { calculateWorkDuration } from '@/utils/timetableUtils'

interface HistoricalWorkshopViewProps {
  date: string
  onBack: () => void
}

export default function HistoricalWorkshopView({ date, onBack }: HistoricalWorkshopViewProps) {
  const [snapshot, setSnapshot] = useState<WorkshopSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSnapshot()
  }, [date])

  const fetchSnapshot = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/job-orders/snapshot/${date}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        if (response.status === 404) {
          setError('No workshop snapshot found for this date')
        } else {
          setError('Failed to load workshop snapshot')
        }
        return
      }

      const data = await response.json()
      setSnapshot(data.snapshot)
    } catch (error) {
      console.error('Error fetching snapshot:', error)
      setError('Failed to load workshop snapshot')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}:00`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <FiArrowLeft className="inline mr-2" />
          Back to Current View
        </button>
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500 mb-4">No snapshot data available</div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <FiArrowLeft className="inline mr-2" />
          Back to Current View
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historical Workshop View</h1>
          <p className="text-gray-600">{formatDate(snapshot.date)}</p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <FiArrowLeft />
          Back to Current View
        </button>
      </div>

      {/* Snapshot Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-blue-800 mb-2">
          <FiCalendar size={20} />
          <span className="font-semibold">Workshop Snapshot</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-blue-600 font-medium">Created:</span>
            <p className="text-blue-800">{formatDate(snapshot.snapshotDate)}</p>
          </div>
          <div>
            <span className="text-blue-600 font-medium">Created By:</span>
            <p className="text-blue-800">{snapshot.createdBy.name}</p>
          </div>
          <div>
            <span className="text-blue-600 font-medium">Total Jobs:</span>
            <p className="text-blue-800">{snapshot.statistics.totalJobs}</p>
          </div>
          <div>
            <span className="text-blue-600 font-medium">Carry-Over Jobs:</span>
            <p className="text-blue-800">{snapshot.statistics.carriedOver}</p>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">{snapshot.statistics.onGoing}</div>
          <div className="text-sm text-gray-600">On Going</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{snapshot.statistics.forRelease}</div>
          <div className="text-sm text-gray-600">For Release</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-600">{snapshot.statistics.onHold}</div>
          <div className="text-sm text-gray-600">On Hold</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600">{snapshot.statistics.qualityInspection}</div>
          <div className="text-sm text-gray-600">Quality Inspection</div>
        </div>
      </div>

      {/* Carry-Over Jobs */}
      {snapshot.carryOverJobs.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800 mb-3">
            <FiRefreshCw size={20} />
            <span className="font-semibold">Jobs Carried Over ({snapshot.carryOverJobs.length})</span>
          </div>
          <div className="space-y-2">
            {snapshot.carryOverJobs.map((job) => (
              <div key={job._id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-red-200">
                <div>
                  <span className="font-medium text-gray-900">{job.jobNumber}</span>
                  <span className="text-gray-600 ml-2">({job.plateNumber})</span>
                </div>
                <div className="text-sm text-gray-600">
                  Status: {job.status} - {job.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Job Orders */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Job Orders ({snapshot.jobOrders.length})</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {snapshot.jobOrders.map((job) => (
            <div key={job._id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-gray-900">{job.jobNumber}</span>
                    <span className="text-sm text-gray-600">({job.plateNumber})</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      job.status === 'OG' ? 'bg-blue-100 text-blue-800' :
                      job.status === 'FR' ? 'bg-green-100 text-green-800' :
                      job.status === 'CP' ? 'bg-gray-100 text-gray-800' :
                      job.status === 'WP' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {job.status}
                    </span>
                    {job.isImportant && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                        Important
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <FiUser size={16} />
                      <span>Tech: {job.assignedTechnician?.name || 'Unassigned'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FiClock size={16} />
                      <span>{formatTime(job.timeRange.start)} - {formatTime(job.timeRange.end)}</span>
                    </div>
                    <div>
                      <span>Duration: {calculateWorkDuration(job.timeRange.start, job.timeRange.end)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
