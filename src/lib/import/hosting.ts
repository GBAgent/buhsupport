import "server-only";
import ExcelJS from "exceljs";
import type { ClientStatus, PrismaClient } from "@prisma/client";

/* ---------- чтение ячеек ---------- */
type Cell = ExcelJS.CellValue;
function text(v: Cell): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("").trim() || null;
    if ("text" in v) return text(v.text as Cell);
    if ("result" in v) return text(v.result as Cell);
    if ("error" in v) return null;
  }
  const s = String(v).trim();
  return s === "" || s === "—" || s === "-" ? null : s;
}
function num(v: Cell): number | null {
  if (v && typeof v === "object" && "result" in v) v = v.result as Cell;
  if (typeof v === "number") return Math.round(v);
  const s = text(v)?.replace(/[\s ₸]/g, "").replace(",", ".");
  const n = s ? Number(s) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}
function date(v: Cell): Date | null {
  if (v && typeof v === "object" && "result" in v) v = v.result as Cell;
  if (v instanceof Date) return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  const s = text(v);
  const m = s?.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null;
}
const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));

function sheetRows(ws: ExcelJS.Worksheet, mustHave: string[]) {
  let headerRow = 0;
  const cols = new Map<string, number>();
  ws.eachRow((row, i) => {
    if (headerRow) return;
    const names = (row.values as Cell[]).map((v) => text(v) ?? "");
    if (mustHave.every((h) => names.some((n) => n.startsWith(h)))) {
      headerRow = i;
      names.forEach((n, idx) => n && cols.set(n, idx));
    }
  });
  if (!headerRow) return null;
  const col = (prefix: string) => [...cols.entries()].find(([n]) => n.startsWith(prefix))?.[1];
  const out: ((prefix: string) => Cell)[] = [];
  ws.eachRow((row, i) => {
    if (i <= headerRow) return;
    const get = (prefix: string) => {
      const c = col(prefix);
      return c ? row.getCell(c).value : null;
    };
    if ((row.values as Cell[]).some((v) => text(v))) out.push(get);
  });
  return out;
}

/* ---------- нормализация ---------- */
const STATUS: Record<string, ClientStatus> = {
  действует: "ACTIVE", активен: "ACTIVE",
  приостановлено: "PAUSED", приостановлен: "PAUSED",
  расторгнут: "LEFT", архив: "LEFT", отказ: "LEFT", ушёл: "LEFT", ушел: "LEFT",
};

/** «Асель (Караганда)» и «Асель Караганда» — один плательщик; «Жанар (забрала локально)» — Жанар + пометка */
function normalizePayer(raw: string | null): { name: string | null; note: string | null } {
  if (!raw) return { name: null, note: null };
  const m = raw.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (m && /забрал|локальн|ушл|отказ/i.test(m[2])) return { name: m[1].trim(), note: m[2].trim() };
  if (m && /^[А-ЯЁA-Z][а-яёa-z-]+$/.test(m[2]) && !/[()]/.test(m[1])) {
    // «Асель (Караганда)» → «Асель Караганда», но «Арман (ТДК)» оставляем как есть
    if (m[2].length > 4) return { name: `${m[1].trim()} ${m[2].trim()}`, note: null };
  }
  return { name: raw.trim(), note: null };
}

function splitPhone(company: string) {
  const m = company.match(/^(.*?)[\s,]*((?:\+?7|8)\d{10})\s*$/);
  return m ? { name: m[1].trim(), phone: m[2] } : { name: company, phone: null };
}

const MONTHS = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
function periodFromNote(note: string | null, paidAt: Date) {
  const y = paidAt.getUTCFullYear();
  const low = note?.toLowerCase() ?? "";
  const idx = MONTHS.findIndex((m, i) => (i === 4 ? /\bма[йя]\b/.test(low) : low.includes(m)));
  const month = idx >= 0 ? idx + 1 : paidAt.getUTCMonth() + 1;
  return `${y}-${String(month).padStart(2, "0")}`;
}

/* ---------- импорт ---------- */
export type ImportResult = {
  clientsCreated: number; clientsUpdated: number;
  payersCreated: number; basesCreated: number; basesUpdated: number;
  groupRows: number; unmatchedPayments: number; skipped: string[]; warnings: string[];
};

