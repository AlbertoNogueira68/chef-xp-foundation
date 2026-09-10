import { useState } from "react";
import { CalendarCheck, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PlanEditor } from "./PlanEditor";
import { WeekStrip } from "./WeekStrip";
import { useCookingPlan } from "@/features/plan/hooks/useCookingPlan";
import { cn } from "@/lib/utils";

/**
 * O compromisso, no topo do percurso.
 *
 * É a única parte da app que fala do futuro. Todo o resto — lições, missões,
 * feed — regista o que já aconteceu; sem isto, nada traz a pessoa de volta na
 * quinta-feira.
 */
export function CommitmentBanner() {
  const { data, isLoading } = useCookingPlan();
  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-24 w-full rounded-2xl" />;
  }

  // Sem compromisso, o convite. Não é um aviso: é a pergunta que o projeto
  // quer que a pessoa se faça.
  if (!data?.plan || !data.summary) {
    return (
      <>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-emerald-400/70 bg-emerald-50/50 px-4 py-3 text-left transition hover:bg-emerald-50"
        >
          <CalendarCheck className="size-5 shrink-0 text-emerald-600" />
          <span>
            <span className="block text-sm font-semibold text-emerald-800">
              Quantas vezes queres cozinhar por semana?
            </span>
            <span className="block text-xs text-emerald-700/80">
              Assume um compromisso — é o que separa aprender de ter aprendido.
            </span>
          </span>
        </button>
        <PlanEditor open={editing} onOpenChange={setEditing} plan={null} />
      </>
    );
  }

  const { summary, message } = data;

  return (
    <>
      <section
        className={cn(
          "space-y-3 rounded-2xl border px-4 py-3",
          summary.complete ? "border-emerald-300 bg-emerald-50/60" : "border-border/70 bg-card",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold leading-snug">{message}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {summary.done} de {summary.target} esta semana
              {summary.missed > 0 && (
                <>
                  {" · "}
                  <span className="text-rose-500">
                    {summary.missed} {summary.missed === 1 ? "dia falhado" : "dias falhados"}
                  </span>
                </>
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-full"
            aria-label="Mudar o compromisso"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-3.5" />
          </Button>
        </div>

        <WeekStrip days={summary.days} />
      </section>

      <PlanEditor open={editing} onOpenChange={setEditing} plan={data.plan} />
    </>
  );
}
