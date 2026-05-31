# Структура проекта UFO Delivery

## Полное дерево файлов

```
UFO_Delivery/
│
├── prisma/
│   └── schema.prisma              # Схема базы данных Prisma
│
├── public/                         # Статические файлы (изображения, иконки и т.д.)
│
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── api/                    # API Routes (Backend)
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts    # NextAuth API endpoint
│   │   │   ├── categories/
│   │   │   │   └── route.ts        # GET /api/categories
│   │   │   ├── dishes/
│   │   │   │   ├── route.ts        # GET /api/dishes
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts    # GET /api/dishes/:id
│   │   │   ├── orders/
│   │   │   │   ├── route.ts        # GET, POST /api/orders
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts    # GET, PATCH /api/orders/:id
│   │   │   ├── subscriptions/
│   │   │   │   ├── route.ts        # GET, POST /api/subscriptions
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts    # GET, PATCH, DELETE /api/subscriptions/:id
│   │   │   │       └── pause/
│   │   │   │           └── route.ts # POST /api/subscriptions/:id/pause
│   │   │   ├── payment/
│   │   │   │   ├── intent/
│   │   │   │   │   └── route.ts    # POST /api/payment/intent
│   │   │   │   └── webhook/
│   │   │   │       └── route.ts    # POST /api/payment/webhook (Stripe)
│   │   │   └── address/
│   │   │       ├── route.ts        # GET, POST /api/address
│   │   │       └── [id]/
│   │   │           └── route.ts    # PATCH, DELETE /api/address/:id
│   │   │
│   │   ├── (auth)/                 # Группа маршрутов для аутентификации
│   │   │   ├── signin/
│   │   │   │   └── page.tsx        # Страница входа
│   │   │   └── signup/
│   │   │       └── page.tsx        # Страница регистрации
│   │   │
│   │   ├── menu/                   # Страница меню
│   │   │   └── page.tsx
│   │   │
│   │   ├── cart/                   # Страница корзины
│   │   │   └── page.tsx
│   │   │
│   │   ├── checkout/               # Страница оформления заказа
│   │   │   └── page.tsx
│   │   │
│   │   ├── orders/                 # Страница заказов
│   │   │   ├── page.tsx            # Список заказов
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Детали заказа
│   │   │
│   │   ├── subscriptions/          # Страница подписок
│   │   │   ├── page.tsx            # Список подписок
│   │   │   ├── new/
│   │   │   │   └── page.tsx        # Создание подписки
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Детали подписки
│   │   │
│   │   ├── profile/                # Личный кабинет
│   │   │   ├── page.tsx            # Профиль пользователя
│   │   │   └── addresses/
│   │   │       └── page.tsx        # Управление адресами
│   │   │
│   │   ├── layout.tsx              # Корневой layout
│   │   ├── page.tsx                # Главная страница
│   │   └── globals.css             # Глобальные стили
│   │
│   ├── components/                 # Общие компоненты
│   │   ├── ui/                     # Переиспользуемые UI компоненты
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Spinner.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/                 # Компоненты макета
│   │   │   ├── Header.tsx          # Шапка сайта
│   │   │   ├── Footer.tsx          # Подвал
│   │   │   ├── Navigation.tsx      # Навигация
│   │   │   ├── Sidebar.tsx         # Боковая панель
│   │   │   └── MobileMenu.tsx      # Мобильное меню
│   │   │
│   │   └── providers.tsx           # Провайдеры (Session, Toast и т.д.)
│   │
│   ├── features/                   # Feature-based модули
│   │   │
│   │   ├── menu/                   # Модуль меню
│   │   │   ├── components/
│   │   │   │   ├── DishCard.tsx    # Карточка блюда
│   │   │   │   ├── DishModal.tsx   # Модальное окно блюда
│   │   │   │   ├── CategoryFilter.tsx
│   │   │   │   └── SearchBar.tsx
│   │   │   ├── api/
│   │   │   │   ├── get-dishes.ts
│   │   │   │   └── get-categories.ts
│   │   │   └── hooks/
│   │   │       └── use-menu.ts
│   │   │
│   │   ├── cart/                   # Модуль корзины
│   │   │   ├── components/
│   │   │   │   ├── CartItem.tsx
│   │   │   │   ├── CartSummary.tsx
│   │   │   │   ├── CartDrawer.tsx  # Выдвижная корзина
│   │   │   │   └── CartIcon.tsx    # Иконка корзины с количеством
│   │   │   └── hooks/
│   │   │       └── use-cart.ts
│   │   │
│   │   ├── orders/                 # Модуль заказов
│   │   │   ├── components/
│   │   │   │   ├── OrderCard.tsx
│   │   │   │   ├── OrderStatusBadge.tsx
│   │   │   │   ├── OrderTimeline.tsx
│   │   │   │   └── OrderItem.tsx
│   │   │   ├── api/
│   │   │   │   ├── create-order.ts
│   │   │   │   ├── get-orders.ts
│   │   │   │   └── get-order.ts
│   │   │   └── hooks/
│   │   │       └── use-orders.ts
│   │   │
│   │   ├── subscriptions/          # Модуль подписок
│   │   │   ├── components/
│   │   │   │   ├── SubscriptionCard.tsx
│   │   │   │   ├── SubscriptionForm.tsx
│   │   │   │   ├── DeliverySchedule.tsx
│   │   │   │   └── SubscriptionActions.tsx
│   │   │   ├── api/
│   │   │   │   ├── create-subscription.ts
│   │   │   │   ├── update-subscription.ts
│   │   │   │   ├── cancel-subscription.ts
│   │   │   │   └── pause-subscription.ts
│   │   │   ├── services/
│   │   │   │   └── schedule-delivery.ts  # Логика планирования доставок
│   │   │   └── hooks/
│   │   │       └── use-subscriptions.ts
│   │   │
│   │   ├── profile/                # Модуль профиля
│   │   │   ├── components/
│   │   │   │   ├── ProfileForm.tsx
│   │   │   │   ├── AddressList.tsx
│   │   │   │   ├── AddressForm.tsx
│   │   │   │   └── ProfileAvatar.tsx
│   │   │   └── api/
│   │   │       ├── update-profile.ts
│   │   │       └── update-address.ts
│   │   │
│   │   └── payment/                # Модуль платежей
│   │       ├── components/
│   │       │   ├── PaymentForm.tsx
│   │       │   ├── PaymentStatus.tsx
│   │       │   └── PaymentMethods.tsx
│   │       └── services/
│   │           └── stripe.ts       # Интеграция со Stripe
│   │
│   ├── lib/                        # Утилиты и конфигурация
│   │   ├── prisma.ts               # Prisma client singleton
│   │   ├── auth.ts                 # NextAuth конфигурация
│   │   ├── utils.ts                # Общие утилиты
│   │   └── constants.ts            # Константы приложения
│   │
│   ├── store/                      # Глобальное состояние
│   │   └── cart-store.ts           # Zustand store для корзины
│   │
│   └── types/                      # TypeScript типы
│       ├── index.ts                # Общие типы
│       ├── next-auth.d.ts          # Расширение типов NextAuth
│       └── prisma.ts               # Сгенерированные типы Prisma
│
├── .env.example                    # Пример переменных окружения
├── .env.local                      # Локальные переменные (не в git)
├── .gitignore                      # Git ignore файл
├── .eslintrc.json                  # ESLint конфигурация
├── next.config.js                  # Next.js конфигурация
├── tsconfig.json                   # TypeScript конфигурация
├── tailwind.config.js              # Tailwind CSS конфигурация
├── postcss.config.js               # PostCSS конфигурация
├── package.json                    # Зависимости проекта
├── README.md                       # Документация проекта
├── ARCHITECTURE.md                 # Документация по архитектуре
└── PROJECT_STRUCTURE.md            # Этот файл
```

