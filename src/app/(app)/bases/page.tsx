import Link from "next/link";
import { db } from "@/lib/db";
import { clientScope, requireUser } from "@/lib/auth";
import { money } from "@/lib/format";
import { Badge, Empty, PageHeader, Stat } from "@/components/ui";

export default async function Bases({ searchParams }: { searchParams: Promise<{ q?: string; server?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim();
  const bases = await db.base1C.findMany({
    where: {
      client: clientScope(user),
      ...(sp.server ? { server: sp.server } : {}),
      ...(q ? { OR: [
        { name: { contains: q, mode: "insensitive" } },
        { configuration: { contains: q, mode: "insensitive" } },
        { client: { name: { contains: q, mode: "insensitive" } } },
      ] } : {}),
    },
    include: { client: true },
    orderBy: [{ active: "desc" }, { client: { name: "asc" } }],
  });
  const active = bases.filter((b) => b.active);
  const servers = [...new Set(bases.map((b) => b.server).filter(Boolean))] as string[];

  return (
    <>
      <PageHeader title="Базы 1С" sub="Все базы клиентов на нашем хостинге" />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Активных баз" value={active.length} />
        <Stat label="Пользователей 1С" value={active.reduce((a, b) => a + b.users, 0)} />
        <Stat label="Хостинг в месяц" value={money(active.reduce((a, b) => a + b.hostingPrice, 0))} />
        <Stat label="Без бэкапа" value={active.filter((b) => !b.backup).length} tone={active.some((b) => !b.backup) ? "text-red-600" : ""} />
      </div>
      <form className="card mb-4 flex flex-wrap gap-3">
        <input name="q" defaultValue={q} placeholder="База, конфигурация, клиент" className="input max-w-sm" />
        <select name="server" defaultValue={sp.server} className="input max-w-xs">
          <option value="">Все серверы</option>
          {servers.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="btn-ghost">Найти</button>
      </form>
      <div className="card overflow-x-auto p-0">
        {bases.length === 0 ? <Empty>Баз нет. Базы добавляются в карточке клиента.</Empty> : (
          <table className="table">
            <thead><tr><th>Клиент</th><th>База</th><th>Конфигурация</th><th>Сервер</th><th>Режим</th><th>Польз.</th><th>Хостинг</th><th /></tr></thead>
            <tbody>
              {bases.map((b) => (
                <tr key={b.id} className={b.active ? "" : "opacity-50"}>
                  <td><Link href={`/clients/${b.clientId}`} className="link">{b.client.name}</Link></td>
                  <td className="font-medium">{b.name}</td>
                  <td className="text-xs">{b.configuration}<div className="text-slate-500">{b.version}</div></td>
                  <td className="text-xs">{b.server ?? "—"}</td>
                  <td className="text-xs">{b.mode}</td>
                  <td>{b.users}</td>
                  <td className="whitespace-nowrap">{money(b.hostingPrice)}</td>
                  <td>{!b.active ? <Badge className="bg-slate-200">откл.</Badge> : !b.backup ? <Badge className="bg-red-100 text-red-700">нет бэкапа</Badge> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
