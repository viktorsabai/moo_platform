'use client'

import { useEffect, useState } from 'react'
import { Card, Screen } from '@/components/kit'
import { AdminDeliveryConfig } from '@/components/admin/AdminDeliveryConfig'

/** Доставка: цена по умолчанию, бесплатно от, зоны. */
export default function AdminDeliveryPage() {
  const [fees, setFees] = useState<{ fee: number; freeFrom: number } | null>(null)

  useEffect(() => {
    fetch('/api/admin/settings', { cache: 'no-store', credentials: 'include' })
      .then((x) => x.json())
      .then((st) => setFees({ fee: Number(st?.settings?.deliveryFee ?? 100), freeFrom: Number(st?.settings?.freeDeliveryFrom ?? 500) }))
      .catch(() => setFees({ fee: 100, freeFrom: 500 }))
  }, [])

  return (
    <Screen title="доставка" subtitle="цена, бесплатно от, зоны" back="/admin/more">
      {!fees ? (
        <div className="h-60 animate-pulse rounded-[20px] bg-[color:var(--surface)]" aria-busy />
      ) : (
        <Card>
          <AdminDeliveryConfig defaultDeliveryFee={fees.fee} freeDeliveryFrom={fees.freeFrom} onDefaultsChange={(fee, freeFrom) => setFees({ fee, freeFrom })} />
        </Card>
      )}
    </Screen>
  )
}
