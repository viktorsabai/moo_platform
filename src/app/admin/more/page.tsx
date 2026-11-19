import Link from 'next/link'
import { Row, RowGroup, Screen } from '@/components/kit'

export default function AdminMorePage() {
  return (
    <Screen title="ещё">
      <Link href="/" prefetch={false} className="mb-4 flex h-14 items-center justify-between rounded-[18px] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 text-[15px] font-semibold text-[color:var(--text)]">
        посмотреть как гость <span aria-hidden>›</span>
      </Link>
      <div className="flex flex-col gap-4">
        <RowGroup>
          <Row first href="/admin/rations" label="рационы" hint="подписчики и цены" />
          <Row href="/admin/banners" label="акции" hint="баннеры и промокоды" />
          <Row href="/admin/requests" label="запросы гостей" hint="банкеты, кейтеринг, особые" />
        </RowGroup>
        <RowGroup>
          <Row first href="/admin/restaurant" label="ресторан" hint="часы, пауза, зоны доставки, оплата, бот, команда" />
        </RowGroup>
        <Link href="/profile" prefetch={false} className="py-3 text-center text-[14px] font-semibold text-[color:var(--muted)]">в профиль гостя</Link>
      </div>
    </Screen>
  )
}
