import { db } from "./db";

/** Ежемесячное начисление по клиентам: активные услуги с единицей «мес» + хостинг активных баз 1С */
export async function monthlyByClient(where: object = {}) {
  const clients = await db.client.findMany({
    where: { status: "ACTIVE", ...where },
    include: {
      services: { where: { active: true }, include: { service: true } },
      bases: { where: { active: true } },
    },
    orderBy: { name: "asc" },
  });
  return clients.map((c) => {
    const services = c.services
      .filter((s) => s.service.unit === "мес")
      .reduce((a, s) => a + s.price * s.quantity, 0);
    const hosting = c.bases.reduce((a, b) => a + b.hostingPrice, 0);
    return { client: c, services, hosting, total: services + hosting };
  });
}
