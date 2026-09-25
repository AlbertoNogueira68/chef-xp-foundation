import { MailCheck, MailWarning } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthProviders } from "@/features/auth/hooks/useAuthProviders";
import { useSendEmailVerification } from "@/features/auth/hooks/usePasswordRecovery";
import type { User } from "@/types/user";
import { t } from "@/i18n";

/**
 * O estado do email da própria conta, nas definições.
 *
 * Informa, não tranca: uma conta por confirmar usa a app na mesma. Trancar
 * funcionalidades a quem já cá estava era mudar as regras a meio, e o que se
 * ganha em confirmar o endereço é só isto — poder recuperar a conta depois.
 *
 * Não aparece de todo quando o servidor não tem SMTP: sem ele não há
 * confirmação possível, e um aviso permanente sobre algo que não se pode
 * resolver é ruído.
 */
export function EmailVerification({ user }: { user: User }) {
  const { data: providers } = useAuthProviders();
  const enviar = useSendEmailVerification();

  if (!providers?.passwordRecovery) return null;

  if (user.emailVerified) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <MailCheck className="size-4 shrink-0 text-emerald-600" />
        <span>
          Email confirmed: <span className="font-medium text-foreground">{user.email}</span>
        </span>
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <MailWarning className="size-4 shrink-0 text-amber-600" />
        {t("Email unconfirmed")}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Confirma <span className="font-medium text-foreground">{user.email}</span>
        {t("so you can recover the account if you lose your password.")}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 rounded-full"
        disabled={enviar.isPending || enviar.isSuccess}
        onClick={() =>
          enviar.mutate(undefined, {
            onSuccess: () => toast.success(t("Email sent. Check your inbox.")),
            onError: (error) => toast.error(error.message),
          })
        }
      >
        {enviar.isPending ? t("Sending…") : enviar.isSuccess ? t("Sent") : t("Send confirmation")}
      </Button>
    </div>
  );
}
