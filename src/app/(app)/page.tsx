import Link from "next/link";
import { db } from "@/lib/db";
import { clientScope, requireUser } from "@/lib/auth";
import { monthlyByClient } from "@/lib/billing";
import { dateTime, money } from "@/lib/format";
import { Empty, PageHeader, PriorityBadge, Stat, StatusBadge } from "@/components/ui";

export default async function Dashboard() {
  const user = await requireUser();
  const scope = clientScope(user);
  const isAcc = user.role === "ACCOUNTANT";

  const ticketWhere = isAcc ? { client: { accountantId: user.id } } : {};
  const [clients, bases, newT, workT, recent, bySource, billing, paid] = await Promise.all([
    db.client.count({ where: { status: "ACTIVE", ...scope } }),
    db.base1C.count({ where: { active: true, client: scope } }),
    db.ticket.count({ where: { status: "NEW", ...ticketWhere } }),
    db.ticket.count({ where: { status: "IN_PROGRESS", ...ticketWhere } }),
    db.ticket.findMany({
      where: { status: { in: ["NEW", "IN_PROGRESS"] }, ...ticketWhere },
      include: { assignee: true, client: true },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    db.client.groupBy({ by: ["source"], where: { status: "ACTIVE", ...scope }, _count: true }),
    isAcc ? Promise.resolve([]) : monthlyByClient(),
    isAcc ? Promise.resolve([]) : db.payer.findMany({ where: { groupPrice: { gt: 0 } } }),
  ]);

  const expected = billing.reduce((a, b) => a + b.total, 0) + paid.reduce((a, g) => a + g.groupPrice, 0);
  const debtTotal = billing.reduce((a, b) => a + (b.debt.amount ?? 0), 0);
  const debtors = billing.filter((b) => (b.debt.amount ?? 0) > 0).length;
  const unknown = billing.filter((b) => b.total > 0 && b.debt.amount == null).length;

  return (
    <>
      <PageHeader title={`Здравствуйте, ${user.name}`} sub="ГлавБух Поддержка — сводка">
        <Link href="/tickets/new" className="btn">+ Заявка</Link>
        {!isAcc && <Link href="/clients/new" className="btn-ghost">+ Клиент</Link>}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Новые заявки" value={newT} href="/tickets?status=NEW" tone={newT ? "text-blue" : ""} />
        <Stat label="В работе" value={workT} href="/tickets?status=IN_PROGRESS" tone={workT ? "text-warn" : ""} />
        <Stat label="Активные клиенты" value={clients} href="/clients" />
        <Stat label="Базы 1С на хостинге" value={bases} href="/bases" />
      </div>

      {!isAcc && (
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Начисление в месяц" value={money(expected)} href="/payments?filter=all" />
          <Stat label="Долг клиентов" value={money(debtTotal)} href="/payments" tone={debtTotal ? "text-red" : ""} />
          <Stat label="Должников" value={debtors} href="/payments" tone={debtors ? "text-red" : ""} />
          <Stat label="Нет данных об оплате" value={unknown} href="/payments?filter=unknown" tone={unknown ? "text-warn" : ""} />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Открытые заявки</h2>
            <Link href="/tickets" className="link text-sm">Все заявки →</Link>
          </div>
          {recent.length === 0 ? <Empty>Открытых заявок нет 🎉</Empty> : (
            <div className="overflow-x-auto">
              <table className="table">
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id}>
                      <td><Link href={`/tickets/${t.number}`} className="link font-medium">#{t.number}</Link></td>
                      <td>
                        <div className="font-medium">{t.client?.name ?? t.company ?? "—"}</div>
                        <div className="line-clamp-1 text-xs text-muted">{t.description}</div>
                      </td>
                      <td><StatusBadge s={t.status} /></td>
                      <td><PriorityBadge p={t.priority} /></td>
                      <td className="text-xs text-muted">{t.assignee?.name ?? "—"}<br />{dateTime(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold">Откуда пришли клиенты</h2>
          {bySource.length === 0 ? <Empty>Пока нет клиентов</Empty> : (
            <ul className="space-y-2 text-sm">
              {bySource.sort((a, b) => b._count - a._count).map((s) => (
                <li key={s.source ?? "none"} className="flex justify-between">
                  <span>{s.source ?? "Не указано"}</span>
                  <span className="font-semibold">{s._count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
