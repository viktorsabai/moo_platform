export type DeliveryProfile = {
  name: string
  address: string
  apartment: string
  city: string
  zipCode: string
  lat?: string
  lng?: string
}

const KEY = 'ufo_delivery_profile_v1'

export function loadDeliveryProfile(): DeliveryProfile | null {
  try {
    const raw = globalThis?.localStorage?.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    const profile: DeliveryProfile = {
      name: String(v?.name ?? ''),
      address: String(v?.address ?? ''),
      apartment: String(v?.apartment ?? ''),
      city: String(v?.city ?? 'Пхукет'),
      zipCode: String(v?.zipCode ?? ''),
      lat: String(v?.lat ?? ''),
      lng: String(v?.lng ?? ''),
    }
    if (!profile.name && !profile.address) return null
    return profile
  } catch {
    return null
  }
}

export function saveDeliveryProfile(profile: DeliveryProfile) {
  try {
    globalThis?.localStorage?.setItem(KEY, JSON.stringify(profile))
  } catch {
    // ignore (quota / denied in some webviews)
  }
}
