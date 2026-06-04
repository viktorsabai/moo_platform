import { PHUKET_DISTRICTS_GEOJSON } from '@/lib/phuket-districts'

export type DeliveryZoneRow = {
  id: string
  name: string
  polygonJson?: string | null
  keywords?: string[] | null
  zipCodes?: string[] | null
  deliveryFee: number
  minOrderAmount: number
  deliveryWindowMin: number
  isActive: boolean
  sortOrder: number
}

export const DISTRICT_NOTE_PREFIX = 'note:'

export const DISTRICTS = PHUKET_DISTRICTS_GEOJSON.features.map((f) => ({
  id: String(f.id),
  name: String(f.properties.name),
}))

export const DISTRICT_GEOMETRY_BY_ID: Record<
  string,
  { type: 'Polygon'; coordinates: readonly (readonly (readonly [number, number])[])[] }
> = Object.fromEntries(
  PHUKET_DISTRICTS_GEOJSON.features.map((f) => [
    String(f.id),
    f.geometry as { type: 'Polygon'; coordinates: readonly (readonly (readonly [number, number])[])[] },
  ])
)

export function getZoneDistrictId(zone: DeliveryZoneRow): string | null {
  if (Array.isArray(zone.keywords)) {
    const districtKeyword = zone.keywords.find((k) => String(k).startsWith('district:'))
    if (districtKeyword) return String(districtKeyword).replace('district:', '')
  }
  const byName = DISTRICTS.find((d) => String(d.name).toLowerCase() === String(zone.name || '').toLowerCase())
  return byName?.id || null
}

export function getZoneNote(keywords: string[] | null | undefined): string {
  if (!Array.isArray(keywords)) return ''
  const row = keywords.find((k) => String(k).startsWith(DISTRICT_NOTE_PREFIX))
  return row ? String(row).slice(DISTRICT_NOTE_PREFIX.length) : ''
}

export function mergeZoneNote(keywords: string[] | null | undefined, note: string): string[] {
  const base = (Array.isArray(keywords) ? keywords : []).filter((k) => !String(k).startsWith(DISTRICT_NOTE_PREFIX))
  const trimmed = String(note || '').trim()
  if (trimmed) base.push(`${DISTRICT_NOTE_PREFIX}${trimmed}`)
  return base
}

export function districtKeywords(districtId: string, districtName: string, note?: string): string[] {
  return mergeZoneNote([districtName, districtId, `district:${districtId}`], note || '')
}

export function isPersistedZoneId(id: string): boolean {
  return Boolean(id) && !String(id).startsWith('draft_') && !String(id).startsWith('virtual_')
}
