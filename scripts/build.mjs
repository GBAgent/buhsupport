// Сборка: prisma generate → миграции → сид (админ + услуги) → next build.
// Миграции идут через прямое (unpooled) подключение, если оно есть (Supabase DIRECT_URL / Neon / Vercel Postgres).
import { execSync } from "node:child_process";

const env = { ...process.env };
const runtimeUrl = env.DATABASE_URL || env.POSTGRES_PRISMA_URL || env.POSTGRES_URL;
const directUrl = env.DIRECT_URL || env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || runtimeUrl;

const run = (cmd, extra = {}) => execSync(cmd, { stdio: "inherit", env: { ...env, ...extra } });
const runDb = (cmd) => {
  try {
    execSync(cmd, { stdio: ["ignore", "inherit", "pipe"], env: { ...env, DATABASE_URL: directUrl } });
  } catch (e) {
    const out = String(e.stderr ?? "") + String(e.stdout ?? "");
    console.error(out);
    console.error("\n❌ Ошибка подключения к базе при команде: " + cmd);
    if (/P1000|authentication failed|password/i.test(out))
      console.error("→ Неверный пароль базы. Проверьте, что [YOUR-PASSWORD] заменён на пароль, и что пароль без спецсимволов (@ # / ? % :) — или сбросьте его в Supabase на пароль только из букв и цифр.");
    else if (/P1001|Can't reach|ENOTFOUND|ENETUNREACH|timed out/i.test(out))
      console.error("→ База недоступна. Используйте строки из Supabase → Connect → ORMs → Prisma (хост *.pooler.supabase.com), а не db.<project>.supabase.co.");
    else if (/P1013|invalid port|invalid database string|scheme/i.test(out))
      console.error("→ Строка подключения испорчена: уберите кавычки и пробелы в начале/конце значения DATABASE_URL / DIRECT_URL.");
    else if (/Tenant or user not found/i.test(out))
      console.error("→ Неверный пользователь: он должен быть вида postgres.<id проекта>, как в строке из Supabase.");
    process.exit(1);
  }
};

const hostOf = (u) => { try { const x = new URL(u); return `${x.hostname}:${x.port || 5432}`; } catch { return "НЕКОРРЕКТНАЯ СТРОКА"; } };

run("npx prisma generate");

if (directUrl) {
  console.log(`База для миграций: ${hostOf(directUrl)}; для сайта: ${hostOf(runtimeUrl ?? "")}`);
  if (directUrl.includes("[YOUR-PASSWORD]") || (runtimeUrl ?? "").includes("[YOUR-PASSWORD]")) {
    console.error("❌ В DATABASE_URL / DIRECT_URL остался текст [YOUR-PASSWORD] — замените его на пароль базы.");
    process.exit(1);
  }
  runDb("npx prisma migrate deploy");
  runDb("npx tsx prisma/seed.ts");
} else {
  console.warn("⚠ DATABASE_URL не задан — миграции и создание администратора пропущены");
}

run("npx next build");
