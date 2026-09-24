import { Medal, Trophy } from "lucide-react";
import type { ChallengeResult } from "@/types/challenge";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";

/** As cores dos três lugares. A partir do quarto, é uma linha como as outras. */
const PLACE_STYLES: Record<number, string> = {
  1: "border-amber-400/60 bg-amber-400/10 text-amber-700 dark:text-amber-300",
  2: "border-slate-400/50 bg-slate-400/10 text-slate-600 dark:text-slate-300",
  3: "border-orange-700/40 bg-orange-700/10 text-orange-800 dark:text-orange-300",
};

/**
 * O resultado de um desafio fechado.
 *
 * Mostra o lugar, e não a posição na lista: dois primeiros aparecem os dois
 * como 1.º, que é o que o empate significa. O XP ao lado é o que cada um
 * levou de facto — e quem ficou fora do pódio aparece à mesma, sem número,
 * porque o ranking é de toda a gente que participou.
 */
export function ChallengePodium({ results }: { results: ChallengeResult[] }) {
  if (results.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
        {t("This challenge closed without entries.")}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {results.map((linha) => (
        <div
          key={linha.user.id}
          className={cn(
            "flex items-center gap-3 rounded-xl border px-3 py-2",
            PLACE_STYLES[linha.place] ?? "border-border/60 bg-muted/30",
          )}
        >
          <span className="flex w-7 shrink-0 items-center justify-center text-sm font-bold tabular-nums">
            {linha.place === 1 ? (
              <Trophy className="size-4" />
            ) : linha.place <= 3 ? (
              <Medal className="size-4" />
            ) : (
              linha.place
            )}
          </span>

          <div className="size-8 shrink-0 overflow-hidden rounded-full bg-muted">
            {linha.user.photoUrl && (
              <img src={linha.user.photoUrl} alt="" className="size-full object-cover" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">@{linha.user.username}</p>
            <p className="text-[11px] text-muted-foreground">
              {t(linha.likes === 1 ? "{count} like" : "{count} likes", { count: linha.likes })}
            </p>
          </div>

          {linha.xp > 0 && (
            <span className="shrink-0 text-sm font-bold tabular-nums">+{linha.xp} XP</span>
          )}
        </div>
      ))}
    </div>
  );
}
