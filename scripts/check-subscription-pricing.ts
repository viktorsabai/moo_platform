/**
 * Проверка инварианта цены рациона. Запуск: npx tsx scripts/check-subscription-pricing.ts
 * Цена гостя: floor (себестоимость × (1 + мин. маржа)) ≤ цена ≤ ceiling (меню × (1 − мин. выгода гостя)).
 */
import { calculateSubscriptionQuote, type SubscriptionQuoteInput } from '../src/lib/subscription-pricing'
import { DEFAULT_COMMERCE, type SubscriptionCommerceConfig } from '../src/lib/subscription-config'

let failed = 0
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failed += 1
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

function quote(opts: {
  price: number
  cost: number | null
  periodDays: number
  periodDisc?: number
  perDay?: boolean
  commerce?: Partial<SubscriptionCommerceConfig>
  override?: number
}) {
  const days = [1, 2, 3, 4, 5]
  const items = opts.perDay
    ? days.map((d) => ({ dishId: 'd', quantity: 1, mealSlot: 'lunch', modifierIds: [], dayOfWeek: d }))
    : [{ dishId: 'd', quantity: 1, mealSlot: 'lunch', modifierIds: [], dayOfWeek: null }]
  const input = {
    items,
    deliveryDaysPerWeek: 5,
    deliveryDaysJs: opts.perDay ? days : undefined,
    periodDays: opts.periodDays,
    personCount: 1,
    commerce: { ...DEFAULT_COMMERCE, ...opts.commerce },
    dishes: new Map([['d', { id: 'd', price: opts.price, costPrice: opts.cost }]]),
    modifiers: new Map(),
    periodDiscountPercent: opts.periodDisc ?? 0,
    ownerPriceOverride: opts.override ?? null,
  } as unknown as SubscriptionQuoteInput
  return calculateSubscriptionQuote(input)
}

for (const periodDays of [7, 14, 28]) {
  const disc = periodDays === 28 ? 8 : periodDays === 14 ? 3 : 0
  const flat = quote({ price: 300, cost: 120, periodDays, periodDisc: disc })
  const perDay = quote({ price: 300, cost: 120, periodDays, periodDisc: disc, perDay: true })
  check(`${periodDays}д: «по дням» = «ровное» на одном меню`, flat.guestPrice === perDay.guestPrice, `${flat.guestPrice} vs ${perDay.guestPrice}`)
  check(`${periodDays}д: розница одинакова`, flat.periodRetail === perDay.periodRetail)
  check(`${periodDays}д: гость платит меньше меню`, flat.guestPrice < flat.periodRetail, `${flat.guestPrice} < ${flat.periodRetail}`)
}

// Дорогая себестоимость: раньше гость платил больше меню.
{
  const q = quote({ price: 300, cost: 250, periodDays: 7 })
  check('дорогая себестоимость: не продаём, а не берём больше меню', !q.offerable && q.blockReason === 'no_guest_benefit', `reason=${q.blockReason}`)
  check('дорогая себестоимость: цена гостя не выше меню', q.guestPrice <= q.periodRetail + 0.01 || !q.offerable)
}

// Скидка за период раньше пробивала мин. маржу.
for (const disc of [8, 20, 40, 50]) {
  const q = quote({ price: 300, cost: 200, periodDays: 28, periodDisc: disc })
  check(`период −${disc}%: цена не ниже пола`, q.guestPrice >= q.floorPrice, `price ${q.guestPrice}, floor ${q.floorPrice}, offerable=${q.offerable}`)
  if (q.offerable) {
    check(`период −${disc}%: маржа ≥ мин. (${DEFAULT_COMMERCE.minMarginPercent}% к себестоимости)`, q.guestPrice >= 200 * 20 * 1.2 - 0.01)
  }
}

// Нет себестоимости.
{
  const q = quote({ price: 300, cost: null, periodDays: 28, periodDisc: 8 })
  check('нет себестоимости: не продаём', !q.offerable && q.blockReason === 'missing_cost')
  check('нет себестоимости: маржа не рисуется как 100%', q.ownerMarginPercent === 0)
}

// Нормальный случай.
{
  const q = quote({ price: 300, cost: 120, periodDays: 7 })
  check('нормальный: можно продавать', q.offerable)
  check('нормальный: между полом и потолком', q.guestPrice >= q.floorPrice && q.guestPrice <= q.ceilingPrice, `${q.floorPrice} ≤ ${q.guestPrice} ≤ ${q.ceilingPrice}`)
  check('нормальный: выгода гостя не меньше минимума', q.guestSavingsPercent >= DEFAULT_COMMERCE.minGuestDiscountPercent - 0.01, `${q.guestSavingsPercent}%`)
}

// Переопределение цены владельцем не пробивает ни пол, ни потолок.
{
  const low = quote({ price: 300, cost: 120, periodDays: 7, override: 10 })
  const high = quote({ price: 300, cost: 120, periodDays: 7, override: 99999 })
  check('override вниз упирается в пол', low.guestPrice === low.floorPrice, `${low.guestPrice} / ${low.floorPrice}`)
  check('override вверх упирается в потолок', high.guestPrice === high.ceilingPrice, `${high.guestPrice} / ${high.ceilingPrice}`)
}

if (failed) {
  console.error(`\n${failed} проверок не прошло`)
  process.exit(1)
}
console.log('\nвсе проверки прошли')
