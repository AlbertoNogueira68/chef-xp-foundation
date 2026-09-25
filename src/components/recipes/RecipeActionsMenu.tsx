import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flag, MoreHorizontal, Pencil, Trash2, UserX } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditRecipeDialog } from "@/components/recipes/EditRecipeDialog";
import { ReportDialog } from "@/components/moderation/ReportDialog";
import { useDeleteRecipe } from "@/features/feed/hooks/useRecipes";
import { useToggleBlock } from "@/features/moderation/hooks/useModeration";
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser";
import type { Recipe } from "@/types/recipe";
import { t } from "@/i18n";

/**
 * O menu de uma receita — e o que ele tem depende de quem a vê.
 *
 * Para o autor: editar e apagar. Para toda a gente: denunciar e bloquear quem
 * a publicou. Antes deste segundo caso o menu não aparecia sequer a quem não
 * fosse o autor, o que queria dizer que ver uma receita perigosa ou um insulto
 * no feed não dava nada para fazer — nem sair dali.
 *
 * `onDeleted` existe porque o sítio certo para ir a seguir depende de onde o
 * menu está: na página de detalhe a receita deixou de existir e é preciso sair,
 * no feed basta a lista recarregar.
 */
export function RecipeActionsMenu({
  recipe,
  onDeleted,
}: {
  recipe: Recipe;
  onDeleted?: () => void;
}) {
  const { data: me } = useCurrentUser();
  const remove = useDeleteRecipe();
  const toggleBlock = useToggleBlock();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [blocking, setBlocking] = useState(false);

  // Sem sessão carregada ainda não se sabe qual dos dois menus é o certo.
  if (!me) return null;

  const isMine = me.id === recipe.author.id;

  const confirmDelete = () => {
    remove.mutate(recipe.id, {
      onSuccess: () => {
        setConfirming(false);
        if (onDeleted) onDeleted();
        else navigate("/feed");
      },
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            aria-label={t("Recipe options")}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isMine ? (
            <>
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil className="mr-2 size-3.5" />
                {t("Edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirming(true)}
              >
                <Trash2 className="mr-2 size-3.5" />
                {t("Delete")}
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => setReporting(true)}>
                <Flag className="mr-2 size-3.5" />
                {t("Report recipe")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setBlocking(true)}
              >
                <UserX className="mr-2 size-3.5" /> Bloquear {recipe.author.username}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {isMine && <EditRecipeDialog recipe={recipe} open={editing} onOpenChange={setEditing} />}

      {!isMine && (
        <ReportDialog
          subjectType="recipe"
          subjectId={recipe.id}
          open={reporting}
          onOpenChange={setReporting}
        />
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar “{recipe.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The likes and comments go with it, and the {recipe.xpReward} XP the post paid are
              taken back. There's no undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Keep")}</AlertDialogCancel>
            <AlertDialogAction
              // Por omissão herda a cor primária, que aqui diria "confirma" a
              // uma ação que não se desfaz.
              className={buttonVariants({ variant: "destructive" })}
              disabled={remove.isPending}
              onClick={(event) => {
                // Sem isto o diálogo fecha antes de o pedido acabar e o erro
                // não tem onde aparecer.
                event.preventDefault();
                confirmDelete();
              }}
            >
              {remove.isPending ? t("Deleting…") : t("Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blocking} onOpenChange={setBlocking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear {recipe.author.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "You stop seeing what they post and they stop seeing you. If you followed each other, that ends. You can undo it in settings.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              disabled={toggleBlock.isPending}
              onClick={(event) => {
                event.preventDefault();
                toggleBlock.mutate(
                  { id: recipe.author.id, blocked: false },
                  { onSuccess: () => setBlocking(false) },
                );
              }}
            >
              {toggleBlock.isPending ? t("Blocking…") : t("Block")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
