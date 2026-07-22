import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function XpProgress({
  xp,
  nextLevelXp,
  level,
  className,
}: {
  xp: number;
  nextLevelXp: number;
  level: number;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((xp / nextLevelXp) * 100));
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">Nível {level}</span>
        <span className="text-muted-foreground">
          {xp} / {nextLevelXp} XP
        </span>
      </div>
      <Progress value={pct} className="h-2 bg-muted" />
    </div>
  );
}
