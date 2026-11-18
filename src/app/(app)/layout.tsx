import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/format";
import { Nav } from "@/components/Nav";
import { logout } from "../login/actions";
import Link from "next/link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const openTickets = await db.ticket.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] } } });

  const items = [
    { href: "/", label: "Главная", icon: "📊" },
    { href: "/tickets", label: "Заявки", icon: "⚡", badge: openTickets },
    { href: "/clients", label: "Клиенты", icon: "🏢" },
    { href: "/bases", label: "Базы 1С", icon: "🗄️" },
    ...(user.role !== "ACCOUNTANT" ? [{ href: "/payments", label: "Оплаты", icon: "💳" }] : []),
    { href: "/services", label: "Услуги", icon: "🧰" },
    ...(user.role === "ADMIN" ? [{ href: "/users", label: "Сотрудники", icon: "👥" }] : []),
  ];

  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-slate-900 p-3 md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:p-4">
        <Link href="/" className="mb-4 hidden items-center gap-2 px-2 md:flex">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">ГБ</span>
          <span className="leading-tight text-white">
            <span className="block text-sm font-semibold">ГлавБух Поддержка</span>
            <span className="block text-xs text-slate-400">BuhSupport</span>
          </span>
        </Link>
        <Nav items={items} />
        <div className="mt-auto hidden border-t border-white/10 pt-3 md:block">
          <Link href="/profile" className="block rounded-lg px-2 py-1 hover:bg-white/10">
            <div className="truncate text-sm text-white">{user.name}</div>
            <div className="truncate text-xs text-slate-400">{user.email} · {ROLE_LABEL[user.role]}</div>
          </Link>
          <form action={logout}>
            <button className="mt-2 w-full rounded-lg px-2 py-1 text-left text-sm text-slate-400 hover:bg-white/10 hover:text-white">Выйти</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mb-4 flex justify-end gap-3 text-sm md:hidden">
          <Link href="/profile" className="link">{user.email}</Link>
          <form action={logout}><button className="text-slate-500">Выйти</button></form>
        </div>
        {children}
      </main>
    </div>
  );
}
