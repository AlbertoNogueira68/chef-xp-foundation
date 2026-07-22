import { useState } from "react";
import {
  Bookmark,
  Clock,
  Flame,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Recipe } from "@/types/recipe";
import { cn } from "@/lib/utils";

const difficultyLabel: Record<Recipe["difficulty"], string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};

export function FeedPost({
  recipe,
  onLike,
  liking,
}: {
  recipe: Recipe;
  onLike?: (id: string) => void;
  liking?: boolean;
}) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const likes = recipe.likesCount + (liked ? 1 : 0);

  const handleLike = () => {
    if (!liked) {
      setLiked(true);
      onLike?.(recipe.id);
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar className="size-9 ring-2 ring-amber-500/20">
            <AvatarImage src={recipe.author.avatarUrl} />
            <AvatarFallback>{recipe.author.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold leading-none">{recipe.author.username}</p>
            <p className="text-[11px] text-muted-foreground">Nível {recipe.author.level}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="size-8 rounded-full">
          <MoreHorizontal className="size-4" />
        </Button>
      </div>

      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100 text-muted-foreground">
            Sem imagem
          </div>
        )}
        <Badge className="absolute bottom-3 left-3 border-0 bg-black/50 text-white backdrop-blur-sm">
          +{recipe.xpReward} XP
        </Badge>
      </div>

      <div className="space-y-2 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn("size-9 rounded-full", liked && "text-rose-500")}
              disabled={liking || liked}
              onClick={handleLike}
            >
              <Heart className={cn("size-5", liked && "fill-current")} />
            </Button>
            <Button variant="ghost" size="icon" className="size-9 rounded-full">
              <MessageCircle className="size-5" />
            </Button>
            <Button variant="ghost" size="icon" className="size-9 rounded-full">
              <Send className="size-5" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-9 rounded-full", saved && "text-amber-500")}
            onClick={() => setSaved(!saved)}
          >
            <Bookmark className={cn("size-5", saved && "fill-current")} />
          </Button>
        </div>

        <p className="text-sm font-semibold">{likes.toLocaleString("pt-PT")} gostos</p>

        <p className="text-sm leading-snug">
          <span className="font-semibold">{recipe.author.username}</span>{" "}
          <span className="text-foreground/90">{recipe.description}</span>
        </p>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {recipe.cookTimeMin} min
          </span>
          <span className="inline-flex items-center gap-1">
            <Flame className="size-3" /> {difficultyLabel[recipe.difficulty]}
          </span>
          {recipe.commentsCount != null && recipe.commentsCount > 0 && (
            <button type="button" className="hover:text-foreground">
              Ver {recipe.commentsCount} comentários
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
