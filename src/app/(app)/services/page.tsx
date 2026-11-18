import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { money } from "@/lib/format";
import { saveService } from "@/lib/actions/admin";
import { Badge, Field, PageHeader } from "@/components/ui";

export default async function Services() {
  const user = await requireUser();
  const services = await db.service.findMany({
    include: { _count: { select: { clientServices: { where: { active: true } } } } },
    orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }],
  });
  const isAdmin = user.role === "ADMIN";
  const groups = Object.groupBy(services, (s) => s.category);

  return (
    <>
      <PageHeader title="IT-услуги" sub="Каталог услуг, которые мы оказываем клиентам" />
      <div className="space-y-6">
        {Object.entries(groups).map(([cat, list]) => (
          <section key={cat} className="card">
            <h2 className="mb-3 font-semibold">{cat}</h2>
            <div className="divide-y">
              {list!.map((s) => (
                <details key={s.id} className={`py-2 ${s.active ? "" : "opacity-50"}`}>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
                    <span className="font-medium">{s.name}</span>
                    {s._count.clientServices > 0 && <Badge className="bg-paper text-ink">{s._count.clientServices} клиентов</Badge>}
                    {!s.active && <Badge className="bg-soft text-muted">скрыта</Badge>}
                    <span className="ml-auto">{s.defaultPrice ? money(s.defaultPrice) : "по договорённости"} / {s.unit}</span>
                  </summary>
                  {s.description && <p className="mt-1 text-sm text-muted">{s.description}</p>}
                  {isAdmin && <div className="mt-3"><ServiceForm s={s} /></div>}
                </details>
              ))}
            </div>
          </section>
        ))}
        {isAdmin && (
          <section className="card">
            <h2 className="mb-3 font-semibold">Добавить услугу</h2>
            <ServiceForm />
          </section>
        )}
      </div>
    </>
  );
}

type S = { id: string; name: string; category: string; description: string | null; defaultPrice: number; unit: string; active: boolean };
function ServiceForm({ s }: { s?: S }) {
  return (
    <form action={saveService} className="grid gap-3 sm:grid-cols-6">
      {s && <input type="hidden" name="id" value={s.id} />}
      <Field label="Название" className="sm:col-span-2"><input name="name" required defaultValue={s?.name} className="input" /></Field>
      <Field label="Категория"><input name="category" required defaultValue={s?.category} list="svc-cats" className="input" /></Field>
      <datalist id="svc-cats">{["1С", "Хостинг", "Bitrix24", "ЭЦП / ЭСФ", "IT-аутсорсинг"].map((c) => <option key={c} value={c} />)}</datalist>
      <Field label="Цена, ₸"><input name="defaultPrice" inputMode="numeric" defaultValue={s?.defaultPrice} className="input" /></Field>
      <Field label="Единица">
        <select name="unit" defaultValue={s?.unit ?? "мес"} className="input"><option>мес</option><option>разово</option><option>час</option></select>
      </Field>
      <div className="flex items-end gap-3">
        {s && <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={s.active} /> Активна</label>}
        <button className="btn">{s ? "Сохранить" : "Добавить"}</button>
      </div>
      <Field label="Описание" className="sm:col-span-6"><input name="description" defaultValue={s?.description ?? ""} className="input" /></Field>
    </form>
  );
}
