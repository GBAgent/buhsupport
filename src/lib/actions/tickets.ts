"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { req, str } from "@/lib/forms";
import type { Priority, TicketStatus } from "@prisma/client";
import { syncTicket } from "@/lib/telegram/tickets";

export async function createTicket(fd: FormData) {
  const u = await requireUser();
  const clientId = str(fd, "clientId");
  const client = clientId ? await db.client.findUnique({ where: { id: clientId } }) : null;
  const t = await db.ticket.create({
    data: {
      clientId,
      company: client?.name ?? str(fd, "company"),
      bin: client?.bin ?? str(fd, "bin"),
      category: str(fd, "category") ?? "1С",
      priority: (str(fd, "priority") ?? "MEDIUM") as Priority,
      description: req(fd, "description"),
      contact: str(fd, "contact"),
      source: str(fd, "source") ?? "web",
      assigneeId: str(fd, "assigneeId"),
      status: str(fd, "assigneeId") ? "IN_PROGRESS" : "NEW",
    },
  });
  await db.ticketComment.create({ data: { ticketId: t.id, authorId: u.id, text: "Заявка создана в кабинете" } });
  await syncTicket(t.id);
  revalidatePath("/tickets");
  redirect(`/tickets/${t.number}`);
}

export async function updateTicket(fd: FormData) {
  const u = await requireUser();
  const id = req(fd, "id");
  const old = await db.ticket.findUniqueOrThrow({ where: { id }, include: { assignee: true } });
  const status = (str(fd, "status") ?? old.status) as TicketStatus;
  const assigneeId = str(fd, "assigneeId");
  const priority = (str(fd, "priority") ?? old.priority) as Priority;
  const clientId = str(fd, "clientId");

  const changes: string[] = [];
  if (status !== old.status) changes.push(`статус → ${status}`);
  if (assigneeId !== old.assigneeId) changes.push("исполнитель изменён");
  if (priority !== old.priority) changes.push(`приоритет → ${priority}`);
  if (clientId !== old.clientId) changes.push("клиент привязан");

  await db.ticket.update({
    where: { id },
    data: {
      status, assigneeId, priority, clientId,
      ...(assigneeId !== old.assigneeId ? { assigneeTg: null } : {}),
      category: str(fd, "category") ?? old.category,
      closedAt: status === "DONE" || status === "CANCELLED" ? (old.closedAt ?? new Date()) : null,
    },
  });
  const comment = str(fd, "comment");
  if (changes.length || comment) {
    await db.ticketComment.create({
      data: { ticketId: id, authorId: u.id, text: [changes.join(", "), comment].filter(Boolean).join("\n") },
    });
  }
  if (changes.length) await syncTicket(id, { statusChanged: status !== old.status });
  revalidatePath(`/tickets/${old.number}`);
  revalidatePath("/tickets");
}

export async function takeTicket(fd: FormData) {
  const u = await requireUser();
  const t = await db.ticket.update({
    where: { id: req(fd, "id") },
    data: { assigneeId: u.id, status: "IN_PROGRESS" },
  });
  await db.ticketComment.create({ data: { ticketId: t.id, authorId: u.id, text: "Взял в работу" } });
  await syncTicket(t.id, { statusChanged: true });
  revalidatePath(`/tickets/${t.number}`);
  revalidatePath("/tickets");
}
