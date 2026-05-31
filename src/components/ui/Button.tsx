import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'soft' | 'ghost' | 'dangerSoft'
type Size = 'md' | 'sm' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  ...props
}: ButtonProps) {
  const base = 'btn'
  const v =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'dangerSoft'
        ? 'border border-red-300/70 bg-red-500/10 text-red-200'
      : variant === 'soft'
        ? 'btn-soft'
        : 'btn-ghost'
  const s =
    size === 'sm'
      ? 'px-3 py-1.5 text-[13px] rounded-full'
      : size === 'lg'
        ? 'px-6 py-3 text-[15px]'
        : 'px-4 py-2 text-[14px]'

  return (
    <button
      className={cn(base, v, s, fullWidth && 'w-full', className)}
      {...props}
    />
  )
}

