import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const s = await verifySession(token);
  if (!s) return null;
  const user = await db.user.findUnique({ where: { id: s.uid } });
  if (!user || !user.active) return null;
  return user;
});

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "ADMIN") redirect("/");
  return u;
}

/** Бухгалтер видит только своих клиентов */
export function clientScope(u: { id: string; role: string }) {
  return u.role === "ACCOUNTANT" ? { accountantId: u.id } : {};
}
