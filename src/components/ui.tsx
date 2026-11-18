import Link from "next/link";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/format";

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl leading-none font-semibold tracking-[-0.035em] md:text-[40px]">{title}</h1>
        {sub && <p className="mt-2 text-sm text-muted">{sub}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

const statusColor: Record<string, string> = {
  NEW: "bg-blue-bg text-blue",
  IN_PROGRESS: "bg-warn-bg text-warn",
  DONE: "bg-[rgba(30,154,96,.12)] text-ok",
  CANCELLED: "bg-soft text-muted",
};
const prioColor: Record<string, string> = {
  LOW: "bg-soft text-muted",
  MEDIUM: "bg-paper text-ink",
  HIGH: "bg-warn-bg text-warn",
  CRITICAL: "bg-red text-white",
};

export const Badge = ({ className = "", children }: { className?: string; children: React.ReactNode }) => (
  <span className={`inline-block rounded-full px-2.5 py-1 text-xs leading-none font-medium whitespace-nowrap ${className}`}>{children}</span>
);
export const StatusBadge = ({ s }: { s: string }) => <Badge className={statusColor[s]}>{STATUS_LABEL[s]}</Badge>;
export const PriorityBadge = ({ p }: { p: string }) => <Badge className={prioColor[p]}>{PRIORITY_LABEL[p]}</Badge>;

export function Stat({ label, value, href, tone = "" }: { label: string; value: React.ReactNode; href?: string; tone?: string }) {
  const body = (
    <div className={`card group h-full transition ${href ? "hover:border-ink" : ""}`}>
      <div className="flex items-center justify-between text-xs font-medium tracking-wider text-muted uppercase">
        {label}
        {href && <span className="text-line transition group-hover:text-ink">↗</span>}
      </div>
      <div className={`mt-3 font-display text-3xl font-semibold tracking-[-0.03em] ${tone}`}>{value}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-10 text-center text-sm text-muted">{children}</div>;
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
