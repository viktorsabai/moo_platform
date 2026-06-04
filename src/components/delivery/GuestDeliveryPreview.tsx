'use client'

import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import type { GuestDeliveryState } from '@/hooks/useGuestDelivery'

type Props = {
  delivery: GuestDeliveryState
  subtotal: number
  compact?: boolean
  showZonesHint?: boolean
}

export function GuestDeliveryPreview({ delivery, subtotal, compact = false, showZonesHint = true }: Props) {
  const {
    settings,
    zones,
    quote,
    profileAddress,
    deliveryAvailable,
    estimatedDeliveryFee,
    estimatedTotal,
    outOfZone,
    settingsLoading,
    quoteLoading,
  } = delivery

  if (settingsLoading) {
    return (
      <div className={compact ? 'text-[11px] text-[color:var(--muted)]' : 'rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-2.5 text-[12px] text-[color:var(--muted)]'}>
        загрузка доставки…
      </div>
    )
  }

  if (!deliveryAvailable) {
    return (
      <div className={compact ? 'text-[11px] text-[color:var(--muted)]' : 'rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-2.5'}>
        <div className="text-[12px] font-semibold text-[color:var(--text)]">доставка недоступна</div>
        <div className="mt-0.5 text-[11px] text-[color:var(--muted)]">на оформлении доступен самовывоз</div>
      </div>
    )
  }

  const zoneLabel =
    quote?.matched && quote.zone
      ? quote.zone.districtName || quote.zone.name
      : null
  const freeFrom = quote?.matched && quote.zone ? quote.zone.minOrderAmount : settings.freeDeliveryFrom
  const freeReached = freeFrom > 0 && subtotal >= freeFrom

  const feeLine =
    outOfZone
      ? 'вне зоны'
      : quoteLoading && profileAddress?.address
        ? 'проверяем…'
        : estimatedDeliveryFee <= 0
          ? 'бесплатно'
          : formatPrice(estimatedDeliveryFee)

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`font-semibold text-[color:var(--text)] ${compact ? 'text-[11px]' : 'text-[12px]'}`}>
            доставка {feeLine}
          </div>
          {zoneLabel ? (
            <div className="mt-0.5 text-[10px] text-[color:var(--muted)]">район: {zoneLabel}</div>
          ) : profileAddress?.address ? (
            <div className="mt-0.5 text-[10px] text-[color:var(--muted)] truncate">{profileAddress.address}</div>
          ) : (
            <div className="mt-0.5 text-[10px] text-[color:var(--muted)]">
              <Link href="/profile/delivery" className="font-semibold underline underline-offset-2">
                укажите адрес
              </Link>
              {' '}для точной цены
            </div>
          )}
          {freeFrom > 0 ? (
            <div className="mt-0.5 text-[10px] text-[color:var(--muted)]">
              {freeReached ? `бесплатная доставка от ${formatPrice(freeFrom)} ✓` : `бесплатно от ${formatPrice(freeFrom)}`}
            </div>
          ) : null}
          {outOfZone ? (
            <div className="mt-1 text-[10px] font-semibold text-[#C62828]">
              {quote?.message || 'адрес вне зоны — измените в профиле'}
            </div>
          ) : null}
        </div>
        {!compact ? (
          <div className="shrink-0 text-right">
            <div className="text-[10px] text-[color:var(--muted)]">с доставкой</div>
            <div className="text-[14px] font-extrabold tabular-nums text-[color:var(--text)]">
              {formatPrice(estimatedTotal)}
            </div>
          </div>
        ) : null}
      </div>
      {showZonesHint && zones.length > 0 && !compact ? (
        <div className="mt-2 text-[10px] text-[color:var(--muted)]">
          активных зон: {zones.length}
          {zones.length <= 4
            ? ` · ${zones.map((z) => z.name).join(', ')}`
            : ` · от ${formatPrice(zones.reduce((m, z) => Math.min(m, z.deliveryFee), zones[0]?.deliveryFee ?? 0))}`}
        </div>
      ) : null}
    </>
  )

  if (compact) {
    return <div className="text-[color:var(--text)]">{body}</div>
  }

  return (
    <div className="rounded-xl border border-[color:var(--stroke)] bg-[color:var(--surface)] p-2.5">{body}</div>
  )
}
