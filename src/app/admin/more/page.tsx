import Link from 'next/link'
import { Row, RowGroup, Screen } from '@/components/kit'

/** «Ещё» по группам: продажи · заведение · люди и связь. */
export default function AdminMorePage() {
  return (
    <Screen title="ещё">
      <Link href="/" prefetch={false} className="mb-4 flex h-14 items-center justify-between rounded-[18px] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-4 text-[15px] font-semibold text-[color:var(--text)]">
        посмотреть как гость <span aria-hidden>›</span>
      </Link>
      <div className="flex flex-col gap-4">
        <RowGroup title="продажи">
          <Row first href="/admin/rations" label="рационы" hint="подписчики и цены" />
          <Row href="/admin/banners" label="акции" hint="баннеры на главной и промокоды" />
          <Row href="/admin/requests" label="запросы гостей" hint="банкеты, кейтеринг, особые" />
        </RowGroup>
        <RowGroup title="заведение">
          <Row first href="/admin/restaurant" label="пауза и часы" hint="название, адрес, время работы, магазин" />
          <Row href="/admin/restaurant/delivery" label="доставка" hint="цена, бесплатно от, зоны" />
          <Row href="/admin/restaurant/payments" label="оплата" hint="QR, перевод, наличные" />
          <Row href="/admin/restaurant/brand" label="оформление" hint="обложка и логотип на главной" />
        </RowGroup>
        <RowGroup title="люди и связь">
          <Row first href="/admin/team" label="команда" hint="кто получает заказы в Telegram" />
          <Row href="/admin/qr" label="бот и QR на столы" hint="подключение, приветствие, ссылка для гостей" />
          <Row href="/admin/notifications" label="уведомления" hint="какие сообщения уходят гостям" />
        </RowGroup>
        <Link href="/profile" prefetch={false} className="py-3 text-center text-[14px] font-semibold text-[color:var(--muted)]">в профиль гостя</Link>
      </div>
    </Screen>
  )
}
