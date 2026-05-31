/* eslint-disable no-console */

const { PrismaClient, Prisma } = require('@prisma/client')

const prisma = new PrismaClient()

async function ensureRestaurant({ id, name, slug, startParam, fullDemo = false }) {
  const restaurant = await prisma.restaurant.upsert({
    where: { id },
    create: { id, name, slug, isActive: true },
    update: { name, slug, isActive: true },
    select: { id: true },
  })

  const createData = {
    storeEnabled: true,
    menuEnabled: fullDemo ? true : false,
    subscriptionEnabled: fullDemo ? true : false,
    deliveryFee: 100,
    freeDeliveryFrom: 500,
    openTime: '10:00',
    closeTime: '22:00',
    isOpenOverride: null,
    restaurant: { connect: { id } },
  }

  await prisma.appSettings.upsert({
    where: { restaurantId: id },
    create: createData,
    update: fullDemo ? { menuEnabled: true, storeEnabled: true, subscriptionEnabled: true } : {},
  })

  // ensure bot integration exists for resolving tenant via start_param
  await prisma.botIntegration.upsert({
    where: { startParam },
    create: {
      startParam,
      restaurant: { connect: { id } },
      botUsername: null,
      botToken: null,
    },
    update: { restaurant: { connect: { id } } },
    select: { id: true },
  })

  return restaurant.id
}

async function seedMenuForRestaurant(restaurantId) {
  const menuCategories = [
    { name: 'супы', slug: 'soups', order: 1 },
    { name: 'горячее', slug: 'mains', order: 2 },
    { name: 'салаты', slug: 'salads', order: 3 },
    { name: 'напитки', slug: 'drinks', order: 4 },
  ]

  const catBySlug = new Map()
  for (const c of menuCategories) {
    const saved = await prisma.category.upsert({
      where: { restaurantId_slug: { restaurantId, slug: c.slug } },
      create: { name: c.name, slug: c.slug, order: c.order, restaurantId },
      update: { name: c.name, order: c.order },
      select: { id: true, slug: true },
    })
    catBySlug.set(saved.slug, saved.id)
  }

  const dishes = [
    { catSlug: 'soups', name: 'борщ', slug: 'borscht', price: 180, description: 'свекла, мясо, сметана' },
    { catSlug: 'soups', name: 'том ям', slug: 'tom-yam', price: 220, description: 'креветки, имбирь, лимонная трава' },
    { catSlug: 'soups', name: 'куриный суп', slug: 'chicken-soup', price: 150, description: 'лапша, курица, зелень' },
    { catSlug: 'mains', name: 'паста карбонара', slug: 'carbonara', price: 280, description: 'бекон, сливки, пармезан' },
    { catSlug: 'mains', name: 'стейк из лосося', slug: 'salmon-steak', price: 450, description: '180 г, овощи гриль' },
    { catSlug: 'mains', name: 'рис с курицей', slug: 'rice-chicken', price: 200, description: 'карри, зелень' },
    { catSlug: 'mains', name: 'котлета по‑киевски', slug: 'chicken-kiev', price: 320, description: 'куриная грудка, масло' },
    { catSlug: 'salads', name: 'цезарь', slug: 'caesar', price: 250, description: 'курица, салат, пармезан' },
    { catSlug: 'salads', name: 'греческий', slug: 'greek', price: 190, description: 'фета, оливки, огурец' },
    { catSlug: 'drinks', name: 'латте', slug: 'latte', price: 120, description: 'эспрессо, молоко' },
    { catSlug: 'drinks', name: 'апельсиновый сок', slug: 'orange-juice', price: 80, description: 'свежевыжатый' },
    { catSlug: 'drinks', name: 'чай зелёный', slug: 'green-tea', price: 60, description: 'жасмин' },
    { catSlug: 'drinks', name: 'лимонад', slug: 'lemonade', price: 90, description: 'мятный, лёд' },
  ]

  for (const d of dishes) {
    const categoryId = catBySlug.get(d.catSlug)
    if (!categoryId) continue
    await prisma.dish.upsert({
      where: { restaurantId_slug: { restaurantId, slug: d.slug } },
      create: {
        restaurantId,
        name: d.name,
        slug: d.slug,
        description: d.description || null,
        price: new Prisma.Decimal(String(d.price)),
        categoryId,
        isAvailable: true,
      },
      update: {
        name: d.name,
        description: d.description || null,
        price: new Prisma.Decimal(String(d.price)),
      },
    })
  }

  // Add modifiers to a couple dishes
  const carbonara = await prisma.dish.findFirst({
    where: { restaurantId, slug: 'carbonara' },
    select: { id: true },
  })
  if (carbonara) {
    const existing = await prisma.dishModifier.findFirst({
      where: { dishId: carbonara.id, name: 'доп. пармезан' },
    })
    if (!existing) {
      await prisma.dishModifier.create({
        data: {
          dishId: carbonara.id,
          name: 'доп. пармезан',
          type: 'ADD',
          priceAdjust: new Prisma.Decimal('50'),
          order: 0,
        },
      })
    }
  }
}

