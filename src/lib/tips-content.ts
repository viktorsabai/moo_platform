/**
 * Единый контент подсказок/онбординга по маршрутам.
 * Один короткий шаг = одна мысль. В шите показывается по одному шагу за раз.
 */

export type TipsCard = {
  title: string
  body: string[]
}

const TIPS: Record<string, TipsCard> = {
  profile: {
    title: 'Профиль',
    body: [
      'Язык, тема и адрес доставки — здесь.',
      'Заказы и подписки — в блоке «История».',
      'Владелец? Раскрой «Режим владельца» и нажми «Войти в кабинет».',
    ],
  },
  admin: {
    title: 'Кабинет',
    body: [
      'Вверху — заказы и выручка за сегодня и за неделю.',
      '«Быстро»: открыто/закрыто и ссылка на доставку.',
      'Карточки — настройки, товары, команда, заказы.',
    ],
  },
  'admin/venue': {
    title: 'Настройки заведения',
    body: [
      'Чек-лист из 5 шагов — пройди по порядку.',
      'Ниже форма: доставка и часы. Нажми «Сохранить».',
      'Товары добавляются в «Меню и товары».',
    ],
  },
  'admin/orders': {
    title: 'Заказы заведения',
    body: [
      'Здесь все заказы заведения.',
      'Номер, клиент, сумма, статус — по каждому заказу.',
    ],
  },
  'admin/store': {
    title: 'Меню и товары',
    body: [
      'Добавить товар: название, категория, цена, остаток.',
      'В списке остатки можно править сразу.',
    ],
  },
  'admin/team': {
    title: 'Команда',
    body: [
      'Сотрудник один раз открывает приложение — потом выдаёшь роль по Telegram ID.',
      'Введи ID, выбери роль, нажми «Сохранить».',
    ],
  },
  'admin/qr': {
    title: 'QR для гостей',
    body: [
      'Подключи бота через платформу — тогда здесь появятся ссылка и QR.',
      'Гости сканируют QR и попадают в ваше заведение.',
    ],
  },
}

function getRouteId(pathname: string): string {
  const p = pathname.replace(/^\/+/, '').replace(/\/+$/, '') || 'profile'
  if (p === 'admin') return 'admin'
  if (p.startsWith('admin/')) return p
  if (p === 'profile') return 'profile'
  return p
}

export function getTipsForRoute(pathname: string): TipsCard | null {
  const routeId = getRouteId(pathname)
  return TIPS[routeId] ?? TIPS['admin'] ?? null
}

export const TIPS_ROUTE_IDS = Object.keys(TIPS)
