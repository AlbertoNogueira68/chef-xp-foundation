import { Flame } from "lucide-react";
import { ChallengeCard } from "@/components/ChallengeCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useChallenges } from "@/features/challenges/hooks/useChallenges";

export function ChallengesTab() {
  const { data: challenges, isLoading, isError } = useChallenges();
  const active = challenges?.filter((c) => c.active).length ?? 0;

  return (
    <div className="space-y-3">
      {/* O bloco laranja que estava aqui repetia o que os cartões já dizem e
          competia com eles pela atenção. Uma linha chega. */}
      <div className="flex items-center gap-2 px-1">
        <Flame className="size-4 text-orange-500" />
        <p className="text-sm font-semibold">Desafios da comunidade</p>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {active} {active === 1 ? "ativo" : "ativos"}
        </span>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {isError && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Não foi possível carregar os desafios.
        </p>
      )}

      {!isLoading && challenges?.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Sem desafios ativos de momento.
        </p>
      )}

      <div className="space-y-3">
        {challenges?.map((challenge) => (
          <ChallengeCard key={challenge.id} challenge={challenge} />
        ))}
      </div>
    </div>
  );
}
