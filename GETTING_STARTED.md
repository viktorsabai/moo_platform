# Быстрый старт - UFO Delivery

## Шаг 1: Установка зависимостей

```bash
npm install
```

## Шаг 2: Настройка базы данных

1. Создайте базу данных PostgreSQL:
```sql
CREATE DATABASE ufo_delivery;
```

2. Настройте переменные окружения:
```bash
cp .env.example .env
```

Откройте `.env` и укажите:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/ufo_delivery?schema=public"
NEXTAUTH_SECRET="generate-a-random-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

Для генерации `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

3. Запустите миграции:
```bash
npx prisma migrate dev --name init
```

4. (Опционально) Заполните базу тестовыми данными:
```bash
npx prisma db seed
```

## Шаг 3: Настройка Stripe (для платежей)

1. Зарегистрируйтесь на [Stripe](https://stripe.com)
2. Получите тестовые ключи в Dashboard
3. Добавьте в `.env`:
```env
STRIPE_PUBLIC_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."  # Для webhook
```

## Шаг 4: Запуск приложения

### Режим разработки
```bash
npm run dev
```

Приложение будет доступно по адресу: http://localhost:3000

### Сборка для продакшена
```bash
npm run build
npm start
```

## Шаг 5: Первый пользователь

Создайте первого пользователя через Prisma Studio:
```bash
npx prisma studio
```

Или через SQL:
```sql
INSERT INTO "User" (id, email, password, name, "createdAt", "updatedAt")
VALUES (
  'user_1',
  'admin@example.com',
  '$2a$10$hashedpassword',  -- Используйте bcrypt для хеширования
  'Admin',
  NOW(),
  NOW()
);
```

## Проверка работоспособности

1. Откройте http://localhost:3000
2. Проверьте API: http://localhost:3000/api/categories
3. Проверьте базу данных через Prisma Studio: `npx prisma studio`

## Следующие шаги

1. Создайте категории блюд
2. Добавьте блюда в каталог
3. Настройте адреса доставки
4. Протестируйте процесс заказа

## Полезные команды

```bash
# Проверка типов TypeScript
npm run type-check

# Линтинг
npm run lint

# Открыть Prisma Studio
npx prisma studio

# Создать новую миграцию
npx prisma migrate dev --name migration_name

# Сгенерировать Prisma Client
npx prisma generate

# Сброс базы данных (осторожно!)
npx prisma migrate reset
```

## Решение проблем

### Ошибка подключения к базе данных
- Проверьте, что PostgreSQL запущен
- Убедитесь, что DATABASE_URL правильный
- Проверьте права доступа пользователя БД

### Ошибки TypeScript
```bash
npm run type-check
```
Исправьте все ошибки типов перед запуском

### Проблемы с Prisma
```bash
npx prisma generate
npx prisma migrate dev
```

### Проблемы с NextAuth
- Проверьте NEXTAUTH_SECRET в .env
- Убедитесь, что NEXTAUTH_URL правильный







