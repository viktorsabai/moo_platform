# MOO Sprint 01 — рабочий ресторанный вертикальный срез

**Цель спринта:** довести один ресторанный контур до воспроизводимого E2E-сценария: владелец настраивает ресторан и меню, гость входит через Telegram Mini App, создаёт и оплачивает/подтверждает заказ, команда ресторана принимает и исполняет его, а гость получает актуальные статусы.

**Фокус:** один ресторан, один Telegram-бот, одна валюта, один основной платёжный метод, delivery как основной fulfilment. Pickup и подписки проверяются только если они входят в конкретный пилотный scope.

**Definition of Done спринта:** сценарий проходит на production-like окружении с реальными Telegram-аккаунтами и тестовым рестораном; повторная отправка не создаёт дубль; сумма и доставка пересчитываются сервером; роли ограничены; уведомления и статусы согласованы; есть backup/rollback и handoff runbook.

## Sprint epics

| Epic | Сквозной процесс | Приоритет | Результат |
|---|---|---:|---|
| E1 | Onboarding ресторана и Telegram-доступ | P0 | Ресторан и команда могут безопасно войти в правильный tenant |
| E2 | Настройка ресторана владельцем | P0 | Часы, открытость, delivery, payment и базовые настройки применяются гостю |
| E3 | Меню от загрузки до заказа | P0 | Владелец публикует актуальное меню, гость видит только заказуемые позиции |
| E4 | Guest checkout и создание заказа | P0 | Гость оформляет валидный заказ с серверной ценой и delivery quote |
| E5 | Payment/receipt до подтверждённого заказа | P0 | Оплата или чек имеет понятный state machine и owner action |
| E6 | Order operations ресторана | P0 | Команда принимает, готовит, передаёт и закрывает заказ |
| E7 | Telegram notifications и inbox | P0 | Гость и команда получают корректные события без критических дублей |
| E8 | Доступы, роли и безопасность tenant | P0 | Пользователь видит только разрешённые ресторан и действия |
| E9 | Поддержка, observability и recovery | P0 | Инцидент диагностируется, данные восстанавливаются, есть ручной fallback |
| E10 | CRM, кампании и визиты | P1 | Ресторан может безопасно вернуть гостя без спам-риска |
| E11 | Подписки/Lunch Pass | P1 | Подписка проходит отдельный E2E beta-flow без смешения с MVP-заказом |
| E12 | B2B multi-tenant scale | P2 | Несколько ресторанов изолированы и onboarding повторяем |

## E1. Onboarding ресторана и Telegram-доступ

### Пользователь/гость

| ID | Задача | Acceptance criteria |
|---|---|---|
| E1-G1 | Открытие Mini App из `/start` | Бот отвечает кнопкой открытия приложения; открывается правильный ресторан |
| E1-G2 | Telegram auth | Валидный `initData` создаёт сессию; пустой/поддельный initData не авторизует |
| E1-G3 | Первый вход | Гость видит ресторан, а не default/fallback-данные другого tenant |
| E1-G4 | Повторный вход | Сессия и пользовательские данные сохраняются после refresh/re-entry |

### Владелец/команда

| ID | Задача | Acceptance criteria |
|---|---|---|
| E1-O1 | Создание/выбор ресторана | Ресторан имеет стабильный ID, slug, active state и owner membership |
| E1-O2 | Подключение бота | BotIntegration привязан к restaurant и startParam; webhook проверен |
| E1-O3 | Приглашение команды | OWNER создаёт invite, сотрудник принимает его через Telegram, membership появляется один раз |
| E1-O4 | Первый вход в кабинет | Владелец попадает в `/admin` нужного ресторана без stale-ID lockout |

### Platform/DB/QA

| ID | Задача | Acceptance criteria |
|---|---|---|
| E1-P1 | Environment matrix | BOT_TOKEN, APP_URL, NEXTAUTH_URL, DB и payment secrets проверены |
| E1-P2 | Webhook verification | setWebhook, status check и smoke `/start` документированы |
| E1-P3 | Tenant context test | Нет доступа к меню/order/admin другого restaurantId |
| E1-P4 | Auth negative tests | Подмена initData, неизвестный startParam и disabled restaurant отклоняются |

