# Исходные выводы аудита Moo

## Репозиторий

- Репозиторий: https://github.com/viktorsabai/moo_platform
- HEAD на момент аудита: `db570ad Simplify owner dashboard layout with task inbox and quick toggles.`
- Стек: Next.js 14 App Router, TypeScript, Tailwind, Prisma, PostgreSQL, NextAuth, Stripe.
- Поверхности: guest app (`/`, `/menu`, `/cart`, `/checkout`, `/profile`, `/orders`, `/subscriptions`) и owner cabinet (`/admin/*`).
- Обмен: Mini App/browser -> internal API -> PostgreSQL через Prisma; outbound Telegram Bot API; inbound webhook `/api/telegram/webhook`.
- В документации зафиксирован single-tenant production behavior с разрешением ресторана через `getRestaurantContext()`.
- MVP по README/FEATURES: меню, магазин, одноразовые заказы, кабинет продавца, зоны доставки, Telegram-уведомления; подписки в клиентском продукте выключены и заменены заявкой «Хочу подписку».
- Зафиксированные реализованные блоки: импорт/экспорт меню CSV, категории и блюда, store categories/products/variants, баннеры с target `menu_category`, визиты и ручные scenario notifications, статусы заказа `PENDING -> CONFIRMED -> PREPARING -> READY -> OUT_FOR_DELIVERY -> DELIVERED` плюс `CANCELLED`.
- Известные ограничения в документации: подписки как клиентский продукт post-MVP; отсутствуют anti-spam/cooldown/daily cap/click-conversion для сценарных сообщений; рекомендован общий options constructor для menu/store; в FEATURES отмечено незавершённое улучшение UI/UX редактирования и превью планов.
- В README есть указание `typescript.ignoreBuildErrors: true` в FEATURES как Vercel workaround — требует отдельной проверки качества сборки.

## Лендинг

- URL: https://moo-beryl.vercel.app/
- Позиционирование: Telegram Mini App для ресторанов, заказы, меню, постоянные гости, без комиссии агрегаторов и отдельных приложений; обещание запуска за 48 часов.
- Заявленные сценарии: guest ordering, menu/store, subscriptions/Lunch Pass, marketing campaigns/push, CRM/visits, auto-segments, owner settings, delivery/pickup, payment methods Stars/QR/Omise.
- FAQ лендинга описывает QR-оплату с прикреплением чека в Mini App и ручным подтверждением владельцем/менеджером; статусы отправляются через Telegram.
- Коммерческое обещание: 0% комиссии, единоразовый запуск 20,000 THB по акции, перенос меню с фото, роли повар/курьер/менеджер, стоп-листы, подписки с календарём.
- Требуется проверить соответствие реального кода лендингу по критичным обещаниям: платежи QR/чек/Stars/Omise, delivery/pickup, CRM/кампании/push/автосегменты, роли, subscription checkout, multi-tenant и Telegram auth.
