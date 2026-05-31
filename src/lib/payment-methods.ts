export const PAYMENT_SLUGS = ['CASH', 'QR_THB', 'QR_RUB', 'STRIPE'] as const
export type PaymentOptionSlug = (typeof PAYMENT_SLUGS)[number]

export type PaymentMethodRow = {
  slug: string
  enabled: boolean
  title: string
  instruction?: string | null
  qrImageUrl?: string | null
  /** Для QR_RUB: сколько ₽ за 1 ฿ */
  rubPerThb?: number | null
}

export const DEFAULT_PAYMENT_METHODS: PaymentMethodRow[] = [
  { slug: 'CASH', enabled: true, title: 'Наличные курьеру', instruction: null, qrImageUrl: null, rubPerThb: null },
  {
    slug: 'QR_THB',
    enabled: false,
    title: 'QR · тайский банк',
    instruction: 'Отсканируйте QR и переведите сумму в батах.',
    qrImageUrl: null,
    rubPerThb: null,
  },
  {
    slug: 'QR_RUB',
    enabled: false,
    title: 'QR · рубли',
    instruction: 'Сумма в ₽ пересчитана по курсу. Переведите по QR.',
    qrImageUrl: null,
    rubPerThb: 2.75,
  },
  { slug: 'STRIPE', enabled: false, title: 'Карта (Stripe)', instruction: null, qrImageUrl: null, rubPerThb: null },
]

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function parsePaymentMethodsJson(raw: unknown): PaymentMethodRow[] {
  if (!Array.isArray(raw)) return []
  const out: PaymentMethodRow[] = []
  for (const row of raw) {
    if (!isRecord(row)) continue
    const slug = String(row.slug || '').trim().toUpperCase()
    if (!PAYMENT_SLUGS.includes(slug as PaymentOptionSlug)) continue
    const rub = row.rubPerThb
    const rubNum = rub == null || rub === '' ? null : Number(rub)
    out.push({
      slug,
      enabled: Boolean(row.enabled),
      title: String(row.title || slug).trim() || slug,
      instruction: row.instruction != null ? String(row.instruction) : null,
      qrImageUrl: row.qrImageUrl != null ? String(row.qrImageUrl).trim() || null : null,
      rubPerThb: rubNum != null && Number.isFinite(rubNum) && rubNum > 0 ? rubNum : null,
    })
  }
  return out
}

/** Объединить сохранённый JSON с дефолтными слотами (порядок как в DEFAULT). */
export function mergePaymentMethodsWithDefaults(raw: unknown): PaymentMethodRow[] {
  const parsed = parsePaymentMethodsJson(raw)
  const bySlug = new Map(parsed.map((p) => [p.slug, p]))
  return DEFAULT_PAYMENT_METHODS.map((def) => {
    const saved = bySlug.get(def.slug)
    if (!saved) return { ...def }
    return {
      ...def,
      ...saved,
      title: saved.title?.trim() ? saved.title : def.title,
    }
  })
}

export function stripeIsConfigured(): boolean {
  return Boolean(String(process.env.STRIPE_SECRET_KEY || '').trim())
}

/** Способы, которые реально показываем в чекауте: включено + для QR есть картинка + Stripe только если настроен. */
export function methodsAvailableForConsumer(methods: PaymentMethodRow[]): PaymentMethodRow[] {
  const stripeOk = stripeIsConfigured()
  return methods.filter((m) => {
    if (!m.enabled) return false
    if (m.slug === 'STRIPE') return stripeOk
    if (m.slug === 'QR_THB' || m.slug === 'QR_RUB') return Boolean(m.qrImageUrl?.trim())
    return true
  })
}

export function computeRubTotal(totalThb: number, rubPerThb: number): number {
  const v = totalThb * rubPerThb
  if (!Number.isFinite(v)) return 0
  return Math.round(v * 100) / 100
}

export function isQrSlug(slug: string | null | undefined): boolean {
  const s = String(slug || '').toUpperCase()
  return s === 'QR_THB' || s === 'QR_RUB'
}
