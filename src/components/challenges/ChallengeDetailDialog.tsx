import { CalendarDays, Camera, Trophy, Users, X, Zap } from "lucide-react";
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
import { ChallengePodium } from "@/components/challenges/ChallengePodium";
import { Skeleton } from "@/components/ui/skeleton";
import { useChallenge, useLeaveChallenge } from "@/features/challenges/hooks/useChallenges";
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser";
import { t } from "@/i18n";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-PT", { day: "2-digit", month: "long" });
}

/**
 * O desafio aberto: as regras com que corre, quem já participou, e o sítio
 * onde se participa.
 *
 * A escolha da receita é feita a partir das receitas do próprio utilizador —
 * o servidor recusa qualquer outra, portanto não faria sentido mostrá-las.
 * Depois do desafio fechar, o que ocupa o topo é o pódio: é o que a pessoa
 * vem aqui ver.
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
  const leave = useLeaveChallenge();

  const challenge = data?.challenge;
  const entries = data?.entries ?? [];
  const results = data?.results ?? [];

  // As minhas submissões saem da lista de participações, que já vem do
  // servidor — não há um segundo pedido só para as encontrar.
  const minhas = entries.filter((entry) => entry.userId === user?.id);
  const usadas = challenge?.myEntriesCount ?? 0;
  const restantes = Math.max(0, (challenge?.maxEntriesPerUser ?? 1) - usadas);

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
                {challenge.participantsCount}{" "}
                {t(challenge.participantsCount === 1 ? "entrant" : "entrants")}
              </span>
              <span className="inline-flex items-center gap-1">
                <Camera className="size-3.5" />
                {t(
                  challenge.maxEntriesPerUser === 1 ? "{count} photo each" : "{count} photos each",
                  { count: challenge.maxEntriesPerUser },
                )}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {challenge.active
                  ? t("Ends {date}", { date: formatDate(challenge.endsAt) })
                  : t("Ended {date}", { date: formatDate(challenge.endsAt) })}
              </span>
            </div>

            {/* O que o pódio paga, enquanto ainda está por decidir. */}
            {challenge.active && challenge.podiumXp.some((xp) => xp > 0) && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <Trophy className="size-3.5" />
                  {t("Most likes at the end wins")}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("1st +{first} XP · 2nd +{second} XP · 3rd +{third} XP", {
                    first: challenge.podiumXp[0] ?? 0,
                    second: challenge.podiumXp[1] ?? 0,
                    third: challenge.podiumXp[2] ?? 0,
                  })}{" "}
                  · {t("A tie pays the same to everyone tied.")}
                </p>
              </div>
            )}

            {/* --- O resultado, depois do fim --- */}
            {!challenge.active && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {challenge.settledAt ? t("Final ranking") : t("Standing")}
                </p>
                {challenge.settledAt ? (
                  <ChallengePodium results={results} />
                ) : (
                  <p className="rounded-xl border border-dashed border-border px-4 py-3 text-center text-xs text-muted-foreground">
                    {/* Entre o fim e a passagem do agendador há minutos em que
                        o desafio acabou mas o pódio ainda não existe. */}
                    {t("This challenge has ended. The result is being counted.")}
                  </p>
                )}
              </div>
            )}

            {/* --- As minhas submissões --- */}
            {minhas.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("Your entries")}
                </p>
                {minhas.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2"
                  >
                    <div className="size-9 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {entry.recipe.imageUrl && (
                        <img
                          src={entry.recipe.imageUrl}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">
                      {entry.recipe.title}
                    </p>
                    {challenge.active && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 shrink-0 text-muted-foreground"
                        aria-label={t("Withdraw")}
                        disabled={leave.isPending}
                        onClick={() => leave.mutate({ id: challenge.id, entryId: entry.id })}
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* --- Participar --- */}
            {challenge.active &&
              (restantes === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-2.5 text-center text-xs text-muted-foreground">
                  {t("You've used all your entries. Now it's up to the likes.")}
                </p>
              ) : (
                /*
                 * Participar é cozinhar para o desafio: leva à publicação de
                 * uma receita nova, com o desafio agarrado. Aqui não se
                 * escolhe uma receita já feita — a que sair daqui aparece no
                 * feed como qualquer outra, com o selo do desafio.
                 */
                <Button asChild className="w-full rounded-full" onClick={onClose}>
                  <Link to={`/publish?challenge=${challenge.id}`}>
                    <Trophy className="mr-1.5 size-4" />
                    {minhas.length > 0 ? t("Cook another one") : t("Cook and enter")}
                    {challenge.maxEntriesPerUser > 1 && (
                      <span className="ml-1 font-normal opacity-80">
                        · {t("{count} left", { count: restantes })}
                      </span>
                    )}
                  </Link>
                </Button>
              ))}

            {/* --- Quem participou --- */}
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("Entries")}
                </p>
                {entries.length > 1 && (
                  <p className="text-[11px] text-muted-foreground">{t("By likes")}</p>
                )}
              </div>
              {entries.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("Nobody has entered yet. You could be the first.")}
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
