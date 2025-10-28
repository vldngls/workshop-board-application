"use client"

import { useState } from 'react'
import { BugReport } from '@/types/bugReport'

interface BugReportDetailModalProps {
  bugReport: BugReport
  isOpen: boolean
  onClose: () => void
  onUpdate: (id: string, updates: any) => void
}

export default function BugReportDetailModal({ 
  bugReport, 
  isOpen, 
  onClose, 
  onUpdate 
}: BugReportDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    status: bugReport.status,
    priority: bugReport.priority,
    resolution: bugReport.resolution || ''
  })
  const [isUpdating, setIsUpdating] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800'
      case 'in-progress': return 'bg-yellow-100 text-yellow-800'
      case 'resolved': return 'bg-green-100 text-green-800'
      case 'closed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleSave = async () => {
    setIsUpdating(true)
    try {
      await onUpdate(bugReport._id, editData)
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating bug report:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancel = () => {
    setEditData({
      status: bugReport.status,
      priority: bugReport.priority,
      resolution: bugReport.resolution || ''
    })
    setIsEditing(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Bug Report Details</h2>
              <div className="flex items-center gap-3">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={isUpdating}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isUpdating ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Subject */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Subject</h3>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{bugReport.subject}</p>
                </div>

                {/* Description */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                  <div className="text-gray-700 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">
                    {bugReport.description}
                  </div>
                </div>

                {/* Image */}
                {bugReport.imageData && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Screenshot</h3>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <img
                        src={`data:${bugReport.imageMimeType};base64,${bugReport.imageData}`}
                        alt="Bug report screenshot"
                        className="max-w-full h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setShowImageModal(true)}
                      />
                      <p className="text-xs text-gray-500 mt-2">Click image to view full size</p>
                    </div>
                  </div>
                )}

                {/* Resolution */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Resolution</h3>
                  {isEditing ? (
                    <textarea
                      value={editData.resolution}
                      onChange={(e) => setEditData(prev => ({ ...prev, resolution: e.target.value }))}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter resolution details..."
                    />
                  ) : (
                    <div className="text-gray-700 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">
                      {bugReport.resolution || 'No resolution provided yet'}
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Status & Priority */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Status & Priority</h3>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      {isEditing ? (
                        <select
                          value={editData.status}
                          onChange={(e) => setEditData(prev => ({ ...prev, status: e.target.value as any }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="open">Open</option>
                          <option value="in-progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                      ) : (
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(bugReport.status)}`}>
                          {bugReport.status}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      {isEditing ? (
                        <select
                          value={editData.priority}
                          onChange={(e) => setEditData(prev => ({ ...prev, priority: e.target.value as any }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      ) : (
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(bugReport.priority)}`}>
                          {bugReport.priority}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Report Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Information</h3>
                  
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Submitted by:</span>
                      <p className="text-gray-600">{bugReport.submittedByName}</p>
                      <p className="text-gray-500">{bugReport.submittedByEmail}</p>
                      <p className="text-gray-500">{bugReport.submittedByRole}</p>
                    </div>

                    <div>
                      <span className="font-medium text-gray-700">Page:</span>
                      <p className="text-gray-600">{bugReport.currentPage}</p>
                    </div>

                    <div>
                      <span className="font-medium text-gray-700">Submitted:</span>
                      <p className="text-gray-600">{formatDate(bugReport.createdAt)}</p>
                    </div>

                    <div>
                      <span className="font-medium text-gray-700">Last updated:</span>
                      <p className="text-gray-600">{formatDate(bugReport.updatedAt)}</p>
                    </div>

                    {bugReport.resolvedAt && (
                      <div>
                        <span className="font-medium text-gray-700">Resolved:</span>
                        <p className="text-gray-600">{formatDate(bugReport.resolvedAt)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Technical Info */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Technical Details</h3>
                  
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">User Agent:</span>
                      <p className="text-gray-600 break-all">{bugReport.userAgent}</p>
                    </div>

                    <div>
                      <span className="font-medium text-gray-700">Report ID:</span>
                      <p className="text-gray-600 font-mono text-xs">{bugReport._id}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {showImageModal && bugReport.imageData && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60 p-4">
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-75 transition-colors z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={`data:${bugReport.imageMimeType};base64,${bugReport.imageData}`}
              alt="Bug report screenshot"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </>
  )
}
