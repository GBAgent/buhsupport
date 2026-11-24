import { db } from "./db";

const idx = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
const nowAlmaty = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Almaty" }));

/** Сколько месяцев не оплачено: как в реестре — от последнего оплаченного месяца до прошлого месяца включительно */
export function unpaidMonths(paidUntil: Date | null | undefined, now = nowAlmaty()) {
  if (!paidUntil) return null;
  const cur = now.getFullYear() * 12 + now.getMonth();
  return Math.max(0, cur - idx(paidUntil) - 1);
}

type ClientForBilling = {
  status: string;
  paidUntil: Date | null;
  bases: { hostingPrice: number; active: boolean }[];
  services?: { price: number; quantity: number; active: boolean; service: { unit: string } }[];
};

export function clientMonthly(c: ClientForBilling) {
  const hosting = c.bases.filter((b) => b.active).reduce((a, b) => a + b.hostingPrice, 0);
  const services = (c.services ?? [])
    .filter((s) => s.active && s.service.unit === "мес")
    .reduce((a, s) => a + s.price * s.quantity, 0);
  return { hosting, services, total: hosting + services };
}

/** Долг клиента: null — нет данных об оплате */
export function clientDebt(c: ClientForBilling) {
  const { total } = clientMonthly(c);
  if (c.status !== "ACTIVE" || total === 0) return { months: 0, amount: 0, monthly: total };
  const months = unpaidMonths(c.paidUntil);
  return { months, amount: months == null ? null : months * total, monthly: total };
}

export function payerGroupDebt(p: { groupPrice: number; paidUntil: Date | null }) {
  if (!p.groupPrice) return { months: 0, amount: 0 };
  const months = unpaidMonths(p.paidUntil);
  return { months, amount: months == null ? null : months * p.groupPrice };
}

/** Ежемесячное начисление по клиентам (для сводки): услуги «мес» + хостинг активных баз */
export async function monthlyByClient(where: object = {}) {
  const clients = await db.client.findMany({
    where: { status: "ACTIVE", ...where },
    include: {
      payer: true,
      services: { where: { active: true }, include: { service: true } },
      bases: { where: { active: true } },
    },
    orderBy: { name: "asc" },
  });
  return clients.map((c) => ({ client: c, ...clientMonthly(c), debt: clientDebt(c) }));
}

export const monthLabel = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }) : "—";
