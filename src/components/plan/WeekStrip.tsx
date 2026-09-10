import { Check, X } from "lucide-react";
import type { PlanDay } from "@/types/plan";
import { cn } from "@/lib/utils";

/**
 * A semana em sete pontos.
 *
 * Os dias falhados ficam à vista em vez de desaparecerem. Uma barra que só
 * mostra o que correu bem não é um compromisso — é um elogio.
 */
export function WeekStrip({ days }: { days: PlanDay[] }) {
  return (
    <ol className="flex items-end justify-between gap-1">
      {days.map((day) => (
        <li key={day.date} className="flex flex-1 flex-col items-center gap-1">
          <span
            className={cn(
              "text-[10px] font-medium uppercase",
              day.isToday ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {day.label}
          </span>
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full border text-[10px] font-bold",
              day.status === "done" && "border-emerald-600 bg-emerald-600 text-white",
              day.status === "missed" && "border-rose-200 bg-rose-50 text-rose-500",
              day.status === "planned" && "border-dashed border-emerald-500 text-emerald-600",
              day.status === "free" && "border-border/70 text-muted-foreground/60",
              // O dia de hoje leva um anel, esteja em que estado estiver.
              day.isToday && "ring-2 ring-amber-400 ring-offset-1",
            )}
            aria-label={`${day.label}: ${statusLabel(day.status)}`}
          >
            {day.status === "done" && <Check className="size-3.5" strokeWidth={3} />}
            {day.status === "missed" && <X className="size-3.5" strokeWidth={3} />}
            {day.status === "planned" && "•"}
          </span>
        </li>
      ))}
    </ol>
  );
}

function statusLabel(status: PlanDay["status"]) {
  if (status === "done") return "cozinhaste";
  if (status === "missed") return "ficou por cozinhar";
  if (status === "planned") return "dia prometido";
  return "livre";
}
