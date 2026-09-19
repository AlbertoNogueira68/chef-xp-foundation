import { useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { useDeleteAccount, useExportData } from "@/features/profile/hooks/useAccount";
import type { User } from "@/types/user";
import { t } from "@/i18n";

/**
 * Levar os dados e ir embora.
 *
 * As duas coisas andam juntas de propósito: quem está a pensar em apagar a
 * conta tem à frente, no mesmo sítio, a forma de guardar primeiro o que fez.
 */
export function DangerZone({ user }: { user: User }) {
  const exportData = useExportData();
  const deleteAccount = useDeleteAccount();

  const [confirming, setConfirming] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [password, setPassword] = useState("");

  const nameMatches = typedName.trim().toLowerCase() === user.username;

  const submit = () => {
    if (!nameMatches) {
      toast.error(t("The username doesn't match"));
      return;
    }
    deleteAccount.mutate({
      confirmUsername: typedName.trim().toLowerCase(),
      password: password || undefined,
    });
  };

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("Your account")}
      </p>

      <Button
        type="button"
        variant="outline"
        className="w-full rounded-full"
        disabled={exportData.isPending}
        onClick={() => exportData.mutate()}
      >
        {exportData.isPending ? (
          <Loader2 className="mr-1.5 size-4 animate-spin" />
        ) : (
          <Download className="mr-1.5 size-4" />
        )}
        Descarregar os meus dados
      </Button>
      <p className="text-[11px] text-muted-foreground">
        {t("One file with everything: recipes, comments, progress and every XP point you earned.")}
      </p>

      <Button
        type="button"
        variant="ghost"
        className="w-full rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => {
          setTypedName("");
          setPassword("");
          setConfirming(true);
        }}
      >
        <Trash2 className="mr-1.5 size-4" />
        {t("Delete your account")}
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar a conta de @{user.username}?</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "Everything goes: recipes, comments, likes, missions, progress and XP. We keep no copy and there's no undo. If you want to keep what you made, download your data first.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="confirm-name">
                {t("Type")} <span className="font-mono font-semibold">{user.username}</span>
                {t("to confirm")}
              </Label>
              <Input
                id="confirm-name"
                value={typedName}
                autoComplete="off"
                onChange={(event) => setTypedName(event.target.value)}
              />
            </div>

            {/* Contas de Google não têm password para dar; nesses casos o nome
                escrito à mão é o travão. */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">{t("Password (if your account has one)")}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>{t("Keep the account")}</AlertDialogCancel>
            <button
              type="button"
              className={buttonVariants({ variant: "destructive" })}
              disabled={!nameMatches || deleteAccount.isPending}
              onClick={submit}
            >
              {deleteAccount.isPending ? "A apagar…" : t("Delete for good")}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
