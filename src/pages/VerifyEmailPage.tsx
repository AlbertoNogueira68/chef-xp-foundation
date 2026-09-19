import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { useVerifyEmail } from "@/features/auth/hooks/usePasswordRecovery";
import { t } from "@/i18n";

/**
 * Onde o link de confirmação aterra.
 *
 * Confirma sozinho ao abrir — pedir mais um clique a quem já clicou no email
 * não prova nada de novo. Quem trata do "uma vez só" é a `useQuery` do hook,
 * pela chave do token; abrir o mesmo link duas vezes responde
 * `alreadyVerified` em vez de dar erro.
 */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const confirmar = useVerifyEmail(token);

  if (!token) {
    return (
      <AuthCard
        titulo={t("Incomplete link")}
        descricao={t(
          "This address carries no token. Open the link exactly as it came in the email.",
        )}
      >
        <Button asChild className="w-full rounded-full">
          <Link to="/feed">{t("Go to the app")}</Link>
        </Button>
      </AuthCard>
    );
  }

  if (confirmar.isPending) {
    return (
      <AuthCard titulo={t("Confirming…")} descricao="Um instante.">
        <div className="flex justify-center py-2">
          <span className="size-6 animate-spin rounded-full border-2 border-muted border-t-amber-500" />
        </div>
      </AuthCard>
    );
  }

  if (confirmar.isError) {
    return (
      <AuthCard
        titulo={t("Couldn't confirm")}
        descricao={
          confirmar.error instanceof Error
            ? confirmar.error.message
            : t("The link is invalid or has expired.")
        }
        rodape={
          <Link
            to="/feed"
            className="inline-flex min-h-8 items-center px-2 text-muted-foreground underline-offset-4 hover:underline"
          >
            {t("Go to the app")}
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          {t("You can ask for another link in your profile settings, while signed in.")}
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      titulo={confirmar.data.alreadyVerified ? t("Already confirmed") : t("Email confirmed")}
      descricao={
        confirmar.data.alreadyVerified
          ? t("This address was already confirmed. Nothing else to do.")
          : t("Thanks. This address is how you recover the account if you lose your password.")
      }
    >
      <Button
        asChild
        className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 font-semibold"
      >
        <Link to="/feed">{t("Go to the app")}</Link>
      </Button>
    </AuthCard>
  );
}
