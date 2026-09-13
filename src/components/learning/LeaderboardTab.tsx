import { useState } from "react";
import { Link } from "react-router-dom";
import { Medal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeaderboard } from "@/features/leaderboard/hooks/useLeaderboard";
import type { LeaderboardEntry, LeaderboardScope } from "@/types/leaderboard";
import { cn } from "@/lib/utils";

const SCOPES: Array<{ id: LeaderboardScope; label: string; hint: string }> = [
  { id: "weekly", label: "Esta semana", hint: "XP dos últimos sete dias" },
  { id: "global", label: "Sempre", hint: "XP desde o primeiro dia" },
];

/** Ouro, prata e bronze; do quarto em diante é só o número. */
const MEDALS: Record<number, string> = {
  1: "text-amber-500",
  2: "text-slate-400",
  3: "text-orange-700",
};

function Row({ entry, fixed = false }: { entry: LeaderboardEntry; fixed?: boolean }) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2",
        entry.isMe ? "bg-amber-500/10 ring-1 ring-amber-500/30" : "bg-card",
        fixed && "border border-dashed border-border",
      )}
    >
      <span className="flex w-7 shrink-0 justify-center">
        {MEDALS[entry.rank] ? (
          <Medal className={cn("size-5", MEDALS[entry.rank])} />
        ) : (
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            {entry.rank}
          </span>
        )}
      </span>

      <Link
        to={entry.isMe ? "/profile" : `/chef/${entry.user.id}`}
        className="flex min-w-0 flex-1 items-center gap-2.5 transition-opacity hover:opacity-80"
      >
        <Avatar className="size-9">
          <AvatarImage src={entry.user.photoUrl ?? undefined} />
          <AvatarFallback>{entry.user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {entry.user.username}
            {entry.isMe && <span className="ml-1.5 text-xs text-amber-600">tu</span>}
          </span>
          <span className="text-[11px] text-muted-foreground">Nível {entry.user.level}</span>
        </span>
      </Link>

      <span className="shrink-0 text-sm font-bold tabular-nums">
        {entry.score.toLocaleString("pt-PT")}
        <span className="ml-1 text-[10px] font-normal text-muted-foreground">XP</span>
      </span>
    </li>
  );
}

/**
 * O ranking não tem tabela própria: sai do mesmo livro-razão que paga o XP.
 * A minha linha aparece sempre no fim quando fico fora do top — estar em 84.º
 * é uma informação, e não se descobre a descer uma lista.
 */
export function LeaderboardTab() {
  const [scope, setScope] = useState<LeaderboardScope>("weekly");
  const { data, isLoading } = useLeaderboard(scope);

  const noTop = data?.entries.some((entry) => entry.isMe);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {SCOPES.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={scope === option.id}
            onClick={() => setScope(option.id)}
            className={cn(
              "h-9 rounded-full px-4 text-xs font-semibold transition-colors",
              scope === option.id
                ? "bg-amber-500 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        {SCOPES.find((option) => option.id === scope)?.hint}
      </p>

      {isLoading && (
        <ul className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <li key={i}>
              <Skeleton className="h-14 w-full rounded-xl" />
            </li>
          ))}
        </ul>
      )}

      {!isLoading && data?.entries.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {scope === "weekly"
            ? "Ninguém ganhou XP esta semana. Começa tu."
            : "Ainda não há ninguém no ranking."}
        </p>
      )}

      <ul className="space-y-2">
        {data?.entries.map((entry) => (
          <Row key={entry.user.id} entry={entry} />
        ))}
      </ul>

      {data?.me && !noTop && (
        <>
          <p className="px-1 text-center text-xs text-muted-foreground">⋯</p>
          <ul>
            <Row entry={data.me} fixed />
          </ul>
        </>
      )}

      {/* Sem linha nenhuma, quem não pontuou ficava a pensar que o ranking
          estava partido. Mais vale dizer porquê. */}
      {data && !data.me && data.entries.length > 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-center text-xs text-muted-foreground">
          {scope === "weekly"
            ? "Ainda não ganhaste XP esta semana — uma lição chega para entrares."
            : "Ainda não tens XP para entrar no ranking."}
        </p>
      )}
    </div>
  );
}
