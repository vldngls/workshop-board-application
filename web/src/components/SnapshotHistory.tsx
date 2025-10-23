import { useState, useEffect } from 'react'
import { FiCalendar, FiClock, FiUser, FiRefreshCw, FiEye } from 'react-icons/fi'
import { WorkshopSnapshotSummary } from '@/types/workshopSnapshot'

interface SnapshotHistoryProps {
  onViewSnapshot: (date: string) => void
}

export default function SnapshotHistory({ onViewSnapshot }: SnapshotHistoryProps) {
  const [snapshots, setSnapshots] = useState<WorkshopSnapshotSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSnapshots()
  }, [])

  const fetchSnapshots = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/job-orders/snapshots?limit=30', {
        credentials: 'include'
      })

      if (!response.ok) {
        setError('Failed to load workshop snapshots')
        return
      }

      const data = await response.json()
      setSnapshots(data.snapshots)
    } catch (error) {
      console.error('Error fetching snapshots:', error)
      setError('Failed to load workshop snapshots')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={fetchSnapshots}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (snapshots.length === 0) {
    return (
      <div className="text-center py-8">
        <FiCalendar size={48} className="mx-auto text-gray-400 mb-4" />
        <div className="text-gray-500 mb-2">No workshop snapshots available</div>
        <div className="text-sm text-gray-400">Snapshots are created when you run "End of Day Processing"</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Workshop History</h2>
        <button
          onClick={fetchSnapshots}
          className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
        >
          Refresh
        </button>
      </div>
      
      <div className="space-y-3">
        {snapshots.map((snapshot) => (
          <div
            key={snapshot._id}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <FiCalendar size={16} className="text-gray-400" />
                  <span className="font-semibold text-gray-900">{formatDate(snapshot.date)}</span>
                  <span className="text-sm text-gray-500">
                    (Snapshot taken at {formatTime(snapshot.snapshotDate)})
                  </span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <FiUser size={14} />
                    <span>{snapshot.createdBy.name}</span>
                  </div>
                  <div>
                    <span className="font-medium">{snapshot.statistics.totalJobs}</span> total jobs
                  </div>
                  <div className="flex items-center gap-2">
                    <FiRefreshCw size={14} />
                    <span>{snapshot.statistics.carriedOver} carry-over</span>
                  </div>
                  <div>
                    {snapshot.carryOverJobs.length > 0 && (
                      <span className="text-red-600 font-medium">
                        {snapshot.carryOverJobs.length} jobs carried over
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => onViewSnapshot(snapshot.date)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                <FiEye size={16} />
                View
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
