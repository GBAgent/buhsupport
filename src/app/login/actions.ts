"use server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

export async function login(_: unknown, fd: FormData) {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");

  if (!process.env.AUTH_SECRET) {
    return { error: "Сервер не настроен: не задана переменная AUTH_SECRET", email };
  }
  let user;
  try {
    user = await db.user.findUnique({ where: { email } });
  } catch (e) {
    console.error("login: db error", e);
    const msg = String((e as Error).message);
    return {
      error: msg.includes("does not exist")
        ? "База данных пуста: не выполнены миграции. Пересоберите проект (Redeploy)."
        : "Нет подключения к базе данных. Проверьте DATABASE_URL на Vercel.",
      email,
    };
  }
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Неверная почта или пароль", email };
  }
  (await cookies()).set(SESSION_COOKIE, await signSession({ uid: user.id, role: user.role }), sessionCookieOptions);
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
