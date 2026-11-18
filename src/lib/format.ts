export const money = (n: number) =>
  new Intl.NumberFormat("ru-RU").format(n) + " ₸";

export const date = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("ru-RU", { timeZone: "Asia/Almaty" }) : "—";

export const dateTime = (d: Date | string) =>
  new Date(d).toLocaleString("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

export const currentPeriod = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Almaty" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const periodLabel = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
};

export const STATUS_LABEL: Record<string, string> = {
  NEW: "🆕 Новая",
  IN_PROGRESS: "🔧 В работе",
  DONE: "✅ Выполнено",
  CANCELLED: "✖ Отменена",
};
export const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Низкий", MEDIUM: "Средний", HIGH: "Высокий", CRITICAL: "Критично",
};
export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Администратор", ENGINEER: "IT-специалист", ACCOUNTANT: "Бухгалтер",
};
export const CLIENT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Активен", PAUSED: "Приостановлен", LEFT: "Ушёл",
};

export const SOURCES = ["Telegram-бот", "Рекомендация клиента", "Сотрудник", "Сайт", "Instagram", "2ГИС", "Звонок", "Партнёр", "Другое"];
export const TICKET_CATEGORIES = ["1С", "Хостинг 1С", "Bitrix24", "ЭЦП / ЭСФ", "Компьютеры / сеть", "Принтеры", "Почта", "Сервер / ESXi", "Другое"];
export const PAY_METHODS = ["Kaspi", "Безнал", "Наличные", "Другое"];
