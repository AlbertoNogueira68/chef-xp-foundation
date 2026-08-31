import type { ReactNode } from "react";
import { Flame, Heart, Sparkles } from "lucide-react";
import type { LearningProgress } from "@/types/learning";
import { cn } from "@/lib/utils";

/**
 * A tira de estado diário. Três números que respondem sempre à mesma
 * pergunta — "como é que eu vou?" — sem obrigar a abrir o perfil.
 *
 * O XP do dia é o único com barra: é o único que se fecha hoje.
 */
export function LearningHeader({
  progress,
  skillCount,
  hearts,
  className,
}: {
  progress: LearningProgress;
  skillCount: number;
  hearts?: number;
  className?: string;
}) {
  const xpPct = Math.min(100, Math.round((progress.dailyXp / progress.dailyXpGoal) * 100));
  const goalMet = progress.dailyXp >= progress.dailyXpGoal;
  const learned = progress.learnedSkills.length;

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-3 shadow-sm", className)}>
      <div className="flex items-stretch divide-x divide-border">
        <Stat
          icon={<Flame className="size-4 text-orange-500" />}
          value={progress.streak}
          label={progress.streak === 1 ? "dia seguido" : "dias seguidos"}
        />
        <Stat
          icon={<Sparkles className="size-4 text-emerald-500" />}
          value={`${learned}/${skillCount}`}
          label="competências"
        />
        {hearts != null ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Heart
                  key={i}
                  className={cn(
                    "size-4",
                    i < hearts ? "fill-rose-500 text-rose-500" : "text-muted-foreground/25",
                  )}
                />
              ))}
            </div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">vidas</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col justify-center gap-1.5 pl-3">
            <div className="flex items-baseline justify-between">
              <span
                className={cn(
                  "text-sm font-bold tabular-nums",
                  goalMet ? "text-emerald-600" : "text-foreground",
                )}
              >
                {progress.dailyXp}
                <span className="text-xs font-medium text-muted-foreground">
                  /{progress.dailyXpGoal}
                </span>
              </span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                XP hoje
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  goalMet ? "bg-emerald-500" : "bg-orange-400",
                )}
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-2">
      <div className="flex items-center gap-1">
        {icon}
        <span className="text-sm font-bold tabular-nums">{value}</span>
      </div>
      <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
