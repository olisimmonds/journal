import { Button } from './Button'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** A reusable yes/no confirmation, used for anything destructive (deletes). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      {description && <p className="mb-4 text-sm text-ink-secondary">{description}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