## E2. Настройка ресторана владельцем

### Пользователь/гость

| ID | Задача | Acceptance criteria |
|---|---|---|
| E2-G1 | Open/closed state | Закрытый ресторан не принимает новый заказ и показывает объяснение |
| E2-G2 | Часы работы | Гость видит корректное состояние по timezone ресторана |
| E2-G3 | Delivery/pickup presentation | Доступные способы fulfilment соответствуют настройкам ресторана |

### Владелец/команда

| ID | Задача | Acceptance criteria |
|---|---|---|
| E2-O1 | Профиль ресторана | Название, описание, адрес, contacts и часы сохраняются в БД |
| E2-O2 | Delivery zones | Зона, fee, min order и window создаются/редактируются/выключаются |
| E2-O3 | Payment methods | Включён только проверенный пилотный метод; unavailable methods не показываются гостю |
| E2-O4 | Quick toggles | Open/closed и delivery shortcut работают из dashboard |

### Platform/DB/QA

| ID | Задача | Acceptance criteria |
|---|---|---|
| E2-P1 | Settings consistency | После сохранения guest API получает те же значения без stale cache |
| E2-P2 | Delivery quote contract | Одинаковая формула используется в preview, checkout и create order |
| E2-P3 | Timezone test | Граница рабочего окна и следующий день проверены |

## E3. Меню от загрузки до заказа

### Пользователь/гость

| ID | Задача | Acceptance criteria |
|---|---|---|
| E3-G1 | Категории и поиск | Гость находит доступную позицию и видит корректное описание/цену |
| E3-G2 | Modifiers | Обязательные и необязательные опции валидируются до корзины и на сервере |
| E3-G3 | Stale cart | Недоступная или изменившая цену позиция блокирует checkout с понятным сообщением |

### Владелец/команда

| ID | Задача | Acceptance criteria |
|---|---|---|
| E3-O1 | CSV import | Реальное меню импортируется без потери category/name/slug/price/tags |
| E3-O2 | Фото и контент | Фото, emoji, description и allergens отображаются в guest app |
| E3-O3 | Availability/stop-list | Владелец выключает позицию, она становится недоступной на всём пути |
| E3-O4 | Menu publish check | Перед открытием ресторана есть проверка пустых категорий, нулевых цен и дублей slug |

### Platform/DB/QA

| ID | Задача | Acceptance criteria |
|---|---|---|
| E3-P1 | Trusted pricing | Цена и доступность берутся сервером из БД, client total не является source of truth |
| E3-P2 | Menu version/health | Можно проверить версию меню и критические проблемы |
| E3-P3 | Import rollback | Ошибочный импорт не оставляет частично повреждённое меню |

## E4. Guest checkout и создание заказа

### Пользователь/гость

| ID | Задача | Acceptance criteria |
|---|---|---|
| E4-G1 | Address/fulfilment | Гость выбирает address или pickup согласно настройкам ресторана |
| E4-G2 | Delivery quote | Показываются fee, minimum order и delivery window до submit |
| E4-G3 | Submit order | Гость видит order confirmation и понятный payment status |
| E4-G4 | Retry/refresh | Повторный submit возвращает существующий order, а не создаёт новый |

### Владелец/команда

| ID | Задача | Acceptance criteria |
|---|---|---|
| E4-O1 | Order inbox | Новый заказ появляется в кабинете с customer, items, total, fulfilment и payment status |
| E4-O2 | Data correction visibility | Ошибка цены, зоны или payment status видна оператору и не маскируется |
| E4-O3 | Manual fallback | Владелец знает, как принять заказ через Telegram/телефон при сбое Mini App |

### Platform/DB/QA

