import type { ComponentType } from "react";
import {
  Check,
  ChefHat,
  Crown,
  Egg,
  Flame,
  Gift,
  Hand,
  Lock,
  Play,
  Salad,
  Shield,
  Soup,
  UtensilsCrossed,
  Wheat,
} from "lucide-react";
import type { LessonWithStatus, Skill } from "@/types/learning";
import { SkillChips } from "./SkillChip";
import { cn } from "@/lib/utils";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  pasta: UtensilsCrossed,
  egg: Egg,
  soup: Soup,
  gift: Gift,
  crown: Crown,
  rice: Wheat,
  salad: Salad,
  "chef-hat": ChefHat,
  knife: UtensilsCrossed,
  hand: Hand,
  shield: Shield,
  flame: Flame,
};

/**
 * Uma lição por linha, encostada a um carril vertical.
 *
 * O trilho em ziguezague que estava aqui antes mostrava três lições num ecrã
 * inteiro e não dizia nada sobre nenhuma delas. Em linha cabe o dobro e sobra
 * espaço para o que interessa: o que é que esta lição te ensina.
 */
export function LessonRow({
  lesson,
  skills,
  learnedIds,
  isLast,
  onClick,
}: {
  lesson: LessonWithStatus;
  skills: Map<string, Skill>;
  learnedIds: Set<string>;
  isLast: boolean;
  onClick?: (id: string) => void;
}) {
  const Icon = ICONS[lesson.icon] ?? UtensilsCrossed;
  const isLocked = lesson.status === "locked";
  const isCurrent = lesson.status === "current";
  const isCompleted = lesson.status === "completed";
  const canTap = isCurrent || isCompleted;

  const label =
    lesson.type === "chest"
      ? "Baú"
      : lesson.type === "boss"
        ? "Revisão"
        : `Dia ${lesson.dayNumber}`;

  return (
    <li className="relative flex gap-3 pb-3">
      {/* A linha do carril é absoluta e vai até ao fundo da linha, espaçamento
          incluído. Em fluxo normal parava na margem do cartão e o trilho
          aparecia partido entre cada duas lições. */}
      {!isLast && (
        <span
          className={cn(
            "absolute bottom-0 left-[22px] top-11 w-0.5 -translate-x-1/2 rounded-full",
            isCompleted ? "bg-emerald-200" : "bg-border",
          )}
        />
      )}

      <div className="relative flex flex-col items-center">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full transition-all",
            isCompleted && "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30",
            isCurrent &&
              "bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-md shadow-emerald-500/40 ring-4 ring-emerald-100",
            isLocked && "bg-muted text-muted-foreground/60",
          )}
        >
          {isLocked ? (
            <Lock className="size-4" />
          ) : isCompleted ? (
            <Check className="size-5" strokeWidth={3} />
          ) : (
            <Icon className="size-5" />
          )}
        </div>
      </div>

      {/* Cartão da lição. */}
      <button
        type="button"
        disabled={!canTap}
        onClick={() => canTap && onClick?.(lesson.id)}
        className={cn(
          "flex-1 rounded-xl border p-3 text-left transition-all",
          isCurrent && "border-emerald-300 bg-emerald-50/60 shadow-sm hover:shadow-md",
          isCompleted && "border-border bg-card hover:border-emerald-200",
          isLocked && "cursor-not-allowed border-dashed border-border bg-muted/30",
          canTap && "active:scale-[0.99]",
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-widest",
              isCurrent ? "text-emerald-700" : "text-muted-foreground",
            )}
          >
            {label}
          </span>

          {lesson.type === "boss" && !isLocked && (
            <span className="rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-amber-800">
              Fecha a unidade
            </span>
          )}

          <span className="ml-auto text-[10px] font-medium text-muted-foreground tabular-nums">
            +{lesson.xpReward} XP
          </span>
        </div>

        <p
          className={cn(
            "mt-0.5 font-semibold leading-tight",
            isLocked ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {lesson.dishName}
        </p>

        <p
          className={cn(
            "mt-1 line-clamp-2 text-xs leading-snug",
            isLocked ? "text-muted-foreground/70" : "text-muted-foreground",
          )}
        >
          {lesson.description}
        </p>

        {lesson.teaches && lesson.teaches.length > 0 && (
          <div className="mt-2">
            <SkillChips
              ids={lesson.teaches}
              skills={skills}
              learnedIds={learnedIds}
              muted={isLocked}
            />
          </div>
        )}

        {isCurrent && (
          <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white">
            <Play className="size-3 fill-current" />
            Começar
          </span>
        )}
      </button>
    </li>
  );
}
