"use client";
import { useState } from "react";

/** Пароль скрыт, пока не нажмёшь «показать» */
export function Secret({ value }: { value: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex items-start gap-2">
      <span className="font-mono whitespace-pre-line">{open ? value : "••••••••"}</span>
      <button type="button" onClick={() => setOpen(!open)} className="cursor-pointer text-xs text-muted underline">{open ? "скрыть" : "показать"}</button>
      {open && <button type="button" onClick={() => navigator.clipboard?.writeText(value)} className="cursor-pointer text-xs text-muted underline">копировать</button>}
    </span>
  );
}
