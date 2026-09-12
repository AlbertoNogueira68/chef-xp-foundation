import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Flame, Heart, MessageCircle, MoreHorizontal, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddComment, useComments } from "@/features/feed/hooks/useComments";
import type { Recipe } from "@/types/recipe";
import { cn } from "@/lib/utils";

const difficultyLabel: Record<Recipe["difficulty"], string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};

export function FeedPost({
  recipe,
  onToggleLike,
  pending,
}: {
  recipe: Recipe;
  onToggleLike?: (recipe: Recipe) => void;
  pending?: boolean;
}) {
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");

  const comments = useComments(recipe.id, showComments);
  const addComment = useAddComment(recipe.id);

  const submitComment = (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    addComment.mutate(body, { onSuccess: () => setDraft("") });
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center justify-between px-3 py-2.5">
        <Link
          to={`/chef/${recipe.author.id}`}
          className="flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <Avatar className="size-9 ring-2 ring-amber-500/20">
            <AvatarImage src={recipe.author.photoUrl ?? undefined} />
            <AvatarFallback>{recipe.author.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold leading-none">{recipe.author.username}</p>
            <p className="text-[11px] text-muted-foreground">Nível {recipe.author.level}</p>
          </div>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full"
          aria-label="Mais opções"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </div>

      <Link
        to={`/recipe/${recipe.id}`}
        className="relative block aspect-square w-full overflow-hidden bg-muted"
      >
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100 text-sm text-muted-foreground">
            {recipe.title}
          </div>
        )}
        <Badge className="absolute bottom-3 left-3 border-0 bg-black/50 text-white backdrop-blur-sm">
          +{recipe.xpReward} XP
        </Badge>
      </Link>

      <div className="space-y-2 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn("size-9 rounded-full", recipe.likedByMe && "text-rose-500")}
              disabled={pending}
              aria-pressed={recipe.likedByMe}
              aria-label={recipe.likedByMe ? "Retirar gosto" : "Gostar"}
              onClick={() => onToggleLike?.(recipe)}
            >
              <Heart className={cn("size-5", recipe.likedByMe && "fill-current")} />
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
        </div>

        <p className="text-sm font-semibold">
          {recipe.likesCount.toLocaleString("pt-PT")} {recipe.likesCount === 1 ? "gosto" : "gostos"}
        </p>

        <p className="text-sm leading-snug">
          <Link to={`/chef/${recipe.author.id}`} className="font-semibold hover:underline">
            {recipe.author.username}
          </Link>{" "}
          <span className="text-foreground/90">{recipe.description}</span>
        </p>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {recipe.cookTimeMin} min
          </span>
          <span className="inline-flex items-center gap-1">
            <Flame className="size-3" /> {difficultyLabel[recipe.difficulty]}
          </span>
          {recipe.commentsCount > 0 && (
            <button
              type="button"
              className="hover:text-foreground"
              onClick={() => setShowComments((open) => !open)}
            >
              Ver {recipe.commentsCount} {recipe.commentsCount === 1 ? "comentário" : "comentários"}
            </button>
          )}
        </div>

        {showComments && (
          <div className="space-y-2 border-t border-border/60 pt-2.5">
            {comments.isLoading && (
              <p className="text-xs text-muted-foreground">A carregar comentários…</p>
            )}

            {comments.data?.map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <Avatar className="size-6">
                  <AvatarImage src={comment.author.photoUrl ?? undefined} />
                  <AvatarFallback className="text-[9px]">
                    {comment.author.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <p className="text-xs leading-snug">
                  <Link to={`/chef/${comment.author.id}`} className="font-semibold hover:underline">
                    {comment.author.username}
                  </Link>{" "}
                  <span className="text-foreground/90">{comment.body}</span>
                </p>
              </div>
            ))}

            {comments.data?.length === 0 && !comments.isLoading && (
              <p className="text-xs text-muted-foreground">Ainda não há comentários. Começa tu.</p>
            )}

            <form onSubmit={submitComment} className="flex gap-2 pt-1">
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Escreve um comentário…"
                maxLength={500}
                className="h-8 rounded-full text-xs"
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                className="h-8 rounded-full text-xs"
                disabled={addComment.isPending || !draft.trim()}
              >
                Enviar
              </Button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}
