import { cn } from "@/lib/utils";

const COLOR_MAP: Record<string, { bar: string; tint: string; text: string; ring: string }> = {
  emerald: {
    bar: "bg-emerald-500",
    tint: "bg-emerald-50",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
  },
  sky: { bar: "bg-sky-500", tint: "bg-sky-50", text: "text-sky-700", ring: "ring-sky-200" },
  violet: {
    bar: "bg-violet-500",
    tint: "bg-violet-50",
    text: "text-violet-700",
    ring: "ring-violet-200",
  },
};

/**
 * O cabeçalho da unidade passou a carregar informação em vez de gradiente:
 * quantas lições faltam e quantas competências já estão de pé. Antes dizia
 * apenas o nome — bonito e inútil.
 */
export function UnitBanner({
  index,
  title,
  subtitle,
  color,
  lessonsDone,
  lessonsTotal,
  skillsDone,
  skillsTotal,
}: {
  index: number;
  title: string;
  subtitle: string;
  color: string;
  lessonsDone: number;
  lessonsTotal: number;
  skillsDone: number;
  skillsTotal: number;
}) {
  const palette = COLOR_MAP[color] ?? COLOR_MAP.emerald;
  const pct = lessonsTotal === 0 ? 0 : Math.round((lessonsDone / lessonsTotal) * 100);
  const done = lessonsDone === lessonsTotal;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1 ring-inset",
            palette.tint,
            palette.text,
            palette.ring,
          )}
        >
          {index}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </p>
          <h3 className="truncate text-base font-bold leading-tight">{subtitle}</h3>
        </div>

        {done && (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
            Completa
          </span>
        )}
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", palette.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground tabular-nums">
            {lessonsDone}/{lessonsTotal}
          </span>{" "}
          lições
        </span>
        <span>
          <span className="font-semibold text-foreground tabular-nums">
            {skillsDone}/{skillsTotal}
          </span>{" "}
          competências
        </span>
      </div>
    </div>
  );
}
