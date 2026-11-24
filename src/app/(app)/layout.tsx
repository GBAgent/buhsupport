import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/format";
import { Nav } from "@/components/Nav";
import { Logo } from "@/components/Logo";
import { logout } from "../login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const openTickets = await db.ticket.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] } } });

  const items = [
    { href: "/", label: "Главная", icon: "home" },
    { href: "/tickets", label: "Заявки", icon: "bolt", badge: openTickets },
    { href: "/clients", label: "Клиенты", icon: "clients" },
    { href: "/bases", label: "Базы 1С", icon: "db" },
    ...(user.role !== "ACCOUNTANT" ? [{ href: "/payers", label: "Плательщики", icon: "wallet" }, { href: "/payments", label: "Оплаты", icon: "pay" }] : []),
    { href: "/services", label: "Услуги", icon: "tools" },
    ...(user.role === "ADMIN" ? [{ href: "/users", label: "Сотрудники", icon: "users" }, { href: "/import", label: "Импорт", icon: "upload" }, { href: "/telegram", label: "Telegram", icon: "send" }] : []),
  ];
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 z-10 border-b border-line bg-white px-3 py-3 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-r md:border-b-0 md:px-4 md:py-6">
        <div className="mb-3 flex items-center justify-between px-2 md:mb-8 md:block">
          <Link href="/"><Logo /></Link>
          <form action={logout} className="md:hidden"><button className="text-sm text-muted">Выйти</button></form>
        </div>
        <Nav items={items} />
        <div className="mt-auto hidden md:block">
          <Link href="/profile" className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-paper">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{initials}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block truncate text-xs text-muted">{ROLE_LABEL[user.role]}</span>
            </span>
          </Link>
          <form action={logout}>
            <button className="mt-1 w-full cursor-pointer rounded-full px-3 py-2 text-left text-sm text-muted transition hover:bg-paper hover:text-ink">Выйти →</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-10">
        <div className="mx-auto max-w-[1280px]">{children}</div>
      </main>
    </div>
  );
}
