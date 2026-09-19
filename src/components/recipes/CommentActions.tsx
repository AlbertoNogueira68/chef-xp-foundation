import { useState } from "react";
import { Flag, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReportDialog } from "@/components/moderation/ReportDialog";
import type { Comment } from "@/types/recipe";

/**
 * O que se pode fazer a um comentário.
 *
 * Apagar tem três donos e não um: quem escreveu, o dono da receita — é a
 * página dele, e era isto que faltava — e a moderação, que age pelo servidor.
 * Aqui mostram-se os dois primeiros, que são os que dependem de quem está a
 * ver. Quem não é nenhum deles tem a denúncia, que é o caminho para o
 * terceiro.
 */
export function CommentActions({
  comment,
  meId,
  recipeAuthorId,
  onDelete,
  isDeleting,
}: {
  comment: Comment;
  meId?: string;
  recipeAuthorId: string;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [reporting, setReporting] = useState(false);

  if (!meId) return null;

  const isMine = comment.author.id === meId;
  const canDelete = isMine || recipeAuthorId === meId;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-full text-muted-foreground"
            aria-label={`Options for ${comment.author.username}'s comment`}
          >
            <MoreHorizontal className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canDelete && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={isDeleting}
              onSelect={onDelete}
            >
              <Trash2 className="mr-2 size-3.5" />
              {isMine ? "Delete" : "Delete from my recipe"}
            </DropdownMenuItem>
          )}
          {!isMine && (
            <DropdownMenuItem onSelect={() => setReporting(true)}>
              <Flag className="mr-2 size-3.5" /> Report
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {!isMine && (
        <ReportDialog
          subjectType="comment"
          subjectId={comment.id}
          open={reporting}
          onOpenChange={setReporting}
        />
      )}
    </>
  );
}
