"use client";
import { useActionState } from "react";
import { importHosting } from "@/lib/actions/import";

export function ImportForm() {
  const [state, action, pending] = useActionState(importHosting, null);
  const r = state?.result;
  return (
    <div className="space-y-4">
      <form action={action} className="card flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <label className="label">Файл реестра (.xlsx)</label>
          <input name="file" type="file" accept=".xlsx" required className="input file:mr-3 file:rounded-full file:border-0 file:bg-ink file:px-3 file:py-1 file:text-white" />
        </div>
        <button className="btn" disabled={pending}>{pending ? "Загружаю… (до минуты)" : "Загрузить"}</button>
      </form>
      {state?.error && <p className="rounded-xl bg-red-bg px-4 py-3 text-sm text-red-d">{state.error}</p>}
      {r && (
        <div className="card space-y-3 text-sm">
          <h2 className="font-semibold">Готово</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <Line k="Клиентов добавлено" v={r.clientsCreated} />
            <Line k="Клиентов обновлено" v={r.clientsUpdated} />
            <Line k="Плательщиков добавлено" v={r.payersCreated} />
            <Line k="Баз 1С добавлено" v={r.basesCreated} />
            <Line k="Баз 1С обновлено" v={r.basesUpdated} />
            <Line k="Групповых тарифов" v={r.groupRows} />
            <Line k="Неопознанных платежей" v={r.unmatchedPayments} />
          </div>
          {[...r.skipped, ...r.warnings].length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-warn">
              {[...r.skipped, ...r.warnings].map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

const Line = ({ k, v }: { k: string; v: number }) => (
  <div className="flex justify-between rounded-xl bg-soft px-3 py-2"><span className="text-muted">{k}</span><span className="font-semibold">{v}</span></div>
);
