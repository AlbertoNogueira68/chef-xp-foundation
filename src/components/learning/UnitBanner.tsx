import { cn } from "@/lib/utils";

const COLOR_MAP: Record<string, string> = {
  emerald: "from-emerald-500 to-teal-600",
  sky: "from-sky-500 to-blue-600",
  violet: "from-violet-500 to-purple-600",
};

export function UnitBanner({
  title,
  subtitle,
  color,
}: {
  title: string;
  subtitle: string;
  color: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-r px-4 py-3 text-white shadow-md",
        COLOR_MAP[color] ?? COLOR_MAP.emerald,
      )}
    >
      <div className="absolute -right-4 -top-4 size-20 rounded-full bg-white/10" />
      <div className="absolute -bottom-6 right-8 size-14 rounded-full bg-white/10" />
      <p className="relative text-[10px] font-semibold uppercase tracking-widest text-white/80">
        Unidade
      </p>
      <h3 className="relative text-lg font-bold leading-tight">{title}</h3>
      <p className="relative text-xs text-white/85">{subtitle}</p>
    </div>
  );
}
