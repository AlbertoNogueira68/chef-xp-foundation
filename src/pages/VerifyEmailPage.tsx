import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { useVerifyEmail } from "@/features/auth/hooks/usePasswordRecovery";

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
        titulo="Link incompleto"
        descricao="Este endereço não traz nenhum token. Abre o link tal como veio no email."
      >
        <Button asChild className="w-full rounded-full">
          <Link to="/feed">Ir para a app</Link>
        </Button>
      </AuthCard>
    );
  }

  if (confirmar.isPending) {
    return (
      <AuthCard titulo="A confirmar…" descricao="Um instante.">
        <div className="flex justify-center py-2">
          <span className="size-6 animate-spin rounded-full border-2 border-muted border-t-amber-500" />
        </div>
      </AuthCard>
    );
  }

  if (confirmar.isError) {
    return (
      <AuthCard
        titulo="Não deu para confirmar"
        descricao={
          confirmar.error instanceof Error
            ? confirmar.error.message
            : "O link é inválido ou já expirou."
        }
        rodape={
          <Link
            to="/feed"
            className="inline-flex min-h-8 items-center px-2 text-muted-foreground underline-offset-4 hover:underline"
          >
            Ir para a app
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          Podes pedir outro link nas definições do perfil, com a sessão aberta.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      titulo={confirmar.data.alreadyVerified ? "Já estava confirmado" : "Email confirmado"}
      descricao={
        confirmar.data.alreadyVerified
          ? "Este endereço já tinha sido confirmado. Não tens de fazer mais nada."
          : "Obrigado. É por este endereço que recuperas a conta se perderes a password."
      }
    >
      <Button
        asChild
        className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 font-semibold"
      >
        <Link to="/feed">Ir para a app</Link>
      </Button>
    </AuthCard>
  );
}
