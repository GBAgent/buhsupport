"use client";
import { useActionState } from "react";
import { saveClient } from "@/lib/actions/clients";
import { CLIENT_STATUS_LABEL, SOURCES } from "@/lib/format";
import { Field } from "./ui";

type U = { id: string; name: string; role: string };
type C = Partial<Record<
  "id" | "name" | "bin" | "contactName" | "phone" | "email" | "telegram" | "address" | "status" | "source" |
  "referrerId" | "referrerNote" | "accountantId" | "accountantNote" | "notes" | "payerId" | "contractNumber" |
  "contractDate" | "serviceSince" | "paidUntil" | "payMethod" | "payFrom" | "payTo" | "billingNote", string | null>> & { needsCheck?: boolean | string };

export function ClientForm({ client = {}, users, payers }: { client?: C; users: U[]; payers: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(saveClient, null);
  const vals: C = state?.values ?? client;
  const v = (k: Exclude<keyof C, "needsCheck">) => vals[k] ?? "";
  return (
    <form action={action} key={JSON.stringify(state?.values ?? null)} className="space-y-6">
      {client.id && <input type="hidden" name="id" value={client.id} />}
      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Компания</h2>
        <Field label="Название *"><input name="name" required defaultValue={v("name")} className="input" placeholder="ТОО «Ак нар»" /></Field>
        <Field label="БИН / ИИН"><input name="bin" defaultValue={v("bin")} className="input" inputMode="numeric" maxLength={12} placeholder="12 цифр" /></Field>
        <Field label="Контактное лицо"><input name="contactName" defaultValue={v("contactName")} className="input" /></Field>
        <Field label="Телефон"><input name="phone" defaultValue={v("phone")} className="input" placeholder="+7 7__ ___ __ __" /></Field>
        <Field label="Telegram"><input name="telegram" defaultValue={v("telegram")} className="input" placeholder="@username" /></Field>
        <Field label="Почта"><input name="email" type="email" defaultValue={v("email")} className="input" /></Field>
        <Field label="Адрес" className="sm:col-span-2"><input name="address" defaultValue={v("address")} className="input" /></Field>
        <Field label="Статус">
          <select name="status" defaultValue={v("status") || "ACTIVE"} className="input">
            {Object.entries(CLIENT_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
      </section>

      <section className="card grid gap-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Откуда пришёл и кто ведёт</h2>
        <Field label="Плательщик (кто привёл и платит)">
          <select name="payerId" defaultValue={v("payerId")} className="input">
            <option value="">—</option>
            {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <div />
        <Field label="Откуда пришёл">
          <select name="source" defaultValue={v("source")} className="input">
            <option value="">— не указано —</option>
            {SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <div />
        <Field label="Кто привлёк (сотрудник)">
          <select name="referrerId" defaultValue={v("referrerId")} className="input">
            <option value="">—</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field label="…или кто привлёк (партнёр, другой клиент)"><input name="referrerNote" defaultValue={v("referrerNote")} className="input" /></Field>
        <Field label="Бухгалтер (наш сотрудник)">
          <select name="accountantId" defaultValue={v("accountantId")} className="input">
            <option value="">—</option>
            {users.filter((u) => u.role === "ACCOUNTANT" || u.role === "ADMIN").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field label="…или бухгалтер клиента (ФИО, телефон)"><input name="accountantNote" defaultValue={v("accountantNote")} className="input" /></Field>
        <Field label="Заметки" className="sm:col-span-2"><textarea name="notes" rows={3} defaultValue={v("notes")} className="input" /></Field>
      </section>

      <section className="card grid gap-4 sm:grid-cols-3">
        <h2 className="font-semibold sm:col-span-3">Договор и оплата</h2>
        <Field label="№ договора"><input name="contractNumber" defaultValue={v("contractNumber")} className="input" /></Field>
        <Field label="Дата договора"><input name="contractDate" type="date" defaultValue={v("contractDate")} className="input" /></Field>
        <Field label="Обслуживаем с"><input name="serviceSince" type="date" defaultValue={v("serviceSince")} className="input" /></Field>
        <Field label="Оплачено по (месяц)"><input name="paidUntil" type="month" defaultValue={v("paidUntil")} className="input" /></Field>
        <Field label="Способ оплаты">
          <input name="payMethod" list="pay-methods" defaultValue={v("payMethod")} className="input" />
          <datalist id="pay-methods">{["Kaspi", "Безнал", "Наличные", "Бесплатно"].map((m) => <option key={m} value={m} />)}</datalist>
        </Field>
        <div />
        <Field label="Откуда платят (банк / карта)"><input name="payFrom" defaultValue={v("payFrom")} className="input" /></Field>
        <Field label="Куда (наш счёт / карта)"><input name="payTo" defaultValue={v("payTo")} className="input" /></Field>
        <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="needsCheck" defaultChecked={vals.needsCheck === true || vals.needsCheck === "on"} /> Данные требуют проверки</label>
        <Field label="Заметки по оплате" className="sm:col-span-3"><textarea name="billingNote" rows={2} defaultValue={v("billingNote")} className="input" /></Field>
      </section>

      {state?.error && <p className="text-sm text-red">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Сохранение…" : "Сохранить"}</button>
    </form>
  );
}
