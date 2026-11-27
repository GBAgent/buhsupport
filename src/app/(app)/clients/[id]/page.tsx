import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CLIENT_STATUS_LABEL, PAY_METHODS, currentPeriod, date, dateTime, money, periodLabel } from "@/lib/format";
import { Badge, Empty, Field, PageHeader, PriorityBadge, StatusBadge } from "@/components/ui";
import { clientDebt, monthLabel } from "@/lib/billing";
import {
  markChecked,
  addClientService, addPayment, deleteBase, deleteClientService, deletePayment, saveBase, toggleClientService,
} from "@/lib/actions/clients";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const c = await db.client.findUnique({
    where: { id },
    include: {
      accountant: true, referrer: true, payer: true,
      services: { include: { service: true }, orderBy: [{ active: "desc" }, { startDate: "desc" }] },
      bases: { orderBy: [{ active: "desc" }, { name: "asc" }] },
      payments: { orderBy: [{ period: "desc" }, { paidAt: "desc" }], take: 24 },
      tickets: { include: { assignee: true }, orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!c || (user.role === "ACCOUNTANT" && c.accountantId !== user.id)) notFound();
  const canEdit = user.role !== "ACCOUNTANT";
  const services = canEdit ? await db.service.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }) : [];

  const monthlyServices = c.services.filter((s) => s.active && s.service.unit === "мес").reduce((a, s) => a + s.price * s.quantity, 0);
  const hosting = c.bases.filter((b) => b.active).reduce((a, b) => a + b.hostingPrice, 0);
  const period = currentPeriod();
  const debt = clientDebt(c);
  const monthly = monthlyServices + hosting;

  return (
    <>
      <PageHeader title={c.name} sub={[c.bin && `БИН/ИИН ${c.bin}`, CLIENT_STATUS_LABEL[c.status]].filter(Boolean).join(" · ")}>
        {c.needsCheck && canEdit && (
          <form action={markChecked}><input type="hidden" name="id" value={c.id} /><button className="btn-red">✓ Данные проверены</button></form>
        )}
        <Link href={`/tickets/new?client=${c.id}`} className="btn-ghost">+ Заявка</Link>
        {canEdit && <Link href={`/clients/${c.id}/edit`} className="btn">Редактировать</Link>}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold">Контакты</h2>
          <Row k="Контакт" v={c.contactName} />
          <Row k="Телефон" v={c.phone} />
          <Row k="Telegram" v={c.telegram && <a className="link" href={`https://t.me/${c.telegram}`} target="_blank">@{c.telegram}</a>} />
          <Row k="Почта" v={c.email} />
          <Row k="Адрес" v={c.address} />
        </div>
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold">Источник и бухгалтер</h2>
          <Row k="Плательщик" v={c.payer && (user.role === "ACCOUNTANT" ? c.payer.name : <Link className="link" href={`/payers/${c.payer.id}`}>{c.payer.name}</Link>)} />
          <Row k="Откуда пришёл" v={c.source} />
          <Row k="Кто привлёк" v={c.referrer?.name ?? c.referrerNote} />
          <Row k="Бухгалтер" v={c.accountant?.name ?? c.accountantNote} />
          <Row k="Клиент с" v={date(c.createdAt)} />
          {c.notes && <p className="whitespace-pre-wrap rounded-lg bg-soft p-2 text-muted">{c.notes}</p>}
        </div>
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold">Ежемесячно</h2>
          <Row k="Услуги (абонентские)" v={money(monthlyServices)} />
          <Row k="Хостинг баз 1С" v={money(hosting)} />
          <div className="flex justify-between border-t pt-2 font-semibold"><span>Итого в месяц</span><span>{money(monthly)}</span></div>
          <Row k="Оплачено по" v={monthLabel(c.paidUntil)} />
          {debt.amount == null
            ? (monthly > 0 && <p className="text-warn">Нет данных об оплате</p>)
            : <div className={`flex justify-between ${debt.amount > 0 ? "text-red" : "text-ok"}`}><span>Долг</span><span>{debt.amount > 0 ? `${money(debt.amount)} · ${debt.months} мес.` : "нет"}</span></div>}
        </div>
      </div>

      {(c.contractNumber || c.contractDate || c.serviceSince || c.payMethod || c.payFrom || c.payTo || c.billingNote || c.needsCheck) && (
        <section className="card mt-6 grid gap-x-8 gap-y-2 text-sm md:grid-cols-2">
          <h2 className="font-semibold md:col-span-2">Договор и оплата {c.needsCheck && <Badge className="ml-2 bg-warn-bg text-warn">требует проверки</Badge>}</h2>
          <Row k="№ договора" v={c.contractNumber} />
          <Row k="Дата договора" v={c.contractDate && date(c.contractDate)} />
          <Row k="Обслуживаем с" v={c.serviceSince && date(c.serviceSince)} />
          <Row k="Способ оплаты" v={c.payMethod} />
          <Row k="Откуда платят" v={c.payFrom} />
          <Row k="Куда платят" v={c.payTo} />
          {c.billingNote && <p className="whitespace-pre-wrap rounded-xl bg-soft p-3 text-xs text-muted md:col-span-2">{c.billingNote}</p>}
        </section>
      )}

      {/* Базы 1С */}
      <section className="card mt-6">
        <h2 className="mb-3 font-semibold">Базы 1С на хостинге</h2>
        {c.bases.length === 0 ? <Empty>Баз нет</Empty> : (
          <div className="space-y-2">
            {c.bases.map((b) => (
              <details key={b.id} className={`rounded-lg border p-3 ${b.active ? "" : "opacity-60"}`}>
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-medium">🗄️ {b.name}</span>
                  <span className="text-muted">{b.configuration} {b.version}</span>
                  <span className="text-muted">{b.mode} · {b.users} польз.</span>
                  {b.server && <span className="text-muted">сервер: {b.server}</span>}
                  <span className="ml-auto font-medium">{money(b.hostingPrice)}/мес</span>
                  {!b.active && <Badge className="bg-soft text-muted">отключена</Badge>}
                  {b.backup && <Badge className="bg-[rgba(30,154,96,.12)] text-ok">бэкап</Badge>}
                </summary>
                {(b.url || b.login) && (
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div className="min-w-0"><span className="text-muted">Ссылка: </span>{b.url ? <a href={b.url} target="_blank" rel="noreferrer" className="link break-all">{b.url}</a> : "—"}</div>
                    {canEdit && <div><span className="text-muted">Пользователь: </span><span className="whitespace-pre-line">{b.login ?? "—"}</span></div>}
                  </div>
                )}
                {b.comment && <p className="mt-2 text-sm text-muted">{b.comment}</p>}
                {canEdit && (
                  <div className="mt-3 border-t pt-3">
                    <BaseForm clientId={c.id} b={b} />
                    <form action={deleteBase} className="mt-2"><input type="hidden" name="id" value={b.id} /><button className="btn-danger">Удалить базу</button></form>
                  </div>
                )}
              </details>
            ))}
          </div>
        )}
        {canEdit && (
          <details className="mt-4">
            <summary className="btn-ghost">+ Добавить базу 1С</summary>
            <div className="mt-3"><BaseForm clientId={c.id} /></div>
          </details>
        )}
      </section>

      {/* Услуги */}
      <section className="card mt-6">
        <h2 className="mb-3 font-semibold">Услуги</h2>
        {c.services.length === 0 ? <Empty>Услуги не подключены</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Услуга</th><th>Цена</th><th>Кол-во</th><th>С</th><th>Статус</th><th>Комментарий</th>{canEdit && <th />}</tr></thead>
              <tbody>
                {c.services.map((s) => (
                  <tr key={s.id} className={s.active ? "" : "opacity-50"}>
                    <td>{s.service.name}<div className="text-xs text-muted">{s.service.category}</div></td>
                    <td>{money(s.price)}<span className="text-xs text-muted"> / {s.service.unit}</span></td>
                    <td>{s.quantity}</td>
                    <td className="text-xs">{date(s.startDate)}{s.endDate && <> — {date(s.endDate)}</>}</td>
                    <td>{s.active ? <Badge className="bg-[rgba(30,154,96,.12)] text-ok">активна</Badge> : <Badge className="bg-soft text-muted">отключена</Badge>}</td>
                    <td className="text-xs">{s.comment}</td>
                    {canEdit && (
                      <td className="whitespace-nowrap">
                        <form action={toggleClientService} className="inline"><input type="hidden" name="id" value={s.id} /><button className="btn-ghost px-2 py-1 text-xs">{s.active ? "Отключить" : "Включить"}</button></form>
                        <form action={deleteClientService} className="inline"><input type="hidden" name="id" value={s.id} /><button className="btn-danger text-xs">✕</button></form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canEdit && (
          <form action={addClientService} className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-6">
            <input type="hidden" name="clientId" value={c.id} />
            <Field label="Услуга" className="sm:col-span-2">
              <select name="serviceId" required className="input">
                {services.map((s) => <option key={s.id} value={s.id}>{s.category}: {s.name} ({money(s.defaultPrice)}/{s.unit})</option>)}
              </select>
            </Field>
            <Field label="Цена, ₸ (пусто = по прайсу)"><input name="price" inputMode="numeric" className="input" /></Field>
            <Field label="Кол-во"><input name="quantity" type="number" min={1} defaultValue={1} className="input" /></Field>
            <Field label="Дата начала"><input name="startDate" type="date" className="input" /></Field>
            <div className="flex items-end"><button className="btn w-full">Подключить</button></div>
            <Field label="Комментарий" className="sm:col-span-6"><input name="comment" className="input" /></Field>
          </form>
        )}
      </section>

      {/* Оплаты */}
      {canEdit && (
        <section className="card mt-6">
          <h2 className="mb-3 font-semibold">Оплаты</h2>
          {c.payments.length === 0 ? <Empty>Оплат пока нет</Empty> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>За период</th><th>Сумма</th><th>Дата оплаты</th><th>Способ</th><th>Комментарий</th>{user.role === "ADMIN" && <th />}</tr></thead>
                <tbody>
                  {c.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{periodLabel(p.period)}</td>
                      <td className="font-medium">{money(p.amount)}</td>
                      <td>{date(p.paidAt)}</td>
                      <td>{p.method}</td>
                      <td className="text-xs">{p.comment}</td>
                      {user.role === "ADMIN" && <td><form action={deletePayment}><input type="hidden" name="id" value={p.id} /><button className="btn-danger text-xs">✕</button></form></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <form action={addPayment} className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-6">
            <input type="hidden" name="clientId" value={c.id} />
            <Field label="Сумма, ₸"><input name="amount" required inputMode="numeric" defaultValue={monthly || ""} className="input" /></Field>
            <Field label="За месяц"><input name="period" type="month" required defaultValue={period} className="input" /></Field>
            <Field label="Дата оплаты"><input name="paidAt" type="date" className="input" /></Field>
            <Field label="Способ">
              <select name="method" className="input">{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
            </Field>
            <Field label="Комментарий"><input name="comment" className="input" /></Field>
            <div className="flex items-end"><button className="btn w-full">Внести оплату</button></div>
          </form>
        </section>
      )}

      {/* Заявки */}
      <section className="card mt-6">
        <h2 className="mb-3 font-semibold">Заявки клиента</h2>
        {c.tickets.length === 0 ? <Empty>Заявок не было</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <tbody>
                {c.tickets.map((t) => (
                  <tr key={t.id}>
                    <td><Link href={`/tickets/${t.number}`} className="link">#{t.number}</Link></td>
                    <td className="text-xs text-muted">{dateTime(t.createdAt)}</td>
                    <td>{t.category}</td>
                    <td className="max-w-md">{t.description}</td>
                    <td><PriorityBadge p={t.priority} /></td>
                    <td><StatusBadge s={t.status} /></td>
                    <td className="text-xs">{t.assignee?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className="text-right">{v || "—"}</span>
    </div>
  );
}

type B = { id: string; name: string; configuration: string | null; version: string | null; server: string | null; url: string | null; login: string | null; mode: string; users: number; hostingPrice: number; backup: boolean; active: boolean; comment: string | null };

function BaseForm({ clientId, b }: { clientId: string; b?: B }) {
  return (
    <form action={saveBase} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="clientId" value={clientId} />
      {b && <input type="hidden" name="id" value={b.id} />}
      <Field label="Название базы *"><input name="name" required defaultValue={b?.name} className="input" placeholder="Бухгалтерия ТОО" /></Field>
      <Field label="Конфигурация">
        <input name="configuration" list="configs" defaultValue={b?.configuration ?? ""} className="input" />
        <datalist id="configs">
          {["Бухгалтерия для Казахстана 3.0", "Зарплата и управление персоналом для Казахстана 3.1", "Управление торговлей для Казахстана 3.4", "Комплексная автоматизация 2", "Розница"].map((x) => <option key={x} value={x} />)}
        </datalist>
      </Field>
      <Field label="Версия релиза"><input name="version" defaultValue={b?.version ?? ""} className="input" placeholder="3.0.45.12" /></Field>
      <Field label="Сервер"><input name="server" defaultValue={b?.server ?? ""} className="input" placeholder="srv1c-01" /></Field>
      <Field label="Ссылка на базу" className="sm:col-span-2"><input name="url" defaultValue={b?.url ?? ""} className="input" placeholder="http://nur-sultan.ddns.net:3333/comkz…" /></Field>
      <Field label="Пользователь(и)"><textarea name="login" rows={1} defaultValue={b?.login ?? ""} className="input" /></Field>
      <Field label="Режим">
        <select name="mode" defaultValue={b?.mode ?? "Файловая"} className="input"><option>Файловая</option><option>Клиент-сервер</option></select>
      </Field>
      <Field label="Пользователей"><input name="users" type="number" min={0} defaultValue={b?.users ?? 1} className="input" /></Field>
      <Field label="Хостинг, ₸/мес"><input name="hostingPrice" inputMode="numeric" defaultValue={b?.hostingPrice ?? ""} className="input" /></Field>
      <div className="flex items-end gap-4 text-sm">
        <label className="flex items-center gap-1"><input type="checkbox" name="backup" defaultChecked={b?.backup ?? true} /> Бэкап</label>
        {b && <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={b.active} /> Активна</label>}
      </div>
      <Field label="Комментарий" className="sm:col-span-3"><input name="comment" defaultValue={b?.comment ?? ""} className="input" /></Field>
      <div className="flex items-end"><button className="btn w-full">{b ? "Сохранить" : "Добавить базу"}</button></div>
    </form>
  );
}
