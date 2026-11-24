import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ClientForm } from "@/components/ClientForm";
import { PageHeader } from "@/components/ui";

export default async function NewClient() {
  const u = await requireUser();
  if (u.role === "ACCOUNTANT") redirect("/clients");
  const users = await db.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, role: true } });
  return (
    <>
      <PageHeader title="Новый клиент" />
      <ClientForm users={users} payers={await db.payer.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })} />
    </>
  );
}
