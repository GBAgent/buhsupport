"use client";
import { useActionState } from "react";
import { saveUser } from "@/lib/actions/admin";
import { ROLE_LABEL } from "@/lib/format";
import { Field } from "./ui";

type U = { id: string; email: string; name: string; role: string; telegram: string | null; active: boolean };

export function UserForm({ u }: { u?: U }) {
  const [state, action, pending] = useActionState(saveUser, null);
  const val = (k: "name" | "email" | "role" | "telegram") => state?.values?.[k] ?? u?.[k] ?? undefined;
  return (
    <form action={action} key={JSON.stringify(state?.values ?? null)} className="grid gap-3 sm:grid-cols-6">
      {u && <input type="hidden" name="id" value={u.id} />}
      <Field label="Имя" className="sm:col-span-2"><input name="name" required defaultValue={val("name")} className="input" /></Field>
      <Field label="Почта (логин)" className="sm:col-span-2"><input name="email" type="email" required defaultValue={val("email")} className="input" /></Field>
      <Field label="Роль">
        <select name="role" defaultValue={val("role") ?? "ENGINEER"} className="input">
          {Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <Field label="Telegram"><input name="telegram" defaultValue={val("telegram") ?? ""} className="input" placeholder="@suofur" /></Field>
      <Field label={u ? "Новый пароль (пусто — не менять)" : "Пароль (мин. 8)"} className="sm:col-span-2">
        <input name="password" type="text" autoComplete="new-password" required={!u} minLength={8} className="input" />
      </Field>
      <div className="flex items-end gap-3 sm:col-span-2">
        {u && <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={u.active} /> Доступ включён</label>}
        <button className="btn" disabled={pending}>{u ? "Сохранить" : "Добавить сотрудника"}</button>
      </div>
      <div className="flex items-end text-sm sm:col-span-2">
        {state?.error && <span className="text-red-600">{state.error}</span>}
        {state?.ok && <span className="text-emerald-600">Сохранено</span>}
      </div>
    </form>
  );
}
