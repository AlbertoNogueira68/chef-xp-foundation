import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChefXPLogo } from "@/components/ChefXPLogo";

/**
 * A moldura dos ecrãs de conta que não são o de entrada: recuperar password,
 * redefinir, confirmar email.
 *
 * Existe porque são três ecrãs com o mesmo desenho e o mesmo fundo do
 * `AuthPage`. Repetir o gradiente e o cartão em cada um deles era garantir
 * que divergiam à primeira alteração feita só num.
 */
export function AuthCard({
  titulo,
  descricao,
  children,
  rodape,
}: {
  titulo: string;
  descricao?: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-100/70 via-background to-background" />

      <div className="relative w-full max-w-md space-y-6">
        <div className="text-center">
          <Link
            to="/"
            aria-label="Chef XP — página inicial"
            className="inline-flex min-h-8 items-center justify-center px-2"
          >
            <ChefXPLogo className="text-3xl" />
          </Link>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-xl backdrop-blur-xl">
          <h1 className="text-lg font-semibold">{titulo}</h1>
          {descricao && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{descricao}</p>
          )}
          <div className="mt-5">{children}</div>
        </div>

        {rodape && <div className="text-center text-sm">{rodape}</div>}
      </div>
    </div>
  );
}
