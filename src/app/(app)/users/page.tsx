import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ROLE_LABEL, date } from "@/lib/format";
import { UserForm } from "@/components/UserForm";
import { Badge, PageHeader } from "@/components/ui";

export default async function Users() {
  await requireAdmin();
  const users = await db.user.findMany({
    include: { _count: { select: { accountantClients: true, assignedTickets: true, referredClients: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return (
    <>
      <PageHeader title="Сотрудники" sub="Доступ в кабинет по почте и паролю" />
      <div className="card mb-6">
        <h2 className="mb-3 font-semibold">Добавить сотрудника</h2>
        <UserForm />
        <p className="mt-3 text-xs text-muted">
          Администратор — полный доступ. IT-специалист — заявки, клиенты, базы, оплаты. Бухгалтер — видит только своих клиентов и их заявки.
          Telegram-ник нужен, чтобы заявки, взятые в работу в боте, назначались на сотрудника.
        </p>
      </div>
      <div className="space-y-2">
        {users.map((u) => (
          <details key={u.id} className={`card py-3 ${u.active ? "" : "opacity-60"}`}>
            <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">{u.name}</span>
              <span className="text-muted">{u.email}</span>
              <Badge className="bg-paper text-ink">{ROLE_LABEL[u.role]}</Badge>
              {u.telegram && <span className="text-blue">@{u.telegram}</span>}
              {!u.active && <Badge className="bg-soft text-muted">отключён</Badge>}
              <span className="ml-auto text-xs text-muted">
                клиентов: {u._count.accountantClients} · привлёк: {u._count.referredClients} · заявок: {u._count.assignedTickets} · с {date(u.createdAt)}
              </span>
            </summary>
            <div className="mt-3 border-t pt-3"><UserForm u={u} /></div>
          </details>
        ))}
      </div>
    </>
  );
}