## Описание основных директорий

### `/prisma`
- `schema.prisma` - Описание схемы базы данных
- После миграций здесь будут создаваться файлы миграций

### `/src/app`
Директория Next.js App Router:
- `api/` - Backend API endpoints
- Страницы приложения (route groups для организации)

### `/src/components`
Общие компоненты, используемые по всему приложению:
- `ui/` - Базовые UI компоненты (кнопки, инпуты, карточки)
- `layout/` - Компоненты макета (header, footer, navigation)

### `/src/features`
Feature-based модули - каждая фича содержит все необходимое:
- `components/` - Компоненты, специфичные для фичи
- `api/` - Клиентские API функции
- `hooks/` - Custom React hooks
- `services/` - Бизнес-логика и сервисы

### `/src/lib`
Утилиты и конфигурация:
- Singleton экземпляры (Prisma client)
- Конфигурация библиотек (NextAuth)
- Вспомогательные функции

### `/src/store`
Глобальное состояние приложения (Zustand stores)

### `/src/types`
TypeScript типы и интерфейсы

## Принципы организации

1. **Feature-Based**: Каждая функциональность в своей папке
2. **Colocation**: Связанный код хранится рядом
3. **Separation of Concerns**: UI отделен от логики
4. **Reusability**: Общие компоненты в `/components`
5. **Type Safety**: Все типы определены централизованно

