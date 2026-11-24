import Image from "next/image";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex flex-col items-start leading-none ${className}`}>
      <Image src="/logo-gb.png" alt="ГлавБух" width={158} height={26} priority className="h-[22px] w-auto self-start object-contain" />
      <span className="mt-1.5 text-[11px] font-medium tracking-[0.14em] text-muted uppercase">Поддержка · BuhSupport</span>
    </span>
  );
}
