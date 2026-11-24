import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { clientDebt, payerGroupDebt } from "@/lib/billing";
import { money } from "@/lib/format";
import { savePayer } from "@/lib/actions/payments";
import { Badge, Empty, Field, PageHeader, Stat } from "@/components/ui";

export default async function Payers({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const user = await requireUser();
  if (user.role === "ACCOUNTANT") redirect("/");
  const sp = await searchParams;
  const q = sp.q?.trim();
  const payers = await db.payer.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {},
    include: { clients: { include: { bases: true, services: { include: { service: true } } } } },
    orderBy: { name: "asc" },
  });
  const rows = payers.map((p) => {
    const active = p.clients.filter((c) => c.status === "ACTIVE");
    const debts = active.map(clientDebt);
    const group = payerGroupDebt(p);
    const monthly = debts.reduce((a, d) => a + d.monthly, 0) + p.groupPrice;
    const known = debts.reduce((a, d) => a + (d.amount ?? 0), 0) + (group.amount ?? 0);
    const unknown = debts.filter((d) => d.amount == null).length + (group.amount == null ? 1 : 0);
    return { p, total: p.clients.length, active: active.length, monthly, debt: known, unknown, check: p.clients.filter((c) => c.needsCheck).length };
  })
    .filter((r) => (sp.filter === "debt" ? r.debt > 0 : sp.filter === "unknown" ? r.unknown > 0 : true))
    .sort((a, b) => b.debt - a.debt || b.active - a.active);

  return (
    <>
      <PageHeader title="Плательщики" sub="Кто приводит и оплачивает компании — бухгалтеры, группы, партнёры" />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Плательщиков" value={payers.length} />
        <Stat label="В месяц по всем" value={money(rows.reduce((a, r) => a + r.monthly, 0))} />
        <Stat label="Долг (известный)" value={money(rows.reduce((a, r) => a + r.debt, 0))} tone="text-red" />
        <Stat label="Нет данных об оплате" value={`${rows.reduce((a, r) => a + r.unknown, 0)} комп.`} tone="text-warn" />
      </div>
      <form className="card mb-4 flex flex-wrap gap-3">
        <input name="q" defaultValue={q} placeholder="Имя или телефон" className="input max-w-xs" />
        <select name="filter" defaultValue={sp.filter} className="input max-w-xs">
          <option value="">Все</option><option value="debt">С долгом</option><option value="unknown">Нет данных об оплате</option>
        </select>
        <button className="btn-ghost">Показать</button>
      </form>
      <div className="card overflow-x-auto p-0">
        {rows.length === 0 ? <Empty>Плательщиков нет. Загрузите реестр в разделе «Импорт» или добавьте ниже.</Empty> : (
          <table className="table">
            <thead><tr><th>Плательщик</th><th>Телефон</th><th>Компаний</th><th>В месяц</th><th>Долг</th><th>Проверить</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.p.id}>
                  <td>
                    <Link href={`/payers/${r.p.id}`} className="link">{r.p.name}</Link>
                    {r.p.groupPrice > 0 && <Badge className="ml-2 bg-blue-bg text-blue">группа {money(r.p.groupPrice)}</Badge>}
                  </td>
                  <td className="text-xs">{r.p.phone ?? "—"}</td>
                  <td>{r.active}<span className="text-xs text-muted"> / {r.total}</span></td>
                  <td className="whitespace-nowrap">{money(r.monthly)}</td>
                  <td className="whitespace-nowrap">
                    {r.debt > 0 ? <Badge className="bg-red-bg text-red">{money(r.debt)}</Badge> : <span className="text-ok">0 ₸</span>}
                    {r.unknown > 0 && <div className="text-xs text-warn">+ {r.unknown} без данных</div>}
                  </td>
                  <td>{r.check > 0 && <Badge className="bg-warn-bg text-warn">{r.check}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <details className="card mt-6">
        <summary className="cursor-pointer font-semibold">+ Добавить плательщика</summary>
        <form action={savePayer} className="mt-4 grid gap-3 sm:grid-cols-4">
          <Field label="Имя *"><input name="name" required className="input" /></Field>
          <Field label="Телефон"><input name="phone" className="input" /></Field>
          <Field label="Групповой тариф, ₸/мес (0 — по базам)"><input name="groupPrice" inputMode="numeric" className="input" /></Field>
          <div className="flex items-end"><button className="btn w-full">Добавить</button></div>
          <Field label="Заметка" className="sm:col-span-4"><input name="note" className="input" /></Field>
        </form>
      </details>
    </>
  );
}
