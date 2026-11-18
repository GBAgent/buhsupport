import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/format";
import { PasswordForm } from "@/components/PasswordForm";
import { PageHeader } from "@/components/ui";

export default async function Profile() {
  const u = await requireUser();
  return (
    <>
      <PageHeader title="Профиль" sub={`${u.name} · ${u.email} · ${ROLE_LABEL[u.role]}`} />
      <PasswordForm />
    </>
  );
}
