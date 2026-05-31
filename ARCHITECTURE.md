# Архитектура UFO Delivery

## Обзор архитектуры

UFO Delivery построен на основе **Next.js 14** с использованием **App Router** и следует принципам **Feature-Based Architecture** для лучшей организации кода и масштабируемости.

## Платформа MOO: ссылки и B2B2C

Один URL приложения = один «сайт» платформы. Все заведения работают на **одном** URL платформы; у каждого заведения может быть свой бот (и своя ссылка t.me/...). Отдельных доменов под каждое заведение нет.

**Ссылки в системе:**

| Что | Назначение |
|-----|------------|
| **URL платформы** (один) | Где открывается mini app и где крутится бэкенд (APP_URL / NEXTAUTH_URL / VERCEL_URL). Пример: `https://your-app.vercel.app`. |
| **Ссылка на бота** | `https://t.me/<bot>?startapp=<start>` — открывает Telegram-бота; по кнопке «Открыть приложение» открывается тот же URL платформы (mini app). |
| **Webhook URL** | `https://<URL платформы>/api/telegram/webhook` — сюда Telegram шлёт события (например /start). Один endpoint на всё приложение. |

**Соответствие B2B2C:**

- **MOO** = одна платформа (один код, один деплой, один URL).
- **B (заведения)** = клиенты платформы: у каждого может быть свой бот и свой `startParam` (BotIntegration); все открывают тот же URL приложения, контекст заведения — по startParam / cookie.
- **C (гости)** = заходят в то же приложение (тот же URL): из бота заведения или по ссылке; видят меню/заказы того заведения, в контексте которого открыли.

Сейчас один деплой = одна платформа; «отдельная ссылка» у заведения = ссылка на его бота (t.me/...), а не отдельный домен. Mini app у всех открывается на одном URL платформы.

## Архитектурные принципы

### 1. Feature-Based Structure
Каждая функциональность приложения организована в отдельную папку `features/`, что обеспечивает:
- Модульность и переиспользуемость
- Легкость поддержки и тестирования
- Четкое разделение ответственности

### 2. Layered Architecture
Приложение разделено на слои:
- **Presentation Layer** (Components, Pages)
- **Business Logic Layer** (Services, API functions)
- **Data Access Layer** (Prisma, Database)

### 3. Separation of Concerns
- UI компоненты отделены от бизнес-логики
- API routes отделены от компонентов
- Типы определены централизованно

## Структура директорий

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # Backend API Routes
│   ├── (routes)/          # Frontend Routes
│   ├── layout.tsx         # Root Layout
│   └── page.tsx           # Home Page
│
├── components/            # Shared UI Components
│   ├── ui/               # Reusable UI elements
│   ├── layout/           # Layout components
│   └── providers.tsx     # Context providers
│
├── features/             # Feature Modules
│   ├── menu/
│   ├── cart/
│   ├── orders/
│   ├── subscriptions/
│   ├── profile/
│   └── payment/
│
├── lib/                  # Core Libraries & Config
│   ├── prisma.ts        # Database client
│   ├── auth.ts          # Auth configuration
│   └── utils.ts         # Utilities
│
├── store/               # Global State
│   └── cart-store.ts    # Cart state (Zustand)
│
└── types/              # TypeScript Types
    └── index.ts        # Shared types
```

## Детальное описание модулей

### 1. App Router (`src/app/`)

#### API Routes (`src/app/api/`)
Backend endpoints, обрабатывающие HTTP запросы:

- **Аутентификация**: `/api/auth/[...nextauth]`
  - Использует NextAuth.js для управления сессиями
  - Поддерживает credentials и OAuth провайдеры

- **Меню**: `/api/dishes`, `/api/categories`
  - CRUD операции для блюд и категорий
  - Фильтрация и пагинация

- **Заказы**: `/api/orders`
  - Создание, чтение, обновление заказов
  - Проверка авторизации

- **Подписки**: `/api/subscriptions`
  - Управление подписками
  - Планирование доставок

- **Платежи**: `/api/payment/`
  - Создание платежных интентов (Stripe)
  - Webhook для обработки платежей

#### Pages (`src/app/`)
Frontend страницы:
- `(auth)/signin`, `(auth)/signup` - Аутентификация
- `menu/` - Каталог блюд
- `cart/` - Корзина
- `orders/` - История заказов
- `orders/[id]` - Детали заказа
- `subscriptions/` - Управление подписками
- `subscriptions/new` - Создание подписки
- `profile/` - Личный кабинет

### 2. Features (`src/features/`)

Каждая фича содержит:

#### menu/
```typescript
menu/
├── components/
│   ├── DishCard.tsx          # Карточка блюда
│   ├── CategoryFilter.tsx    # Фильтр категорий
│   └── DishModal.tsx         # Модальное окно с деталями
├── api/
│   └── get-dishes.ts         # Функции для получения данных
└── hooks/
    └── use-menu.ts           # Custom hooks
```

#### cart/
```typescript
cart/
├── components/
│   ├── CartItem.tsx          # Элемент корзины
│   ├── CartSummary.tsx       # Итоги корзины
│   └── CartDrawer.tsx        # Выдвижная корзина
└── hooks/
    └── use-cart.ts           # Хук для работы с корзиной
```

#### orders/
```typescript
orders/
├── components/
│   ├── OrderCard.tsx         # Карточка заказа
│   ├── OrderStatusBadge.tsx  # Бейдж статуса
│   └── OrderTimeline.tsx     # Таймлайн заказа
├── api/
│   ├── create-order.ts       # Создание заказа
│   └── get-orders.ts         # Получение заказов
└── hooks/
    └── use-orders.ts
