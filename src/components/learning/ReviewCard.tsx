import { Brain, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

/**
 * O cartão que diz que há matéria à espera.
 *
 * Aparece no topo do percurso, e **só quando há algo a rever**. Um cartão
 * permanente a dizer "0 para rever" era mais uma coisa a ignorar todos os
 * dias, e a primeira coisa que se aprende a ignorar deixa de funcionar quando
 * passa a ter conteúdo.
 *
 * Existe porque o percurso tem 19 lições e acaba. Quem chega ao fim tinha um
 * trilho cheio de círculos verdes e nada para onde voltar — e a repetição
 * espaçada é o que transforma matéria vista numa vez em matéria sabida.
 */
export function ReviewCard({ due, onStart }: { due: number; onStart: () => void }) {
  if (due <= 0) return null;

  return (
    <section
      className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4"
      aria-labelledby="review-card-title"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
          <Brain className="size-5" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 id="review-card-title" className="text-sm font-bold text-sky-900">
            {t("Time to review")}
          </h2>
          <p className="mt-0.5 text-xs text-sky-800/80">
            {due === 1
              ? t("One question is waiting to come back.")
              : t("{count} questions are waiting to come back.", { count: due })}
          </p>
        </div>
      </div>

      <Button
        className="mt-3 w-full rounded-full bg-sky-500 hover:bg-sky-600"
        onClick={onStart}
        size="sm"
      >
        {t("Start review")}
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </section>
  );
}
