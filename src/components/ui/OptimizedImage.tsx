'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

/** `sizes` для `next/image` — без этого CDN отдаёт слишком крупные файлы. */
export const IMAGE_SIZES = {
  /** Pinterest-сетка меню (2 колонки) */
  menuGrid: '(max-width: 420px) 50vw, (max-width: 900px) 33vw, 320px',
  /** Fullscreen/оверлей блюда */
  menuFullscreen: '100vw',
  productCard: '(max-width: 480px) 92vw, 300px',
  productCardCompact: '(max-width: 480px) 78vw, 260px',
  /** Корзина: строка */
  cartRow: '128px',
  /** Корзина: мини-апсейл */
  cartUpsell: '140px',
  checkoutThumb: '40px',
  favoriteThumb: '(max-width: 480px) 28vw, 140px',
  productRow: '120px',
  homeBanner: '(max-width: 640px) 92vw, 520px',
  reelCard: '340px',
} as const

type OptimizedImageProps = {
  src: string | null | undefined
  alt: string
  className?: string
  sizes: string
  priority?: boolean
  /** 1–100; превью 72–78, крупно 80–86 */
  quality?: number
}

/**
 * Обертка над `next/image` с `fill` — родитель обязан быть `position: relative` с заданной высотой/шириной.
 * Уменьшает трафик: WebP/AVIF, отзывчивый srcset.
 */
export function OptimizedImage({ src, alt, className, sizes, priority, quality = 78 }: OptimizedImageProps) {
  const s = typeof src === 'string' ? src.trim() : ''
  if (!s) return null
  return (
    <Image
      src={s}
      alt={alt}
      fill
      sizes={sizes}
      className={cn(className)}
      priority={Boolean(priority)}
      quality={quality}
      decoding="async"
    />
  )
}
