import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const SERVICES = [
  { name: "Хостинг базы 1С", category: "Хостинг", defaultPrice: 10000, unit: "мес", description: "Размещение базы 1С на нашем сервере, удалённый доступ, резервное копирование" },
  { name: "Обслуживание 1С (абонемент)", category: "1С", defaultPrice: 30000, unit: "мес", description: "Обновления, консультации, исправление ошибок" },
  { name: "Обновление конфигурации 1С", category: "1С", defaultPrice: 5000, unit: "разово" },
  { name: "Доработка 1С", category: "1С", defaultPrice: 15000, unit: "час" },
  { name: "Восстановление / тестирование базы 1С", category: "1С", defaultPrice: 10000, unit: "разово" },
  { name: "Внедрение Bitrix24", category: "Bitrix24", defaultPrice: 0, unit: "разово" },
  { name: "Настройка ЭЦП / ЭСФ", category: "ЭЦП / ЭСФ", defaultPrice: 5000, unit: "разово" },
  { name: "Обслуживание компьютеров и сети", category: "IT-аутсорсинг", defaultPrice: 50000, unit: "мес" },
  { name: "Настройка принтеров / оргтехники", category: "IT-аутсорсинг", defaultPrice: 5000, unit: "разово" },
  { name: "Корпоративная почта", category: "IT-аутсорсинг", defaultPrice: 2000, unit: "мес" },
  { name: "Аренда виртуального сервера (ESXi)", category: "Хостинг", defaultPrice: 40000, unit: "мес" },
];

async function main() {
  const email = (process.env.ADMIN_EMAIL || "dev@glav-buh.kz").toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("Задайте ADMIN_PASSWORD для создания администратора");

  const existing = await db.user.findUnique({ where: { email } });
  if (!existing) {
    await db.user.create({
      data: { email, name: "Администратор", role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) },
    });
    console.log(`Создан администратор ${email}`);
  } else {
    console.log(`Администратор ${email} уже существует — пароль не меняю`);
  }

  for (const s of SERVICES) {
    await db.service.upsert({ where: { name: s.name }, update: {}, create: s });
  }
  console.log(`Услуги: ${SERVICES.length}`);
}

main().finally(() => db.$disconnect());