async function seedBannersForRestaurant(restaurantId) {
  await prisma.homeBanner.deleteMany({ where: { restaurantId } })

  const banners = [
    { title: 'Блюдо дня', description: 'Специальное предложение от шефа', href: '/menu', cta: 'Открыть', type: 'chip', order: 0 },
    { title: 'Пробная подписка', description: 'Питание по расписанию со скидкой', href: '/subscriptions/new', cta: 'Настроить', type: 'chip', order: 1 },
    { title: 'Спецпредложения', description: 'Комбо и ограниченные предложения', href: '/menu', cta: 'Смотреть', type: 'chip', order: 2 },
    { title: 'Как работает подписка', description: 'Выберите дни и время — доставка по расписанию', href: '/subscriptions', cta: 'Узнать', type: 'reel', order: 3 },
    { title: 'Что готовят сегодня', description: 'Меню на день и на неделю', href: '/menu', cta: 'Смотреть', type: 'reel', order: 4 },
    { title: 'Повторить прошлый заказ', description: 'Один тап — и заказ снова у вас', href: '/orders?from=profile', cta: 'Повторить', type: 'reel', order: 5 },
  ]

  for (const b of banners) {
    await prisma.homeBanner.create({
      data: {
        restaurantId,
        title: b.title,
        description: b.description,
        href: b.href,
        cta: b.cta,
        type: b.type,
        order: b.order,
        isActive: true,
      },
    })
  }
}

// Default plans: Standard, Fit, Family (Thailand-friendly, rules in src/lib/subscription-plans.ts)
const DEFAULT_PLANS = [
  { presetSlug: 'standard', name: 'Standard', price: 1290, plan: 'WEEKLY', order: 0 },
  { presetSlug: 'fit', name: 'Fit', price: 1490, plan: 'WEEKLY', order: 1 },
  { presetSlug: 'family', name: 'Family', price: 1990, plan: 'WEEKLY', order: 2 },
]

async function seedSubscriptionPlansForRestaurant(restaurantId) {
  await prisma.subscriptionPlanTemplate.deleteMany({ where: { restaurantId } })

  for (const p of DEFAULT_PLANS) {
    await prisma.subscriptionPlanTemplate.create({
      data: {
        restaurantId,
        name: p.name,
        price: new Prisma.Decimal(String(p.price)),
        plan: p.plan,
        presetSlug: p.presetSlug,
        order: p.order,
        isActive: true,
      },
    })
  }
}