| ID | Задача | Acceptance criteria |
|---|---|---|
| E4-P1 | Server totals | Subtotal, discount, delivery fee и total пересчитываются сервером |
| E4-P2 | Idempotency | `clientRequestId` защищает от duplicate order при повторе |
| E4-P3 | Transaction boundary | Order, items, address snapshot и initial payment state создаются согласованно |
| E4-P4 | Abuse limits | Размер корзины, quantity, notes и request rate имеют безопасные лимиты |

## E5. Payment/receipt до подтверждённого заказа

### Пользователь/гость

| ID | Задача | Acceptance criteria |
|---|---|---|
| E5-G1 | Payment instruction | Гость получает точные реквизиты/QR и сумму к оплате |
| E5-G2 | Receipt upload | Чек прикрепляется к конкретному заказу, формат/размер валидируются |
| E5-G3 | Payment status | Гость видит pending/confirmed/rejected и следующий шаг |
| E5-G4 | Retry | После reject можно повторить действие без создания второго заказа |

### Владелец/команда

| ID | Задача | Acceptance criteria |
|---|---|---|
| E5-O1 | Payment inbox | Оператор видит заказы, ожидающие оплаты/чека |
| E5-O2 | Confirm/reject | Подтверждение или отклонение фиксируется с actor и timestamp |
| E5-O3 | Stripe/QR scope | В пилоте включён только реально проверенный method; остальные выключены |

### Platform/DB/QA

| ID | Задача | Acceptance criteria |
|---|---|---|
| E5-P1 | Payment state machine | Нет перехода в confirmed без валидного payment event/owner action |
| E5-P2 | Webhook idempotency | Повторный payment webhook безопасен |
| E5-P3 | Receipt security | Upload не раскрывает чужие чеки и имеет ограничение type/size |
| E5-P4 | Audit log | Денежные изменения и payment decisions логируются |

## E6. Order operations ресторана

### Пользователь/гость

| ID | Задача | Acceptance criteria |
|---|---|---|
| E6-G1 | Status timeline | Гость видит только фактические статусы и время обновления |
| E6-G2 | Cancellation/error | Отмена или невозможность исполнения показывается с понятным next step |
| E6-G3 | Delivered confirmation | Финальный статус закрывает customer journey |

### Владелец/команда

| ID | Задача | Acceptance criteria |
|---|---|---|
| E6-O1 | Status actions | Разрешены только корректные переходы `PENDING → CONFIRMED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED` и CANCELLED |
| E6-O2 | Role actions | Кухня/курьер/менеджер получают только нужные действия |
| E6-O3 | SLA inbox | Просроченные заказы заметны и имеют owner action |
| E6-O4 | Exception handling | Отмена, отсутствие позиции, возврат и ручная корректировка имеют процедуру |

### Platform/DB/QA

| ID | Задача | Acceptance criteria |
|---|---|---|
| E6-P1 | Transition guard | Нельзя перескочить или откатить статус без разрешённого действия |
| E6-P2 | Status log | Каждое изменение содержит actor, previous/new status и timestamp |
| E6-P3 | Notification event | Статус и уведомление не расходятся при retry/error |
| E6-P4 | Concurrency | Два оператора не ломают status state при одновременном action |

## E7. Telegram notifications и inbox

### Пользователь/гость

| ID | Задача | Acceptance criteria |
|---|---|---|
| E7-G1 | Order notifications | Гость получает создание, подтверждение, подготовку, delivery и финальный статус |
| E7-G2 | Deep link | Кнопка уведомления открывает нужный order/subscription/section |
| E7-G3 | Opt-out/error | Ошибка Telegram не блокирует сохранение заказа и отображается в мониторинге |

### Владелец/команда

| ID | Задача | Acceptance criteria |
|---|---|---|
| E7-O1 | Owner notifications | Команда получает новый заказ и payment/subscription lead |
| E7-O2 | Inbox task states | Inbox показывает unread/handled и не теряет P0-события |
| E7-O3 | Manual scenario | Scenario messages требуют confirmation и видят recipient context |

### Platform/DB/QA

