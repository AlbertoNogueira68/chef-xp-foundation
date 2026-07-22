import { Skeleton } from "@/components/ui/skeleton";
import { LearningHeader } from "./LearningHeader";
import { LessonNode } from "./LessonNode";
import { UnitBanner } from "./UnitBanner";
import type { LearningPath } from "@/types/learning";
import { cn } from "@/lib/utils";

export function LearningPathView({
  path,
  isLoading,
  onLessonClick,
}: {
  path?: LearningPath;
  isLoading: boolean;
  onLessonClick: (lessonId: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="flex justify-center">
          <Skeleton className="size-16 rounded-full" />
        </div>
      </div>
    );
  }

  if (!path) return null;

  return (
    <div className="space-y-6 pb-4">
      <LearningHeader progress={path.progress} />
      <p className="text-center text-xs text-muted-foreground">
        Um prato por dia — segue o trilho e aprende a cozinhar de verdade.
      </p>

      {path.units.map((unit) => (
        <div key={unit.id} className="space-y-4">
          <UnitBanner title={unit.title} subtitle={unit.subtitle} color={unit.color} />

          <div className="relative space-y-6 px-2">
            {unit.lessons.map((lesson, index) => {
              const align = index % 2 === 0 ? "items-start pl-4" : "items-end pr-4";
              return (
                <div key={lesson.id} className={cn("relative flex", align)}>
                  {index < unit.lessons.length - 1 && (
                    <div
                      className={cn(
                        "absolute top-16 h-[calc(100%+0.5rem)] w-0.5 bg-emerald-200",
                        index % 2 === 0 ? "left-12" : "right-12",
                      )}
                    />
                  )}
                  <LessonNode lesson={lesson} onClick={onLessonClick} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
