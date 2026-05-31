import { NextResponse } from 'next/server'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'
import { ensureMvpTables } from '@/lib/mvp-db'
import { prisma } from '@/lib/prisma'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import { PHUKET_DISTRICTS_GEOJSON } from '@/lib/phuket-districts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function includesAny(haystack: string, needles: string[]) {
  const normalized = haystack.toLowerCase()
  return needles.some((n) => normalized.includes(String(n).toLowerCase()))
}

const DISTRICT_ALIASES: Record<string, string[]> = {
  rawai: ['rawai', 'равай'],
  nai_harn: ['nai harn', 'naiharn', 'най харн', 'найхарн'],
  kata: ['kata', 'ката'],
  kata_noi: ['kata noi', 'ката ной'],
  karon: ['karon', 'карон'],
  patong: ['patong', 'патонг'],
  kamala: ['kamala', 'камала'],
  chalong: ['chalong', 'чалонг'],
  kathu: ['kathu', 'катху'],
  phuket_town: ['phuket town', 'old town', 'пхукет таун', 'пхукет-таун', 'пхукет town'],
  wichit: ['wichit', 'вичит'],
  rasada: ['rasada', 'расада'],
  koh_kaew: ['koh kaew', 'кокео', 'кхо кео', 'ко кео'],
  nakaa: ['nakaa', 'naka', 'накха', 'накка'],
  bang_tao: ['bang tao', 'bangtao', 'банг тао', 'бангтао'],
  cherngtalay: ['cherngtalay', 'чернгталай'],
  surin: ['surin', 'сурин'],
  nai_yang: ['nai yang', 'най янг'],
  mai_khao: ['mai khao', 'май као'],
  paklok: ['paklok', 'паклок'],
  sri_sunthon: ['sri sunthon', 'сри сунтон'],
  thep_krasattri: ['thep krasattri', 'тхеп красатри', 'таланг'],
}

function detectDistrictIdFromText(text: string): string | null {
  const normalized = String(text || '').toLowerCase().trim()
  if (!normalized) return null
  for (const [districtId, aliases] of Object.entries(DISTRICT_ALIASES)) {
    if (aliases.some((alias) => normalized.includes(alias.toLowerCase()))) return districtId
  }
  return null
}

function districtAliasesById(districtId: string): string[] {
  return DISTRICT_ALIASES[String(districtId || '').toLowerCase()] || []
}

