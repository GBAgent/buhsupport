// Сборка: prisma generate → миграции → сид (админ + услуги) → next build.
// Миграции идут через прямое (unpooled) подключение, если оно есть (Neon / Vercel Postgres).
import { execSync } from "node:child_process";

const env = { ...process.env };
const runtimeUrl = env.DATABASE_URL || env.POSTGRES_PRISMA_URL || env.POSTGRES_URL;
const directUrl = env.DIRECT_URL || env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || runtimeUrl;
const run = (cmd, extra = {}) => execSync(cmd, { stdio: "inherit", env: { ...env, ...extra } });

run("npx prisma generate");

if (directUrl) {
  run("npx prisma migrate deploy", { DATABASE_URL: directUrl });
  run("npx tsx prisma/seed.ts", { DATABASE_URL: directUrl });
} else {
  console.warn("⚠ DATABASE_URL не задан — миграции и создание администратора пропущены");
}

run("npx next build");
