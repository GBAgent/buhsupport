export const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
export const req = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (!v) throw new Error(`Поле «${k}» обязательно`);
  return v;
};
export const int = (fd: FormData, k: string, def = 0) => {
  const v = String(fd.get(k) ?? "").replace(/\s/g, "").replace(",", ".");
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== "" ? n : def;
};
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
export const dateVal = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v ? new Date(v) : null;
};
/** <input type="month"> → 1-е число месяца (UTC) */
export const monthVal = (fd: FormData, k: string) => {
  const v = str(fd, k);
  const m = v?.match(/^(\d{4})-(\d{2})/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, 1)) : null;
};
export const toMonthInput = (d: Date | null | undefined) =>
  d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}` : "";
export const toDateInput = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