export async function importHostingWorkbook(db: PrismaClient, buf: ArrayBuffer): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const r: ImportResult = { clientsCreated: 0, clientsUpdated: 0, payersCreated: 0, basesCreated: 0, basesUpdated: 0, groupRows: 0, unmatchedPayments: 0, skipped: [], warnings: [] };

  const registry = wb.worksheets.map((ws) => sheetRows(ws, ["Компания", "БИН"])).find(Boolean);
  if (!registry) throw new Error("Не найден лист с колонками «Компания» и «БИН/ИИН»");

  const payerCache = new Map<string, string>();
  async function payerId(name: string | null, phone: string | null) {
    if (!name) return null;
    if (payerCache.has(name)) {
      if (phone) await db.payer.updateMany({ where: { id: payerCache.get(name), phone: null }, data: { phone } });
      return payerCache.get(name)!;
    }
    const existing = await db.payer.findUnique({ where: { name } });
    const p = existing
      ? await db.payer.update({ where: { id: existing.id }, data: { phone: existing.phone ?? phone } })
      : await db.payer.create({ data: { name, phone } });
    if (!existing) r.payersCreated++;
    payerCache.set(name, p.id);
    return p.id;
  }

  for (const get of registry) {
    const companyRaw = text(get("Компания"));
    const bin = text(get("БИН"))?.replace(/\D/g, "") || null;
    const payer = normalizePayer(text(get("От кого")));
    const payerPhone = text(get("Телефон"))?.replace(/\D/g, "") || null;
    const price = num(get("Прайс")) ?? 0;
    const paidUntilRaw = date(get("Последний оплаченный"));
    const paidUntil = paidUntilRaw ? monthStart(paidUntilRaw) : null;
    const statusRaw = text(get("Статус"));
    const note = text(get("Примечание"));
    if (!companyRaw) continue;

    // строка без БИН — групповая оплата плательщика («Асель Караганда — ~34 базы», 53 000 ₸)
    if (!bin) {
      const pid = await payerId(payer.name ?? companyRaw, payerPhone);
      if (pid && price) {
        await db.payer.update({ where: { id: pid }, data: { groupPrice: price, paidUntil, note: companyRaw } });
        r.groupRows++;
      } else r.skipped.push(`Строка без БИН/ИИН: «${companyRaw}»`);
      continue;
    }
    if (!/^\d{12}$/.test(bin)) r.warnings.push(`${companyRaw}: БИН/ИИН «${bin}» не из 12 цифр`);

    const { name: cleanName, phone: companyPhone } = splitPhone(companyRaw);
    const name = /^наша организация$/i.test(cleanName) ? `Наша организация (${bin})` : cleanName;
    let status: ClientStatus = statusRaw ? STATUS[statusRaw.toLowerCase()] ?? "ACTIVE" : "ACTIVE";
    if (payer.note && !statusRaw) status = "LEFT";
    const confidence = text(get("Уверенность"));
    const billingNote = [
      confidence && `Уверенность оценки оплаты: ${confidence}`,
      text(get("Откуда оценка")) && `Откуда оценка: ${text(get("Откуда оценка"))}`,
      text(get("Платежи в 1С")) && `Платежи в 1С: ${text(get("Платежи в 1С"))}`,
    ].filter(Boolean).join("\n") || null;
    const needsCheck = !statusRaw || !confidence || /нет данных|низкая/i.test(confidence);
    const notes = [note, payer.note && `Плательщик: ${payer.note}`, /^наша организация$/i.test(cleanName) && "Наша собственная база"]
      .filter(Boolean).join("\n") || null;

    const pid = await payerId(payer.name, payerPhone);
    const data = {
      name, bin, status, needsCheck,
      payerId: pid,
      ...(companyPhone ? { phone: companyPhone } : {}),
      ...(notes ? { notes } : {}),
      ...(billingNote ? { billingNote } : {}),
      ...(paidUntil ? { paidUntil } : {}),
      ...(text(get("№ договора")) ? { contractNumber: text(get("№ договора")) } : {}),
      ...(date(get("Дата договора")) ? { contractDate: date(get("Дата договора")) } : {}),
      ...(date(get("Обслуживаем с")) ? { serviceSince: date(get("Обслуживаем с")) } : {}),
      ...(text(get("Способ оплаты")) ? { payMethod: text(get("Способ оплаты")) } : {}),
      ...(text(get("Откуда (кто")) ? { payFrom: text(get("Откуда (кто")) } : {}),
      ...(text(get("Куда")) ? { payTo: text(get("Куда")) } : {}),
    };
    const existing = await db.client.findUnique({ where: { bin } });
    const client = existing
      ? await db.client.update({ where: { id: existing.id }, data })
      : await db.client.create({ data: { ...data, source: "Реестр хостинга" } });
    existing ? r.clientsUpdated++ : r.clientsCreated++;

    // база 1С
    const url = text(get("Ссылка"));
    const baseData = {
      url,
      login: text(get("Пользователь")),
      hostingPrice: price,
      active: status !== "LEFT",
    };
    const base = await db.base1C.findFirst({ where: { clientId: client.id, OR: [{ url }, { url: null }] } });
    if (base) {
      await db.base1C.update({ where: { id: base.id }, data: baseData });
      r.basesUpdated++;
    } else if (url || price) {
      await db.base1C.create({ data: { ...baseData, clientId: client.id, name } });
      r.basesCreated++;
    }
  }

  // неопознанные платежи из 1С
  const unmatched = wb.worksheets
    .filter((ws) => /неопознан/i.test(ws.name))
    .map((ws) => sheetRows(ws, ["Дата", "Сумма"]))
    .find(Boolean);
  for (const get of unmatched ?? []) {
    const paidAt = date(get("Дата"));
    const amount = num(get("Сумма"));
    if (!paidAt || !amount) continue;
    const comment = text(get("Примечание"));
    const methodRaw = text(get("Способ")) ?? "";
    const method = /налич/i.test(methodRaw) ? "Наличные" : /счет|счёт/i.test(methodRaw) ? "Безнал" : methodRaw || "Другое";
    const source = `1С: компания «${text(get("Компания")) ?? "—"}», провёл: ${text(get("Кто провёл")) ?? "—"}`;
    const dup = await db.payment.findFirst({ where: { amount, paidAt, source } });
    if (dup) continue;
    await db.payment.create({ data: { amount, paidAt, method, comment, source, period: periodFromNote(comment, paidAt) } });
    r.unmatchedPayments++;
  }
  return r;
}
