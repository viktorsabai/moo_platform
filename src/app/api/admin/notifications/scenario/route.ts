import { NextResponse } from 'next/server'
import { buildWebAppUrl, escapeHtml, sendTelegramMessage } from '@/lib/telegram'
import { getRestaurantContext, requireRestaurantAdmin } from '@/lib/restaurant-context'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ScenarioKey =
  | 'abandoned_checkout'
  | 'abandoned_cart'
  | 'favorite_interest'
  | 'repeat_view'
  | 'subscription_interest'
  | 'repeat_customer'

const ALLOWED = new Set<ScenarioKey>([
  'abandoned_checkout',
  'abandoned_cart',
  'favorite_interest',
  'repeat_view',
  'subscription_interest',
  'repeat_customer',
])

function buildScenarioMessage(params: { scenario: ScenarioKey; dishName?: string }) {
  const dishLabel = params.dishName ? ` «${escapeHtml(params.dishName)}»` : ''
  switch (params.scenario) {
    case 'abandoned_checkout':
      return {
        text: `<b>🛒 Вы были в шаге от заказа</b>\nОформление не завершено. Вернитесь, ваш выбор уже в приложении.`,
        ctaLabel: 'Вернуться к оформлению',
        ctaPath: '/checkout',
      }
    case 'abandoned_cart':
      return {
        text: `<b>🧺 В корзине остались блюда</b>\nОформите заказ в пару тапов, пока всё актуально.`,
        ctaLabel: 'Открыть корзину',
        ctaPath: '/cart',
      }
    case 'favorite_interest':
      return {
        text: `<b>❤️ Ваше избранное ждёт</b>\nЗагляните в подборку${dishLabel}.`,
        ctaLabel: 'Избранное',
        ctaPath: '/profile/favorites',
      }
    case 'subscription_interest':
      return {
        text: `<b>📦 Подписка на доставку</b>\nМожно оформить план и получать блюда регулярно.`,
        ctaLabel: 'Подписки',
        ctaPath: '/subscriptions',
      }
    case 'repeat_customer':
      return {
        text: `<b>🔁 Рады снова вас видеть</b>\nЗакажите любимое или посмотрите новинки${dishLabel}.`,
        ctaLabel: 'Меню',
        ctaPath: '/menu',
      }
    case 'repeat_view':
    default:
      return {
        text: `<b>👀 Вам понравилось блюдо</b>\nОткройте карточку${dishLabel} и добавьте в корзину.`,
        ctaLabel: 'Меню',
        ctaPath: '/menu',
      }
  }
}

export async function POST(request: Request) {
  try {
    const ctx = requireRestaurantAdmin(await getRestaurantContext())
    const body = await request.json().catch(() => ({} as any))
    const telegramId = String(body?.telegramId || '').trim()
    const scenario = String(body?.scenario || '').trim() as ScenarioKey
    const dishName = String(body?.dishName || '').trim() || undefined

    if (!telegramId) return NextResponse.json({ ok: false, error: 'missing_telegram_id' }, { status: 400 })
    if (!ALLOWED.has(scenario)) return NextResponse.json({ ok: false, error: 'invalid_scenario' }, { status: 400 })

    const bot = await prisma.botIntegration.findFirst({
      where: { restaurantId: ctx.restaurantId },
      select: { botToken: true },
    })
    const botToken = bot?.botToken || process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) return NextResponse.json({ ok: false, error: 'missing_bot_token' }, { status: 400 })

    const tpl = buildScenarioMessage({ scenario, dishName })
    const sent = await sendTelegramMessage(
      telegramId,
      {
        text: tpl.text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: tpl.ctaLabel, web_app: { url: buildWebAppUrl(tpl.ctaPath) } }]],
        },
      },
      botToken
    )
    if (!sent.ok) {
      return NextResponse.json({ ok: false, error: 'telegram_send_failed' }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const status = Number(e?.statusCode || 500)
    return NextResponse.json({ ok: false, error: status === 403 ? 'forbidden' : 'failed' }, { status })
  }
}

