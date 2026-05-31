import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getConsumerRestaurantId } from '@/lib/restaurant-context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ARCHIVE_CATEGORY_SLUG = '__archive'

function toMs(value: Date | null | undefined): number {
  if (!value) return 0
  const t = value.getTime()
  return Number.isFinite(t) ? t : 0
}

async function getDishOptionVersionParts(restaurantId: string): Promise<{ updatedAt: Date | null; count: number }> {
  try {
    const [agg, count] = await Promise.all([
      prisma.dishOptionValue.aggregate({
        where: { restaurantId, dish: { isAvailable: true } },
        _max: { updatedAt: true },
      }),
      prisma.dishOptionValue.count({
        where: { restaurantId, dish: { isAvailable: true } },
      }),
    ])
    return { updatedAt: agg._max.updatedAt, count }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2021' || error.code === 'P2022')) {
      return { updatedAt: null, count: 0 }
    }
    throw error
  }
}

export async function GET() {
  try {
    const restaurantId = await getConsumerRestaurantId()

    const [
      catAgg,
      dishAgg,
      dishAllAgg,
      modifierAgg,
      catCount,
      dishCount,
      dishAllCount,
      modifierCount,
      storeCatAgg,
      storeProductAgg,
      storeVariantAgg,
      storeCatCount,
      storeProductCount,
      storeVariantCount,
    ] = await Promise.all([
      prisma.category.aggregate({
        where: { restaurantId, slug: { not: ARCHIVE_CATEGORY_SLUG } },
        _max: { updatedAt: true },
      }),
      prisma.dish.aggregate({
        where: { restaurantId, isAvailable: true },
        _max: { updatedAt: true },
      }),
      // Черновики / выключенные блюда тоже должны менять версию, иначе ЛК сохранил, а витрина ещё долго на старом кэше.
      prisma.dish.aggregate({
        where: { restaurantId },
        _max: { updatedAt: true },
      }),
      prisma.dishModifier.aggregate({
        where: { dish: { restaurantId, isAvailable: true } },
        _max: { updatedAt: true },
      }),
      prisma.category.count({
        where: { restaurantId, slug: { not: ARCHIVE_CATEGORY_SLUG } },
      }),
      prisma.dish.count({
        where: { restaurantId, isAvailable: true },
      }),
      prisma.dish.count({
        where: { restaurantId },
      }),
      prisma.dishModifier.count({
        where: { dish: { restaurantId, isAvailable: true } },
      }),
      prisma.storeCategory.aggregate({
        where: { restaurantId },
        _max: { updatedAt: true },
      }),
      prisma.storeProduct.aggregate({
        where: { restaurantId, isActive: true },
        _max: { updatedAt: true },
      }),
      prisma.storeVariant.aggregate({
        where: { restaurantId, isActive: true },
        _max: { updatedAt: true },
      }),
      prisma.storeCategory.count({
        where: { restaurantId },
      }),
      prisma.storeProduct.count({
        where: { restaurantId, isActive: true },
      }),
      prisma.storeVariant.count({
        where: { restaurantId, isActive: true },
      }),
    ])
    const dishOptions = await getDishOptionVersionParts(restaurantId)

    const foodVersion = `${toMs(catAgg._max.updatedAt)}:${toMs(dishAgg._max.updatedAt)}:${toMs(dishAllAgg._max.updatedAt)}:${toMs(modifierAgg._max.updatedAt)}:${toMs(dishOptions.updatedAt)}:${catCount}:${dishCount}:${dishAllCount}:${modifierCount}:${dishOptions.count}`
    const storeVersion = `${toMs(storeCatAgg._max.updatedAt)}:${toMs(storeProductAgg._max.updatedAt)}:${toMs(storeVariantAgg._max.updatedAt)}:${storeCatCount}:${storeProductCount}:${storeVariantCount}`

    return NextResponse.json({
      ok: true,
      restaurantId,
      foodVersion,
      storeVersion,
      ts: Date.now(),
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка версии меню' }, { status: 500 })
  }
}

