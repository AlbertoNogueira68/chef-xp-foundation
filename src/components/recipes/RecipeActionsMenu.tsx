import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { useDeleteRecipe } from "@/features/feed/hooks/useRecipes";
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser";
import type { Recipe } from "@/types/recipe";

/**
 * Editar e apagar a própria receita.
 *
 * Não aparece a ninguém que não seja o autor: o servidor recusa de qualquer
 * maneira, e um menu que só tem ações proibidas é pior do que menu nenhum.
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
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (me?.id !== recipe.author.id) return null;

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
            aria-label="Opções da receita"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil className="mr-2 size-3.5" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setConfirming(true)}
          >
            <Trash2 className="mr-2 size-3.5" /> Apagar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditRecipeDialog recipe={recipe} open={editing} onOpenChange={setEditing} />

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar “{recipe.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Os gostos e os comentários vão com ela, e os {recipe.xpReward} XP que a publicação
              pagou são retirados. Não dá para voltar atrás.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter</AlertDialogCancel>
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
              {remove.isPending ? "A apagar…" : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
