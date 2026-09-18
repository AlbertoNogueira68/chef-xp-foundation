import { useState } from "react";
import { Flag, MoreHorizontal, UserX, UserCheck } from "lucide-react";
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
import { ReportDialog } from "@/components/moderation/ReportDialog";
import { useToggleBlock } from "@/features/moderation/hooks/useModeration";

/**
 * Denunciar ou bloquear, a partir do perfil de outra pessoa.
 *
 * É aqui que se chega quando o problema é a conta e não uma receita em
 * particular — e é daqui que se desfaz, porque uma conta bloqueada continua a
 * ter perfil: o que ela deixa de ter é conteúdo visível.
 */
export function ChefActionsMenu({
  userId,
  username,
  isBlocked,
}: {
  userId: string;
  username: string;
  isBlocked: boolean;
}) {
  const toggleBlock = useToggleBlock();
  const [reporting, setReporting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            aria-label={`Opções de ${username}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setReporting(true)}>
            <Flag className="mr-2 size-3.5" /> Denunciar conta
          </DropdownMenuItem>
          {isBlocked ? (
            <DropdownMenuItem
              disabled={toggleBlock.isPending}
              onSelect={() => toggleBlock.mutate({ id: userId, blocked: true })}
            >
              <UserCheck className="mr-2 size-3.5" /> Desbloquear
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setConfirming(true)}
            >
              <UserX className="mr-2 size-3.5" /> Bloquear
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ReportDialog
        subjectType="user"
        subjectId={userId}
        open={reporting}
        onOpenChange={setReporting}
      />

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bloquear {username}?</AlertDialogTitle>
            <AlertDialogDescription>
              Deixas de ver o que esta pessoa publica e ela deixa de te ver a ti. Se se seguiam,
              deixam de se seguir. Podes desfazer nas definições.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              disabled={toggleBlock.isPending}
              onClick={(event) => {
                event.preventDefault();
                toggleBlock.mutate(
                  { id: userId, blocked: false },
                  { onSuccess: () => setConfirming(false) },
                );
              }}
            >
              {toggleBlock.isPending ? "A bloquear…" : "Bloquear"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
