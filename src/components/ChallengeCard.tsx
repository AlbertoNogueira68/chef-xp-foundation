import { CalendarDays, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Challenge } from "@/types/challenge";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

function daysLeft(value: string) {
  const diff = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const remaining = daysLeft(challenge.endsAt);

  return (
    <article className="relative overflow-hidden rounded-2xl border border-border/60 shadow-sm">
      <div className="relative aspect-[4/5] w-full bg-muted">
        {challenge.imageUrl && (
          <img src={challenge.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
          <Badge className="mb-2 w-fit border-0 bg-white/20 text-white backdrop-blur-sm">
            <Zap className="mr-1 size-3" /> +{challenge.xpReward} XP
          </Badge>
          <h3 className="text-xl font-bold leading-tight">{challenge.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-white/85">{challenge.description}</p>

          <div className="mt-4 flex items-center gap-1.5 text-xs text-white/75">
            <CalendarDays className="size-3.5" />
            {challenge.active ? (
              <span>
                Termina {formatDate(challenge.endsAt)} · {remaining}{" "}
                {remaining === 1 ? "dia" : "dias"}
              </span>
            ) : (
              <span>Terminou {formatDate(challenge.endsAt)}</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
