import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-ink-primary text-surface-0 hover:opacity-90 active:opacity-80',
  secondary:
    'bg-surface-2 text-ink-primary border border-border hover:bg-surface-3 active:bg-surface-3',
  ghost: 'text-ink-secondary hover:text-ink-primary hover:bg-surface-2',
  danger: 'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20',
}

/** Reusable button with the app's grayscale variants and a consistent tap target. */
export function Button({ variant = 'secondary', className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
