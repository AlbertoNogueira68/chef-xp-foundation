import { Flame, Zap } from "lucide-react";
import { ChallengeCard } from "@/components/ChallengeCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useChallenges } from "@/features/challenges/hooks/useChallenges";

export function ChallengesTab() {
  const { data: challenges, isLoading, isError } = useChallenges();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white shadow-lg shadow-orange-500/20">
        <div className="flex items-center gap-2">
          <Flame className="size-5" />
          <h2 className="text-lg font-bold">Desafios da comunidade</h2>
        </div>
        <p className="mt-1 text-sm text-white/85">Completa missões, sobe de nível e destaca-te.</p>
        <div className="mt-3 flex items-center gap-2 text-xs text-white/75">
          <Zap className="size-3.5" />
          <span>{challenges?.length ?? 0} desafios ativos</span>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full rounded-2xl" />
          ))}
        </div>
      )}

      {isError && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Não foi possível carregar os desafios.
        </p>
      )}

      <div className="space-y-4">
        {challenges?.map((challenge) => (
          <ChallengeCard key={challenge.id} challenge={challenge} />
        ))}
      </div>
    </div>
  );
}
