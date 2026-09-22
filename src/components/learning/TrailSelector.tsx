import { toast } from "sonner";
import { Check, Plus } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useStartTrail, useTrails, type Trail } from "@/hooks/useTrails";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/**
 * Escolher o trilho.
 *
 * Um trilho em que ainda não se entrou mostra "Começar" em vez de abrir:
 * entrar é o que cria a linha de progresso, e sem ela o percurso aparecia
 * mas não guardava nada. Os que já foram começados trocam-se com um toque.
 *
 * Fica escondido enquanto só houver um trilho — um seletor com uma opção é
 * ruído no topo da página.
 */
export function TrailSelector({
  currentTrailId,
  onSelect,
}: {
  currentTrailId: string;
  onSelect: (trailId: string) => void;
}) {
  const { data: trails, isLoading } = useTrails();
  const start = useStartTrail();

  if (isLoading) return <Skeleton className="h-12 w-full rounded-full" />;
  if (!trails || trails.length < 2) return null;

  async function comecar(trail: Trail) {
    try {
      await start.mutateAsync(trail.id);
      onSelect(trail.id);
      toast.success(t("You're on {name}", { name: trail.name }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Couldn't start that trail"));
    }
  }

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      role="tablist"
      aria-label={t("Learning trails")}
    >
      {trails.map((trail) => {
        const activo = trail.id === currentTrailId;

        return (
          <button
            key={trail.id}
            role="tab"
            aria-selected={activo}
            disabled={start.isPending}
            onClick={() => (trail.started ? onSelect(trail.id) : comecar(trail))}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
              activo
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border/60 bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="text-base leading-none">{trail.icon ?? "📘"}</span>
            <span className="whitespace-nowrap">{trail.name}</span>

            {activo ? (
              <Check className="size-3 text-primary" />
            ) : (
              !trail.started && <Plus className="size-3" />
            )}
          </button>
        );
      })}
    </div>
  );
}
