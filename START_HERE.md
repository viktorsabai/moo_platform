# 🚀 ПОШАГОВАЯ ИНСТРУКЦИЯ ПО ЗАПУСКУ UFO Delivery

## Шаг 1: Установка зависимостей ✅

Зависимости уже установлены! Если нужно переустановить:
```bash
npm install
```

---

## Шаг 2: Настройка базы данных

### 2.1 Установите PostgreSQL (если еще не установлен)

**На Mac:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Или скачайте с официального сайта:** https://www.postgresql.org/download/

### 2.2 Создайте базу данных

Откройте терминал и выполните:
```bash
# Войти в PostgreSQL
psql postgres

# В консоли PostgreSQL выполнить:
CREATE DATABASE ufo_delivery;
\q  # Выйти из PostgreSQL
```

### 2.3 Настройте переменные окружения

Создайте файл `.env` в корне проекта (рядом с `package.json`):

```bash
# В терминале выполните:
touch .env
```

Откройте файл `.env` и вставьте следующее (замените на свои данные):

```env
# База данных (замените username и password на свои!)
DATABASE_URL="postgresql://username:password@localhost:5432/ufo_delivery?schema=public"

# NextAuth секрет (сгенерируйте случайную строку)
NEXTAUTH_SECRET="ваш-случайный-секрет-здесь"
NEXTAUTH_URL="http://localhost:3000"

# Stripe (можно настроить позже, оставьте пустым для начала)
STRIPE_PUBLIC_KEY=""
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""

# Telegram (нужно для авторизации через telegram mini app)
BOT_TOKEN="123456:ABCDEF..."

# URL приложения
APP_URL="http://localhost:3000"
```

**Как сгенерировать NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

Или используйте любой онлайн генератор случайных строк.

---

## Шаг 3: Запуск миграций базы данных

```bash
# Сгенерировать Prisma Client
npx prisma generate

# Создать таблицы в базе данных
npx prisma migrate dev --name init
```

Если всё прошло успешно, вы увидите сообщение о том, что миграция создана.

---

## Шаг 4: Запуск приложения

### Режим разработки (development)

```bash
npm run dev
```

Приложение запустится на: **http://localhost:3000**

Откройте браузер и перейдите по этому адресу. Вы должны увидеть главную страницу!

---

## Шаг 5: Что делать дальше?

### Посмотреть базу данных
```bash
npx prisma studio
```
Откроется веб-интерфейс для просмотра и редактирования данных.

### Остановить сервер
Нажмите `Ctrl + C` в терминале, где запущен `npm run dev`

---

## ❌ Решение проблем

### Ошибка: "Cannot connect to database"
- Убедитесь, что PostgreSQL запущен: `brew services list` (Mac) или проверьте службы (Windows)
- Проверьте, что DATABASE_URL в `.env` правильный
- Проверьте логин и пароль в DATABASE_URL

### Ошибка: "Module not found"
```bash
# Удалите node_modules и переустановите
rm -rf node_modules package-lock.json
npm install
```

### Ошибка: "Port 3000 already in use"
Используйте другой порт:
```bash
PORT=3001 npm run dev
```

### Ошибка TypeScript
```bash
# Проверьте ошибки типов
npm run type-check
```

---

## 📝 Основные команды

```bash
# Запуск в режиме разработки
npm run dev

# Сборка для продакшена
npm run build

# Запуск продакшен версии
npm start

# Проверка типов
npm run type-check

# Линтинг кода
npm run lint

# Открыть Prisma Studio
npx prisma studio

# Создать новую миграцию БД
npx prisma migrate dev --name название_миграции
```

---

## 🎯 Быстрый старт (минимум для запуска)

Если вы хотите просто запустить приложение БЕЗ базы данных (для начала):

1. Установите зависимости: `npm install` ✅ (уже сделано)
2. Запустите: `npm run dev`
3. Откройте: http://localhost:3000

**НО:** для полной функциональности (заказы, подписки, авторизация) нужна база данных!

---

## 📞 Нужна помощь?

Если что-то не работает:
1. Проверьте, что все зависимости установлены
2. Убедитесь, что PostgreSQL запущен
3. Проверьте файл `.env` - все переменные заполнены?
4. Попробуйте удалить `.next` папку и перезапустить: `rm -rf .next && npm run dev`




