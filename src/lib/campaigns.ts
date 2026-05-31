import type {
  Campaign,
  CampaignRewardType,
  CampaignTargetType,
  CampaignVisibility,
} from '@prisma/client'

export type PricingLineItem = {
  kind?: string
  quantity: number
  unitPrice: number
  dishId?: string | null
  storeVariantId?: string | null
  categoryId?: string | null
}

export type CampaignEvaluationContext = {
  userId: string
  userTelegramId?: string | null
  code?: string | null
  subtotal: number
  deliveryFee: number
  items: PricingLineItem[]
  userOrdersCount: number
  userUsedCountByCampaignId?: Record<string, number>
  now?: Date
  /** «Мои промокоды» / список до известной суммы корзины — не отсекать по minSubtotal и пустой корзине для CATEGORY/ITEM */
  promoListing?: boolean
}

export type AppliedCampaignResult = {
  ok: boolean
  reason?: string
  campaign?: Campaign
  campaignCode?: string | null
  discountAmount: number
  finalSubtotal: number
  finalDeliveryFee: number
  finalTotal: number
  gift?: {
    title: string
    payload?: unknown
  } | null
  details: {
    targetType?: CampaignTargetType
    rewardType?: CampaignRewardType
    rewardValue?: number
    rewardCap?: number | null
    appliedToAmount?: number
  }
}

function asNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

function normalizeCode(code: string | null | undefined): string {
  return String(code || '').trim().toUpperCase()
}

function campaignCodeNormalized(c: Campaign): string {
  return normalizeCode(c.code)
}

function isCampaignInDateRange(c: Campaign, now: Date): boolean {
  if (c.validFrom && now < c.validFrom) return false
  if (c.validTo && now > c.validTo) return false
  return true
}

function campaignVisibleForUser(
  c: Campaign,
  userId: string,
  userTelegramId: string
): boolean {
  const vis = c.visibility as CampaignVisibility
  if (vis === 'ASSIGNED_ONLY') {
    const byUser = c.assignedUserId && c.assignedUserId === userId
    const byTg = c.assignedTelegramId && c.assignedTelegramId === userTelegramId
    return Boolean(byUser || byTg)
  }
  return true
}

function readMetadataArray(c: Campaign, key: string): string[] {
  const root = (c.metadataJson || {}) as Record<string, unknown>
  const list = root[key]
  if (!Array.isArray(list)) return []
  return list.map((x) => String(x || '').trim()).filter(Boolean)
}

function computeTargetAmount(c: Campaign, ctx: CampaignEvaluationContext): number {
  const target = c.targetType as CampaignTargetType
  if (target === 'DELIVERY_FEE') return Math.max(0, ctx.deliveryFee)
  if (target === 'ORDER_TOTAL') return Math.max(0, ctx.subtotal)
  if (target === 'CATEGORY') {
    const categoryIds = new Set(readMetadataArray(c, 'categoryIds'))
    if (!categoryIds.size) return 0
    return round2(
      ctx.items.reduce((sum, it) => {
        const cat = String(it.categoryId || '').trim()
        if (!cat || !categoryIds.has(cat)) return sum
        return sum + Math.max(0, asNumber(it.quantity) * asNumber(it.unitPrice))
      }, 0)
    )
  }
  if (target === 'ITEM') {
    const dishIds = new Set(readMetadataArray(c, 'dishIds'))
    const variantIds = new Set(readMetadataArray(c, 'storeVariantIds'))
    return round2(
      ctx.items.reduce((sum, it) => {
        const dish = String(it.dishId || '').trim()
        const variant = String(it.storeVariantId || '').trim()
        if (!dishIds.has(dish) && !variantIds.has(variant)) return sum
        return sum + Math.max(0, asNumber(it.quantity) * asNumber(it.unitPrice))
      }, 0)
    )
  }
  return Math.max(0, ctx.subtotal)
}

function computeDiscount(baseAmount: number, c: Campaign): number {
  const reward = c.rewardType as CampaignRewardType
  const value = Math.max(0, asNumber(c.rewardValue))
  const cap = c.rewardCap != null ? Math.max(0, asNumber(c.rewardCap)) : null
  if (reward === 'FIXED') {
    return round2(Math.min(baseAmount, value))
  }
  if (reward === 'PERCENT') {
    const raw = baseAmount * (value / 100)
    const clipped = cap != null ? Math.min(raw, cap) : raw
    return round2(Math.min(baseAmount, clipped))
  }
  return 0
}

