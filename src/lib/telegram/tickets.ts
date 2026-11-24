import "server-only";
import type { Client, Ticket, User } from "@prisma/client";
import { db } from "@/lib/db";
import { PRIORITY_LABEL } from "@/lib/format";
import { esc, tgSafe } from "./api";
import { KEYS, getSetting, groupTarget } from "./settings";

type T = Ticket & { client: Client | null; assignee: User | null };

const who = (t: T) => {
  const tgName = t.assignee?.telegram ?? t.assigneeTg;
  return tgName ? `@${tgName.replace(/^@/, "")}` : t.assignee?.name ?? "";
};

const STATUS_LINE: Record<string, (t: T) => string> = {
  NEW: () => "🆕 Новая",
  IN_PROGRESS: (t) => `🔧 В работе${who(t) ? `: ${esc(who(t))}` : ""}`,
  DONE: (t) => `✅ Выполнено${who(t) ? `: ${esc(who(t))}` : ""}`,
  CANCELLED: () => "✖ Отменена",
};

export function ticketText(t: T) {
  const contact = t.contact?.startsWith("@") ? t.contact : esc(t.contact ?? "—");
  return [
    `🆕 <b>Новая заявка #${t.number}</b>`,
    `Статус: ${STATUS_LINE[t.status](t)}`,
    `Компания: ${esc(t.client?.name ?? t.company ?? "—")}`,
    `БИН/ИИН: ${esc(t.bin ?? t.client?.bin ?? "—")}`,
    `Категория: ${esc(t.category)}`,
    `Приоритет: ${PRIORITY_LABEL[t.priority]}`,
    `Описание: ${esc(t.description)}`,
    `Клиент: ${contact}`,
  ].join("\n");
}

async function keyboard(t: T) {
  const site = await getSetting(KEYS.siteUrl);
  const rows: { text: string; callback_data?: string; url?: string }[][] = [];
  if (t.status === "NEW") rows.push([{ text: "🔧 Взять в работу", callback_data: `take:${t.id}` }]);
  if (t.status === "IN_PROGRESS") rows.push([{ text: "✅ Работа выполнена", callback_data: `done:${t.id}` }]);
  if (site?.startsWith("https://")) rows.push([{ text: "Открыть в кабинете", url: `${site}/tickets/${t.number}` }]);
  return { inline_keyboard: rows };
}

const load = (id: string) => db.ticket.findUnique({ where: { id }, include: { client: true, assignee: true } });

/** Опубликовать новую заявку в теме группы */
export async function postTicketToGroup(ticketId: string) {
  const target = await groupTarget();
  const t = await load(ticketId);
  if (!target || !t) return;
  const msg = await tgSafe<{ message_id: number }>("sendMessage", {
    ...target, text: ticketText(t), parse_mode: "HTML", reply_markup: await keyboard(t), link_preview_options: { is_disabled: true },
  });
  if (msg) await db.ticket.update({ where: { id: t.id }, data: { telegramMessageId: String(msg.message_id) } });
}

/** Обновить сообщение в группе после смены статуса/исполнителя */
export async function refreshGroupMessage(ticketId: string) {
  const target = await groupTarget();
  const t = await load(ticketId);
  if (!target || !t?.telegramMessageId) return;
  await tgSafe("editMessageText", {
    chat_id: target.chat_id, message_id: Number(t.telegramMessageId),
    text: ticketText(t), parse_mode: "HTML", reply_markup: await keyboard(t), link_preview_options: { is_disabled: true },
  });
}

/** Сообщить клиенту в личку о смене статуса */
export async function notifyClient(ticketId: string) {
  const t = await load(ticketId);
  if (!t?.telegramChatId) return;
  const text =
    t.status === "IN_PROGRESS" ? `🔧 Заявка #${t.number} взята в работу${who(t) ? `, специалист ${esc(who(t))}` : ""}.`
    : t.status === "DONE" ? `✅ Работа по заявке #${t.number} выполнена. Если что-то не так — напишите, создадим новую заявку.`
    : t.status === "CANCELLED" ? `Заявка #${t.number} отменена.`
    : null;
  if (text) await tgSafe("sendMessage", { chat_id: t.telegramChatId, text, parse_mode: "HTML" });
}

/** Всё сразу — вызывается с сайта после изменения заявки */
export async function syncTicket(ticketId: string, opts: { statusChanged?: boolean } = {}) {
  const t = await db.ticket.findUnique({ where: { id: ticketId }, select: { telegramMessageId: true } });
  if (t?.telegramMessageId) await refreshGroupMessage(ticketId);
  else await postTicketToGroup(ticketId);
  if (opts.statusChanged) await notifyClient(ticketId);
}
