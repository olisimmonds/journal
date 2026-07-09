import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center animate-fade-in">
      <p className="text-base font-medium text-ink-primary">{title}</p>
      {description && <p className="max-w-xs text-sm text-ink-tertiary">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
