import { CalendarDays, Check, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Challenge } from "@/types/challenge";
import { cn } from "@/lib/utils";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

function daysLeft(value: string) {
  const diff = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

/**
 * O cartão era 4:5 e ocupava o ecrã inteiro: via-se um desafio de cada vez e
 * não dava para comparar nenhum com nenhum. Passou a 16:9 com o texto fora da
 * imagem — cabem três, e o texto deixa de depender do que a foto tem por trás.
 */
export function ChallengeCard({
  challenge,
  onOpen,
}: {
  challenge: Challenge;
  onOpen: (id: string) => void;
}) {
  const remaining = daysLeft(challenge.endsAt);
  const urgent = challenge.active && remaining <= 3;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md",
        urgent ? "border-amber-300" : "border-border",
        !challenge.active && "opacity-70",
      )}
    >
      <div className="relative aspect-[16/9] w-full bg-muted">
        {challenge.imageUrl && (
          <img src={challenge.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
        )}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
            <Zap className="size-3" />+{challenge.xpReward} XP
          </span>
          {urgent && (
            <span className="rounded-full bg-amber-400 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-950">
              Termina em {remaining} {remaining === 1 ? "dia" : "dias"}
            </span>
          )}
        </div>
      </div>

      <div className="p-3">
        <h3 className="font-bold leading-tight">{challenge.title}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
          {challenge.description}
        </p>

        <div className="mt-2.5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" />
            {challenge.active ? (
              <>
                Termina {formatDate(challenge.endsAt)}
                {!urgent && ` · ${remaining} ${remaining === 1 ? "dia" : "dias"}`}
              </>
            ) : (
              <>Terminou {formatDate(challenge.endsAt)}</>
            )}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" />
            {challenge.entriesCount}
          </span>
        </div>

        <Button
          variant={challenge.myEntry ? "outline" : "default"}
          size="sm"
          className="mt-3 w-full rounded-full text-xs"
          onClick={() => onOpen(challenge.id)}
        >
          {challenge.myEntry ? (
            <>
              <Check className="mr-1.5 size-3.5" /> A participar · ver
            </>
          ) : challenge.active ? (
            "Participar"
          ) : (
            "Ver participações"
          )}
        </Button>
      </div>
    </article>
  );
}
