import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PRIORITY_LABEL, STATUS_LABEL, TICKET_CATEGORIES, dateTime } from "@/lib/format";
import { takeTicket, updateTicket } from "@/lib/actions/tickets";
import { Field, PageHeader, PriorityBadge, StatusBadge } from "@/components/ui";

export default async function TicketPage({ params }: { params: Promise<{ number: string }> }) {
  const user = await requireUser();
  const { number } = await params;
  const n = Number(number);
  if (!Number.isInteger(n)) notFound();
  const t = await db.ticket.findUnique({
    where: { number: n },
    include: { client: true, assignee: true, comments: { include: { author: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!t || (user.role === "ACCOUNTANT" && t.client?.accountantId !== user.id)) notFound();
  const [staff, clients] = await Promise.all([
    db.user.findMany({ where: { active: true, role: { not: "ACCOUNTANT" } }, orderBy: { name: "asc" } }),
    db.client.findMany({ where: { status: { not: "LEFT" } }, orderBy: { name: "asc" }, select: { id: true, name: true, bin: true } }),
  ]);

  return (
    <>
      <PageHeader title={`Заявка #${t.number}`} sub={`${dateTime(t.createdAt)} · источник: ${t.source}`}>
        {t.status === "NEW" && user.role !== "ACCOUNTANT" && (
          <form action={takeTicket}><input type="hidden" name="id" value={t.id} /><button className="btn">🔧 Взять в работу</button></form>
        )}
        <Link href="/tickets" className="btn-ghost">← К заявкам</Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card space-y-3">
            <div className="flex flex-wrap gap-2"><StatusBadge s={t.status} /><PriorityBadge p={t.priority} /><span className="text-sm text-slate-500">{t.category}</span></div>
            <p className="whitespace-pre-wrap text-base">{t.description}</p>
            <div className="grid gap-2 border-t pt-3 text-sm sm:grid-cols-2">
              <div><span className="text-slate-500">Компания: </span>{t.client ? <Link className="link" href={`/clients/${t.client.id}`}>{t.client.name}</Link> : t.company ?? "—"}</div>
              <div><span className="text-slate-500">БИН/ИИН: </span><span className="font-mono">{t.bin ?? t.client?.bin ?? "—"}</span></div>
              <div><span className="text-slate-500">Клиент: </span>{t.contact?.startsWith("@") ? <a className="link" target="_blank" href={`https://t.me/${t.contact.slice(1)}`}>{t.contact}</a> : t.contact ?? "—"}</div>
              <div><span className="text-slate-500">Исполнитель: </span>{t.assignee?.name ?? "—"}</div>
              {t.closedAt && <div><span className="text-slate-500">Закрыта: </span>{dateTime(t.closedAt)}</div>}
            </div>
            {!t.client && t.bin && user.role !== "ACCOUNTANT" && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                Клиента с БИН {t.bin} нет в базе. <Link className="link" href="/clients/new">Добавить клиента</Link> — заявки с этим БИН привяжутся автоматически.
              </p>
            )}
          </div>

          <div className="card">
            <h2 className="mb-3 font-semibold">История</h2>
            <ul className="space-y-3">
              {t.comments.map((c) => (
                <li key={c.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                  <div className="mb-1 text-xs text-slate-500">{c.author?.name ?? "Бот"} · {dateTime(c.createdAt)}</div>
                  <div className="whitespace-pre-wrap">{c.text}</div>
                </li>
              ))}
              {t.comments.length === 0 && <li className="text-sm text-slate-400">Пока пусто</li>}
            </ul>
          </div>
        </div>

        {user.role !== "ACCOUNTANT" && (
          <form action={updateTicket} className="card h-fit space-y-3">
            <input type="hidden" name="id" value={t.id} />
            <h2 className="font-semibold">Обработка</h2>
            <Field label="Статус">
              <select name="status" defaultValue={t.status} className="input">
                {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Исполнитель">
              <select name="assigneeId" defaultValue={t.assigneeId ?? ""} className="input">
                <option value="">— не назначен —</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Приоритет">
              <select name="priority" defaultValue={t.priority} className="input">
                {Object.entries(PRIORITY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Категория">
              <select name="category" defaultValue={t.category} className="input">
                {[...new Set([t.category, ...TICKET_CATEGORIES])].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Клиент">
              <select name="clientId" defaultValue={t.clientId ?? ""} className="input">
                <option value="">— не привязан —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.bin ? ` · ${c.bin}` : ""}</option>)}
              </select>
            </Field>
            <Field label="Комментарий"><textarea name="comment" rows={3} className="input" placeholder="Что сделано…" /></Field>
            <button className="btn w-full">Сохранить</button>
          </form>
        )}
      </div>
    </>
  );
}
