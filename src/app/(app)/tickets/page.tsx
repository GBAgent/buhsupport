import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { STATUS_LABEL, TICKET_CATEGORIES, dateTime } from "@/lib/format";
import { Empty, PageHeader, PriorityBadge, StatusBadge } from "@/components/ui";

type SP = Promise<{ status?: string; q?: string; assignee?: string; category?: string }>;

export default async function Tickets({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim();
  const status = sp.status ?? "OPEN";
  const where: Prisma.TicketWhereInput = {
    ...(user.role === "ACCOUNTANT" ? { client: { accountantId: user.id } } : {}),
    ...(status === "OPEN" ? { status: { in: ["NEW", "IN_PROGRESS"] } } : status === "ALL" ? {} : { status: status as never }),
    ...(sp.assignee === "me" ? { assigneeId: user.id } : sp.assignee ? { assigneeId: sp.assignee } : {}),
    ...(sp.category ? { category: sp.category } : {}),
    ...(q ? {
      OR: [
        ...(/^\d+$/.test(q) && q.length < 9 ? [{ number: Number(q) }] : []),
        { company: { contains: q, mode: "insensitive" } },
        { bin: { contains: q } },
        { description: { contains: q, mode: "insensitive" } },
        { contact: { contains: q, mode: "insensitive" } },
        { client: { name: { contains: q, mode: "insensitive" } } },
      ],
    } : {}),
  };
  const [tickets, staff] = await Promise.all([
    db.ticket.findMany({
      where, include: { client: true, assignee: true },
      orderBy: [{ createdAt: "desc" }], take: 200,
    }),
    db.user.findMany({ where: { active: true, role: { not: "ACCOUNTANT" } }, orderBy: { name: "asc" } }),
  ]);

  const tabs = [["OPEN", "Открытые"], ["NEW", "Новые"], ["IN_PROGRESS", "В работе"], ["DONE", "Выполнено"], ["ALL", "Все"]];
  const qs = (s: string) => new URLSearchParams({ ...sp, status: s } as Record<string, string>).toString();

  return (
    <>
      <PageHeader title="Заявки" sub="Заявки из Telegram-бота и кабинета">
        <Link href="/tickets/new" className="btn">+ Новая заявка</Link>
      </PageHeader>

      <div className="mb-3 flex flex-wrap gap-1">
        {tabs.map(([k, l]) => (
          <Link key={k} href={`/tickets?${qs(k)}`} className={`rounded-full px-4 py-2 text-sm font-medium transition ${status === k ? "bg-ink text-white" : "bg-white text-ink hover:bg-soft"}`}>{l}</Link>
        ))}
      </div>

      <form className="card mb-4 grid gap-3 sm:grid-cols-4">
        <input type="hidden" name="status" value={status} />
        <input name="q" defaultValue={q} placeholder="№, компания, БИН, описание, @контакт" className="input sm:col-span-2" />
        <select name="category" defaultValue={sp.category} className="input">
          <option value="">Все категории</option>
          {TICKET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="flex gap-2">
          <select name="assignee" defaultValue={sp.assignee} className="input">
            <option value="">Все исполнители</option>
            <option value="me">Мои</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn-ghost">Найти</button>
        </div>
      </form>

      <div className="card overflow-x-auto p-0">
        {tickets.length === 0 ? <Empty>Заявок нет</Empty> : (
          <table className="table">
            <thead><tr><th>№</th><th>Компания</th><th>Категория</th><th>Описание</th><th>Приоритет</th><th>Статус</th><th>Исполнитель</th><th>Создана</th></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td><Link href={`/tickets/${t.number}`} className="link font-medium">#{t.number}</Link></td>
                  <td>
                    {t.client ? <Link href={`/clients/${t.client.id}`} className="link">{t.client.name}</Link> : <span>{t.company ?? "—"}</span>}
                    <div className="font-mono text-xs text-muted">{t.bin}</div>
                    {!t.client && <div className="text-xs text-warn">не привязан к клиенту</div>}
                  </td>
                  <td className="text-xs">{t.category}</td>
                  <td className="max-w-xs"><div className="line-clamp-2">{t.description}</div><div className="text-xs text-muted">{t.contact} {t.source === "telegram" && "· Telegram"}</div></td>
                  <td><PriorityBadge p={t.priority} /></td>
                  <td><StatusBadge s={t.status} /></td>
                  <td className="text-xs">{t.assignee?.name ?? (t.assigneeTg ? `@${t.assigneeTg}` : "—")}</td>
                  <td className="whitespace-nowrap text-xs text-muted">{dateTime(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">Статусы: {Object.values(STATUS_LABEL).join(" · ")}</p>
    </>
  );
}