| ID | Задача | Acceptance criteria |
|---|---|---|
| E7-P1 | Notification registry | Каждое событие имеет trigger, recipient, template и fallback |
| E7-P2 | Dedupe/retry | Retry не порождает бесконечные дубли; ошибки видны |
| E7-P3 | Anti-spam | Для массовых сценариев есть cooldown, daily cap и kill switch |

## E8. Доступы, роли и tenant security

### Пользователь/гость

| ID | Задача | Acceptance criteria |
|---|---|---|
| E8-G1 | Own data only | Гость видит только свои addresses, orders, subscriptions и receipts |
| E8-G2 | Order access | Нельзя открыть чужой order по ID или URL |

### Владелец/команда

| ID | Задача | Acceptance criteria |
|---|---|---|
| E8-O1 | Role matrix | Права OWNER/ADMIN/STAFF и операционных ролей документированы |
| E8-O2 | Team lifecycle | Invite, accept, revoke и повторное приглашение работают предсказуемо |
| E8-O3 | Restaurant switch | При смене ресторана контекст и данные обновляются атомарно |

### Platform/DB/QA

| ID | Задача | Acceptance criteria |
|---|---|---|
| E8-P1 | API authorization sweep | Каждый `/api/admin/*`, owner и platform endpoint проверяет context/role |
| E8-P2 | Cross-tenant tests | Запрос с чужим restaurantId возвращает 403/404 и не меняет данные |
| E8-P3 | Secret hygiene | Token/secret не попадает в клиент, логи и error responses |

## E9. Поддержка, observability и recovery

### Пользователь/гость

| ID | Задача | Acceptance criteria |
|---|---|---|
| E9-G1 | Error UX | Ошибка не оставляет гостя в тупике; есть повтор/контакт ресторана |
| E9-G2 | Offline-like recovery | После network error пользователь понимает, сохранён ли заказ |

### Владелец/команда

| ID | Задача | Acceptance criteria |
|---|---|---|
| E9-O1 | Daily health check | Владелец видит version, menu health, webhook/payment health |
| E9-O2 | Incident runbook | Есть fallback на телефон/Telegram и escalation contact |
| E9-O3 | Backup drill | Команда знает, когда и как восстановить данные |

### Platform/DB/QA

| ID | Задача | Acceptance criteria |
|---|---|---|
| E9-P1 | Correlation IDs | Ошибка связывается с request/order/user без утечки PII |
| E9-P2 | Error monitoring | API/client/webhook/payment failures доступны технической команде |
| E9-P3 | Backup/restore | Restore проверен на отдельной БД и документирован |
| E9-P4 | CI gates | type-check, lint, build и smoke checks проходят до deploy |

## P1/P2 расширения

**E10 CRM, кампании и визиты** закрывается сквозным процессом «заказ создаёт визит → владелец видит сегмент → создаёт кампанию → гость получает сообщение → click/conversion сохраняется». Внутри отдельно проходят guest consent/opt-out и owner campaign targeting, а на платформенном уровне — cooldown, daily cap, аудит и остановка рассылки.

**E11 Подписки/Lunch Pass** закрывается процессом «владелец создаёт plan → гость видит offer → выбирает расписание и рацион → платит → система создаёт deliveries → кухня видит подготовку → гость получает delivery status». До отдельного UAT этот эпик не следует смешивать с основным одноразовым заказом.

**E12 B2B multi-tenant scale** закрывается процессом «создание ресторана → подключение bot/startParam → owner onboarding → импорт меню → настройка payment/delivery → первый заказ → tenant-isolated analytics». Это не задача только на switcher; обязательны API authorization sweep, cross-tenant tests, migrations, support and billing boundaries.

## Sprint 01 execution order

1. E1: onboarding, Telegram webhook, tenant context и owner access.
2. E2 + E3: ресторанные настройки и публикация реального меню.
3. E4: checkout, trusted totals, delivery quote и idempotency.
4. E5: один платёжный метод, receipt/payment state machine.
5. E6 + E7: operator workflow, status log и уведомления.
6. E8 + E9: role isolation, observability, backup/restore и Go/No-Go.
7. E10–E12: только после успешного P0-пилота.

