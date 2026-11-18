import { db } from "@/lib/db";
import { clientScope, requireUser } from "@/lib/auth";
import { PRIORITY_LABEL, TICKET_CATEGORIES } from "@/lib/format";
import { createTicket } from "@/lib/actions/tickets";
import { Field, PageHeader } from "@/components/ui";

export default async function NewTicket({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [clients, staff] = await Promise.all([
    db.client.findMany({ where: { status: { not: "LEFT" }, ...clientScope(user) }, orderBy: { name: "asc" }, select: { id: true, name: true, bin: true } }),
    db.user.findMany({ where: { active: true, role: { not: "ACCOUNTANT" } }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Новая заявка" />
      <form action={createTicket} className="card grid max-w-3xl gap-4 sm:grid-cols-2">
        <Field label="Клиент" className="sm:col-span-2">
          <select name="clientId" defaultValue={sp.client ?? ""} className="input">
            <option value="">— новый / не в базе (заполните ниже) —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.bin ? ` · ${c.bin}` : ""}</option>)}
          </select>
        </Field>
        <Field label="Компания (если нет в базе)"><input name="company" className="input" /></Field>
        <Field label="БИН/ИИН (если нет в базе)"><input name="bin" className="input" maxLength={12} /></Field>
        <Field label="Категория">
          <select name="category" className="input">{TICKET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Приоритет">
          <select name="priority" defaultValue="MEDIUM" className="input">
            {Object.entries(PRIORITY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Описание *" className="sm:col-span-2"><textarea name="description" required rows={4} className="input" placeholder="Не открывается база…" /></Field>
        <Field label="Контакт (@telegram / телефон)"><input name="contact" className="input" /></Field>
        <Field label="Источник">
          <select name="source" className="input"><option value="web">Кабинет</option><option value="phone">Звонок</option><option value="whatsapp">WhatsApp</option><option value="telegram">Telegram</option></select>
        </Field>
        <Field label="Исполнитель">
          <select name="assigneeId" defaultValue={user.role !== "ACCOUNTANT" ? user.id : ""} className="input">
            <option value="">— не назначен —</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <div className="flex items-end"><button className="btn w-full">Создать заявку</button></div>
      </form>
    </>
  );
}
