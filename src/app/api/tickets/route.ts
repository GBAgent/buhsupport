import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { botAuthorized, parsePriority } from "@/lib/botAuth";

/**
 * Приём заявок от Telegram-бота.
 * POST /api/tickets  (заголовок x-api-key: BOT_API_KEY)
 * { company, bin, category, priority, description, contact, telegramChatId?, telegramMessageId? }
 */
const Body = z.object({
  company: z.string().max(300).optional(),
  bin: z.string().max(20).optional(),
  category: z.string().max(100).optional(),
  priority: z.string().max(30).optional(),
  description: z.string().min(1).max(5000),
  contact: z.string().max(100).optional(),
  telegramChatId: z.union([z.string(), z.number()]).optional(),
  telegramMessageId: z.union([z.string(), z.number()]).optional(),
});

export async function POST(req: Request) {
  if (!botAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request", details: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  const bin = b.bin?.replace(/\D/g, "") || null;
  const contact = b.contact ? (b.contact.startsWith("@") || /^\+?\d/.test(b.contact) ? b.contact : `@${b.contact}`) : null;
  const client =
    (bin && (await db.client.findUnique({ where: { bin } }))) ||
    // по Telegram — только если БИН не указан: один бухгалтер пишет за разные компании
    (!bin && contact?.startsWith("@") && (await db.client.findFirst({ where: { telegram: { equals: contact.slice(1), mode: "insensitive" } } }))) ||
    null;

  const t = await db.ticket.create({
    data: {
      clientId: client?.id,
      company: b.company ?? client?.name,
      bin,
      category: b.category || "1С",
      priority: parsePriority(b.priority),
      description: b.description,
      contact,
      source: "telegram",
      telegramChatId: b.telegramChatId?.toString(),
      telegramMessageId: b.telegramMessageId?.toString(),
    },
  });
  return NextResponse.json({ ok: true, number: t.number, id: t.id, clientFound: !!client }, { status: 201 });
}
