import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { monthlyByClient } from "@/lib/billing";
import { currentPeriod, date, money, periodLabel } from "@/lib/format";
import { Badge, Empty, PageHeader, Stat } from "@/components/ui";

export default async function Payments({ searchParams }: { searchParams: Promise<{ period?: string; filter?: string }> }) {
  const user = await requireUser();
  if (user.role === "ACCOUNTANT") redirect("/");
  const sp = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(sp.period ?? "") ? sp.period! : currentPeriod();
  const [billing, payments] = await Promise.all([
    monthlyByClient(),
    db.payment.findMany({ where: { period }, include: { client: true }, orderBy: { paidAt: "desc" } }),
  ]);
  const paid = new Map<string, number>();
  for (const p of payments) paid.set(p.clientId, (paid.get(p.clientId) ?? 0) + p.amount);

  const rows = billing
    .filter((b) => b.total > 0 || paid.has(b.client.id))
    .map((b) => ({ ...b, paid: paid.get(b.client.id) ?? 0 }))
    .map((r) => ({ ...r, debt: Math.max(0, r.total - r.paid) }))
    .filter((r) => (sp.filter === "debt" ? r.debt > 0 : true))
    .sort((a, b) => b.debt - a.debt || a.client.name.localeCompare(b.client.name));

  const expected = billing.reduce((a, b) => a + b.total, 0);
  const paidSum = payments.reduce((a, p) => a + p.amount, 0);
  const debtSum = billing.reduce((a, b) => a + Math.max(0, b.total - (paid.get(b.client.id) ?? 0)), 0);

  return (
    <>
      <PageHeader title="Оплаты" sub={`За ${periodLabel(period)}`}>
        <form className="flex gap-2">
          <input type="month" name="period" defaultValue={period} className="input" />
          <select name="filter" defaultValue={sp.filter} className="input"><option value="">Все</option><option value="debt">Только должники</option></select>
          <button className="btn-ghost">Показать</button>
        </form>
      </PageHeader>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Начислено (услуги + хостинг)" value={money(expected)} />
        <Stat label="Оплачено" value={money(paidSum)} tone="text-ok" />
        <Stat label="Задолженность" value={money(debtSum)} tone={debtSum ? "text-red" : ""} />
      </div>

      <div className="card overflow-x-auto p-0">
        {rows.length === 0 ? <Empty>Нет начислений. Подключите клиентам услуги или базы 1С.</Empty> : (
          <table className="table">
            <thead><tr><th>Клиент</th><th>Бухгалтер</th><th>Услуги</th><th>Хостинг 1С</th><th>Итого</th><th>Оплачено</th><th>Долг</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.client.id}>
                  <td><Link className="link" href={`/clients/${r.client.id}`}>{r.client.name}</Link></td>
                  <td className="text-xs">{r.client.accountantNote ?? ""}</td>
                  <td>{money(r.services)}</td>
                  <td>{money(r.hosting)}<span className="text-xs text-muted"> ({r.client.bases.length} баз)</span></td>
                  <td className="font-medium">{money(r.total)}</td>
                  <td className="text-ok">{money(r.paid)}</td>
                  <td>{r.debt > 0 ? <Badge className="bg-red-bg text-red">{money(r.debt)}</Badge> : <Badge className="bg-[rgba(30,154,96,.12)] text-ok">оплачено</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="mb-2 mt-8 font-semibold">Поступления за период</h2>
      <div className="card overflow-x-auto p-0">
        {payments.length === 0 ? <Empty>Оплат нет. Оплаты вносятся в карточке клиента.</Empty> : (
          <table className="table">
            <thead><tr><th>Дата</th><th>Клиент</th><th>Сумма</th><th>Способ</th><th>Комментарий</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{date(p.paidAt)}</td>
                  <td><Link className="link" href={`/clients/${p.clientId}`}>{p.client.name}</Link></td>
                  <td className="font-medium">{money(p.amount)}</td>
                  <td>{p.method}</td>
                  <td className="text-xs">{p.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
