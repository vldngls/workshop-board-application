'use client'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const confirmButtonClass = confirmVariant === 'danger'
    ? 'bg-red-500 hover:bg-red-600 text-white'
    : 'bg-[color:var(--color-ford-blue)] hover:bg-blue-700 text-white'

  return (
    <div className="modal-backdrop">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">
            {title}
          </h3>
          <p className="text-neutral-600 mb-6">
            {message}
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors font-medium text-neutral-700"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 rounded-lg transition-colors font-medium ${confirmButtonClass}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

