import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * `xp` e `nextLevelXp` são relativos ao nível atual e vêm calculados do
 * servidor (`server/domain/xp.js`). A UI não conhece a fórmula da curva.
 */
export function XpProgress({
  xp,
  nextLevelXp,
  level,
  totalXp,
  isMaxLevel = false,
  className,
}: {
  xp: number;
  nextLevelXp: number;
  level: number;
  totalXp?: number;
  isMaxLevel?: boolean;
  className?: string;
}) {
  const pct = isMaxLevel ? 100 : Math.min(100, Math.round((xp / Math.max(1, nextLevelXp)) * 100));

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">Level {level}</span>
        <span className="tabular-nums text-muted-foreground">
          {isMaxLevel
            ? t("{xp} XP · max level", { xp: totalXp ?? xp })
            : `${xp} / ${nextLevelXp} XP`}
        </span>
      </div>
      <Progress value={pct} className="h-2 bg-muted" />
    </div>
  );
}
