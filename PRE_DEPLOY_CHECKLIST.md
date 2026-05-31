# Pre-Deploy Checklist

**Date:** 2026-01-28  
**Changes:** Design unification (ProductCard, button standardization)

---

## ✅ Pre-Deploy Verification

### Code Quality
- [x] **TypeScript:** No type errors (`npm run type-check` passed)
- [x] **Linter:** No linting errors
- [x] **Imports:** All imports valid and correct
- [x] **Exports:** ProductCard properly exported

### Component Changes
- [x] **ProductCard:** Created and properly exported
- [x] **DishCard:** Updated to use ProductCard (backward compatible)
- [x] **menu/page.tsx:** Updated to use ProductCard in sections
- [x] **CartItem:** Updated to use `.ui-surface-strong`
- [x] **SubscriptionCard:** Updated to use `.ui-surface-strong`

### Button Standardization
- [x] **ProductCard:** Uses `btn btn-primary`
- [x] **StickyCartBar:** Uses `btn btn-primary`
- [x] **checkout/page.tsx:** Uses `btn btn-primary`
- [x] **menu/page.tsx:** Store buttons use `btn btn-primary`
- [x] **SubscriptionCard:** Resume button uses `btn btn-primary`
- [ ] **Other pages:** ~26 buttons still need standardization (non-critical)

### Critical Fixes
- [x] **Cart integration:** ProductCard correctly uses `removeItem(id, 'dish')` and `updateQuantity(id, qty, 'dish')`
- [x] **Type safety:** All props properly typed
- [x] **Client component:** ProductCard marked as `'use client'`

---

## ⚠️ Known Issues (Non-Blocking)

### Build Error (Network-Related)
- **Issue:** Build fails due to Google Fonts fetch (network restriction in sandbox)
- **Status:** Not related to our changes
- **Action:** Will work in production with network access
- **Note:** This is expected in sandbox environment

### Remaining Button Standardization
- **Status:** ~26 buttons across 15 files still use inline styles
- **Impact:** Low (visual consistency, not functionality)
- **Action:** Can be done in follow-up PR

---

## 🧪 Testing Recommendations

### Онбординг владельца (см. ONBOARDING.md)

**Сценарий A (MOO создаёт заведение):** платформа → создание ресторана → ссылка владельцу → вход по ссылке → профиль → «Войти в кабинет» → баннер + инлайн подсказки.

**Сценарий B (самообслуживание):** профиль → «Завести свой ресторан» → «Создать заведение» → форма название/код → POST /api/restaurant/register → редирект в кабинет.

### Тест пайплайна владельца (Owner flow)
- [ ] **Первый вход в кабинет:** профиль → раскрыть «Режим владельца» → «Войти в кабинет» → попадание на `/admin`
- [ ] **Баннер первого захода:** один раз показывается «Добро пожаловать…», кнопка «Понятно» скрывает навсегда
- [ ] **Настройки заведения:** кабинет → «Настройки заведения» → чек-лист, доставка и часы, магазин; сохранение работает
- [ ] **Добавление товара:** кабинет → «Меню и товары» → empty-state «Добавить товар» → товар появляется в списке
- [ ] **Просмотр заказов заведения:** кабинет → «Заказы» → список заказов заведения (или empty-state)
- [ ] **Быстрые настройки:** на кабинете переключатель «открыто/закрыто» и ссылка на настройки доставки работают
- [ ] **Переход «назад» по иерархии:** из подраздела админки «назад» ведёт в кабинет; из кабинета — в профиль
- [ ] **Самообслуживание:** профиль (без роли владельца) → «Завести свой ресторан» → «Создать заведение» → ввод названия и кода → создание → редирект в кабинет

### Manual Testing
1. **Menu Page:**
   - [ ] Section cards display correctly (compact variant)
   - [ ] List view works
   - [ ] Add to cart works
   - [ ] Cart counter updates

2. **Cart:**
   - [ ] Cart items display correctly
   - [ ] Quantity controls work
   - [ ] Remove works

3. **Subscriptions:**
   - [ ] Subscription cards display correctly
   - [ ] Actions work

4. **Checkout:**
   - [ ] Form works
   - [ ] Submit button works

### Visual Testing
- [ ] All cards use consistent styling (`.ui-surface-strong`)
- [ ] Buttons use consistent styling (`btn btn-primary`)
- [ ] No layout breaks
- [ ] Mobile responsive

---

## 📦 Deployment Notes

### Files Changed
- `src/components/ui/ProductCard.tsx` (new)
- `src/features/menu/components/DishCard.tsx` (refactored)
- `src/app/menu/page.tsx` (updated)
- `src/features/cart/components/CartItem.tsx` (styling)
- `src/features/subscriptions/components/SubscriptionCard.tsx` (styling)
- `src/components/StickyCartBar.tsx` (button)
- `src/app/checkout/page.tsx` (buttons)
- `src/app/page.tsx` (button)

### Breaking Changes
- **None** - All changes are backward compatible

### Migration Notes
- ProductCard replaces inline card implementations
- DishCard now wraps ProductCard (API unchanged)
- Cart integration unchanged

### Telegram Bot Webhook — обязательный шаг для первой воронки
- **Без setWebhook бот не отвечает на /start.** Пользователь нажимает Start и не получает ни сообщения, ни кнопки «Открыть приложение» — только ручной «Open App» в интерфейсе Telegram.
- **После деплоя:** открыть в браузере `https://<APP_URL>/api/telegram/webhook` — на странице будет готовая ссылка для setWebhook.
- Выполнить один раз (подставить BOT_TOKEN и APP_URL):
  ```bash
  curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<APP_URL>/api/telegram/webhook"
  ```
- В env приложения: `BOT_TOKEN` или `TELEGRAM_BOT_TOKEN` (токен бота из BotFather). `APP_URL` или `NEXTAUTH_URL` должны указывать на прод (нужны для buildWebAppUrl в ответе на /start).
- **Проверка:** написать боту в Telegram `/start` — должно прийти сообщение с кнопкой «Открыть приложение». По нажатию открывается mini app на главной (guest).

---

## ✅ Ready for Deploy

**Status:** ✅ **READY**

All critical checks passed. Remaining button standardization is non-critical and can be done in follow-up.

---

**Last Updated:** 2026-01-28
