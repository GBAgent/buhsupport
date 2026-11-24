"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dateVal, int, req, str } from "@/lib/forms";

const periodDate = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
};

/** Сдвинуть «оплачено по» вперёд, если платёж за более поздний месяц */
export async function advancePaidUntil(target: { clientId?: string; payerId?: string }, period: string) {
  const d = periodDate(period);
  if (target.clientId) {
    await db.client.updateMany({
      where: { id: target.clientId, OR: [{ paidUntil: null }, { paidUntil: { lt: d } }] },
      data: { paidUntil: d },
    });
  }
  if (target.payerId) {
    await db.payer.updateMany({
      where: { id: target.payerId, groupPrice: { gt: 0 }, OR: [{ paidUntil: null }, { paidUntil: { lt: d } }] },
      data: { paidUntil: d },
    });
  }
}

async function guard() {
  const u = await requireUser();
  if (u.role === "ACCOUNTANT") throw new Error("Недостаточно прав");
  return u;
}

/** Привязать неопознанный платёж к клиенту или плательщику */
export async function assignPayment(fd: FormData) {
  await guard();
  const id = req(fd, "id");
  const target = str(fd, "target"); // client:<id> | payer:<id>
  if (!target) return;
  const [kind, tid] = target.split(":");
  const p = await db.payment.update({
    where: { id },
    data: kind === "client" ? { clientId: tid } : { payerId: tid },
  });
  await advancePaidUntil(kind === "client" ? { clientId: tid } : { payerId: tid }, p.period);
  revalidatePath("/payments");
}

/** Платёж плательщика: отметить «оплачено по» для всех его действующих компаний (и групповой тариф) */
export async function payerPayment(fd: FormData) {
  await guard();
  const payerId = req(fd, "payerId");
  const period = req(fd, "period");
  const amount = int(fd, "amount");
  const d = periodDate(period);
  if (amount > 0) {
    await db.payment.create({
      data: {
        payerId, amount, period,
        paidAt: dateVal(fd, "paidAt") ?? new Date(),
        method: str(fd, "method") ?? "Kaspi",
        comment: str(fd, "comment"),
      },
    });
  }
  await db.client.updateMany({
    where: { payerId, status: "ACTIVE", OR: [{ paidUntil: null }, { paidUntil: { lt: d } }] },
    data: { paidUntil: d },
  });
  await advancePaidUntil({ payerId }, period);
  revalidatePath(`/payers/${payerId}`);
  revalidatePath("/payers");
  revalidatePath("/payments");
}

export async function savePayer(fd: FormData) {
  await guard();
  const id = str(fd, "id");
  const paid = str(fd, "paidUntil");
  const data = {
    name: req(fd, "name"),
    phone: str(fd, "phone"),
    note: str(fd, "note"),
    groupPrice: int(fd, "groupPrice"),
    paidUntil: paid ? periodDate(paid) : null,
  };
  if (id) await db.payer.update({ where: { id }, data });
  else await db.payer.create({ data });
  revalidatePath("/payers");
  if (id) revalidatePath(`/payers/${id}`);
}
