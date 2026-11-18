import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Проверка настройки сервера — без секретов, только да/нет */
export async function GET() {
  const checks: Record<string, boolean | string> = {
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    DATABASE_URL: !!(process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL),
    BOT_API_KEY: !!process.env.BOT_API_KEY,
  };
  try {
    const users = await db.user.count();
    checks.database = "ok";
    checks.adminCreated = (await db.user.count({ where: { role: "ADMIN", active: true } })) > 0;
    checks.users = String(users);
  } catch (e) {
    const msg = String((e as Error).message);
    checks.database = msg.includes("does not exist") ? "нет таблиц (миграции не выполнены)" : "нет подключения";
  }
  const ok = checks.AUTH_SECRET === true && checks.database === "ok" && checks.adminCreated === true;
  return Response.json({ ok, ...checks }, { status: ok ? 200 : 503 });
}
