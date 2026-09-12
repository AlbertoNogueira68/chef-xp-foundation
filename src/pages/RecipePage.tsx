import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Flame, Heart, MessageCircle, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddComment, useComments, useDeleteComment } from "@/features/feed/hooks/useComments";
import { useRecipe, useToggleLike } from "@/features/feed/hooks/useRecipes";
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser";
import type { Recipe } from "@/types/recipe";
import { cn } from "@/lib/utils";

const difficultyLabel: Record<Recipe["difficulty"], string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * A receita inteira.
 *
 * No feed via-se a fotografia e duas linhas de descrição; os ingredientes, que
 * são o que se precisa para cozinhar, não apareciam em lado nenhum. É esta a
 * página que falta para a receita ser utilizável e para haver um link que se
 * possa partilhar.
 */
export function RecipePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: recipe, isLoading, isError } = useRecipe(id);
  const { data: me } = useCurrentUser();
  const toggleLike = useToggleLike();

  const [draft, setDraft] = useState("");
  const comments = useComments(id ?? "", Boolean(id));
  const addComment = useAddComment(id ?? "");
  const deleteComment = useDeleteComment(id ?? "");

  const submitComment = (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    addComment.mutate(body, { onSuccess: () => setDraft("") });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    );
  }

  if (isError || !recipe) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Esta receita já não existe.</p>
        <Button variant="outline" className="mt-4 rounded-full" onClick={() => navigate("/feed")}>
          Voltar ao feed
        </Button>
      </div>
    );
  }

  // Os ingredientes são texto livre, uma linha cada. O `\n` literal está aqui
  // porque o seed antigo gravou a sequência de dois caracteres em vez da
  // quebra de linha; sem isto uma receita de demonstração aparece numa linha
  // só. O seed foi corrigido, mas as bases já semeadas não se corrigem
  // sozinhas.
  const ingredients = recipe.ingredients
    .split(/\r?\n|\\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <article className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 rounded-full text-muted-foreground"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="mr-1.5 size-4" /> Voltar
      </Button>

      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-muted">
        {recipe.imageUrl ? (
          <img src={recipe.imageUrl} alt={recipe.title} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100 text-sm text-muted-foreground">
            {recipe.title}
          </div>
        )}
        <Badge className="absolute bottom-3 left-3 border-0 bg-black/50 text-white backdrop-blur-sm">
          +{recipe.xpReward} XP
        </Badge>
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-bold leading-tight">{recipe.title}</h1>

        <Link
          to={`/chef/${recipe.author.id}`}
          className="inline-flex items-center gap-2.5 rounded-full transition-opacity hover:opacity-80"
        >
          <Avatar className="size-9 ring-2 ring-amber-500/20">
            <AvatarImage src={recipe.author.photoUrl ?? undefined} />
            <AvatarFallback>{recipe.author.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span>
            <span className="block text-sm font-semibold leading-none">
              {recipe.author.username}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Nível {recipe.author.level} · {formatDate(recipe.createdAt)}
            </span>
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="secondary" className="rounded-full text-[11px]">
            <Clock className="mr-1 size-3" />
            {recipe.cookTimeMin} min
          </Badge>
          <Badge variant="secondary" className="rounded-full text-[11px]">
            <Flame className="mr-1 size-3" />
            {difficultyLabel[recipe.difficulty]}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className={cn("rounded-full", recipe.likedByMe && "text-rose-500")}
          disabled={toggleLike.isPending}
          aria-pressed={recipe.likedByMe}
          onClick={() => toggleLike.mutate({ id: recipe.id, liked: recipe.likedByMe })}
        >
          <Heart className={cn("mr-1.5 size-4", recipe.likedByMe && "fill-current")} />
          {recipe.likesCount}
        </Button>
        <span className="inline-flex items-center gap-1.5 px-2 text-sm text-muted-foreground">
          <MessageCircle className="size-4" />
          {recipe.commentsCount}
        </span>
      </div>

      <p className="whitespace-pre-line text-sm leading-relaxed">{recipe.description}</p>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ingredientes
        </h2>
        <ul className="space-y-1.5 rounded-xl border border-border/60 bg-card p-3">
          {ingredients.map((line, index) => (
            <li key={index} className="flex gap-2 text-sm">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
              {line}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Comentários
        </h2>

        <form onSubmit={submitComment} className="mb-3 flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escreve um comentário…"
            className="rounded-full"
            maxLength={500}
            aria-label="Comentário"
          />
          <Button
            type="submit"
            size="sm"
            className="rounded-full"
            disabled={!draft.trim() || addComment.isPending}
          >
            Enviar
          </Button>
        </form>

        {comments.data?.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Ainda não há comentários. Diz alguma coisa.
          </p>
        )}

        <ul className="space-y-3">
          {comments.data?.map((comment) => (
            <li key={comment.id} className="flex gap-2.5">
              <Avatar className="size-8">
                <AvatarImage src={comment.author.photoUrl ?? undefined} />
                <AvatarFallback>{comment.author.username.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <Link to={`/chef/${comment.author.id}`} className="font-semibold hover:underline">
                    {comment.author.username}
                  </Link>{" "}
                  {comment.body}
                </p>
              </div>
              {/* Apagar só o que é meu. O servidor recusa o resto de qualquer
                  maneira; esconder o botão evita oferecer o que vai falhar. */}
              {comment.author.id === me?.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 rounded-full text-muted-foreground"
                  aria-label="Apagar comentário"
                  disabled={deleteComment.isPending}
                  onClick={() => deleteComment.mutate(comment.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
