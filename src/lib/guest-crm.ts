/**
 * CRM-style interpretation of guest activity for owner dashboard.
 * Pure helpers — safe for server components.
 */

export type GuestCrmSeg = 'loyal' | 'checkout_drop' | 'cart_drop' | 'favorite' | 'browsing' | 'new_visitor'

export type GuestCrmMetrics = {
  views: number
  dishViews: number
  cartAdds: number
  favorites: number
  checkoutStarts: number
  orders: number
  isFresh: boolean
  interests: string[]
}

export function parseGuestCrmSeg(raw: string | null | undefined): GuestCrmSeg | null {
  const s = String(raw || '').trim().toLowerCase()
  const ok: GuestCrmSeg[] = ['loyal', 'checkout_drop', 'cart_drop', 'favorite', 'browsing', 'new_visitor']
  return ok.includes(s as GuestCrmSeg) ? (s as GuestCrmSeg) : null
}

/** Primary segment + copy for list cards (behavior → insight). */
export function deriveGuestCrm(g: GuestCrmMetrics): {
  crmSeg: GuestCrmSeg
  segmentEmoji: string
  segmentLabel: string
  insightLine: string
} {
  const dishHint = g.interests[0]?.trim()

  if (g.orders > 0) {
    return {
      crmSeg: 'loyal',
      segmentEmoji: '💰',
      segmentLabel: 'Лояльный',
      insightLine: `Уже делал заказ${g.favorites > 0 ? ' · есть избранное' : ''}`,
    }
  }
  if (g.checkoutStarts > 0) {
    return {
      crmSeg: 'checkout_drop',
      segmentEmoji: '🛒',
      segmentLabel: 'Бросил чекаут',
      insightLine: 'Дошёл до оплаты, не завершил',
    }
  }
  if (g.cartAdds > 0) {
    return {
      crmSeg: 'cart_drop',
      segmentEmoji: '🛒',
      segmentLabel: 'Бросил корзину',
      insightLine: 'Клал в корзину, заказ не оформил',
    }
  }
  if (g.favorites > 0) {
    return {
      crmSeg: 'favorite',
      segmentEmoji: '❤️',
      segmentLabel: 'Интерес к блюдам',
      insightLine: dishHint ? `Избранное: ${dishHint}` : 'Добавлял блюда в избранное',
    }
  }
  if (g.isFresh && g.orders === 0) {
    return {
      crmSeg: 'new_visitor',
      segmentEmoji: '🆕',
      segmentLabel: 'Новый гость',
      insightLine: 'Первый заход за 24ч · без заказа',
    }
  }
  if (g.dishViews >= 1 || g.views >= 2) {
    return {
      crmSeg: 'browsing',
      segmentEmoji: '👀',
      segmentLabel: 'Смотрит, не покупает',
      insightLine:
        g.views > 0 || g.dishViews > 0
          ? `Заходы и меню без заказа${dishHint ? ` · «${dishHint}»` : ''}`
          : 'Ещё без заказа',
    }
  }
  return {
    crmSeg: 'browsing',
    segmentEmoji: '👀',
    segmentLabel: 'Гость',
    insightLine: 'Мало сигналов — заглянул в приложение',
  }
}

/** URL query value for /admin/visits focus= */
export type GuestListFocus =
  | 'ALL'
  | 'NEW'
  | 'HOT'
  | 'FAVORITES'
  | 'CARTS'
  | 'CHECKOUTS'
  | 'BROWSING'
  | 'CART_DROP'
  | 'CHECKOUT_DROP'
  | 'LOYAL'
  | 'OPPORTUNITY'

export function normalizeGuestListFocus(value: unknown): GuestListFocus {
  const v = String(value || 'all').toUpperCase()
  const allowed: GuestListFocus[] = [
    'ALL',
    'NEW',
    'HOT',
    'FAVORITES',
    'CARTS',
    'CHECKOUTS',
    'BROWSING',
    'CART_DROP',
    'CHECKOUT_DROP',
    'LOYAL',
    'OPPORTUNITY',
  ]
  return allowed.includes(v as GuestListFocus) ? (v as GuestListFocus) : 'ALL'
}

export function guestMatchesListFocus(
  g: GuestCrmMetrics & { isFresh: boolean; statusTone: 'hot' | 'warm' | 'neutral' | 'done' },
  focus: GuestListFocus
): boolean {
  switch (focus) {
    case 'NEW':
      return g.isFresh
    case 'HOT':
      return g.statusTone === 'hot'
    case 'FAVORITES':
      return g.favorites > 0
    case 'CARTS':
      return g.cartAdds > 0
    case 'CHECKOUTS':
      return g.checkoutStarts > 0
    case 'BROWSING':
      return (
        g.orders === 0 &&
        g.cartAdds === 0 &&
        g.checkoutStarts === 0 &&
        (g.dishViews >= 1 || g.views >= 3)
      )
    case 'CART_DROP':
      return g.orders === 0 && g.cartAdds > 0
    case 'CHECKOUT_DROP':
      return g.orders === 0 && g.checkoutStarts > 0
    case 'LOYAL':
      return g.orders > 0
    case 'OPPORTUNITY':
      return g.orders === 0 && (g.statusTone === 'hot' || g.statusTone === 'warm')
    default:
      return true
  }
}

export function countGuestsByFocus(
  guests: Array<GuestCrmMetrics & { isFresh: boolean; statusTone: 'hot' | 'warm' | 'neutral' | 'done' }>,
  focus: GuestListFocus
): number {
  return guests.filter((g) => guestMatchesListFocus(g, focus)).length
}

export function buildGuestToCampaignHref(opts: {
  crmSeg: GuestCrmSeg
  telegramId: string | null
  guestName: string
}): string {
  const params = new URLSearchParams()
  params.set('section', 'campaigns')
  params.set('crmSeg', opts.crmSeg)
  if (opts.telegramId?.trim()) params.set('crmTg', opts.telegramId.trim())
  const name = String(opts.guestName || '').trim().slice(0, 80)
  if (name) params.set('crmName', name)
  return `/admin/banners?${params.toString()}`
}

export function buildVisitsFilterHref(days: number, type: string, focus: GuestListFocus = 'ALL') {
  const params = new URLSearchParams()
  params.set('days', String(days))
  if (type !== 'ALL') params.set('type', type)
  if (focus !== 'ALL') params.set('focus', focus)
  return `/admin/visits?${params.toString()}`
}

/** Короткая рекомендация для карточки гостя (как в CRM-референсе). */
export function recommendedActionHint(crmSeg: GuestCrmSeg): { title: string; body: string } {
  switch (crmSeg) {
    case 'loyal':
      return {
        title: 'Удержать лояльного',
        body: 'Персональная скидка от суммы чека или бонус к следующему заказу.',
      }
    case 'checkout_drop':
      return {
        title: 'Вернуть на оплату',
        body: 'Небольшая скидка при завершении заказа в ближайшие дни.',
      }
    case 'cart_drop':
      return {
        title: 'Вернуть из корзины',
        body: 'Промокод или бонус, если гость оформит заказ.',
      }
    case 'favorite':
      return {
        title: 'Дожать интерес к блюду',
        body: 'Скидка на чек или подарок к заказу с этим блюдом.',
      }
    case 'new_visitor':
      return {
        title: 'Приветствие нового гостя',
        body: 'Бонус на первый заказ — чаще всего лучший следующий шаг.',
      }
    case 'browsing':
    default:
      return {
        title: 'Стимулировать первый заказ',
        body: 'Бонус или скидка на первый заказ часто снимают сомнения.',
      }
  }
}
