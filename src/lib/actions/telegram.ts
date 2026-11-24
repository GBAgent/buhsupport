"use server";
import { randomInt } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { tg, webhookSecret } from "@/lib/telegram/api";
import { KEYS, groupTarget, setSetting } from "@/lib/telegram/settings";

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function connectBot(): Promise<{ error?: string; ok?: string }> {
  await requireAdmin();
  try {
    const site = await origin();
    if (!site.startsWith("https://")) return { error: `Telegram требует https-адрес, а сайт открыт как ${site}. Откройте кабинет по https://…vercel.app и нажмите ещё раз.` };
    await tg("setWebhook", {
      url: `${site}/api/telegram/webhook`,
      secret_token: webhookSecret(),
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    });
    await tg("setMyCommands", { commands: [
      { command: "new", description: "Новая заявка" },
      { command: "my", description: "Мои заявки" },
      { command: "cancel", description: "Отменить" },
    ] });
    const me = await tg<{ username: string }>("getMe");
    await setSetting(KEYS.siteUrl, site);
    await setSetting(KEYS.botName, me.username);
    revalidatePath("/telegram");
    return { ok: `Бот @${me.username} подключён к сайту` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function disconnectBot(): Promise<{ error?: string; ok?: string }> {
  await requireAdmin();
  try {
    await tg("deleteWebhook");
    revalidatePath("/telegram");
    return { ok: "Бот отключён от сайта" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function newBindCode() {
  await requireAdmin();
  await setSetting(KEYS.bindCode, String(randomInt(100000, 999999)));
  revalidatePath("/telegram");
}

export async function testGroupMessage(): Promise<{ error?: string; ok?: string }> {
  await requireAdmin();
  const target = await groupTarget();
  if (!target) return { error: "Группа ещё не привязана" };
  try {
    await tg("sendMessage", { ...target, text: "✅ Проверка связи с кабинетом BuhSupport" });
    return { ok: "Сообщение отправлено в тему" };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
