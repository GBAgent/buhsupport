import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { monthLabel, monthlyByClient, payerGroupDebt } from "@/lib/billing";
import { date, money, periodLabel } from "@/lib/format";
import { assignPayment } from "@/lib/actions/payments";
import { Badge, Empty, PageHeader, Stat } from "@/components/ui";

export default async function Payments({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireUser();
  if (user.role === "ACCOUNTANT") redirect("/");
  const sp = await searchParams;
  const filter = sp.filter ?? "debt";

  const [billing, groups, unmatched, recent, clients, payers] = await Promise.all([
    monthlyByClient(),
    db.payer.findMany({ where: { groupPrice: { gt: 0 } } }),
    db.payment.findMany({ where: { clientId: null, payerId: null }, orderBy: { paidAt: "desc" } }),
    db.payment.findMany({ where: { OR: [{ clientId: { not: null } }, { payerId: { not: null } }] }, include: { client: true, payer: true }, orderBy: { paidAt: "desc" }, take: 30 }),
    db.client.findMany({ where: { status: { not: "LEFT" } }, select: { id: true, name: true, bin: true }, orderBy: { name: "asc" } }),
    db.payer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const billable = billing.filter((b) => b.total > 0);
  const groupRows = groups.map((g) => ({ g, d: payerGroupDebt(g) }));
  const expected = billable.reduce((a, b) => a + b.total, 0) + groups.reduce((a, g) => a + g.groupPrice, 0);
  const debtSum = billable.reduce((a, b) => a + (b.debt.amount ?? 0), 0) + groupRows.reduce((a, r) => a + (r.d.amount ?? 0), 0);
  const debtors = billable.filter((b) => (b.debt.amount ?? 0) > 0);
  const unknown = billable.filter((b) => b.debt.amount == null);
  const rows = (filter === "debt" ? debtors : filter === "unknown" ? unknown : billable)
    .sort((a, b) => (b.debt.amount ?? -1) - (a.debt.amount ?? -1) || a.client.name.localeCompare(b.client.name));

  const tabs = [["debt", `Должники (${debtors.length})`], ["unknown", `Нет данных (${unknown.length})`], ["all", `Все платные (${billable.length})`]];

  return (
    <>
      <PageHeader title="Оплаты" sub="Долги считаются от «оплачено по» до прошлого месяца включительно" />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Начисление в месяц" value={money(expected)} />
        <Stat label="Долг (известный)" value={money(debtSum)} tone={debtSum ? "text-red" : ""} />
        <Stat label="Должников" value={debtors.length} tone={debtors.length ? "text-red" : ""} />
        <Stat label="Нет данных об оплате" value={unknown.length} tone={unknown.length ? "text-warn" : ""} />
      </div>

      {unmatched.length > 0 && (
        <section className="card mb-6">
          <h2 className="mb-1 font-semibold">Неопознанные платежи <Badge className="ml-1 bg-red text-white">{unmatched.length}</Badge></h2>
          <p className="mb-3 text-sm text-muted">Деньги пришли, но непонятно от кого. Выберите клиента или плательщика — «оплачено по» сдвинется автоматически.</p>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Дата</th><th>Сумма</th><th>За</th><th>Откуда</th><th>Привязать к</th></tr></thead>
              <tbody>
                {unmatched.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{date(p.paidAt)}</td>
                    <td className="font-medium whitespace-nowrap">{money(p.amount)}</td>
                    <td className="text-xs">{periodLabel(p.period)}{p.comment && <div className="text-muted">{p.comment}</div>}</td>
                    <td className="text-xs">{p.method}<div className="text-muted">{p.source}</div></td>
                    <td>
                      <form action={assignPayment} className="flex gap-2">
                        <input type="hidden" name="id" value={p.id} />
                        <select name="target" required className="input min-w-56 py-1.5">
                          <option value="">— выбрать —</option>
                          <optgroup label="Плательщики">{payers.map((x) => <option key={x.id} value={`payer:${x.id}`}>{x.name}</option>)}</optgroup>
                          <optgroup label="Компании">{clients.map((x) => <option key={x.id} value={`client:${x.id}`}>{x.name}{x.bin ? ` · ${x.bin}` : ""}</option>)}</optgroup>
                        </select>
                        <button className="btn px-3 py-1.5">OK</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {groupRows.length > 0 && (
        <section className="card mb-6">
          <h2 className="mb-3 font-semibold">Групповые тарифы</h2>
          <table className="table"><tbody>
            {groupRows.map(({ g, d }) => (
              <tr key={g.id}>
                <td><Link href={`/payers/${g.id}`} className="link">{g.name}</Link></td>
                <td>{money(g.groupPrice)}/мес</td>
                <td>оплачено по {monthLabel(g.paidUntil)}</td>
                <td>{d.amount == null ? <span className="text-warn">нет данных</span> : d.amount > 0 ? <Badge className="bg-red-bg text-red">{money(d.amount)}</Badge> : <span className="text-ok">оплачено</span>}</td>
              </tr>
            ))}
          </tbody></table>
        </section>
      )}

      <div className="mb-3 flex flex-wrap gap-1">
        {tabs.map(([k, l]) => (
          <Link key={k} href={`/payments?filter=${k}`} className={`rounded-full px-4 py-2 text-sm font-medium transition ${filter === k ? "bg-ink text-white" : "bg-white text-ink hover:bg-soft"}`}>{l}</Link>
        ))}
      </div>
      <div className="card overflow-x-auto p-0">
        {rows.length === 0 ? <Empty>Пусто</Empty> : (
          <table className="table">
            <thead><tr><th>Компания</th><th>Плательщик</th><th>В месяц</th><th>Оплачено по</th><th>Долг</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.client.id}>
                  <td><Link className="link" href={`/clients/${r.client.id}`}>{r.client.name}</Link></td>
                  <td className="text-xs">{r.client.payer ? <Link className="link" href={`/payers/${r.client.payer.id}`}>{r.client.payer.name}</Link> : "—"}</td>
                  <td className="whitespace-nowrap">{money(r.total)}</td>
                  <td className="whitespace-nowrap">{monthLabel(r.client.paidUntil)}</td>
                  <td className="whitespace-nowrap">{r.debt.amount == null ? <span className="text-xs text-warn">нет данных</span> : r.debt.amount > 0 ? <Badge className="bg-red-bg text-red">{money(r.debt.amount)} · {r.debt.months} мес.</Badge> : <span className="text-ok">оплачено</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="mb-2 mt-8 font-semibold">Последние поступления</h2>
      <div className="card overflow-x-auto p-0">
        {recent.length === 0 ? <Empty>Оплат пока нет. Вносятся в карточке клиента или плательщика.</Empty> : (
          <table className="table">
            <thead><tr><th>Дата</th><th>От кого</th><th>Сумма</th><th>За</th><th>Способ</th><th>Комментарий</th></tr></thead>
            <tbody>
              {recent.map((p) => (
                <tr key={p.id}>
                  <td>{date(p.paidAt)}</td>
                  <td>{p.client ? <Link className="link" href={`/clients/${p.client.id}`}>{p.client.name}</Link> : p.payer ? <Link className="link" href={`/payers/${p.payer.id}`}>{p.payer.name}</Link> : "—"}</td>
                  <td className="font-medium">{money(p.amount)}</td>
                  <td>{periodLabel(p.period)}</td>
                  <td>{p.method}</td>
                  <td className="text-xs">{p.comment}{p.source && <div className="text-muted">{p.source}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
