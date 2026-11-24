import "server-only";
import { createHash } from "node:crypto";

const base = () => process.env.TELEGRAM_API_BASE || "https://api.telegram.org";
export const botToken = () => process.env.TELEGRAM_BOT_TOKEN?.trim() || null;

/** Секрет для заголовка X-Telegram-Bot-Api-Secret-Token — выводится из токена, отдельная переменная не нужна */
export const webhookSecret = () => {
  const t = botToken();
  return t ? createHash("sha256").update("buhsupport-webhook:" + t).digest("hex").slice(0, 48) : null;
};

export class TgError extends Error {}

export async function tg<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const token = botToken();
  if (!token) throw new TgError("TELEGRAM_BOT_TOKEN не задан");
  const res = await fetch(`${base()}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { ok: boolean; result: T; description?: string } | null;
  if (!json?.ok) throw new TgError(`${method}: ${json?.description ?? res.status}`);
  return json.result;
}

/** То же, но ошибки только пишем в лог (уведомления не должны ломать работу сайта) */
export async function tgSafe<T = unknown>(method: string, params: Record<string, unknown> = {}) {
  try {
    return await tg<T>(method, params);
  } catch (e) {
    console.error("telegram", (e as Error).message);
    return null;
  }
}

export const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
