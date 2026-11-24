import "server-only";
import type { Prisma, Priority } from "@prisma/client";
import { db } from "@/lib/db";
import { PRIORITY_LABEL, STATUS_LABEL, TICKET_CATEGORIES } from "@/lib/format";
import { esc, tgSafe } from "./api";
import { KEYS, getSetting, groupTarget, setSetting } from "./settings";
import { notifyClient, postTicketToGroup, refreshGroupMessage } from "./tickets";

/* ---------- типы апдейтов (только то, что используем) ---------- */
type TgUser = { id: number; username?: string; first_name?: string; last_name?: string };
type TgMessage = {
  message_id: number; message_thread_id?: number;
  chat: { id: number; type: string; title?: string };
  from?: TgUser; text?: string; caption?: string;
  photo?: { file_id: string }[]; document?: { file_id: string };
};
export type TgUpdate = {
  message?: TgMessage;
  callback_query?: { id: string; from: TgUser; data?: string; message?: TgMessage };
};

const NEW_BTN = "🆕 Новая заявка";
const MY_BTN = "📋 Мои заявки";
const CANCEL_BTN = "Отмена";
const MAIN_KB = { keyboard: [[{ text: NEW_BTN }], [{ text: MY_BTN }]], resize_keyboard: true, is_persistent: true };
const CANCEL_KB = { keyboard: [[{ text: CANCEL_BTN }]], resize_keyboard: true };
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

type Draft = { bin?: string | null; company?: string; clientId?: string | null; category?: string; priority?: Priority; files?: string[] };

const say = (chat_id: number | string, text: string, extra: Record<string, unknown> = {}) =>
  tgSafe<{ message_id: number }>("sendMessage", { chat_id, text, parse_mode: "HTML", ...extra });

const contactOf = (u?: TgUser) =>
  u?.username ? `@${u.username}` : [u?.first_name, u?.last_name].filter(Boolean).join(" ") || `id ${u?.id}`;

async function setStep(chatId: string, step: string, data: Draft = {}) {
  await db.telegramSession.upsert({
    where: { chatId },
    update: { step, data: data as Prisma.InputJsonValue },
    create: { chatId, step, data: data as Prisma.InputJsonValue },
  });
}
const clearStep = (chatId: string) => db.telegramSession.deleteMany({ where: { chatId } });

/* ---------- вход ---------- */
export async function handleUpdate(u: TgUpdate) {
  if (u.callback_query) return onCallback(u.callback_query);
  const m = u.message;
  if (!m) return;
  if (m.chat.type === "private") return onPrivate(m);
  return onGroup(m);
}

/* ---------- группа: только привязка темы ---------- */
async function onGroup(m: TgMessage) {
  const text = m.text?.trim() ?? "";
  const bind = text.match(/^\/bind(?:@\w+)?\s+(\d{4,8})$/);
  if (!bind) return;
  const code = await getSetting(KEYS.bindCode);
  if (!code || code !== bind[1]) {
    await say(m.chat.id, "Неверный код привязки. Возьмите актуальный код на сайте: Telegram → Привязать группу.", { message_thread_id: m.message_thread_id });
    return;
  }
  await setSetting(KEYS.chat, String(m.chat.id));
  await setSetting(KEYS.thread, m.message_thread_id ? String(m.message_thread_id) : null);
  await setSetting(KEYS.bindCode, null);
  await say(m.chat.id, "✅ Готово: новые заявки будут приходить в эту тему.", { message_thread_id: m.message_thread_id });
}

