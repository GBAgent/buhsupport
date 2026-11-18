"use client";
import { useActionState } from "react";
import { changePassword } from "@/lib/actions/admin";
import { Field } from "./ui";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  return (
    <form action={action} className="card max-w-md space-y-3">
      <h2 className="font-semibold">Сменить пароль</h2>
      <Field label="Текущий пароль"><input name="current" type="password" required className="input" autoComplete="current-password" /></Field>
      <Field label="Новый пароль (мин. 8)"><input name="next" type="password" required minLength={8} className="input" autoComplete="new-password" /></Field>
      {state?.error && <p className="text-sm text-red">{state.error}</p>}
      {state?.ok && <p className="text-sm text-ok">Пароль изменён</p>}
      <button className="btn" disabled={pending}>Сменить</button>
    </form>
  );
}
