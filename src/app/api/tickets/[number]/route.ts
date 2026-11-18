import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { botAuthorized, parseStatus } from "@/lib/botAuth";

/**
 * Обновление статуса заявки из бота (кнопки «В работу» / «Работа выполнена»).
 * PATCH /api/tickets/19  { status: "IN_PROGRESS" | "DONE" | "в работе" | "выполнено", assignee?: "@suofur", comment?: string }
 */
const Body = z.object({
  status: z.string().optional(),
  assignee: z.string().max(100).optional(),
  comment: z.string().max(5000).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ number: string }> }) {
  if (!botAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const number = Number((await params).number);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!Number.isInteger(number) || !parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const t = await db.ticket.findUnique({ where: { number } });
  if (!t) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const status = parsed.data.status ? parseStatus(parsed.data.status) : undefined;
  if (parsed.data.status && !status) return NextResponse.json({ error: "unknown_status" }, { status: 400 });
  const tg = parsed.data.assignee?.replace(/^@/, "");
  const assignee = tg ? await db.user.findFirst({ where: { telegram: { equals: tg, mode: "insensitive" } } }) : null;

  await db.ticket.update({
    where: { id: t.id },
    data: {
      ...(status ? { status, closedAt: status === "DONE" || status === "CANCELLED" ? new Date() : null } : {}),
      ...(assignee ? { assigneeId: assignee.id } : {}),
    },
  });
  const text = [status && `Telegram: статус → ${status}`, tg && `исполнитель @${tg}${assignee ? "" : " (нет в сотрудниках)"}`, parsed.data.comment]
    .filter(Boolean).join(", ");
  if (text) await db.ticketComment.create({ data: { ticketId: t.id, authorId: assignee?.id, text } });
  return NextResponse.json({ ok: true });
}
