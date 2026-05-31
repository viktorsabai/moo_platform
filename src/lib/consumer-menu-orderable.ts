/** Теги: онлайн-заказ с меню запрещён (позиция на витрине). */
const TAGS_BLOCKING_ORDER = new Set(['no-order', 'no-delivery', 'not-delivery'])

type DishLike = {
  isAvailable: boolean
  price: number
  tags?: string[] | null
}

function dishTagSet(tags: string[] | null | undefined) {
  return new Set((tags ?? []).map((t) => String(t || '').toLowerCase().trim()).filter(Boolean))
}

export function isDishOrderableForCart(dish: DishLike): boolean {
  if (!dish.isAvailable) return false
  const p = Number(dish.price ?? 0)
  if (!Number.isFinite(p) || p <= 0) return false
  const tags = dishTagSet(dish.tags)
  for (const b of TAGS_BLOCKING_ORDER) {
    if (tags.has(b)) return false
  }
  return true
}

/** Короткая подпись под карточкой, когда в корзину нельзя (но карточку показываем). */
export function dishMenuOrderHint(dish: DishLike): string | null {
  if (!dish.isAvailable) return 'на стопе'
  const p = Number(dish.price ?? 0)
  if (!Number.isFinite(p) || p <= 0) return 'цена по запросу'
  const tags = dishTagSet(dish.tags)
  if (tags.has('no-order')) return 'временно не заказать онлайн'
  if (tags.has('no-delivery') || tags.has('not-delivery')) return 'не в доставку'
  return null
}

/** Не показываем в углу как «чип» маркетинга — служебные ярлыки. */
export function isDishMenuMetaTag(tag: string): boolean {
  return TAGS_BLOCKING_ORDER.has(String(tag || '').toLowerCase().trim())
}

type StoreVariantLike = { price?: number; qty?: number; isActive?: boolean }
type StoreProductLike = {
  variants?: StoreVariantLike[] | null
  tags?: string[] | null
}

export function isStoreProductOrderable(p: StoreProductLike): boolean {
  const tags = dishTagSet(p.tags)
  for (const b of TAGS_BLOCKING_ORDER) {
    if (tags.has(b)) return false
  }
  const v = p.variants?.[0]
  if (!v || v.isActive === false) return false
  const price = Number(v.price ?? 0)
  if (!Number.isFinite(price) || price <= 0) return false
  if (Number(v.qty ?? 0) <= 0) return false
  return true
}

/** Конкретный вариант магазина (корзина / апсейл): те же правила, что и на витрине. */
export function isStoreVariantOrderableForCart(p: StoreProductLike, variant: StoreVariantLike): boolean {
  const tags = dishTagSet(p.tags)
  for (const b of TAGS_BLOCKING_ORDER) {
    if (tags.has(b)) return false
  }
  if (!variant || variant.isActive === false) return false
  const price = Number(variant.price ?? 0)
  if (!Number.isFinite(price) || price <= 0) return false
  if (Number(variant.qty ?? 0) <= 0) return false
  return true
}

export function storeMenuOrderHint(p: StoreProductLike): string | null {
  const tags = dishTagSet(p.tags)
  if (tags.has('no-order')) return 'временно не заказать онлайн'
  if (tags.has('no-delivery') || tags.has('not-delivery')) return 'не в доставку'
  const v = p.variants?.[0]
  if (!v || v.isActive === false) return 'нет варианта'
  const price = Number(v.price ?? 0)
  if (!Number.isFinite(price) || price <= 0) return 'цена по запросу'
  if (Number(v.qty ?? 0) <= 0) return 'нет в наличии'
  return null
}
