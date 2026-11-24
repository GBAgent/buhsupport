import { timingSafeEqual } from "node:crypto";
import { handleUpdate, type TgUpdate } from "@/lib/telegram/bot";
import { webhookSecret } from "@/lib/telegram/api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const expected = webhookSecret();
  const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!expected || got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
    return new Response("forbidden", { status: 403 });
  }
  const update = (await req.json().catch(() => null)) as TgUpdate | null;
  if (update) {
    try {
      await handleUpdate(update);
    } catch (e) {
      // отвечаем 200, иначе Telegram будет бесконечно повторять апдейт
      console.error("telegram update failed", e);
    }
  }
  return Response.json({ ok: true });
}
