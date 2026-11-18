export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 h-8 w-56 rounded-lg bg-slate-200" />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-200" />)}
      </div>
      <div className="h-64 rounded-xl bg-slate-200" />
    </div>
  );
}
