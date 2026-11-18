'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { useVenue } from '@/lib/venue-context'
import { telegramInitHeaderRecord } from '@/lib/tg-webapp-client'
import { loadDeliveryProfile, DELIVERY_PROFILE_CHANGED_EVENT } from '@/lib/delivery-profile'
import { applyTheme, readTheme, saveTheme, type UiTheme } from '@/lib/theme'
import { getDemoBotLink } from '@/lib/telegram'
import { Btn, Card, Row, RowGroup, Screen, Segmented } from '@/components/kit'

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const { restaurantId, settings } = useVenue()
  const [theme, setTheme] = useState<UiTheme>('system')
  const [addressLine, setAddressLine] = useState<string | null>(null)
  const [inquiry, setInquiry] = useState<'idle' | 'sending' | 'sent'>('idle')

  useEffect(() => {
    setTheme(readTheme())
    const readAddr = () => {
      const p = loadDeliveryProfile()
      setAddressLine(p?.address ? [p.address, p.apartment].filter(Boolean).join(', ') : null)
    }
    readAddr()
    window.addEventListener(DELIVERY_PROFILE_CHANGED_EVENT, readAddr)
    return () => window.removeEventListener(DELIVERY_PROFILE_CHANGED_EVENT, readAddr)
  }, [])

  const isTg = typeof window !== 'undefined' && Boolean((window as any)?.Telegram?.WebApp?.initData)
  const user = session?.user as any
  const memberRole = user?.memberRole as string | undefined
  const platformRole = user?.platformRole as string | undefined
  const canOwner = memberRole === 'OWNER' || memberRole === 'ADMIN' || platformRole === 'SUPERADMIN'
  const name = useMemo(() => {
    if (user?.name) return String(user.name)
    const tg = typeof window !== 'undefined' ? (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user : undefined
    return String(tg?.first_name || tg?.username || 'гость')
  }, [user?.name])

  const changeTheme = (t: UiTheme) => {
    setTheme(t)
    saveTheme(t)
    applyTheme(t)
  }

  const sendInquiry = async () => {
    setInquiry('sending')
    try {
      const res = await fetch('/api/profile/business-inquiry', {
        method: 'POST',
        credentials: 'include',
        headers: { ...telegramInitHeaderRecord(), ...(restaurantId !== 'default' ? { 'x-ufo-restaurant': restaurantId } : {}) },
      })
      const d = await res.json().catch(() => null)
      if (!res.ok || !d?.ok) throw new Error(d?.error || 'не удалось отправить')
      setInquiry('sent')
      toast.success('передали — ответим в Telegram')
    } catch (e) {
      setInquiry('idle')
      toast.error(e instanceof Error ? e.message : 'ошибка')
    }
  }

  if (status === 'unauthenticated') {
    return (
      <Screen title="профиль">
        <Card>
          <div className="text-[15px] font-semibold text-[color:var(--text)]">войдите, чтобы видеть заказы и адрес</div>
          <div className="mt-1 text-[13px] text-[color:var(--muted)]">{isTg ? 'одним тапом через Telegram' : 'приложение работает внутри Telegram'}</div>
          <div className="mt-4 flex flex-col gap-2">
            {isTg ? (
              <Btn size="lg" full onClick={() => signIn('telegram', { initData: (window as any).Telegram.WebApp.initData, redirect: false })}>войти через Telegram</Btn>
            ) : (
              <a href={getDemoBotLink().tg} className="flex h-[52px] items-center justify-center rounded-[16px] bg-[color:var(--primary)] text-[16px] font-semibold text-[color:var(--on-primary)]">открыть в Telegram</a>
            )}
            <Link href="/signin/password" prefetch={false} className="flex h-11 items-center justify-center rounded-[14px] border border-[color:var(--stroke)] text-[14px] font-semibold text-[color:var(--text)]">вход для владельца по паролю</Link>
          </div>
        </Card>
        <div className="mt-4">
          <RowGroup title="вид">
            <div className="p-3"><Segmented value={theme} onChange={changeTheme} options={[{ value: 'light', label: 'светлая' }, { value: 'dark', label: 'тёмная' }, { value: 'system', label: 'как в системе' }]} /></div>
          </RowGroup>
        </div>
      </Screen>
    )
  }

  return (
    <Screen title={name} subtitle={canOwner ? (memberRole === 'OWNER' ? 'владелец' : 'админ') : undefined}>
      <div className="flex flex-col gap-4">
        {canOwner ? (
          <Link href="/admin" prefetch={false} className="flex h-14 items-center justify-between rounded-[18px] bg-[color:var(--primary)] px-4 text-[15px] font-semibold text-[color:var(--on-primary)]">
            кабинет заведения <span aria-hidden>›</span>
          </Link>
        ) : null}

        <RowGroup title="доставка">
          <Row first href="/profile/delivery" label="адрес" hint={addressLine ?? 'ещё не указан'} />
          <Row href="/orders" label="заказы" />
          {settings.subscriptionEnabled ? <Row href="/subscriptions" label="рационы" /> : null}
          <Row href="/profile/favorites" label="избранное" />
          <Row href="/profile/promocodes" label="промокоды" />
        </RowGroup>

        <RowGroup title="вид">
          <div className="p-3"><Segmented value={theme} onChange={changeTheme} options={[{ value: 'light', label: 'светлая' }, { value: 'dark', label: 'тёмная' }, { value: 'system', label: 'как в системе' }]} /></div>
        </RowGroup>

        <RowGroup title="ресторану">
          {canOwner ? (
            <Row first href="/admin/more" label="настройки заведения" />
          ) : (
            <Row first onClick={inquiry === 'idle' ? sendInquiry : undefined} label={inquiry === 'sent' ? 'заявку отправили' : 'подключить своё заведение'} hint={inquiry === 'sent' ? 'ответим в Telegram' : inquiry === 'sending' ? 'отправляем…' : 'одним тапом, без анкеты'} />
          )}
          <Row href="/requests/new" label="написать нам" hint="банкет, кейтеринг, особый запрос" />
        </RowGroup>

        <Btn variant="danger" onClick={() => signOut({ callbackUrl: '/' })}>выйти</Btn>
        <Link href="/privacy" prefetch={false} className="text-center text-[12px] text-[color:var(--muted)]">конфиденциальность</Link>
      </div>
    </Screen>
  )
}
