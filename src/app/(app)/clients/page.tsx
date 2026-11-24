import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { clientScope, requireUser } from "@/lib/auth";
import { CLIENT_STATUS_LABEL, SOURCES, money } from "@/lib/format";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { clientDebt, monthLabel } from "@/lib/billing";

type SP = Promise<{ q?: string; status?: string; source?: string; accountant?: string; payer?: string; check?: string }>;

export default async function Clients({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim();
  const where: Prisma.ClientWhereInput = {
    ...clientScope(user),
    ...(sp.status ? { status: sp.status as never } : { status: { not: "LEFT" } }),
    ...(sp.source ? { source: sp.source } : {}),
    ...(sp.accountant ? { accountantId: sp.accountant } : {}),
    ...(sp.payer ? { payerId: sp.payer } : {}),
    ...(sp.check ? { needsCheck: true } : {}),
    ...(q ? {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { bin: { contains: q } },
        { contactName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { telegram: { contains: q.replace(/^@/, ""), mode: "insensitive" } },
        { payer: { name: { contains: q, mode: "insensitive" } } },
        { bases: { some: { url: { contains: q, mode: "insensitive" } } } },
      ],
    } : {}),
  };
  const [clients, accountants, payers] = await Promise.all([
    db.client.findMany({
      where,
      include: {
        accountant: true, referrer: true, payer: true,
        bases: { where: { active: true } },
        services: { where: { active: true }, include: { service: true } },
        _count: { select: { tickets: { where: { status: { in: ["NEW", "IN_PROGRESS"] } } } } },
      },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({ where: { role: { in: ["ACCOUNTANT", "ADMIN"] } }, orderBy: { name: "asc" } }),
    db.payer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const checkCount = user.role === "ACCOUNTANT" ? 0 : await db.client.count({ where: { needsCheck: true } });

  return (
    <>
      <PageHeader title="Клиенты" sub={`Найдено: ${clients.length}`}>
        {user.role !== "ACCOUNTANT" && <Link href="/clients/new" className="btn">+ Добавить клиента</Link>}
      </PageHeader>

      {checkCount > 0 && !sp.check && (
        <Link href="/clients?check=1" className="mb-4 flex items-center justify-between rounded-2xl bg-warn-bg px-5 py-3 text-sm text-warn">
          <span><b>{checkCount}</b> клиентов требуют проверки данных (статус или оплата из старых таблиц)</span><span>Показать →</span>
        </Link>
      )}
      <form className="card mb-4 grid gap-3 sm:grid-cols-6">
        {sp.check && <input type="hidden" name="check" value="1" />}
        <input name="q" defaultValue={q} placeholder="Поиск: название, БИН, телефон, @telegram" className="input sm:col-span-2" />
        <select name="payer" defaultValue={sp.payer} className="input">
          <option value="">Все плательщики</option>
          {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="source" defaultValue={sp.source} className="input">
          <option value="">Все источники</option>
          {SOURCES.map((s) => <option key={s}>{s}</option>)}
        </select>
        {user.role !== "ACCOUNTANT" ? (
          <select name="accountant" defaultValue={sp.accountant} className="input">
            <option value="">Все бухгалтеры</option>
            {accountants.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        ) : <div />}
        <div className="flex gap-2">
          <select name="status" defaultValue={sp.status} className="input">
            <option value="">Текущие</option>
            {Object.entries(CLIENT_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button className="btn-ghost">Найти</button>
        </div>
      </form>

      <div className="card overflow-x-auto p-0">
        {clients.length === 0 ? <Empty>Клиентов не найдено</Empty> : (
          <table className="table">
            <thead>
              <tr><th>Клиент</th><th>БИН/ИИН</th><th>Контакт</th><th>Плательщик</th><th>Бухгалтер</th><th>Хостинг</th><th>Оплата</th><th>Заявки</th></tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/clients/${c.id}`} className="link font-medium">{c.name}</Link>
                    {c.status !== "ACTIVE" && <Badge className="ml-2 bg-soft text-muted">{CLIENT_STATUS_LABEL[c.status]}</Badge>}
                  </td>
                  <td className="font-mono text-xs">{c.bin ?? "—"}</td>
                  <td className="text-xs">{c.contactName}{c.phone && <div>{c.phone}</div>}{c.telegram && <div className="text-blue">@{c.telegram}</div>}</td>
                  <td className="text-xs">{c.payer ? (user.role === "ACCOUNTANT" ? c.payer.name : <Link className="link" href={`/payers/${c.payer.id}`}>{c.payer.name}</Link>) : "—"}</td>
                  <td className="text-xs">{c.accountant?.name ?? c.accountantNote ?? "—"}</td>
                  <td className="text-xs whitespace-nowrap">{c.bases.length ? <>{money(c.bases.reduce((a, b) => a + b.hostingPrice, 0))}/мес<div className="text-muted">{c.bases.length} баз</div></> : "—"}</td>
                  <td className="text-xs whitespace-nowrap">
                    {(() => { const d = clientDebt(c); return <>
                      <div>{monthLabel(c.paidUntil)}</div>
                      {d.amount == null ? (d.monthly > 0 && <span className="text-warn">нет данных</span>) : d.amount > 0 && <span className="text-red">долг {money(d.amount)}</span>}
                    </>; })()}
                    {c.needsCheck && <div><Badge className="mt-1 bg-warn-bg text-warn">проверить</Badge></div>}
                  </td>
                  <td>{c._count.tickets ? <Badge className="bg-warn-bg text-warn">{c._count.tickets} откр.</Badge> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