/* ---------- личка: оформление заявки ---------- */
async function onPrivate(m: TgMessage) {
  const chatId = String(m.chat.id);
  const text = (m.text ?? m.caption ?? "").trim();
  const photo = m.photo?.at(-1)?.file_id ?? m.document?.file_id;

  if (text === "/start" || text === CANCEL_BTN || text === "/cancel") {
    await clearStep(chatId);
    await say(chatId, text === "/start"
      ? "Здравствуйте! Это поддержка <b>ГлавБух</b>.\nНажмите «🆕 Новая заявка», чтобы сообщить о проблеме с 1С, сервером, ЭЦП и т.д."
      : "Отменено.", { reply_markup: MAIN_KB });
    return;
  }
  if (text === NEW_BTN || text === "/new") {
    await setStep(chatId, "bin");
    await say(chatId, "Введите <b>БИН/ИИН</b> компании (12 цифр).\nЕсли не знаете — напишите «нет».", { reply_markup: CANCEL_KB });
    return;
  }
  if (text === MY_BTN || text === "/my") return myTickets(chatId);

  const s = await db.telegramSession.findUnique({ where: { chatId } });
  if (!s) {
    await say(chatId, "Чтобы оформить заявку, нажмите «🆕 Новая заявка».", { reply_markup: MAIN_KB });
    return;
  }
  const d = s.data as Draft;

  switch (s.step) {
    case "bin": {
      const digits = text.replace(/\D/g, "");
      if (/^(нет|не знаю|-)$/i.test(text)) {
        await setStep(chatId, "company", { ...d, bin: null });
        await say(chatId, "Напишите <b>название компании</b>.");
        return;
      }
      if (digits.length !== 12) {
        await say(chatId, "БИН/ИИН — это 12 цифр. Введите ещё раз или напишите «нет».");
        return;
      }
      const client = await db.client.findUnique({ where: { bin: digits } });
      if (client) {
        await setStep(chatId, "category", { ...d, bin: digits, company: client.name, clientId: client.id });
        await say(chatId, `Компания: <b>${esc(client.name)}</b>`, { reply_markup: { remove_keyboard: true } });
        return askCategory(chatId);
      }
      await setStep(chatId, "company", { ...d, bin: digits });
      await say(chatId, "Напишите <b>название компании</b>.");
      return;
    }
    case "company": {
      if (!text) return void (await say(chatId, "Напишите название компании текстом."));
      await setStep(chatId, "category", { ...d, company: text.slice(0, 200) });
      return askCategory(chatId);
    }
    case "category":
    case "priority":
      await say(chatId, "Выберите вариант кнопкой выше 👆");
      return;
    case "description": {
      const files = photo ? [...(d.files ?? []), photo] : d.files ?? [];
      if (!text) {
        await setStep(chatId, "description", { ...d, files });
        await say(chatId, "Фото получено. Теперь опишите проблему текстом.");
        return;
      }
      return createFromDraft(chatId, { ...d, files }, text, m.from);
    }
  }
}

async function askCategory(chatId: string) {
  const rows = TICKET_CATEGORIES.map((c, i) => ({ text: c, callback_data: `cat:${i}` }));
  const kb = []; for (let i = 0; i < rows.length; i += 2) kb.push(rows.slice(i, i + 2));
  await say(chatId, "Выберите <b>категорию</b>:", { reply_markup: { inline_keyboard: kb } });
}

async function askPriority(chatId: string) {
  await say(chatId, "Насколько срочно?", {
    reply_markup: { inline_keyboard: [PRIORITIES.slice(0, 2), PRIORITIES.slice(2)].map((r) => r.map((p) => ({ text: PRIORITY_LABEL[p], callback_data: `pri:${p}` }))) },
  });
}

async function createFromDraft(chatId: string, d: Draft, description: string, from?: TgUser) {
  const t = await db.ticket.create({
    data: {
      clientId: d.clientId ?? null,
      company: d.company,
      bin: d.bin ?? null,
      category: d.category ?? "Другое",
      priority: d.priority ?? "MEDIUM",
      description: description.slice(0, 4000),
      contact: contactOf(from),
      source: "telegram",
      telegramChatId: chatId,
    },
  });
  await clearStep(chatId);
  await postTicketToGroup(t.id);
  // фото — ответом на сообщение заявки в группе
  const target = await groupTarget();
  const posted = await db.ticket.findUnique({ where: { id: t.id }, select: { telegramMessageId: true } });
  if (target && d.files?.length) {
    for (const f of d.files.slice(0, 10)) {
      await tgSafe("sendPhoto", { ...target, photo: f, ...(posted?.telegramMessageId ? { reply_parameters: { message_id: Number(posted.telegramMessageId) } } : {}) })
        ?? await tgSafe("sendDocument", { ...target, document: f });
    }
  }
  await say(chatId, `✅ Заявка <b>#${t.number}</b> принята.\nМы напишем сюда, когда специалист возьмёт её в работу.`, { reply_markup: MAIN_KB });
}

