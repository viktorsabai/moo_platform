export type BannerPlacement = 'home' | 'subscriptions'

export function parseBannerPlacement(raw: string | null): BannerPlacement {
  return raw === 'subscriptions' ? 'subscriptions' : 'home'
}

export function bannerPlacementWhere(placement: BannerPlacement) {
  return placement === 'subscriptions' ? { showOnSubscriptions: true } : { showOnHome: true }
}
