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
    ? 'btn-destructive'
    : 'btn'

  return createPortal(
    <div className="modal-backdrop">
      <div className="ios-card max-w-md w-full modal-content">
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
              className="btn-secondary"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={confirmButtonClass}
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

