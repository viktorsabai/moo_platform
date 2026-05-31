import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function toText(v: unknown): string {
  return String(v ?? '').trim()
}

function fromDisplayName(displayName: string): string {
  const chunks = displayName
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  return chunks.slice(0, 2).join(', ')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = Number(searchParams.get('lat') || NaN)
  const lng = Number(searchParams.get('lng') || NaN)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, error: 'invalid_coords' }, { status: 400 })
  }

  try {
    const qs = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lng),
      addressdetails: '1',
      zoom: '18',
    })

    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${qs.toString()}`, {
      headers: {
        'accept-language': 'ru,en',
        'user-agent': 'UFO-Delivery/1.0 (reverse geocode)',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: 'geocode_failed' }, { status: 502 })
    }

    const data = await res.json().catch(() => null)
    const addr = data?.address ?? {}

    const road = toText(addr?.road || addr?.pedestrian || addr?.residential || addr?.footway || '')
    const house = toText(addr?.house_number || '')
    const district = toText(addr?.suburb || addr?.city_district || addr?.neighbourhood || addr?.quarter || '')
    const city = toText(addr?.city || addr?.town || addr?.county || addr?.state || 'Пхукет')

    const street = [road, house].filter(Boolean).join(' ').trim()
    const pretty = toText(data?.display_name)
    const fallback = fromDisplayName(pretty)
    const composed = [street, district].filter(Boolean).join(', ').trim()

    return NextResponse.json({
      ok: true,
      address: composed || street || district || fallback || pretty,
      district,
      city: city || 'Пхукет',
      pretty,
      lat,
      lng,
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'geocode_unavailable' }, { status: 503 })
  }
}
