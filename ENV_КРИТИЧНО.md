# Критичные переменные окружения

## Обзор

При деплое на Vercel build автоматически синхронизирует схему БД (`prisma db push`) и собирает приложение. Дополнительные шаги не нужны.

## DATABASE_URL

**Формат:** `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`

❌ **Неверно (вызовет "User denied access"):**
```
DATABASE_URL=postgresql://localhost:5432/postgres
```

✅ **Верно:**
```
DATABASE_URL=postgresql://postgres:pass@localhost:5432/postgres
```

Без `USER` и `PASSWORD` Prisma не сможет подключиться к БД — все API будут падать с 500.

## NEXTAUTH_SECRET

Нужен для авторизации. Без него возможны проблемы с сессией.

```
NEXTAUTH_SECRET=любая-случайная-строка-минимум-32-символа
```

Сгенерировать: `openssl rand -base64 32`

## NEXTAUTH_URL

Для локальной разработки:
```
NEXTAUTH_URL=http://localhost:3000
```

## ADMIN_LOGIN и ADMIN_PASSWORD

Для входа в кабинет из браузера (без Telegram). Задайте в Vercel → Settings → Environment Variables.

```
ADMIN_LOGIN=admin
ADMIN_PASSWORD=ваш_пароль
```
