import { CalendarDays, Check, ChefHat, Trophy, Users, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RecipeMasonryCard } from "@/components/RecipeMasonryCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useChallenge,
  useEnterChallenge,
  useLeaveChallenge,
} from "@/features/challenges/hooks/useChallenges";
import { useRecipes } from "@/features/feed/hooks/useRecipes";
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser";
import { cn } from "@/lib/utils";
import { useState } from "react";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-PT", { day: "2-digit", month: "long" });
}

/**
 * O desafio aberto: quem já participou, e o sítio onde se participa.
 *
 * A escolha da receita é feita a partir das receitas do próprio utilizador —
 * o servidor recusa qualquer outra, portanto não faria sentido mostrá-las.
 */
export function ChallengeDetailDialog({
  challengeId,
  onClose,
}: {
  challengeId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useChallenge(challengeId);
  const { data: user } = useCurrentUser();
  const { recipes: myRecipes } = useRecipes({ authorId: user?.id, limit: 24 });
  const enter = useEnterChallenge();
  const leave = useLeaveChallenge();
  const [picked, setPicked] = useState<string | null>(null);

  const challenge = data?.challenge;
  const entries = data?.entries ?? [];

  const entered = challenge?.myEntry ?? null;

  return (
    <Dialog open={Boolean(challengeId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {isLoading || !challenge ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        ) : (
          <>
            <DialogHeader className="text-left">
              <DialogTitle className="pr-6 leading-tight">{challenge.title}</DialogTitle>
              <DialogDescription>{challenge.description}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                <Zap className="size-3.5" />+{challenge.xpReward} XP
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" />
                {challenge.entriesCount}{" "}
                {challenge.entriesCount === 1 ? "participação" : "participações"}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {challenge.active
                  ? `Termina ${formatDate(challenge.endsAt)}`
                  : `Terminou ${formatDate(challenge.endsAt)}`}
              </span>
            </div>

            {/* --- Participar / retirar --- */}
            {!challenge.active ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-3 text-center text-xs text-muted-foreground">
                Este desafio fechou. O resultado fica como está.
              </p>
            ) : entered ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  <Check className="size-4" /> Já estás a participar
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  disabled={leave.isPending}
                  onClick={() => leave.mutate(challenge.id)}
                >
                  Retirar
                </Button>
              </div>
            ) : myRecipes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center">
                <ChefHat className="mx-auto size-5 text-muted-foreground/60" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Precisas de uma receita publicada para participar.
                </p>
                <Button asChild size="sm" className="mt-3 rounded-full" onClick={onClose}>
                  <Link to="/publish">Publicar receita</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Escolhe a receita
                </p>
                <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                  {myRecipes.map((recipe) => (
                    <button
                      key={recipe.id}
                      type="button"
                      aria-pressed={picked === recipe.id}
                      onClick={() => setPicked(recipe.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-2 text-left transition-colors",
                        picked === recipe.id
                          ? "border-amber-500 bg-amber-500/10"
                          : "border-border/60 hover:bg-muted/50",
                      )}
                    >
                      <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {recipe.imageUrl && (
                          <img
                            src={recipe.imageUrl}
                            alt=""
                            className="size-full object-cover"
                            loading="lazy"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{recipe.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {recipe.cookTimeMin} min · {recipe.difficulty}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                <Button
                  className="w-full rounded-full"
                  disabled={!picked || enter.isPending}
                  onClick={() => picked && enter.mutate({ id: challenge.id, recipeId: picked })}
                >
                  <Trophy className="mr-1.5 size-4" />
                  {enter.isPending ? "A submeter…" : "Participar"}
                </Button>
              </div>
            )}

            {/* --- Quem participou --- */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Participações
              </p>
              {entries.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Ainda ninguém participou. Podes ser o primeiro.
                </p>
              ) : (
                <div className="columns-2 gap-3">
                  {entries.map((entry) => (
                    <RecipeMasonryCard key={entry.id} recipe={entry.recipe} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
