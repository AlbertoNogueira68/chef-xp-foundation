import { useState } from "react";
import { BadgeCheck, MailWarning } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChangePassword } from "@/features/auth/hooks/useAccount";
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser";

/**
 * Definições da conta.
 *
 * Uma conta criada pela Google não tem password nenhuma. Para essa, isto não é
 * "mudar" mas "definir" — e não se lhe pede a actual, que nunca existiu. Sem
 * este ecrã, quem entrasse pela Google ficava preso a ela para sempre.
 */
export function AccountSettings({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: user } = useCurrentUser();
  const change = useChangePassword();

  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");

  const temPassword = user?.hasPassword !== false;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    change.mutate(
      { currentPassword: temPassword ? current : null, password },
      {
        onSuccess: () => {
          toast.success(
            temPassword
              ? "Password alterada. As outras sessões foram terminadas."
              : "Password definida. Já podes entrar sem o Google.",
          );
          setCurrent("");
          setPassword("");
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>A tua conta</DialogTitle>
          <DialogDescription>{user?.email}</DialogDescription>
        </DialogHeader>

        <div
          className={
            user?.emailVerified
              ? "flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
              : "flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800"
          }
        >
          {user?.emailVerified ? (
            <>
              <BadgeCheck className="size-4" />
              Email confirmado
            </>
          ) : (
            <>
              <MailWarning className="size-4" />
              Email por confirmar — o código está no teu correio
            </>
          )}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {temPassword && (
            <div className="space-y-1.5">
              <Label htmlFor="password-actual">Password actual</Label>
              <Input
                id="password-actual"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="password-nova">
              {temPassword ? "Password nova" : "Definir uma password"}
            </Label>
            <Input
              id="password-nova"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Pelo menos 8 caracteres"
              minLength={8}
              required
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            Mudar a password termina a sessão em todos os outros dispositivos. Neste continuas.
          </p>

          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={
              password.length < 8 || (temPassword && current.length === 0) || change.isPending
            }
          >
            {change.isPending ? "A guardar…" : temPassword ? "Mudar password" : "Definir password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
