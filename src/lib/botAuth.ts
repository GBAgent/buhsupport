import { timingSafeEqual } from "node:crypto";

export function botAuthorized(req: Request) {
  const expected = process.env.BOT_API_KEY;
  const got = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !got) return false;
  const a = Buffer.from(expected), b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

const PRIORITY: Record<string, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> = {
  низкий: "LOW", low: "LOW",
  средний: "MEDIUM", обычный: "MEDIUM", medium: "MEDIUM",
  высокий: "HIGH", high: "HIGH",
  критично: "CRITICAL", критичный: "CRITICAL", critical: "CRITICAL",
};
export const parsePriority = (p?: unknown) => PRIORITY[String(p ?? "").trim().toLowerCase()] ?? "MEDIUM";

const STATUS: Record<string, "NEW" | "IN_PROGRESS" | "DONE" | "CANCELLED"> = {
  new: "NEW", новая: "NEW",
  in_progress: "IN_PROGRESS", "в работе": "IN_PROGRESS",
  done: "DONE", выполнено: "DONE", "работа выполнена": "DONE",
  cancelled: "CANCELLED", отменена: "CANCELLED",
};
export const parseStatus = (s?: unknown) => STATUS[String(s ?? "").trim().toLowerCase()];
