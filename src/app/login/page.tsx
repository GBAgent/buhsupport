"use client";
import { useActionState } from "react";
import { login } from "./actions";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <main className="flex min-h-screen flex-col bg-paper">
      <header className="flex items-center justify-between px-5 py-5 md:px-10">
        <Logo />
        <a href="https://glav-buh.kz" className="btn-ghost">glav-buh.kz ↗</a>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
        <p className="mb-5 flex items-center gap-2 text-sm"><span className="dot" /> IT-поддержка клиентов ГлавБух</p>
        <h1 className="mb-10 text-center text-5xl leading-[0.95] font-semibold tracking-[-0.045em] md:text-7xl">
          Кабинет <span className="text-red">поддержки.</span>
        </h1>
        <form action={action} className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 shadow-[0_20px_60px_-20px_rgba(16,21,28,.12)] md:p-8">
          <div>
            <label className="label">Почта</label>
            <input name="email" type="email" required autoComplete="email" defaultValue={state?.email} key={state?.email} className="input" placeholder="name@glav-buh.kz" />
          </div>
          <div>
            <label className="label">Пароль</label>
            <input name="password" type="password" required autoComplete="current-password" className="input" />
          </div>
          {state?.error && <p className="rounded-xl bg-red-bg px-3 py-2 text-sm text-red-d">{state.error}</p>}
          <button className="btn w-full py-3" disabled={pending}>{pending ? "Вход…" : "Войти в кабинет →"}</button>
        </form>
      </div>
    </main>
  );
}
