import { useState } from "react";
import { CalendarDays, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRemovePlan, useSavePlan } from "@/features/plan/hooks/useCookingPlan";
import type { CookingPlan, Weekday } from "@/types/plan";
import { cn } from "@/lib/utils";

const WEEKDAYS: Array<{ iso: Weekday; label: string }> = [
  { iso: 1, label: "S" },
  { iso: 2, label: "T" },
  { iso: 3, label: "Q" },
  { iso: 4, label: "Q" },
  { iso: 5, label: "S" },
  { iso: 6, label: "S" },
  { iso: 7, label: "D" },
];

const FULL = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

/**
 * Assumir o compromisso.
 *
 * Dois modos, porque as duas maneiras de se comprometer são legítimas: quem
 * cozinha à terça e à quinta quer dias, e quem cozinha quando calha quer um
 * número. Misturar os dois — dias fixos *e* um alvo diferente — seria dizer
 * duas coisas incompatíveis, por isso escolhe-se um.
 */
export function PlanEditor({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: CookingPlan | null;
}) {
  const [mode, setMode] = useState<"days" | "times">(
    plan && plan.weekdays.length > 0 ? "days" : "times",
  );
  const [weekdays, setWeekdays] = useState<Weekday[]>(plan?.weekdays ?? []);
  const [times, setTimes] = useState(plan?.targetWeek ?? 2);

  const save = useSavePlan();
  const remove = useRemovePlan();

  const toggle = (iso: Weekday) =>
    setWeekdays((current) =>
      current.includes(iso) ? current.filter((d) => d !== iso) : [...current, iso].sort(),
    );

  const canSave = mode === "times" || weekdays.length > 0;

  const submit = () => {
    save.mutate(
      mode === "days"
        ? { weekdays, targetWeek: weekdays.length }
        : { weekdays: [], targetWeek: times },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>O teu compromisso</DialogTitle>
          <DialogDescription>
            Aprender a cozinhar não se decide uma vez — decide-se todas as semanas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          <ModeButton
            active={mode === "days"}
            icon={<CalendarDays className="size-4" />}
            label="Dias certos"
            onClick={() => setMode("days")}
          />
          <ModeButton
            active={mode === "times"}
            icon={<Shuffle className="size-4" />}
            label="Quando calhar"
            onClick={() => setMode("times")}
          />
        </div>

        {mode === "days" ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Em que dias vais cozinhar?</p>
            <div className="flex justify-between gap-1">
              {WEEKDAYS.map((day, index) => (
                <button
                  key={day.iso}
                  type="button"
                  aria-pressed={weekdays.includes(day.iso)}
                  aria-label={FULL[index]}
                  onClick={() => toggle(day.iso)}
                  className={cn(
                    "size-9 rounded-full border text-xs font-bold transition",
                    weekdays.includes(day.iso)
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-border text-muted-foreground hover:border-emerald-400",
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
            {weekdays.length === 0 && (
              <p className="text-xs text-amber-600">Escolhe pelo menos um dia.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Quantas vezes por semana?</p>
            <div className="flex justify-between gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={times === n}
                  onClick={() => setTimes(n)}
                  className={cn(
                    "size-9 rounded-full border text-xs font-bold transition",
                    times === n
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-border text-muted-foreground hover:border-emerald-400",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full rounded-full"
            disabled={!canSave || save.isPending}
            onClick={submit}
          >
            {plan ? "Guardar" : "Assumir o compromisso"}
          </Button>

          {plan && (
            <Button
              variant="ghost"
              className="w-full rounded-full text-xs text-muted-foreground"
              disabled={remove.isPending}
              onClick={() => remove.mutate(undefined, { onSuccess: () => onOpenChange(false) })}
            >
              Desistir do compromisso
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition",
        active ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-border",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
