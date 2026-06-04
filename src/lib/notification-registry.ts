/**
 * Каталог всех Telegram-уведомлений MOO.
 * Источник правды для админки «Уведомления» и для разработки.
 */
export type NotificationAudience = 'guest' | 'owner' | 'platform'

export type NotificationCategory =
  | 'orders'
  | 'subscriptions'
  | 'leads'
  | 'marketing'
  | 'system'

export type NotificationEventDef = {
  id: string
  category: NotificationCategory
  title: string
  description: string
  audience: NotificationAudience
  trigger: string
  setup: string[]
  webAppButtons?: string[]
  callbackButtons?: string[]
  handler?: string
}

export const NOTIFICATION_SETUP = {
  bot: 'BotIntegration.botToken — бот заведения (ЛК → интеграция бота)',
  opsTeam: 'RestaurantMember OWNER / ADMIN / STAFF + telegramId у пользователя',
  envOwner: 'UFO_OWNER_NOTIFY_TELEGRAM_IDS — запасные chat id (через запятую)',
  envSuperadmin: 'UFO_SUPERADMIN_TELEGRAM_ID — платформа MOO',
  webhook: 'Webhook бота → /api/telegram/webhook',
} as const

export const NOTIFICATION_EVENTS: NotificationEventDef[] = [
  {
    id: 'order.created.guest',
    category: 'orders',
    title: 'Заказ принят',
    description: 'Гость оформил заказ — чек с позициями и ссылкой на оплату (если QR).',
    audience: 'guest',
    trigger: 'POST /api/orders',
    setup: [NOTIFICATION_SETUP.bot],
    webAppButtons: ['/orders/{id}', '/orders', '/'],
    handler: 'notifyOrderCreatedToCustomer',
  },
  {
    id: 'order.created.owner',
    category: 'orders',
    title: 'Новый заказ',
    description: 'Команде — позиции, адрес, оплата, кнопки смены статуса.',
    audience: 'owner',
    trigger: 'POST /api/orders',
    setup: [NOTIFICATION_SETUP.bot, NOTIFICATION_SETUP.opsTeam, NOTIFICATION_SETUP.envOwner],
    webAppButtons: ['/admin/orders', '/orders/{id}/pay'],
    callbackButtons: ['order_confirm_*', 'order_cancel_*'],
    handler: 'notifyOrderCreatedToOwner',
  },
  {
    id: 'order.status.guest',
    category: 'orders',
    title: 'Статус заказа',
    description: 'Гостю при смене статуса.',
    audience: 'guest',
    trigger: 'PATCH /api/admin/orders · webhook order_*',
    setup: [NOTIFICATION_SETUP.bot],
    webAppButtons: ['/orders/{id}', '/orders'],
    handler: 'notifyOrderStatusChangedToCustomer',
  },
  {
    id: 'order.status.owner',
    category: 'orders',
    title: 'Заказ обновлён',
    description: 'Команде при смене статуса.',
    audience: 'owner',
    trigger: 'PATCH /api/admin/orders · webhook order_*',
    setup: [NOTIFICATION_SETUP.bot, NOTIFICATION_SETUP.opsTeam],
    webAppButtons: ['/admin/orders'],
    callbackButtons: ['order_*'],
    handler: 'notifyOrderStatusChangedToOwner',
  },
  {
    id: 'order.payment.receipt',
    category: 'orders',
    title: 'Чек на проверку',
    description: 'Гость загрузил чек QR-оплаты.',
    audience: 'owner',
    trigger: 'POST /api/orders/{id}/receipt',
    setup: [NOTIFICATION_SETUP.bot, NOTIFICATION_SETUP.opsTeam],
    webAppButtons: ['/admin/orders'],
    callbackButtons: ['payok_*', 'payno_*'],
    handler: 'notifyOwnersManualPaymentReview',
  },
  {
    id: 'order.payment.confirmed',
    category: 'orders',
    title: 'Оплата подтверждена',
    description: 'Гостю после подтверждения чека.',
    audience: 'guest',
    trigger: 'webhook payok_*',
    setup: [NOTIFICATION_SETUP.webhook],
    webAppButtons: ['/orders/{id}'],
    handler: 'notifyCustomerPaymentConfirmed',
  },
  {
    id: 'order.payment.rejected',
    category: 'orders',
    title: 'Оплата отклонена',
    description: 'Гостю если чек не принят.',
    audience: 'guest',
    trigger: 'webhook payno_*',
    setup: [NOTIFICATION_SETUP.webhook],
    webAppButtons: ['/orders'],
    handler: 'notifyCustomerPaymentRejected',
  },
  {
    id: 'order.subscription.kitchen',
    category: 'orders',
    title: 'Заказ на кухню из подписки',
    description: 'Команде при создании заказа из CRM подписчиков.',
    audience: 'owner',
    trigger: 'PATCH /api/admin/subscriptions/deliveries/{id}',
    setup: [NOTIFICATION_SETUP.bot, NOTIFICATION_SETUP.opsTeam],
    webAppButtons: ['/admin/orders', '/admin/subscriptions/clients'],
    handler: 'notifySubscriptionKitchenOrderToOwner',
  },
  {
    id: 'subscription.created.guest',
    category: 'subscriptions',
    title: 'Заявка на подписку',
    description: 'Гостю после оформления подписки.',
    audience: 'guest',
    trigger: 'POST /api/subscriptions',
    setup: [NOTIFICATION_SETUP.bot],
    webAppButtons: ['/subscriptions/{id}', '/subscriptions'],
    handler: 'notifySubscriptionCreatedToCustomer',
  },
  {
    id: 'subscription.created.owner',
    category: 'subscriptions',
    title: 'Подписка ждёт подтверждения',
    description: 'Команде — подтвердить или отклонить.',
    audience: 'owner',
    trigger: 'POST /api/subscriptions',
    setup: [NOTIFICATION_SETUP.bot, NOTIFICATION_SETUP.opsTeam],
    webAppButtons: ['/admin/subscriptions/clients?subscriptionId=', '/admin'],
    callbackButtons: ['sub_confirm_*', 'sub_reject_*'],
    handler: 'notifySubscriptionCreatedToOwner',
  },
  {
    id: 'subscription.delivery.delivered.guest',
    category: 'subscriptions',
    title: 'Доставка подписки выполнена',
    description: 'Гостю когда в CRM отмечено «доставлено» по слоту рациона.',
    audience: 'guest',
    trigger: 'PATCH /api/admin/subscriptions/deliveries/{id} mark_delivered',
    setup: [NOTIFICATION_SETUP.bot],
    webAppButtons: ['/subscriptions/{id}', '/subscriptions'],
    handler: 'notifySubscriptionDeliveryDeliveredToCustomer',
  },
  {
    id: 'subscription.status.guest',
    category: 'subscriptions',
    title: 'Подписка обновлена',
    description: 'Гостю при активации или отмене.',
    audience: 'guest',
    trigger: 'PATCH admin/subscriptions · webhook sub_*',
    setup: [NOTIFICATION_SETUP.bot],
    webAppButtons: ['/subscriptions/{id}', '/subscriptions'],
    handler: 'notifySubscriptionStatusChangedToCustomer',
  },
  {
    id: 'subscription.status.owner',
    category: 'subscriptions',
    title: 'Подписка обновлена (ЛК)',
    description: 'Команде при смене статуса.',
    audience: 'owner',
    trigger: 'PATCH admin/subscriptions · webhook sub_*',
    setup: [NOTIFICATION_SETUP.opsTeam],
    webAppButtons: ['/admin/subscriptions/clients?subscriptionId='],
    handler: 'notifySubscriptionStatusChangedToOwner',
  },
  {
    id: 'subscription.request.guest',
    category: 'subscriptions',
    title: '«Хочу подписку»',
    description: 'Подтверждение гостю при заявке (подписки выключены).',
    audience: 'guest',
    trigger: 'POST /api/subscription-requests',
    setup: [NOTIFICATION_SETUP.bot],
    webAppButtons: ['/subscriptions'],
    handler: 'notifySubscriptionRequestToCustomer',
  },
  {
    id: 'subscription.request.owner',
    category: 'subscriptions',
    title: 'Запрос на подписку',
    description: 'Команде — гость хочет рационы.',
    audience: 'owner',
    trigger: 'POST /api/subscription-requests',
    setup: [NOTIFICATION_SETUP.opsTeam],
    webAppButtons: ['/admin/subscriptions/clients'],
    handler: 'notifySubscriptionRequestToOps',
  },
  {
    id: 'lead.created.guest',
    category: 'leads',
    title: 'Заявка отправлена',
    description: 'Гостю после формы «еда для событий».',
    audience: 'guest',
    trigger: 'POST /api/leads',
    setup: [NOTIFICATION_SETUP.bot],
    webAppButtons: ['/'],
    handler: 'notifyServiceLeadCreatedToCustomer',
  },
  {
    id: 'lead.created.owner',
    category: 'leads',
    title: 'Новая заявка (кейтеринг)',
    description: 'Команде — тип, гости, дата.',
    audience: 'owner',
    trigger: 'POST /api/leads',
    setup: [NOTIFICATION_SETUP.opsTeam],
    webAppButtons: ['/admin/leads'],
    handler: 'notifyServiceLeadCreatedToOps',
  },
  {
    id: 'campaign.published',
    category: 'marketing',
    title: 'Новая публичная акция',
    description: 'Рассылка гостям при публикации кампании.',
    audience: 'guest',
    trigger: 'POST/PATCH /api/admin/campaigns',
    setup: ['Кампании → «уведомить при публикации»', NOTIFICATION_SETUP.bot],
    webAppButtons: ['/menu'],
    handler: 'broadcastPublicCampaign',
  },
  {
    id: 'crm.scenario',
    category: 'marketing',
    title: 'Сценарий из CRM гостей',
    description: 'Ручная отправка из раздела «Гости».',
    audience: 'guest',
    trigger: 'POST /api/admin/notifications/scenario',
    setup: ['ЛК → Гости → карточка гостя'],
    webAppButtons: ['/checkout', '/cart', '/menu', '/subscriptions'],
  },
  {
    id: 'bot.start',
    category: 'system',
    title: '/start в боте',
    description: 'Приветствие и кнопка в mini app.',
    audience: 'guest',
    trigger: 'POST /api/telegram/webhook',
    setup: [NOTIFICATION_SETUP.bot, NOTIFICATION_SETUP.webhook],
    webAppButtons: ['/'],
  },
  {
    id: 'platform.business_inquiry',
    category: 'system',
    title: 'Заявка «хочу бизнес»',
    description: 'Супер-админу MOO.',
    audience: 'platform',
    trigger: 'POST /api/profile/business-inquiry',
    setup: [NOTIFICATION_SETUP.envSuperadmin],
    webAppButtons: ['/profile'],
  },
  {
    id: 'export.menu_store',
    category: 'system',
    title: 'Выгрузка меню/магазина',
    description: 'CSV в Telegram по кнопке в ЛК.',
    audience: 'owner',
    trigger: 'GET /api/admin/export/notify-bot',
    setup: [NOTIFICATION_SETUP.bot, NOTIFICATION_SETUP.opsTeam],
  },
]

export function groupNotificationsByCategory() {
  const order: NotificationCategory[] = ['orders', 'subscriptions', 'leads', 'marketing', 'system']
  return order
    .map((category) => ({
      category,
      events: NOTIFICATION_EVENTS.filter((e) => e.category === category),
    }))
    .filter((g) => g.events.length > 0)
}

export const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  orders: 'Заказы',
  subscriptions: 'Подписки',
  leads: 'Заявки и кейтеринг',
  marketing: 'Маркетинг и CRM',
  system: 'Система',
}

export const AUDIENCE_LABEL: Record<NotificationAudience, string> = {
  guest: 'гость',
  owner: 'команда заведения',
  platform: 'платформа MOO',
}
