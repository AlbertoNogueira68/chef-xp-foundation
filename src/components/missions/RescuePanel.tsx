import { LifeBuoy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RESCUE_LABELS, type RescueKind } from "@/types/learning";

/**
 * Os quatro botões que seguram quem está prestes a desistir.
 *
 * Um principiante abandona no primeiro erro, e o erro acontece com as mãos
 * ocupadas e a frigideira a fumegar — não é o momento de ir procurar. As
 * respostas estão escritas no currículo, passo a passo, e o pedido fica
 * registado: saber onde as pessoas se atrapalham é metade do valor disto.
 */
export function RescuePanel({
  kinds,
  answer,
  onAsk,
  onDismiss,
}: {
  kinds: RescueKind[];
  answer: { kind: RescueKind; answer: string } | null;
  onAsk: (kind: RescueKind) => void;
  onDismiss: () => void;
}) {
  if (kinds.length === 0) return null;

  if (answer) {
    return (
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <LifeBuoy className="mt-0.5 size-4 shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
              {RESCUE_LABELS[answer.kind]}
            </p>
            <p className="mt-1 text-sm leading-snug text-amber-950">{answer.answer}</p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 shrink-0 text-amber-800"
            onClick={onDismiss}
            aria-label="Fechar ajuda"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Correu mal?
      </p>
      <div className="grid grid-cols-2 gap-2">
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => onAsk(kind)}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-medium transition-colors hover:border-amber-300 hover:bg-amber-50"
          >
            {RESCUE_LABELS[kind]}
          </button>
        ))}
      </div>
    </div>
  );
}
