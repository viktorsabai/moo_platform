'use client'

import type { Category } from '@/types'

interface CategoryFilterProps {
  categories: Category[]
  selectedCategory: string
  onSelectCategory: (categoryId: string) => void
}

export function CategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryFilterProps) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-[0_8px_22px_rgba(0,0,0,0.05)]">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSelectCategory('')}
          className={
            selectedCategory === ''
              ? 'shrink-0 inline-flex h-9 items-center justify-center rounded-full bg-[color:var(--accent)] px-3 text-[12px] font-semibold text-white shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition active:scale-[0.98]'
              : 'shrink-0 inline-flex h-9 items-center justify-center rounded-full border border-black/10 bg-white px-3 text-[12px] font-semibold text-black/70 shadow-[0_6px_14px_rgba(0,0,0,0.04)] transition active:scale-[0.98]'
          }
          aria-label="Все"
        >
          все
        </button>

        {categories.map((category) => {
          const isSelected = selectedCategory === category.id

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelectCategory(category.id)}
              className={
                isSelected
                  ? 'shrink-0 inline-flex h-9 items-center justify-center rounded-full bg-[color:var(--accent)] px-3 text-[12px] font-semibold text-white shadow-[0_8px_18px_rgba(0,0,0,0.12)] transition active:scale-[0.98]'
                  : 'shrink-0 inline-flex h-9 items-center justify-center rounded-full border border-black/10 bg-white px-3 text-[12px] font-semibold text-black/70 shadow-[0_6px_14px_rgba(0,0,0,0.04)] transition active:scale-[0.98]'
              }
            >
              {category.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
