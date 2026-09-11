import { useState } from "react";
import { MailWarning } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CodeInput } from "./CodeInput";
import { useRequestVerification, useVerifyEmail } from "@/features/auth/hooks/useAccount";
import { useCurrentUser } from "@/features/profile/hooks/useCurrentUser";

/**
 * A faixa de confirmação do email.
 *
 * Não tranca nada: a conta funciona por confirmar. O código serve para provar
 * que o endereço existe — e é isso que torna possível recuperar a password
 * mais tarde. Trancar a app à entrada só faria desistir quem ainda não sabe
 * se vale a pena ficar.
 */
export function VerifyEmailBanner() {
  const { data: user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");

  const verify = useVerifyEmail();
  const resend = useRequestVerification();

  // `emailVerified` só vem no perfil do próprio; indefinido significa que
  // ainda não sabemos, e não vale a pena alarmar ninguém à toa.
  if (!user || user.emailVerified !== false) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length !== 6) return;
    verify.mutate(code, {
      onSuccess: () => {
        toast.success("Conta confirmada.");
        setOpen(false);
        setCode("");
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <section className="rounded-2xl border border-amber-300/80 bg-amber-50/70 px-4 py-3">
      <div className="flex items-start gap-3">
        <MailWarning className="mt-0.5 size-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">Confirma o teu email</p>
          <p className="mt-0.5 text-xs text-amber-800/90">
            Enviámos um código para <span className="font-medium">{user.email}</span>. É o que te
            permite recuperar a conta se perderes a password.
          </p>

          {!open ? (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-8 rounded-full border-amber-400 bg-white/60 text-xs"
              onClick={() => setOpen(true)}
            >
              Inserir código
            </Button>
          ) : (
            <form onSubmit={submit} className="mt-2 space-y-2">
              <CodeInput value={code} onChange={setCode} disabled={verify.isPending} />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 flex-1 rounded-full text-xs"
                  disabled={code.length !== 6 || verify.isPending}
                >
                  Confirmar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-full text-xs"
                  disabled={resend.isPending}
                  onClick={() =>
                    resend.mutate(undefined, {
                      onSuccess: (result) =>
                        result.alreadyVerified
                          ? toast.success("Esta conta já está confirmada.")
                          : toast.success("Enviámos um código novo."),
                      // O servidor recusa pedidos seguidos; a mensagem dele já
                      // diz quantos segundos faltam.
                      onError: (error) => toast.error(error.message),
                    })
                  }
                >
                  Reenviar
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
