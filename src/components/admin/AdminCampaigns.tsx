'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { parseGuestCrmSeg, type GuestCrmSeg } from '@/lib/guest-crm'
import { cn } from '@/lib/utils'

type CampaignRow = {
  id: string
  name: string
  code?: string | null
  status: string
  visibility: string
  targetType: string
  rewardType: string
  rewardValue: number
  giftTitle?: string | null
  validTo?: string | null
  minSubtotal?: number | null
  firstOrderOnly?: boolean
  assignedTelegramId?: string | null
  usageLimitTotal?: number | null
  usageLimitPerUser?: number | null
  metadataJson?: any
  kind?: string
  _count?: { redemptions?: number; orders?: number }
}

type MenuCategoryRow = { id: string; name: string; slug: string }
type DishRow = { id: string; name: string; categoryId?: string | null; slug?: string; price?: number }

type ScenarioId = 'new_users' | 'happy_hours' | 'avg_check'
type RewardKind = 'FIXED' | 'PERCENT' | 'GIFT'

const cardClass =
  'rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] shadow-[var(--shadow-soft)]'

const defaultDraft = {
  name: '',
  code: '',
  targetType: 'ORDER_TOTAL',
  rewardType: 'FIXED' as RewardKind,
  rewardValue: '0',
  rewardCap: '',
  giftTitle: '',
  giftDishId: '',
  visibility: 'PUBLIC',
  firstOrderOnly: false,
  notifyOnPublish: false,
  minSubtotal: '',
  assignedTelegramId: '',
  validFrom: '',
  validTo: '',
  usageLimitTotal: '',
  usageLimitPerUser: '1',
  categoryId: '',
}

