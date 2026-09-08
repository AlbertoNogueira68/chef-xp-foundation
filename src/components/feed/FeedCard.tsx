import { useState } from "react";
import { ChefHat, Clock, Flame, Heart, MessageCircle, MoreHorizontal, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommentsSection } from "./CommentsSection";
import { targetOf } from "@/features/feed/hooks/useFeed";
import type { CookFeedItem, FeedItem, RecipeFeedItem } from "@/types/feed";
import type { RecipeDifficulty } from "@/types/recipe";
import { cn } from "@/lib/utils";

const difficultyLabel: Record<RecipeDifficulty, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};

function timeAgo(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return new Date(value).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

/**
 * A legenda de um cozinhado.
 *
 * A missão vem à frente do prato de propósito: o feed não mostra o que a
 * pessoa sabe fazer, mostra o degrau que acabou de subir. É a mesma diferença
 * que o cartão do perfil defende — aqui é que ela fica visível para os outros.
 */
function CookBody({ item }: { item: CookFeedItem }) {
  return (
    <>
      <p className="text-sm leading-snug">
        <span className="font-semibold">{item.author.username}</span>{" "}
        <span className="text-foreground/90">
          cozinhou <span className="font-medium">{item.dishName || item.missionTitle}</span>
        </span>
      </p>

      {item.caption && <p className="text-sm leading-snug text-foreground/90">{item.caption}</p>}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
          <ChefHat className="size-3" />
          {item.missionTitle}
        </span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" /> {item.minutes} min na cozinha
        </span>
        <span>·</span>
        <span>{timeAgo(item.createdAt)}</span>
      </div>
    </>
  );
}

function RecipeBody({ item }: { item: RecipeFeedItem }) {
  return (
    <>
      <p className="text-sm leading-snug">
        <span className="font-semibold">{item.author.username}</span>{" "}
        <span className="text-foreground/90">{item.description}</span>
      </p>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" /> {item.cookTimeMin} min
        </span>
        <span className="inline-flex items-center gap-1">
          <Flame className="size-3" /> {difficultyLabel[item.difficulty]}
        </span>
        <span>·</span>
        <span>{timeAgo(item.createdAt)}</span>
      </div>
    </>
  );
}

/**
 * Um cartão do feed. As duas naturezas partilham a moldura inteira — cabeçalho,
 * gostos, comentários — e diferem só no meio.
 *
 * Partilham-na porque valem o mesmo: um cozinhado não é um aviso de progresso
 * ao lado das publicações a sério, é a publicação.
 */
export function FeedCard({
  item,
  onToggleLike,
  pending,
}: {
  item: FeedItem;
  onToggleLike?: (item: FeedItem) => void;
  pending?: boolean;
}) {
  const [showComments, setShowComments] = useState(false);

  const title = item.kind === "cook" ? item.dishName || item.missionTitle : item.title;

  return (
    <article className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar className="size-9 ring-2 ring-amber-500/20">
            <AvatarImage src={item.author.photoUrl ?? undefined} />
            <AvatarFallback>{item.author.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold leading-none">{item.author.username}</p>
            <p className="text-[11px] text-muted-foreground">
              {/* Num cozinhado interessa o nível de então, não o de agora: é o
                  que diz de onde a pessoa partiu. */}
              Nível {item.kind === "cook" ? item.levelAt : item.author.level}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label="Mais opções"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </div>

      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={title} className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100 text-sm text-muted-foreground">
            {title}
          </div>
        )}

        {item.kind === "cook" && (
          <Badge className="absolute left-3 top-3 gap-1 border-0 bg-emerald-600 text-white">
            <ChefHat className="size-3" />
            Missão cumprida
          </Badge>
        )}

        <Badge className="absolute bottom-3 left-3 border-0 bg-black/50 text-white backdrop-blur-sm">
          +{item.xpReward} XP
        </Badge>
      </div>

      <div className="space-y-2 px-3 py-2.5">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-9 rounded-full", item.likedByMe && "text-rose-500")}
            disabled={pending}
            aria-pressed={item.likedByMe}
            aria-label={item.likedByMe ? "Retirar gosto" : "Gostar"}
            onClick={() => onToggleLike?.(item)}
          >
            <Heart className={cn("size-5", item.likedByMe && "fill-current")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            aria-label="Comentários"
            aria-expanded={showComments}
            onClick={() => setShowComments((open) => !open)}
          >
            <MessageCircle className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            aria-label="Partilhar"
          >
            <Send className="size-5" />
          </Button>
        </div>

        <p className="text-sm font-semibold">
          {item.likesCount.toLocaleString("pt-PT")} {item.likesCount === 1 ? "gosto" : "gostos"}
        </p>

        {item.kind === "cook" ? <CookBody item={item} /> : <RecipeBody item={item} />}

        {item.commentsCount > 0 && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowComments((open) => !open)}
          >
            Ver {item.commentsCount} {item.commentsCount === 1 ? "comentário" : "comentários"}
          </button>
        )}

        <CommentsSection target={targetOf(item)} itemKey={item.key} open={showComments} />
      </div>
    </article>
  );
}
