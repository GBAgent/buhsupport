"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { bool, dateVal, int, req, str } from "@/lib/forms";
import type { ClientStatus } from "@prisma/client";

function clientData(fd: FormData) {
  return {
    name: req(fd, "name"),
    bin: str(fd, "bin"),
    contactName: str(fd, "contactName"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    telegram: str(fd, "telegram")?.replace(/^@/, "") ?? null,
    address: str(fd, "address"),
    status: (str(fd, "status") ?? "ACTIVE") as ClientStatus,
    source: str(fd, "source"),
    referrerId: str(fd, "referrerId"),
    referrerNote: str(fd, "referrerNote"),
    accountantId: str(fd, "accountantId"),
    accountantNote: str(fd, "accountantNote"),
    notes: str(fd, "notes"),
  };
}

async function guard() {
  const u = await requireUser();
  if (u.role === "ACCOUNTANT") throw new Error("Недостаточно прав");
  return u;
}

export async function saveClient(_: unknown, fd: FormData) {
  await guard();
  const id = str(fd, "id");
  const values = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
  let clientId: string;
  try {
    const data = clientData(fd);
    if (data.bin && !/^\d{12}$/.test(data.bin)) return { error: "БИН/ИИН должен состоять из 12 цифр", values };
    const c = id ? await db.client.update({ where: { id }, data }) : await db.client.create({ data });
    clientId = c.id;
    // привязать старые заявки с тем же БИН
    if (c.bin) await db.ticket.updateMany({ where: { bin: c.bin, clientId: null }, data: { clientId: c.id } });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") return { error: "Клиент с таким БИН/ИИН уже есть", values };
    return { error: (e as Error).message, values };
  }
  revalidatePath("/clients");
  redirect(`/clients/${clientId}`);
}

export async function deleteClient(fd: FormData) {
  const u = await requireUser();
  if (u.role !== "ADMIN") throw new Error("Только администратор");
  await db.client.delete({ where: { id: req(fd, "id") } });
  revalidatePath("/clients");
  redirect("/clients");
}

/* ---- услуги клиента ---- */
export async function addClientService(fd: FormData) {
  await guard();
  const clientId = req(fd, "clientId");
  const serviceId = req(fd, "serviceId");
  const svc = await db.service.findUniqueOrThrow({ where: { id: serviceId } });
  await db.clientService.create({
    data: {
      clientId, serviceId,
      price: fd.get("price") ? int(fd, "price") : svc.defaultPrice,
      quantity: int(fd, "quantity", 1) || 1,
      startDate: dateVal(fd, "startDate") ?? new Date(),
      comment: str(fd, "comment"),
    },
  });
  revalidatePath(`/clients/${clientId}`);
}

export async function toggleClientService(fd: FormData) {
  await guard();
  const s = await db.clientService.findUniqueOrThrow({ where: { id: req(fd, "id") } });
  await db.clientService.update({
    where: { id: s.id },
    data: { active: !s.active, endDate: s.active ? new Date() : null },
  });
  revalidatePath(`/clients/${s.clientId}`);
}

export async function deleteClientService(fd: FormData) {
  await guard();
  const s = await db.clientService.delete({ where: { id: req(fd, "id") } });
  revalidatePath(`/clients/${s.clientId}`);
}

/* ---- базы 1С ---- */
export async function saveBase(fd: FormData) {
  await guard();
  const id = str(fd, "id");
  const clientId = req(fd, "clientId");
  const data = {
    clientId,
    name: req(fd, "name"),
    configuration: str(fd, "configuration"),
    version: str(fd, "version"),
    server: str(fd, "server"),
    mode: str(fd, "mode") ?? "Файловая",
    users: int(fd, "users", 1),
    hostingPrice: int(fd, "hostingPrice"),
    backup: bool(fd, "backup"),
    active: id ? bool(fd, "active") : true,
    comment: str(fd, "comment"),
  };
  if (id) await db.base1C.update({ where: { id }, data });
  else await db.base1C.create({ data });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/bases");
}

export async function deleteBase(fd: FormData) {
  await guard();
  const b = await db.base1C.delete({ where: { id: req(fd, "id") } });
  revalidatePath(`/clients/${b.clientId}`);
  revalidatePath("/bases");
}

/* ---- оплаты ---- */
export async function addPayment(fd: FormData) {
  await guard();
  const clientId = req(fd, "clientId");
  await db.payment.create({
    data: {
      clientId,
      amount: int(fd, "amount"),
      period: req(fd, "period"),
      paidAt: dateVal(fd, "paidAt") ?? new Date(),
      method: str(fd, "method") ?? "Kaspi",
      comment: str(fd, "comment"),
    },
  });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/payments");
}

export async function deletePayment(fd: FormData) {
  const u = await requireUser();
  if (u.role !== "ADMIN") throw new Error("Только администратор");
  const p = await db.payment.delete({ where: { id: req(fd, "id") } });
  revalidatePath(`/clients/${p.clientId}`);
  revalidatePath("/payments");
}
