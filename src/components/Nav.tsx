"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Item = { href: string; label: string; icon: string; badge?: number };

export function Nav({ items }: { items: Item[] }) {
  const path = usePathname();
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [path]);
  return (
    <>
    {pending && pending !== path && (
      <div className="fixed inset-x-0 top-0 z-50 h-[3px] overflow-hidden bg-red/15">
        <div className="h-full w-1/3 animate-[navbar_1s_ease-in-out_infinite] bg-red" />
      </div>
    )}
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map((i) => {
        const current = pending ?? path;
        const active = i.href === "/" ? current === "/" : current.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            onClick={() => setPending(i.href)}
            className={`flex shrink-0 items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium transition ${
              active ? "bg-ink text-white" : "text-ink hover:bg-paper"
            }`}
          >
            <Icon name={i.icon} />
            <span className="flex-1">{i.label}</span>
            {!!i.badge && (
              <span className="min-w-5 rounded-full bg-red px-1.5 text-center text-[11px] leading-5 font-semibold text-white">{i.badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
    </>
  );
}
