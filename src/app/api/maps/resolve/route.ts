import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseCoordinatesFromUrl(input: string): { lat: number; lng: number } | null {
  const byAt = input.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (byAt) return { lat: Number(byAt[1]), lng: Number(byAt[2]) }

  const by3d4d = input.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (by3d4d) return { lat: Number(by3d4d[1]), lng: Number(by3d4d[2]) }

  try {
    const u = new URL(input)
    const q = u.searchParams.get('q') || u.searchParams.get('query') || u.searchParams.get('ll')
    if (q) {
      const m = q.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
      if (m) return { lat: Number(m[1]), lng: Number(m[2]) }
    }
  } catch {
    return null
  }
  return null
}

function parsePlaceLabel(input: string): string | null {
  try {
    const u = new URL(input)
    const q = u.searchParams.get('q') || u.searchParams.get('query')
    if (q && !q.match(/-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?/)) return decodeURIComponent(q).trim()
    const placeMatch = u.pathname.match(/\/place\/([^/]+)/)
    if (placeMatch) return decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ').trim()
    return null
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = String(searchParams.get('url') || '').trim()
  if (!raw) return NextResponse.json({ ok: false, error: 'url_required' }, { status: 400 })

  let normalized = raw
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`

  try {
    const res = await fetch(normalized, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      headers: { 'user-agent': 'UFO-Delivery/1.0 (maps-resolve)' },
    })
    const finalUrl = res.url || normalized
    const coords = parseCoordinatesFromUrl(finalUrl) || parseCoordinatesFromUrl(normalized)
    const label = parsePlaceLabel(finalUrl) || parsePlaceLabel(normalized)

    return NextResponse.json({
      ok: true,
      url: normalized,
      finalUrl,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      label: label || null,
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'resolve_failed' }, { status: 502 })
  }
}

