import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface SubletRemarksModalProps {
  isOpen: boolean
  jobNumber: string
  currentRemarks?: string
  onConfirm: (remarks: string) => void
  onCancel: () => void
  updating: boolean
}

export default function SubletRemarksModal({
  isOpen,
  jobNumber,
  currentRemarks = '',
  onConfirm,
  onCancel,
  updating
}: SubletRemarksModalProps) {
  const [remarks, setRemarks] = useState(currentRemarks)

  const handleConfirm = useCallback(() => {
    onConfirm(remarks.trim())
  }, [remarks, onConfirm])

  const handleCancel = useCallback(() => {
    setRemarks(currentRemarks)
    onCancel()
  }, [currentRemarks, onCancel])

  if (!isOpen) return null

  return createPortal(
    <div className="modal-backdrop">
      <div className="floating-card max-w-md w-full mx-4 animate-fade-in">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-bold text-gray-900">Sublet - Add Remarks</h3>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none transition-colors"
            >
              ✕
            </button>
          </div>
          
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              Job <span className="font-semibold">{jobNumber}</span> will be marked as sublet.
            </p>
            <p className="text-sm text-gray-600 mb-3">
              Please provide details about the sublet work:
            </p>
            
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter sublet details (e.g., external vendor, work description, expected completion date, etc.)"
              className="w-full h-24 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={updating}
            />
          </div>
          
          <div className="flex gap-3 justify-end">
            <button
              onClick={handleCancel}
              disabled={updating}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={updating || !remarks.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {updating ? 'Updating...' : 'Mark as Sublet'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
