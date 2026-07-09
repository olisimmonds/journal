import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/** A simple centered modal, dismissible via backdrop click or Escape. */
export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface-1 p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title && <h2 className="mb-3 text-lg font-semibold text-ink-primary">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  )
}
