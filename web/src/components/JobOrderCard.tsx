'use client'

import { useState } from 'react'
import type { JobOrder, JobStatus } from '@/types/jobOrder'

interface JobOrderCardProps {
  jobOrder: JobOrder
  onUpdate: () => void
}

export default function JobOrderCard({ jobOrder, onUpdate }: JobOrderCardProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'Complete':
        return 'bg-green-100 text-green-800'
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'Incomplete':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const calculateDuration = (start: string, end: string) => {
    const startTime = new Date(`2000-01-01T${start}:00`)
    const endTime = new Date(`2000-01-01T${end}:00`)
    const diffMs = endTime.getTime() - startTime.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${diffHours}h ${diffMinutes}m`
  }

  const handleStatusUpdate = async (newStatus: JobStatus) => {
    try {
      setIsUpdating(true)
      const response = await fetch(`/api/job-orders/${jobOrder._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update job order status')
      }

      onUpdate()
    } catch (error) {
      console.error('Error updating job order:', error)
      alert('Failed to update job order status')
    } finally {
      setIsUpdating(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{jobOrder.jobNumber}</h3>
          <p className="text-sm text-gray-600">{formatDate(jobOrder.date)}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(jobOrder.status)}`}>
          {jobOrder.status}
        </span>
      </div>

      {/* Vehicle Info */}
      <div className="mb-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Plate Number:</span>
            <p className="text-gray-900">{jobOrder.plateNumber}</p>
          </div>
          <div>
            <span className="font-medium text-gray-700">VIN:</span>
            <p className="text-gray-900 font-mono text-xs">{jobOrder.vin}</p>
          </div>
        </div>
      </div>

      {/* Time Range */}
      <div className="mb-4">
        <div className="text-sm">
          <span className="font-medium text-gray-700">Time Range:</span>
          <p className="text-gray-900">
            {jobOrder.timeRange.start} - {jobOrder.timeRange.end}
            <span className="text-gray-500 ml-2">
              ({calculateDuration(jobOrder.timeRange.start, jobOrder.timeRange.end)})
            </span>
          </p>
        </div>
      </div>

      {/* Assigned Technician */}
      <div className="mb-4">
        <div className="text-sm">
          <span className="font-medium text-gray-700">Technician:</span>
          <p className="text-gray-900">{jobOrder.assignedTechnician.name}</p>
        </div>
      </div>

      {/* Job List Preview */}
      <div className="mb-4">
        <div className="text-sm">
          <span className="font-medium text-gray-700">Jobs:</span>
          <div className="mt-1 space-y-1">
            {jobOrder.jobList.slice(0, 2).map((job, index) => (
              <div key={index} className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${
                  job.status === 'Finished' ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                <span className={`text-xs ${
                  job.status === 'Finished' ? 'text-green-700' : 'text-gray-600'
                }`}>
                  {job.description}
                </span>
              </div>
            ))}
            {jobOrder.jobList.length > 2 && (
              <p className="text-xs text-gray-500">
                +{jobOrder.jobList.length - 2} more jobs
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Parts Preview */}
      <div className="mb-4">
        <div className="text-sm">
          <span className="font-medium text-gray-700">Parts:</span>
          <div className="mt-1 space-y-1">
            {jobOrder.parts.slice(0, 2).map((part, index) => (
              <div key={index} className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${
                  part.availability === 'Available' ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className={`text-xs ${
                  part.availability === 'Available' ? 'text-green-700' : 'text-red-700'
                }`}>
                  {part.name}
                </span>
              </div>
            ))}
            {jobOrder.parts.length > 2 && (
              <p className="text-xs text-gray-500">
                +{jobOrder.parts.length - 2} more parts
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Status Update Actions */}
      <div className="flex space-x-2">
        {jobOrder.status === 'Incomplete' && (
          <button
            onClick={() => handleStatusUpdate('In Progress')}
            disabled={isUpdating}
            className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-300 text-white text-xs py-1 px-2 rounded font-medium transition-colors"
          >
            Start
          </button>
        )}
        {jobOrder.status === 'In Progress' && (
          <button
            onClick={() => handleStatusUpdate('Complete')}
            disabled={isUpdating}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-xs py-1 px-2 rounded font-medium transition-colors"
          >
            Complete
          </button>
        )}
        {jobOrder.status === 'Complete' && (
          <button
            onClick={() => handleStatusUpdate('Incomplete')}
            disabled={isUpdating}
            className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 text-white text-xs py-1 px-2 rounded font-medium transition-colors"
          >
            Reopen
          </button>
        )}
      </div>
    </div>
  )
}
