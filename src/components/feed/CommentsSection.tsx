import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddComment, useComments } from "@/features/feed/hooks/useComments";
import type { FeedTarget } from "@/types/feed";

/**
 * A caixa de comentários é a mesma para um cozinhado e para uma receita. O que
 * muda é só o `target` — o serviço é que sabe a que rota isso corresponde.
 */
export function CommentsSection({
  target,
  itemKey,
  open,
}: {
  target: FeedTarget;
  itemKey: string;
  open: boolean;
}) {
  const [draft, setDraft] = useState("");

  const comments = useComments(target, open);
  const addComment = useAddComment(target, itemKey);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    addComment.mutate(body, { onSuccess: () => setDraft("") });
  };

  if (!open) return null;

  return (
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
            <span className="font-semibold">{comment.author.username}</span>{" "}
            <span className="text-foreground/90">{comment.body}</span>
          </p>
        </div>
      ))}

      {comments.data?.length === 0 && !comments.isLoading && (
        <p className="text-xs text-muted-foreground">Ainda não há comentários. Começa tu.</p>
      )}

      <form onSubmit={submit} className="flex gap-2 pt-1">
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
  );
}
