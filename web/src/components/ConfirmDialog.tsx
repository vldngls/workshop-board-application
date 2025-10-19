'use client'

import { createPortal } from 'react-dom'

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
    ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white'
    : 'bg-gradient-to-r from-ford-blue to-ford-blue-light hover:from-ford-blue-light hover:to-ford-blue text-white'

  return createPortal(
    <div className="modal-backdrop">
      <div className="floating-card max-w-md w-full animate-fade-in">
        <div className="p-6">
          <h3 className="text-xl font-bold text-neutral-900 mb-3">
            {title}
          </h3>
          <p className="text-neutral-700 mb-6 font-medium">
            {message}
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-6 py-2.5 bg-white/50 hover:bg-white/70 rounded-xl font-semibold text-neutral-700 transition-all duration-200 border border-white/50 hover:shadow-lg hover:-translate-y-0.5"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`px-6 py-2.5 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${confirmButtonClass}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

