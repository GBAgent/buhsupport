"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { importHostingWorkbook, type ImportResult } from "@/lib/import/hosting";

export async function importHosting(_: unknown, fd: FormData): Promise<{ result?: ImportResult; error?: string }> {
  await requireAdmin();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Выберите файл .xlsx" };
  if (!/\.xlsx$/i.test(file.name)) return { error: "Нужен файл Excel в формате .xlsx" };
  try {
    const result = await importHostingWorkbook(db, await file.arrayBuffer());
    revalidatePath("/", "layout");
    return { result };
  } catch (e) {
    console.error("import failed", e);
    return { error: (e as Error).message };
  }
}
