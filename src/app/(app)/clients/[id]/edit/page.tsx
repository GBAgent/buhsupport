import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ClientForm } from "@/components/ClientForm";
import { PageHeader } from "@/components/ui";
import { deleteClient } from "@/lib/actions/clients";

export default async function EditClient({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  if (u.role === "ACCOUNTANT") redirect("/clients");
  const { id } = await params;
  const [client, users] = await Promise.all([
    db.client.findUnique({ where: { id } }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } }),
  ]);
  if (!client) notFound();
  return (
    <>
      <PageHeader title={`Редактирование: ${client.name}`}>
        {u.role === "ADMIN" && (
          <form action={deleteClient}>
            <input type="hidden" name="id" value={client.id} />
            <button className="btn-danger">Удалить клиента</button>
          </form>
        )}
      </PageHeader>
      <ClientForm client={client} users={users} />
    </>
  );
}
