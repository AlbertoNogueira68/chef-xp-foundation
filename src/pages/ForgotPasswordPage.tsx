import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { useForgotPassword } from "@/features/auth/hooks/usePasswordRecovery";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/features/auth/schemas";

/**
 * Pedir o link de recuperação.
 *
 * Quando o pedido passa, o ecrã não volta ao formulário: mostra o mesmo texto
 * quer a conta exista quer não. Dizer "não há conta com esse email" seria
 * confirmar a quem perguntasse quais os endereços registados aqui.
 */
export function ForgotPasswordPage() {
  const pedir = useForgotPassword();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit((values) => pedir.mutate(values.email));

  if (pedir.isSuccess) {
    return (
      <AuthCard
        titulo="Vê o teu email"
        descricao={
          <>
            Se houver uma conta com <strong>{getValues("email")}</strong>, o link de recuperação
            está a caminho. Vale uma hora e só pode ser usado uma vez.
          </>
        }
        rodape={
          <Link
            to="/auth"
            className="inline-flex min-h-8 items-center px-2 text-muted-foreground underline-offset-4 hover:underline"
          >
            Voltar a entrar
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          Não chegou nada? Confirma o endereço que escreveste e vê na pasta de spam.
        </p>
        <Button
          variant="outline"
          className="mt-4 w-full rounded-full"
          onClick={() => pedir.reset()}
        >
          Tentar com outro email
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      titulo="Recuperar a password"
      descricao="Escreve o email da tua conta. Mandamos-te um link para escolheres uma password nova."
      rodape={
        <Link
          to="/auth"
          className="inline-flex min-h-8 items-center px-2 text-muted-foreground underline-offset-4 hover:underline"
        >
          Afinal já me lembro — voltar a entrar
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="forgot-email">Email</Label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            autoFocus
            className="rounded-xl"
            {...register("email")}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        {pedir.isError && (
          <p className="text-xs text-destructive">
            {pedir.error instanceof Error ? pedir.error.message : "O pedido falhou"}
          </p>
        )}

        <Button
          type="submit"
          className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 font-semibold"
          disabled={pedir.isPending}
        >
          {pedir.isPending ? "A enviar…" : "Enviar o link"}
        </Button>
      </form>
    </AuthCard>
  );
}
