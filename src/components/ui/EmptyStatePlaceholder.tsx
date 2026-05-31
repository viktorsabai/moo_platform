'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useVenue } from '@/lib/venue-context'

type Variant = 'home' | 'delivery' | 'store' | 'subscription' | 'menuEmpty' | 'adminPlans'

const variants: Record<Variant, { title: string; subtitle: string }> = {
  home: {
    title: 'MOO',
    subtitle: 'Заказы, подписки и доставка. Добавьте баннеры в ЛК — они появятся здесь.',
  },
  delivery: {
    title: 'MOO delivery',
    subtitle: 'Меню и магазин временно недоступны. Настройте в личном кабинете.',
  },
  store: {
    title: 'MOO store',
    subtitle: 'Магазин временно недоступен или пуст. Добавьте товары в ЛК.',
  },
  subscription: {
    title: 'MOO subscription',
    subtitle: 'Подписки временно недоступны. Настройте в личном кабинете.',
  },
  menuEmpty: {
    title: 'MOO delivery',
    subtitle: 'Меню пока пустое. Добавьте блюда в личном кабинете.',
  },
  adminPlans: {
    title: 'шаблоны планов',
    subtitle: 'Пока нет шаблонов. Добавьте план выше — он появится в визарде подписки.',
  },
}

export function EmptyStatePlaceholder({
  variant,
  message,
  compact,
}: {
  variant: Variant
  message?: ReactNode
  compact?: boolean
}) {
  const venue = useVenue()
  const config = variants[variant]
  const displayTitle = variant === 'home' ? (venue?.name || config.title) : config.title

  const isAdmin = variant === 'adminPlans'

  return (
    <section
      className={cn(
        'flex items-center justify-center px-4 sm:px-6',
        compact ? 'min-h-[120px] py-8' : 'min-h-[50vh]'
      )}
      aria-label="пустое состояние"
    >
      <div className="flex flex-col items-center justify-center text-center max-w-md">
        <div
          className={cn(
            'font-extrabold tracking-tight text-black/90',
            isAdmin ? 'text-[18px]' : 'text-[32px] sm:text-[36px]'
          )}
        >
          {displayTitle}
        </div>
        {!isAdmin && <div className="mt-2 text-[15px] font-medium text-black/55">food mood tech</div>}
        <p className="mt-6 max-w-[300px] text-[14px] leading-relaxed text-black/50">
          {message ?? config.subtitle}
        </p>
      </div>
    </section>
  )
}
