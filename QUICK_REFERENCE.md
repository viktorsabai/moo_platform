# Краткая справка - UFO Delivery

## Структура проекта

```
UFO_Delivery/
├── prisma/schema.prisma          # База данных
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # Backend API
│   │   └── [pages]/              # Frontend страницы
│   ├── components/               # Общие компоненты
│   ├── features/                 # Модули функционала
│   ├── lib/                      # Утилиты
│   ├── store/                    # Глобальное состояние
│   └── types/                    # TypeScript типы
└── [config files]                # Конфигурация
```

## Основные команды

```bash
# Установка
npm install

# Разработка
npm run dev

# Сборка
npm run build

# Продакшен
npm start

# База данных
npx prisma migrate dev           # Создать миграцию
npx prisma studio                # Открыть Prisma Studio
npx prisma generate              # Сгенерировать Prisma Client

# Проверка кода
npm run lint                     # Линтинг
npm run type-check               # Проверка типов
```

## Основные API endpoints

### Публичные
- `GET /api/dishes` - Список блюд
- `GET /api/categories` - Категории
- `GET /api/dishes/:id` - Блюдо по ID

### Требуют авторизации
- `GET /api/orders` - Заказы пользователя
- `POST /api/orders` - Создать заказ
- `GET /api/subscriptions` - Подписки пользователя
- `POST /api/subscriptions` - Создать подписку
- `POST /api/payment/intent` - Создать платеж

## Модели базы данных

Основные таблицы:
- `User` - Пользователи
- `Category` - Категории
- `Dish` - Блюда
- `Cart`, `CartItem` - Корзина
- `Order`, `OrderItem` - Заказы
- `Subscription`, `SubscriptionItem` - Подписки
- `SubscriptionDelivery` - Доставки подписок
- `Address` - Адреса

## Feature modules

### menu/
Каталог блюд, фильтрация, поиск

### cart/
Корзина, управление товарами

### orders/
Оформление и отслеживание заказов

### subscriptions/
Регулярные доставки по подписке

### profile/
Профиль пользователя, адреса

### payment/
Интеграция со Stripe

## Переменные окружения

```env
# База данных
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."

# Stripe
STRIPE_PUBLIC_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

## Технологии

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL + Prisma
- **Auth**: NextAuth.js
- **Payments**: Stripe
- **State**: Zustand
- **Forms**: React Hook Form + Zod

## Документация

- `README.md` - Общая информация о проекте
- `ARCHITECTURE.md` - Детальное описание архитектуры
- `PROJECT_STRUCTURE.md` - Полная структура файлов
- `FEATURES.md` - Описание функционала
- `GETTING_STARTED.md` - Руководство по началу работы
- `QUICK_REFERENCE.md` - Этот файл (краткая справка)

## Workflow разработки

1. Создать фичу в `src/features/[feature-name]/`
2. Добавить компоненты в `components/`
3. Создать API routes в `src/app/api/`
4. Обновить типы в `src/types/`
5. При необходимости создать миграции БД
6. Тестировать локально
7. Коммитить изменения

## Полезные ссылки

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)
- [Stripe Documentation](https://stripe.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)







