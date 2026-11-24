import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { clientDebt, monthLabel, payerGroupDebt } from "@/lib/billing";
import { CLIENT_STATUS_LABEL, PAY_METHODS, currentPeriod, date, money, periodLabel } from "@/lib/format";
import { toMonthInput } from "@/lib/forms";
import { payerPayment, savePayer } from "@/lib/actions/payments";
import { Badge, Empty, Field, PageHeader, Stat } from "@/components/ui";

export default async function PayerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user.role === "ACCOUNTANT") redirect("/");
  const { id } = await params;
  const p = await db.payer.findUnique({
    where: { id },
    include: {
      clients: { include: { bases: true, services: { include: { service: true } } }, orderBy: [{ status: "asc" }, { name: "asc" }] },
      payments: { orderBy: { paidAt: "desc" }, take: 20 },
    },
  });
  if (!p) notFound();
  const rows = p.clients.map((c) => ({ c, d: clientDebt(c) }));
  const group = payerGroupDebt(p);
  const active = rows.filter((r) => r.c.status === "ACTIVE");
  const monthly = active.reduce((a, r) => a + r.d.monthly, 0) + p.groupPrice;
  const debt = active.reduce((a, r) => a + (r.d.amount ?? 0), 0) + (group.amount ?? 0);
  const unknown = active.filter((r) => r.d.amount == null && r.d.monthly > 0).length;

  return (
    <>
      <PageHeader title={p.name} sub={[p.phone, p.note].filter(Boolean).join(" · ") || "Плательщик"}>
        <Link href="/payers" className="btn-ghost">← Плательщики</Link>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Компаний действует" value={`${active.length} / ${p.clients.length}`} />
        <Stat label="В месяц" value={money(monthly)} />
        <Stat label="Долг" value={money(debt)} tone={debt ? "text-red" : "text-ok"} />
        <Stat label="Без данных об оплате" value={unknown} tone={unknown ? "text-warn" : ""} />
      </div>

      {p.groupPrice > 0 && (
        <div className="card mb-6 text-sm">
          <b>Групповой тариф:</b> {money(p.groupPrice)} в месяц за все компании. Оплачено по: <b>{monthLabel(p.paidUntil)}</b>
          {group.amount == null ? <span className="text-warn"> — нет данных об оплате</span> : group.amount > 0 && <span className="text-red"> — долг {money(group.amount)} ({group.months} мес.)</span>}
        </div>
      )}

      <section className="card mb-6">
        <h2 className="mb-1 font-semibold">Внести оплату</h2>
        <p className="mb-4 text-sm text-muted">Отмечает «оплачено по выбранный месяц» у всех действующих компаний плательщика{p.groupPrice > 0 ? " и у группового тарифа" : ""}. Сумму можно не указывать, если нужно только сдвинуть месяц.</p>
        <form action={payerPayment} className="grid gap-3 sm:grid-cols-6">
          <input type="hidden" name="payerId" value={p.id} />
          <Field label="Оплачено по месяц"><input name="period" type="month" required defaultValue={currentPeriod()} className="input" /></Field>
          <Field label="Сумма, ₸"><input name="amount" inputMode="numeric" defaultValue={monthly || ""} className="input" /></Field>
          <Field label="Дата оплаты"><input name="paidAt" type="date" className="input" /></Field>
          <Field label="Способ"><select name="method" className="input">{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label="Комментарий"><input name="comment" className="input" placeholder="июль-авг на ГБ" /></Field>
          <div className="flex items-end"><button className="btn w-full">Внести</button></div>
        </form>
      </section>

      <section className="card mb-6 overflow-x-auto p-0">
        {rows.length === 0 ? <Empty>Компаний нет</Empty> : (
          <table className="table">
            <thead><tr><th>Компания</th><th>БИН/ИИН</th><th>Прайс</th><th>Оплачено по</th><th>Долг</th><th>Статус</th></tr></thead>
            <tbody>
              {rows.map(({ c, d }) => (
                <tr key={c.id} className={c.status === "ACTIVE" ? "" : "opacity-50"}>
                  <td>
                    <Link href={`/clients/${c.id}`} className="link">{c.name}</Link>
                    {c.needsCheck && <Badge className="ml-2 bg-warn-bg text-warn">проверить</Badge>}
                  </td>
                  <td className="font-mono text-xs">{c.bin}</td>
                  <td className="whitespace-nowrap">{d.monthly ? money(d.monthly) : c.payMethod ?? "—"}</td>
                  <td className="whitespace-nowrap">{monthLabel(c.paidUntil)}</td>
                  <td className="whitespace-nowrap">{d.amount == null ? <span className="text-xs text-warn">нет данных</span> : d.amount > 0 ? <Badge className="bg-red-bg text-red">{money(d.amount)} · {d.months} мес.</Badge> : "—"}</td>
                  <td className="text-xs">{CLIENT_STATUS_LABEL[c.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {p.payments.length > 0 && (
        <section className="card mb-6">
          <h2 className="mb-3 font-semibold">Оплаты плательщика</h2>
          <table className="table"><tbody>
            {p.payments.map((x) => (
              <tr key={x.id}><td>{date(x.paidAt)}</td><td className="font-medium">{money(x.amount)}</td><td>по {periodLabel(x.period)}</td><td>{x.method}</td><td className="text-xs">{x.comment}</td></tr>
            ))}
          </tbody></table>
        </section>
      )}

      <details className="card">
        <summary className="cursor-pointer font-semibold">Редактировать плательщика</summary>
        <form action={savePayer} className="mt-4 grid gap-3 sm:grid-cols-4">
          <input type="hidden" name="id" value={p.id} />
          <Field label="Имя"><input name="name" required defaultValue={p.name} className="input" /></Field>
          <Field label="Телефон"><input name="phone" defaultValue={p.phone ?? ""} className="input" /></Field>
          <Field label="Групповой тариф, ₸/мес"><input name="groupPrice" inputMode="numeric" defaultValue={p.groupPrice || ""} className="input" /></Field>
          <Field label="Групповой: оплачено по"><input name="paidUntil" type="month" defaultValue={toMonthInput(p.paidUntil)} className="input" /></Field>
          <Field label="Заметка" className="sm:col-span-3"><input name="note" defaultValue={p.note ?? ""} className="input" /></Field>
          <div className="flex items-end"><button className="btn w-full">Сохранить</button></div>
        </form>
      </details>
    </>
  );
}
