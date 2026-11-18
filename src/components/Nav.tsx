"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Item = { href: string; label: string; icon: string; badge?: number };

export function Nav({ items }: { items: Item[] }) {
  const path = usePathname();
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [path]);
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map((i) => {
        const current = pending ?? path;
        const active = i.href === "/" ? current === "/" : current.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            onClick={() => setPending(i.href)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              active ? "bg-brand-600 text-white" : "text-slate-300 hover:bg-white/10"
            }`}
          >
            <span>{i.icon}</span>
            <span className="flex-1">{i.label}</span>
            {!!i.badge && (
              <span className="rounded-full bg-amber-400 px-2 text-xs font-semibold text-slate-900">{i.badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
