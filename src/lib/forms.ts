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
