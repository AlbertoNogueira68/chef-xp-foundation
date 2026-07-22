import { Flame, Heart } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { LearningProgress } from "@/types/learning";
import { cn } from "@/lib/utils";

export function LearningHeader({
  progress,
  hearts,
  className,
}: {
  progress: LearningProgress;
  hearts?: number;
  className?: string;
}) {
  const xpPct = Math.min(100, Math.round((progress.dailyXp / progress.dailyXpGoal) * 100));

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-2xl border border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        <Flame className="size-5 text-orange-500" />
        <span className="text-sm font-bold text-orange-600">{progress.streak}</span>
      </div>

      {hearts != null && (
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Heart
              key={i}
              className={cn(
                "size-5 transition-colors",
                i < hearts ? "fill-rose-500 text-rose-500" : "text-muted-foreground/30",
              )}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col items-end gap-0.5">
        <span className="text-[10px] font-medium text-emerald-700">
          {progress.dailyXp}/{progress.dailyXpGoal} XP
        </span>
        <Progress value={xpPct} className="h-1.5 w-20 bg-emerald-200" />
      </div>
    </div>
  );
}