async function myTickets(chatId: string) {
  const list = await db.ticket.findMany({ where: { telegramChatId: chatId }, orderBy: { createdAt: "desc" }, take: 5 });
  await say(chatId, list.length
    ? list.map((t) => `#${t.number} · ${STATUS_LABEL[t.status]}\n${esc(t.description.slice(0, 80))}`).join("\n\n")
    : "Заявок пока нет.", { reply_markup: MAIN_KB });
}

/* ---------- кнопки ---------- */
async function onCallback(q: NonNullable<TgUpdate["callback_query"]>) {
  const data = q.data ?? "";
  const chatId = String(q.message?.chat.id ?? q.from.id);
  const answer = (text?: string) => tgSafe("answerCallbackQuery", { callback_query_id: q.id, ...(text ? { text } : {}) });
  const dropButtons = () => q.message && tgSafe("editMessageReplyMarkup", { chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } });

  if (data.startsWith("cat:") || data.startsWith("pri:")) {
    const s = await db.telegramSession.findUnique({ where: { chatId } });
    if (!s) return void (await answer("Заявка уже оформлена или отменена"));
    const d = s.data as Draft;
    if (data.startsWith("cat:") && s.step === "category") {
      const category = TICKET_CATEGORIES[Number(data.slice(4))] ?? "Другое";
      await setStep(chatId, "priority", { ...d, category });
      await answer(); await dropButtons();
      await say(chatId, `Категория: <b>${esc(category)}</b>`);
      return askPriority(chatId);
    }
    if (data.startsWith("pri:") && s.step === "priority") {
      const priority = data.slice(4) as Priority;
      if (!PRIORITIES.includes(priority)) return void (await answer());
      await setStep(chatId, "description", { ...d, priority });
      await answer(); await dropButtons();
      await say(chatId, `Приоритет: <b>${PRIORITY_LABEL[priority]}</b>\n\nОпишите проблему. Можно приложить скриншот (фото с подписью).`, { reply_markup: CANCEL_KB });
      return;
    }
    return void (await answer());
  }

  // кнопки в группе: взять в работу / выполнено
  const m = data.match(/^(take|done):(\w+)$/);
  if (!m) return void (await answer());
  const t = await db.ticket.findUnique({ where: { id: m[2] } });
  if (!t) return void (await answer("Заявка не найдена"));
  const username = q.from.username ?? null;
  const staff = username ? await db.user.findFirst({ where: { telegram: { equals: username, mode: "insensitive" }, active: true } }) : null;
  const label = username ? `@${username}` : contactOf(q.from);

  if (m[1] === "take") {
    if (t.status !== "NEW") return void (await answer("Заявку уже взяли"));
    await db.ticket.update({ where: { id: t.id }, data: { status: "IN_PROGRESS", assigneeId: staff?.id ?? null, assigneeTg: username } });
    await db.ticketComment.create({ data: { ticketId: t.id, authorId: staff?.id, text: `Telegram: взял в работу ${label}` } });
  } else {
    if (t.status === "DONE") return void (await answer("Уже выполнено"));
    await db.ticket.update({
      where: { id: t.id },
      data: { status: "DONE", closedAt: new Date(), ...(t.assigneeId || t.assigneeTg ? {} : { assigneeId: staff?.id ?? null, assigneeTg: username }) },
    });
    await db.ticketComment.create({ data: { ticketId: t.id, authorId: staff?.id, text: `Telegram: работа выполнена (${label})` } });
  }
  await answer(m[1] === "take" ? "Взято в работу" : "Отмечено выполненным");
  await refreshGroupMessage(t.id);
  await notifyClient(t.id);
}