```

#### subscriptions/
```typescript
subscriptions/
├── components/
│   ├── SubscriptionCard.tsx  # Карточка подписки
│   ├── SubscriptionForm.tsx  # Форма создания/редактирования
│   └── DeliverySchedule.tsx  # Расписание доставок
├── api/
│   ├── create-subscription.ts
│   ├── update-subscription.ts
│   └── cancel-subscription.ts
└── services/
    └── schedule-delivery.ts  # Логика планирования доставок
```

#### profile/
```typescript
profile/
├── components/
│   ├── ProfileForm.tsx       # Форма профиля
│   ├── AddressList.tsx       # Список адресов
│   └── AddressForm.tsx       # Форма адреса
└── api/
    └── update-profile.ts
```

#### payment/
```typescript
payment/
├── components/
│   ├── PaymentForm.tsx       # Форма оплаты
│   └── PaymentStatus.tsx     # Статус платежа
└── services/
    └── stripe.ts             # Интеграция со Stripe
```

### 3. Components (`src/components/`)

#### UI Components (`components/ui/`)
Переиспользуемые UI элементы:
- `Button.tsx`
- `Input.tsx`
- `Card.tsx`
- `Modal.tsx`
- `Badge.tsx`
- и т.д.

#### Layout Components (`components/layout/`)
- `Header.tsx` - Шапка сайта
- `Footer.tsx` - Подвал
- `Navigation.tsx` - Навигация
- `Sidebar.tsx` - Боковая панель

### 4. Lib (`src/lib/`)

#### prisma.ts
Singleton экземпляр Prisma Client с оптимизацией для Next.js

#### auth.ts
Конфигурация NextAuth.js:
- Провайдеры аутентификации
- Callbacks для сессий
- Страницы авторизации

#### utils.ts
Вспомогательные функции:
- Форматирование дат
- Форматирование цен
- Валидация

### 5. Store (`src/store/`)

Глобальное состояние через Zustand:
- `cart-store.ts` - Состояние корзины (items, total, methods)

### 6. Types (`src/types/`)

Централизованные TypeScript типы:
- `User`, `Dish`, `Order`, `Subscription`
- `OrderStatus`, `PaymentStatus`
- И другие общие типы

## Поток данных

### Создание заказа

```
User Action (Cart Page)
  ↓
Cart Component → useCart hook
  ↓
POST /api/orders
  ↓
API Route Handler
  ↓
Prisma → Database (Create Order)
  ↓
Stripe → Create Payment Intent
  ↓
Response → Update Cart Store
  ↓
Redirect to Payment/Order Success
```

### Создание подписки

```
User Action (Subscription Form)
  ↓
SubscriptionForm Component
  ↓
POST /api/subscriptions
  ↓
API Route Handler
  ↓
Prisma → Create Subscription
  ↓
Schedule Service → Plan Deliveries
  ↓
Stripe → Create Recurring Payment
  ↓
Response → Redirect to Subscriptions List
```

## База данных

### Основные таблицы

1. **User** - Пользователи системы
2. **Category** - Категории блюд
3. **Dish** - Блюда (связь с Category)
4. **Cart/CartItem** - Корзина пользователя
5. **Order/OrderItem** - Заказы
6. **Subscription/SubscriptionItem** - Подписки
7. **SubscriptionDelivery** - Запланированные доставки
8. **Address** - Адреса доставки

### Связи

- User → Orders (1:N)
- User → Subscriptions (1:N)
- User → Addresses (1:N)
- User → Cart (1:1)
- Order → OrderItems (1:N)
- Subscription → SubscriptionItems (1:N)
- Subscription → SubscriptionDeliveries (1:N)

## Безопасность

### Аутентификация
- NextAuth.js с JWT сессиями
- Хеширование паролей (bcrypt)
- Защита API routes через middleware

### Авторизация
- Проверка сессии в API routes
- Проверка прав доступа (user owns resource)

### Платежи
- Stripe для обработки платежей
- Webhook для подтверждения платежей
- Безопасное хранение payment intent ID

### Валидация
- Zod для валидации данных
- TypeScript для type safety
- Prisma для database validation

## Масштабируемость

### Горизонтальное масштабирование
- Stateless API routes
- Shared database (PostgreSQL)
- Session storage (JWT, можно заменить на Redis)

### Производительность
- Next.js автоматическая оптимизация
- Image optimization (next/image)
- API route caching где возможно
- Database indexes на часто запрашиваемые поля

### Расширяемость
- Feature-based структура упрощает добавление новых функций
- Модульная архитектура
- Легко добавлять новые API endpoints
- Простое добавление новых интеграций

## Тестирование (рекомендации)

Рекомендуемая структура тестов:
```
src/
├── features/
│   └── orders/
│       ├── components/
│       ├── api/
│       └── __tests__/      # Unit тесты
└── __tests__/              # Integration тесты
```

## Мониторинг и логирование

Рекомендуется добавить:
- Error tracking (Sentry)
- Analytics (Google Analytics, Plausible)
- Performance monitoring
- Database query logging (Prisma)

## CI/CD

Рекомендуемый pipeline:
1. Lint проверка
2. TypeScript проверка
3. Unit тесты
4. Build проверка
5. Deploy (Vercel/Railway)

## Заключение

Архитектура UFO Delivery спроектирована для:
- ✅ Масштабируемости
- ✅ Поддерживаемости
- ✅ Тестируемости
- ✅ Производительности
- ✅ Безопасности

Следование этой архитектуре обеспечит стабильную работу приложения и упростит дальнейшую разработку.




