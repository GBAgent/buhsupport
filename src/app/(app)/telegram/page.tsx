import { requireAdmin } from "@/lib/auth";
import { botToken, tg } from "@/lib/telegram/api";
import { KEYS, getSetting } from "@/lib/telegram/settings";
import { connectBot, disconnectBot, newBindCode, testGroupMessage } from "@/lib/actions/telegram";
import { ActionButton } from "@/components/TelegramActions";
import { Badge, PageHeader } from "@/components/ui";

type WebhookInfo = { url: string; pending_update_count: number; last_error_message?: string; last_error_date?: number };

export const dynamic = "force-dynamic";

export default async function TelegramPage() {
  await requireAdmin();
  const hasToken = !!botToken();
  let me: { username: string } | null = null, hook: WebhookInfo | null = null, apiError: string | null = null;
  if (hasToken) {
    try {
      [me, hook] = await Promise.all([tg<{ username: string }>("getMe"), tg<WebhookInfo>("getWebhookInfo")]);
    } catch (e) { apiError = (e as Error).message; }
  }
  const [chat, thread, code, site] = await Promise.all([getSetting(KEYS.chat), getSetting(KEYS.thread), getSetting(KEYS.bindCode), getSetting(KEYS.siteUrl)]);
  const connected = !!hook?.url && hook.url.endsWith("/api/telegram/webhook");

  const Step = ({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) => (
    <section className="card flex gap-4">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${done ? "bg-ok text-white" : "bg-ink text-white"}`}>{done ? "✓" : n}</span>
      <div className="min-w-0 flex-1 space-y-3 text-sm">
        <h2 className="text-base font-semibold">{title}</h2>
        {children}
      </div>
    </section>
  );

  return (
    <>
      <PageHeader title="Telegram" sub="Бот принимает заявки — они сразу появляются на сайте и в теме группы" />
      <div className="space-y-4">
        <Step n={1} done={hasToken && !apiError} title="Токен бота">
          {!hasToken ? (
            <>
              <p>Возьмите токен бота у <b>@BotFather</b>: /mybots → GlavBuh Support Bot → API Token.</p>
              <p>Добавьте его в Vercel → Settings → Environment Variables как <code className="rounded bg-soft px-1">TELEGRAM_BOT_TOKEN</code> и сделайте Redeploy.</p>
            </>
          ) : apiError ? (
            <p className="text-red">Telegram не принял токен: {apiError}</p>
          ) : (
            <p>Бот: <b>@{me?.username}</b></p>
          )}
        </Step>

        <Step n={2} done={connected} title="Подключить бота к сайту">
          <p>После подключения все сообщения бота обрабатывает сайт. <b>Старый бот перестанет получать сообщения</b> — у одного токена может быть только один обработчик.</p>
          {hook && (
            <p className="text-muted">
              Сейчас: {hook.url ? <span className="break-all">{hook.url}</span> : "вебхук не задан (бот работает где-то в режиме опроса или выключен)"}
              {hook.pending_update_count > 0 && <> · в очереди {hook.pending_update_count}</>}
              {hook.last_error_message && <span className="block text-red">Последняя ошибка: {hook.last_error_message}</span>}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <ActionButton action={connectBot} label={connected ? "Переподключить" : "Подключить"} />
            {connected && <ActionButton action={disconnectBot} label="Отключить" kind="btn-ghost" />}
          </div>
        </Step>

        <Step n={3} done={!!chat} title="Группа и тема для заявок">
          {chat && <p>Привязано: чат <code>{chat}</code>{thread ? <>, тема <code>{thread}</code></> : " (без темы)"} <Badge className="ml-1 bg-[rgba(30,154,96,.12)] text-ok">готово</Badge></p>}
          <ol className="list-decimal space-y-1 pl-5">
            <li>Добавьте бота в группу BuhSupport (если его там нет) и дайте право писать в темы.</li>
            <li>Получите код и отправьте команду <b>в тему «Заявки GlavBuh Support Bot»</b>.</li>
          </ol>
          {code ? (
            <p className="rounded-xl bg-soft p-3 font-mono text-base">/bind {code}</p>
          ) : null}
          <form action={newBindCode}><button className="btn-ghost">{code ? "Новый код" : chat ? "Привязать другую тему" : "Получить код"}</button></form>
          {chat && <ActionButton action={testGroupMessage} label="Отправить проверку в тему" kind="btn-ghost" />}
        </Step>

        <section className="card space-y-2 text-sm">
          <h2 className="text-base font-semibold">Как это работает</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Клиент пишет боту → «🆕 Новая заявка» → БИН/ИИН (если компания есть в базе — подставится сама) → категория → срочность → описание и скриншоты.</li>
            <li>Заявка сразу сохраняется на сайте и публикуется в теме с кнопками «🔧 Взять в работу» и «✅ Работа выполнена».</li>
            <li>Кнопки в группе и смена статуса на сайте синхронизируются в обе стороны; клиенту в личку приходит уведомление.</li>
            <li>Исполнитель определяется по Telegram-нику — укажите ники сотрудников в разделе «Сотрудники».</li>
            <li>Заявки, созданные на сайте вручную, тоже уходят в тему.</li>
          </ul>
          {site && <p className="text-muted">Адрес сайта для кнопки «Открыть в кабинете»: {site}</p>}
        </section>
      </div>
    </>
  );
}