function randomPromoCode(prefix: string) {
  const s = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}${s}`
}

function defaultHappyRange() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  return { from: `${y}-${m}-${day}T14:00`, to: `${y}-${m}-${day}T17:00` }
}

const SCENARIOS: Array<{ id: ScenarioId; title: string; hint: string; emoji: string }> = [
  { id: 'new_users', title: 'Привлечь новых', hint: 'Бонус на первый заказ', emoji: '🎁' },
  { id: 'happy_hours', title: 'Счастливые часы', hint: 'Скидка % в тихое время', emoji: '⏰' },
  { id: 'avg_check', title: 'Средний чек', hint: 'Скидка при заказе от суммы', emoji: '📈' },
]

const REWARD_OPTIONS: Array<{ id: RewardKind; label: string; sub: string }> = [
  { id: 'FIXED', label: 'деньги', sub: '฿' },
  { id: 'PERCENT', label: 'скидка', sub: '%' },
  { id: 'GIFT', label: 'подарок', sub: '🎁' },
]

function formatDtShort(isoLike: string) {
  const s = String(isoLike || '').trim()
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s.slice(0, 16).replace('T', ' ')
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** datetime-local / ISO → ISO или null; не бросает (иначе createCampaign падает до fetch без тоста). */
function safeIsoFromInput(raw: string | undefined | null): string | null {
  const s = String(raw || '').trim()
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

const GUEST_CAMPAIGN_BOOT_KEY = 'ufo:guestCampaignBootstrap'

type GuestCampaignBootstrap = {
  v: 1
  ts: number
  scenario: ScenarioId
  campaignKind: 'AUTO' | 'PROMOCODE'
  draft: typeof defaultDraft
  usePeriod: boolean
  useLimits: boolean
}

function buildGuestCrmBootstrapSnapshot(preset: GuestCrmSeg, tg: string): Omit<GuestCampaignBootstrap, 'v' | 'ts'> {
  const code = (p: string) => randomPromoCode(p)
  if (preset === 'browsing' || preset === 'new_visitor') {
    if (tg) {
      return {
        scenario: 'new_users',
        campaignKind: 'PROMOCODE',
        draft: {
          ...defaultDraft,
          name: 'Бонус на первый заказ (лично)',
          rewardType: 'FIXED',
          rewardValue: '100',
          firstOrderOnly: true,
          visibility: 'ASSIGNED_ONLY',
          assignedTelegramId: tg,
          targetType: 'ORDER_TOTAL',
          code: code('YOU'),
          notifyOnPublish: false,
          minSubtotal: '',
        },
        usePeriod: false,
        useLimits: false,
      }
    }
    return {
      scenario: 'new_users',
      campaignKind: 'AUTO',
      draft: {
        ...defaultDraft,
        name: 'Бонус на первый заказ',
        rewardType: 'FIXED',
        rewardValue: '100',
        firstOrderOnly: true,
        visibility: 'PUBLIC',
        targetType: 'ORDER_TOTAL',
        code: '',
        notifyOnPublish: true,
        minSubtotal: '',
      },
      usePeriod: false,
      useLimits: false,
    }
  }
  if (preset === 'cart_drop') {
    return {
      scenario: 'avg_check',
      campaignKind: 'PROMOCODE',
      draft: {
        ...defaultDraft,
        name: 'Вернитесь за бонусом',
        rewardType: 'PERCENT',
        rewardValue: '12',
        rewardCap: '250',
        firstOrderOnly: false,
        visibility: tg ? 'ASSIGNED_ONLY' : 'PUBLIC',
        assignedTelegramId: tg || '',
        targetType: 'ORDER_TOTAL',
        code: code('BACK'),
        notifyOnPublish: false,
        minSubtotal: '400',
        giftDishId: '',
        giftTitle: '',
      },
      usePeriod: false,
      useLimits: false,
    }
  }
  if (preset === 'checkout_drop') {
    return {
      scenario: 'avg_check',
      campaignKind: 'PROMOCODE',
      draft: {
        ...defaultDraft,
        name: 'Завершите заказ со скидкой',
        rewardType: 'PERCENT',
        rewardValue: '15',
        rewardCap: '400',
        firstOrderOnly: false,
        visibility: tg ? 'ASSIGNED_ONLY' : 'PUBLIC',
        assignedTelegramId: tg || '',
        targetType: 'ORDER_TOTAL',
        code: code('PAY'),
        notifyOnPublish: false,
        minSubtotal: '350',
        giftDishId: '',
        giftTitle: '',
      },
      usePeriod: false,
      useLimits: false,
    }
  }
  if (preset === 'favorite') {
    return {
      scenario: 'avg_check',
      campaignKind: 'PROMOCODE',
      draft: {
        ...defaultDraft,
        name: 'Скидка на избранное',
        rewardType: 'PERCENT',
        rewardValue: '15',
        rewardCap: '300',
        firstOrderOnly: false,
        visibility: tg ? 'ASSIGNED_ONLY' : 'PUBLIC',
        assignedTelegramId: tg || '',
        targetType: 'ORDER_TOTAL',
        code: code('LOVE'),
        notifyOnPublish: false,
        minSubtotal: '250',
        giftDishId: '',
        giftTitle: '',
      },
      usePeriod: false,
      useLimits: false,
    }
  }
  return {
    scenario: 'avg_check',
    campaignKind: 'PROMOCODE',
    draft: {
      ...defaultDraft,
      name: 'Спасибо за заказы',
      rewardType: 'PERCENT',
      rewardValue: '8',
      rewardCap: '500',
      firstOrderOnly: false,
      visibility: tg ? 'ASSIGNED_ONLY' : 'PUBLIC',
      assignedTelegramId: tg || '',
      targetType: 'ORDER_TOTAL',
      code: code('VIP'),
      notifyOnPublish: false,
      minSubtotal: '800',
      giftDishId: '',
      giftTitle: '',
    },
    usePeriod: false,
    useLimits: false,
  }
}

export function AdminCampaigns() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const guestBootRestored = useRef(false)
  const [rows, setRows] = useState<CampaignRow[]>([])
  const [categories, setCategories] = useState<MenuCategoryRow[]>([])
  const [dishes, setDishes] = useState<DishRow[]>([])
  const [loading, setLoading] = useState(true)
  const [giftSourceState, setGiftSourceState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [saving, setSaving] = useState(false)
  const [campaignSaveError, setCampaignSaveError] = useState<string | null>(null)
  const [scenario, setScenario] = useState<ScenarioId | null>(null)
  const [campaignKind, setCampaignKind] = useState<'AUTO' | 'PROMOCODE'>('PROMOCODE')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showCalc, setShowCalc] = useState(false)
  const [giftQuery, setGiftQuery] = useState('')
  const [draft, setDraft] = useState(defaultDraft)
  const [usePeriod, setUsePeriod] = useState(false)
  const [useLimits, setUseLimits] = useState(false)
  const [calcAvgCheck, setCalcAvgCheck] = useState('850')
  const [calcMarginPct, setCalcMarginPct] = useState('35')
  const [calcActivations, setCalcActivations] = useState('20')
  const [advOpen, setAdvOpen] = useState({
    mechanic: false,
    visibility: false,
    audience: false,
    period: false,
    limits: false,
  })
  const [rewardConfirm, setRewardConfirm] = useState<RewardKind | null>(null)

  const selectableGiftDishes = useMemo(() => {
    const byCategory = draft.categoryId ? dishes.filter((d) => d.categoryId === draft.categoryId) : dishes
    const q = draft.rewardType === 'GIFT' ? giftQuery.trim().toLowerCase() : ''
    if (!q) return byCategory
    return byCategory.filter((d) => String(d.name || '').toLowerCase().includes(q))
  }, [dishes, draft.categoryId, draft.rewardType, giftQuery])

  const selectedGiftDish = useMemo(
    () => dishes.find((d) => d.id === draft.giftDishId) || null,
    [dishes, draft.giftDishId],
  )

  const firstOrderLocked = scenario === 'new_users'

  const targetLabel =
    draft.targetType === 'ORDER_TOTAL'
      ? 'весь чек'
      : draft.targetType === 'DELIVERY_FEE'
        ? 'доставка'
        : 'категория'

  const visibilityLabel =
    draft.visibility === 'PUBLIC'
      ? 'публичная'
      : draft.visibility === 'HIDDEN'
        ? 'скрытая'
        : 'личная'

  const advSummaryMechanic = useMemo(() => {
    if (draft.targetType === 'ORDER_TOTAL') return 'на весь чек'
    if (draft.targetType === 'DELIVERY_FEE') return 'на доставку'
    const c = categories.find((x) => x.id === draft.categoryId)
    return c ? `категория: ${c.name}` : 'категория не выбрана'
  }, [draft.targetType, draft.categoryId, categories])

  const advSummaryVisibility = useMemo(() => {
    const v = visibilityLabel
    const c = draft.code.trim()
    if (draft.visibility === 'HIDDEN') return `${v}, код ${c || '…'}`
    if (draft.visibility === 'ASSIGNED_ONLY') return `${v}, по Telegram ID`
    return c ? `${v}, код ${c}` : `${v}, без кода`
  }, [draft.visibility, draft.code, visibilityLabel])

  const advSummaryAudience = useMemo(() => {
    if (firstOrderLocked) return 'только первый заказ — из сценария'
    return draft.firstOrderOnly ? 'только первый заказ' : 'любой заказ'
  }, [firstOrderLocked, draft.firstOrderOnly])

  const advSummaryPeriod = useMemo(() => {
    if (!usePeriod || !draft.validFrom || !draft.validTo) return 'без ограничения по датам'
    return `${formatDtShort(draft.validFrom)} — ${formatDtShort(draft.validTo)}`
  }, [usePeriod, draft.validFrom, draft.validTo])

  const advSummaryLimits = useMemo(() => {
    const min = Number(draft.minSubtotal)
    const hasMin = scenario !== 'avg_check' && Number.isFinite(min) && min > 0
    const lim = useLimits && Number(draft.usageLimitTotal) > 0
    const parts: string[] = []
    if (hasMin) parts.push(`мин. чек ${min} ฿`)
    if (lim) parts.push(`лимит ${draft.usageLimitTotal}`)
    if (useLimits && Number(draft.usageLimitPerUser) > 0) parts.push(`до ${draft.usageLimitPerUser} на клиента`)
    return parts.length ? parts.join(' · ') : 'без лимитов по сумме'
  }, [draft.minSubtotal, draft.usageLimitTotal, draft.usageLimitPerUser, scenario, useLimits])

  const humanSummary = useMemo(() => {
    if (!scenario) return 'Выберите цель — здесь появится краткое описание для гостя.'

    const parts: string[] = []
    if (draft.rewardType === 'GIFT') {
      const g = selectedGiftDish?.name || draft.giftTitle || 'подарок из меню'
      parts.push(`Гость получит: ${g}`)
    } else if (draft.rewardType === 'PERCENT') {
      const p = Math.max(0, Number(draft.rewardValue) || 0)
      const cap = Number(draft.rewardCap) > 0 ? ` (не больше ${draft.rewardCap} ฿)` : ''
      parts.push(`Скидка ${p}% на ${targetLabel}${cap}`)
    } else {
      const v = Math.max(0, Number(draft.rewardValue) || 0)
      parts.push(`Скидка ${v} ฿ на ${targetLabel}`)
    }

    if (firstOrderLocked || draft.firstOrderOnly) {
      parts.push('при первом заказе')
    }
    if (scenario === 'avg_check') {
      const m = Math.max(0, Number(draft.minSubtotal) || 0)
      if (m > 0) parts.push(`если чек от ${m} ฿`)
    }
    if (usePeriod && draft.validFrom && draft.validTo) {
      parts.push(`с ${formatDtShort(draft.validFrom)} до ${formatDtShort(draft.validTo)}`)
    }
    if (campaignKind === 'AUTO' && draft.rewardType === 'FIXED' && scenario === 'new_users') {
      parts.push('применится в чекауте без промокода')
    } else if (draft.code.trim()) {
      parts.push(`промокод ${draft.code.trim()}`)
    }

    return parts.join(' · ')
  }, [
    scenario,
    draft.rewardType,
    draft.rewardValue,
    draft.rewardCap,
    draft.giftTitle,
    draft.minSubtotal,
    draft.firstOrderOnly,
    draft.code,
    draft.validFrom,
    draft.validTo,
    usePeriod,
    campaignKind,
    firstOrderLocked,
    selectedGiftDish?.name,
    targetLabel,
  ])

  const rewardHasMeaningfulData = (rt: RewardKind) => {
    if (rt === 'GIFT') return Boolean(draft.giftDishId || draft.giftTitle.trim())
    if (rt === 'PERCENT') return Number(draft.rewardValue) > 0 || Number(draft.rewardCap) > 0
    return Number(draft.rewardValue) > 0
  }

  const requestRewardTypeChange = (next: RewardKind) => {
    if (next === draft.rewardType) return
    if (rewardHasMeaningfulData(draft.rewardType)) {
      setRewardConfirm(next)
      return
    }
    applyRewardType(next)
  }

  const applyRewardType = (next: RewardKind) => {
    setDraft((d) => {
      let code = d.code
      if (scenario === 'new_users') {
        if (next === 'FIXED') code = ''
        else code = d.code.trim() || randomPromoCode('WEL')
      }
      return {
        ...d,
        rewardType: next,
        code,
        rewardValue:
          next === 'GIFT'
            ? '0'
            : next === 'PERCENT'
              ? d.rewardType === 'PERCENT'
                ? d.rewardValue
                : '10'
              : d.rewardType === 'FIXED'
                ? d.rewardValue
                : '100',
        rewardCap: next === 'PERCENT' ? d.rewardCap : '',
        giftDishId: next === 'GIFT' ? '' : '',
        giftTitle: next === 'GIFT' ? '' : '',
      }
    })
    if (next !== 'GIFT') setGiftQuery('')
    if (scenario === 'new_users') setCampaignKind(next === 'FIXED' ? 'AUTO' : 'PROMOCODE')
    setRewardConfirm(null)
  }

  const avgCheck = Math.max(0, Number(calcAvgCheck) || 0)
  const marginPct = Math.max(0, Number(calcMarginPct) || 0)
  const activations = Math.max(0, Math.floor(Number(calcActivations) || 0))
  const fixedValue = Math.max(0, Number(draft.rewardValue) || 0)
  const rewardCapValue = Math.max(0, Number(draft.rewardCap) || 0)
  const giftCost = Math.max(0, Number(selectedGiftDish?.price) || 0)
  const discountPerOrder =
    draft.rewardType === 'GIFT'
      ? giftCost
      : draft.rewardType === 'PERCENT'
        ? rewardCapValue > 0
          ? Math.min((avgCheck * fixedValue) / 100, rewardCapValue)
          : (avgCheck * fixedValue) / 100
        : Math.min(fixedValue, avgCheck)
  const campaignCost = discountPerOrder * activations
  const grossRevenue = avgCheck * activations
  const grossProfitBefore = grossRevenue * (marginPct / 100)
  const grossProfitAfter = grossProfitBefore - campaignCost

  function applyScenario(s: ScenarioId) {
    setScenario(s)
    setRewardConfirm(null)
    setShowAdvanced(false)
    setAdvOpen({ mechanic: false, visibility: false, audience: false, period: false, limits: false })
    if (s === 'new_users') {
      setCampaignKind('AUTO')
      setDraft({
        ...defaultDraft,
        name: 'Бонус на первый заказ',
        rewardType: 'FIXED',
        rewardValue: '100',
        firstOrderOnly: true,
        visibility: 'PUBLIC',
        targetType: 'ORDER_TOTAL',
        code: '',
        notifyOnPublish: true,
        minSubtotal: '',
      })
      setUsePeriod(false)
      setUseLimits(false)
      return
    }
    if (s === 'happy_hours') {
      setCampaignKind('PROMOCODE')
      const { from, to } = defaultHappyRange()
      setDraft({
        ...defaultDraft,
        name: 'Счастливые часы',
        rewardType: 'PERCENT',
        rewardValue: '15',
        rewardCap: '300',
        firstOrderOnly: false,
        visibility: 'PUBLIC',
        targetType: 'ORDER_TOTAL',
        code: randomPromoCode('HAPPY'),
        notifyOnPublish: true,
        minSubtotal: '',
        validFrom: from,
        validTo: to,
      })
      setUsePeriod(true)
      setUseLimits(false)
      return
    }
    setCampaignKind('PROMOCODE')
    setDraft({
      ...defaultDraft,
      name: 'Бонус от суммы чека',
      rewardType: 'PERCENT',
      rewardValue: '10',
      rewardCap: '',
      firstOrderOnly: false,
      visibility: 'PUBLIC',
      targetType: 'ORDER_TOTAL',
      code: randomPromoCode('SUM'),
      notifyOnPublish: false,
      minSubtotal: '900',
      giftDishId: '',
      giftTitle: '',
    })
    setUsePeriod(false)
    setUseLimits(false)
  }

  async function reloadCampaignRowsOnly(): Promise<boolean> {
    try {
      const campaignsRes = await fetch('/api/admin/campaigns', { cache: 'no-store', credentials: 'include' })
      const campaignsData = await campaignsRes.json().catch(() => null)
      if (campaignsRes.ok && campaignsData?.ok && Array.isArray(campaignsData.campaigns)) {
        setRows(campaignsData.campaigns)
        return true
      }
    } catch {
      // ignore — полный load() подтянет при следующем заходе
    }
    return false
  }

  async function load() {
    setLoading(true)
    setGiftSourceState('loading')
    try {
      const [campaignsRes, categoriesRes, dishesRes] = await Promise.all([
        fetch('/api/admin/campaigns', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/menu/categories', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/menu/dishes', { cache: 'no-store', credentials: 'include' }),
      ])
      const campaignsData = await campaignsRes.json().catch(() => null)
      const categoriesData = await categoriesRes.json().catch(() => null)
      const dishesData = await dishesRes.json().catch(() => null)
      if (!campaignsRes.ok || !campaignsData?.ok) {
        toast.error(campaignsData?.error || 'не удалось загрузить акции')
      }
      setRows(Array.isArray(campaignsData?.campaigns) ? campaignsData.campaigns : [])
      if (!campaignsRes.ok || !campaignsData?.ok) setRows([])
      setCategories(Array.isArray(categoriesData?.categories) ? categoriesData.categories : [])
      if (!dishesRes.ok || !Array.isArray(dishesData?.dishes)) {
        setDishes([])
        setGiftSourceState('error')
      } else {
        setDishes(dishesData.dishes)
        setGiftSourceState('ready')
      }
    } catch {
      toast.error('не удалось загрузить акции')
      setGiftSourceState('error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (searchParams.get('crmSeg')) return
    if (guestBootRestored.current) return
    try {
      const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(GUEST_CAMPAIGN_BOOT_KEY) : null
      if (!raw) return
      const o = JSON.parse(raw) as GuestCampaignBootstrap
      if (o.v !== 1 || Date.now() - o.ts > 120000) {
        sessionStorage.removeItem(GUEST_CAMPAIGN_BOOT_KEY)
        return
      }
      guestBootRestored.current = true
      setRewardConfirm(null)
      setShowAdvanced(false)
      setAdvOpen({ mechanic: false, visibility: false, audience: false, period: false, limits: false })
      setScenario(o.scenario)
      setCampaignKind(o.campaignKind)
      setDraft(o.draft)
      setUsePeriod(o.usePeriod)
      setUseLimits(o.useLimits)
    } catch {
      try {
        sessionStorage.removeItem(GUEST_CAMPAIGN_BOOT_KEY)
      } catch {
        // ignore
      }
    }
  }, [searchParams])

  useEffect(() => {
    const raw = searchParams.get('crmSeg')
    if (!raw) return
    const preset = parseGuestCrmSeg(raw)
    if (!preset) return
    const tg = (searchParams.get('crmTg') || '').trim()
    const snap = buildGuestCrmBootstrapSnapshot(preset, tg)

    setRewardConfirm(null)
    setShowAdvanced(false)
    setAdvOpen({ mechanic: false, visibility: false, audience: false, period: false, limits: false })
    setScenario(snap.scenario)
    setCampaignKind(snap.campaignKind)
    setDraft(snap.draft)
    setUsePeriod(snap.usePeriod)
    setUseLimits(snap.useLimits)

    try {
      const payload: GuestCampaignBootstrap = { v: 1, ts: Date.now(), ...snap }
      sessionStorage.setItem(GUEST_CAMPAIGN_BOOT_KEY, JSON.stringify(payload))
    } catch {
      // ignore
    }

    toast.success('черновик акции заполнен по гостю')
    const next = new URLSearchParams(searchParams.toString())
    next.delete('crmSeg')
    next.delete('crmTg')
    next.delete('crmName')
    if (!next.get('section')) next.set('section', 'campaigns')
    router.replace(`/admin/banners?${next.toString()}`, { scroll: false })
  }, [router, searchParams])

  async function createCampaign() {
    if (!scenario) {
      toast.error('Выберите цель акции')
      return
    }
    if (!draft.name.trim()) {
      toast.error('укажите название акции')
      return
    }
    if (draft.rewardType === 'GIFT' && !draft.giftDishId) {
      toast.error('выберите блюдо-подарок из меню')
      return
    }
    if (draft.rewardType === 'GIFT' && !draft.giftTitle.trim() && !selectedGiftDish?.name) {
      toast.error('укажите подарок')
      return
    }
    if (draft.rewardType === 'FIXED' && !(Number(draft.rewardValue) > 0)) {
      toast.error('укажите сумму больше 0')
      return
    }
    if (draft.rewardType === 'PERCENT' && !(Number(draft.rewardValue) > 0)) {
      toast.error('укажите процент скидки')
      return
    }
    if (scenario === 'happy_hours') {
      if (!usePeriod || !draft.validFrom || !draft.validTo) {
        toast.error('укажите период в «расширенных» → период')
        return
      }
      if (!draft.code.trim()) {
        toast.error('нужен промокод')
        return
      }
    }
    if (scenario === 'avg_check') {
      const min = Number(draft.minSubtotal)
      if (!Number.isFinite(min) || min <= 0) {
        toast.error('укажите минимальный чек')
        return
      }
    }
    if (draft.visibility === 'HIDDEN' && !draft.code.trim()) {
      toast.error('для скрытой акции обязателен промокод')
      return
    }
    if (draft.visibility === 'ASSIGNED_ONLY' && !draft.assignedTelegramId.trim()) {
      toast.error('для личной акции нужен Telegram ID')
      return
    }
    setSaving(true)
    setCampaignSaveError(null)
    let createdOk = false
    const campaignFetchTimeoutMs = 45_000
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), campaignFetchTimeoutMs)
    try {
      const metadataJson: Record<string, unknown> = {}
      if (draft.targetType === 'CATEGORY' && draft.categoryId) metadataJson.categoryIds = [draft.categoryId]
      if (draft.rewardType === 'GIFT' && draft.giftDishId) metadataJson.giftDishId = draft.giftDishId

      const validFromIso = usePeriod ? safeIsoFromInput(draft.validFrom) : null
      const validToIso = usePeriod ? safeIsoFromInput(draft.validTo) : null
      if (usePeriod && draft.validFrom?.trim() && !validFromIso) {
        toast.error('некорректная дата начала периода')
        return
      }
      if (usePeriod && draft.validTo?.trim() && !validToIso) {
        toast.error('некорректная дата окончания периода')
        return
      }

      const payload: Record<string, unknown> = {
        name: draft.name.trim(),
        code: draft.code.trim() || null,
        kind: campaignKind,
        targetType: draft.targetType,
        rewardType: draft.rewardType,
        rewardValue: draft.rewardType === 'GIFT' ? 0 : Number(draft.rewardValue || 0),
        rewardCap: draft.rewardType === 'PERCENT' && draft.rewardCap ? Number(draft.rewardCap) : null,
        giftTitle:
          draft.rewardType === 'GIFT' ? draft.giftTitle.trim() || selectedGiftDish?.name || null : null,
        giftPayloadJson:
          draft.rewardType === 'GIFT' && draft.giftDishId
            ? { dishId: draft.giftDishId, dishName: selectedGiftDish?.name || null }
            : null,
        visibility: draft.visibility,
        firstOrderOnly: draft.firstOrderOnly,
        minSubtotal: draft.minSubtotal ? Number(draft.minSubtotal) : null,
        assignedTelegramId: draft.visibility === 'ASSIGNED_ONLY' ? draft.assignedTelegramId.trim() || null : null,
        validFrom: validFromIso,
        validTo: validToIso,
        metadataJson: Object.keys(metadataJson).length ? metadataJson : null,
        notifyOnPublish: draft.notifyOnPublish,
        status: 'ACTIVE',
      }
      if (useLimits && draft.usageLimitTotal.trim()) payload.usageLimitTotal = Number(draft.usageLimitTotal)
      if (useLimits && draft.usageLimitPerUser.trim()) payload.usageLimitPerUser = Number(draft.usageLimitPerUser)

      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      window.clearTimeout(timeoutId)
      const text = await res.text()
      let data: { ok?: boolean; error?: string } | null = null
      try {
        data = text ? (JSON.parse(text) as { ok?: boolean; error?: string }) : null
      } catch {
        // HTML/прокси вместо JSON
      }
      if (!res.ok || !data?.ok) {
        const fallback =
          res.status === 401 || res.status === 403
            ? 'нет доступа — войдите как владелец/админ'
            : 'не удалось создать акцию'
        const errMsg =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error.trim()
            : text && !data?.ok
              ? `${fallback} (${res.status}): ${text.replace(/\s+/g, ' ').slice(0, 220)}`
              : `${fallback} (HTTP ${res.status})`
        setCampaignSaveError(errMsg)
        toast.error(errMsg, { duration: 6000 })
        return
      }
      createdOk = true
      setCampaignSaveError(null)
      toast.success('акция запущена')
      try {
        sessionStorage.removeItem(GUEST_CAMPAIGN_BOOT_KEY)
      } catch {
        // ignore
      }
      setDraft(defaultDraft)
      setScenario(null)
      setCampaignKind('PROMOCODE')
      setGiftQuery('')
      setShowAdvanced(false)
      setUsePeriod(false)
      setUseLimits(false)
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === 'AbortError'
      const errMsg =
        aborted
          ? `нет ответа за ${campaignFetchTimeoutMs / 1000} с — сервер не ответил (проверьте вкладку Network)`
          : e instanceof Error && e.message
            ? e.message
            : 'сеть или ошибка запроса — попробуйте ещё раз'
      setCampaignSaveError(errMsg)
      toast.error(errMsg, { duration: 6000 })
    } finally {
      window.clearTimeout(timeoutId)
      setSaving(false)
    }
    // Сразу обновляем только список акций; полный load() тянет меню и на тяжёлой БД мог блокировать «запускаем…» до таймаута.
    if (createdOk) {
      const ok = await reloadCampaignRowsOnly()
      if (!ok) {
        toast(
          'Акция создана, но список не обновился — потяните страницу вниз или откройте вкладку заново.',
          { duration: 6500, icon: '↻' },
        )
      }
    }
  }

  async function pauseOrActivate(row: CampaignRow) {
    const next = row.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    const res = await fetch('/api/admin/campaigns', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: row.id, status: next }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      toast.error(data?.error || 'ошибка обновления')
      return
    }
    await load()
  }

  async function removeRow(id: string) {
    const res = await fetch(`/api/admin/campaigns?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      toast.error(data?.error || 'не удалось удалить')
      return
    }
    await load()
  }

  function toggleAdv(key: keyof typeof advOpen) {
    setAdvOpen((o) => ({ ...o, [key]: !o[key] }))
  }

  const rewardBlock = (
    <div className="space-y-3">
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">что вы хотите дать?</div>
        <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">один тип награды — при смене сбрасываются несовместимые поля</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/90 p-1">
          {REWARD_OPTIONS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => requestRewardTypeChange(x.id)}
              className={cn(
                'flex flex-col items-center rounded-lg py-2.5 text-center transition active:scale-[0.98]',
                draft.rewardType === x.id
                  ? 'bg-[color:var(--primary)] text-white shadow-[var(--shadow-soft)]'
                  : 'text-[color:var(--text)]',
              )}
            >
              <span className="text-[15px] font-extrabold">{x.sub}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">{x.label}</span>
            </button>
          ))}
        </div>
      </div>
      {draft.rewardType === 'GIFT' ? (
        <>
          <input
            value={giftQuery}
            onChange={(e) => setGiftQuery(e.target.value)}
            placeholder="поиск блюда"
            className="w-full rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2 text-[13px] outline-none focus:border-[color:var(--accent)]"
          />
          <div className="max-h-40 overflow-auto rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-2">
            {giftSourceState === 'loading' ? (
              <div className="p-2 text-[12px] text-[color:var(--muted)]">загружаю меню…</div>
            ) : giftSourceState === 'error' ? (
              <div className="flex items-center justify-between gap-2 p-2 text-[12px]">
                <span className="text-amber-700">не удалось загрузить блюда</span>
                <button type="button" onClick={load} className="rounded-full bg-[color:var(--surface-strong)] px-2 py-1 font-semibold">
                  обновить
                </button>
              </div>
            ) : (
              selectableGiftDishes.slice(0, 45).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDraft((s) => ({ ...s, giftDishId: d.id, giftTitle: d.name }))}
                  className={cn(
                    'mb-1 w-full rounded-lg px-2 py-1.5 text-left text-[13px] last:mb-0',
                    draft.giftDishId === d.id ? 'bg-[color:var(--primary)] text-white' : 'bg-[color:var(--surface-strong)]',
                  )}
                >
                  {d.name}
                </button>
              ))
            )}
          </div>
        </>
      ) : draft.rewardType === 'PERCENT' ? (
        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">процент</span>
            <input
              type="number"
              min={1}
              max={100}
              inputMode="numeric"
              value={draft.rewardValue}
              onChange={(e) => setDraft((d) => ({ ...d, rewardValue: e.target.value }))}
              className="w-full rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2.5 text-[16px] font-semibold outline-none focus:border-[color:var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">потолок скидки, ฿ (необязательно)</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={draft.rewardCap}
              onChange={(e) => setDraft((d) => ({ ...d, rewardCap: e.target.value }))}
              className="w-full rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2 text-[14px] outline-none focus:border-[color:var(--accent)]"
            />
          </label>
        </div>
      ) : (
        <label className="block">
          <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">сумма, ฿</span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={draft.rewardValue}
            onChange={(e) => setDraft((d) => ({ ...d, rewardValue: e.target.value }))}
            className="w-full rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2.5 text-[16px] font-semibold outline-none focus:border-[color:var(--accent)]"
          />
          {scenario === 'new_users' ? (
            <span className="mt-1 block text-[11px] text-[color:var(--muted)]">рекомендуем 50–150 ฿</span>
          ) : null}
        </label>
      )}
    </div>
  )

  return (
    <section className={cn(cardClass, 'relative mt-5 overflow-hidden')}>
      {rewardConfirm ? (
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            className="w-full max-w-[360px] rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-4 shadow-[var(--shadow-card)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reward-change-title"
          >
            <p id="reward-change-title" className="text-[16px] font-extrabold text-[color:var(--text)]">
              Сменить тип награды?
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--muted)]">
              Предыдущие значения для текущего типа будут сброшены и заменены на дефолты нового типа.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="btn btn-soft h-11 flex-1 rounded-full text-[14px] font-semibold"
                style={{ borderRadius: 'var(--radius-pill)' }}
                onClick={() => setRewardConfirm(null)}
              >
                отмена
              </button>
              <button
                type="button"
                className="btn btn-primary h-11 flex-1 rounded-full text-[14px] font-extrabold"
                style={{ borderRadius: 'var(--radius-pill)' }}
                onClick={() => rewardConfirm && applyRewardType(rewardConfirm)}
              >
                продолжить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-b border-[color:var(--stroke)] bg-[color:var(--surface)]/60 px-4 py-4 backdrop-blur-md">
        <h3 className="text-[22px] font-extrabold tracking-tight text-[color:var(--text)]">Создать акцию</h3>
        <p className="mt-1 text-[13px] font-medium leading-snug text-[color:var(--muted)]">
          Сценарий → тип награды (один) → детали. Расширенные настройки — по секциям, без дублирования.
        </p>
      </div>

      <div className="space-y-4 p-4 pb-28">
        <div className="flex gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SCENARIOS.map((s) => {
            const active = scenario === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => applyScenario(s.id)}
                className={cn(
                  'flex min-h-[118px] w-[min(34vw,124px)] shrink-0 flex-col items-start gap-1.5 rounded-[var(--radius-large)] border p-3 text-left transition',
                  'bg-[color:var(--surface)]/90 backdrop-blur-sm active:scale-[0.98]',
                  active
                    ? 'border-[color:var(--accent)] shadow-[var(--shadow-card)] ring-1 ring-[color:var(--accent)]/35'
                    : 'border-[color:var(--stroke)] hover:border-[color:var(--stroke-strong)]',
                )}
              >
                <span className="text-2xl leading-none" aria-hidden>
                  {s.emoji}
                </span>
                <span className="text-[13px] font-extrabold leading-tight text-[color:var(--text)]">{s.title}</span>
                <span className="text-[11px] font-medium leading-snug text-[color:var(--muted)]">{s.hint}</span>
              </button>
            )
          })}
        </div>

        {scenario ? (
          <>
            <div className="rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface)]/80 p-4 backdrop-blur-md">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">выбрано</div>
                  <div className="mt-0.5 text-[15px] font-extrabold text-[color:var(--text)]">
                    {SCENARIOS.find((x) => x.id === scenario)?.title}
                  </div>
                </div>
                <span className="text-2xl">{SCENARIOS.find((x) => x.id === scenario)?.emoji}</span>
              </div>

              {rewardBlock}

              {scenario === 'avg_check' ? (
                <label className="mt-4 block">
                  <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
                    минимальный чек, ฿
                  </span>
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={draft.minSubtotal}
                    onChange={(e) => setDraft((d) => ({ ...d, minSubtotal: e.target.value }))}
                    className="w-full rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2.5 text-[16px] font-semibold outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
              ) : null}

              {scenario === 'happy_hours' ? (
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">промокод</span>
                    <input
                      value={draft.code}
                      onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
                      className="w-full rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2 text-[14px] font-semibold uppercase outline-none focus:border-[color:var(--accent)]"
                    />
                  </label>
                  <p className="text-[11px] leading-snug text-[color:var(--muted)]">
                    Окно времени задаётся в расширенных → <span className="font-semibold text-[color:var(--text)]">период</span>
                  </p>
                  <div className="flex items-center justify-between gap-3 rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/90 px-3 py-2.5">
                    <div className="text-[13px] font-semibold text-[color:var(--text)]">уведомить при запуске</div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.notifyOnPublish}
                      onClick={() => setDraft((d) => ({ ...d, notifyOnPublish: !d.notifyOnPublish }))}
                      className={cn(
                        'relative h-7 w-12 shrink-0 rounded-full transition',
                        draft.notifyOnPublish ? 'bg-[color:var(--accent)]' : 'bg-[color:var(--stroke)]',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition',
                          draft.notifyOnPublish ? 'left-5' : 'left-0.5',
                        )}
                      />
                    </button>
                  </div>
                </div>
              ) : null}

              {scenario === 'new_users' ? (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/90 px-3 py-2.5">
                  <div>
                    <div className="text-[13px] font-semibold text-[color:var(--text)]">уведомить гостей в Telegram</div>
                    <div className="text-[11px] text-[color:var(--muted)]">только публичные акции с флажком</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draft.notifyOnPublish}
                    onClick={() => setDraft((d) => ({ ...d, notifyOnPublish: !d.notifyOnPublish }))}
                    className={cn(
                      'relative h-7 w-12 shrink-0 rounded-full transition',
                      draft.notifyOnPublish ? 'bg-[color:var(--accent)]' : 'bg-[color:var(--stroke)]',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition',
                        draft.notifyOnPublish ? 'left-5' : 'left-0.5',
                      )}
                    />
                  </button>
                </div>
              ) : null}

              {scenario === 'avg_check' ? (
                <label className="mt-4 block">
                  <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">промокод</span>
                  <input
                    value={draft.code}
                    onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
                    className="w-full rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2 text-[14px] font-semibold uppercase outline-none focus:border-[color:var(--accent)]"
                  />
                </label>
              ) : null}
            </div>

            <div className="rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/90 p-4">
              <div className="text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">как это сработает</div>
              <p className="mt-2 text-[14px] font-semibold leading-relaxed text-[color:var(--text)]">{humanSummary}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {!firstOrderLocked && draft.firstOrderOnly ? (
                  <span className="rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                    первый заказ
                  </span>
                ) : null}
                {firstOrderLocked ? (
                  <span className="rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                    сценарий: новые гости
                  </span>
                ) : null}
                <span className="rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                  {campaignKind === 'AUTO' ? 'авто в чекауте' : 'промокод / правила'}
                </span>
              </div>
            </div>
          </>
        ) : null}

        {scenario ? (
          <label className="block rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface)]/90 p-3">
            <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
              название акции
            </span>
            <input
              value={draft.name}
              onChange={(e) => setDraft((s) => ({ ...s, name: e.target.value }))}
              placeholder="как увидят владельцы и гости"
              className="w-full rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2 text-[14px] font-semibold outline-none focus:border-[color:var(--accent)]"
            />
          </label>
        ) : null}

        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="flex w-full items-center justify-between rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2.5 text-left text-[13px] font-semibold text-[color:var(--text)] transition active:opacity-90"
        >
          <span>расширенные настройки</span>
          <span className="text-[color:var(--muted)]">{showAdvanced ? '▲' : '▼'}</span>
        </button>

        {showAdvanced && scenario ? (
          <div className="space-y-2 rounded-[var(--radius-large)] border border-[color:var(--stroke)] bg-[color:var(--surface)]/90 p-3">
            <button
              type="button"
              onClick={() => toggleAdv('mechanic')}
              className="flex w-full items-center justify-between rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2.5 text-left"
            >
              <span className="text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">механика</span>
              <span className="text-[11px] text-[color:var(--muted)]">{advOpen.mechanic ? '▲' : '▼'}</span>
            </button>
            <p className="-mt-1 px-1 text-[11px] leading-snug text-[color:var(--muted)]">{advSummaryMechanic}</p>
            {advOpen.mechanic ? (
              <div className="space-y-2 rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/80 p-3">
                <select
                  value={draft.targetType}
                  onChange={(e) => setDraft((s) => ({ ...s, targetType: e.target.value }))}
                  className="w-full rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2 text-[13px] outline-none"
                >
                  <option value="ORDER_TOTAL">весь чек</option>
                  <option value="DELIVERY_FEE">доставка</option>
                  <option value="CATEGORY">категория</option>
                </select>
                {draft.targetType === 'CATEGORY' ? (
                  <select
                    value={draft.categoryId}
                    onChange={(e) => setDraft((s) => ({ ...s, categoryId: e.target.value }))}
                    className="w-full rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2 text-[13px] outline-none"
                  >
                    <option value="">категория</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => toggleAdv('visibility')}
              className="flex w-full items-center justify-between rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2.5 text-left"
            >
              <span className="text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">видимость</span>
              <span className="text-[11px] text-[color:var(--muted)]">{advOpen.visibility ? '▲' : '▼'}</span>
            </button>
            <p className="-mt-1 px-1 text-[11px] leading-snug text-[color:var(--muted)]">{advSummaryVisibility}</p>
            {advOpen.visibility ? (
              <div className="space-y-2 rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/80 p-3">
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-[color:var(--surface)] p-1">
                  {[
                    { id: 'PUBLIC', label: 'публичная' },
                    { id: 'HIDDEN', label: 'скрытая' },
                    { id: 'ASSIGNED_ONLY', label: 'личная' },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setDraft((s) => ({ ...s, visibility: v.id }))}
                      className={cn(
                        'rounded-md py-2 text-[11px] font-semibold',
                        draft.visibility === v.id ? 'bg-[color:var(--primary)] text-white' : 'text-[color:var(--muted)]',
                      )}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <input
                  value={draft.code}
                  onChange={(e) => setDraft((s) => ({ ...s, code: e.target.value.toUpperCase() }))}
                  placeholder="промокод"
                  className="w-full rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2 text-[13px] font-semibold uppercase outline-none"
                />
                {draft.visibility === 'ASSIGNED_ONLY' ? (
                  <input
                    value={draft.assignedTelegramId}
                    onChange={(e) => setDraft((s) => ({ ...s, assignedTelegramId: e.target.value }))}
                    placeholder="Telegram ID гостя"
                    className="w-full rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2 text-[13px] outline-none"
                  />
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => toggleAdv('audience')}
              className="flex w-full items-center justify-between rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2.5 text-left"
            >
              <span className="text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">аудитория</span>
              <span className="text-[11px] text-[color:var(--muted)]">{advOpen.audience ? '▲' : '▼'}</span>
            </button>
            <p className="-mt-1 px-1 text-[11px] leading-snug text-[color:var(--muted)]">{advSummaryAudience}</p>
            {advOpen.audience ? (
              <div className="rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/80 p-3">
                {firstOrderLocked ? (
                  <p className="text-[12px] leading-snug text-[color:var(--muted)]">
                    Первый заказ уже заложен в сценарий «Привлечь новых» — переключатель скрыт, чтобы не было двусмысленности.
                  </p>
                ) : (
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium text-[color:var(--text)]">только первый заказ</span>
                    <input
                      type="checkbox"
                      checked={draft.firstOrderOnly}
                      onChange={(e) => setDraft((s) => ({ ...s, firstOrderOnly: e.target.checked }))}
                      className="h-5 w-5"
                    />
                  </label>
                )}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => toggleAdv('period')}
              className="flex w-full items-center justify-between rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2.5 text-left"
            >
              <span className="text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">период</span>
              <span className="text-[11px] text-[color:var(--muted)]">{advOpen.period ? '▲' : '▼'}</span>
            </button>
            <p className="-mt-1 px-1 text-[11px] leading-snug text-[color:var(--muted)]">{advSummaryPeriod}</p>
            {advOpen.period ? (
              <div className="space-y-2 rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/80 p-3">
                <label className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-[color:var(--text)]">ограничить датами</span>
                  <input type="checkbox" checked={usePeriod} onChange={(e) => setUsePeriod(e.target.checked)} className="h-5 w-5" />
                </label>
                {usePeriod ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="datetime-local"
                      value={draft.validFrom}
                      onChange={(e) => setDraft((s) => ({ ...s, validFrom: e.target.value }))}
                      className="w-full rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-2 py-2 text-[12px] outline-none"
                    />
                    <input
                      type="datetime-local"
                      value={draft.validTo}
                      onChange={(e) => setDraft((s) => ({ ...s, validTo: e.target.value }))}
                      className="w-full rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-2 py-2 text-[12px] outline-none"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => toggleAdv('limits')}
              className="flex w-full items-center justify-between rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2.5 text-left"
            >
              <span className="text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">ограничения</span>
              <span className="text-[11px] text-[color:var(--muted)]">{advOpen.limits ? '▲' : '▼'}</span>
            </button>
            <p className="-mt-1 px-1 text-[11px] leading-snug text-[color:var(--muted)]">{advSummaryLimits}</p>
            {advOpen.limits ? (
              <div className="space-y-3 rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)]/80 p-3">
                {scenario !== 'avg_check' ? (
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-[color:var(--muted)]">мин. чек, ฿</span>
                    <input
                      type="number"
                      min={0}
                      value={draft.minSubtotal}
                      onChange={(e) => setDraft((s) => ({ ...s, minSubtotal: e.target.value }))}
                      className="w-full rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] px-3 py-2 text-[14px] outline-none"
                    />
                  </label>
                ) : null}
                <label className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-[color:var(--text)]">лимиты активаций</span>
                  <input type="checkbox" checked={useLimits} onChange={(e) => setUseLimits(e.target.checked)} className="h-5 w-5" />
                </label>
                {useLimits ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold text-[color:var(--muted)]">всего</span>
                      <input
                        type="number"
                        min={0}
                        value={draft.usageLimitTotal}
                        onChange={(e) => setDraft((s) => ({ ...s, usageLimitTotal: e.target.value }))}
                        className="w-full rounded-md border border-[color:var(--stroke)] bg-[color:var(--surface)] px-2 py-1.5 text-[13px] outline-none"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold text-[color:var(--muted)]">на клиента</span>
                      <input
                        type="number"
                        min={1}
                        value={draft.usageLimitPerUser}
                        onChange={(e) => setDraft((s) => ({ ...s, usageLimitPerUser: e.target.value }))}
                        className="w-full rounded-md border border-[color:var(--stroke)] bg-[color:var(--surface)] px-2 py-1.5 text-[13px] outline-none"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            ) : null}

            <label className="flex items-center justify-between gap-3 rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-2.5">
              <span className="text-[12px] font-medium text-[color:var(--text)]">уведомление при публикации</span>
              <input
                type="checkbox"
                checked={draft.notifyOnPublish}
                onChange={(e) => setDraft((s) => ({ ...s, notifyOnPublish: e.target.checked }))}
                className="h-5 w-5"
              />
            </label>

            <button
              type="button"
              onClick={() => setShowCalc((s) => !s)}
              className="w-full rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] py-2 text-[12px] font-semibold"
            >
              {showCalc ? 'скрыть калькулятор' : 'калькулятор окупаемости'}
            </button>
            {showCalc ? (
              <div className="rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] p-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <input
                    value={calcAvgCheck}
                    onChange={(e) => setCalcAvgCheck(e.target.value)}
                    className="rounded-md border border-[color:var(--stroke)] px-2 py-1.5 text-[12px] outline-none"
                  />
                  <input
                    value={calcMarginPct}
                    onChange={(e) => setCalcMarginPct(e.target.value)}
                    className="rounded-md border border-[color:var(--stroke)] px-2 py-1.5 text-[12px] outline-none"
                  />
                  <input
                    value={calcActivations}
                    onChange={(e) => setCalcActivations(e.target.value)}
                    className="rounded-md border border-[color:var(--stroke)] px-2 py-1.5 text-[12px] outline-none"
                  />
                </div>
                <div className="mt-2 text-[11px] text-[color:var(--muted)]">
                  выручка {Math.round(grossRevenue)} ฿ · скидки {Math.round(campaignCost)} ฿ · прибыль {Math.round(grossProfitAfter)} ฿
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {scenario ? (
          <div className="sticky bottom-0 z-20 -mx-4 border-t border-[color:var(--stroke)] bg-[color:var(--bottom-bg)]/98 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
            {campaignSaveError ? (
              <div className="mb-3 rounded-[var(--radius-medium)] border border-red-200/90 bg-red-50/95 px-3 py-2 text-[12px] font-medium leading-snug text-red-900">
                <div className="font-extrabold">не сохранилось</div>
                <div className="mt-1">{campaignSaveError}</div>
                <button
                  type="button"
                  className="mt-2 text-[11px] font-bold uppercase tracking-wide text-red-800 underline"
                  onClick={() => setCampaignSaveError(null)}
                >
                  скрыть
                </button>
              </div>
            ) : null}
            <button
              type="button"
              onClick={createCampaign}
              disabled={saving}
              className="btn btn-primary flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-extrabold shadow-[var(--shadow-card)] transition disabled:opacity-45"
              style={{ borderRadius: 'var(--radius-pill)' }}
            >
              {saving ? 'запускаем…' : '🚀 Запустить акцию'}
            </button>
            <p className="mt-2 text-center text-[11px] font-medium text-[color:var(--muted)]">
              Акция станет активной сразу после сохранения. Расширенные настройки не обязательны.
            </p>
          </div>
        ) : (
          <p className="rounded-[var(--radius-medium)] border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-center text-[12px] font-medium text-amber-900">
            Сначала выберите цель акции выше (карточка сценария).
          </p>
        )}
      </div>

      <div className="border-t border-[color:var(--stroke)] px-4 py-4">
        <h4 className="text-[12px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">активные и прошлые</h4>
        <div className="mt-3 space-y-2">
          {loading ? <div className="text-sm text-[color:var(--muted)]">загрузка...</div> : null}
          {!loading && rows.length === 0 ? <div className="text-sm text-[color:var(--muted)]">акций пока нет</div> : null}
          {rows.map((row) => (
            <div key={row.id} className="rounded-[var(--radius-medium)] border border-[color:var(--stroke)] bg-[color:var(--surface)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[color:var(--text)]">{row.name}</div>
                  <div className="text-xs text-[color:var(--muted)]">
                    {row.code ? `код ${row.code} · ` : ''}
                    {row.kind === 'AUTO' ? 'авто · ' : ''}
                    {row.rewardType} · {row.targetType} · {Number(row._count?.redemptions ?? 0)} раз
                  </div>
                  {row.giftTitle ? <div className="text-xs text-emerald-700">подарок: {row.giftTitle}</div> : null}
                  {row.minSubtotal ? <div className="text-xs text-[color:var(--muted)]">мин. чек: {Number(row.minSubtotal)} ฿</div> : null}
                </div>
                <div className="text-xs font-semibold text-[color:var(--muted)]">{row.status}</div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => pauseOrActivate(row)}
                  className="rounded-full border border-[color:var(--stroke)] bg-[color:var(--surface-strong)] px-3 py-1 text-xs font-semibold"
                >
                  {row.status === 'ACTIVE' ? 'пауза' : 'активировать'}
                </button>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="rounded-full border border-red-200/80 bg-red-50/90 px-3 py-1 text-xs font-semibold text-red-700"
                >
                  удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
