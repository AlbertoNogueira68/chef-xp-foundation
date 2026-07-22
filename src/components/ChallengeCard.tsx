import { Users, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Challenge } from "@/types/challenge";
import { cn } from "@/lib/utils";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-border/60 shadow-sm">
      <div className="relative aspect-[4/5] w-full">
        {challenge.imageUrl && (
          <img
            src={challenge.imageUrl}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        )}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-t",
            challenge.gradient ?? "from-black/80 via-black/30 to-transparent",
          )}
        />
        <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
          <Badge className="mb-2 w-fit border-0 bg-white/20 text-white backdrop-blur-sm">
            <Zap className="mr-1 size-3" /> +{challenge.xpReward} XP
          </Badge>
          <h3 className="text-xl font-bold leading-tight">{challenge.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-white/85">{challenge.description}</p>

          <div className="mt-3 flex items-center gap-2 text-xs text-white/75">
            <Users className="size-3.5" />
            {(challenge.participants ?? 0).toLocaleString("pt-PT")} a participar
          </div>

          {challenge.progress != null && challenge.progress > 0 && (
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-[10px] text-white/70">
                <span>O teu progresso</span>
                <span>{challenge.progress}%</span>
              </div>
              <Progress value={challenge.progress} className="h-1.5 bg-white/20" />
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="text-xs text-white/70">
              {challenge.active ? "Até" : "Terminou"} {formatDate(challenge.endsAt)}
            </span>
            <Button
              size="sm"
              className="rounded-full bg-white text-foreground hover:bg-white/90"
            >
              Participar
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