## E13. UX/UI food-tech usability and visual system

**Цель:** сделать guest Mini App и owner cabinet нативными, понятными и быстрыми для ежедневных сценариев ресторана, сохранив строгий графичный минимализм MOO.

### Пользователь/гость

| ID | Задача | Acceptance criteria |
|---|---|---|
| E13-G1 | Header/status clarity | Название ресторана, open/closed state, cart и profile читаются за 1 секунду; при закрытом ресторане ясно, можно ли собирать корзину и когда откроется заказ |
| E13-G2 | Navigation model | Гость понимает разницу между главной, меню, доставкой/заказами, подпиской и профилем; активный раздел визуально однозначен |
| E13-G3 | Sticky surfaces | Sticky cart и bottom navigation не закрывают карточки, CTA или текст; все страницы имеют safe-area/bottom padding |
| E13-G4 | Menu scanability | Категории, поиск, фильтры, product cards и add action работают одинаково; название, цена, options и availability видны без лишних тапов |
| E13-G5 | Checkout confidence | До submit видны items, quantity, subtotal, delivery fee, total, payment state и next step; ошибки объясняют, как исправить проблему |
| E13-G6 | Subscription comprehension | План, дни, приёмы пищи, состав, цена и следующий шаг читаются как единый сценарий; disabled/locked states не выглядят как сломанные |
| E13-G7 | Accessibility/touch | Touch targets не меньше Telegram/mobile-safe размера, контраст достаточен, focus/pressed/loading/error states присутствуют |

### Владелец/команда ресторана

| ID | Задача | Acceptance criteria |
|---|---|---|
| E13-O1 | Owner home hierarchy | На первом экране видны operational state, новые заказы, просрочки и главное действие; «всё чисто» не конкурирует с критичными задачами |
| E13-O2 | Information architecture | Разделы «заведение», «витрина», «заказы», «клиенты/маркетинг», «подписки» сгруппированы по рабочим задачам, а не только по сущностям БД |
| E13-O3 | Menu management clarity | «Показать», «редактировать», «выключить», «добавить» и import/export имеют однозначные labels и последствия действия |
| E13-O4 | Order operations | Кухня/менеджер видят next best action, SLA, payment state и status transition без поиска по экрану |
| E13-O5 | Settings feedback | Сохранение, unsaved changes, validation, success/error и destructive actions имеют единый feedback pattern |
| E13-O6 | Team roles | Сотрудник понимает свою роль и доступные действия; owner не видит лишнюю сложность операционной роли |

### Platform/design system/QA

| ID | Задача | Acceptance criteria |
|---|---|---|
| E13-P1 | Canonical layout primitives | Единые `PageHeader`, `Section`, `Surface`, `ControlPanel`, `StickyBar`, `BottomNav` и page bottom offsets используются без локальных обходов |
| E13-P2 | Token governance | Цвета, typography, radius, stroke, shadow, spacing и states заданы токенами; нет критичных inline-вариантов в P0 screens |
| E13-P3 | State matrix | Для guest/owner screens покрыты loading, empty, error, disabled, closed, pending, success и destructive states |
| E13-P4 | Visual regression set | Проверены Telegram mobile viewports, safe-area, keyboard/scroll, short and long content, 320–430 px widths |
| E13-P5 | UX copy system | Единый язык CTA, статусов, ошибок, ролей, оплаты, доставки и подписок; нет технических или неоднозначных labels |

### UX delivery order

1. Сначала исправить системные перекрытия: sticky cart, bottom navigation, fixed header и safe-area.
2. Затем стабилизировать guest information architecture и закрытый ресторанный state.
3. Далее улучшить checkout/order confidence и subscription comprehension.
4. После этого упростить owner dashboard и menu management вокруг операционных задач.
5. В конце провести token cleanup, state matrix и visual regression pass.
