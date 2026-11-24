"use client";
import { useState, useTransition } from "react";

type Act = () => Promise<{ error?: string; ok?: string }>;

export function ActionButton({ action, label, kind = "btn" }: { action: Act; label: string; kind?: "btn" | "btn-ghost" | "btn-red" }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ error?: string; ok?: string } | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <button className={kind} disabled={pending} onClick={() => start(async () => setRes(await action()))}>
        {pending ? "…" : label}
      </button>
      {res?.ok && <span className="text-xs text-ok">{res.ok}</span>}
      {res?.error && <span className="max-w-md text-xs text-red">{res.error}</span>}
    </span>
  );
}