async function main() {
  const defaultRestaurantId = await ensureRestaurant({
    id: 'default',
    name: 'Доставка на дом',
    slug: 'default',
    startParam: 'topka',
    fullDemo: true,
  })

  const secondRestaurantId = await ensureRestaurant({
    id: 'demo-2',
    name: 'demo restaurant 2',
    slug: 'demo-2',
    startParam: 'demo2',
    fullDemo: true,
  })

  const categories = [
    { name: 'полуфабрикаты', slug: 'frozen', order: 1 },
    { name: 'соусы и заготовки', slug: 'sauces', order: 2 },
    { name: 'напитки', slug: 'drinks', order: 3 },
  ]

  async function seedStoreForRestaurant(restaurantId) {
    const catBySlug = new Map()
    for (const c of categories) {
      const saved = await prisma.storeCategory.upsert({
        where: { restaurantId_slug: { restaurantId, slug: c.slug } },
        create: { name: c.name, slug: c.slug, order: c.order, restaurantId },
        update: { name: c.name, order: c.order },
        select: { id: true, slug: true },
      })
      catBySlug.set(saved.slug, saved.id)
    }

    const products = [
      {
        categorySlug: 'frozen',
        name: 'пельмени домашние',
        slug: 'dumplings-home',
        description: 'свинина/говядина · ручная лепка',
        variants: [
          { name: '500 г', sku: `DUMPLINGS-HOME-500-${restaurantId}`, price: 189, qty: 12 },
          { name: '1 кг', sku: `DUMPLINGS-HOME-1000-${restaurantId}`, price: 349, qty: 6 },
        ],
      },
      {
        categorySlug: 'frozen',
        name: 'вареники с картофелем',
        slug: 'vareniki-potato',
        description: 'классика для дома',
        variants: [{ name: '500 г', sku: `VARENIKI-POTATO-500-${restaurantId}`, price: 159, qty: 10 }],
      },
      {
        categorySlug: 'sauces',
        name: 'соус том ям (основа)',
        slug: 'tom-yum-base',
        description: 'для супа или лапши',
        variants: [{ name: '250 мл', sku: `TOMYUM-BASE-250-${restaurantId}`, price: 129, qty: 20 }],
      },
      {
        categorySlug: 'drinks',
        name: 'комбуча',
        slug: 'kombucha',
        description: 'имбирь · без сахара',
        variants: [{ name: '330 мл', sku: `KOMBUCHA-330-${restaurantId}`, price: 89, qty: 24 }],
      },
    ]

    for (const p of products) {
      const categoryId = catBySlug.get(p.categorySlug)
      if (!categoryId) continue

      const prod = await prisma.storeProduct.upsert({
        where: { restaurantId_slug: { restaurantId, slug: p.slug } },
        create: {
          name: p.name,
          slug: p.slug,
          description: p.description,
          categoryId,
          isActive: true,
          restaurantId,
        },
        update: {
          name: p.name,
          description: p.description,
          categoryId,
          isActive: true,
        },
        select: { id: true },
      })

      for (const v of p.variants) {
        await prisma.storeVariant.upsert({
          where: { restaurantId_sku: { restaurantId, sku: v.sku } },
          create: {
            productId: prod.id,
            name: v.name,
            sku: v.sku,
            price: new Prisma.Decimal(String(v.price)),
            qty: v.qty,
            isActive: true,
            restaurantId,
          },
          update: {
            productId: prod.id,
            name: v.name,
            price: new Prisma.Decimal(String(v.price)),
            qty: v.qty,
            isActive: true,
          },
        })
      }
    }
  }

  await seedStoreForRestaurant(defaultRestaurantId)
  await seedStoreForRestaurant(secondRestaurantId)

  await seedMenuForRestaurant(defaultRestaurantId)
  await seedMenuForRestaurant(secondRestaurantId)

  await seedBannersForRestaurant(defaultRestaurantId)
  await seedBannersForRestaurant(secondRestaurantId)
  await seedSubscriptionPlansForRestaurant(defaultRestaurantId)
  await seedSubscriptionPlansForRestaurant(secondRestaurantId)

  console.log('Seed completed.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

