# ГлавБух Поддержка — BuhSupport

Кабинет IT-поддержки клиентов ГлавБух: клиенты, базы 1С на хостинге, услуги, оплаты и заявки (в т.ч. из Telegram-бота).

## Что есть

- **Вход по почте и паролю.** Роли: Администратор, IT-специалист, Бухгалтер (видит только своих клиентов).
- **Клиенты** — БИН/ИИН, контакты, Telegram, **откуда пришёл**, **кто привлёк** (сотрудник или партнёр/клиент), **бухгалтер**, статус, заметки.
- **Базы 1С** — конфигурация, релиз, сервер, режим, кол-во пользователей, стоимость хостинга в месяц, бэкап.
- **Услуги** — каталог IT-услуг с ценами; подключение услуг клиенту (абонентские «мес», разовые, почасовые).
- **Оплаты** — начисление за месяц = абонентские услуги + хостинг баз; внесение оплат; список должников.
- **Заявки** — из бота и вручную; статусы 🆕 Новая → 🔧 В работе → ✅ Выполнено, исполнитель, история. Заявка привязывается к клиенту по БИН автоматически (и при добавлении клиента — старые заявки с его БИН тоже).
- **Сотрудники** — администратор добавляет пользователей по почте.

## Стек

Next.js 15 (App Router, Server Actions) · PostgreSQL + Prisma 6 · Tailwind CSS 4.

## Локальный запуск

```bash
cp .env.example .env        # заполнить DATABASE_URL, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, BOT_API_KEY
npm install
npx prisma migrate deploy   # создать таблицы
npm run db:seed             # создать администратора (ADMIN_EMAIL) и каталог услуг
npm run dev
```

Администратор создаётся сидом с почтой `ADMIN_EMAIL` и паролем `ADMIN_PASSWORD`. Повторный сид пароль не меняет. После первого входа смените пароль в «Профиле».

## Деплой на Vercel

1. Создать базу PostgreSQL (Neon через Vercel Marketplace или любой Postgres).
2. В проекте Vercel задать переменные: `DATABASE_URL`, `AUTH_SECRET` (`openssl rand -base64 32`), `BOT_API_KEY`.
3. Один раз выполнить с этими переменными: `npx prisma migrate deploy && npm run db:seed` (с `ADMIN_EMAIL` и `ADMIN_PASSWORD`).

## API для Telegram-бота

Все запросы с заголовком `x-api-key: <BOT_API_KEY>`.

**Новая заявка**

```bash
curl -X POST https://<домен>/api/tickets \
  -H "x-api-key: $BOT_API_KEY" -H "content-type: application/json" \
  -d '{"company":"ТОО Пример","bin":"123456789012","category":"1С","priority":"Высокий",
       "description":"Не открывается база","contact":"@client_username",
       "telegramChatId":"-100...","telegramMessageId":"118"}'
# → {"ok":true,"number":20,"clientFound":true}
```

`priority`: Низкий / Средний / Высокий / Критично. Клиент ищется по БИН; если БИН не передан — по Telegram-нику клиента (по нику не ищем, когда БИН есть: один бухгалтер может писать за разные компании).

**Смена статуса** (кнопки «В работу» / «Работа выполнена» в боте)

```bash
curl -X PATCH https://<домен>/api/tickets/20 \
  -H "x-api-key: $BOT_API_KEY" -H "content-type: application/json" \
  -d '{"status":"в работе","assignee":"@engineer_username"}'
```

`status`: `NEW` / `IN_PROGRESS` / `DONE` / `CANCELLED` (или «в работе», «выполнено»). `assignee` сопоставляется с Telegram-ником сотрудника в разделе «Сотрудники».