function parsePolygonGeometry(raw: string | null | undefined): { type: 'Polygon'; coordinates: number[][][] } | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.type !== 'Polygon' || !Array.isArray(parsed?.coordinates?.[0])) return null
    return parsed as { type: 'Polygon'; coordinates: number[][][] }
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  try {
    await ensureMvpTables()
    const { searchParams } = new URL(request.url)
    const restaurantId = await getConsumerRestaurantId()
    const address = String(searchParams.get('address') || '')
    const city = String(searchParams.get('city') || '')
    const zipCode = String(searchParams.get('zipCode') || '')
    const lat = Number(searchParams.get('lat') || NaN)
    const lng = Number(searchParams.get('lng') || NaN)
    const subtotal = Math.max(0, Number(searchParams.get('subtotal') || 0))
    const fullAddress = `${address} ${city} ${zipCode}`.trim()

    const zones = await prisma.$queryRawUnsafe<
      Array<{
        id: string
        name: string
        polygonJson: string | null
        keywords: string[] | null
        zipCodes: string[] | null
        deliveryFee: number
        minOrderAmount: number
        deliveryWindowMin: number
        sortOrder: number
      }>
    >(
      `SELECT "id","name","polygonJson","keywords","zipCodes","deliveryFee","minOrderAmount","deliveryWindowMin","sortOrder"
       FROM "DeliveryZone"
       WHERE "restaurantId"=$1 AND "isActive"=TRUE
       ORDER BY "sortOrder" ASC, "createdAt" ASC`,
      restaurantId
    )

    const matchedDistrictByPoint =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? PHUKET_DISTRICTS_GEOJSON.features.find((feature) =>
            booleanPointInPolygon(point([lng, lat]), feature.geometry as any)
          ) || null
        : null

    const matchedByPolygon =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? zones.find((z) => {
            const polygon = parsePolygonGeometry(z.polygonJson)
            if (!polygon) return false
            return booleanPointInPolygon(point([lng, lat]), polygon as any)
          }) || null
        : null

    const districtId = matchedDistrictByPoint ? String(matchedDistrictByPoint.id || '') : ''
    const districtName = matchedDistrictByPoint ? String(matchedDistrictByPoint.properties?.name || '') : ''
    const districtIdByText = districtId || detectDistrictIdFromText(fullAddress) || ''

    const matchedByDistrictId = districtIdByText
      ? zones.find((z) => Array.isArray(z.keywords) && z.keywords.some((k) => String(k).toLowerCase() === `district:${districtIdByText}`))
      : null
    /** Ключевое слово ровно `rawai` / `kata` и т.д. (как в админке при привязке района). */
    const matchedByDistrictPlainKeyword = districtIdByText
      ? zones.find(
          (z) =>
            Array.isArray(z.keywords) &&
            z.keywords.some(
              (k) =>
                String(k).toLowerCase() === String(districtIdByText).toLowerCase() &&
                !String(k).toLowerCase().startsWith('district:')
            )
        )
      : null
    const matchedByDistrictAliasName = districtIdByText
      ? zones.find((z) => {
          const zoneName = String(z.name || '').toLowerCase()
          if (!zoneName) return false
          return districtAliasesById(districtIdByText).some((alias) => zoneName.includes(alias.toLowerCase()))
        })
      : null
    const matchedByDistrictName = districtName
      ? zones.find((z) => String(z.name || '').toLowerCase() === districtName.toLowerCase())
      : null

    const matched =
      matchedByPolygon ||
      matchedByDistrictId ||
      matchedByDistrictPlainKeyword ||
      matchedByDistrictAliasName ||
      matchedByDistrictName ||
      zones.find((z) => Array.isArray(z.zipCodes) && z.zipCodes.includes(zipCode)) ||
      zones.find((z) => Array.isArray(z.keywords) && includesAny(fullAddress, z.keywords || [])) ||
      null

    if (!matched) {
      if (zones.length === 0) {
        return NextResponse.json({
          ok: true,
          matched: false,
          reason: 'no_active_zones',
          message: 'Доставка сейчас недоступна — оформите самовывоз или уточните у заведения.',
        })
      }
      console.warn('[delivery/quote] no zone matched', {
        restaurantId,
        zonesCount: zones.length,
        address: fullAddress,
        districtIdByText: districtIdByText || null,
        districtNameByPoint: districtName || null,
        hasCoords: Number.isFinite(lat) && Number.isFinite(lng),
      })
      return NextResponse.json({
        ok: true,
        matched: false,
        reason: 'no_zone',
        trace: {
          restaurantId,
          zonesCount: zones.length,
          districtIdByText: districtIdByText || null,
          districtNameByPoint: districtName || null,
        },
        district: districtId
          ? {
              id: districtId,
              name: districtName || districtId,
            }
          : null,
        message: 'Адрес не входит в зоны доставки. Уточните у заведения в чате.',
      })
    }

    const minOrderAmount = Math.max(0, Number(matched.minOrderAmount || 0))
    const deliveryFee = Math.max(0, Number(matched.deliveryFee || 0))
    const deliveryWindowMin = Math.max(10, Number(matched.deliveryWindowMin || 60))
    const minOrderSatisfied = subtotal >= minOrderAmount

    return NextResponse.json({
      ok: true,
      matched: true,
      zone: {
        id: matched.id,
        name: matched.name,
        districtId: districtId || null,
        districtName: districtName || null,
        deliveryFee,
        minOrderAmount,
        deliveryWindowMin,
        minOrderSatisfied,
        missingForMinOrder: minOrderSatisfied ? 0 : minOrderAmount - subtotal,
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Не удалось рассчитать доставку. Попробуйте позже.' }, { status: 500 })
  }
}
