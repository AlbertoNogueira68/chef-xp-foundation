import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { useForgotPassword } from "@/features/auth/hooks/usePasswordRecovery";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/features/auth/schemas";
import { t } from "@/i18n";

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
        titulo={t("Check your email")}
        descricao={
          <>
            {t("If there's an account for")}
            <strong>{getValues("email")}</strong>
            {t(", the recovery link is on its way. It lasts an hour and works once.")}
          </>
        }
        rodape={
          <Link
            to="/auth"
            className="inline-flex min-h-8 items-center px-2 text-muted-foreground underline-offset-4 hover:underline"
          >
            {t("Back to sign in")}
          </Link>
        }
      >
        <p className="text-sm text-muted-foreground">
          {t("Nothing arrived? Check the address you typed, and your spam folder.")}
        </p>
        <Button
          variant="outline"
          className="mt-4 w-full rounded-full"
          onClick={() => pedir.reset()}
        >
          {t("Try another email")}
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      titulo={t("Recover your password")}
      descricao={t("Type your account's email. We'll send you a link to choose a new password.")}
      rodape={
        <Link
          to="/auth"
          className="inline-flex min-h-8 items-center px-2 text-muted-foreground underline-offset-4 hover:underline"
        >
          {t("Actually, I remember — back to sign in")}
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
          {pedir.isPending ? "A enviar…" : t("Send the link")}
        </Button>
      </form>
    </AuthCard>
  );
}
