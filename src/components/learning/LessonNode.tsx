import type { ComponentType } from "react";
import {
  Beef,
  Crown,
  Egg,
  Gift,
  Lock,
  Salad,
  Soup,
  Star,
  UtensilsCrossed,
  Wheat,
} from "lucide-react";
import type { LessonWithStatus } from "@/types/learning";
import { cn } from "@/lib/utils";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  pasta: UtensilsCrossed,
  egg: Egg,
  soup: Soup,
  gift: Gift,
  crown: Crown,
  rice: Wheat,
  salad: Salad,
  pancake: Beef,
};

export function LessonNode({
  lesson,
  onClick,
}: {
  lesson: LessonWithStatus;
  onClick?: (id: string) => void;
}) {
  const Icon = ICONS[lesson.icon] ?? UtensilsCrossed;
  const isLocked = lesson.status === "locked";
  const isCurrent = lesson.status === "current";
  const isCompleted = lesson.status === "completed";
  const canTap = isCurrent || isCompleted;

  const dayLabel =
    lesson.type === "chest"
      ? "Baú"
      : lesson.type === "boss"
        ? "Revisão"
        : `Dia ${lesson.dayNumber}`;

  return (
    <button
      type="button"
      disabled={!canTap}
      onClick={() => canTap && onClick?.(lesson.id)}
      className={cn(
        "group relative flex max-w-[7.5rem] flex-col items-center gap-1.5 transition-transform",
        canTap && "active:scale-95",
        isLocked && "cursor-not-allowed opacity-60",
      )}
    >
      <div
        className={cn(
          "relative flex size-16 items-center justify-center rounded-full border-4 shadow-md transition-all",
          isCompleted && "border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 text-white",
          isCurrent &&
            "animate-pulse border-emerald-400 bg-gradient-to-b from-emerald-400 to-emerald-600 text-white ring-4 ring-emerald-200",
          isLocked && "border-muted bg-muted text-muted-foreground",
          lesson.type === "boss" && !isLocked && "size-[4.5rem]",
          lesson.type === "chest" && !isLocked && "border-amber-300 bg-gradient-to-b from-amber-200 to-amber-400",
        )}
      >
        {isLocked ? (
          <Lock className="size-6" />
        ) : isCompleted ? (
          lesson.type === "boss" ? (
            <Crown className="size-7" />
          ) : (
            <Star className="size-6 fill-current" />
          )
        ) : (
          <Icon className={cn("size-7", lesson.type === "boss" && "size-8")} />
        )}
        {isCurrent && (
          <span className="absolute -bottom-1 left-1/2 size-3 -translate-x-1/2 rotate-45 bg-emerald-500" />
        )}
      </div>
      <div className="text-center">
        <p
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            isCurrent ? "text-emerald-700" : "text-muted-foreground",
          )}
        >
          {dayLabel}
        </p>
        <p
          className={cn(
            "mt-0.5 line-clamp-2 text-[11px] font-medium leading-tight",
            isCurrent ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {lesson.dishName}
        </p>
      </div>
    </button>
  );
}
