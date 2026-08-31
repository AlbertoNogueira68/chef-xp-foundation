import { ChefHat, Clock, Lock } from "lucide-react";
import type { Mission, Skill } from "@/types/learning";
import { SkillChips } from "./SkillChip";
import { cn } from "@/lib/utils";

/**
 * A missão é o que fecha a unidade — e é a razão pela qual isto não é mais um
 * quiz. Fica visível desde o primeiro dia, trancada, para que o percurso todo
 * tenha um destino à vista em vez de seis lições soltas.
 */
export function MissionCard({
  mission,
  skills,
  unlocked,
  lessonsLeft,
}: {
  mission: Mission;
  skills: Map<string, Skill>;
  unlocked: boolean;
  lessonsLeft: number;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4",
        unlocked
          ? "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm"
          : "border-dashed border-border bg-muted/30",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-xl",
            unlocked ? "bg-amber-400 text-white" : "bg-muted text-muted-foreground/60",
          )}
        >
          {unlocked ? <ChefHat className="size-5" /> : <Lock className="size-4" />}
        </span>
        <div className="min-w-0">
          <p
            className={cn(
              "text-[10px] font-semibold uppercase tracking-widest",
              unlocked ? "text-amber-700" : "text-muted-foreground",
            )}
          >
            Missão · cozinhar a sério
          </p>
          <h4
            className={cn("truncate font-bold leading-tight", !unlocked && "text-muted-foreground")}
          >
            {mission.title}
          </h4>
        </div>
      </div>

      <p
        className={cn(
          "mt-2 text-xs leading-snug",
          unlocked ? "text-amber-900/80" : "text-muted-foreground/80",
        )}
      >
        {mission.summary}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground/80">{mission.dishName}</span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" />
          {mission.cookTimeMin} min
        </span>
      </div>

      <div className="mt-2">
        <SkillChips ids={mission.practices} skills={skills} muted={!unlocked} max={4} />
      </div>

      {/* Ainda não há modo cozinha: prometer um botão que não faz nada era
          pior do que dizer o que falta. */}
      <p className="mt-3 text-[11px] font-medium">
        {unlocked ? (
          <span className="text-amber-800">Disponível quando o modo cozinha chegar.</span>
        ) : (
          <span className="text-muted-foreground">
            Faltam {lessonsLeft} {lessonsLeft === 1 ? "lição" : "lições"} para desbloquear.
          </span>
        )}
      </p>
    </div>
  );
}
