import { ChefHat, Clock, Lock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { dietaryTagLabel } from "@/constants/dietaryTags";
import type { Mission, Skill } from "@/types/learning";
import { SkillChips } from "./SkillChip";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

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
  onStart,
}: {
  mission: Mission;
  skills: Map<string, Skill>;
  unlocked: boolean;
  lessonsLeft: number;
  onStart?: (missionId: string) => void;
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
            {t("Mission · cook for real")}
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
        {mission.estimatedCostEur !== undefined && (
          <span>~€{mission.estimatedCostEur.toFixed(2).replace(/\.00$/, "")}</span>
        )}
      </div>

      {mission.dietaryTags && mission.dietaryTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {mission.dietaryTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">
              {dietaryTagLabel(tag)}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-2">
        <SkillChips ids={mission.practices} skills={skills} muted={!unlocked} max={4} />
      </div>

      {unlocked ? (
        <Button
          className="mt-3 w-full rounded-full bg-amber-500 text-white hover:bg-amber-600"
          onClick={() => onStart?.(mission.id)}
        >
          <Play className="size-4 fill-current" />
          {t("Let's cook")}
        </Button>
      ) : (
        <p className="mt-3 text-[11px] font-medium text-muted-foreground">
          {t(
            lessonsLeft === 1
              ? "{count} more lesson to unlock it."
              : "{count} more lessons to unlock it.",
            {
              count: lessonsLeft,
            },
          )}
        </p>
      )}
    </div>
  );
}
