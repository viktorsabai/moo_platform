import type { ReactNode } from 'react'

function IconBase({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'h-5 w-5'}
    >
      {children}
    </svg>
  )
}

export function IconGrid({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M4 4h7v7H4z" />
      <path d="M13 4h7v7h-7z" />
      <path d="M4 13h7v7H4z" />
      <path d="M13 13h7v7h-7z" />
    </IconBase>
  )
}

// lighter "single tile" icon (less visual noise than 4 squares)
export function IconTile({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M6 6h12v12H6z" />
    </IconBase>
  )
}

export function IconList({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </IconBase>
  )
}

export function IconChevronLeft({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M15 18l-6-6 6-6" />
    </IconBase>
  )
}

export function IconMenu({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </IconBase>
  )
}

export function IconSearch({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
      <path d="M21 21l-4.3-4.3" />
    </IconBase>
  )
}

export function IconChevronRight({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M9 18l6-6-6-6" />
    </IconBase>
  )
}

export function IconChevronUp({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M18 15l-6-6-6 6" />
    </IconBase>
  )
}

export function IconChevronDown({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M6 9l6 6 6-6" />
    </IconBase>
  )
}

export function IconCart({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M6 6h15l-1.5 9H7.5L6 6Z" />
      <path d="M6 6l-1-3H2" />
      <path d="M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
      <path d="M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
    </IconBase>
  )
}

export function IconCopy({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M9 9h10v10H9z" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </IconBase>
  )
}

export function IconPencil({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </IconBase>
  )
}

export function IconPlus({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </IconBase>
  )
}

export function IconHeart({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
    </IconBase>
  )
}

export function IconHome({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </IconBase>
  )
}

export function IconTrash({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </IconBase>
  )
}

export function IconPower({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <path d="M12 2v10" />
    </IconBase>
  )
}

export function IconUserCircle({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
      <path d="M6.5 18.2a6.7 6.7 0 0 1 11 0" />
    </IconBase>
  )
}

export function IconMapPin({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10Z" />
      <circle cx="12" cy="11" r="2.2" />
    </IconBase>
  )
}

export function IconSun({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </IconBase>
  )
}

export function IconMoon({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M21 12.6A8.5 8.5 0 1 1 11.4 3a6.5 6.5 0 0 0 9.6 9.6Z" />
    </IconBase>
  )
}

export function IconCrown({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 10H5L3 8Z" />
      <path d="M5 18h14" />
    </IconBase>
  )
}

export function IconReceipt({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M7 3h10v18l-2-1.5L12 21l-3-1.5L7 21V3Z" />
      <path d="M9.5 8h5" />
      <path d="M9.5 12h5" />
      <path d="M9.5 16h3.5" />
    </IconBase>
  )
}

export function IconBell({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </IconBase>
  )
}

export function IconCard({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 14h4" />
    </IconBase>
  )
}

export function IconCamera({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M4 8h4l1.5-2h5L16 8h4v12H4z" />
      <circle cx="12" cy="14" r="3.2" />
    </IconBase>
  )
}

export function IconUndo({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M9 7H4v5" />
      <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" />
    </IconBase>
  )
}

export function IconEyeOff({ className }: { className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 1 0 2.8 2.8" />
      <path d="M9.9 5.1A10.8 10.8 0 0 1 12 5c5 0 8.5 3.3 10 7-0.5 1.3-1.4 2.8-2.8 4.1" />
      <path d="M6.1 6.1C4.1 7.4 2.8 9.3 2 12c1.5 3.7 5 7 10 7 1.6 0 3.1-.3 4.4-.8" />
    </IconBase>
  )
}

