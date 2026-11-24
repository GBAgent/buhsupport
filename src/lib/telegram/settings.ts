import "server-only";
import { db } from "@/lib/db";

export const KEYS = { chat: "tg.chatId", thread: "tg.threadId", siteUrl: "tg.siteUrl", bindCode: "tg.bindCode", botName: "tg.botName" } as const;

export async function getSetting(key: string) {
  return (await db.setting.findUnique({ where: { key } }))?.value ?? null;
}
export async function setSetting(key: string, value: string | null) {
  if (value == null) await db.setting.deleteMany({ where: { key } });
  else await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

/** Группа и тема, куда падают заявки */
export async function groupTarget() {
  const [chat, thread] = await Promise.all([getSetting(KEYS.chat), getSetting(KEYS.thread)]);
  return chat ? { chat_id: chat, ...(thread ? { message_thread_id: Number(thread) } : {}) } : null;
}
