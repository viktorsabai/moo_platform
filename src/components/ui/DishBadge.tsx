'use client'

import type { DishTag } from '@/types'

interface DishBadgeProps {
  tag: DishTag
}

const tagConfig: Record<DishTag, { label: string; emoji: string; color: string; bgColor: string }> = {
  new: {
    label: 'Новинка',
    emoji: '✨',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
  },
  popular: {
    label: 'Популярное',
    emoji: '⭐',
    color: 'text-[color:var(--warn)]',
    bgColor: 'bg-yellow-100',
  },
  hit: {
    label: 'Хит',
    emoji: '🔥',
    color: 'text-[color:var(--warn)]',
    bgColor: 'bg-orange-100',
  },
  spicy: {
    label: 'Острое',
    emoji: '🌶️',
    color: 'text-[color:var(--danger)]',
    bgColor: 'bg-[color:var(--danger-bg)]',
  },
  vegetarian: {
    label: 'Вегетарианское',
    emoji: '🥬',
    color: 'text-[color:var(--ok)]',
    bgColor: 'bg-[color:var(--ok-bg)]',
  },
  vegan: {
    label: 'Веганское',
    emoji: '🌱',
    color: 'text-[color:var(--ok)]',
    bgColor: 'bg-[color:var(--ok-bg)]',
  },
  healthy: {
    label: 'Полезное',
    emoji: '💚',
    color: 'text-teal-700',
    bgColor: 'bg-teal-100',
  },
  'chef-choice': {
    label: 'Выбор шефа',
    emoji: '👨‍🍳',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
  },
}

export function DishBadge({ tag }: DishBadgeProps) {
  const config = tagConfig[tag]
  
  return (
    <span
      className={`inline-flex items-center gap-1 ${config.bgColor} ${config.color} text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm whitespace-nowrap`}
      title={config.label}
    >
      <span className="text-xs">{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  )
}

