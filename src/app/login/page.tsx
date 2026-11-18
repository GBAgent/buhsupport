"use client";
import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <form action={action} className="card w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">ГБ</div>
          <h1 className="text-xl font-semibold">ГлавБух Поддержка</h1>
          <p className="text-sm text-slate-500">BuhSupport — вход в кабинет</p>
        </div>
        <div>
          <label className="label">Почта</label>
          <input name="email" type="email" required autoComplete="email" defaultValue={state?.email} key={state?.email} className="input" placeholder="name@glav-buh.kz" />
        </div>
        <div>
          <label className="label">Пароль</label>
          <input name="password" type="password" required autoComplete="current-password" className="input" />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button className="btn w-full" disabled={pending}>{pending ? "Вход…" : "Войти"}</button>
      </form>
    </main>
  );
}
