"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { bool, int, req, str } from "@/lib/forms";
import type { Role } from "@prisma/client";

export async function saveUser(_: unknown, fd: FormData) {
  const admin = await requireAdmin();
  const id = str(fd, "id");
  const values = { name: str(fd, "name"), email: str(fd, "email"), role: str(fd, "role"), telegram: str(fd, "telegram") };
  const email = req(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const role = (str(fd, "role") ?? "ENGINEER") as Role;
  if (id === admin.id && role !== "ADMIN") return { error: "Нельзя снять с себя роль администратора", values };
  const data = {
    email,
    name: req(fd, "name"),
    role,
    telegram: str(fd, "telegram")?.replace(/^@/, "") ?? null,
    active: id === admin.id ? true : bool(fd, "active"),
  };
  try {
    if (id) {
      await db.user.update({
        where: { id },
        data: { ...data, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
      });
    } else {
      if (!password || password.length < 8) return { error: "Пароль — минимум 8 символов", values };
      await db.user.create({ data: { ...data, active: true, passwordHash: await bcrypt.hash(password, 10) } });
    }
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") return { error: "Пользователь с такой почтой уже есть", values };
    return { error: (e as Error).message, values };
  }
  revalidatePath("/users");
  return { ok: true };
}

export async function changePassword(_: unknown, fd: FormData) {
  const u = await requireUser();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (!(await bcrypt.compare(current, u.passwordHash))) return { error: "Текущий пароль неверный" };
  if (next.length < 8) return { error: "Новый пароль — минимум 8 символов" };
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  return { ok: true };
}

export async function saveService(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "id");
  const data = {
    name: req(fd, "name"),
    category: req(fd, "category"),
    description: str(fd, "description"),
    defaultPrice: int(fd, "defaultPrice"),
    unit: str(fd, "unit") ?? "мес",
    active: id ? bool(fd, "active") : true,
  };
  if (id) await db.service.update({ where: { id }, data });
  else await db.service.create({ data });
  revalidatePath("/services");
}
