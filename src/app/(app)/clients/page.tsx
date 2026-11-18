import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { clientScope, requireUser } from "@/lib/auth";
import { CLIENT_STATUS_LABEL, SOURCES, money } from "@/lib/format";
import { Badge, Empty, PageHeader } from "@/components/ui";

type SP = Promise<{ q?: string; status?: string; source?: string; accountant?: string }>;

export default async function Clients({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim();
  const where: Prisma.ClientWhereInput = {
    ...clientScope(user),
    ...(sp.status ? { status: sp.status as never } : { status: { not: "LEFT" } }),
    ...(sp.source ? { source: sp.source } : {}),
    ...(sp.accountant ? { accountantId: sp.accountant } : {}),
    ...(q ? {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { bin: { contains: q } },
        { contactName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { telegram: { contains: q.replace(/^@/, ""), mode: "insensitive" } },
      ],
    } : {}),
  };
  const [clients, accountants] = await Promise.all([
    db.client.findMany({
      where,
      include: {
        accountant: true, referrer: true,
        bases: { where: { active: true } },
        _count: { select: { tickets: { where: { status: { in: ["NEW", "IN_PROGRESS"] } } } } },
      },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({ where: { role: { in: ["ACCOUNTANT", "ADMIN"] } }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Клиенты" sub={`Найдено: ${clients.length}`}>
        {user.role !== "ACCOUNTANT" && <Link href="/clients/new" className="btn">+ Добавить клиента</Link>}
      </PageHeader>

      <form className="card mb-4 grid gap-3 sm:grid-cols-5">
        <input name="q" defaultValue={q} placeholder="Поиск: название, БИН, телефон, @telegram" className="input sm:col-span-2" />
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
              <tr><th>Клиент</th><th>БИН/ИИН</th><th>Контакт</th><th>Откуда / кто привлёк</th><th>Бухгалтер</th><th>Базы 1С</th><th>Заявки</th></tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/clients/${c.id}`} className="link font-medium">{c.name}</Link>
                    {c.status !== "ACTIVE" && <Badge className="ml-2 bg-slate-200 text-slate-600">{CLIENT_STATUS_LABEL[c.status]}</Badge>}
                  </td>
                  <td className="font-mono text-xs">{c.bin ?? "—"}</td>
                  <td className="text-xs">{c.contactName}{c.phone && <div>{c.phone}</div>}{c.telegram && <div className="text-brand-600">@{c.telegram}</div>}</td>
                  <td className="text-xs">{c.source ?? "—"}<div className="text-slate-500">{c.referrer?.name ?? c.referrerNote}</div></td>
                  <td className="text-xs">{c.accountant?.name ?? c.accountantNote ?? "—"}</td>
                  <td className="text-xs">{c.bases.length ? <>{c.bases.length} шт.<div className="text-slate-500">{money(c.bases.reduce((a, b) => a + b.hostingPrice, 0))}/мес</div></> : "—"}</td>
                  <td>{c._count.tickets ? <Badge className="bg-amber-100 text-amber-800">{c._count.tickets} откр.</Badge> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