function validateCampaign(
  c: Campaign,
  ctx: CampaignEvaluationContext
): { ok: true } | { ok: false; reason: string } {
  const now = ctx.now || new Date()
  const st = String(c.status || '').toUpperCase()
  if (st !== 'ACTIVE') return { ok: false, reason: 'inactive' }
  if (!isCampaignInDateRange(c, now)) return { ok: false, reason: 'expired_or_not_started' }

  const tg = String(ctx.userTelegramId || '').trim()
  if (!campaignVisibleForUser(c, ctx.userId, tg)) {
    return { ok: false, reason: 'not_assigned' }
  }

  if (c.firstOrderOnly && ctx.userOrdersCount > 0) {
    return { ok: false, reason: 'first_order_only' }
  }
  const minSubtotal = c.minSubtotal != null ? asNumber(c.minSubtotal) : 0
  if (!ctx.promoListing && minSubtotal > 0 && ctx.subtotal < minSubtotal) {
    return { ok: false, reason: 'min_subtotal_not_reached' }
  }
  if (c.usageLimitPerUser != null) {
    const used = Number(ctx.userUsedCountByCampaignId?.[c.id] || 0)
    if (used >= c.usageLimitPerUser) {
      return { ok: false, reason: 'per_user_limit_reached' }
    }
  }
  return { ok: true }
}

export function evaluateCampaign(
  campaign: Campaign,
  ctx: CampaignEvaluationContext
): AppliedCampaignResult {
  const baseResult: AppliedCampaignResult = {
    ok: false,
    discountAmount: 0,
    finalSubtotal: round2(Math.max(0, ctx.subtotal)),
    finalDeliveryFee: round2(Math.max(0, ctx.deliveryFee)),
    finalTotal: round2(Math.max(0, ctx.subtotal + ctx.deliveryFee)),
    details: {},
  }

  const validation = validateCampaign(campaign, ctx)
  if (!validation.ok) return { ...baseResult, reason: validation.reason }

  let appliedToAmount = computeTargetAmount(campaign, ctx)
  if (appliedToAmount <= 0 && campaign.rewardType !== 'GIFT') {
    if (!ctx.promoListing) {
      return { ...baseResult, reason: 'target_amount_zero' }
    }
    // В списке промокодов корзина ещё не передана — показываем акцию с нулевой предварительной скидкой
    appliedToAmount = 0
  }

  const discount = computeDiscount(appliedToAmount, campaign)
  const target = campaign.targetType as CampaignTargetType
  const reward = campaign.rewardType as CampaignRewardType

  let finalSubtotal = round2(Math.max(0, ctx.subtotal))
  let finalDeliveryFee = round2(Math.max(0, ctx.deliveryFee))
  if (target === 'DELIVERY_FEE') {
    finalDeliveryFee = round2(Math.max(0, finalDeliveryFee - discount))
  } else {
    finalSubtotal = round2(Math.max(0, finalSubtotal - discount))
  }

  const giftTitle =
    reward === 'GIFT'
      ? String(campaign.giftTitle || campaign.name || 'Подарок').trim()
      : ''

  return {
    ok: true,
    campaign,
    campaignCode: campaign.code,
    discountAmount: round2(discount),
    finalSubtotal,
    finalDeliveryFee,
    finalTotal: round2(finalSubtotal + finalDeliveryFee),
    gift:
      reward === 'GIFT'
        ? {
            title: giftTitle || 'Подарок',
            payload: campaign.giftPayloadJson || null,
          }
        : null,
    details: {
      targetType: target,
      rewardType: reward,
      rewardValue: asNumber(campaign.rewardValue),
      rewardCap: campaign.rewardCap != null ? asNumber(campaign.rewardCap) : null,
      appliedToAmount,
    },
  }
}

/** dishId из giftPayloadJson (админка кладёт { dishId, dishName }). */
export function giftDishIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const id = String((payload as { dishId?: unknown }).dishId || '').trim()
  return id || null
}

export function pickBestCampaign(
  campaigns: Campaign[],
  ctx: CampaignEvaluationContext
): AppliedCampaignResult {
  const normalizedCode = normalizeCode(ctx.code)
  let candidates = campaigns
  if (normalizedCode) {
    candidates = campaigns.filter((c) => campaignCodeNormalized(c) === normalizedCode)
  } else {
    // Без кода не смешиваем PROMO без кода с AUTO — иначе pickBest выбирает «лучшую скидку» между чужими акциями.
    candidates = campaigns.filter((c) => String(c.kind || '').toUpperCase() === 'AUTO')
  }
  if (!candidates.length) {
    return {
      ok: false,
      reason: normalizedCode ? 'code_not_found' : 'no_campaigns',
      discountAmount: 0,
      finalSubtotal: round2(Math.max(0, ctx.subtotal)),
      finalDeliveryFee: round2(Math.max(0, ctx.deliveryFee)),
      finalTotal: round2(Math.max(0, ctx.subtotal + ctx.deliveryFee)),
      details: {},
    }
  }
  const scored = candidates.map((c) => evaluateCampaign(c, ctx))
  const valid = scored.filter((x) => x.ok)
  if (!valid.length) {
    return scored[0]
  }
  valid.sort((a, b) => b.discountAmount - a.discountAmount)
  return valid[0]
}

export function parseCampaignCode(input: unknown): string {
  return normalizeCode(String(input || ''))
}
